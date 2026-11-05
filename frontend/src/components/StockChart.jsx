import React from "react";
import Chart from "react-apexcharts";

function StockChart({ data, error }) {
  const validData = Array.isArray(data)
    ? data.filter(item => item && ["open", "high", "low", "close"].every(key => Number.isFinite(Number(item[key]))))
    : [];

  if (!validData.length) {
    return (
      <div style={{ background: "#1e293b", color: "#cbd5e1", borderRadius: 14, padding: 24, minHeight: 180 }}>
        <h3 style={{ marginTop: 0 }}>Price chart</h3>
        {error || "Historical price data is temporarily unavailable. Try Refresh in a moment."}
      </div>
    );
  }

  const series = [{
    name: "Price",
    data: validData.map(item => ({
      x: new Date(item.time).getTime(),
      y: [Number(item.open), Number(item.high), Number(item.low), Number(item.close)]
    }))
  }];

  const options = {
    chart: { type: "candlestick", height: 390, background: "#1e293b", foreColor: "#cbd5e1", toolbar: { show: true }, animations: { enabled: false } },
    theme: { mode: "dark" },
    title: { text: "3-Month Historical Price · Daily OHLC", align: "left", style: { color: "#f8fafc", fontSize: "16px" } },
    plotOptions: { candlestick: { colors: { upward: "#22c55e", downward: "#ef4444" }, wick: { useFillColor: true } } },
    xaxis: { type: "datetime", labels: { datetimeUTC: false, style: { colors: "#94a3b8" } } },
    yaxis: { tooltip: { enabled: true }, labels: { style: { colors: "#94a3b8" } } },
    grid: { borderColor: "#334155" },
    tooltip: { theme: "dark" },
    noData: { text: "No price data", style: { color: "#cbd5e1" } }
  };

  return <Chart options={options} series={series} type="candlestick" height={390} />;
}

export default StockChart;
