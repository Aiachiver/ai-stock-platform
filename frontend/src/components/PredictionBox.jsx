import React from "react";

function PredictionBox({ prediction }) {

  if (!prediction) return null;

  return (

    <div
      style={{
        display: "flex",
        justifyContent: "center"
      }}
    >

      <div
        style={{
          background: "#1e293b",
          padding: "20px",
          borderRadius: "12px",
          width: "300px",
          textAlign: "center"
        }}
      >

        <h3>Current Price</h3>
        <h2>${prediction.current_price}</h2>

        <h3>Predicted Price</h3>
        <h2>${prediction.predicted_price}</h2>

        <h2
          style={{
            color:
              prediction.signal === "BUY"
                ? "#22c55e"
                : "#ef4444"
          }}
        >
          {prediction.signal}
        </h2>

      </div>

    </div>

  );

}

export default PredictionBox;