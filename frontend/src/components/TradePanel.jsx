import React from "react";
import API from "../services/api";

function TradePanel({ symbol, refresh }) {

  const buy = async () => {

    await API.post(`/buy/${symbol}`);
    refresh();

  };

  const sell = async () => {

    await API.post(`/sell/${symbol}`);
    refresh();

  };

  return (

    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: "20px"
      }}
    >

      <button
        onClick={buy}
        style={{
          background: "#16a34a",
          color: "white",
          padding: "12px 30px",
          border: "none",
          borderRadius: "10px",
          fontSize: "18px",
          cursor: "pointer"
        }}
      >
        BUY
      </button>

      <button
        onClick={sell}
        style={{
          background: "#dc2626",
          color: "white",
          padding: "12px 30px",
          border: "none",
          borderRadius: "10px",
          fontSize: "18px",
          cursor: "pointer"
        }}
      >
        SELL
      </button>

    </div>

  );

}

export default TradePanel;