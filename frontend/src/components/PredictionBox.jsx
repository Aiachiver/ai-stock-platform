import React from "react";

function PredictionBox({ prediction }) {
  if (!prediction || prediction.loading) {
    return (
      <section className="research-panel research-loading" aria-live="polite">
        <div className="research-panel__top">
          <div>
            <span className="eyebrow">NEXT-SESSION RESEARCH</span>
            <h2>AI Forecast</h2>
          </div>
          <span className="research-status"><span className="loading-dot" /> Training model</span>
        </div>
        <p className="research-muted">Preparing indicators and comparing time-series models. This can take a little longer on the first request.</p>
        <div className="research-skeleton" />
      </section>
    );
  }

  if (prediction.error || prediction.signal === "NO DATA") {
    return (
      <section className="research-panel">
        <div className="research-panel__top">
          <div><span className="eyebrow">NEXT-SESSION RESEARCH</span><h2>AI Forecast</h2></div>
          <span className="research-status research-status--warning">Unavailable</span>
        </div>
        <p className="research-muted">{prediction.note || prediction.error || "A forecast is not available for this symbol."}</p>
        <p className="research-disclaimer">No BUY or SELL recommendation is issued when reliable model output is unavailable.</p>
      </section>
    );
  }

  const signal = String(prediction.signal || "HOLD").toUpperCase();
  const signalColor = signal === "BUY" ? "#4ade80" : signal === "SELL" ? "#f87171" : "#fbbf24";
  const money = (value) => Number.isFinite(Number(value)) ? "$" + Number(value).toFixed(2) : "—";
  const metrics = [
    ["Model", prediction.model || "—"],
    ["Forecast horizon", prediction.forecast_horizon || "—"],
    ["CV directional accuracy", prediction.validation_directional_accuracy_pct == null ? "—" : Number(prediction.validation_directional_accuracy_pct).toFixed(2) + "%"],
    ["CV balanced accuracy", prediction.validation_balanced_directional_accuracy_pct == null ? "—" : Number(prediction.validation_balanced_directional_accuracy_pct).toFixed(2) + "%"],
    ["Validation return MAE", prediction.validation_mae_return_pct == null ? "—" : Number(prediction.validation_mae_return_pct).toFixed(3) + "%"],
    ["Signal threshold", prediction.signal_threshold_pct == null ? "—" : Number(prediction.signal_threshold_pct).toFixed(3) + "%"]
  ];

  return (
    <section className="research-panel">
      <div className="research-panel__top">
        <div><span className="eyebrow">NEXT-SESSION EXPERIMENTAL FORECAST</span><h2>AI Model Signal</h2></div>
        <strong className="forecast-signal" style={{ color: signalColor, borderColor: signalColor }}>{signal}</strong>
      </div>
      <div className="forecast-values">
        <div><span>Latest reference price</span><strong>{money(prediction.current_price)}</strong></div>
        <div><span>Model-estimated price</span><strong>{money(prediction.predicted_price)}</strong></div>
        <div><span>Estimated return</span><strong style={{ color: Number(prediction.predicted_return_pct) >= 0 ? "#4ade80" : "#f87171" }}>{prediction.predicted_return_pct == null ? "—" : (Number(prediction.predicted_return_pct) > 0 ? "+" : "") + Number(prediction.predicted_return_pct).toFixed(3) + "%"}</strong></div>
      </div>
      <div className="forecast-metrics">
        {metrics.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      <p className="research-disclaimer">{prediction.note || "Experimental model output. Not investment advice and not a guaranteed result."}</p>
    </section>
  );
}

export default PredictionBox;
