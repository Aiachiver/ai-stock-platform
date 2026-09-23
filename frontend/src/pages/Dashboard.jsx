import React, { useEffect, useState } from "react";
import API from "../services/api";

import StockChart from "../components/StockChart";
import PredictionBox from "../components/PredictionBox";
import TradePanel from "../components/TradePanel";
import PortfolioCharts from "../components/PortfolioCharts";

function Dashboard() {
  const [symbol, setSymbol] = useState("AAPL");

  const [stockData, setStockData] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [details, setDetails] = useState(null);
  const [positions, setPositions] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [history, setHistory] = useState([]);

  const [livePrice, setLivePrice] = useState(null);
  const [loading, setLoading] = useState(true);

  const symbols = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA"];

  const loadDashboard = async () => {
    try {
      setLoading(true);

      const [
        stockRes,
        predictionRes,
        detailsRes,
        positionsRes,
        chartRes,
        historyRes,
      ] = await Promise.all([
        API.get(`/stock/${symbol}`),
        API.get(`/predict/${symbol}`),
        API.get("/portfolio/details"),
        API.get("/portfolio/positions"),
        API.get("/portfolio/chart"),
        API.get("/history"),
      ]);

      setStockData(stockRes.data?.ohlc || []);
      setPrediction(predictionRes.data || null);
      setDetails(detailsRes.data || null);
      setPositions(positionsRes.data || []);
      setChartData(chartRes.data || []);
      setHistory(historyRes.data || []);
    } catch (error) {
      console.log("DASHBOARD ERROR:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [symbol]);

  useEffect(() => {
    let ws;

    try {
      ws = new WebSocket(
        `ws://127.0.0.1:8000/ws/${symbol}`
      );

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.price) {
          setLivePrice(data.price);
        }
      };

      ws.onerror = (error) => {
        console.log("WEBSOCKET ERROR:", error);
      };

      ws.onclose = () => {
        console.log("WebSocket closed");
      };
    } catch (error) {
      console.log("WEBSOCKET CONNECTION ERROR:", error);
    }

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [symbol]);

  const logout = () => {
    const confirmLogout = window.confirm(
      "Are you sure you want to logout?"
    );

    if (!confirmLogout) return;

    localStorage.removeItem("token");
    window.location.reload();
  };

  const refreshDashboard = () => {
    loadDashboard();
  };

  const formatMoney = (value) => {
    return `$${Number(value || 0).toFixed(2)}`;
  };

  const getTypeColor = (type) => {
    return type === "BUY" ? "#22c55e" : "#ef4444";
  };

  const getProfitColor = (value) => {
    return Number(value) >= 0 ? "#22c55e" : "#ef4444";
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "white",
        padding: "14px",
        boxSizing: "border-box",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "18px",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "24px",
          }}
        >
          📈 AI Trading Dashboard
        </h1>

        <button
          onClick={logout}
          style={{
            background: "#ef4444",
            color: "white",
            border: "none",
            padding: "10px 18px",
            borderRadius: "7px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Logout
        </button>
      </div>

      {/* STOCK SELECTOR */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "12px",
          marginBottom: "18px",
          flexWrap: "wrap",
        }}
      >
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          style={{
            padding: "10px 15px",
            borderRadius: "7px",
            border: "none",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          {symbols.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <div
          style={{
            background: "#1e293b",
            padding: "10px 16px",
            borderRadius: "8px",
            fontSize: "14px",
          }}
        >
          💰 Live Price:{" "}
          <b>
            {livePrice
              ? formatMoney(livePrice)
              : "Loading..."}
          </b>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      {details && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "10px",
            marginBottom: "18px",
          }}
        >
          {[
            ["💰", "Balance", details.balance],
            ["📦", "Holdings", details.holdings],
            ["💵", "Invested", details.invested],
            ["📈", "Current Value", details.current],
            ["✅", "Realized P/L", details.realized_profit],
            ["📊", "Unrealized P/L", details.unrealized_profit],
            ["💎", "Total P/L", details.profit],
          ].map(([icon, title, value]) => (
            <div
              key={title}
              style={{
                background: "#1e293b",
                padding: "18px 12px",
                borderRadius: "9px",
                textAlign: "center",
                boxShadow:
                  "0 4px 12px rgba(0,0,0,0.15)",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  color: "#cbd5e1",
                  marginBottom: "10px",
                }}
              >
                {icon} {title}
              </div>

              <div
                style={{
                  fontSize: "17px",
                  fontWeight: "bold",
                  color:
                    title.includes("P/L")
                      ? getProfitColor(value)
                      : "white",
                }}
              >
                {title === "Holdings"
                  ? value
                  : formatMoney(value)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* STOCK CHART */}
      <div
        style={{
          background: "white",
          borderRadius: "10px",
          overflow: "hidden",
          marginBottom: "18px",
        }}
      >
        {stockData.length > 0 ? (
          <StockChart data={stockData} />
        ) : (
          <div
            style={{
              height: "300px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              color: "#111827",
            }}
          >
            {loading
              ? "Loading chart..."
              : "No chart data available"}
          </div>
        )}
      </div>

      {/* PREDICTION */}
      <div style={{ marginBottom: "18px" }}>
        <PredictionBox prediction={prediction} />
      </div>

      {/* TRADE PANEL */}
      <TradePanel
        symbol={symbol}
        refresh={refreshDashboard}
        livePrice={livePrice}
      />

      {/* PORTFOLIO CHARTS */}
      <PortfolioCharts data={chartData} />

      {/* CURRENT POSITIONS */}
      <div
        style={{
          background: "#1e293b",
          padding: "20px",
          borderRadius: "12px",
          marginTop: "22px",
        }}
      >
        <h2 style={{ marginTop: 0 }}>
          📊 Current Positions
        </h2>

        {positions.length === 0 ? (
          <div
            style={{
              background: "#0f172a",
              padding: "20px",
              borderRadius: "8px",
              textAlign: "center",
              color: "#94a3b8",
            }}
          >
            No open positions
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "15px",
            }}
          >
            {positions.map((position) => {
              const profitPercent =
                position.average_price > 0
                  ? ((position.current_price -
                      position.average_price) /
                      position.average_price) *
                    100
                  : 0;

              const profitColor =
                position.profit >= 0
                  ? "#22c55e"
                  : "#ef4444";

              return (
                <div
                  key={position.symbol}
                  style={{
                    background: "#0f172a",
                    padding: "18px",
                    borderRadius: "10px",
                    border:
                      "1px solid #263449",
                  }}
                >
                  <h3
                    style={{
                      marginTop: 0,
                      marginBottom: "15px",
                    }}
                  >
                    {position.symbol}
                  </h3>

                  <p>
                    Quantity:{" "}
                    <b>{position.quantity}</b>
                  </p>

                  <p>
                    Average Price:{" "}
                    <b>
                      {formatMoney(
                        position.average_price
                      )}
                    </b>
                  </p>

                  <p>
                    Current Price:{" "}
                    <b>
                      {formatMoney(
                        position.current_price
                      )}
                    </b>
                  </p>

                  <p>
                    Current Value:{" "}
                    <b>
                      {formatMoney(
                        position.current_value
                      )}
                    </b>
                  </p>

                  <p
                    style={{
                      color: profitColor,
                      fontWeight: "bold",
                      marginBottom: "5px",
                    }}
                  >
                    P/L:{" "}
                    {position.profit >= 0
                      ? "+"
                      : ""}
                    {formatMoney(position.profit)}
                  </p>

                  <p
                    style={{
                      color: profitColor,
                      fontWeight: "bold",
                      marginTop: 0,
                    }}
                  >
                    P/L Percentage:{" "}
                    {profitPercent >= 0
                      ? "+"
                      : ""}
                    {profitPercent.toFixed(2)}%
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* TRADE HISTORY */}
      <div
        style={{
          background: "#1e293b",
          padding: "20px",
          borderRadius: "12px",
          marginTop: "22px",
          marginBottom: "30px",
          overflowX: "auto",
        }}
      >
        <h2 style={{ marginTop: 0 }}>
          📜 Trade History
        </h2>

        {history.length === 0 ? (
          <div
            style={{
              background: "#0f172a",
              padding: "20px",
              borderRadius: "8px",
              textAlign: "center",
              color: "#94a3b8",
            }}
          >
            No trades yet
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: "650px",
            }}
          >
            <thead>
              <tr
                style={{
                  background: "#0f172a",
                  textAlign: "left",
                }}
              >
                <th style={{ padding: "14px" }}>
                  ID
                </th>

                <th style={{ padding: "14px" }}>
                  Symbol
                </th>

                <th style={{ padding: "14px" }}>
                  Type
                </th>

                <th style={{ padding: "14px" }}>
                  Quantity
                </th>

                <th style={{ padding: "14px" }}>
                  Price
                </th>

                <th style={{ padding: "14px" }}>
                  Total
                </th>
              </tr>
            </thead>

            <tbody>
              {[...history]
                .reverse()
                .map((trade) => {
                  const quantity =
                    trade.quantity || 1;

                  const total =
                    trade.price * quantity;

                  return (
                    <tr
                      key={trade.id}
                      style={{
                        borderBottom:
                          "1px solid #334155",
                      }}
                    >
                      <td style={{ padding: "14px" }}>
                        #{trade.id}
                      </td>

                      <td style={{ padding: "14px" }}>
                        <b>{trade.symbol}</b>
                      </td>

                      <td
                        style={{
                          padding: "14px",
                          color: getTypeColor(
                            trade.type
                          ),
                          fontWeight: "bold",
                        }}
                      >
                        {trade.type}
                      </td>

                      <td style={{ padding: "14px" }}>
                        {quantity}
                      </td>

                      <td style={{ padding: "14px" }}>
                        {formatMoney(trade.price)}
                      </td>

                      <td style={{ padding: "14px" }}>
                        <b>
                          {formatMoney(total)}
                        </b>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Dashboard;