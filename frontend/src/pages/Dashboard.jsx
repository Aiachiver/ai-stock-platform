import React, { useEffect, useRef, useState } from "react";
import API, { API_BASE_URL } from "../services/api";

import StockChart from "../components/StockChart";
import TradePanel from "../components/TradePanel";
import PredictionBox from "../components/PredictionBox";
import PortfolioCharts from "../components/PortfolioCharts";
import StockOverview from "../components/StockOverview";
import PredictionPerformance from "../components/PredictionPerformance";
import PremiumAnalytics from "../components/PremiumAnalytics";
import PortfolioRisk from "../components/PortfolioRisk";


function Dashboard() {

  // Selected stock
  const [symbol, setSymbol] = useState("AAPL");

  // Stock chart data
  const [stockData, setStockData] = useState([]);
  const [stockError, setStockError] = useState("");

  // ML prediction
  const [prediction, setPrediction] = useState(null);

  // Current live stock price and market quote
  const [livePrice, setLivePrice] = useState(null);
  const [quote, setQuote] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [insights, setInsights] = useState(null);
  const [backtest, setBacktest] = useState(null);
  const [risk, setRisk] = useState(null);
  const [premiumLoading, setPremiumLoading] = useState(false);

  // Portfolio details
  const [details, setDetails] = useState(null);
  const [positions, setPositions] = useState([]);
  const [history, setHistory] = useState([]);
  const [chartData, setChartData] = useState([]);

  // Loading state
  const [loading, setLoading] = useState(false);

  // Logged-in username and update time
  const [username, setUsername] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const requestSequence = useRef(0);


  // Load the selected stock chart first. Slower quote and account endpoints
  // must never hold the price chart hostage.
  const loadDashboard = async () => {
    const requestId = ++requestSequence.current;
    const selectedSymbol = symbol;
    setLoading(true);
    setStockError("");
    setStockData([]);
    setQuote(null);
    setPrediction(null);
    setPerformance(null);

    try {
      const stockResponse = await API.get(`/stock/${selectedSymbol}`);
      if (requestId !== requestSequence.current) return;
      const stock = stockResponse.data || {};
      const bars = Array.isArray(stock.ohlc) ? stock.ohlc : [];
      setStockData(bars);
      setStockError(stock.error || (bars.length ? "" : "Historical price data is unavailable from the provider."));
      // Keep a useful market snapshot visible even if the separate quote endpoint fails.
      const latest = bars[bars.length - 1];
      const previous = bars[bars.length - 2];
      if (latest) {
        const change = previous ? Number(latest.close) - Number(previous.close) : null;
        setQuote({
          symbol: selectedSymbol,
          company_name: selectedSymbol,
          price: Number(latest.close),
          previous_close: previous ? Number(previous.close) : null,
          change,
          change_percent: previous?.close ? (change / Number(previous.close)) * 100 : null,
          open: Number(latest.open),
          day_high: Number(latest.high),
          day_low: Number(latest.low),
          currency: "USD",
          data_note: "Historical daily data · Yahoo Finance"
        });
      }
    } catch (error) {
      if (requestId === requestSequence.current) {
        setStockData([]);
        setStockError("Could not load historical prices. Please retry in a moment.");
      }
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }

    const essentials = await Promise.allSettled([
      API.get(`/quote/${selectedSymbol}`),
      API.get("/portfolio/details"),
      API.get("/portfolio/positions"),
      API.get("/portfolio/chart"),
      API.get("/history"),
      API.get("/me")
    ]);
    if (requestId !== requestSequence.current) return;
    const value = (index) => essentials[index].status === "fulfilled" ? essentials[index].value.data : null;
    const quoteData = value(0);
    if (quoteData && !quoteData.error) setQuote(quoteData);
    if (value(1)) setDetails(value(1));
    setPositions(Array.isArray(value(2)) ? value(2) : []);
    setChartData(Array.isArray(value(3)) ? value(3) : []);
    setHistory(Array.isArray(value(4)) ? value(4) : []);
    const user = value(5);
    if (user?.username) setUsername(user.username);
    setLastUpdated(new Date());

    // Research calls are intentionally independent from the primary price chart.
    const research = await Promise.allSettled([
      API.get(`/performance/${selectedSymbol}`),
      API.get(`/predict/${selectedSymbol}`)
    ]);
    if (requestId !== requestSequence.current) return;
    setPerformance(research[0].status === "fulfilled"
      ? research[0].value.data
      : { error: "Model evaluation is temporarily unavailable." });
    setPrediction(research[1].status === "fulfilled"
      ? research[1].value.data
      : { signal: "NO DATA", note: "Forecast is temporarily unavailable." });
  };

  // After a paper order, update only account data. Never reload charts or retrain models.
  const refreshPortfolio = async () => {
    const results = await Promise.allSettled([
      API.get("/portfolio/details"),
      API.get("/portfolio/positions"),
      API.get("/portfolio/chart"),
      API.get("/history")
    ]);
    if (results[0].status === "fulfilled") setDetails(results[0].value.data);
    if (results[1].status === "fulfilled") setPositions(Array.isArray(results[1].value.data) ? results[1].value.data : []);
    if (results[2].status === "fulfilled") setChartData(Array.isArray(results[2].value.data) ? results[2].value.data : []);
    if (results[3].status === "fulfilled") setHistory(Array.isArray(results[3].value.data) ? results[3].value.data : []);
    setLastUpdated(new Date());
  };

  // Load optional research modules independently so one provider outage
  // cannot block the core quote, chart, portfolio or prediction dashboard.
  const loadPremium = async () => {
    setPremiumLoading(true);
    const results = await Promise.allSettled([
      API.get(`/insights/${symbol}`),
      API.get(`/backtest/${symbol}`),
      API.get("/portfolio/risk")
    ]);
    if (results[0].status === "fulfilled") setInsights(results[0].value.data);
    if (results[1].status === "fulfilled") setBacktest(results[1].value.data);
    if (results[2].status === "fulfilled") setRisk(results[2].value.data);
    setPremiumLoading(false);
  };

  // Reload core and research data when the selected symbol changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadDashboard();
    loadPremium();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);


  // WebSocket live price.
  useEffect(() => {
    let ws;

    try {
      const wsBaseUrl = API_BASE_URL
        .replace(/^https:\/\//, "wss://")
        .replace(/^http:\/\//, "ws://");

      ws = new WebSocket(`${wsBaseUrl}/ws/${symbol}`);

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


  // Logout
  const logout = () => {
    const confirmLogout = window.confirm("Are you sure you want to logout?");
    if (!confirmLogout) return;

    localStorage.removeItem("token");
    window.location.reload();
  };


  // Refresh dashboard
  const refreshDashboard = () => {
    loadDashboard();
    loadPremium();
  };


  // Portfolio percentage helpers
  const invested = Number(details?.invested || 0);
  const totalProfit = Number(details?.profit || 0);
  const totalProfitPercent = invested > 0 ? (totalProfit / invested) * 100 : 0;
  const accountValue = Number(details?.balance || 0) + Number(details?.current || 0);


  // Common card style
  const cardStyle = {
    background: "#1e293b",
    padding: "20px",
    borderRadius: "12px",
    textAlign: "center",
    boxShadow: "0 8px 20px rgba(0,0,0,0.15)"
  };


  // Profit color
  const getProfitColor = (value) => {
    return Number(value) >= 0 ? "#22c55e" : "#ef4444";
  };


  // Loading screen
  if (loading && !details) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0f172a",
          color: "white",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: "22px"
        }}
      >
        Loading Dashboard...
      </div>
    );
  }


  // Main dashboard
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "white",
        padding: "25px",
        boxSizing: "border-box"
      }}
    >

      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "15px",
          marginBottom: "25px"
        }}
      >
        <h1 style={{ margin: 0 }}>📈 AI Trading Dashboard</h1>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              background: "#1e293b",
              padding: "10px 16px",
              borderRadius: "10px",
              fontWeight: "bold"
            }}
          >
            👤 {username}
          </div>

          <button
            onClick={logout}
            style={{
              background: "#ef4444",
              color: "white",
              border: "none",
              padding: "10px 18px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            Logout
          </button>
        </div>
      </div>


      <div style={{
        background: "#172554", border: "1px solid #1d4ed8", borderRadius: 12,
        padding: "12px 16px", marginBottom: 20, color: "#dbeafe",
        fontSize: 13, lineHeight: 1.6
      }}>
        <strong>Research workspace · Paper trading only.</strong>{" "}
        No real brokerage orders are sent. Quotes may be delayed; model signals,
        headline sentiment and historical simulations are experimental and are not investment advice.
      </div>

      {/* STOCK SELECTOR + LIVE PRICE */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "20px",
          flexWrap: "wrap",
          marginBottom: "25px"
        }}
      >
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          style={{
            padding: "12px",
            borderRadius: "8px",
            fontSize: "16px",
            border: "none",
            outline: "none"
          }}
        >
          <option value="AAPL">AAPL</option>
          <option value="TSLA">TSLA</option>
          <option value="GOOGL">GOOGL</option>
          <option value="MSFT">MSFT</option>
          <option value="AMZN">AMZN</option>
          <option value="META">META</option>
          <option value="NVDA">NVDA</option>
          <option value="NFLX">NFLX</option>
          <option value="JPM">JPM</option>
          <option value="WMT">WMT</option>
        </select>

        <div
          style={{
            background: "#1e293b",
            padding: "12px 20px",
            borderRadius: "10px"
          }}
        >
          💰 Live Price:{" "}
          <b>{livePrice ? `$${livePrice}` : "Loading..."}</b>
        </div>

        <button
          onClick={refreshDashboard}
          disabled={loading}
          style={{
            background: loading ? "#475569" : "#2563eb",
            color: "white",
            border: "none",
            padding: "12px 18px",
            borderRadius: "10px",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: "bold"
          }}
        >
          {loading ? "Refreshing..." : "↻ Refresh"}
        </button>
      </div>


      <StockOverview quote={quote} livePrice={livePrice} />


      {/* PORTFOLIO SUMMARY */}
      {details && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "15px",
            marginBottom: "25px"
          }}
        >
          <div style={cardStyle}>
            <h3>💰 Balance</h3>
            <h2>${details.balance}</h2>
          </div>

          <div style={cardStyle}>
            <h3>📦 Holdings</h3>
            <h2>{details.holdings}</h2>
          </div>

          <div style={cardStyle}>
            <h3>💵 Invested</h3>
            <h2>${details.invested}</h2>
          </div>

          <div style={cardStyle}>
            <h3>📈 Current Value</h3>
            <h2>${details.current}</h2>
          </div>

          <div style={cardStyle}>
            <h3>🏦 Account Value</h3>
            <h2>${accountValue.toFixed(2)}</h2>
          </div>

          <div style={cardStyle}>
            <h3>Total P/L %</h3>
            <h2 style={{ color: getProfitColor(totalProfitPercent) }}>
              {totalProfitPercent.toFixed(2)}%
            </h2>
          </div>

          <div style={cardStyle}>
            <h3>Realized P/L</h3>
            <h2 style={{ color: getProfitColor(details.realized_profit) }}>
              ${details.realized_profit}
            </h2>
          </div>

          <div style={cardStyle}>
            <h3>Unrealized P/L</h3>
            <h2 style={{ color: getProfitColor(details.unrealized_profit) }}>
              ${details.unrealized_profit}
            </h2>
          </div>

          <div style={cardStyle}>
            <h3>Total P/L</h3>
            <h2 style={{ color: getProfitColor(details.profit) }}>
              ${details.profit}
            </h2>
          </div>
        </div>
      )}


      {lastUpdated && (
        <p
          style={{
            textAlign: "center",
            color: "#64748b",
            margin: "-10px 0 20px"
          }}
        >
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}


      {/* STOCK CHART */}
      <div
        style={{
          background: "#1e293b",
          padding: "20px",
          border: "1px solid #334155",
          borderRadius: "12px",
          width: "100%",
          margin: "auto",
          boxSizing: "border-box"
        }}
      >
        <StockChart data={stockData} error={stockError} symbol={symbol} />
      </div>


      {/* ML PREDICTION */}
      <div style={{ marginTop: "20px" }}>
        <PredictionBox prediction={prediction} />
        <PredictionPerformance data={performance} />
      </div>


      {/* TRADE PANEL */}
      <div style={{ marginTop: "20px" }}>
        <TradePanel
          symbol={symbol}
          refresh={refreshPortfolio}
          livePrice={livePrice}
        />
      </div>


      {/* PORTFOLIO CHARTS */}
      <PortfolioCharts data={chartData} />

      {/* RESEARCH AND RISK TOOLS */}
      <PremiumAnalytics insights={insights} backtest={backtest} loading={premiumLoading} />
      <PortfolioRisk data={risk} loading={premiumLoading} />


      {/* CURRENT POSITIONS */}
      <div
        style={{
          background: "#1e293b",
          padding: "20px",
          borderRadius: "12px",
          marginTop: "25px"
        }}
      >
        <h2>📊 Current Positions</h2>

        {positions.length === 0 ? (
          <p style={{ textAlign: "center", color: "#94a3b8" }}>
            No open positions
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "15px"
            }}
          >
            {positions.map((position, index) => {
              // Use backend weighted-average P/L percentage.
              const profitPercent = Number(
                position.profit_percent ??
                (
                  position.average_price > 0
                    ? ((position.current_price - position.average_price) /
                      position.average_price) * 100
                    : 0
                )
              );

              return (
                <div
                  key={index}
                  style={{
                    background: "#0f172a",
                    padding: "18px",
                    borderRadius: "10px"
                  }}
                >
                  <h3>{position.symbol}</h3>

                  <p>Quantity: <b>{position.quantity}</b></p>
                  <p>Average Price: <b>${position.average_price}</b></p>
                  <p>Current Price: <b>${position.current_price}</b></p>
                  <p>Current Value: <b>${position.current_value}</b></p>

                  <p
                    style={{
                      color: getProfitColor(position.profit),
                      fontWeight: "bold"
                    }}
                  >
                    P/L: ${position.profit}
                  </p>

                  <p
                    style={{
                      color: getProfitColor(profitPercent),
                      fontWeight: "bold"
                    }}
                  >
                    P/L Percentage: {profitPercent.toFixed(2)}%
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>


      {/* TRADE HISTORY */}
      <div style={{ marginTop: "30px" }}>
        <h2 style={{ textAlign: "center" }}>📜 Trade History</h2>

        {history.length === 0 ? (
          <p style={{ textAlign: "center", color: "#94a3b8" }}>
            No trades yet
          </p>
        ) : (
          <div
            style={{
              width: "95%",
              margin: "auto",
              background: "#1e293b",
              borderRadius: "12px",
              padding: "20px",
              overflowX: "auto"
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "center"
              }}
            >
              <thead>
                <tr>
                  <th style={{ padding: "12px" }}>Symbol</th>
                  <th style={{ padding: "12px" }}>Type</th>
                  <th style={{ padding: "12px" }}>Quantity</th>
                  <th style={{ padding: "12px" }}>Price</th>
                  <th style={{ padding: "12px" }}>Total</th>
                </tr>
              </thead>

              <tbody>
                {history.slice().reverse().map((trade) => (
                  <tr key={trade.id}>
                    <td style={{ padding: "12px" }}>{trade.symbol}</td>
                    <td
                      style={{
                        padding: "12px",
                        color: trade.type === "BUY" ? "#22c55e" : "#ef4444",
                        fontWeight: "bold"
                      }}
                    >
                      {trade.type}
                    </td>
                    <td style={{ padding: "12px" }}>{trade.quantity}</td>
                    <td style={{ padding: "12px" }}>${trade.price}</td>
                    <td style={{ padding: "12px" }}>
                      ${(trade.price * (trade.quantity || 1)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}


export default Dashboard;
