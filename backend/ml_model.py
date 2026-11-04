import numpy as np
import yfinance as yf


def _history(symbol, period="1y"):
    frame = yf.Ticker(symbol).history(period=period, interval="1d", auto_adjust=True)
    if getattr(frame.columns, "nlevels", 1) > 1:
        frame.columns = frame.columns.get_level_values(0)
    if frame.empty or "Close" not in frame:
        return None
    return frame.dropna(subset=["Close"])


def predict_stock(symbol):
    try:
        frame = _history(symbol, "1y")
        if frame is None or len(frame) < 21:
            return {"current_price": None, "predicted_price": None, "signal": "NO DATA"}

        prices = frame["Close"].astype(float).to_numpy()
        current = float(prices[-1])
        short_avg = float(np.mean(prices[-5:]))
        long_avg = float(np.mean(prices[-20:]))
        predicted = (short_avg + long_avg) / 2
        signal = "BUY" if predicted > current else "SELL" if predicted < current else "HOLD"
        return {
            "current_price": round(current, 2),
            "predicted_price": round(predicted, 2),
            "signal": signal,
            "model": "5-day / 20-day moving-average baseline",
            "forecast_horizon": "Next trading session",
            "note": "This is an experimental baseline, not a guaranteed prediction."
        }
    except Exception as exc:
        print("PREDICTION ERROR:", exc)
        return {"current_price": None, "predicted_price": None, "signal": "NO DATA"}


def evaluate_prediction(symbol):
    """Walk-forward one-session backtest; only past closes predict each next close."""
    try:
        frame = _history(symbol, "1y")
        if frame is None or len(frame) < 25:
            return {"error": "Not enough historical data to evaluate this symbol"}

        closes = frame["Close"].astype(float).to_numpy()
        dates = frame.index
        actual_values, predicted_values, labels = [], [], []
        directional_hits = 0
        absolute_errors, percentage_errors = [], []

        for index in range(20, len(closes)):
            history = closes[:index]
            previous_close = float(history[-1])
            predicted = (float(np.mean(history[-5:])) + float(np.mean(history[-20:]))) / 2
            actual = float(closes[index])
            predicted_up = predicted > previous_close
            actual_up = actual > previous_close
            directional_hits += int(predicted_up == actual_up)
            absolute_errors.append(abs(actual - predicted))
            if actual != 0:
                percentage_errors.append(abs((actual - predicted) / actual) * 100)
            actual_values.append(round(actual, 2))
            predicted_values.append(round(predicted, 2))
            labels.append(dates[index].strftime("%Y-%m-%d"))

        count = len(actual_values)
        accuracy = directional_hits / count * 100 if count else None
        mae = float(np.mean(absolute_errors)) if absolute_errors else None
        mape = float(np.mean(percentage_errors)) if percentage_errors else None
        recent = min(60, count)
        return {
            "symbol": symbol,
            "model": "5-day / 20-day moving-average baseline",
            "forecast_horizon": "One trading session",
            "samples": count,
            "directional_accuracy": round(accuracy, 2) if accuracy is not None else None,
            "mae": round(mae, 2) if mae is not None else None,
            "mape": round(mape, 2) if mape is not None else None,
            "chart": [
                {"date": labels[-recent + i], "actual": actual_values[-recent + i], "predicted": predicted_values[-recent + i]}
                for i in range(recent)
            ],
            "note": "Historical walk-forward backtest, not live trading accuracy or a guarantee of future results."
        }
    except Exception as exc:
        print("MODEL EVALUATION ERROR:", exc)
        return {"error": "Unable to evaluate historical predictions"}
