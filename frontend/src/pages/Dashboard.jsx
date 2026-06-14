import React, { useEffect, useState } from "react";
import API from "../services/api";
import StockChart from "../components/StockChart";
import TradePanel from "../components/TradePanel";
import PredictionBox from "../components/PredictionBox";

function Dashboard() {

  const [symbol, setSymbol] = useState("AAPL");
  const [data, setData] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [livePrice, setLivePrice] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [details, setDetails] = useState(null);

  useEffect(() => {

    fetchData();

    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/${symbol}`);

    ws.onmessage = (event) => {

      const d = JSON.parse(event.data);

      setLivePrice(d.price);

    };

    return () => ws.close();

  }, [symbol]);

  const fetchData = async () => {

  try {

    const res1 = await API.get(`/stock/${symbol}`);

    if (res1.data.ohlc) {
      setData(res1.data.ohlc);
    }

    const res2 = await API.get(`/predict/${symbol}`);
    setPrediction(res2.data);

    const res3 = await API.get(`/portfolio`);
    setPortfolio(res3.data);

    const res4 = await API.get(`/portfolio/details`);
    setDetails(res4.data);

  } catch (err) {

    console.log("FETCH ERROR:", err);

  }

};

  return (

    <div
      style={{
        background: "#0f172a",
        minHeight: "100vh",
        color: "white",
        padding: "20px",
        fontFamily: "Arial"
      }}
    >

      <h1 style={{ textAlign: "center" }}>
        📈 AI Trading Dashboard
      </h1>

      {/* TOP BAR */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "20px",
          marginBottom: "20px"
        }}
      >

        <select
          onChange={(e) => setSymbol(e.target.value)}
          style={{
            padding: "10px",
            borderRadius: "8px",
            fontSize: "16px"
          }}
        >
          <option>AAPL</option>
          <option>TSLA</option>
          <option>GOOGL</option>
          <option>MSFT</option>
        </select>

        <div
          style={{
            background: "#1e293b",
            padding: "10px 20px",
            borderRadius: "10px"
          }}
        >
          💰 Live Price: {livePrice}
        </div>

      </div>

{/* PORTFOLIO */}
{portfolio && (

  <div
    style={{
      display: "flex",
      justifyContent: "center",
      gap: "20px",
      marginBottom: "20px"
    }}
  >

    <div
      style={{
        background: "#1e293b",
        padding: "20px",
        borderRadius: "10px",
        width: "200px",
        textAlign: "center"
      }}
    >
      <h3>Balance</h3>
      <h2>${portfolio.balance}</h2>
    </div>

    <div
      style={{
        background: "#1e293b",
        padding: "20px",
        borderRadius: "10px",
        width: "200px",
        textAlign: "center"
      }}
    >
      <h3>Holdings</h3>
      <h2>{portfolio.holdings}</h2>
    </div>

  </div>

)}

{/* PROFIT / LOSS */}
{details && (

  <div
    style={{
      display: "flex",
      justifyContent: "center",
      marginBottom: "20px"
    }}
  >

    <div
      style={{
        background: "#1e293b",
        padding: "20px",
        borderRadius: "10px",
        width: "220px",
        textAlign: "center"
      }}
    >

      <h3>Profit / Loss</h3>

      <h2
        style={{
          color:
            details.profit >= 0
              ? "#22c55e"
              : "#ef4444"
        }}
      >
        ${details.profit}
      </h2>

    </div>

  </div>

)}

      {/* CHART */}
      <div
        style={{
          background: "white",
          padding: "20px",
          borderRadius: "12px",
          width: "80%",
          margin: "auto"
        }}
      >
        <StockChart data={data} />
      </div>

      {/* PREDICTION */}
      <div style={{ marginTop: "20px" }}>
        <PredictionBox prediction={prediction} />
      </div>

      {/* TRADE PANEL */}
      <div style={{ marginTop: "20px" }}>
        <TradePanel symbol={symbol} refresh={fetchData} />
      </div>

    </div>

  );

}

export default Dashboard;