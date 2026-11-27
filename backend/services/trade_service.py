"""Shared market-price lookup for paper orders and portfolio valuation."""
from __future__ import annotations

import time
from threading import Lock

from services.quote_service import get_stock_quote

_CACHE_TTL_SECONDS = 10
_cache = {}
_cache_lock = Lock()


def get_price(symbol: str):
    """Use the same Yahoo Finance quote snapshot shown in the dashboard."""
    key = symbol.strip().upper()
    now = time.monotonic()
    with _cache_lock:
        cached = _cache.get(key)
        if cached and now - cached[0] < _CACHE_TTL_SECONDS:
            return cached[1]

    try:
        quote = get_stock_quote(key)
        price = quote.get("price") if isinstance(quote, dict) else None
        if price is None:
            return None
        price = float(price)
        if price <= 0:
            return None
        with _cache_lock:
            _cache[key] = (time.monotonic(), price)
        return price
    except Exception as exc:
        print(f"PRICE LOOKUP FAILED ({key}): {exc}")
        return None
