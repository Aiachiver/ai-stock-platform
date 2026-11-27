import React from "react";
import Chart from "react-apexcharts";

function StockChart({ data, error, symbol = "Stock" }) {
  const validData = Array.isArray(data)
    ? data.filter((item) => item && item.time && Number.isFinite(Number(item.close)))
    : [];

  if (!validData.length) {
    return (
      <div style={{ background: "#182322", color: "#d8cbb3", borderRadius: 14, padding: 24, minHeight: 220 }}>
        <h3 style={{ marginTop: 0 }}>{symbol} · Historical Market Price</h3>
        {error || "Price history is loading or temporarily unavailable."}
      </div>
    );
  }

  const series = [{
    name: `${symbol} closing price`,
    data: validData.map((item) => ({
      x: new Date(item.time).getTime(),
      y: Number(item.close)
    })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
  }];

  const options = {
    chart: {
      type: "area",
      height: 390,
      background: "#182322",
      foreColor: "#d8cbb3",
      toolbar: { show: true },
      animations: { enabled: true, easing: "easeinout", speed: 350 },
      zoom: { enabled: true }
    },
    theme: { mode: "dark" },
    colors: ["#38bdf8"],
    title: {
      text: `${symbol} · Historical Market Price (Daily Close)`,
      align: "left",
      style: { color: "#f8fafc", fontSize: "16px", fontWeight: 600 }
    },
    dataLabels: { enabled: false },
    stroke: { curve: "smooth", width: 2.5 },
    fill: { type: "gradient", gradient: { opacityFrom: 0.28, opacityTo: 0.02, stops: [0, 90, 100] } },
    markers: { size: 0, hover: { size: 4 } },
    xaxis: {
      type: "datetime",
      labels: { datetimeUTC: false, style: { colors: "#aaa18f" } },
      tooltip: { enabled: false }
    },
    yaxis: {
      labels: { style: { colors: "#aaa18f" }, formatter: (value) => `$${value.toFixed(2)}` }
    },
    grid: { borderColor: "#514c40", strokeDashArray: 4 },
    tooltip: {
      theme: "dark",
      x: { format: "dd MMM yyyy" },
      y: { formatter: (value) => `$${value.toFixed(2)}` }
    },
    noData: { text: "No price data", style: { color: "#d8cbb3" } }
  };

  return (
    <div style={{ minHeight: 390 }}>
      <Chart options={options} series={series} type="area" height={390} />
      <p style={{ color: "#aaa18f", fontSize: 12, margin: "8px 2px 0" }}>
        Daily closing prices · Historical market data may be delayed; this is not a tick-by-tick live exchange feed.
      </p>
    </div>
  );
}

export default StockChart;
