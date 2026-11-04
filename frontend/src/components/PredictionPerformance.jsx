import React from "react";
import Chart from "react-apexcharts";

function PredictionPerformance({ data }) {
  if (!data || data.error || !Array.isArray(data.chart) || !data.chart.length) {
    return (
      <section style={{ background: "#1e293b", borderRadius: 14, padding: 20, marginTop: 22, color: "#cbd5e1" }}>
        <h2 style={{ marginTop: 0 }}>Prediction vs Actual</h2>
        Historical model evaluation is not available for this symbol right now.
      </section>
    );
  }

  const metrics = [
    ["Directional accuracy", data.directional_accuracy == null ? "—" : data.directional_accuracy.toFixed(2) + "%"],
    ["Mean absolute error", data.mae == null ? "—" : "$" + data.mae.toFixed(2)],
    ["Mean percentage error", data.mape == null ? "—" : data.mape.toFixed(2) + "%"],
    ["Backtest samples", data.samples ?? "—"]
  ];

  const options = {
    chart: { type: "line", height: 330, background: "#1e293b", foreColor: "#cbd5e1", toolbar: { show: true }, zoom: { enabled: true } },
    theme: { mode: "dark" },
    colors: ["#38bdf8", "#f59e0b"],
    stroke: { curve: "smooth", width: [2, 2] },
    title: { text: "Historical Prediction vs Actual Close", align: "left", style: { color: "#f8fafc", fontSize: "15px" } },
    xaxis: { categories: data.chart.map(row => row.date), labels: { rotate: -35, style: { colors: "#94a3b8" } } },
    yaxis: { labels: { formatter: value => "$" + value.toFixed(2), style: { colors: "#94a3b8" } } },
    grid: { borderColor: "#334155" },
    legend: { labels: { colors: "#cbd5e1" } },
    tooltip: { theme: "dark" }
  };
  const series = [
    { name: "Actual close", data: data.chart.map(row => row.actual) },
    { name: "Model estimate", data: data.chart.map(row => row.predicted) }
  ];

  return (
    <section style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 14, padding: 20, marginTop: 22 }}>
      <h2 style={{ margin: "0 0 5px" }}>Model Performance</h2>
      <p style={{ color: "#94a3b8", marginTop: 0, fontSize: 13 }}>{data.model} · {data.forecast_horizon} forecast · Historical walk-forward test</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 12, margin: "18px 0" }}>
        {metrics.map(([label, value]) => (
          <div key={label} style={{ background: "#0f172a", borderRadius: 10, padding: 14 }}>
            <div style={{ color: "#94a3b8", fontSize: 12 }}>{label}</div>
            <strong style={{ display: "block", marginTop: 7, fontSize: 20 }}>{value}</strong>
          </div>
        ))}
      </div>
      <Chart options={options} series={series} type="line" height={330} />
      <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 0 }}>{data.note}</p>
    </section>
  );
}

export default PredictionPerformance;
