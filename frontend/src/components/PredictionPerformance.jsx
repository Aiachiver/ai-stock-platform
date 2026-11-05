import React from "react";
import Chart from "react-apexcharts";

function PredictionPerformance({ data, loading = false }) {
  if (loading || data?.loading) {
    return (
      <section className="research-panel research-loading" aria-live="polite">
        <div className="research-panel__top"><div><span className="eyebrow">MODEL TRANSPARENCY</span><h2>Model validation</h2></div><span className="research-status"><span className="loading-dot" /> Evaluating holdout data</span></div>
        <p className="research-muted">Chronological validation is running independently from the price chart.</p>
        <div className="research-skeleton" />
      </section>
    );
  }
  if (!data || data.error || !Array.isArray(data.chart) || !data.chart.length) {
    return (
      <section style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 14, padding: 20, marginTop: 22, color: "#cbd5e1" }}>
        <h2 style={{ marginTop: 0 }}>Model validation</h2>
        {data?.error || "Historical evaluation is unavailable for this symbol right now."}
        <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 0 }}>
          Check backend data availability, then use Refresh.
        </p>
      </section>
    );
  }

  const formatPct = (value) => value == null ? "—" : Number(value).toFixed(2) + "%";
  const metrics = [
    ["Holdout directional accuracy", formatPct(data.directional_accuracy)],
    ["Balanced directional accuracy", formatPct(data.balanced_directional_accuracy)],
    ["Signal accuracy", formatPct(data.signal_accuracy_pct)],
    ["Signal coverage", formatPct(data.signal_coverage_pct)],
    ["Mean absolute error", data.mae == null ? "—" : "$" + Number(data.mae).toFixed(2)],
    ["Root mean squared error", data.rmse == null ? "—" : "$" + Number(data.rmse).toFixed(2)],
    ["Mean absolute percentage error", formatPct(data.mape)],
    ["Untouched holdout samples", data.samples ?? "—"]
  ];

  const options = {
    chart: { type: "line", height: 330, background: "#1e293b", foreColor: "#cbd5e1", toolbar: { show: true }, zoom: { enabled: true } },
    theme: { mode: "dark" },
    colors: ["#38bdf8", "#f59e0b"],
    stroke: { curve: "smooth", width: [2, 2] },
    title: { text: "Actual close vs model estimate", align: "left", style: { color: "#f8fafc", fontSize: "15px" } },
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
    <section className="research-panel">
      <div className="research-panel__top"><div><span className="eyebrow">MODEL TRANSPARENCY</span><h2>Model Performance & Transparency</h2></div><span className="research-status">Holdout evaluated</span></div>
      <p style={{ color: "#94a3b8", marginTop: 0, fontSize: 13 }}>
        {data.model} · {data.forecast_horizon} · Chronological holdout not used for model selection
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 12, margin: "18px 0" }}>
        {metrics.map(([label, value]) => (
          <div key={label} style={{ background: "#0f172a", borderRadius: 10, padding: 14 }}>
            <div style={{ color: "#94a3b8", fontSize: 12 }}>{label}</div>
            <strong style={{ display: "block", marginTop: 7, fontSize: 19 }}>{value}</strong>
          </div>
        ))}
      </div>
      <Chart options={options} series={series} type="line" height={330} />
      {data.model_comparison && (
        <div style={{ overflowX: "auto", marginTop: 18 }}>
          <h3>Validation model comparison</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
            <thead><tr>{["Model", "Direction", "Balanced", "Return MAE"].map(label => <th key={label} style={{ padding: 9, borderBottom: "1px solid #475569", color: "#94a3b8" }}>{label}</th>)}</tr></thead>
            <tbody>
              {Object.entries(data.model_comparison).map(([name, row]) => (
                <tr key={name}>
                  <td style={{ padding: 9, borderBottom: "1px solid #334155" }}>{name}</td>
                  <td style={{ padding: 9, borderBottom: "1px solid #334155" }}>{Number(row.directional_accuracy_pct).toFixed(2)}%</td>
                  <td style={{ padding: 9, borderBottom: "1px solid #334155" }}>{Number(row.balanced_directional_accuracy_pct).toFixed(2)}%</td>
                  <td style={{ padding: 9, borderBottom: "1px solid #334155" }}>{Number(row.mae_return_pct).toFixed(3)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.6, marginBottom: 0 }}>{data.note}</p>
    </section>
  );
}

export default PredictionPerformance;
