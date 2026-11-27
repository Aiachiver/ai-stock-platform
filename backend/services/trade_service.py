"""Shared market-price lookup for paper orders and portfolio valuation."""
from __future__ import annotations

import time
from threading import Lock

import requests

from services.quote_service import get_stock_quote

_CRYPTO_PAIRS = {
    "BTC-USD": "BTCUSDT", "ETH-USD": "ETHUSDT", "SOL-USD": "SOLUSDT",
    "XRP-USD": "XRPUSDT", "DOGE-USD": "DOGEUSDT", "BNB-USD": "BNBUSDT",
}
_CACHE_TTL_SECONDS = 5
_cache = {}
_cache_lock = Lock()


def get_price(symbol: str):
    """Use Binance for supported crypto pairs and Yahoo Finance for equities."""
    key = symbol.strip().upper()
    now = time.monotonic()
    with _cache_lock:
        cached = _cache.get(key)
        if cached and now - cached[0] < _CACHE_TTL_SECONDS:
            return cached[1]

    try:
        if key in _CRYPTO_PAIRS:
            response = requests.get(
                "https://api.binance.com/api/v3/ticker/price",
                params={"symbol": _CRYPTO_PAIRS[key]},
                timeout=8,
            )
            response.raise_for_status()
            price = float(response.json()["price"])
        else:
            quote = get_stock_quote(key)
            price = float(quote["price"]) if isinstance(quote, dict) and quote.get("price") is not None else None
        if price is None or price <= 0:
            return None
        with _cache_lock:
            _cache[key] = (time.monotonic(), price)
        return price
    except Exception as exc:
        print(f"PRICE LOOKUP FAILED ({key}): {exc}")
        return None
