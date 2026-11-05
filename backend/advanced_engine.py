"""TradeSight AI V3: calibrated, walk-forward stock decision support.

This module is deliberately separate from the legacy predictor. It uses only
causal daily features, chronological calibration, and a final untouched test
window. It does not promise profitable or 70-80% accurate forecasts.
"""
from __future__ import annotations

import warnings

import numpy as np
import pandas as pd
import yfinance as yf
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import ExtraTreesClassifier, HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, balanced_accuracy_score, brier_score_loss, precision_score
from sklearn.model_selection import TimeSeriesSplit
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

TRADING_COST_BPS = 15.0
CONFIDENCE_THRESHOLD = 0.60
MIN_ROWS = 500


def _download(symbol: str, period: str = "10y") -> pd.DataFrame:
    raw = yf.Ticker(symbol).history(period=period, interval="1d", auto_adjust=True)
    if raw is None or raw.empty:
        raw = yf.download(symbol, period=period, interval="1d", auto_adjust=True,
                          progress=False, threads=False)
    if raw is None or raw.empty:
        raise ValueError("Market data provider returned no history")
    if isinstance(raw.columns, pd.MultiIndex):
        raw.columns = raw.columns.get_level_values(0)
    required = ["Open", "High", "Low", "Close", "Volume"]
    missing = [name for name in required if name not in raw.columns]
    if missing:
        raise ValueError("OHLCV data is incomplete: " + ", ".join(missing))
    frame = raw[required].copy()
    for col in required:
        frame[col] = pd.to_numeric(frame[col], errors="coerce")
    frame = frame.dropna(subset=["Open", "High", "Low", "Close"])
    frame = frame[~frame.index.duplicated(keep="last")].sort_index()
    if len(frame) < MIN_ROWS:
        raise ValueError(f"Only {len(frame)} clean daily rows; at least {MIN_ROWS} are required")
    return frame


def _build_features(stock: pd.DataFrame, market: pd.Series) -> pd.DataFrame:
    close, high, low, opn = (stock[c].astype(float) for c in ("Close", "High", "Low", "Open"))
    volume = stock["Volume"].astype(float).replace(0, np.nan)
    ret = close.pct_change()
    f = pd.DataFrame(index=stock.index)

    for n in (1, 2, 3, 5, 10, 20, 60):
        f[f"return_{n}"] = close.pct_change(n)
    for n in (5, 10, 20, 50, 100, 200):
        ma = close.rolling(n, min_periods=n).mean()
        f[f"trend_{n}"] = close / ma - 1
    for n in (5, 10, 20, 60):
        f[f"volatility_{n}"] = ret.rolling(n, min_periods=n).std() * np.sqrt(252)
    delta = close.diff()
    gain = delta.clip(lower=0).ewm(alpha=1/14, adjust=False, min_periods=14).mean()
    loss = -delta.clip(upper=0).ewm(alpha=1/14, adjust=False, min_periods=14).mean()
    rs = gain / loss.replace(0, np.nan)
    f["rsi_14"] = (100 - 100 / (1 + rs)).fillna(50)
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    f["macd_pct"] = (ema12 - ema26) / close
    f["macd_signal_pct"] = (ema12 - ema26).ewm(span=9, adjust=False).mean() / close
    prev = close.shift(1)
    tr = pd.concat([(high-low), (high-prev).abs(), (low-prev).abs()], axis=1).max(axis=1)
    f["atr_pct"] = tr.rolling(14).mean() / close
    f["intraday_range"] = (high-low) / close
    f["gap"] = opn / prev - 1
    f["close_location"] = (close-low) / (high-low).replace(0, np.nan)
    f["volume_ratio"] = (volume / volume.rolling(20).mean()).replace([np.inf, -np.inf], np.nan)
    f["volume_return_corr"] = ret.rolling(20).corr(volume.pct_change())
    market = market.reindex(f.index).ffill()
    f["market_return_1"] = market
    f["market_return_5"] = market.rolling(5).sum()
    f["market_return_20"] = market.rolling(20).sum()
    f["relative_strength_20"] = close.pct_change(20) - market.rolling(20).sum()
    # Regime inputs are known at the close of the prediction date.
    f["market_trend"] = market.rolling(50).mean()
    f["market_volatility"] = market.rolling(20).std() * np.sqrt(252)
    f = f.drop(columns=["market_trend"])
    return f.replace([np.inf, -np.inf], np.nan)


def _models():
    return {
        "HistGradientBoosting": HistGradientBoostingClassifier(
            max_iter=140, learning_rate=0.04, max_leaf_nodes=15,
            l2_regularization=2.0, random_state=42
        ),
        "RandomForest": RandomForestClassifier(
            n_estimators=300, min_samples_leaf=8, max_features=0.75,
            class_weight="balanced_subsample", random_state=42, n_jobs=-1
        ),
        "ExtraTrees": ExtraTreesClassifier(
            n_estimators=300, min_samples_leaf=8, max_features=0.75,
            class_weight="balanced", random_state=42, n_jobs=-1
        ),
        "LogisticRegression": make_pipeline(
            StandardScaler(),
            LogisticRegression(C=0.15, class_weight="balanced", max_iter=2000)
        ),
    }


def _calibrated(model):
    # Expanding chronological folds; never shuffle time-series observations.
    return CalibratedClassifierCV(estimator=model, method="sigmoid",
                                  cv=TimeSeriesSplit(n_splits=3))


def _regime(stock: pd.DataFrame, market_returns: pd.Series) -> str:
    close = stock["Close"].astype(float)
    ma50 = close.rolling(50).mean().iloc[-1]
    ma200 = close.rolling(200).mean().iloc[-1]
    vol = market_returns.tail(20).std() * np.sqrt(252)
    if pd.isna(ma50) or pd.isna(ma200):
        return "Insufficient history"
    if vol > 0.30:
        return "High volatility"
    if close.iloc[-1] > ma50 and ma50 > ma200:
        return "Bull trend"
    if close.iloc[-1] < ma50 and ma50 < ma200:
        return "Bear trend"
    return "Sideways / mixed"


def analyze_stock_v3(symbol: str) -> dict:
    """Return a validated next-session probability and conservative decision."""
    symbol = symbol.strip().upper()
    if not symbol or len(symbol) > 20:
        raise ValueError("Invalid stock symbol")

    stock = _download(symbol, "10y")
    market_frame = _download("^GSPC", "10y")
    market_returns = market_frame["Close"].pct_change()
    features = _build_features(stock, market_returns)
    target_return = stock["Close"].shift(-1) / stock["Close"] - 1
    target = (target_return > 0).astype(int)
    valid = features.notna().all(axis=1) & target_return.notna()
    x, y, returns = features.loc[valid], target.loc[valid], target_return.loc[valid]
    if len(x) < MIN_ROWS:
        raise ValueError("Not enough aligned stock and market observations")

    train_end = int(len(x) * 0.70)
    valid_end = int(len(x) * 0.85)
    if train_end < 250 or valid_end - train_end < 50 or len(x) - valid_end < 50:
        raise ValueError("Insufficient chronological train, validation, or test window")

    x_train, y_train = x.iloc[:train_end], y.iloc[:train_end]
    x_dev, y_dev = x.iloc[:valid_end], y.iloc[:valid_end]
    x_test, y_test = x.iloc[valid_end:], y.iloc[valid_end:]
    test_returns = returns.iloc[valid_end:]

    # Evaluate each calibrated candidate on a final untouched test window.
    test_probabilities = {}
    candidate_metrics = {}
    for name, base in _models().items():
        candidate = _calibrated(base)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            candidate.fit(x_dev, y_dev)
        probability = candidate.predict_proba(x_test)[:, 1]
        test_probabilities[name] = probability
        pred = (probability >= 0.5).astype(int)
        candidate_metrics[name] = {
            "accuracy_pct": round(accuracy_score(y_test, pred) * 100, 2),
            "balanced_accuracy_pct": round(balanced_accuracy_score(y_test, pred) * 100, 2),
            "brier_score": round(float(brier_score_loss(y_test, probability)), 5),
        }

    # Ensemble is the mean of independently calibrated model probabilities.
    ensemble_test = np.mean(np.column_stack(list(test_probabilities.values())), axis=1)
    test_class = (ensemble_test >= 0.5).astype(int)
    test_confidence = np.maximum(ensemble_test, 1 - ensemble_test)
    covered = test_confidence >= CONFIDENCE_THRESHOLD
    if covered.any():
        selective_accuracy = accuracy_score(y_test.to_numpy()[covered], test_class[covered]) * 100
    else:
        selective_accuracy = None

    # Long-only paper strategy: enter only on calibrated high-confidence UP calls.
    buy_mask = ensemble_test >= CONFIDENCE_THRESHOLD
    daily_cost = TRADING_COST_BPS / 10000
    strategy_returns = np.where(buy_mask, test_returns.to_numpy() - daily_cost, 0.0)
    equity = np.cumprod(1 + strategy_returns)
    peak = np.maximum.accumulate(equity)
    drawdown = (equity / peak - 1) * 100
    total_return = (equity[-1] - 1) * 100 if len(equity) else 0.0
    buy_hold = (np.prod(1 + test_returns.to_numpy()) - 1) * 100

    # Refit calibrated candidates on all known labels for the next-session forecast.
    latest_x = features.dropna().iloc[[-1]]
    live_models = []
    for base in _models().values():
        fitted = _calibrated(base)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            fitted.fit(x, y)
        live_models.append(float(fitted.predict_proba(latest_x)[:, 1][0]))
    up_probability = float(np.mean(live_models))
    confidence = max(up_probability, 1 - up_probability)
    decision = "NO TRADE"
    if up_probability >= CONFIDENCE_THRESHOLD:
        decision = "BUY / PAPER LONG"
    elif up_probability <= 1 - CONFIDENCE_THRESHOLD:
        decision = "BEARISH / AVOID NEW LONG"

    market_series = market_returns.reindex(stock.index).dropna()
    return {
        "symbol": symbol,
        "engine": "TradeSight AI V3",
        "forecast_horizon": "Next trading session",
        "data_period": "Up to 10 years, subject to provider availability",
        "observations": int(len(x)),
        "market_regime": _regime(stock, market_series),
        "prediction": {
            "up_probability_pct": round(up_probability * 100, 2),
            "down_probability_pct": round((1 - up_probability) * 100, 2),
            "confidence_pct": round(confidence * 100, 2),
            "decision": decision,
            "threshold_pct": CONFIDENCE_THRESHOLD * 100,
        },
        "out_of_sample_test": {
            "samples": int(len(y_test)),
            "directional_accuracy_pct": round(accuracy_score(y_test, test_class) * 100, 2),
            "balanced_accuracy_pct": round(balanced_accuracy_score(y_test, test_class) * 100, 2),
            "brier_score": round(float(brier_score_loss(y_test, ensemble_test)), 5),
            "high_confidence_coverage_pct": round(float(covered.mean() * 100), 2),
            "high_confidence_accuracy_pct": round(float(selective_accuracy), 2) if selective_accuracy is not None else None,
            "models": candidate_metrics,
        },
        "paper_backtest": {
            "strategy": "Long-only; buy when calibrated UP probability >= 60%, otherwise cash",
            "transaction_cost_assumption_bps_per_entry": TRADING_COST_BPS,
            "strategy_total_return_pct": round(float(total_return), 2),
            "buy_and_hold_return_pct": round(float(buy_hold), 2),
            "max_drawdown_pct": round(float(np.min(drawdown)), 2) if len(drawdown) else 0.0,
            "exposure_pct": round(float(buy_mask.mean() * 100), 2),
        },
        "data_note": "Yahoo Finance daily data; may be delayed, revised, incomplete, or unavailable.",
        "risk_note": (
            "Research and paper-trading output only. Historical out-of-sample results and "
            "probabilities do not guarantee future returns. Validate independently before "
            "any real-money decision; this endpoint does not execute broker orders."
        ),
    }
