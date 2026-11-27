import React, { useEffect, useMemo, useRef, useState } from "react";
import Chart from "react-apexcharts";
import API, { API_BASE_URL } from "../services/api";

const ASSETS = [
  { symbol: "BTC-USD", name: "Bitcoin", ticker: "BTC", color: "#c6a96b" },
  { symbol: "ETH-USD", name: "Ethereum", ticker: "ETH", color: "#9b91b6" },
  { symbol: "SOL-USD", name: "Solana", ticker: "SOL", color: "#c6a96b" },
  { symbol: "XRP-USD", name: "XRP", ticker: "XRP", color: "#b8ad9b" },
  { symbol: "DOGE-USD", name: "Dogecoin", ticker: "DOGE", color: "#facc15" },
  { symbol: "BNB-USD", name: "BNB", ticker: "BNB", color: "#d4b56f" }
];
const usd = (n) => Number.isFinite(Number(n)) ? "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";

export default function CryptoTradingPage() {
  const [asset, setAsset] = useState(ASSETS[0]);
  const [data, setData] = useState(null);
  const [timeframe, setTimeframe] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [livePrice, setLivePrice] = useState(null);
  const [streamStatus, setStreamStatus] = useState("connecting");
  const previousLivePrice = useRef(null);
  const pendingTick = useRef(null);
  const [liveDirection, setLiveDirection] = useState("flat");
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [customExpiryTime, setCustomExpiryTime] = useState("");
  const [customTargetPrice, setCustomTargetPrice] = useState("");

  useEffect(() => {
    let active = true;
    const load = async (quiet = false) => {
      if (!quiet && active) setLoading(true);
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
      }
    };
    setData(null);
    setLivePrice(null);
    previousLivePrice.current = null;
    setLiveDirection("flat");
    load(false);
    const timer = setInterval(() => load(true), 120000);
    return () => { active = false; clearInterval(timer); };
  }, [asset]);

  // Exchange trade ticks update the live quote and the currently forming candle.
  useEffect(() => {
    let socket;
    let retryTimer;
    let stopped = false;
    let retryDelay = 1000;
    const connect = () => {
      if (stopped) return;
      const wsBase = API_BASE_URL.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
      socket = new WebSocket(`${wsBase}/ws/crypto/${asset.symbol}`);
      socket.onopen = () => { retryDelay = 1000; setStreamStatus("connecting"); };
      socket.onmessage = (event) => {
        try {
          const tick = JSON.parse(event.data);
          if (tick.status === "connected") { setStreamStatus("live"); return; }
          if (tick.status === "reconnecting") { setStreamStatus("reconnecting"); return; }
          if (!Number.isFinite(Number(tick.price))) return;
          pendingTick.current = tick;
          setStreamStatus("live");
        } catch { /* Ignore malformed messages and keep the stream alive. */ }
      };
      socket.onerror = () => setStreamStatus("reconnecting");
      socket.onclose = () => {
        if (!stopped) {
          setStreamStatus("reconnecting");
          retryTimer = setTimeout(connect, retryDelay);
          retryDelay = Math.min(retryDelay * 2, 15000);
        }
      };
    };
    connect();
    const publishTimer = setInterval(() => {
      const tick = pendingTick.current;
      if (!tick) return;
      pendingTick.current = null;
      const price = Number(tick.price);
      const stamp = Number(tick.event_time) || Date.now();
      const previousPrice = previousLivePrice.current;
      setLiveDirection(previousPrice == null ? "flat" : price > previousPrice ? "up" : price < previousPrice ? "down" : "flat");
      previousLivePrice.current = price;
      setLivePrice(price);
      setUpdatedAt(new Date(stamp));
      setData(previous => {
        if (!previous) return previous;
        const history = [...(previous.candles || [])];
        const minute = Math.floor(stamp / 60000) * 60000;
        const last = history[history.length - 1];
        if (last && Math.floor(new Date(last.time).getTime() / 60000) === Math.floor(stamp / 60000)) {
          history[history.length - 1] = { ...last, high: Math.max(Number(last.high), price), low: Math.min(Number(last.low), price), close: price, volume: Number(last.volume || 0) + Number(tick.quantity || 0) };
        } else {
          history.push({ time: new Date(minute).toISOString(), open: last ? Number(last.close) : price, high: price, low: price, close: price, volume: Number(tick.quantity || 0) });
        }
        return { ...previous, current_price: price, candles: history.slice(-240), data_source: "Binance Spot live trades", is_live: true };
      });
    }, 1000);
    return () => {
      clearInterval(publishTimer);
      pendingTick.current = null;
      stopped = true;
      clearTimeout(retryTimer);
      if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
    };
  }, [asset]);

  useEffect(() => { const timer = setInterval(() => setClockNow(Date.now()), 1000); return () => clearInterval(timer); }, []);

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

  const currentChartPrice = livePrice ?? data?.current_price;
  const priceLineColor = liveDirection === "up" ? "#68b58a" : liveDirection === "down" ? "#d77c76" : "#b8ad9b";
  const chartOptions = {
    chart: { type: "candlestick", background: "transparent", foreColor: "#b8ad9b", toolbar: { show: true }, animations: { enabled: true, speed: 250, dynamicAnimation: { enabled: true, speed: 250 } } },
    theme: { mode: "dark" },
    plotOptions: { candlestick: { colors: { upward: "#68b58a", downward: "#d77c76" }, wick: { useFillColor: true } } },
    xaxis: { type: "datetime", labels: { datetimeUTC: false } },
    yaxis: { tooltip: { enabled: true }, labels: { formatter: v => usd(v) } },
    annotations: currentChartPrice != null ? { yaxis: [{ y: Number(currentChartPrice), borderColor: priceLineColor, strokeDashArray: 5, label: { text: usd(currentChartPrice), position: "right", borderColor: priceLineColor, style: { background: priceLineColor, color: "#fff", fontSize: "12px", fontWeight: 700 }, offsetX: -4 } }] } : {},
    grid: { borderColor: "#514c40", strokeDashArray: 3 },
    tooltip: { theme: "dark", x: { format: "HH:mm:ss" } },
    noData: { text: "No crypto candles available" }
  };
  const volumeOptions = {
    chart: { type: "bar", background: "transparent", foreColor: "#b8ad9b", toolbar: { show: false } },
    theme: { mode: "dark" }, plotOptions: { bar: { columnWidth: "65%" } },
    colors: ["#77786e"], dataLabels: { enabled: false },
    xaxis: { type: "datetime", labels: { show: false } }, yaxis: { labels: { show: false } },
    grid: { show: false }, tooltip: { theme: "dark" }
  };

  const binaryMarkets = useMemo(() => {
    const closes=(data?.candles||[]).map(c=>Number(c.close)).filter(v=>Number.isFinite(v)&&v>0);
    const spot=Number(livePrice ?? data?.current_price ?? closes.at(-1));
    if(!Number.isFinite(spot)||spot<=0||closes.length<20)return [];
    const returns=[];for(let i=Math.max(1,closes.length-61);i<closes.length;i++)returns.push(Math.log(closes[i]/closes[i-1]));
    if(returns.length<15)return [];
    const mean=returns.reduce((a,b)=>a+b,0)/returns.length,variance=returns.reduce((a,b)=>a+(b-mean)**2,0)/(returns.length-1);
    const sigma=Math.sqrt(Math.max(variance,1e-12));
    const erf=x=>{const sign=x<0?-1:1;x=Math.abs(x);const t=1/(1+0.3275911*x);const y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x);return sign*y;};
    const estimate=(target,horizon)=>{const drift=mean*horizon*0.25,hs=Math.max(sigma*Math.sqrt(horizon),1e-8),expected=spot*Math.exp(drift),z=(Math.log(target/spot)-drift)/hs,yes=Math.max(0,Math.min(1,0.5*(1-erf(z/Math.sqrt(2)))));return{target,yes:yes*100,no:(1-yes)*100,spot,expected,horizon};};
    const now=new Date(clockNow),nextSlot=new Date(now);nextSlot.setSeconds(0,0);nextSlot.setMinutes(Math.ceil((now.getMinutes()+1)/5)*5);
    const standard=[5,10,15].map((labelMinutes,slot)=>{const expiry=new Date(nextSlot.getTime()+slot*5*60000),horizon=Math.max(0.25,(expiry.getTime()-now.getTime())/60000),base=estimate(spot*Math.exp(mean*horizon*0.25+0.5*sigma*Math.sqrt(horizon)),horizon);return{...base,id:slot,labelMinutes,expiryLabel:expiry.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})};});
    let custom=null;
    const target=Number(customTargetPrice);
    if(customExpiryTime&&Number.isFinite(target)&&target>0){
      const [hours,minutes]=customExpiryTime.split(":").map(Number);
      if(Number.isInteger(hours)&&Number.isInteger(minutes)){
        const expiry=new Date(now);expiry.setHours(hours,minutes,0,0);
        if(expiry<=now)expiry.setDate(expiry.getDate()+1);
        const horizon=(expiry.getTime()-now.getTime())/60000;
        if(horizon>0)custom={...estimate(target,horizon),id:"custom",labelMinutes:null,expiryLabel:expiry.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})};
      }
    }
    return custom?[...standard,custom]:standard;
  },[data,livePrice,clockNow,customExpiryTime,customTargetPrice]);


  return (
    <main className="crypto-terminal" style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 50% -12%, rgba(198,169,107,.14), transparent 42%), #0b1118", color: "#f3eee4", padding: "clamp(12px,2vw,26px)", boxSizing: "border-box" }}>
      <div style={{ maxWidth: 1500, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
          <div><div style={{ color: "#c6a96b", fontSize: 11, fontWeight: 900, letterSpacing: ".16em" }}>TRADESIGHT AI / DIGITAL ASSETS</div><h1 style={{ margin: "6px 0", fontSize: 28 }}>Crypto Prediction Markets</h1><p style={{ color: "#b8ad9b", margin: 0 }}>YES / NO price-event forecasts · live market data</p></div>
        </header>

        <nav style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 9, marginBottom: 16 }}>
          {ASSETS.map(item => <button key={item.symbol} onClick={() => setAsset(item)} style={{ textAlign: "left", background: asset.symbol === item.symbol ? "#17304a" : "#111c2e", border: asset.symbol === item.symbol ? `1px solid ${item.color}` : "1px solid #514c40", color: "white", borderRadius: 11, padding: 12, cursor: "pointer" }}><span style={{ color: item.color, fontWeight: 900 }}>{item.ticker}</span><span style={{ display: "block", color: "#b8ad9b", fontSize: 11, marginTop: 4 }}>{item.name}</span></button>)}
        </nav>

        <section style={{marginBottom:15}}>
          <div style={{background:"linear-gradient(140deg,#202b2b,#151e1e)",border:"1px solid #66583f",borderRadius:18,padding:17,boxShadow:"0 18px 50px rgba(0,0,0,.24)"}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><div><span style={{color:"#b8ad9b",fontSize:11}}>SELECTED MARKET</span><h2 style={{margin:"5px 0"}}>{asset.name} <span style={{color:"#b8ad9b",fontSize:14}}>{asset.ticker}/USD</span></h2></div><div style={{textAlign:"right"}}><strong style={{fontSize:27,color:priceLineColor}}>{usd(livePrice ?? data?.current_price)}</strong><div style={{color:Number(data?.change_pct)>=0?"#68b58a":"#d77c76",fontSize:13}}>{data?.change_pct==null?"—":`${data.change_pct>0?"+":""}${data.change_pct}% today`}</div></div></div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap",margin:"14px 0"}}>{[1,5,15,30].map(m=><button key={m} onClick={()=>setTimeframe(m)} style={{padding:"7px 13px",borderRadius:8,border:timeframe===m?"1px solid #c6a96b":"1px solid #34445b",background:timeframe===m?"#3c5148":"#202b29",color:"white",cursor:"pointer"}}>{m}m candles</button>)}<span style={{marginLeft:"auto",color:"#77786e",fontSize:11,alignSelf:"center"}}>{streamStatus === "live" ? "● LIVE · Binance trades" : streamStatus === "reconnecting" ? "Reconnecting to exchange…" : updatedAt ? `Snapshot · ${updatedAt.toLocaleTimeString()}` : "Connecting to exchange…"}</span></div>
            {loading&&!data?<div style={{padding:60,textAlign:"center"}}>Loading crypto market data…</div>:error&&!data?<div style={{padding:25,color:"#d4b56f"}}>{error}</div>:candles.length?<><Chart type="candlestick" height={340} options={chartOptions} series={chartSeries}/><div style={{color:"#b8ad9b",fontSize:10,letterSpacing:".1em"}}>VOLUME</div><Chart type="bar" height={85} options={volumeOptions} series={volumeSeries}/></>:<div style={{padding:30}}>No candles received.</div>}
            <p style={{color:"#aaa18f",fontSize:11,marginBottom:0}}><span style={{color:priceLineColor}}>● {liveDirection === "up" ? "PRICE MOVING UP" : liveDirection === "down" ? "PRICE MOVING DOWN" : "LIVE PRICE"}</span> · Latest Binance trade price is displayed once per second; candle bodies turn green/red by open vs close.</p>
          </div>
        </section>

        <section style={{background:"linear-gradient(140deg,#202b2b,#151e1e)",border:"1px solid #66583f",borderRadius:18,padding:18,boxShadow:"0 18px 50px rgba(0,0,0,.22)",marginBottom:15}}>
          <div><div style={{color:"#c6a96b",fontSize:11,fontWeight:900,letterSpacing:".12em"}}>CRYPTO PRICE PREDICTION MARKETS</div><h2 style={{margin:"7px 0"}}>3 upcoming price questions</h2><p style={{color:"#b8ad9b",fontSize:12,margin:0}}>Three rolling 5 / 10 / 15-minute cards, plus your optional custom test.</p></div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginTop:15,background:"#182322",padding:12,borderRadius:10}}>
            <label style={{color:"#cbd5e1",fontSize:12}}>Custom expiry time<input type="time" value={customExpiryTime} onChange={e=>setCustomExpiryTime(e.target.value)} style={{display:"block",width:"100%",marginTop:6,padding:10,borderRadius:7,border:"1px solid #625840",background:"#101918",color:"#fff",colorScheme:"dark"}} /></label>
            <label style={{color:"#cbd5e1",fontSize:12}}>Your target price<input type="number" min="0" step="any" placeholder="e.g. 61500" value={customTargetPrice} onChange={e=>setCustomTargetPrice(e.target.value)} style={{display:"block",width:"100%",marginTop:6,padding:10,borderRadius:7,border:"1px solid #625840",background:"#101918",color:"#fff"}} /></label>
            <div style={{display:"flex",alignItems:"end"}}><button onClick={()=>{setCustomExpiryTime("");setCustomTargetPrice("");}} style={{padding:"10px 14px",borderRadius:7,border:"1px solid #625840",background:"#1e293b",color:"#eee5d5",cursor:"pointer",width:"100%"}}>Clear custom</button></div>
          </div>
          {binaryMarkets.length?<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12,marginTop:16}}>{binaryMarkets.map(m=><article key={m.id} style={{background:"#f2eee5",color:"#202724",border:"1px solid #d8cbb3",borderRadius:15,padding:16,boxShadow:"0 10px 28px rgba(20,30,25,.08)"}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",marginBottom:10}}><span style={{color:"#77786e",fontSize:11,fontWeight:700}}>{m.id === "custom" ? "CUSTOM QUESTION" : `${m.labelMinutes} MIN QUESTION`}</span><span style={{background:"#eee5d5",color:"#475569",padding:"4px 8px",borderRadius:6,fontSize:11}}>{m.id === "custom" ? "CUSTOM TEST" : "LIVE ESTIMATE"}</span></div>
            <h3 style={{fontSize:17,lineHeight:1.35,minHeight:68,margin:"5px 0 15px"}}>{asset.name} to be priced at {usd(m.target)} or more by {m.expiryLabel}?</h3>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}><div style={{background:"#e5eee7",borderRadius:9,padding:12,textAlign:"center"}}><div style={{color:"#287653",fontSize:11,fontWeight:800}}>YES</div><strong style={{color:"#287653",fontSize:24}}>{m.yes.toFixed(1)}%</strong></div><div style={{background:"#f5e8e5",borderRadius:9,padding:12,textAlign:"center"}}><div style={{color:"#a84f4b",fontSize:11,fontWeight:800}}>NO</div><strong style={{color:"#a84f4b",fontSize:24}}>{m.no.toFixed(1)}%</strong></div></div>
            <div style={{display:"flex",justifyContent:"space-between",gap:8,color:"#77786e",fontSize:11,marginTop:12}}><span>Current: <b style={{color:"#1e293b"}}>{usd(m.spot)}</b></span><span>Expected: <b style={{color:"#1e293b"}}>{usd(m.expected)}</b></span></div>
          </article>)}</div>:<p style={{color:"#d4b56f",fontSize:12,marginTop:16}}>Waiting for enough one-minute candles to calculate estimates.</p>}
          <p style={{color:"#d4b56f",fontSize:11,lineHeight:1.5,marginBottom:0,marginTop:14}}>Experimental estimates from recent one-minute price changes; not calibrated market odds or guaranteed outcomes.</p>
        </section>
      </div>
    </main>
  );
}
