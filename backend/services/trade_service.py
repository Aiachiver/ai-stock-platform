import yfinance as yf

def get_price(symbol):
    try:
        return float(yf.Ticker(symbol).info["regularMarketPrice"])
    except:
        return 100