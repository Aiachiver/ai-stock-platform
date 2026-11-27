"""Shared market-price lookup for paper orders and portfolio valuation."""
from __future__ import annotations

import time
from threading import Lock

import yfinance as yf

_CACHE_TTL_SECONDS = 10
_cache = {}
_cache_lock = Lock()


def get_price(symbol: str):
    key = symbol.strip().upper()
    now = time.monotonic()
    with _cache_lock:
        cached = _cache.get(key)
        if cached and now - cached[0] < _CACHE_TTL_SECONDS:
            return cached[1]

    try:
        ticker = yf.Ticker(key)
        # Prefer the latest available one-minute candle for intraday paper fills.
        data = ticker.history(period="1d", interval="1m", auto_adjust=False)
        if data is None or data.empty or data["Close"].dropna().empty:
            # Fallback keeps the paper portfolio usable when intraday data is unavailable.
            data = ticker.history(period="1d", interval="1d", auto_adjust=False)
        if data is None or data.empty:
            return None
        closes = data["Close"].dropna()
        if closes.empty:
            return None
        price = float(closes.iloc[-1])
        if price <= 0:
            return None
        with _cache_lock:
            _cache[key] = (time.monotonic(), price)
        return price
    except Exception as exc:
        print(f"PRICE LOOKUP FAILED ({key}): {exc}")
        return None
