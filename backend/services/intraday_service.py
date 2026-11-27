"""Intraday candles and transparent short-horizon technical signals.

Crypto uses Binance Spot klines to match the live Binance trade stream.
Equities use Yahoo Finance; provider timestamps and delays can vary.
The 5–30 minute outputs are rule-based technical scores, not calibrated ML forecasts.
"""
from __future__ import annotations
import time
from threading import Lock, Thread
import numpy as np
import pandas as pd
import requests
import yfinance as yf

_CRYPTO_PAIRS = {
    "BTC-USD": "BTCUSDT", "ETH-USD": "ETHUSDT", "SOL-USD": "SOLUSDT",
    "XRP-USD": "XRPUSDT", "DOGE-USD": "DOGEUSDT", "BNB-USD": "BNBUSDT",
}
_BINANCE_API = "https://api.binance.com/api/v3/klines"
_CACHE = {}
_LOCKS = {}
_GUARD = Lock()
_REFRESHING = set()
_CACHE_TTL = 5
_HORIZONS = (5, 10, 15, 20, 25, 30)


def _get_crypto_frame(symbol):
    pair = _CRYPTO_PAIRS[symbol]
    try:
        response = requests.get(
            _BINANCE_API, params={"symbol": pair, "interval": "1m", "limit": 240},
            timeout=12
        )
        response.raise_for_status()
        rows = response.json()
        if not rows:
            raise ValueError("Binance returned no crypto candles")
        columns = ["open_time", "Open", "High", "Low", "Close", "Volume",
                   "close_time", "quote_volume", "trades", "taker_base",
                   "taker_quote", "ignored"]
        frame = pd.DataFrame(rows, columns=columns)
        frame.index = pd.to_datetime(frame.pop("open_time").astype("int64"), unit="ms", utc=True)
        for col in ("Open", "High", "Low", "Close", "Volume"):
            frame[col] = pd.to_numeric(frame[col], errors="coerce")
        frame = frame[["Open", "High", "Low", "Close", "Volume"]].dropna()
        if len(frame) < 10:
            raise ValueError("Insufficient Binance crypto candles")
        frame.attrs["provider"] = "Binance Spot"
        return frame
    except Exception as binance_error:
        print(f"BINANCE CANDLES UNAVAILABLE ({symbol}); trying Yahoo Finance:", binance_error)
        frame = yf.Ticker(symbol).history(period="1d", interval="1m", auto_adjust=False)
        if frame is None or frame.empty:
            raise ValueError("No crypto candles available from Binance or Yahoo Finance")
        if isinstance(frame.columns, pd.MultiIndex):
            frame.columns = frame.columns.get_level_values(0)
        required = ["Open", "High", "Low", "Close", "Volume"]
        frame = frame[required].copy()
        for col in required:
            frame[col] = pd.to_numeric(frame[col], errors="coerce")
        frame = frame.dropna(subset=["Open", "High", "Low", "Close"])
        frame = frame[~frame.index.duplicated(keep="last")].sort_index()
        frame = frame[(frame[["Open", "High", "Low", "Close"]] > 0).all(axis=1)]
        if len(frame) < 10:
            raise ValueError("Insufficient Yahoo Finance crypto candles")
        frame.attrs["provider"] = "Yahoo Finance fallback"
        return frame


def _get_frame(symbol):
    if symbol in _CRYPTO_PAIRS:
        return _get_crypto_frame(symbol)
    attempts = (
        lambda: yf.Ticker(symbol).history(period="1d", interval="1m", auto_adjust=False),
        lambda: yf.download(symbol, period="1d", interval="1m", auto_adjust=False, progress=False, threads=False),
    )
    for attempt in attempts:
        try:
            frame = attempt()
            if frame is None or frame.empty: continue
            if isinstance(frame.columns, pd.MultiIndex): frame.columns = frame.columns.get_level_values(0)
            required = ["Open", "High", "Low", "Close", "Volume"]
            if not set(required).issubset(frame.columns): continue
            frame = frame[required].copy()
            for col in required: frame[col] = pd.to_numeric(frame[col], errors="coerce")
            frame = frame.dropna(subset=["Open", "High", "Low", "Close"])
            frame = frame[~frame.index.duplicated(keep="last")].sort_index()
            frame = frame[(frame[["Open", "High", "Low", "Close"]] > 0).all(axis=1)]
            if len(frame) >= 10: return frame
        except Exception as exc: print(f"INTRADAY DATA ATTEMPT FAILED ({symbol}):", exc)
    raise ValueError("Insufficient intraday candles from market-data provider")


def _build_payload(symbol):
    frame = _get_frame(symbol)
    close = frame["Close"].astype(float)
    returns = close.pct_change().dropna()
    fast = float(close.ewm(span=5, adjust=False).mean().iloc[-1])
    slow = float(close.ewm(span=13, adjust=False).mean().iloc[-1])
    momentum = float(close.iloc[-1] / close.iloc[-min(6, len(close))] - 1)
    trend_score = 1 if fast > slow else -1
    momentum_score = 1 if momentum > 0 else -1 if momentum < 0 else 0
    score = 0.55 * trend_score + 0.45 * momentum_score
    base_up = float(np.clip(0.5 + 0.15 * score, 0.35, 0.65))
    horizons = []
    for minutes in _HORIZONS:
        up = float(np.clip(0.5 + (base_up - 0.5) * min(1.0, 5.0 / minutes), 0.35, 0.65))
        down = 1 - up
        signal = "BUY" if up >= 0.60 else "SELL BIAS" if down >= 0.60 else "WAIT"
        horizons.append({
            "minutes": minutes, "up_probability_pct": round(up * 100, 1),
            "down_probability_pct": round(down * 100, 1),
            "confidence_pct": round(max(up, down) * 100, 1), "signal": signal,
            "reason": "Short-term trend and momentum agree." if abs(score) > 0.15 else "Trend and momentum are mixed or weak; wait for confirmation."
        })
    candles = []
    for stamp, row in frame.tail(240).iterrows():
        candles.append({
            "time": stamp.isoformat(), "open": round(float(row.Open), 8),
            "high": round(float(row.High), 8), "low": round(float(row.Low), 8),
            "close": round(float(row.Close), 8), "volume": float(row.Volume or 0)
        })
    first, last = float(close.iloc[0]), float(close.iloc[-1])
    vol = float(returns.tail(20).std()) if len(returns) else 0.0
    is_crypto = symbol in _CRYPTO_PAIRS
    provider = frame.attrs.get("provider", "Binance Spot" if is_crypto else "Yahoo Finance")
    return {
        "symbol": symbol, "interval": "1m", "current_price": last,
        "change_pct": round((last / first - 1) * 100, 3),
        "as_of": frame.index[-1].isoformat(), "candles": candles, "horizons": horizons,
        "data_source": provider, "is_live": False,
        "indicators": {"ema_fast": fast, "ema_slow": slow,
                       "momentum_5m_pct": round(momentum * 100, 3),
                       "recent_volatility_pct": round((vol if np.isfinite(vol) else 0) * 100, 3),
                       "trend": "UP" if fast > slow else "DOWN"},
        "data_note": f"{provider} 1-minute candles; exchange prices can differ slightly across venues.",
        "signal_note": "UP/DOWN values are heuristic technical scores, not calibrated probabilities or trained 5–30 minute ML forecasts. SELL BIAS means avoid a new long position; no short order is executed."
    }


def _refresh_symbol(key, lock):
    try:
        with lock:
            data = _build_payload(key)
            with _GUARD:
                _CACHE[key] = {"at": time.monotonic(), "data": data}
    except Exception as exc:
        print(f"INTRADAY BACKGROUND REFRESH FAILED ({key}):", exc)
    finally:
        with _GUARD:
            _REFRESHING.discard(key)


def get_intraday_analysis(symbol):
    """Return cached analysis immediately; refresh expired data in the background."""
    key = symbol.strip().upper()
    with _GUARD:
        lock = _LOCKS.setdefault(key, Lock())
        cached = _CACHE.get(key)
        age = time.monotonic() - cached["at"] if cached else None
        if cached and age < _CACHE_TTL:
            payload = dict(cached["data"])
            payload["data_age_seconds"] = int(age)
            payload["is_stale"] = False
            payload["refreshing"] = False
            return payload
        if cached:
            if key not in _REFRESHING:
                _REFRESHING.add(key)
                Thread(target=_refresh_symbol, args=(key, lock), daemon=True).start()
            payload = dict(cached["data"])
            payload["data_age_seconds"] = int(age)
            payload["is_stale"] = True
            payload["refreshing"] = True
            return payload

    with lock:
        with _GUARD:
            cached = _CACHE.get(key)
            if cached:
                age = time.monotonic() - cached["at"]
                payload = dict(cached["data"])
                payload["data_age_seconds"] = int(age)
                payload["is_stale"] = age >= _CACHE_TTL
                payload["refreshing"] = False
                return payload
        data = _build_payload(key)
        with _GUARD:
            _CACHE[key] = {"at": time.monotonic(), "data": data}
        payload = dict(data)
        payload["data_age_seconds"] = 0
        payload["is_stale"] = False
        payload["refreshing"] = False
        return payload
