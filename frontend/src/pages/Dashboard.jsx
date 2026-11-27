import React, { useEffect, useRef, useState } from "react";
import API, { API_BASE_URL } from "../services/api";

import StockChart from "../components/StockChart";
import TradePanel from "../components/TradePanel";
import PortfolioCharts from "../components/PortfolioCharts";
import StockOverview from "../components/StockOverview";
import IntradayTradingPanel from "../components/IntradayTradingPanel";
import CryptoTradingPage from "./CryptoTradingPage";
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
  const [dashboardForecast, setDashboardForecast] = useState(null);
  const [quickSignalLoading, setQuickSignalLoading] = useState(false);

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
  const [theme, setTheme] = useState(() => localStorage.getItem("tradesight-theme") || "light");
  const [menuOpen, setMenuOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const requestSequence = useRef(0);
  const premiumRequestSequence = useRef(0);
  const modelRequestSequence = useRef(0);
  const quickSignalRequestSequence = useRef(0);


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

  // Keep the dashboard's primary signal lightweight. Full model comparison,
  // holdout evaluation and advanced intelligence run only in the Models view.
  useEffect(() => {
    if (activeView !== "dashboard") return;
    const requestId = ++quickSignalRequestSequence.current;
    setQuickSignalLoading(true);
    setDashboardForecast(null);

    API.get(`/predict/${symbol}`, { timeout: 45000 })
      .then((response) => {
        if (requestId === quickSignalRequestSequence.current) {
          setDashboardForecast(response.data || {});
        }
      })
      .catch(() => {
        if (requestId === quickSignalRequestSequence.current) {
          setDashboardForecast({ error: "Quick forecast temporarily unavailable." });
        }
      })
      .finally(() => {
        if (requestId === quickSignalRequestSequence.current) setQuickSignalLoading(false);
      });

    return () => { quickSignalRequestSequence.current += 1; };
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


  // Persist the selected appearance across visits.
  const toggleTheme = () => {
    setTheme((current) => {
      const next = current === "light" ? "dark" : "light";
      localStorage.setItem("tradesight-theme", next);
      return next;
    });
  };

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
    background: "#182322",
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
          background: "#0b1118",
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
    <div className={`app-shell dashboard-shell theme-${theme}`}
      style={{
        minHeight: "100vh",
        background: "#0b1118",
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

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            style={{
              background: "var(--surface)",
              color: "var(--ink)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              padding: "10px 13px",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 700
            }}
          >
            {theme === "light" ? "🌙 Dark mode" : "☀️ Light mode"}
          </button>
          <div style={{ position: "relative" }}>
          <button
            type="button"
            aria-label="Open navigation and account menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            style={{
              background: "#182322",
              color: "white",
              border: "1px solid #514c40",
              borderRadius: 10,
              padding: "10px 14px",
              cursor: "pointer",
              fontSize: 22,
              lineHeight: 1
            }}
          >
            ☰
          </button>
          {menuOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 8px)",
                zIndex: 20,
                width: 230,
                padding: 8,
                borderRadius: 12,
                background: "#202b2b",
                border: "1px solid #514c40",
                boxShadow: "0 12px 30px rgba(0,0,0,.35)"
              }}
            >
              <div
                style={{
                  padding: "11px 12px",
                  margin: "2px 0 8px",
                  borderBottom: "1px solid #514c40",
                  color: "#d8cbb3",
                  fontWeight: 700
                }}
              >
                👤 {username || "Account"}
              </div>
              {[[ "dashboard", "📊 Dashboard" ], [ "crypto", "₿ Crypto Terminal" ], [ "history", "📜 Trade History" ], [ "models", "🧠 Model Details" ]].map(([view, label]) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => { setActiveView(view); setMenuOpen(false); }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "11px 12px",
                    margin: "2px 0",
                    border: 0,
                    borderRadius: 8,
                    cursor: "pointer",
                    color: "white",
                    background: activeView === view ? "#96794a" : "transparent",
                    fontWeight: 600
                  }}
                >
                  {label}
                </button>
              ))}
              <div style={{ borderTop: "1px solid #514c40", margin: "8px 0" }} />
              <button
                type="button"
                onClick={() => { setMenuOpen(false); logout(); }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "11px 12px",
                  border: 0,
                  borderRadius: 8,
                  cursor: "pointer",
                  color: "white",
                  background: "#dc2626",
                  fontWeight: 700
                }}
              >
                ↪ Logout
              </button>
            </div>
          )}
          </div>
        </div>
      </div>

      {activeView === "crypto" && <CryptoTradingPage />}
      {activeView === "history" && <TradeHistoryPage history={history} />}
      {activeView === "models" && <ModelDetailsPage symbol={symbol} prediction={prediction} performance={performance} advancedIntelligence={advancedIntelligence} insights={insights} backtest={backtest} risk={risk} premiumLoading={premiumLoading} />}
      {activeView === "dashboard" && (<>
      <div style={{
        background: "#202b2b", border: "1px solid #66583f", borderRadius: 12,
        padding: "12px 16px", marginBottom: 20, color: "#eee5d5",
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
            background: "#182322",
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
            background: loading ? "#625840" : "#96794a",
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

      <IntradayTradingPanel symbol={symbol} />

      {/* QUICK AI DECISION: lightweight forecast; full validation is available in Models */}
      {(() => {
        const validated = null;
        const fastSignal = String(dashboardForecast?.signal || "").toUpperCase();
        const finalDecision = validated?.decision;
        const displayDecision = finalDecision
          ? (finalDecision.includes("BUY") ? "BUY" : finalDecision.includes("BEARISH") ? "SELL BIAS · AVOID" : "NO TRADE")
          : fastSignal === "BUY" ? "BUY · EARLY SIGNAL"
          : fastSignal === "SELL" ? "SELL · EARLY SIGNAL"
          : fastSignal === "HOLD" ? "NO TRADE · WAIT"
          : "WAITING FOR SIGNAL";
        const decisionColor = displayDecision.startsWith("BUY") ? "#4ade80"
          : displayDecision.startsWith("SELL") ? "#f87171" : "#fbbf24";
        const hasFastForecast = dashboardForecast && !dashboardForecast.error && dashboardForecast.signal !== "NO DATA";
        const hasAdvancedDecision = Boolean(finalDecision);
        const confidence = validated?.confidence_pct;
        const threshold = validated?.threshold_pct ?? 60;
        const move = dashboardForecast?.predicted_return_pct;
        const explain = hasAdvancedDecision
          ? finalDecision === "NO TRADE"
            ? `Confidence is ${confidence ?? "below"}% and the required threshold is ${threshold}%. The model is not confident enough, so waiting is the safer model output.`
            : finalDecision.includes("BUY")
              ? `The calibrated UP probability crossed the ${threshold}% threshold. This is a research signal, not a guarantee.`
              : `The calibrated DOWN probability crossed the ${threshold}% threshold. The model advises avoiding a new long position; this is not an automatic short-sale instruction.`
          : hasFastForecast
            ? `The quick model estimates a ${move == null ? "directional" : `${Number(move) > 0 ? "+" : ""}${Number(move).toFixed(3)}%`} move for the next trading session. The calibrated validation check is still running.`
            : "The forecast is being prepared. No trade signal is issued until model output is available.";
        return (
          <section style={{
            background: "linear-gradient(135deg, #202b2b 0%, #14213d 60%, #0b1118 100%)",
            border: "1px solid #36558a", borderRadius: 16, padding: 22, margin: "0 0 24px",
            boxShadow: "0 12px 30px rgba(0,0,0,.22)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
              <div>
                <span style={{ color: "#d8c29a", fontSize: 11, fontWeight: 800, letterSpacing: ".12em" }}>TRADESIGHT AI · LIVE RESEARCH SIGNAL</span>
                <h2 style={{ margin: "7px 0 4px", fontSize: 23 }}>What should I do with {symbol}?</h2>
                <p style={{ color: "#d8cbb3", margin: 0, fontSize: 13 }}>Next trading session · Paper-trading research only</p>
              </div>
              <div style={{ minWidth: 170, textAlign: "center", background: "#0b1224", border: `1px solid ${decisionColor}`, borderRadius: 13, padding: "13px 18px" }}>
                <div style={{ color: "#aaa18f", fontSize: 10, letterSpacing: ".1em", fontWeight: 800 }}>CURRENT SIGNAL</div>
                <strong style={{ display: "block", color: decisionColor, fontSize: 19, marginTop: 5 }}>{displayDecision}</strong>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 11, marginTop: 20 }}>
              {[
                ["Current price", dashboardForecast?.current_price, true],
                ["Estimated next price", dashboardForecast?.predicted_price, true],
                ["Expected move", move == null ? null : `${Number(move) > 0 ? "+" : ""}${Number(move).toFixed(3)}%`, false],
                ["Up probability", validated?.up_probability_pct == null ? null : `${validated.up_probability_pct}%`, false],
                ["Down probability", validated?.down_probability_pct == null ? null : `${validated.down_probability_pct}%`, false],
                ["Confidence / threshold", confidence == null ? null : `${confidence}% / ${threshold}%`, false]
              ].map(([label, value, isPrice]) => (
                <div key={label} style={{ background: "#0b1224", border: "1px solid #263653", borderRadius: 11, padding: 13 }}>
                  <div style={{ color: "#aaa18f", fontSize: 11 }}>{label}</div>
                  <strong style={{ display: "block", marginTop: 7, fontSize: 17 }}>
                    {value == null ? "—" : isPrice ? `$${Number(value).toFixed(2)}` : value}
                  </strong>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16, padding: 15, borderRadius: 11, background: "#0b1224", borderLeft: `3px solid ${decisionColor}` }}>
              <strong style={{ color: "#eee5d5", fontSize: 13 }}>Why this signal?</strong>
              <p style={{ color: "#d8cbb3", lineHeight: 1.6, margin: "6px 0 0", fontSize: 13 }}>{explain}</p>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 15 }}>
              <div style={{ color: "#a5b4fc", fontSize: 12 }} aria-live="polite">
                {quickSignalLoading ? "Preparing stock forecast…" : hasFastForecast ? "Quick forecast ready · Open Models for full historical validation" : "Quick forecast unavailable"}
              </div>
              <button type="button" onClick={() => setActiveView("models")} style={{ background: "#96794a", color: "white", border: 0, borderRadius: 9, padding: "10px 15px", cursor: "pointer", fontWeight: 700 }}>
                Explore full analysis →
              </button>
            </div>
            <p style={{ color: "#aaa18f", fontSize: 11, lineHeight: 1.5, margin: "13px 0 0" }}>
              Signals are experimental estimates, not guaranteed outcomes or financial advice. SELL BIAS means avoid a new long position; the platform does not execute short sales automatically.
            </p>
          </section>
        );
      })()}

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
          background: "#182322",
          padding: "20px",
          border: "1px solid #514c40",
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
          background: "#182322",
          padding: "20px",
          borderRadius: "12px",
          marginTop: "25px"
        }}
      >
        <h2>📊 Current Positions</h2>

        {positions.length === 0 ? (
          <p style={{ textAlign: "center", color: "#aaa18f" }}>
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
                    background: "#0b1118",
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
