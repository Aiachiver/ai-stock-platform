"""Intraday candles and transparent short-horizon technical signals.

Yahoo Finance intraday data may be delayed, incomplete, rate-limited, or unavailable.
The 5–30 minute outputs are rule-based technical scores, not calibrated ML forecasts.
"""
from __future__ import annotations
import time
from threading import Lock
import numpy as np
import pandas as pd
import yfinance as yf

_CACHE = {}
_LOCKS = {}
_GUARD = Lock()
_CACHE_TTL = 20
_HORIZONS = (5, 10, 15, 20, 25, 30)

def _get_frame(symbol):
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
            "time": stamp.isoformat(), "open": round(float(row.Open), 4),
            "high": round(float(row.High), 4), "low": round(float(row.Low), 4),
            "close": round(float(row.Close), 4), "volume": int(max(0, float(row.Volume or 0)))
        })
    first, last = float(close.iloc[0]), float(close.iloc[-1])
    vol = float(returns.tail(20).std()) if len(returns) else 0.0
    return {
        "symbol": symbol, "interval": "1m", "current_price": round(last, 4),
        "change_pct": round((last / first - 1) * 100, 3),
        "as_of": frame.index[-1].isoformat(), "candles": candles, "horizons": horizons,
        "indicators": {"ema_fast": round(fast, 4), "ema_slow": round(slow, 4),
                       "momentum_5m_pct": round(momentum * 100, 3),
                       "recent_volatility_pct": round((vol if np.isfinite(vol) else 0) * 100, 3),
                       "trend": "UP" if fast > slow else "DOWN"},
        "data_note": "Yahoo Finance 1-minute candles; may be delayed, rate-limited, or unavailable.",
        "signal_note": "UP/DOWN values are heuristic technical scores, not calibrated probabilities or trained 5–30 minute ML forecasts. SELL BIAS means avoid a new long position; no short order is executed."
    }

def get_intraday_analysis(symbol):
    key = symbol.strip().upper()
    with _GUARD: lock = _LOCKS.setdefault(key, Lock())
    with lock:
        now = time.monotonic()
        with _GUARD:
            cached = _CACHE.get(key)
            if cached and now - cached["at"] < _CACHE_TTL: return cached["data"]
        data = _build_payload(key)
        with _GUARD: _CACHE[key] = {"at": time.monotonic(), "data": data}
        return data
