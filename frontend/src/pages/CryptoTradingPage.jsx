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
const HORIZONS = [5, 10, 15, 20, 25, 30];
const usd = (n) => Number.isFinite(Number(n)) ? "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";

export default function CryptoTradingPage() {
  const [asset, setAsset] = useState(ASSETS[0]);
  const [data, setData] = useState(null);
  const [timeframe, setTimeframe] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [orderState, setOrderState] = useState({ loading: false, message: "", error: false });

  useEffect(() => {
    let active = true;
    const load = async (quiet = false) => {
      if (!quiet && active) setLoading(true);
      try {
        const response = await API.get(`/intraday/${asset.symbol}`, { timeout: 35000 });
        if (!active) return;
        setData(response.data);
        setError("");
        setUpdatedAt(new Date());
      } catch {
        if (active) setError("Crypto candles are temporarily unavailable. The data provider may be delayed or rate-limited.");
      } finally {
        if (active && !quiet) setLoading(false);
      }
    };
    setData(null);
    load(false);
    const timer = setInterval(() => load(true), 60000);
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
    chart: { type: "candlestick", background: "transparent", foreColor: "#94a3b8", toolbar: { show: true }, animations: { enabled: false } },
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
  const overall = buySignal > sellSignal ? "UPWARD BIAS" : sellSignal > buySignal ? "DOWNWARD BIAS" : "WAIT / MIXED";
  const overallColor = overall === "UPWARD BIAS" ? "#34d399" : overall === "DOWNWARD BIAS" ? "#fb7185" : "#fbbf24";

  return (
    <main style={{ minHeight: "100vh", background: "#080f1d", color: "#e5edf8", padding: "clamp(12px,2vw,26px)", boxSizing: "border-box" }}>
      <div style={{ maxWidth: 1500, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
          <div><div style={{ color: "#38bdf8", fontSize: 11, fontWeight: 900, letterSpacing: ".16em" }}>TRADESIGHT AI / DIGITAL ASSETS</div><h1 style={{ margin: "6px 0", fontSize: 28 }}>Crypto Trading Terminal</h1><p style={{ color: "#94a3b8", margin: 0 }}>24/7 crypto market research · paper trading only</p></div>
          <div style={{ background: "#142237", border: "1px solid #263b55", padding: "12px 16px", borderRadius: 12 }}><div style={{ color: "#94a3b8", fontSize: 11 }}>MARKET BIAS</div><b style={{ color: overallColor }}>{data ? overall : "CALCULATING…"}</b></div>
        </header>

        <nav style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 9, marginBottom: 16 }}>
          {ASSETS.map(item => <button key={item.symbol} onClick={() => setAsset(item)} style={{ textAlign: "left", background: asset.symbol === item.symbol ? "#17304a" : "#111c2e", border: asset.symbol === item.symbol ? `1px solid ${item.color}` : "1px solid #263449", color: "white", borderRadius: 11, padding: 12, cursor: "pointer" }}><span style={{ color: item.color, fontWeight: 900 }}>{item.ticker}</span><span style={{ display: "block", color: "#94a3b8", fontSize: 11, marginTop: 4 }}>{item.name}</span></button>)}
        </nav>

        <section style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(260px,1fr)", gap: 14, marginBottom: 15 }}>
          <div style={{ background: "linear-gradient(140deg,#14243a,#0d1728)", border: "1px solid #2b405b", borderRadius: 15, padding: 17 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><span style={{ color: "#94a3b8", fontSize: 11 }}>SELECTED MARKET</span><h2 style={{ margin: "5px 0" }}>{asset.name} <span style={{ color: "#94a3b8", fontSize: 14 }}>{asset.ticker}/USD</span></h2></div><div style={{ textAlign: "right" }}><strong style={{ fontSize: 27 }}>{usd(data?.current_price)}</strong><div style={{ color: Number(data?.change_pct) >= 0 ? "#34d399" : "#fb7185", fontSize: 13 }}>{data?.change_pct == null ? "—" : `${data.change_pct > 0 ? "+" : ""}${data.change_pct}% today`}</div></div></div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", margin: "14px 0" }}>{[1,5,15,30].map(m => <button key={m} onClick={() => setTimeframe(m)} style={{ padding: "7px 13px", borderRadius: 8, border: timeframe === m ? "1px solid #38bdf8" : "1px solid #34445b", background: timeframe === m ? "#164e63" : "#172235", color: "white", cursor: "pointer" }}>{m}m candles</button>)}<span style={{ marginLeft: "auto", color: "#64748b", fontSize: 11, alignSelf: "center" }}>{updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : ""}</span></div>
            {loading && !data ? <div style={{ padding: 60, textAlign: "center" }}>Loading crypto market data…</div> : error && !data ? <div style={{ padding: 25, color: "#fbbf24" }}>{error}</div> : candles.length ? <><Chart type="candlestick" height={340} options={chartOptions} series={chartSeries}/><div style={{ color: "#94a3b8", fontSize: 10, letterSpacing: ".1em" }}>VOLUME</div><Chart type="bar" height={85} options={volumeOptions} series={volumeSeries}/></> : <div style={{ padding: 30 }}>No candles received.</div>}
            <p style={{ color: "#8192a9", fontSize: 11, marginBottom: 0 }}>Data: Yahoo Finance 1-minute candles. This is not an exchange-grade live feed and may be delayed or rate-limited.</p>
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
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}><div><div style={{ color: "#38bdf8", fontSize: 11, fontWeight: 800, letterSpacing: ".12em" }}>AI HORIZON MONITOR</div><h2 style={{ margin: "5px 0" }}>Where could price move next?</h2><p style={{ color: "#94a3b8", margin: 0, fontSize: 12 }}>5, 10, 15, 20, 25 and 30-minute directional research</p></div><div style={{ color: "#fbbf24", fontSize: 11 }}>Experimental · heuristic · not calibrated ML</div></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: 10, marginTop: 15 }}>
            {horizons.map(h => { const color = h.signal === "BUY" ? "#34d399" : h.signal === "SELL BIAS" ? "#fb7185" : "#fbbf24"; return <article key={h.minutes} style={{ background: "#091321", border: `1px solid ${color}66`, borderRadius: 11, padding: 13 }}><div style={{ color: "#94a3b8", fontSize: 11 }}>{h.minutes} MIN HORIZON</div><strong style={{ display: "block", color, fontSize: 19, margin: "7px 0" }}>{h.signal}</strong><div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}><span>UP {h.up_probability_pct}%</span><span>DOWN {h.down_probability_pct}%</span></div><div style={{ height: 7, background: "#25344a", borderRadius: 9, overflow: "hidden", marginTop: 8 }}><div style={{ height: "100%", width: `${h.up_probability_pct}%`, background: color }}/></div><p style={{ color: "#94a3b8", fontSize: 11, lineHeight: 1.45 }}>{h.reason}</p></article>; })}
          </div>
          <p style={{ color: "#8192a9", fontSize: 11, lineHeight: 1.5, marginBottom: 0 }}>UP/DOWN figures are heuristic technical scores derived from EMA trend and recent momentum, not empirically calibrated probabilities. SELL BIAS means bearish direction, not an automatic short position. Historical accuracy has not yet been established.</p>
        </section>
      </div>
    </main>
  );
}
