import React, { useEffect, useRef, useState } from "react";
import API, { API_BASE_URL } from "../services/api";

import StockChart from "../components/StockChart";
import TradePanel from "../components/TradePanel";
import PortfolioCharts from "../components/PortfolioCharts";
import StockOverview from "../components/StockOverview";
import TradeHistoryPage from "./TradeHistoryPage";
import ModelDetailsPage from "./ModelDetailsPage";


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
  const [advancedIntelligence, setAdvancedIntelligence] = useState(null);
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
  const [activeView, setActiveView] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const requestSequence = useRef(0);
  const premiumRequestSequence = useRef(0);
  const modelRequestSequence = useRef(0);


  // Load the selected stock chart first. Slower quote and account endpoints
  // must never hold the price chart hostage.
  const loadDashboard = async () => {
    const requestId = ++requestSequence.current;
    const selectedSymbol = symbol;
    setLoading(true);
    setStockError("");
    setStockData([]);
    setQuote(null);

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
      API.get("/portfolio/summary"),
      API.get("/me")
    ]);
    if (requestId !== requestSequence.current) return;
    const value = (index) => essentials[index].status === "fulfilled" ? essentials[index].value.data : null;
    const quoteData = value(0);
    const portfolio = value(1);
    if (quoteData && !quoteData.error) setQuote(quoteData);
    if (portfolio) {
      setDetails(portfolio.details || null);
      setPositions(Array.isArray(portfolio.positions) ? portfolio.positions : []);
      setChartData(Array.isArray(portfolio.chart) ? portfolio.chart : []);
    }
    const user = value(2);
    if (user?.username) setUsername(user.username);
    setLastUpdated(new Date());


  };

  // After a paper order, update only account data. Never reload charts or retrain models.
  const refreshPortfolio = async () => {
    try {
      const response = await API.get("/portfolio/summary");
      const portfolio = response.data || {};
      setDetails(portfolio.details || null);
      setPositions(Array.isArray(portfolio.positions) ? portfolio.positions : []);
      setChartData(Array.isArray(portfolio.chart) ? portfolio.chart : []);
      setLastUpdated(new Date());
    } catch {
      // Keep the last successful portfolio snapshot visible during provider outages.
    }
  };

  const loadHistory = async () => {
    try {
      const response = await API.get("/history");
      setHistory(Array.isArray(response.data) ? response.data : []);
    } catch {
      setHistory([]);
    }
  };

  const loadModelDetails = async (selectedSymbol = symbol) => {
    const requestId = ++modelRequestSequence.current;
    setPerformance({ loading: true });
    setPrediction({ loading: true });
    setAdvancedIntelligence({ loading: true });
    const results = await Promise.allSettled([
      API.get(`/performance/${selectedSymbol}`, { timeout: 90000 }),
      API.get(`/predict/${selectedSymbol}`, { timeout: 90000 }),
      API.get(`/intelligence/${selectedSymbol}`, { timeout: 120000 })
    ]);
    if (requestId !== modelRequestSequence.current) return;
    setPerformance(results[0].status === "fulfilled" ? results[0].value.data : { error: "Model validation is temporarily unavailable." });
    setPrediction(results[1].status === "fulfilled" ? results[1].value.data : { signal: "NO DATA", note: "Forecast is temporarily unavailable." });
    setAdvancedIntelligence(results[2].status === "fulfilled" ? results[2].value.data : { error: "Advanced intelligence is temporarily unavailable." });
    loadPremium(selectedSymbol);
  };

  // Load optional research modules independently so one provider outage
  // cannot block the core quote, chart, portfolio or prediction dashboard.
  const loadPremium = async (selectedSymbol = symbol) => {
    const requestId = ++premiumRequestSequence.current;
    setPremiumLoading(true);
    const results = await Promise.allSettled([
      API.get(`/insights/${selectedSymbol}`),
      API.get(`/backtest/${selectedSymbol}`),
      API.get("/portfolio/risk")
    ]);

    // Ignore late responses from a previously selected stock.
    if (requestId !== premiumRequestSequence.current) return;
    setInsights(results[0].status === "fulfilled" ? results[0].value.data : null);
    setBacktest(results[1].status === "fulfilled" ? results[1].value.data : null);
    setRisk(results[2].status === "fulfilled" ? results[2].value.data : null);
    setPremiumLoading(false);
  };

  // Reload core and research data when the selected symbol changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  useEffect(() => {
    if (activeView === "history") loadHistory();
    if (activeView === "models") loadModelDetails(symbol);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, symbol]);


  // WebSocket live price.
  useEffect(() => {
    let ws;

    try {
      const wsBaseUrl = API_BASE_URL
        .replace(/^https:\/\//, "wss://")
        .replace(/^http:\/\//, "ws://");

      ws = new WebSocket(`${wsBaseUrl}/ws/${symbol}`);

      setLivePrice(null);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const price = Number(data?.price);
          if (Number.isFinite(price) && price > 0) setLivePrice(price);
        } catch {
          // Ignore malformed provider messages without breaking the dashboard.
        }
      };

      ws.onerror = () => {
        // WebSocket failures are non-fatal; the REST quote remains available.
      };

      ws.onclose = () => {};

    } catch (error) {
      console.log("WEBSOCKET CONNECTION ERROR:", error);
    }

    return () => {
      if (ws && ws.readyState < WebSocket.CLOSING) {
        ws.close(1000, "Symbol changed or dashboard unmounted");
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
    if (activeView === "history") loadHistory();
    if (activeView === "models") loadModelDetails(symbol);
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
        <div style={{ position: "relative" }}>
          <button type="button" aria-label="Open navigation menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} style={{ background: "#1e293b", color: "white", border: "1px solid #334155", borderRadius: 10, padding: "10px 14px", cursor: "pointer", fontSize: 22, lineHeight: 1 }}>☰</button>
          {menuOpen && <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 20, width: 210, padding: 8, borderRadius: 12, background: "#172554", border: "1px solid #334155", boxShadow: "0 12px 30px rgba(0,0,0,.35)" }}>
            {[[ "dashboard", "📊 Dashboard" ], [ "history", "📜 Trade History" ], [ "models", "🧠 Model Details" ]].map(([view, label]) => <button key={view} type="button" onClick={() => { setActiveView(view); setMenuOpen(false); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "11px 12px", margin: "2px 0", border: 0, borderRadius: 8, cursor: "pointer", color: "white", background: activeView === view ? "#2563eb" : "transparent", fontWeight: 600 }}>{label}</button>)}
          </div>}
        </div>
      </div>

      {activeView === "history" && <TradeHistoryPage history={history} />}
      {activeView === "models" && <ModelDetailsPage symbol={symbol} prediction={prediction} performance={performance} advancedIntelligence={advancedIntelligence} insights={insights} backtest={backtest} risk={risk} premiumLoading={premiumLoading} />}
      {activeView === "dashboard" && (<>
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



      </>)}

    </div>
  );
}


export default Dashboard;
