import React from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend
} from "recharts";

const panel = { background: "#1e293b", border: "1px solid #334155", borderRadius: 14, padding: 20, marginTop: 22 };
const metric = { background: "#0f172a", padding: 14, borderRadius: 10 };

function PremiumAnalytics({ insights, backtest, loading }) {
  const sentimentColor = insights?.sentiment === "Bullish" ? "#4ade80" : insights?.sentiment === "Bearish" ? "#f87171" : "#cbd5e1";
  const stats = [
    ["Strategy return", backtest?.total_return_pct, "%"],
    ["Buy & hold", backtest?.buy_hold_return_pct, "%"],
    ["Max drawdown", backtest?.max_drawdown_pct, "%"],
    ["Sharpe ratio", backtest?.sharpe_ratio, ""],
    ["Annual volatility", backtest?.annualized_volatility_pct, "%"],
    ["Trade count", backtest?.trade_count, ""]
  ];

  return (
    <section style={panel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0 }}>✦ Premium Market Intelligence</h2>
          <p style={{ color: "#94a3b8", margin: "7px 0 0" }}>News signals and historical strategy research</p>
        </div>
        <span style={{ background: "#312e81", color: "#c7d2fe", padding: "7px 11px", borderRadius: 20, fontSize: 12 }}>RESEARCH TOOLS</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginTop: 18 }}>
        <div style={{ ...metric }}>
          <div style={{ color: "#94a3b8", fontSize: 13 }}>Headline sentiment</div>
          <div style={{ color: sentimentColor, fontSize: 27, fontWeight: 800, marginTop: 8 }}>{insights?.sentiment || (loading ? "Loading…" : "Unavailable")}</div>
          <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 5 }}>{insights?.news_count ?? 0} recent headlines · score {insights?.score ?? "—"}</div>
          <p style={{ color: "#64748b", fontSize: 11, marginBottom: 0 }}>{insights?.note || "Sentiment is derived from headline keywords and may miss context."}</p>
        </div>
        <div style={{ ...metric }}>
          <div style={{ color: "#94a3b8", fontSize: 13 }}>Strategy backtest</div>
          <div style={{ fontSize: 21, fontWeight: 800, marginTop: 8 }}>{backtest?.strategy || (loading ? "Running…" : "Unavailable")}</div>
          <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 5 }}>{backtest?.period || "Historical simulation"}</div>
          <p style={{ color: "#64748b", fontSize: 11, marginBottom: 0 }}>{backtest?.note || backtest?.error || "Backtest data unavailable."}</p>
        </div>
      </div>

      {backtest && !backtest.error && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginTop: 16 }}>
            {stats.map(([label, value, suffix]) => (
              <div key={label} style={metric}>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>{label}</div>
                <strong style={{ display: "block", fontSize: 20, marginTop: 7 }}>{value === null || value === undefined ? "—" : `${value}${suffix}`}</strong>
              </div>
            ))}
          </div>
          {backtest.chart?.length > 1 && (
            <div style={{ marginTop: 18, background: "#0f172a", borderRadius: 12, padding: 14 }}>
              <h3 style={{ marginTop: 0 }}>Strategy vs Buy & Hold (growth of $1)</h3>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <LineChart data={backtest.chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} minTickGap={35} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "#111827", border: "1px solid #334155", color: "#fff" }} />
                    <Legend />
                    <Line type="monotone" dataKey="strategy" name="SMA strategy" stroke="#38bdf8" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="buy_hold" name="Buy & Hold" stroke="#a78bfa" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 18 }}>
        <h3>Latest headlines</h3>
        {!insights?.items?.length ? <p style={{ color: "#94a3b8" }}>No news headlines available for this symbol right now.</p> : insights.items.slice(0, 6).map((item, index) => (
          <div key={item.url || index} style={{ borderTop: "1px solid #334155", padding: "12px 0", display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              {item.url ? <a href={item.url} target="_blank" rel="noreferrer" style={{ color: "#e2e8f0", textDecoration: "none", fontWeight: 600 }}>{item.title}</a> : <strong>{item.title}</strong>}
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 5 }}>{item.publisher} · {item.published || "Recent"}</div>
            </div>
            <span style={{ color: item.sentiment === "Bullish" ? "#4ade80" : item.sentiment === "Bearish" ? "#f87171" : "#cbd5e1", fontSize: 12, whiteSpace: "nowrap" }}>{item.sentiment}</span>
          </div>
        ))}
      </div>
      <p style={{ color: "#64748b", fontSize: 11, marginBottom: 0 }}>Research and historical simulations only. News sentiment is a keyword heuristic; backtests exclude taxes, slippage and brokerage. Not investment advice.</p>
    </section>
  );
}

export default PremiumAnalytics;
