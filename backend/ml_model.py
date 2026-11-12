import threading
import time

import numpy as np
import pandas as pd
import yfinance as yf
from sklearn.ensemble import (
    ExtraTreesRegressor,
    GradientBoostingRegressor,
    HistGradientBoostingRegressor,
    RandomForestRegressor,
)
from sklearn.model_selection import TimeSeriesSplit


MODEL_FACTORIES = {
    "Extra Trees Regressor": lambda: ExtraTreesRegressor(
        n_estimators=160,
        min_samples_leaf=3,
        max_features=0.8,
        random_state=42,
        n_jobs=-1,
    ),
    "Random Forest Regressor": lambda: RandomForestRegressor(
        n_estimators=160,
        min_samples_leaf=3,
        max_features=0.8,
        random_state=42,
        n_jobs=-1,
    ),
    "Gradient Boosting Regressor": lambda: GradientBoostingRegressor(
        n_estimators=140,
        learning_rate=0.03,
        max_depth=2,
        loss="huber",
        random_state=42,
    ),
    "Histogram Gradient Boosting": lambda: HistGradientBoostingRegressor(
        max_iter=120,
        learning_rate=0.04,
        max_leaf_nodes=15,
        l2_regularization=1.0,
        random_state=42,
    ),
}


def _history(symbol, period="3y"):
    """Load clean daily OHLCV history with a second yfinance retrieval path."""
    attempts = (
        lambda: yf.Ticker(symbol).history(
            period=period, interval="1d", auto_adjust=True, raise_errors=True
        ),
        lambda: yf.download(
            symbol, period=period, interval="1d", auto_adjust=True,
            progress=False, threads=False, group_by="column"
        ),
    )
    required = {"Open", "High", "Low", "Close", "Volume"}
    for attempt in attempts:
        try:
            frame = attempt()
            if frame is None or frame.empty:
                continue
            if getattr(frame.columns, "nlevels", 1) > 1:
                levels = [
                    frame.columns.get_level_values(level)
                    for level in range(frame.columns.nlevels)
                ]
                matching = next(
                    (level for level in levels if required.issubset(set(level))),
                    None,
                )
                if matching is None:
                    continue
                frame.columns = matching
            if not required.issubset(frame.columns):
                continue
            frame = frame.copy()
            for column in required:
                frame[column] = pd.to_numeric(frame[column], errors="coerce")
            frame = frame.dropna(subset=["Open", "High", "Low", "Close"])
            frame["Volume"] = frame["Volume"].fillna(0)
            if len(frame) >= 100:
                return frame
        except Exception as exc:
            print(f"MODEL HISTORY ATTEMPT FAILED ({symbol}):", exc)
    return None


def _features(frame):
    """Causal OHLCV indicators known at the close of each trading session."""
    data = frame.copy()
    close = data["Close"].astype(float)
    high = data["High"].astype(float)
    low = data["Low"].astype(float)
    open_price = data["Open"].astype(float)
    volume = data["Volume"].astype(float).replace(0, np.nan)
    returns = close.pct_change()

    features = pd.DataFrame(index=data.index)

    # Short- and medium-term momentum.
    for lag in (1, 2, 3, 5, 10, 20):
        features[f"return_{lag}d"] = close.pct_change(lag)

    # Trend and realized volatility.
    for window in (5, 10, 20, 50):
        rolling_mean = close.rolling(window).mean()
        features[f"sma_ratio_{window}"] = close / rolling_mean - 1
        features[f"volatility_{window}"] = returns.rolling(window).std()

    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd = ema12 - ema26
    features["ema_12_ratio"] = close / ema12 - 1
    features["ema_26_ratio"] = close / ema26 - 1
    features["macd_ratio"] = macd / close
    features["macd_signal_ratio"] = macd.ewm(span=9, adjust=False).mean() / close

    # RSI with explicit handling for zero-loss / zero-gain windows.
    delta = close.diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = -delta.clip(upper=0).rolling(14).mean()
    rs = gain / loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    rsi = rsi.mask((loss == 0) & (gain > 0), 100)
    rsi = rsi.mask((gain == 0) & (loss > 0), 0)
    rsi = rsi.mask((gain == 0) & (loss == 0), 50)
    features["rsi_14"] = rsi

    # Range, volatility and price-location indicators.
    previous_close = close.shift(1)
    true_range = pd.concat(
        [
            high - low,
            (high - previous_close).abs(),
            (low - previous_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    features["atr_pct_14"] = true_range.rolling(14).mean() / close
    bb_mean = close.rolling(20).mean()
    bb_std = close.rolling(20).std()
    features["bollinger_z_20"] = (close - bb_mean) / bb_std.replace(0, np.nan)
    rolling_high = high.rolling(14).max()
    rolling_low = low.rolling(14).min()
    features["stochastic_k_14"] = (
        100 * (close - rolling_low) / (rolling_high - rolling_low).replace(0, np.nan)
    )
    features["intraday_range"] = (high - low) / close
    features["open_gap"] = open_price / previous_close - 1
    features["close_location"] = (
        (close - low) / (high - low).replace(0, np.nan)
    )

    # Volume context.
    volume_change = volume.pct_change().replace([np.inf, -np.inf], np.nan)
    volume_ratio = volume / volume.rolling(20).mean().replace(0, np.nan)
    volume_corr = returns.rolling(20).corr(volume_change)
    # Missing or constant volume should not invalidate otherwise usable OHLC rows.
    features["volume_change"] = volume_change.fillna(0)
    features["volume_ratio_20"] = volume_ratio.replace([np.inf, -np.inf], np.nan).fillna(1)
    features["volume_return_corr_20"] = volume_corr.fillna(0)

    return features.replace([np.inf, -np.inf], np.nan)


def _dataset(frame):
    # Features at t predict the close-to-close return from t to t+1.
    features = _features(frame)
    close = frame["Close"].astype(float)
    target = close.shift(-1) / close - 1
    valid = features.notna().all(axis=1) & target.notna()
    return features.loc[valid], target.loc[valid]


def _direction_metrics(actual_returns, predicted_returns):
    actual_up = np.asarray(actual_returns) > 0
    predicted_up = np.asarray(predicted_returns) > 0
    directional = float(np.mean(actual_up == predicted_up) * 100)

    up_count = int(actual_up.sum())
    down_count = int((~actual_up).sum())
    recalls = []
    if up_count:
        recalls.append(float(np.mean(predicted_up[actual_up])))
    if down_count:
        recalls.append(float(np.mean(~predicted_up[~actual_up])))
    balanced = float(np.mean(recalls) * 100) if recalls else 0.0
    return directional, balanced


def _select_model(x_train, y_train):
    """Select models using expanding-window CV, never shuffled time-series rows."""
    if len(x_train) < 40:
        raise ValueError("Not enough rows for chronological model selection")

    test_size = max(10, len(x_train) // 10)
    splitter = TimeSeriesSplit(n_splits=2, test_size=test_size)
    folds = list(splitter.split(x_train))
    baseline_mae = float(np.mean([
        np.mean(np.abs(y_train.iloc[valid_idx].to_numpy())) * 100
        for _, valid_idx in folds
    ]))
    scores = {}

    for name, factory in MODEL_FACTORIES.items():
        fold_directional = []
        fold_balanced = []
        fold_mae = []

        for train_idx, valid_idx in folds:
            model = factory()
            x_fold_train = x_train.iloc[train_idx]
            y_fold_train = y_train.iloc[train_idx]
            x_fold_valid = x_train.iloc[valid_idx]
            y_fold_valid = y_train.iloc[valid_idx]

            model.fit(x_fold_train, y_fold_train)
            predicted = model.predict(x_fold_valid)
            directional, balanced = _direction_metrics(
                y_fold_valid.to_numpy(), predicted
            )
            fold_directional.append(directional)
            fold_balanced.append(balanced)
            fold_mae.append(
                float(np.mean(np.abs(y_fold_valid.to_numpy() - predicted)) * 100)
            )

        mean_directional = float(np.mean(fold_directional))
        mean_balanced = float(np.mean(fold_balanced))
        mean_mae = float(np.mean(fold_mae))
        # A zero-return forecast is a transparent, trading-relevant baseline.
        # Compare each model against it on exactly the same chronological folds.
        mae_skill = (
            (baseline_mae - mean_mae) / baseline_mae * 100
            if baseline_mae > 0 else 0.0
        )
        # Prioritize balanced direction skill; retain error-vs-baseline
        # diagnostics so a directional score cannot hide poor return forecasts.
        selection_score = 0.7 * mean_balanced + 0.3 * mean_directional
        scores[name] = {
            "directional_accuracy_pct": round(mean_directional, 3),
            "balanced_directional_accuracy_pct": round(mean_balanced, 3),
            "mae_return_pct": round(mean_mae, 4),
            "zero_return_baseline_mae_pct": round(baseline_mae, 4),
            "mae_skill_vs_zero_baseline_pct": round(mae_skill, 3),
            "selection_score": round(selection_score, 3),
        }

    best_name = max(
        scores,
        key=lambda name: (
            scores[name]["selection_score"],
            -scores[name]["mae_return_pct"],
        ),
    )
    return best_name, scores


def _prepare_splits(frame):
    x, y = _dataset(frame)
    if len(x) < 100:
        return None
    train_end = int(len(x) * 0.70)
    valid_end = int(len(x) * 0.85)
    if train_end < 60 or valid_end <= train_end or valid_end >= len(x):
        return None
    return (
        x.iloc[:train_end],
        y.iloc[:train_end],
        x.iloc[train_end:valid_end],
        y.iloc[train_end:valid_end],
        x.iloc[valid_end:],
        y.iloc[valid_end:],
    )


def _development_data(splits):
    x_train, y_train, x_valid, y_valid, _, _ = splits
    return (
        pd.concat([x_train, x_valid]),
        pd.concat([y_train, y_valid]),
    )


# Both dashboard research endpoints request the same symbol at once. Cache the
# expensive history + chronological model-selection work and serialize the first
# build per symbol so concurrent requests do not train duplicate CV models.
_RESEARCH_CACHE_TTL_SECONDS = 15 * 60
_RESEARCH_CACHE_MAX_SYMBOLS = 16
_research_cache = {}
_research_locks = {}
_research_cache_guard = threading.Lock()


def _get_research_context(symbol):
    now = time.monotonic()
    with _research_cache_guard:
        cached = _research_cache.get(symbol)
        if cached and cached[0] > now:
            return cached[1]
        lock = _research_locks.setdefault(symbol, threading.Lock())

    with lock:
        now = time.monotonic()
        with _research_cache_guard:
            cached = _research_cache.get(symbol)
            if cached and cached[0] > now:
                return cached[1]

        frame = _history(symbol, "3y")
        if frame is None:
            return None
        splits = _prepare_splits(frame)
        if splits is None:
            return None

        development_x, development_y = _development_data(splits)
        model_name, cv_scores = _select_model(development_x, development_y)

        # Fit both endpoint estimators once per cache window.
        forecast_x, forecast_y = _dataset(frame)
        forecast_model = MODEL_FACTORIES[model_name]()
        forecast_model.fit(forecast_x, forecast_y)

        evaluation_model = MODEL_FACTORIES[model_name]()
        evaluation_model.fit(development_x, development_y)

        context = {
            "frame": frame,
            "splits": splits,
            "model_name": model_name,
            "cv_scores": cv_scores,
            "selected_metrics": cv_scores[model_name],
            "forecast_model": forecast_model,
            "evaluation_model": evaluation_model,
        }

        with _research_cache_guard:
            expired = [
                key for key, value in _research_cache.items()
                if value[0] <= now
            ]
            for key in expired:
                _research_cache.pop(key, None)
            if len(_research_cache) >= _RESEARCH_CACHE_MAX_SYMBOLS:
                oldest = min(_research_cache, key=lambda key: _research_cache[key][0])
                _research_cache.pop(oldest, None)
            _research_cache[symbol] = (
                time.monotonic() + _RESEARCH_CACHE_TTL_SECONDS,
                context,
            )
        return context


def predict_stock(symbol):
    try:
        context = _get_research_context(symbol)
        if context is None:
            return {
                "current_price": None,
                "predicted_price": None,
                "signal": "NO DATA",
                "note": "Historical data is unavailable or does not contain enough clean rows.",
            }

        frame = context["frame"]
        model_name = context["model_name"]
        selected_metrics = context["selected_metrics"]

        latest_feature_frame = _features(frame).dropna()
        if latest_feature_frame.empty:
            return {"current_price": None, "predicted_price": None, "signal": "NO DATA",
                    "note": "Latest indicator rows are incomplete for this symbol."}
        latest_features = latest_feature_frame.iloc[[-1]]
        predicted_return = float(context["forecast_model"].predict(latest_features)[0])
        current = float(frame["Close"].iloc[-1])
        predicted = current * (1 + predicted_return)

        # Avoid issuing a directional signal when the expected move is smaller
        # than the model's cross-validated return error.
        signal_threshold_pct = max(0.10, selected_metrics["mae_return_pct"])
        signal_threshold = signal_threshold_pct / 100
        signal = (
            "BUY"
            if predicted_return > signal_threshold
            else "SELL"
            if predicted_return < -signal_threshold
            else "HOLD"
        )

        return {
            "current_price": round(current, 2),
            "predicted_price": round(predicted, 2),
            "predicted_return_pct": round(predicted_return * 100, 3),
            "signal": signal,
            "model": model_name,
            "model_family": "Ensemble tree-based machine learning",
            "forecast_horizon": "Next trading session",
            "validation_mae_return_pct": selected_metrics["mae_return_pct"],
            "validation_directional_accuracy_pct": selected_metrics[
                "directional_accuracy_pct"
            ],
            "validation_balanced_directional_accuracy_pct": selected_metrics[
                "balanced_directional_accuracy_pct"
            ],
            "signal_threshold_pct": round(signal_threshold_pct, 4),
            "note": (
                "Model selected using expanding-window chronological cross-validation. "
                "Signals are suppressed when the predicted move is below cross-validated "
                "return error. Experimental forecast, not financial advice or a guarantee."
            ),
        }
    except Exception as exc:
        print("PREDICTION ERROR:", exc)
        return {
            "current_price": None,
            "predicted_price": None,
            "signal": "NO DATA",
        }


def evaluate_prediction(symbol):
    """Evaluate the selected model on a final chronological holdout block."""
    try:
        context = _get_research_context(symbol)
        if context is None:
            return {"error": "Historical data is unavailable or there are not enough clean rows to evaluate this symbol"}

        frame = context["frame"]
        _, _, _, _, x_test, y_test = context["splits"]
        model_name = context["model_name"]
        cv_scores = context["cv_scores"]
        selected_metrics = context["selected_metrics"]
        predicted_returns = context["evaluation_model"].predict(x_test)

        previous_closes = frame.loc[x_test.index, "Close"].astype(float).to_numpy()
        actual_returns = y_test.to_numpy()
        actual_closes = previous_closes * (1 + actual_returns)
        predicted_closes = previous_closes * (1 + predicted_returns)

        directional_accuracy, balanced_directional_accuracy = _direction_metrics(
            actual_returns, predicted_returns
        )
        mae = float(np.mean(np.abs(actual_closes - predicted_closes)))
        rmse = float(np.sqrt(np.mean((actual_closes - predicted_closes) ** 2)))
        mape = float(
            np.mean(np.abs((actual_closes - predicted_closes) / actual_closes)) * 100
        )

        # Holdout comparison against a no-change (zero-return) forecast.
        # This baseline is evaluated on the same untouched chronological rows.
        model_return_mae_pct = float(
            np.mean(np.abs(actual_returns - predicted_returns)) * 100
        )
        model_return_rmse_pct = float(
            np.sqrt(np.mean((actual_returns - predicted_returns) ** 2)) * 100
        )
        baseline_return_mae_pct = float(np.mean(np.abs(actual_returns)) * 100)
        baseline_return_rmse_pct = float(
            np.sqrt(np.mean(actual_returns ** 2)) * 100
        )
        return_mae_skill_pct = (
            (baseline_return_mae_pct - model_return_mae_pct)
            / baseline_return_mae_pct * 100
            if baseline_return_mae_pct > 0 else 0.0
        )
        baseline_directional, baseline_balanced = _direction_metrics(
            actual_returns, np.zeros_like(actual_returns)
        )

        signal_threshold_pct = max(0.10, selected_metrics["mae_return_pct"])
        signal_threshold = signal_threshold_pct / 100
        signal_mask = np.abs(predicted_returns) > signal_threshold
        signal_coverage = float(np.mean(signal_mask) * 100)
        signal_accuracy = None
        if signal_mask.any():
            signal_accuracy = float(
                np.mean(
                    (actual_returns[signal_mask] > 0)
                    == (predicted_returns[signal_mask] > 0)
                )
                * 100
            )

        recent = min(60, len(actual_closes))
        dates = [d.strftime("%Y-%m-%d") for d in x_test.index[-recent:]]

        return {
            "symbol": symbol,
            "model": model_name,
            "model_family": "Ensemble tree-based machine learning",
            "forecast_horizon": "One trading session",
            "samples": int(len(actual_closes)),
            "directional_accuracy": round(directional_accuracy, 2),
            "balanced_directional_accuracy": round(
                balanced_directional_accuracy, 2
            ),
            "signal_accuracy_pct": (
                round(signal_accuracy, 2) if signal_accuracy is not None else None
            ),
            "signal_coverage_pct": round(signal_coverage, 2),
            "mae": round(mae, 2),
            "rmse": round(rmse, 2),
            "mape": round(mape, 2),
            "holdout_return_mae_pct": round(model_return_mae_pct, 4),
            "holdout_return_rmse_pct": round(model_return_rmse_pct, 4),
            "zero_return_baseline_mae_pct": round(baseline_return_mae_pct, 4),
            "zero_return_baseline_rmse_pct": round(baseline_return_rmse_pct, 4),
            "mae_skill_vs_zero_baseline_pct": round(return_mae_skill_pct, 3),
            "zero_return_baseline_directional_accuracy_pct": round(
                baseline_directional, 2
            ),
            "zero_return_baseline_balanced_accuracy_pct": round(
                baseline_balanced, 2
            ),
            "model_beats_zero_return_baseline": bool(return_mae_skill_pct > 0),
            "validation_mae_return_pct": selected_metrics["mae_return_pct"],
            "validation_directional_accuracy_pct": selected_metrics[
                "directional_accuracy_pct"
            ],
            "validation_balanced_directional_accuracy_pct": selected_metrics[
                "balanced_directional_accuracy_pct"
            ],
            "signal_threshold_pct": round(signal_threshold_pct, 4),
            "chart": [
                {
                    "date": dates[i],
                    "actual": round(float(actual_closes[-recent + i]), 2),
                    "predicted": round(float(predicted_closes[-recent + i]), 2),
                }
                for i in range(recent)
            ],
            "model_comparison": cv_scores,
            "note": (
                "Final metrics are from a chronological holdout block not used for "
                "model selection. Signal accuracy is measured only on predictions "
                "whose expected move exceeds the cross-validated error threshold. "
                "The zero-return baseline is included as a reference; positive MAE skill "
                "means lower holdout return error than that baseline. Historical results "
                "do not guarantee future performance."
            ),
        }
    except Exception as exc:
        print("MODEL EVALUATION ERROR:", exc)
        return {"error": "Unable to evaluate historical predictions"}
