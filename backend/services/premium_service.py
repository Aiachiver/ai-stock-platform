import numpy as np
import pandas as pd
import yfinance as yf
from datetime import datetime, timezone

POSITIVE = {"beat", "growth", "upgrade", "strong", "surge", "profit", "record", "bullish", "buy", "outperform", "raises", "positive", "approval"}
NEGATIVE = {"miss", "decline", "downgrade", "weak", "drop", "loss", "bearish", "sell", "underperform", "cuts", "negative", "lawsuit", "warning"}


def _sentiment(text):
    words = {word.strip(".,:;!?()[]{}'\"").lower() for word in str(text).split()}
    pos = len(words & POSITIVE)
    neg = len(words & NEGATIVE)
    total = pos + neg
    score = (pos - neg) / total if total else 0.0
    label = "Bullish" if score > 0.15 else "Bearish" if score < -0.15 else "Neutral"
    return label, round(score, 3)


def get_market_intelligence(symbol):
    ticker = yf.Ticker(symbol)
    try:
        raw_news = ticker.news or []
    except Exception:
        raw_news = []
    items = []
    for entry in raw_news[:12]:
        item = entry.get("content", entry) if isinstance(entry, dict) else {}
        title = item.get("title") or ""
        if not title:
            continue
        label, score = _sentiment(title)
        provider = item.get("provider", {})
        if isinstance(provider, dict):
            provider = provider.get("displayName")
        canonical = item.get("canonicalUrl", {})
        url = canonical.get("url") if isinstance(canonical, dict) else None
        pub = item.get("pubDate") or item.get("displayTime")
        items.append({
            "title": title,
            "publisher": provider or "Yahoo Finance",
            "url": url,
            "published": pub,
            "sentiment": label,
            "score": score
        })
    if not items:
        return {
            "symbol": symbol, "sentiment": "Unavailable", "score": None,
            "news_count": 0, "items": [],
            "note": "News feed is unavailable for this symbol right now."
        }
    average = float(np.mean([item["score"] for item in items]))
    label = "Bullish" if average > 0.15 else "Bearish" if average < -0.15 else "Neutral"
    return {
        "symbol": symbol, "sentiment": label, "score": round(average, 3),
        "news_count": len(items), "items": items,
        "note": "Headline keyword sentiment is an experimental signal, not a contextual language-model analysis."
    }


def get_strategy_backtest(symbol, fast_window=20, slow_window=50):
    if fast_window < 2 or slow_window <= fast_window or slow_window > 200:
        return {"error": "Use 2 <= fast window < slow window <= 200"}
    frame = yf.Ticker(symbol).history(period="5y", interval="1d", auto_adjust=True)
    if getattr(frame.columns, "nlevels", 1) > 1:
        frame.columns = frame.columns.get_level_values(0)
    if frame.empty or "Close" not in frame or len(frame) < slow_window + 30:
        return {"error": "Not enough historical data to backtest this symbol"}
    close = frame["Close"].astype(float).dropna()
    fast = close.rolling(fast_window).mean()
    slow = close.rolling(slow_window).mean()
    # Shift signals by one session: today's close signal is tradable from next session.
    signal = (fast > slow).astype(float).shift(1).fillna(0)
    market_returns = close.pct_change().fillna(0)
    strategy_returns = signal * market_returns
    equity = (1 + strategy_returns).cumprod()
    benchmark = (1 + market_returns).cumprod()
    drawdown = equity / equity.cummax() - 1
    total_return = float(equity.iloc[-1] - 1)
    benchmark_return = float(benchmark.iloc[-1] - 1)
    years = max(len(close) / 252, 1 / 252)
    cagr = float(equity.iloc[-1] ** (1 / years) - 1) if equity.iloc[-1] > 0 else -1
    volatility = float(strategy_returns.std() * np.sqrt(252))
    sharpe = float((strategy_returns.mean() * 252) / (strategy_returns.std() * np.sqrt(252))) if strategy_returns.std() else 0
    trades = int((signal.diff().abs() > 0).sum())
    active_day_wins = int((strategy_returns[signal > 0] > 0).sum())
    active_days = int((signal > 0).sum())
    recent = min(90, len(close))
    chart = [{
        "date": close.index[-recent + i].strftime("%Y-%m-%d"),
        "strategy": round(float(equity.iloc[-recent + i]), 4),
        "buy_hold": round(float(benchmark.iloc[-recent + i]), 4)
    } for i in range(recent)]
    return {
        "symbol": symbol, "strategy": f"SMA {fast_window}/{slow_window} crossover",
        "period": "5 years (available history)",
        "total_return_pct": round(total_return * 100, 2),
        "buy_hold_return_pct": round(benchmark_return * 100, 2),
        "cagr_pct": round(cagr * 100, 2),
        "max_drawdown_pct": round(float(drawdown.min()) * 100, 2),
        "annualized_volatility_pct": round(volatility * 100, 2),
        "sharpe_ratio": round(sharpe, 2),
        "trade_count": trades,
        # Share of invested days with positive daily returns, not per-trade win rate.
        "active_day_win_rate_pct": (
            round(active_day_wins / active_days * 100, 2) if active_days else 0
        ),
        "chart": chart,
        "note": "Historical simulation before taxes, slippage and brokerage. Past results do not predict future returns."
    }


def get_portfolio_risk(trades):
    positions = {}
    for trade in trades:
        symbol = str(trade.symbol).strip().upper()
        quantity = int(trade.quantity or 1)
        current = positions.setdefault(symbol, {"quantity": 0, "cost": 0.0})
        if trade.type == "BUY":
            current["quantity"] += quantity
            current["cost"] += float(trade.price) * quantity
        elif trade.type == "SELL" and current["quantity"] > 0:
            sold = min(quantity, current["quantity"])
            avg = current["cost"] / current["quantity"]
            current["quantity"] -= sold
            current["cost"] -= avg * sold
    holdings = {s: p for s, p in positions.items() if p["quantity"] > 0}
    if not holdings:
        return {"holdings": [], "portfolio_volatility_pct": None, "var_95_pct": None,
                "max_drawdown_pct": None, "risk_level": "No holdings",
                "note": "Add a position to calculate portfolio risk."}
    def load_holding_history(item):
        symbol, position = item
        try:
            hist = yf.Ticker(symbol).history(period="1y", interval="1d", auto_adjust=True)
            if getattr(hist.columns, "nlevels", 1) > 1:
                hist.columns = hist.columns.get_level_values(0)
            if hist.empty or "Close" not in hist:
                return None
            close = hist["Close"].dropna()
            if close.empty:
                return None
            return symbol, close.rename(symbol), float(close.iloc[-1]) * position["quantity"]
        except Exception:
            return None

    from concurrent.futures import ThreadPoolExecutor

    with ThreadPoolExecutor(max_workers=min(5, len(holdings))) as executor:
        results = executor.map(load_holding_history, holdings.items())

    prices, values = {}, {}
    for result in results:
        if result is not None:
            symbol, close, market_value = result
            prices[symbol] = close
            values[symbol] = market_value

    total_value = sum(values.values())
    if not prices or total_value <= 0:
        return {"holdings": [], "portfolio_volatility_pct": None, "var_95_pct": None,
                "max_drawdown_pct": None, "risk_level": "Unavailable",
                "note": "Historical prices could not be loaded."}
    returns = pd.concat([series.pct_change().rename(symbol) for symbol, series in prices.items()], axis=1).dropna()
    weights = np.array([values[s] / total_value for s in returns.columns])
    portfolio_returns = returns.to_numpy() @ weights
    volatility = float(np.std(portfolio_returns, ddof=1) * np.sqrt(252) * 100) if len(portfolio_returns) > 1 else None
    var95 = float(np.percentile(portfolio_returns, 5) * 100) if len(portfolio_returns) else None
    curve = np.cumprod(1 + portfolio_returns)
    peak = np.maximum.accumulate(curve)
    max_dd = float(np.min(curve / peak - 1) * 100) if len(curve) else None
    level = "High" if volatility is not None and volatility >= 35 else "Moderate" if volatility is not None and volatility >= 18 else "Lower"
    return {
        "holdings": [{"symbol": s, "weight_pct": round(values[s] / total_value * 100, 2),
                      "market_value": round(values[s], 2)} for s in values],
        "portfolio_value": round(total_value, 2),
        "portfolio_volatility_pct": round(volatility, 2) if volatility is not None else None,
        "var_95_pct": round(var95, 2) if var95 is not None else None,
        "max_drawdown_pct": round(max_dd, 2) if max_dd is not None else None,
        "risk_level": level,
        "note": "Historical 1-day 95% VaR and annualized volatility estimates; not a maximum-loss guarantee."
    }
