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
          background: "#182322",
          padding: "25px",
          borderRadius: "14px",
          textAlign: "center",
          marginTop: "25px",
          color: "#aaa18f",
        }}
      >
        No portfolio data available
      </div>
    );
  }

  const tooltipStyle = {
    backgroundColor: "#151e1e",
    border: "1px solid #514c40",
    borderRadius: "8px",
    color: "#fff",
  };

  return (
    <div
      style={{
        background: "#182322",
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
          background: "#0b1118",
          padding: "20px",
          borderRadius: "12px",
        }}
      >
        <h3 style={{ color: "#eee5d5", marginBottom: "20px" }}>
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
                stroke="#514c40"
              />

              <XAxis
                dataKey="symbol"
                tick={{ fill: "#d8cbb3" }}
                axisLine={{ stroke: "#625840" }}
              />

              <YAxis
                tick={{ fill: "#d8cbb3" }}
                axisLine={{ stroke: "#625840" }}
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
          background: "#0b1118",
          padding: "20px",
          borderRadius: "12px",
          marginTop: "25px",
        }}
      >
        <h3 style={{ color: "#eee5d5", marginBottom: "20px" }}>
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
                stroke="#514c40"
              />

              <XAxis
                dataKey="symbol"
                tick={{ fill: "#d8cbb3" }}
                axisLine={{ stroke: "#625840" }}
              />

              <YAxis
                tick={{ fill: "#d8cbb3" }}
                axisLine={{ stroke: "#625840" }}
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