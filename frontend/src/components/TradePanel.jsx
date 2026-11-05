import React, { useState } from "react";
import API from "../services/api";

function TradePanel({ symbol, refresh, livePrice }) {
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const orderValue = Number(livePrice || 0) * quantity;

  const executePaperOrder = async (side) => {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      alert("Enter a whole-share quantity greater than zero.");
      return;
    }
    const confirmed = window.confirm(
      `${side} ${quantity} ${symbol} in the paper-trading simulator? No real order will be sent.`
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      const response = await API.post(`/${side.toLowerCase()}/${symbol}?quantity=${quantity}`);
      if (response.data.error) {
        alert(response.data.error);
        return;
      }
      alert(`Paper ${side}: ${quantity} ${symbol}\nFill reference: $${response.data.price}\nSimulated total: $${response.data.total}`);
      refresh();
    } catch (error) {
      alert(error.response?.data?.detail || `Paper ${side.toLowerCase()} failed. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section style={{ background: "#1e293b", border: "1px solid #334155", padding: 20, borderRadius: 12, marginTop: 20, textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0 }}>Paper Trade · {symbol}</h2>
        <span style={{ color: "#fbbf24", border: "1px solid #92400e", padding: "5px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>SIMULATION ONLY</span>
      </div>
      <p style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.5 }}>
        Uses a simulated cash balance. No brokerage account is connected and no real orders are placed.
      </p>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 15, flexWrap: "wrap" }}>
        <label style={{ color: "#cbd5e1", fontSize: 13 }}>
          Shares{" "}
          <input type="number" min="1" step="1" value={quantity}
            onChange={(event) => setQuantity(Math.max(1, Math.floor(Number(event.target.value) || 1)))}
            style={{ width: 90, padding: 11, borderRadius: 8, border: "1px solid #475569", fontSize: 15, textAlign: "center" }}
          />
        </label>
        <button onClick={() => executePaperOrder("BUY")} disabled={loading}
          style={{ background: "#15803d", color: "white", border: "none", padding: "12px 22px", borderRadius: 8, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>
          {loading ? "Processing…" : "BUY (PAPER)"}
        </button>
        <button onClick={() => executePaperOrder("SELL")} disabled={loading}
          style={{ background: "#b91c1c", color: "white", border: "none", padding: "12px 22px", borderRadius: 8, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>
          {loading ? "Processing…" : "SELL (PAPER)"}
        </button>
      </div>
      <div style={{ marginTop: 15, background: "#0f172a", padding: 12, borderRadius: 8, color: "#cbd5e1" }}>
        Indicative order value: <b>${orderValue.toFixed(2)}</b>
        <div style={{ color: "#64748b", fontSize: 11, marginTop: 4 }}>Estimate only; final simulated fill uses the backend quote at order time.</div>
      </div>
    </section>
  );
}

export default TradePanel;
