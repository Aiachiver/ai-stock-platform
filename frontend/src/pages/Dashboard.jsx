import React, { useEffect, useState } from "react";
import API from "../services/api";

import StockChart from "../components/StockChart";
import TradePanel from "../components/TradePanel";
import PredictionBox from "../components/PredictionBox";
import PortfolioCharts from "../components/PortfolioCharts";


function Dashboard() {

  // =====================================================
  // STATES
  // =====================================================

  // Selected stock
  const [symbol, setSymbol] = useState("AAPL");

  // Stock chart data
  const [stockData, setStockData] = useState([]);

  // ML prediction
  const [prediction, setPrediction] = useState(null);

  // Current live stock price
  const [livePrice, setLivePrice] = useState(null);

  // Portfolio details
  const [details, setDetails] = useState(null);

  // Current open positions
  const [positions, setPositions] = useState([]);

  // Trade history
  const [history, setHistory] = useState([]);

  // Portfolio chart data
  const [chartData, setChartData] = useState([]);

  // Loading state
  const [loading, setLoading] = useState(false);

  // Logged-in username
  const [username, setUsername] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);


  // =====================================================
  // LOAD DASHBOARD DATA
  // =====================================================

  const loadDashboard = async () => {

    try {

      setLoading(true);

      // Load all dashboard data together
      const [
        stockRes,
        predictionRes,
        detailsRes,
        positionsRes,
        chartRes,
        historyRes,
        userRes
      ] = await Promise.all([

        // Stock chart
        API.get(`/stock/${symbol}`),

        // ML prediction
        API.get(`/predict/${symbol}`),

        // Portfolio details
        API.get("/portfolio/details"),

        // Current positions
        API.get("/portfolio/positions"),

        // Portfolio charts
        API.get("/portfolio/chart"),

        // Trade history
        API.get("/history"),

        // Logged-in user
        API.get("/me")
      ]);


      // =================================================
      // SAVE API DATA INTO STATES
      // =================================================

      setStockData(
        stockRes.data?.ohlc || []
      );

      setPrediction(
        predictionRes.data || null
      );

      setDetails(
        detailsRes.data || null
      );

      // Make sure positions is ALWAYS an array
      setPositions(
        Array.isArray(positionsRes.data)
          ? positionsRes.data
          : []
      );

      // Make sure chart data is ALWAYS an array
      setChartData(
        Array.isArray(chartRes.data)
          ? chartRes.data
          : []
      );

      // Make sure history is ALWAYS an array
      setHistory(
        Array.isArray(historyRes.data)
          ? historyRes.data
          : []
      );

      // Logged-in username
      if (userRes.data?.username) {
        setUsername(userRes.data.username);
      }
      setLastUpdated(new Date());

    } catch (error) {

      console.log(
        "DASHBOARD ERROR:",
        error
      );

    } finally {

      setLoading(false);

    }

  };


  // =====================================================
  // LOAD DATA WHEN STOCK CHANGES
  // =====================================================

  useEffect(() => {

    loadDashboard();

  }, [symbol]);


  // =====================================================
  // WEBSOCKET - LIVE PRICE
  // =====================================================

  useEffect(() => {

    let ws;

    try {

      ws = new WebSocket(
        `ws://127.0.0.1:8000/ws/${symbol}`
      );


      // When live price arrives
      ws.onmessage = (event) => {

        const data =
          JSON.parse(event.data);

        if (data.price) {

          setLivePrice(
            data.price
          );

        }

      };


      // WebSocket error
      ws.onerror = (error) => {

        console.log(
          "WEBSOCKET ERROR:",
          error
        );

      };


      // WebSocket closed
      ws.onclose = () => {

        console.log(
          "WebSocket closed"
        );

      };

    } catch (error) {

      console.log(
        "WEBSOCKET CONNECTION ERROR:",
        error
      );

    }


    // Close WebSocket when symbol changes
    return () => {

      if (ws) {

        ws.close();

      }

    };

  }, [symbol]);


  // =====================================================
  // LOGOUT
  // =====================================================

  const logout = () => {

    const confirmLogout =
      window.confirm(
        "Are you sure you want to logout?"
      );

    if (!confirmLogout) {
      return;
    }

    localStorage.removeItem("token");

    window.location.reload();

  };


  // =====================================================
  // REFRESH DASHBOARD
  // =====================================================

  const refreshDashboard = () => {
    loadDashboard();
  };

  // Portfolio percentage helpers
  const invested = Number(details?.invested || 0);
  const totalProfit = Number(details?.profit || 0);
  const totalProfitPercent = invested > 0 ? (totalProfit / invested) * 100 : 0;
  const accountValue = Number(details?.balance || 0) + Number(details?.current || 0);


  // =====================================================
  // COMMON CARD STYLE
  // =====================================================

  const cardStyle = {

    background: "#1e293b",

    padding: "20px",

    borderRadius: "12px",

    textAlign: "center",

    boxShadow:
      "0 8px 20px rgba(0,0,0,0.15)"

  };


  // =====================================================
  // PROFIT COLOR
  // =====================================================

  const getProfitColor = (value) => {

    return Number(value) >= 0
      ? "#22c55e"
      : "#ef4444";

  };


  // =====================================================
  // LOADING SCREEN
  // =====================================================

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


  // =====================================================
  // MAIN DASHBOARD
  // =====================================================

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


      {/* =================================================
          HEADER
          Username + Logout
      ================================================= */}

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

        {/* Main heading */}

        <h1
          style={{
            margin: 0
          }}
        >
          📈 AI Trading Dashboard
        </h1>


        {/* User information + logout */}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px"
          }}
        >

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



      {/* =================================================
          STOCK SELECTOR + LIVE PRICE
      ================================================= */}

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

        {/* Stock selector */}

        <select
          value={symbol}
          onChange={(e) =>
            setSymbol(e.target.value)
          }
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


        {/* Live price */}

        <div
          style={{
            background: "#1e293b",
            padding: "12px 20px",
            borderRadius: "10px"
          }}
        >

          💰 Live Price:

          {" "}

          <b>
            {livePrice
              ? `$${livePrice}`
              : "Loading..."}
          </b>

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



      {/* =================================================
          PORTFOLIO SUMMARY
      ================================================= */}

      {details && (

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "15px",
            marginBottom: "25px"
          }}
        >


          {/* Balance */}

          <div style={cardStyle}>

            <h3>💰 Balance</h3>

            <h2>
              ${details.balance}
            </h2>

          </div>


          {/* Holdings */}

          <div style={cardStyle}>

            <h3>📦 Holdings</h3>

            <h2>
              {details.holdings}
            </h2>

          </div>


          {/* Invested */}

          <div style={cardStyle}>

            <h3>💵 Invested</h3>

            <h2>
              ${details.invested}
            </h2>

          </div>


          {/* Current value */}

          <div style={cardStyle}>

            <h3>📈 Current Value</h3>

            <h2>
              ${details.current}
            </h2>

          </div>

          {/* Account value */}
          <div style={cardStyle}>
            <h3>🏦 Account Value</h3>
            <h2>${accountValue.toFixed(2)}</h2>
          </div>

          {/* Total P/L percentage */}
          <div style={cardStyle}>
            <h3>Total P/L %</h3>
            <h2 style={{ color: getProfitColor(totalProfitPercent) }}>
              {totalProfitPercent.toFixed(2)}%
            </h2>
          </div>


          {/* Realized profit */}

          <div style={cardStyle}>

            <h3>Realized P/L</h3>

            <h2
              style={{
                color:
                  getProfitColor(
                    details.realized_profit
                  )
              }}
            >
              ${details.realized_profit}
            </h2>

          </div>


          {/* Unrealized profit */}

          <div style={cardStyle}>

            <h3>Unrealized P/L</h3>

            <h2
              style={{
                color:
                  getProfitColor(
                    details.unrealized_profit
                  )
              }}
            >
              ${details.unrealized_profit}
            </h2>

          </div>


          {/* Total profit */}

          <div style={cardStyle}>

            <h3>Total P/L</h3>

            <h2
              style={{
                color:
                  getProfitColor(
                    details.profit
                  )
              }}
            >
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

      {/* =================================================
          STOCK CHART
      ================================================= */}

      <div
        style={{
          background: "#ffffff",
          padding: "20px",
          borderRadius: "12px",
          width: "90%",
          margin: "auto",
          boxSizing: "border-box"
        }}
      >

        <StockChart
          data={stockData}
        />

      </div>



      {/* =================================================
          ML PREDICTION
      ================================================= */}

      <div
        style={{
          marginTop: "20px"
        }}
      >

        <PredictionBox
          prediction={prediction}
        />

      </div>



      {/* =================================================
          TRADE PANEL
      ================================================= */}

      <div
        style={{
          marginTop: "20px"
        }}
      >

        <TradePanel
          symbol={symbol}
          refresh={refreshDashboard}
          livePrice={livePrice}
        />

      </div>



      {/* =================================================
          PORTFOLIO CHARTS
      ================================================= */}

      <PortfolioCharts
        data={chartData}
      />



      {/* =================================================
          CURRENT POSITIONS
      ================================================= */}

      <div
        style={{
          background: "#1e293b",
          padding: "20px",
          borderRadius: "12px",
          marginTop: "25px"
        }}
      >

        <h2>
          📊 Current Positions
        </h2>


        {/* No positions */}

        {positions.length === 0 ? (

          <p
            style={{
              textAlign: "center",
              color: "#94a3b8"
            }}
          >
            No open positions
          </p>

        ) : (

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "15px"
            }}
          >

            {positions.map(
              (position, index) => {

                // Use backend weighted-average P/L percentage
                const profitPercent = Number(
                  position.profit_percent ??
                  (position.average_price > 0
                    ? ((position.current_price - position.average_price) / position.average_price) * 100
                    : 0)
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

                    <h3>
                      {position.symbol}
                    </h3>


                    <p>
                      Quantity:

                      {" "}

                      <b>
                        {position.quantity}
                      </b>
                    </p>


                    <p>
                      Average Price:

                      {" "}

                      <b>
                        ${position.average_price}
                      </b>
                    </p>


                    <p>
                      Current Price:

                      {" "}

                      <b>
                        ${position.current_price}
                      </b>
                    </p>


                    <p>
                      Current Value:

                      {" "}

                      <b>
                        ${position.current_value}
                      </b>
                    </p>


                    {/* Profit */}

                    <p
                      style={{
                        color:
                          getProfitColor(
                            position.profit
                          ),
                        fontWeight: "bold"
                      }}
                    >
                      P/L: ${position.profit}
                    </p>


                    {/* Profit percentage */}

                    <p
                      style={{
                        color:
                          getProfitColor(
                            profitPercent
                          ),
                        fontWeight: "bold"
                      }}
                    >
                      P/L Percentage:

                      {" "}

                      {profitPercent.toFixed(2)}%

                    </p>

                  </div>

                );

              }
            )}

          </div>

        )}

      </div>



      {/* =================================================
          TRADE HISTORY
      ================================================= */}

      <div
        style={{
          marginTop: "30px"
        }}
      >

        <h2
          style={{
            textAlign: "center"
          }}
        >
          📜 Trade History
        </h2>


        {history.length === 0 ? (

          <p
            style={{
              textAlign: "center",
              color: "#94a3b8"
            }}
          >
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

              {/* Table heading */}

              <thead>

                <tr>

                  <th
                    style={{
                      padding: "12px"
                    }}
                  >
                    Symbol
                  </th>

                  <th
                    style={{
                      padding: "12px"
                    }}
                  >
                    Type
                  </th>

                  <th
                    style={{
                      padding: "12px"
                    }}
                  >
                    Quantity
                  </th>

                  <th
                    style={{
                      padding: "12px"
                    }}
                  >
                    Price
                  </th>

                  <th
                    style={{
                      padding: "12px"
                    }}
                  >
                    Total
                  </th>

                </tr>

              </thead>


              {/* Table body */}

              <tbody>

                {history
                  .slice()
                  .reverse()
                  .map((trade) => (

                    <tr
                      key={trade.id}
                    >

                      {/* Symbol */}

                      <td
                        style={{
                          padding: "12px"
                        }}
                      >
                        {trade.symbol}
                      </td>


                      {/* BUY / SELL */}

                      <td
                        style={{
                          padding: "12px",
                          color:
                            trade.type === "BUY"
                              ? "#22c55e"
                              : "#ef4444",
                          fontWeight: "bold"
                        }}
                      >
                        {trade.type}
                      </td>


                      {/* Quantity */}

                      <td
                        style={{
                          padding: "12px"
                        }}
                      >
                        {trade.quantity}
                      </td>


                      {/* Price */}

                      <td
                        style={{
                          padding: "12px"
                        }}
                      >
                        ${trade.price}
                      </td>


                      {/* Total */}

                      <td
                        style={{
                          padding: "12px"
                        }}
                      >

                        $
                        {(
                          trade.price *
                          (trade.quantity || 1)
                        ).toFixed(2)}

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