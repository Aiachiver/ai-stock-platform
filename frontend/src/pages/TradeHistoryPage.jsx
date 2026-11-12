import React from "react";

function TradeHistoryPage({ history = [] }) {
  const trades = Array.isArray(history) ? history.slice().reverse() : [];
  return (
    <section style={{ marginTop: 28, padding: 22, background: "#1e293b", border: "1px solid #334155", borderRadius: 14, color: "white" }}>
      <div style={{ marginBottom: 18 }}>
        <span style={{ color: "#60a5fa", fontSize: 11, fontWeight: 800, letterSpacing: ".12em" }}>ACCOUNT ACTIVITY</span>
        <h2 style={{ margin: "5px 0" }}>📜 Trade History</h2>
        <p style={{ color: "#94a3b8", margin: 0 }}>Your paper BUY and SELL transactions.</p>
      </div>
      {trades.length === 0 ? <p style={{ textAlign: "center", color: "#94a3b8", padding: 30 }}>No trades yet.</p> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560, textAlign: "center" }}>
            <thead><tr>{["Symbol", "Type", "Quantity", "Price", "Total", "Date"].map((label) => <th key={label} style={{ padding: 12, color: "#94a3b8", borderBottom: "1px solid #475569" }}>{label}</th>)}</tr></thead>
            <tbody>{trades.map((trade) => <tr key={trade.id}>
              <td style={{ padding: 12 }}>{trade.symbol}</td>
              <td style={{ padding: 12, color: trade.type === "BUY" ? "#22c55e" : "#f87171", fontWeight: 700 }}>{trade.type}</td>
              <td style={{ padding: 12 }}>{trade.quantity}</td>
              <td style={{ padding: 12 }}>${Number(trade.price || 0).toFixed(2)}</td>
              <td style={{ padding: 12 }}>${(Number(trade.price || 0) * Number(trade.quantity || 0)).toFixed(2)}</td>
              <td style={{ padding: 12, color: "#94a3b8" }}>{trade.created_at ? new Date(trade.created_at).toLocaleString() : trade.timestamp ? new Date(trade.timestamp).toLocaleString() : "—"}</td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
export default TradeHistoryPage;