import yfinance as yf


def get_price(symbol):

    try:
        ticker = yf.Ticker(symbol)

        data = ticker.history(period="1d")

        if data.empty:
            return None

        price = data["Close"].dropna().iloc[-1]

        return float(price)

    except Exception as e:
        print("PRICE ERROR:", e)
        return None