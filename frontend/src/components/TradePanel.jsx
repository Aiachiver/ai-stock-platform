import React, { useEffect, useMemo, useState } from "react";
import Chart from "react-apexcharts";
import API from "../services/api";

function TradePanel({ symbol, refresh, livePrice }) {
  const [quantity, setQuantity] = useState("1");
  const [loading, setLoading] = useState(false);
  const [confirmSide, setConfirmSide] = useState(null);
  const [notice, setNotice] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  useEffect(() => {
    const price = Number(livePrice);
    if (!Number.isFinite(price) || price <= 0) return;
    setPriceHistory((current) => [...current, { x: Date.now(), y: price }].slice(-60));
  }, [livePrice]);
  const priceChart = useMemo(() => ({
    chart: { type: "area", background: "transparent", toolbar: { show: false }, animations: { enabled: true, speed: 350, dynamicAnimation: { enabled: true, speed: 350 } }, zoom: { enabled: false } },
    theme: { mode: "light" },
    colors: ["#76536f"], stroke: { curve: "smooth", width: 2.5 },
    fill: { type: "gradient", gradient: { opacityFrom: 0.25, opacityTo: 0.02 } },
    dataLabels: { enabled: false }, markers: { size: 0, hover: { size: 4 } },
    xaxis: { type: "datetime", labels: { datetimeUTC: false, style: { colors: "#625967" } } },
    yaxis: { labels: { formatter: (value) => "$" + Number(value).toFixed(2), style: { colors: "#625967" } } },
    grid: { borderColor: "#e8ded9", strokeDashArray: 4 },
    tooltip: { x: { format: "HH:mm:ss" } },
    noData: { text: "Waiting for live price updates…" }
  }), []);
  const orderValue = Number(livePrice || 0) * Number(quantity || 0);
  const validQuantity = Number.isInteger(Number(quantity)) && Number(quantity) > 0;

  const executePaperOrder = async () => {
    const side = confirmSide;
    if (!side || !validQuantity || loading) return;
    setLoading(true);
    setNotice(null);
    try {
      const response = await API.post(`/${side.toLowerCase()}/${symbol}?quantity=${Number(quantity)}`);
      if (response.data?.error) {
        setNotice({ type: "error", text: response.data.error });
        return;
      }
      setConfirmSide(null);
      setNotice({
        type: "success",
        text: `${side} order simulated: ${quantity} ${symbol} at $${Number(response.data.price).toFixed(2)} · Total $${Number(response.data.total).toFixed(2)}`
      });
      // Refresh only account/position data; avoid reloading stock history and ML models.
      await refresh?.();
    } catch (error) {
      setNotice({ type: "error", text: error.response?.data?.detail || `Paper ${side.toLowerCase()} failed. Please try again.` });
    } finally {
      setLoading(false);
    }
  };

  const buttonStyle = (side) => ({
    flex: 1, minWidth: 145, border: 0, borderRadius: 10, padding: "13px 18px",
    background: side === "BUY" ? "#087f5b" : "#b42332", color: "#fff",
    fontWeight: 700, fontSize: 14, cursor: loading ? "wait" : "pointer",
    opacity: loading ? 0.65 : 1, transition: "transform .18s ease, opacity .18s ease"
  });

  return (
    <section className="trade-panel">
      <div className="trade-panel__heading">
        <div>
          <span className="eyebrow">SIMULATED EXECUTION</span>
          <h2>Place a paper trade <span>· {symbol}</span></h2>
          <p>Practice with virtual funds. No broker is connected and no real order is sent.</p>
        </div>
        <span className="simulation-pill">Paper trading</span>
      </div>

      <div className="trade-price-chart">
        <div className="trade-price-chart__heading"><strong>Live price movement</strong><span>{priceHistory.length ? "Last 60 updates" : "Waiting for market data"}</span></div>
        <Chart type="area" height={190} options={priceChart} series={[{ name: symbol, data: priceHistory }]} />
      </div>

      <div className="trade-panel__controls">
        <label className="trade-quantity">
          <span>Quantity (shares)</span>
          <input
            type="number" min="1" step="1" inputMode="numeric"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            aria-invalid={!validQuantity}
          />
        </label>
        <div className="trade-estimate">
          <span>Indicative order value</span>
          <strong>{livePrice ? `$${orderValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Price unavailable"}</strong>
          <small>Final simulated fill uses the backend quote.</small>
        </div>
        <div className="trade-actions">
          <button style={buttonStyle("BUY")} disabled={loading || !validQuantity} onClick={() => setConfirmSide("BUY")}>Buy {symbol}</button>
          <button style={buttonStyle("SELL")} disabled={loading || !validQuantity} onClick={() => setConfirmSide("SELL")}>Sell {symbol}</button>
        </div>
      </div>

      {notice && <div className={`trade-notice trade-notice--${notice.type}`} role="status">{notice.text}</div>}

      {confirmSide && (
        <div className="trade-confirm" role="dialog" aria-modal="true" aria-labelledby="trade-confirm-title">
          <div className="trade-confirm__card">
            <span className="eyebrow">CONFIRM PAPER ORDER</span>
            <h3 id="trade-confirm-title">{confirmSide} {quantity} {symbol}?</h3>
            <p>This is a simulated transaction using your virtual account balance.</p>
            <div className="trade-confirm__actions">
              <button className="secondary-button" disabled={loading} onClick={() => setConfirmSide(null)}>Cancel</button>
              <button style={buttonStyle(confirmSide)} disabled={loading} onClick={executePaperOrder}>{loading ? "Processing…" : `Confirm ${confirmSide}`}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default TradePanel;
