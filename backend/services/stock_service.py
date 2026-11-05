import yfinance as yf


def _flatten_columns(frame):
    """Normalize yfinance's single- and multi-ticker column formats."""
    if getattr(frame.columns, "nlevels", 1) > 1:
        # yfinance currently returns (Price, Ticker); select the price level.
        frame.columns = frame.columns.get_level_values(0)
    return frame


def _download_history(symbol):
    """Try yfinance's Ticker and download paths to tolerate provider quirks."""
    ticker = yf.Ticker(symbol)
    attempts = (
        lambda: ticker.history(period="6mo", interval="1d", auto_adjust=False, raise_errors=True),
        lambda: yf.download(
            symbol, period="6mo", interval="1d", auto_adjust=False,
            progress=False, threads=False, group_by="column"
        ),
        lambda: ticker.history(period="3mo", interval="1d", auto_adjust=False),
    )
    for attempt in attempts:
        try:
            frame = attempt()
            if frame is not None and not frame.empty:
                frame = _flatten_columns(frame.copy())
                required = {"Open", "High", "Low", "Close"}
                if required.issubset(frame.columns):
                    return frame
        except Exception as exc:
            print(f"STOCK DATA SOURCE ATTEMPT FAILED ({symbol}):", exc)
    return None


def get_stock_data(symbol):
    """Return validated daily OHLC bars for the dashboard candlestick chart."""
    frame = _download_history(symbol)
    if frame is None:
        return []

    rows = []
    for timestamp, row in frame.iterrows():
        try:
            values = [float(row[name]) for name in ("Open", "High", "Low", "Close")]
        except (TypeError, ValueError, KeyError):
            continue
        if not all(value == value and abs(value) != float("inf") for value in values):
            continue
        open_price, high_price, low_price, close_price = values
        if min(open_price, high_price, low_price, close_price) <= 0:
            continue
        rows.append({
            "time": timestamp.isoformat(),
            "open": round(open_price, 2),
            "high": round(high_price, 2),
            "low": round(low_price, 2),
            "close": round(close_price, 2),
        })
    return rows
