import React from "react";

function PortfolioRisk({ data, loading }) {
  const panel = { background: "#1e293b", border: "1px solid #334155", borderRadius: 14, padding: 20, marginTop: 22 };
  const value = (v, suffix = "") => v === null || v === undefined ? "—" : `${v}${suffix}`;
  const riskColor = data?.risk_level === "High" ? "#f87171" : data?.risk_level === "Moderate" ? "#fbbf24" : "#4ade80";

  return (
    <section style={panel}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0 }}>◈ Portfolio Risk Analytics</h2>
          <p style={{ color: "#94a3b8", margin: "7px 0 0" }}>Historical risk estimates from your current holdings</p>
        </div>
        <strong style={{ color: riskColor, fontSize: 18 }}>{data?.risk_level || (loading ? "Calculating…" : "Unavailable")} Risk</strong>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 18 }}>
        {[
          ["Portfolio value", data?.portfolio_value === undefined ? "—" : `$${Number(data.portfolio_value).toLocaleString()}`],
          ["Annualized volatility", value(data?.portfolio_volatility_pct, "%")],
          ["Historical 1-day VaR (95%)", value(data?.var_95_pct, "%")],
          ["Maximum drawdown", value(data?.max_drawdown_pct, "%")]
        ].map(([label, val]) => (
          <div key={label} style={{ background: "#0f172a", padding: 15, borderRadius: 10 }}>
            <div style={{ color: "#94a3b8", fontSize: 12 }}>{label}</div>
            <strong style={{ display: "block", fontSize: 21, marginTop: 8 }}>{val}</strong>
          </div>
        ))}
      </div>
      <h3 style={{ marginTop: 20 }}>Portfolio allocation</h3>
      {!data?.holdings?.length ? <p style={{ color: "#94a3b8" }}>{data?.note || "Add holdings to calculate allocation and risk."}</p> : data.holdings.map(item => (
        <div key={item.symbol} style={{ margin: "12px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#cbd5e1", fontSize: 13 }}>
            <strong>{item.symbol}</strong><span>{item.weight_pct}%</span>
          </div>
          <div style={{ height: 8, background: "#0f172a", borderRadius: 20, marginTop: 6, overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, Math.max(0, item.weight_pct))}%`, height: "100%", background: "#38bdf8" }} />
          </div>
        </div>
      ))}
      <p style={{ color: "#64748b", fontSize: 11, marginBottom: 0 }}>{data?.note || "Risk metrics are estimates based on historical data and are not loss limits or guarantees."}</p>
    </section>
  );
}

export default PortfolioRisk;
