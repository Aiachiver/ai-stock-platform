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
  const [eventMinutes, setEventMinutes] = useState(10);

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

  const binaryMarkets = useMemo(() => {
    const closes=(data?.candles||[]).map(c=>Number(c.close)).filter(v=>Number.isFinite(v)&&v>0);
    if(closes.length<20)return [];
    const returns=[];for(let i=Math.max(1,closes.length-61);i<closes.length;i++)returns.push(Math.log(closes[i]/closes[i-1]));
    if(returns.length<15)return [];
    const mean=returns.reduce((a,b)=>a+b,0)/returns.length,variance=returns.reduce((a,b)=>a+(b-mean)**2,0)/(returns.length-1);
    const sigma=Math.sqrt(Math.max(variance,1e-12)),spot=closes.at(-1),horizon=Number(eventMinutes),drift=mean*horizon*0.25,expected=spot*Math.exp(drift),hs=Math.max(sigma*Math.sqrt(horizon),1e-8);
    const erf=x=>{const sign=x<0?-1:1;x=Math.abs(x);const t=1/(1+0.3275911*x);const y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x);return sign*y;};
    return [-.0025,-.001,0,.001,.0025].map((offset,id)=>{const target=spot*(1+offset),z=(Math.log(target/spot)-drift)/hs,yes=Math.max(0,Math.min(1,.5*(1-erf(z/Math.sqrt(2)))));return{id,target,yes:yes*100,no:(1-yes)*100,spot,expected};});
  },[data,eventMinutes]);
  const expiryLabel=new Date(Date.now()+Number(eventMinutes)*60000).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});


  return (
    <main style={{ minHeight: "100vh", background: "#080f1d", color: "#e5edf8", padding: "clamp(12px,2vw,26px)", boxSizing: "border-box" }}>
      <div style={{ maxWidth: 1500, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
          <div><div style={{ color: "#38bdf8", fontSize: 11, fontWeight: 900, letterSpacing: ".16em" }}>TRADESIGHT AI / DIGITAL ASSETS</div><h1 style={{ margin: "6px 0", fontSize: 28 }}>Crypto Prediction Markets</h1><p style={{ color: "#94a3b8", margin: 0 }}>YES / NO price-event forecasts · live market data</p></div>
        </header>

        <nav style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 9, marginBottom: 16 }}>
          {ASSETS.map(item => <button key={item.symbol} onClick={() => setAsset(item)} style={{ textAlign: "left", background: asset.symbol === item.symbol ? "#17304a" : "#111c2e", border: asset.symbol === item.symbol ? `1px solid ${item.color}` : "1px solid #263449", color: "white", borderRadius: 11, padding: 12, cursor: "pointer" }}><span style={{ color: item.color, fontWeight: 900 }}>{item.ticker}</span><span style={{ display: "block", color: "#94a3b8", fontSize: 11, marginTop: 4 }}>{item.name}</span></button>)}
        </nav>

        <section style={{marginBottom:15}}>
          <div style={{background:"linear-gradient(140deg,#14243a,#0d1728)",border:"1px solid #2b405b",borderRadius:15,padding:17}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><div><span style={{color:"#94a3b8",fontSize:11}}>SELECTED MARKET</span><h2 style={{margin:"5px 0"}}>{asset.name} <span style={{color:"#94a3b8",fontSize:14}}>{asset.ticker}/USD</span></h2></div><div style={{textAlign:"right"}}><strong style={{fontSize:27}}>{usd(data?.current_price)}</strong><div style={{color:Number(data?.change_pct)>=0?"#34d399":"#fb7185",fontSize:13}}>{data?.change_pct==null?"—":`${data.change_pct>0?"+":""}${data.change_pct}% today`}</div></div></div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap",margin:"14px 0"}}>{[1,5,15,30].map(m=><button key={m} onClick={()=>setTimeframe(m)} style={{padding:"7px 13px",borderRadius:8,border:timeframe===m?"1px solid #38bdf8":"1px solid #34445b",background:timeframe===m?"#164e63":"#172235",color:"white",cursor:"pointer"}}>{m}m candles</button>)}<span style={{marginLeft:"auto",color:"#64748b",fontSize:11,alignSelf:"center"}}>{updatedAt?`${refreshing?"Updating… · ":"Updated "}${updatedAt.toLocaleTimeString()}`:""}</span></div>
            {loading&&!data?<div style={{padding:60,textAlign:"center"}}>Loading crypto market data…</div>:error&&!data?<div style={{padding:25,color:"#fbbf24"}}>{error}</div>:candles.length?<><Chart type="candlestick" height={340} options={chartOptions} series={chartSeries}/><div style={{color:"#94a3b8",fontSize:10,letterSpacing:".1em"}}>VOLUME</div><Chart type="bar" height={85} options={volumeOptions} series={volumeSeries}/></>:<div style={{padding:30}}>No candles received.</div>}
            <p style={{color:"#8192a9",fontSize:11,marginBottom:0}}>Auto-refresh: every 20 seconds · candles update when the data provider publishes new market data.</p>
          </div>
        </section>

        <section style={{background:"linear-gradient(140deg,#13243a,#0b1728)",border:"1px solid #31506b",borderRadius:15,padding:18,marginBottom:15}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}><div><div style={{color:"#38bdf8",fontSize:11,fontWeight:900,letterSpacing:".12em"}}>CRYPTO PRICE PREDICTION MARKETS</div><h2 style={{margin:"7px 0"}}>Will {asset.name} reach this price?</h2><p style={{color:"#94a3b8",fontSize:12,margin:0}}>YES / NO price-event estimates, like your screenshot.</p></div><div style={{display:"flex",gap:6}}>{[5,10,15,30].map(m=><button key={m} onClick={()=>setEventMinutes(m)} style={{padding:"9px 13px",borderRadius:8,border:eventMinutes===m?"1px solid #34d399":"1px solid #34445b",background:eventMinutes===m?"#123b32":"#172235",color:"white",cursor:"pointer"}}>{m} min</button>)}</div></div>
          {binaryMarkets.length?<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12,marginTop:16}}>{binaryMarkets.map(m=><article key={m.id} style={{background:"#f8fafc",color:"#111827",border:"1px solid #dbe2ea",borderRadius:13,padding:15}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",marginBottom:10}}><span style={{color:"#64748b",fontSize:11,fontWeight:700}}>{eventMinutes} MINUTE QUESTION</span><span style={{background:"#e2e8f0",color:"#475569",padding:"4px 8px",borderRadius:6,fontSize:11}}>LIVE ESTIMATE</span></div>
            <h3 style={{fontSize:17,lineHeight:1.35,minHeight:68,margin:"5px 0 15px"}}>{asset.name} to be priced at {usd(m.target)} or more at {expiryLabel}?</h3>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}><div style={{background:"#e8f5ed",borderRadius:9,padding:12,textAlign:"center"}}><div style={{color:"#24834c",fontSize:11,fontWeight:800}}>YES</div><strong style={{color:"#24834c",fontSize:24}}>{m.yes.toFixed(1)}%</strong></div><div style={{background:"#fdecec",borderRadius:9,padding:12,textAlign:"center"}}><div style={{color:"#c43d3d",fontSize:11,fontWeight:800}}>NO</div><strong style={{color:"#c43d3d",fontSize:24}}>{m.no.toFixed(1)}%</strong></div></div>
            <div style={{display:"flex",justifyContent:"space-between",gap:8,color:"#64748b",fontSize:11,marginTop:12}}><span>Current: <b style={{color:"#1e293b"}}>{usd(m.spot)}</b></span><span>Expected: <b style={{color:"#1e293b"}}>{usd(m.expected)}</b></span></div>
          </article>)}</div>:<p style={{color:"#fbbf24",fontSize:12,marginTop:16}}>Waiting for enough one-minute candles to calculate estimates.</p>}
          <p style={{color:"#fbbf24",fontSize:11,lineHeight:1.5,marginBottom:0,marginTop:14}}>Experimental estimates from recent one-minute price changes; not calibrated market odds or guaranteed outcomes.</p>
        </section>
      </div>
    </main>
  );
}
