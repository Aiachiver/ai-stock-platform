import numpy as np
import pandas as pd
import yfinance as yf
from sklearn.ensemble import ExtraTreesRegressor, HistGradientBoostingRegressor, RandomForestRegressor

MODEL_FACTORIES = {
    "Extra Trees Regressor": lambda: ExtraTreesRegressor(
        n_estimators=300, min_samples_leaf=3, max_features=0.8,
        random_state=42, n_jobs=-1
    ),
    "Random Forest Regressor": lambda: RandomForestRegressor(
        n_estimators=300, min_samples_leaf=3, max_features=0.8,
        random_state=42, n_jobs=-1
    ),
    "Histogram Gradient Boosting": lambda: HistGradientBoostingRegressor(
        max_iter=180, learning_rate=0.04, max_leaf_nodes=15,
        l2_regularization=1.0, random_state=42
    ),
}


def _history(symbol, period="3y"):
    frame = yf.Ticker(symbol).history(period=period, interval="1d", auto_adjust=True)
    if getattr(frame.columns, "nlevels", 1) > 1:
        frame.columns = frame.columns.get_level_values(0)
    required = {"Open", "High", "Low", "Close", "Volume"}
    if frame.empty or not required.issubset(frame.columns):
        return None
    return frame.dropna(subset=["Open", "High", "Low", "Close"])


def _dataset(frame):
    """Build causal OHLCV features; target is the following session's return."""
    data = frame.copy()
    close = data["Close"].astype(float)
    volume = data["Volume"].astype(float).replace(0, np.nan)
    returns = close.pct_change()

    features = pd.DataFrame(index=data.index)
    for lag in (1, 2, 3, 5, 10, 20):
        features[f"return_{lag}d"] = close.pct_change(lag)
    for window in (5, 10, 20, 50):
        features[f"sma_ratio_{window}"] = close / close.rolling(window).mean() - 1
        features[f"volatility_{window}"] = returns.rolling(window).std()
    features["ema_12_ratio"] = close / close.ewm(span=12, adjust=False).mean() - 1
    features["ema_26_ratio"] = close / close.ewm(span=26, adjust=False).mean() - 1
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd = ema12 - ema26
    features["macd_ratio"] = macd / close
    features["macd_signal_ratio"] = macd.ewm(span=9, adjust=False).mean() / close
    delta = close.diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = -delta.clip(upper=0).rolling(14).mean()
    rs = gain / loss.replace(0, np.nan)
    features["rsi_14"] = 100 - (100 / (1 + rs))
    features["intraday_range"] = (data["High"] - data["Low"]) / close
    features["open_gap"] = data["Open"] / close.shift(1) - 1
    features["volume_change"] = volume.pct_change()
    features["volume_ratio_20"] = volume / volume.rolling(20).mean()
    features["volume_return_corr_20"] = returns.rolling(20).corr(volume.pct_change())

    # Predict the next session's percentage return, not its absolute price.
    target = close.shift(-1) / close - 1
    dataset = features.replace([np.inf, -np.inf], np.nan).copy()
    dataset["target"] = target
    dataset = dataset.dropna()
    return dataset.drop(columns=["target"]), dataset["target"]


def _select_model(x_train, y_train, x_valid, y_valid):
    scores = {}
    for name, factory in MODEL_FACTORIES.items():
        model = factory()
        model.fit(x_train, y_train)
        prediction = model.predict(x_valid)
        scores[name] = float(np.mean(np.abs(y_valid.to_numpy() - prediction)))
    best_name = min(scores, key=scores.get)
    return best_name, scores


def _fit_selected(x_train, y_train, x_valid, y_valid, x_test=None):
    best_name, scores = _select_model(x_train, y_train, x_valid, y_valid)
    model = MODEL_FACTORIES[best_name]()
    if x_test is None:
        model.fit(pd.concat([x_train, x_valid]), pd.concat([y_train, y_valid]))
        return best_name, model, scores
    model.fit(x_train, y_train)
    return best_name, model, scores


def _prepare_splits(frame):
    x, y = _dataset(frame)
    if len(x) < 100:
        return None
    train_end = int(len(x) * 0.70)
    valid_end = int(len(x) * 0.85)
    if train_end < 60 or valid_end <= train_end or valid_end >= len(x):
        return None
    return (
        x.iloc[:train_end], y.iloc[:train_end],
        x.iloc[train_end:valid_end], y.iloc[train_end:valid_end],
        x.iloc[valid_end:], y.iloc[valid_end:],
    )


def predict_stock(symbol):
    try:
        frame = _history(symbol, "3y")
        if frame is None:
            return {"current_price": None, "predicted_price": None, "signal": "NO DATA"}
        splits = _prepare_splits(frame)
        if splits is None:
            return {"current_price": None, "predicted_price": None, "signal": "NO DATA",
                    "note": "At least 100 clean historical feature rows are required."}

        x_train, y_train, x_valid, y_valid, _, _ = splits
        model_name, model, validation_scores = _fit_selected(
            x_train, y_train, x_valid, y_valid
        )
        latest_x, _ = _dataset(frame)
        latest_features = latest_x.iloc[[-1]]
        # Refit the selected model using all currently available labelled history.
        all_x, all_y = _dataset(frame)
        model = MODEL_FACTORIES[model_name]()
        model.fit(all_x, all_y)
        predicted_return = float(model.predict(latest_features)[0])
        current = float(frame["Close"].iloc[-1])
        predicted = current * (1 + predicted_return)
        signal = "BUY" if predicted_return > 0.001 else "SELL" if predicted_return < -0.001 else "HOLD"
        return {
            "current_price": round(current, 2),
            "predicted_price": round(predicted, 2),
            "predicted_return_pct": round(predicted_return * 100, 3),
            "signal": signal,
            "model": model_name,
            "model_family": "Ensemble tree-based machine learning",
            "forecast_horizon": "Next trading session",
            "validation_mae_return_pct": round(min(validation_scores.values()) * 100, 4),
            "note": "Model selected using chronological validation. Experimental forecast, not financial advice or a guaranteed result."
        }
    except Exception as exc:
        print("PREDICTION ERROR:", exc)
        return {"current_price": None, "predicted_price": None, "signal": "NO DATA"}


def evaluate_prediction(symbol):
    """Chronological train/validation/test evaluation with an untouched final test block."""
    try:
        frame = _history(symbol, "3y")
        if frame is None:
            return {"error": "Unable to load historical data for this symbol"}
        splits = _prepare_splits(frame)
        if splits is None:
            return {"error": "Not enough clean historical data to evaluate this symbol"}

        x_train, y_train, x_valid, y_valid, x_test, y_test = splits
        model_name, _, validation_scores = _fit_selected(
            x_train, y_train, x_valid, y_valid
        )
        model = MODEL_FACTORIES[model_name]()
        model.fit(pd.concat([x_train, x_valid]), pd.concat([y_train, y_valid]))
        predicted_returns = model.predict(x_test)

        previous_closes = frame.loc[x_test.index, "Close"].astype(float).to_numpy()
        actual_closes = previous_closes * (1 + y_test.to_numpy())
        predicted_closes = previous_closes * (1 + predicted_returns)
        actual_directions = y_test.to_numpy() > 0
        predicted_directions = predicted_returns > 0
        directional_accuracy = float(np.mean(actual_directions == predicted_directions) * 100)
        mae = float(np.mean(np.abs(actual_closes - predicted_closes)))
        mape = float(np.mean(np.abs((actual_closes - predicted_closes) / actual_closes)) * 100)
        recent = min(60, len(actual_closes))
        dates = [d.strftime("%Y-%m-%d") for d in x_test.index[-recent:]]

        return {
            "symbol": symbol,
            "model": model_name,
            "model_family": "Ensemble tree-based machine learning",
            "forecast_horizon": "One trading session",
            "samples": int(len(actual_closes)),
            "directional_accuracy": round(directional_accuracy, 2),
            "mae": round(mae, 2),
            "mape": round(mape, 2),
            "validation_mae_return_pct": round(min(validation_scores.values()) * 100, 4),
            "chart": [
                {"date": dates[i], "actual": round(float(actual_closes[-recent + i]), 2),
                 "predicted": round(float(predicted_closes[-recent + i]), 2)}
                for i in range(recent)
            ],
            "note": "Metrics are from a chronological holdout test set not used for model selection. Historical results do not guarantee future performance."
        }
    except Exception as exc:
        print("MODEL EVALUATION ERROR:", exc)
        return {"error": "Unable to evaluate historical predictions"}
