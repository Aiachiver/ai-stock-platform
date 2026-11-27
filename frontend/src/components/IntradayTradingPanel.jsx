import React, { useEffect, useMemo, useState } from "react";
import Chart from "react-apexcharts";
import API from "../services/api";

const TIMEFRAMES = [1, 5, 15, 30];
const money = (value) => Number.isFinite(Number(value)) ? "$" + Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";

function aggregateCandles(candles, minutes) {
  if (minutes === 1) return candles;
  const buckets = new Map();
  candles.forEach((candle) => {
    const stamp = new Date(candle.time).getTime();
    const key = Math.floor(stamp / (minutes * 60000));
    const current = buckets.get(key);
    if (!current) buckets.set(key, { ...candle, _stamp: stamp });
    else {
      current.high = Math.max(current.high, candle.high);
      current.low = Math.min(current.low, candle.low);
      current.close = candle.close;
      current.volume += candle.volume || 0;
      current.time = candle.time;
    }
  });
  return Array.from(buckets.values()).sort((a, b) => a._stamp - b._stamp);
}

function IntradayTradingPanel({ symbol }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeframe, setTimeframe] = useState(1);
  const activeSymbol = symbol;
  const [lastRefresh, setLastRefresh] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async (quiet = false) => {
      if (!quiet && active) setLoading(true);
      try {
        const response = await API.get(`/intraday/${activeSymbol}`, { timeout: 15000 });
        if (!active) return;
        setData(response.data);
        setError("");
        setLastRefresh(new Date());
      } catch {
        if (!active) return;
        setError("Intraday data is unavailable right now. The provider may be closed, delayed or rate-limited.");
      } finally {
        if (active && !quiet) setLoading(false);
      }
    };
    load(false);
    const timer = setInterval(() => load(true), 20000);
    return () => { active = false; clearInterval(timer); };
  }, [activeSymbol]);

  const candles = useMemo(() => aggregateCandles(data?.candles || [], timeframe), [data, timeframe]);
  const candleSeries = useMemo(() => [{
    name: activeSymbol,
    data: candles.map((c) => ({ x: new Date(c.time).getTime(), y: [c.open, c.high, c.low, c.close] }))
  }], [candles, activeSymbol]);
  const volumeSeries = useMemo(() => [{
    name: "Volume",
    data: candles.map((c) => ({ x: new Date(c.time).getTime(), y: c.volume || 0 }))
  }], [candles]);

  const chartOptions = {
    chart: { type: "candlestick", height: 320, background: "transparent", foreColor: "#d8cbb3", toolbar: { show: true }, animations: { enabled: false } },
    theme: { mode: "dark" },
    plotOptions: { candlestick: { colors: { upward: "#16a085", downward: "#ef4444" }, wick: { useFillColor: true } } },
    xaxis: { type: "datetime", labels: { datetimeUTC: false, style: { colors: "#aaa18f" } } },
    yaxis: { tooltip: { enabled: true }, labels: { style: { colors: "#aaa18f" }, formatter: (v) => "$" + Number(v).toFixed(2) } },
    grid: { borderColor: "#514c40", strokeDashArray: 3 },
    tooltip: { theme: "dark", x: { format: "HH:mm" } },
    noData: { text: "Intraday candles unavailable" }
  };
  const volumeOptions = {
    chart: { type: "bar", height: 90, background: "transparent", foreColor: "#aaa18f", toolbar: { show: false }, sparkline: { enabled: false } },
    theme: { mode: "dark" },
    plotOptions: { bar: { columnWidth: "65%" } },
    colors: ["#64748b"],
    dataLabels: { enabled: false },
    xaxis: { type: "datetime", labels: { show: false } },
    yaxis: { labels: { show: false } },
    grid: { show: false },
    tooltip: { theme: "dark", x: { format: "HH:mm" } }
  };

  return (
    <section style={{ background: "linear-gradient(145deg,#111c31,#0b1220)", border: "1px solid #514c40", borderRadius: 16, padding: 18, margin: "0 0 24px", boxShadow: "0 10px 26px rgba(0,0,0,.2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <span style={{ color: "#38bdf8", fontSize: 11, fontWeight: 800, letterSpacing: ".12em" }}>INTRADAY MARKET TERMINAL</span>
          <h2 style={{ margin: "6px 0 3px" }}> {activeSymbol} · Stock Market</h2>
          <span style={{ color: "#aaa18f", fontSize: 12 }}>1-minute provider candles · refreshes every 20 seconds</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <strong style={{ display: "block", fontSize: 25 }}>{money(data?.current_price)}</strong>
          <span style={{ color: Number(data?.change_pct) >= 0 ? "#34d399" : "#f87171", fontSize: 13, fontWeight: 700 }}>{data?.change_pct == null ? "—" : `${Number(data.change_pct) > 0 ? "+" : ""}${data.change_pct}% today`}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "17px 0 8px" }}>
        <span style={{ color: "#aaa18f", fontSize: 12, marginRight: 4 }}>Chart interval</span>
        {TIMEFRAMES.map((minute) => <button key={minute} onClick={() => setTimeframe(minute)} style={{ border: timeframe === minute ? "1px solid #38bdf8" : "1px solid #514c40", background: timeframe === minute ? "#164e63" : "#172033", color: "white", padding: "7px 13px", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>{minute}m</button>)}
        <span style={{ color: "#64748b", fontSize: 11, marginLeft: "auto" }}>{lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : ""}</span>
      </div>

      {loading && !data ? <div style={{ padding: 35, textAlign: "center", color: "#d8cbb3" }}>Loading intraday candles…</div> : error && !data ? <div style={{ padding: 22, color: "#fbbf24" }}>{error}</div> : candles.length ? <>
        <Chart options={chartOptions} series={candleSeries} type="candlestick" height={320} />
        <div style={{ color: "#aaa18f", fontSize: 11, margin: "0 0 2px 4px" }}>TRADED VOLUME</div>
        <Chart options={volumeOptions} series={volumeSeries} type="bar" height={90} />
      </> : <div style={{ padding: 24, color: "#aaa18f" }}>No intraday candles returned by provider.</div>}

      {(() => {
        const horizons = data?.horizons || [];
        const strongest = horizons.reduce((best, item) =>
          !best || Math.abs(Number(item.up_probability_pct) - 50) > Math.abs(Number(best.up_probability_pct) - 50) ? item : best, null);
        const decision = strongest?.signal === "BUY" ? "UP BIAS" : strongest?.signal === "SELL BIAS" ? "DOWN BIAS" : "WAIT";
        const color = decision === "UP BIAS" ? "#34d399" : decision === "DOWN BIAS" ? "#f87171" : "#fbbf24";
        return <div style={{ borderTop: "1px solid #514c40", marginTop: 15, paddingTop: 17 }}>
          <div style={{ background: "#0b1220", border: "1px solid #514c40", borderRadius: 12, padding: 15 }}>
            <div style={{ color: "#aaa18f", fontSize: 11, fontWeight: 800 }}>STOCK TRADE SIGNAL · EXPERIMENTAL</div>
            <strong style={{ display: "block", color, fontSize: 24, margin: "7px 0" }}>{strongest ? decision : "WAITING FOR SIGNAL"}</strong>
            <div style={{ color: "#d8cbb3", fontSize: 12 }}>{strongest ? `Review over the next ${strongest.minutes} minutes · UP ${strongest.up_probability_pct}% · DOWN ${strongest.down_probability_pct}%` : "Signal is unavailable until market data loads."}</div>
          </div>
          <button onClick={() => setShowDetails(value => !value)} style={{ width: "100%", marginTop: 10, padding: 10, borderRadius: 8, border: "1px solid #514c40", background: "#172033", color: "white", cursor: "pointer", textAlign: "left" }}>{showDetails ? "Hide" : "Show"} detailed 5–30 minute signals {showDetails ? "−" : "+"}</button>
          {showDetails && <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 10, marginTop: 12 }}>
              {horizons.map(item => {
                const up = item.signal === "BUY";
                const down = item.signal === "SELL BIAS";
                const itemColor = up ? "#34d399" : down ? "#f87171" : "#fbbf24";
                return <div key={item.minutes} style={{ background: "#0b1220", border: `1px solid ${itemColor}55`, borderRadius: 10, padding: 12 }}>
                  <div style={{ color: "#aaa18f", fontSize: 11 }}>{item.minutes} MIN</div>
                  <strong style={{ display: "block", color: itemColor, margin: "6px 0" }}>{up ? "UP BIAS" : down ? "DOWN BIAS" : "WAIT"}</strong>
                  <div style={{ color: "#d8cbb3", fontSize: 12 }}>UP {item.up_probability_pct}% · DOWN {item.down_probability_pct}%</div>
                  <p style={{ color: "#aaa18f", fontSize: 11 }}>{item.reason}</p>
                </div>;
              })}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 12, color: "#d8cbb3", fontSize: 12 }}>
              <span>Trend: <b>{data?.indicators?.trend || "—"}</b></span>
              <span>5m momentum: <b>{data?.indicators?.momentum_5m_pct ?? "—"}%</b></span>
              <span>Fast EMA: <b>{money(data?.indicators?.ema_fast)}</b></span>
              <span>Slow EMA: <b>{money(data?.indicators?.ema_slow)}</b></span>
            </div>
          </>}
        </div>;
      })()}
      <p style={{ color: "#aaa18f", fontSize: 11, lineHeight: 1.55, margin: "15px 0 0" }}>
        {data?.data_note || "Intraday data is supplied by Yahoo Finance and may be delayed or unavailable."} {data?.signal_note || "Signals are experimental and are not financial advice."}
      </p>
    </section>
  );
}
export default IntradayTradingPanel;
