import React, { useEffect, useState } from "react";
import axios from "axios";
import { Line } from "react-chartjs-2";
import CandleChart from "./components/CandleChart";

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
    fetchData();

    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/${symbol}`);
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      setLivePrice(d.price);
    };

    return () => ws.close();
  }, [symbol]);

  const fetchData = async () => {
    try {
      const res1 = await axios.get(`http://127.0.0.1:8000/stock/${symbol}`);
      setData(res1.data.ohlc || []);

      const res2 = await axios.get(`http://127.0.0.1:8000/predict/${symbol}`);
      setPrediction(res2.data);
    } catch (err) {
      console.log(err);
    }
  };

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

      <select onChange={(e) => setSymbol(e.target.value)}>
        <option>AAPL</option>
        <option>TSLA</option>
      </select>

      <div style={{ width: "600px", margin: "auto" }}>
        <Line data={chartData} />
      </div>

      {livePrice && <h3>Live Price: {livePrice}</h3>}

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