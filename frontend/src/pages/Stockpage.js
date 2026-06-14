import React, { useEffect, useState } from "react";

function StockPage() {
  // 📦 Stock data
  const [stockData, setStockData] = useState(null);

  // 🤖 Prediction data
  const [prediction, setPrediction] = useState(null);

  // ⏳ Loading states
  const [loading, setLoading] = useState(true);

  // ❌ Error state
  const [error, setError] = useState(null);

  // =========================
  // 📊 STOCK DATA FETCH
  // =========================
  useEffect(() => {
    fetch("http://127.0.0.1:8000/stock/AAPL")
      .then((res) => {
        if (!res.ok) throw new Error("Stock API failed");
        return res.json();
      })
      .then((data) => {
        console.log("STOCK DATA:", data);
        setStockData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("STOCK ERROR:", err);
        setError("Stock data fetch failed ❌");
        setLoading(false);
      });
  }, []);

  // =========================
  // 🤖 PREDICTION FETCH
  // =========================
  useEffect(() => {
    fetch("http://127.0.0.1:8000/stock/AAPL")
      .then((res) => {
        if (!res.ok) throw new Error("Prediction API failed");
        return res.json();
      })
      .then((data) => {
        console.log("PREDICTION:", data);
        setPrediction(data);
      })
      .catch((err) => {
        console.error("PREDICTION ERROR:", err);
      });
  }, []);

  // =========================
  // ⏳ Loading UI
  // =========================
  if (loading) return <h2>Loading...</h2>;

  // ❌ Error UI
  if (error) return <h2>{error}</h2>;

  // ❌ No data
  if (!stockData || !stockData.prices) {
    return <h2>No Data Found ❌</h2>;
  }

  // =========================
  // 🎯 MAIN UI
  // =========================
  return (
    <div style={{ padding: "20px" }}>
      <h2>📈 AAPL Stock Data</h2>

      {/* 🔥 SIGNAL */}
      <h3>
        Signal: {stockData.signal ? stockData.signal : "No Signal"}
      </h3>

      {/* 📊 Total points */}
      <p>Total Points: {stockData.prices.length}</p>

      {/* 📅 First 5 entries */}
      <ul>
        {stockData.prices.slice(0, 5).map((price, index) => (
          <li key={index}>
            {stockData.dates[index]} → {price}
          </li>
        ))}
      </ul>

      {/* ========================= */}
      {/* 🤖 AI PREDICTION SECTION */}
      {/* ========================= */}
      {prediction && (
        <div style={{ marginTop: "30px", padding: "15px", border: "1px solid #ccc" }}>
          <h3>🤖 AI Prediction</h3>

          <p>
            Predicted Price: <b>{prediction.predicted_price}</b>
          </p>

          <p>
            Signal:{" "}
            <span
              style={{
                color:
                  prediction.signal === "BUY"
                    ? "green"
                    : prediction.signal === "SELL"
                    ? "red"
                    : "gray",
                fontWeight: "bold",
              }}
            >
              {prediction.signal}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

export default StockPage;