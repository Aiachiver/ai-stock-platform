import yfinance as yf


def _number(value):
    try:
        if value is None:
            return None
        result = float(value)
        return result if result == result and abs(result) != float("inf") else None
    except (TypeError, ValueError):
        return None


def _frame_columns(frame):
    if getattr(frame.columns, "nlevels", 1) > 1:
        frame.columns = frame.columns.get_level_values(0)
    return frame


def get_stock_quote(symbol: str):
    """Best-effort Yahoo Finance snapshot; values may be delayed."""
    ticker = yf.Ticker(symbol)
    try:
        fast = ticker.fast_info or {}
    except Exception:
        fast = {}

    daily = ticker.history(period="5d", interval="1d", auto_adjust=False)
    intraday = ticker.history(period="1d", interval="5m", auto_adjust=False)
    if not daily.empty:
        daily = _frame_columns(daily)
    if not intraday.empty:
        intraday = _frame_columns(intraday)

    latest_intraday = intraday.iloc[-1] if not intraday.empty else None
    latest_daily = daily.iloc[-1] if not daily.empty else None
    price = _number(latest_intraday["Close"]) if latest_intraday is not None else None
    if price is None and latest_daily is not None:
        price = _number(latest_daily["Close"])
    if price is None:
        price = _number(fast.get("last_price"))
    if price is None:
        return {"symbol": symbol, "error": "Market data is currently unavailable"}

    previous_close = _number(fast.get("previous_close"))
    if previous_close is None and len(daily) >= 2:
        previous_close = _number(daily["Close"].iloc[-2])

    open_price = _number(fast.get("open"))
    day_high = _number(fast.get("day_high"))
    day_low = _number(fast.get("day_low"))
    if latest_intraday is not None:
        open_price = open_price or _number(latest_intraday.get("Open"))
        highs = [_number(v) for v in intraday["High"].tolist()]
        lows = [_number(v) for v in intraday["Low"].tolist()]
        day_high = max([v for v in [day_high, *highs] if v is not None], default=None)
        day_low = min([v for v in [day_low, *lows] if v is not None], default=None)
    if latest_daily is not None:
        open_price = open_price or _number(latest_daily.get("Open"))
        day_high = day_high if day_high is not None else _number(latest_daily.get("High"))
        day_low = day_low if day_low is not None else _number(latest_daily.get("Low"))

    try:
        info = ticker.info or {}
    except Exception:
        info = {}

    market_cap = _number(info.get("marketCap")) or _number(fast.get("market_cap"))
    trailing_pe = _number(info.get("trailingPE"))
    change = price - previous_close if previous_close is not None else None
    change_percent = change / previous_close * 100 if change is not None and previous_close else None

    return {
        "symbol": symbol,
        "company_name": info.get("shortName") or info.get("longName") or symbol,
        "price": round(price, 2),
        "previous_close": round(previous_close, 2) if previous_close is not None else None,
        "change": round(change, 2) if change is not None else None,
        "change_percent": round(change_percent, 2) if change_percent is not None else None,
        "open": round(open_price, 2) if open_price is not None else None,
        "day_high": round(day_high, 2) if day_high is not None else None,
        "day_low": round(day_low, 2) if day_low is not None else None,
        "market_cap": market_cap,
        "trailing_pe": round(trailing_pe, 2) if trailing_pe is not None else None,
        "currency": info.get("currency") or fast.get("currency") or "USD",
        "exchange": info.get("exchange") or info.get("fullExchangeName"),
        "as_of": str(intraday.index[-1]) if not intraday.empty else (str(daily.index[-1]) if not daily.empty else None),
        "data_source": "Yahoo Finance via yfinance",
        "data_note": "Market data may be delayed; not an exchange-grade real-time feed."
    }
