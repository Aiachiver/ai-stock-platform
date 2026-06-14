import React from "react";
import { ChartCanvas, Chart } from "react-financial-charts";
import { CandlestickSeries } from "react-financial-charts";

function CandleChart({ data }) {
  if (!data || data.length === 0) return null;

  return (
    <ChartCanvas
      height={400}
      width={800}
      ratio={1}
      seriesName="Data"
      data={data}
      xAccessor={(d) => new Date(d.time)}
      xScaleProvider={() => {}}
    >
      <Chart id={1} yExtents={(d) => [d.high, d.low]}>
        <CandlestickSeries />
      </Chart>
    </ChartCanvas>
  );
}

export default CandleChart;