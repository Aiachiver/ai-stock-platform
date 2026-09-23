import numpy as np
import yfinance as yf


def predict_stock(symbol):

    try:

        df = yf.download(
            symbol,
            period="60d",
            interval="1d",
            auto_adjust=False,
            progress=False
        )

        if df.empty:
            print(f"NO PREDICTION DATA: {symbol}")
            return {
                "current_price": None,
                "predicted_price": None,
                "signal": "NO DATA"
            }

        prices = df["Close"].dropna().values

        if len(prices) < 20:
            print(f"NOT ENOUGH DATA: {symbol}")
            return {
                "current_price": None,
                "predicted_price": None,
                "signal": "NO DATA"
            }

        prices = np.array(prices, dtype=float).flatten()

        current = float(prices[-1])

        short_avg = float(np.mean(prices[-5:]))

        long_avg = float(np.mean(prices[-20:]))

        predicted = (short_avg + long_avg) / 2

        if predicted > current:
            signal = "BUY"
        elif predicted < current:
            signal = "SELL"
        else:
            signal = "HOLD"

        return {
            "current_price": round(current, 2),
            "predicted_price": round(predicted, 2),
            "signal": signal
        }

    except Exception as e:

        print("PREDICTION ERROR:", e)

        return {
            "current_price": None,
            "predicted_price": None,
            "signal": "NO DATA"
        }