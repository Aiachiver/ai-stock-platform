import React, { useEffect, useMemo, useState } from "react";
import Chart from "react-apexcharts";
import API from "../services/api";

const TIMEFRAMES = [1, 5, 15, 30];
const CRYPTO_ASSETS = [{ label: "Bitcoin", symbol: "BTC-USD" }, { label: "Ethereum", symbol: "ETH-USD" }, { label: "Solana", symbol: "SOL-USD" }, { label: "XRP", symbol: "XRP-USD" }, { label: "Dogecoin", symbol: "DOGE-USD" }, { label: "BNB", symbol: "BNB-USD" }];
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
  const [marketType, setMarketType] = useState("stocks");
  const [cryptoSymbol, setCryptoSymbol] = useState("BTC-USD");
  const activeSymbol = marketType === "crypto" ? cryptoSymbol : symbol;
  const [lastRefresh, setLastRefresh] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async (quiet = false) => {
      if (!quiet && active) setLoading(true);
      try {
        const response = await API.get(`/intraday/${activeSymbol}`, { timeout: 35000 });
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
    const timer = setInterval(() => load(true), 60000);
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
    chart: { type: "candlestick", height: 320, background: "transparent", foreColor: "#cbd5e1", toolbar: { show: true }, animations: { enabled: false } },
    theme: { mode: "dark" },
    plotOptions: { candlestick: { colors: { upward: "#16a085", downward: "#ef4444" }, wick: { useFillColor: true } } },
    xaxis: { type: "datetime", labels: { datetimeUTC: false, style: { colors: "#94a3b8" } } },
    yaxis: { tooltip: { enabled: true }, labels: { style: { colors: "#94a3b8" }, formatter: (v) => "$" + Number(v).toFixed(2) } },
    grid: { borderColor: "#263449", strokeDashArray: 3 },
    tooltip: { theme: "dark", x: { format: "HH:mm" } },
    noData: { text: "Intraday candles unavailable" }
  };
  const volumeOptions = {
    chart: { type: "bar", height: 90, background: "transparent", foreColor: "#94a3b8", toolbar: { show: false }, sparkline: { enabled: false } },
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
    <section style={{ background: "linear-gradient(145deg,#111c31,#0b1220)", border: "1px solid #334155", borderRadius: 16, padding: 18, margin: "0 0 24px", boxShadow: "0 10px 26px rgba(0,0,0,.2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <span style={{ color: "#38bdf8", fontSize: 11, fontWeight: 800, letterSpacing: ".12em" }}>INTRADAY MARKET TERMINAL</span>
          <h2 style={{ margin: "6px 0 3px" }}> {activeSymbol} · {marketType === "crypto" ? "Crypto Market" : "Stock Market"}</h2>
          <span style={{ color: "#94a3b8", fontSize: 12 }}>1-minute provider candles · auto-refresh every 60 seconds</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <strong style={{ display: "block", fontSize: 25 }}>{money(data?.current_price)}</strong>
          <span style={{ color: Number(data?.change_pct) >= 0 ? "#34d399" : "#f87171", fontSize: 13, fontWeight: 700 }}>{data?.change_pct == null ? "—" : `${Number(data.change_pct) > 0 ? "+" : ""}${data.change_pct}% today`}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "17px 0 8px" }}>
        <select aria-label="Market type" value={marketType} onChange={(event) => setMarketType(event.target.value)} style={{ background: "#172033", color: "white", border: "1px solid #334155", padding: "8px 10px", borderRadius: 8 }}><option value="stocks">Stocks</option><option value="crypto">Crypto</option></select>
        {marketType === "crypto" && <select aria-label="Crypto asset" value={cryptoSymbol} onChange={(event) => setCryptoSymbol(event.target.value)} style={{ background: "#172033", color: "white", border: "1px solid #334155", padding: "8px 10px", borderRadius: 8 }}>{CRYPTO_ASSETS.map((asset) => <option key={asset.symbol} value={asset.symbol}>{asset.label} ({asset.symbol})</option>)}</select>}
        <span style={{ color: "#94a3b8", fontSize: 12, marginRight: 4 }}>Chart interval</span>
        {TIMEFRAMES.map((minute) => <button key={minute} onClick={() => setTimeframe(minute)} style={{ border: timeframe === minute ? "1px solid #38bdf8" : "1px solid #334155", background: timeframe === minute ? "#164e63" : "#172033", color: "white", padding: "7px 13px", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>{minute}m</button>)}
        <span style={{ color: "#64748b", fontSize: 11, marginLeft: "auto" }}>{lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : ""}</span>
      </div>

      {loading && !data ? <div style={{ padding: 35, textAlign: "center", color: "#cbd5e1" }}>Loading intraday candles…</div> : error && !data ? <div style={{ padding: 22, color: "#fbbf24" }}>{error}</div> : candles.length ? <>
        <Chart options={chartOptions} series={candleSeries} type="candlestick" height={320} />
        <div style={{ color: "#94a3b8", fontSize: 11, margin: "0 0 2px 4px" }}>TRADED VOLUME</div>
        <Chart options={volumeOptions} series={volumeSeries} type="bar" height={90} />
      </> : <div style={{ padding: 24, color: "#94a3b8" }}>No intraday candles returned by provider.</div>}

      <div style={{ borderTop: "1px solid #263449", marginTop: 15, paddingTop: 17 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div><h3 style={{ margin: 0 }}>Next 5–30 minute direction</h3><p style={{ margin: "5px 0 0", color: "#94a3b8", fontSize: 12 }}>Technical momentum score · not a calibrated ML probability</p></div>
          <span style={{ color: "#94a3b8", fontSize: 11 }}>Refreshes with intraday data</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 10, marginTop: 14 }}>
          {(data?.horizons || []).map((item) => {
            const up = item.signal === "BUY";
            const down = item.signal === "SELL BIAS";
            const color = up ? "#34d399" : down ? "#f87171" : "#fbbf24";
            return <div key={item.minutes} style={{ background: "#0b1220", border: `1px solid ${color}55`, borderRadius: 11, padding: 13 }}>
              <div style={{ color: "#94a3b8", fontSize: 11 }}>{item.minutes} MIN FORECAST</div>
              <strong style={{ display: "block", color, fontSize: 17, margin: "7px 0" }}>{item.signal}</strong>
              <div style={{ fontSize: 12, color: "#cbd5e1" }}>UP {item.up_probability_pct}%</div>
              <div style={{ height: 6, background: "#293548", borderRadius: 8, overflow: "hidden", margin: "7px 0" }}><div style={{ width: `${item.up_probability_pct}%`, height: "100%", background: color }} /></div>
              <div style={{ fontSize: 12, color: "#cbd5e1" }}>DOWN {item.down_probability_pct}%</div>
              <p style={{ color: "#94a3b8", fontSize: 11, lineHeight: 1.45, margin: "9px 0 0" }}>{item.reason}</p>
            </div>;
          })}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 13, color: "#cbd5e1", fontSize: 12 }}>
          <span>Trend: <b style={{ color: data?.indicators?.trend === "UP" ? "#34d399" : "#f87171" }}>{data?.indicators?.trend || "—"}</b></span>
          <span>5m momentum: <b>{data?.indicators?.momentum_5m_pct ?? "—"}%</b></span>
          <span>Fast EMA: <b>{money(data?.indicators?.ema_fast)}</b></span>
          <span>Slow EMA: <b>{money(data?.indicators?.ema_slow)}</b></span>
        </div>
      </div>
      <p style={{ color: "#94a3b8", fontSize: 11, lineHeight: 1.55, margin: "15px 0 0" }}>
        {data?.data_note || "Intraday data is supplied by Yahoo Finance and may be delayed or unavailable."} {data?.signal_note || "Signals are experimental and are not financial advice."}
      </p>
    </section>
  );
}
export default IntradayTradingPanel;
