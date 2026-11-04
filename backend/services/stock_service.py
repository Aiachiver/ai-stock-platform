import yfinance as yf


def get_stock_data(symbol):
    """Return daily OHLC bars for a readable three-month price chart."""
    try:
        df = yf.Ticker(symbol).history(period="3mo", interval="1d", auto_adjust=False)
        if df.empty:
            return []
        if getattr(df.columns, "nlevels", 1) > 1:
            df.columns = df.columns.get_level_values(0)

        rows = []
        for timestamp, row in df.iterrows():
            values = [row.get(name) for name in ("Open", "High", "Low", "Close")]
            if any(value is None for value in values):
                continue
            try:
                open_price, high_price, low_price, close_price = [float(value) for value in values]
            except (TypeError, ValueError):
                continue
            if not all(value == value for value in (open_price, high_price, low_price, close_price)):
                continue
            rows.append({
                "time": timestamp.isoformat(),
                "open": round(open_price, 2),
                "high": round(high_price, 2),
                "low": round(low_price, 2),
                "close": round(close_price, 2)
            })
        return rows
    except Exception as exc:
        print("STOCK DATA ERROR:", exc)
        return []
