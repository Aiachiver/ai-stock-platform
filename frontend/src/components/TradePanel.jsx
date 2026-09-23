import React, { useState } from "react";
import API from "../services/api";

function TradePanel({ symbol, refresh, livePrice }) {
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);

  const orderValue = livePrice
    ? livePrice * quantity
    : 0;

  const buy = async () => {
    if (quantity <= 0) {
      alert("Quantity must be greater than 0");
      return;
    }

    try {
      setLoading(true);

      const res = await API.post(
        `/buy/${symbol}?quantity=${quantity}`
      );

      if (res.data.error) {
        if (res.data.required) {
          alert(
            `Insufficient balance.\n\nRequired: $${res.data.required}\nAvailable: $${res.data.available}`
          );
        } else {
          alert(res.data.error);
        }

        return;
      }

      alert(
        `Bought ${quantity} ${symbol}\nPrice: $${res.data.price}\nTotal: $${res.data.total}`
      );

      refresh();

    } catch (error) {
      console.log("BUY ERROR:", error);
      alert("Buy failed");
    } finally {
      setLoading(false);
    }
  };

  const sell = async () => {
    if (quantity <= 0) {
      alert("Quantity must be greater than 0");
      return;
    }

    try {
      setLoading(true);

      const res = await API.post(
        `/sell/${symbol}?quantity=${quantity}`
      );

      if (res.data.error) {
        alert(res.data.error);
        return;
      }

      alert(
        `Sold ${quantity} ${symbol}\nPrice: $${res.data.price}\nTotal: $${(
          res.data.price * quantity
        ).toFixed(2)}`
      );

      refresh();

    } catch (error) {
      console.log("SELL ERROR:", error);
      alert("Sell failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background: "#1e293b",
        padding: "20px",
        borderRadius: "12px",
        marginTop: "20px",
        textAlign: "center"
      }}
    >
      <h2>💹 Trade {symbol}</h2>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "15px",
          flexWrap: "wrap"
        }}
      >
        <input
          type="number"
          min="1"
          value={quantity}
          onChange={(e) =>
            setQuantity(Math.max(1, Number(e.target.value)))
          }
          style={{
            width: "100px",
            padding: "12px",
            borderRadius: "8px",
            border: "none",
            fontSize: "16px",
            textAlign: "center"
          }}
        />

        <button
          onClick={buy}
          disabled={loading}
          style={{
            background: "#22c55e",
            color: "white",
            border: "none",
            padding: "12px 25px",
            borderRadius: "8px",
            fontWeight: "bold",
            cursor: loading ? "not-allowed" : "pointer"
          }}
        >
          {loading ? "Processing..." : "BUY"}
        </button>

        <button
          onClick={sell}
          disabled={loading}
          style={{
            background: "#ef4444",
            color: "white",
            border: "none",
            padding: "12px 25px",
            borderRadius: "8px",
            fontWeight: "bold",
            cursor: loading ? "not-allowed" : "pointer"
          }}
        >
          {loading ? "Processing..." : "SELL"}
        </button>
      </div>

      <div
        style={{
          marginTop: "15px",
          background: "#0f172a",
          padding: "12px",
          borderRadius: "8px"
        }}
      >
        Order Value: <b>${orderValue.toFixed(2)}</b>
      </div>
    </div>
  );
}

export default TradePanel;