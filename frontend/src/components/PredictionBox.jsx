import React from "react";

function PredictionBox({ prediction }) {
  if (!prediction) return null;

  if (prediction.error || prediction.signal === "NO DATA") {
    return (
      <section style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 14, padding: 20, color: "#cbd5e1" }}>
        <h2 style={{ marginTop: 0 }}>AI Forecast</h2>
        {prediction.error || prediction.note || "A forecast is not available for this symbol."}
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
    <section style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 14, padding: 22, color: "#f8fafc" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
        <div>
          <p style={{ color: "#94a3b8", margin: "0 0 6px", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Next-session experimental forecast</p>
          <h2 style={{ margin: 0 }}>AI Model Signal</h2>
        </div>
        <strong style={{ color: signalColor, border: "1px solid " + signalColor, borderRadius: 20, padding: "7px 16px", fontSize: 14 }}>{signal}</strong>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, margin: "20px 0" }}>
        <div style={{ background: "#0f172a", borderRadius: 10, padding: 16 }}>
          <div style={{ color: "#94a3b8", fontSize: 12 }}>Latest reference price</div>
          <strong style={{ display: "block", fontSize: 25, marginTop: 7 }}>{money(prediction.current_price)}</strong>
        </div>
        <div style={{ background: "#0f172a", borderRadius: 10, padding: 16 }}>
          <div style={{ color: "#94a3b8", fontSize: 12 }}>Model-estimated price</div>
          <strong style={{ display: "block", fontSize: 25, marginTop: 7 }}>{money(prediction.predicted_price)}</strong>
        </div>
        <div style={{ background: "#0f172a", borderRadius: 10, padding: 16 }}>
          <div style={{ color: "#94a3b8", fontSize: 12 }}>Estimated return</div>
          <strong style={{ display: "block", fontSize: 25, marginTop: 7, color: Number(prediction.predicted_return_pct) >= 0 ? "#4ade80" : "#f87171" }}>
            {prediction.predicted_return_pct == null ? "—" : (Number(prediction.predicted_return_pct) > 0 ? "+" : "") + Number(prediction.predicted_return_pct).toFixed(3) + "%"}
          </strong>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 10 }}>
        {metrics.map(([label, value]) => (
          <div key={label} style={{ background: "#111827", borderRadius: 9, padding: 12 }}>
            <div style={{ color: "#94a3b8", fontSize: 11 }}>{label}</div>
            <strong style={{ display: "block", marginTop: 6, fontSize: 14 }}>{value}</strong>
          </div>
        ))}
      </div>
      <p style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.6, margin: "16px 0 0" }}>
        {prediction.note || "Experimental model output. Not investment advice and not a guaranteed result."}
      </p>
    </section>
  );
}

export default PredictionBox;
