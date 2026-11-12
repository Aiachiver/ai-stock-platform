
import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import API, { API_BASE_URL } from "./services/api";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement);

function StockPage() {
  const [symbol, setSymbol] = useState("AAPL");
  const [data, setData] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [livePrice, setLivePrice] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res1 = await API.get(`/stock/${symbol}`);
        setData(res1.data.ohlc || []);

        const res2 = await API.get(`/predict/${symbol}`);
        setPrediction(res2.data);
      } catch (err) {
        console.error("Stock API Error:", err);
      }
    };

    fetchData();

    const wsBase = API_BASE_URL.replace(/^http/, "ws");
    const ws = new WebSocket(`${wsBase}/ws/${symbol}`);

    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      setLivePrice(d.price);
    };

    ws.onerror = (error) => {
      console.error("WebSocket Error:", error);
    };

    return () => ws.close();

  }, [symbol]);

  const chartData = {
    labels: data.map(d => d.time),
    datasets: [
      {
        label: "Price",
        data: data.map(d => d.close),
        borderColor: "green"
      }
    ]
  };

  return (
    <div style={{ textAlign: "center" }}>
      <h2>Stock Dashboard</h2>

      <select
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
      >
        <option value="AAPL">AAPL</option>
        <option value="TSLA">TSLA</option>
      </select>

      <div style={{ width: "600px", margin: "auto" }}>
        <Line data={chartData} />
      </div>

      {livePrice !== null && (
        <h3>Live Price: {livePrice}</h3>
      )}

      {prediction && (
        <>
          <h3>Current: {prediction.current_price}</h3>
          <h3>Predicted: {prediction.predicted_price}</h3>
          <h2>{prediction.signal}</h2>
        </>
      )}
    </div>
  );
}

export default StockPage;
