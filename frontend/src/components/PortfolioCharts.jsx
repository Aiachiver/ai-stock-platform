import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";

function PortfolioCharts({ data }) {
  if (!data || data.length === 0) {
    return (
      <div
        style={{
          background: "#1e293b",
          padding: "25px",
          borderRadius: "14px",
          textAlign: "center",
          marginTop: "25px",
          color: "#94a3b8",
        }}
      >
        No portfolio data available
      </div>
    );
  }

  const tooltipStyle = {
    backgroundColor: "#111827",
    border: "1px solid #334155",
    borderRadius: "8px",
    color: "#fff",
  };

  return (
    <div
      style={{
        background: "#1e293b",
        padding: "25px",
        borderRadius: "14px",
        marginTop: "25px",
        boxShadow: "0 8px 25px rgba(0,0,0,0.18)",
      }}
    >
      <h2
        style={{
          textAlign: "center",
          color: "#fff",
          marginBottom: "30px",
        }}
      >
        📊 Portfolio Overview
      </h2>

      {/* INVESTED VS CURRENT VALUE */}
      <div
        style={{
          background: "#0f172a",
          padding: "20px",
          borderRadius: "12px",
        }}
      >
        <h3 style={{ color: "#e2e8f0", marginBottom: "20px" }}>
          Invested vs Current Value
        </h3>

        <div style={{ width: "100%", height: "350px" }}>
          <ResponsiveContainer>
            <BarChart
              data={data}
              margin={{
                top: 10,
                right: 20,
                left: 10,
                bottom: 10,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#334155"
              />

              <XAxis
                dataKey="symbol"
                tick={{ fill: "#cbd5e1" }}
                axisLine={{ stroke: "#475569" }}
              />

              <YAxis
                tick={{ fill: "#cbd5e1" }}
                axisLine={{ stroke: "#475569" }}
              />

              <Tooltip contentStyle={tooltipStyle} />

              <Legend />

              <Bar
                dataKey="invested"
                name="Invested"
                fill="#3b82f6"
                radius={[6, 6, 0, 0]}
              />

              <Bar
                dataKey="current_value"
                name="Current Value"
                fill="#22c55e"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* PROFIT / LOSS */}
      <div
        style={{
          background: "#0f172a",
          padding: "20px",
          borderRadius: "12px",
          marginTop: "25px",
        }}
      >
        <h3 style={{ color: "#e2e8f0", marginBottom: "20px" }}>
          Profit / Loss
        </h3>

        <div style={{ width: "100%", height: "300px" }}>
          <ResponsiveContainer>
            <BarChart
              data={data}
              margin={{
                top: 10,
                right: 20,
                left: 10,
                bottom: 10,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#334155"
              />

              <XAxis
                dataKey="symbol"
                tick={{ fill: "#cbd5e1" }}
                axisLine={{ stroke: "#475569" }}
              />

              <YAxis
                tick={{ fill: "#cbd5e1" }}
                axisLine={{ stroke: "#475569" }}
              />

              <Tooltip contentStyle={tooltipStyle} />

              <Bar
                dataKey="profit"
                name="P/L"
                radius={[6, 6, 0, 0]}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.profit >= 0 ? "#22c55e" : "#ef4444"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default PortfolioCharts;