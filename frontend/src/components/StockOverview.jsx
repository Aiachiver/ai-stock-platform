import React from "react";

const money = (value, currency = "USD") => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value));
};

const compactMoney = (value, currency = "USD") => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 2 }).format(Number(value));
};

function StockOverview({ quote, livePrice }) {
  if (!quote) {
    return <div style={{ background: "#1e293b", padding: 22, borderRadius: 14, color: "#94a3b8", marginBottom: 22 }}>Market overview is unavailable right now.</div>;
  }

  const currency = quote.currency || "USD";
  const price = livePrice ?? quote.price;
  const positive = Number(quote.change) >= 0;
  const metrics = [
    ["Previous close", money(quote.previous_close, currency)],
    ["Open", money(quote.open, currency)],
    ["Day high", money(quote.day_high, currency)],
    ["Day low", money(quote.day_low, currency)],
    ["Market cap", compactMoney(quote.market_cap, currency)],
    ["P/E ratio", quote.trailing_pe ?? "—"]
  ];

  return (
    <section style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: 22, marginBottom: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 18 }}>
        <div>
          <div style={{ color: "#cbd5e1", fontSize: 15 }}>{quote.company_name || quote.symbol} · {quote.exchange || "Market data"}</div>
          <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
            <strong style={{ fontSize: 36, letterSpacing: "-1px" }}>{money(price, currency)}</strong>
            {quote.change !== null && quote.change !== undefined && (
              <span style={{ color: positive ? "#4ade80" : "#f87171", fontWeight: 700 }}>
                {positive ? "+" : ""}{money(quote.change, currency)} ({positive ? "+" : ""}{quote.change_percent ?? "—"}%)
              </span>
            )}
          </div>
          <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 8 }}>{quote.symbol} · {quote.data_note || "Market data may be delayed"}</div>
        </div>
        <div style={{ color: "#94a3b8", fontSize: 12, textAlign: "right" }}>
          <div>Data source</div>
          <strong style={{ color: "#e2e8f0" }}>Yahoo Finance</strong>
          {quote.as_of && <div style={{ marginTop: 5 }}>Updated: {new Date(quote.as_of).toLocaleString()}</div>}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginTop: 22 }}>
        {metrics.map(([label, value]) => (
          <div key={label} style={{ background: "#0f172a", padding: 14, borderRadius: 10 }}>
            <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 7 }}>{label}</div>
            <div style={{ color: "#f8fafc", fontWeight: 700, fontSize: 15 }}>{value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default StockOverview;
