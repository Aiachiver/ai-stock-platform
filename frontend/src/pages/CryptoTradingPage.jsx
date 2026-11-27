import React, { useEffect, useMemo, useState } from "react";
import Chart from "react-apexcharts";
import API from "../services/api";

const ASSETS = [
  { symbol: "BTC-USD", name: "Bitcoin", ticker: "BTC", color: "#f59e0b" },
  { symbol: "ETH-USD", name: "Ethereum", ticker: "ETH", color: "#a78bfa" },
  { symbol: "SOL-USD", name: "Solana", ticker: "SOL", color: "#38bdf8" },
  { symbol: "XRP-USD", name: "XRP", ticker: "XRP", color: "#94a3b8" },
  { symbol: "DOGE-USD", name: "Dogecoin", ticker: "DOGE", color: "#facc15" },
  { symbol: "BNB-USD", name: "BNB", ticker: "BNB", color: "#fbbf24" }
];
const usd = (n) => Number.isFinite(Number(n)) ? "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";

export default function CryptoTradingPage() {
  const [asset, setAsset] = useState(ASSETS[0]);
  const [data, setData] = useState(null);
  const [timeframe, setTimeframe] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [orderState, setOrderState] = useState({ loading: false, message: "", error: false });

  useEffect(() => {
    let active = true;
    const load = async (quiet = false) => {
      if (!quiet && active) setLoading(true);
      if (quiet && active) setRefreshing(true);
      try {
        const response = await API.get(`/intraday/${asset.symbol}`, { timeout: 15000 });
        if (!active) return;
        setData(response.data);
        setError("");
        setUpdatedAt(new Date());
      } catch {
        if (active) setError("Crypto candles are temporarily unavailable. The data provider may be delayed or rate-limited.");
      } finally {
        if (active && !quiet) setLoading(false);
        if (active && quiet) setRefreshing(false);
      }
    };
    setData(null);
    load(false);
    const timer = setInterval(() => load(true), 20000);
    return () => { active = false; clearInterval(timer); };
  }, [asset]);

  const candles = useMemo(() => {
    const raw = data?.candles || [];
    if (timeframe === 1) return raw;
    const buckets = new Map();
    raw.forEach((c) => {
      const stamp = new Date(c.time).getTime();
      const key = Math.floor(stamp / (timeframe * 60000));
      const existing = buckets.get(key);
      if (!existing) buckets.set(key, { ...c, _stamp: stamp });
      else {
        existing.high = Math.max(existing.high, c.high);
        existing.low = Math.min(existing.low, c.low);
        existing.close = c.close;
        existing.volume += c.volume || 0;
        existing.time = c.time;
      }
    });
    return [...buckets.values()].sort((a, b) => a._stamp - b._stamp);
  }, [data, timeframe]);

  const chartSeries = useMemo(() => [{ name: asset.ticker, data: candles.map(c => ({ x: new Date(c.time).getTime(), y: [c.open, c.high, c.low, c.close] })) }], [candles, asset]);
  const volumeSeries = useMemo(() => [{ name: "Volume", data: candles.map(c => ({ x: new Date(c.time).getTime(), y: c.volume || 0 })) }], [candles]);

  const chartOptions = {
    chart: { type: "candlestick", background: "transparent", foreColor: "#94a3b8", toolbar: { show: true }, animations: { enabled: true, speed: 350, dynamicAnimation: { enabled: true, speed: 350 } } },
    theme: { mode: "dark" },
    plotOptions: { candlestick: { colors: { upward: "#10b981", downward: "#f43f5e" }, wick: { useFillColor: true } } },
    xaxis: { type: "datetime", labels: { datetimeUTC: false } },
    yaxis: { tooltip: { enabled: true }, labels: { formatter: v => usd(v) } },
    grid: { borderColor: "#263449", strokeDashArray: 3 },
    tooltip: { theme: "dark", x: { format: "HH:mm:ss" } },
    noData: { text: "No crypto candles available" }
  };
  const volumeOptions = {
    chart: { type: "bar", background: "transparent", foreColor: "#94a3b8", toolbar: { show: false } },
    theme: { mode: "dark" }, plotOptions: { bar: { columnWidth: "65%" } },
    colors: ["#64748b"], dataLabels: { enabled: false },
    xaxis: { type: "datetime", labels: { show: false } }, yaxis: { labels: { show: false } },
    grid: { show: false }, tooltip: { theme: "dark" }
  };

  const placePaperOrder = async (side) => {
    setOrderState({ loading: true, message: "", error: false });
    try {
      const response = await API.post(`/${side.toLowerCase()}/${asset.symbol}`, null, { params: { quantity: Number(quantity) } });
      if (response.data?.error) throw new Error(response.data.error);
      setOrderState({ loading: false, message: `${side} paper order recorded: ${quantity} ${asset.ticker} at ${usd(response.data.price)}.`, error: false });
    } catch (err) {
      setOrderState({ loading: false, message: err.response?.data?.detail || err.message || "Paper order failed.", error: true });
    }
  };

  const horizons = data?.horizons || [];
  const buySignal = horizons.filter(h => h.signal === "BUY").length;
  const sellSignal = horizons.filter(h => h.signal === "SELL BIAS").length;
  const strongestSignal = horizons.reduce((best, item) => Math.abs(Number(item.up_probability_pct || 50) - 50) > Math.abs(Number(best?.up_probability_pct || 50) - 50) ? item : best, null);
  const strongestUp = Number(strongestSignal?.up_probability_pct || 50);
  const overall = strongestUp >= 60 ? "UP BIAS" : strongestUp <= 40 ? "DOWN BIAS" : "WAIT — NO CLEAR EDGE";
  const overallColor = overall === "UP BIAS" ? "#34d399" : overall === "DOWN BIAS" ? "#fb7185" : "#fbbf24";
  const decisionText = overall === "UP BIAS" ? `Upward movement has the stronger technical signal over the next ${strongestSignal?.minutes} minutes.` : overall === "DOWN BIAS" ? `Downward movement has the stronger technical signal over the next ${strongestSignal?.minutes} minutes.` : "Signals are mixed or weak. Waiting is safer than forcing a trade.";

  return (
    <main style={{ minHeight: "100vh", background: "#080f1d", color: "#e5edf8", padding: "clamp(12px,2vw,26px)", boxSizing: "border-box" }}>
      <div style={{ maxWidth: 1500, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
          <div><div style={{ color: "#38bdf8", fontSize: 11, fontWeight: 900, letterSpacing: ".16em" }}>TRADESIGHT AI / DIGITAL ASSETS</div><h1 style={{ margin: "6px 0", fontSize: 28 }}>Crypto Trading Terminal</h1><p style={{ color: "#94a3b8", margin: 0 }}>24/7 crypto market research · paper trading only</p></div>
          <div style={{ background: "#142237", border: `1px solid ${overallColor}66`, padding: "12px 16px", borderRadius: 12, minWidth: 220 }}><div style={{ color: "#94a3b8", fontSize: 11 }}>CURRENT AI VIEW</div><b style={{ color: overallColor, fontSize: 16 }}>{data ? overall : "CALCULATING…"}</b><div style={{ color: "#94a3b8", fontSize: 11, marginTop: 5 }}>{data && strongestSignal ? `Strongest window: ${strongestSignal.minutes} min` : "Waiting for market data"}</div></div>
        </header>

        <nav style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 9, marginBottom: 16 }}>
          {ASSETS.map(item => <button key={item.symbol} onClick={() => setAsset(item)} style={{ textAlign: "left", background: asset.symbol === item.symbol ? "#17304a" : "#111c2e", border: asset.symbol === item.symbol ? `1px solid ${item.color}` : "1px solid #263449", color: "white", borderRadius: 11, padding: 12, cursor: "pointer" }}><span style={{ color: item.color, fontWeight: 900 }}>{item.ticker}</span><span style={{ display: "block", color: "#94a3b8", fontSize: 11, marginTop: 4 }}>{item.name}</span></button>)}
        </nav>

        <section style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(260px,1fr)", gap: 14, marginBottom: 15 }}>
          <div style={{ background: "linear-gradient(140deg,#14243a,#0d1728)", border: "1px solid #2b405b", borderRadius: 15, padding: 17 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><span style={{ color: "#94a3b8", fontSize: 11 }}>SELECTED MARKET</span><h2 style={{ margin: "5px 0" }}>{asset.name} <span style={{ color: "#94a3b8", fontSize: 14 }}>{asset.ticker}/USD</span></h2></div><div style={{ textAlign: "right" }}><strong style={{ fontSize: 27 }}>{usd(data?.current_price)}</strong><div style={{ color: Number(data?.change_pct) >= 0 ? "#34d399" : "#fb7185", fontSize: 13 }}>{data?.change_pct == null ? "—" : `${data.change_pct > 0 ? "+" : ""}${data.change_pct}% today`}</div></div></div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", margin: "14px 0" }}>{[1,5,15,30].map(m => <button key={m} onClick={() => setTimeframe(m)} style={{ padding: "7px 13px", borderRadius: 8, border: timeframe === m ? "1px solid #38bdf8" : "1px solid #34445b", background: timeframe === m ? "#164e63" : "#172235", color: "white", cursor: "pointer" }}>{m}m candles</button>)}<span style={{ marginLeft: "auto", color: "#64748b", fontSize: 11, alignSelf: "center" }}>{updatedAt ? `${refreshing ? "Updating… · " : "Updated "}${updatedAt.toLocaleTimeString()}` : ""}</span></div>
            {loading && !data ? <div style={{ padding: 60, textAlign: "center" }}>Loading crypto market data…</div> : error && !data ? <div style={{ padding: 25, color: "#fbbf24" }}>{error}</div> : candles.length ? <><Chart type="candlestick" height={340} options={chartOptions} series={chartSeries}/><div style={{ color: "#94a3b8", fontSize: 10, letterSpacing: ".1em" }}>VOLUME</div><Chart type="bar" height={85} options={volumeOptions} series={volumeSeries}/></> : <div style={{ padding: 30 }}>No candles received.</div>}
            <p style={{ color: "#8192a9", fontSize: 11, marginBottom: 0 }}>Auto-refresh: every 20 seconds · candles update when the data provider publishes new market data.</p>
          </div>

          <aside style={{ background: "#111c2e", border: "1px solid #263449", borderRadius: 15, padding: 17 }}>
            <div style={{ color: "#38bdf8", fontSize: 11, fontWeight: 800, letterSpacing: ".12em" }}>PAPER ORDER TICKET</div><h3 style={{ margin: "7px 0 4px" }}>Practice trade</h3><p style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.5 }}>Orders use your TradeSight virtual balance. No real crypto is purchased.</p>
            <label style={{ display: "block", color: "#94a3b8", fontSize: 12, margin: "18px 0 6px" }}>Quantity ({asset.ticker})</label><input type="number" min="1" step="1" value={quantity} onChange={e => setQuantity(Math.max(1, Number(e.target.value)))} style={{ width: "100%", boxSizing: "border-box", background: "#081321", border: "1px solid #34445b", borderRadius: 8, padding: 11, color: "white" }}/>
            <div style={{ background: "#081321", borderRadius: 9, padding: 12, margin: "12px 0", color: "#94a3b8", fontSize: 12 }}>Estimated order value <b style={{ display: "block", color: "white", fontSize: 18, marginTop: 5 }}>{data ? usd(data.current_price * quantity) : "—"}</b></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><button disabled={!data || orderState.loading} onClick={() => placePaperOrder("BUY")} style={{ border: 0, borderRadius: 9, padding: 12, color: "white", background: "#059669", fontWeight: 800, cursor: "pointer" }}>Paper BUY</button><button disabled={!data || orderState.loading} onClick={() => placePaperOrder("SELL")} style={{ border: 0, borderRadius: 9, padding: 12, color: "white", background: "#e11d48", fontWeight: 800, cursor: "pointer" }}>Paper SELL</button></div>
            {orderState.message && <p style={{ color: orderState.error ? "#fda4af" : "#6ee7b7", fontSize: 12, lineHeight: 1.5 }}>{orderState.message}</p>}
            <div style={{ borderTop: "1px solid #29394f", marginTop: 18, paddingTop: 15 }}><div style={{ color: "#94a3b8", fontSize: 11 }}>TECHNICAL SNAPSHOT</div><p>Trend: <b style={{ color: data?.indicators?.trend === "UP" ? "#34d399" : "#fb7185" }}>{data?.indicators?.trend || "—"}</b></p><p>5m momentum: <b>{data?.indicators?.momentum_5m_pct ?? "—"}%</b></p><p>Fast EMA: <b>{usd(data?.indicators?.ema_fast)}</b></p><p>Slow EMA: <b>{usd(data?.indicators?.ema_slow)}</b></p></div>
          </aside>
        </section>

        <section style={{ background: "#111c2e", border: "1px solid #263449", borderRadius: 15, padding: 17 }}>
          <div style={{ background: "#091321", border: `1px solid ${overallColor}66`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ color: "#94a3b8", fontSize: 11, letterSpacing: ".12em", fontWeight: 800 }}>TRADE SIGNAL · PAPER TRADING</div>
            <div style={{ color: overallColor, fontSize: 25, fontWeight: 900, margin: "7px 0" }}>{data ? overall : "WAITING FOR DATA"}</div>
            <p style={{ color: "#d5deeb", margin: 0, lineHeight: 1.5 }}>{data ? decisionText : "Market data is loading."}</p>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", color: "#94a3b8", fontSize: 12, marginTop: 10 }}>
              <span>Review window: <b style={{ color: "white" }}>{strongestSignal ? `${strongestSignal.minutes} minutes` : "—"}</b></span>
              <span>UP score: <b style={{ color: "white" }}>{strongestSignal ? `${strongestUp.toFixed(1)}%` : "—"}</b></span>
              <span>DOWN score: <b style={{ color: "white" }}>{strongestSignal ? `${Number(strongestSignal.down_probability_pct).toFixed(1)}%` : "—"}</b></span>
            </div>
          </div>
          <button onClick={() => setShowDetails(v => !v)} style={{ width: "100%", marginTop: 12, padding: "11px 14px", borderRadius: 9, border: "1px solid #34445b", background: "#172235", color: "#d5deeb", textAlign: "left", cursor: "pointer" }}>{showDetails ? "Hide" : "Show"} detailed signals (5–30 min) {showDetails ? "−" : "+"}</button>
          {showDetails && <div style={{ marginTop: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: 10, marginTop: 15 }}>
            {horizons.map(h => { const color = h.signal === "BUY" ? "#34d399" : h.signal === "SELL BIAS" ? "#fb7185" : "#fbbf24"; return <article key={h.minutes} style={{ background: "#091321", border: `1px solid ${color}66`, borderRadius: 11, padding: 13 }}><div style={{ color: "#94a3b8", fontSize: 11 }}>NEXT {h.minutes} MINUTES</div><strong style={{ display: "block", color, fontSize: 19, margin: "7px 0" }}>{h.signal === "BUY" ? "UP BIAS" : h.signal === "SELL BIAS" ? "DOWN BIAS" : "WAIT"}</strong><div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}><span>UP SCORE {h.up_probability_pct}%</span><span>DOWN SCORE {h.down_probability_pct}%</span></div><div style={{ height: 7, background: "#25344a", borderRadius: 9, overflow: "hidden", marginTop: 8 }}><div style={{ height: "100%", width: `${h.up_probability_pct}%`, background: color }}/></div><p style={{ color: "#94a3b8", fontSize: 11, lineHeight: 1.45 }}>{h.reason}</p></article>; })}
          </div>
          <p style={{ color: "#8192a9", fontSize: 11, lineHeight: 1.5, marginBottom: 0 }}>Scores are technical indicators from EMA trend and recent momentum, NOT calibrated probabilities or guaranteed price predictions. UP BIAS means upward conditions are stronger; DOWN BIAS means downward conditions are stronger; WAIT means no clear edge. Use the time window as a review horizon, not an exact promise of when price will move. Paper trading only.</p>
        
          <p style={{ color: "#8192a9", fontSize: 11, lineHeight: 1.5, marginBottom: 0 }}>Technical indicator scores are experimental, not guaranteed predictions. Use each window as a review horizon, not an exact promise.</p>
          </div>}
</section>
      </div>
    </main>
  );
}
