import yfinance as yf

def get_stock_data(symbol):

    df = yf.download(
        symbol,
        period="5d",
        interval="1h",
        auto_adjust=False
    )

    df = df.reset_index()

    ohlc = []

    for i in range(len(df)):

        open_price = df["Open"].iloc[i].item()
        high_price = df["High"].iloc[i].item()
        low_price = df["Low"].iloc[i].item()
        close_price = df["Close"].iloc[i].item()

        ohlc.append({

            "time": str(df["Datetime"].iloc[i])[11:16],

            "open": round(float(open_price), 2),

            "high": round(float(high_price), 2),

            "low": round(float(low_price), 2),

            "close": round(float(close_price), 2)

        })

    return ohlc