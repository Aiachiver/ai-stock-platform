import React from "react";

const Metric = ({ label, value }) => (
  <div className="forecast-metrics__item">
    <span>{label}</span>
    <strong>{value ?? "—"}</strong>
  </div>
);

function AdvancedIntelligence({ data, loading = false }) {
  if (loading || data?.loading) {
    return (
      <section className="research-panel research-loading" aria-live="polite">
        <div className="research-panel__top">
          <div><span className="eyebrow">TRADE SIGHT AI V3.1</span><h2>Advanced market intelligence</h2></div>
          <span className="research-status"><span className="loading-dot" /> Validating models</span>
        </div>
        <p className="research-muted">Chronological probability calibration and out-of-sample evaluation are running. This research endpoint can take longer than the standard forecast.</p>
        <div className="research-skeleton" />
      </section>
    );
  }

  if (!data || data.error || data.detail) {
    return (
      <section className="research-panel">
        <div className="research-panel__top">
          <div><span className="eyebrow">TRADE SIGHT AI V3.1</span><h2>Advanced market intelligence</h2></div>
          <span className="research-status research-status--warning">Unavailable</span>
        </div>
        <p className="research-muted">{data?.detail || data?.error || "Advanced research is not available for this symbol right now."}</p>
        <p className="research-disclaimer">No advanced signal is issued when model evaluation is unavailable.</p>
      </section>
    );
  }

  const prediction = data.prediction || {};
  const test = data.out_of_sample_test || {};
  const backtest = data.paper_backtest || {};
  const decisionColor = prediction.decision === "BUY / PAPER LONG"
    ? "#22c55e"
    : prediction.decision === "BEARISH / AVOID NEW LONG" ? "#f59e0b" : "#94a3b8";

  return (
    <section className="research-panel">
      <div className="research-panel__top">
        <div><span className="eyebrow">TRADE SIGHT AI V3.1 · {data.symbol}</span><h2>Advanced market intelligence</h2></div>
        <span className="research-status">{data.market_regime || "Market regime unavailable"}</span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 18, marginBottom: 16 }}>
        <strong style={{ color: decisionColor, border: `1px solid ${decisionColor}`, borderRadius: 999, padding: "9px 15px", fontSize: 13 }}>
          {prediction.decision || "NO TRADE"}
        </strong>
        <span className="research-muted">Next-session research · {prediction.confidence_pct ?? "—"}% confidence · {prediction.threshold_pct ?? 60}% threshold</span>
      </div>

      <div className="forecast-metrics">
        <Metric label="Up probability" value={prediction.up_probability_pct != null ? `${prediction.up_probability_pct}%` : "—"} />
        <Metric label="Down probability" value={prediction.down_probability_pct != null ? `${prediction.down_probability_pct}%` : "—"} />
        <Metric label="Directional accuracy" value={test.directional_accuracy_pct != null ? `${test.directional_accuracy_pct}%` : "—"} />
        <Metric label="Balanced accuracy" value={test.balanced_accuracy_pct != null ? `${test.balanced_accuracy_pct}%` : "—"} />
        <Metric label="Brier score" value={test.brier_score ?? "—"} />
        <Metric label="High-confidence coverage" value={test.high_confidence_coverage_pct != null ? `${test.high_confidence_coverage_pct}%` : "—"} />
        <Metric label="Test samples" value={test.samples ?? "—"} />
        <Metric label="Observations" value={data.observations ?? "—"} />
      </div>

      <h3 style={{ marginTop: 22 }}>Model comparison</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 440 }}>
          <thead><tr><th align="left">Model</th><th align="right">Accuracy</th><th align="right">Balanced</th><th align="right">Brier</th></tr></thead>
          <tbody>
            {Object.entries(test.models || {}).map(([name, metrics]) => (
              <tr key={name}>
                <td style={{ padding: 9 }}>{name}</td>
                <td align="right">{metrics.accuracy_pct}%</td>
                <td align="right">{metrics.balanced_accuracy_pct}%</td>
                <td align="right">{metrics.brier_score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 style={{ marginTop: 22 }}>Paper backtest</h3>
      <div className="forecast-metrics">
        <Metric label="Strategy return" value={backtest.strategy_total_return_pct != null ? `${backtest.strategy_total_return_pct}%` : "—"} />
        <Metric label="Buy & hold" value={backtest.buy_and_hold_return_pct != null ? `${backtest.buy_and_hold_return_pct}%` : "—"} />
        <Metric label="Max drawdown" value={backtest.max_drawdown_pct != null ? `${backtest.max_drawdown_pct}%` : "—"} />
        <Metric label="Exposure" value={backtest.exposure_pct != null ? `${backtest.exposure_pct}%` : "—"} />
      </div>
      <p className="research-disclaimer">{data.data_note} {data.risk_note} A NO TRADE result or zero exposure is shown honestly when no forecast crosses the configured confidence threshold.</p>
    </section>
  );
}

export default AdvancedIntelligence;
