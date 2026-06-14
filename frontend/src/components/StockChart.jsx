import React from "react";
import Chart from "react-apexcharts";

function StockChart({ data }) {

  // SAFE CHECK
  if (
    !data ||
    !Array.isArray(data) ||
    data.length === 0
  ) {
    return (
      <h2 style={{ color: "black" }}>
        No chart data
      </h2>
    );
  }

  const validData = data.filter(
    (item) =>

      item &&
      item.open !== undefined &&
      item.high !== undefined &&
      item.low !== undefined &&
      item.close !== undefined
  );

  if (validData.length === 0) {
    return (
      <h2 style={{ color: "black" }}>
        Invalid chart data
      </h2>
    );
  }

  const series = [
    {
      data: validData.map((item) => ({
        x: String(item.time),

        y: [
          Number(item.open),
          Number(item.high),
          Number(item.low),
          Number(item.close)
        ]
      }))
    }
  ];

  const options = {

    chart: {
      type: "candlestick",
      height: 500,
      animations: {
        enabled: true
      },
      toolbar: {
        show: true
      }
    },

    title: {
      text: "Live Candlestick Chart",
      align: "left"
    },

    xaxis: {
      type: "category"
    },

    yaxis: {
      tooltip: {
        enabled: true
      }
    }

  };

  return (

    <Chart
      options={options}
      series={series}
      type="candlestick"
      height={500}
    />

  );

}

export default StockChart;