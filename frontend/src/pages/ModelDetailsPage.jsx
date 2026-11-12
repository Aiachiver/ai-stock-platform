import React from "react";
import PredictionBox from "../components/PredictionBox";
import PredictionPerformance from "../components/PredictionPerformance";
import AdvancedIntelligence from "../components/AdvancedIntelligence";
import PremiumAnalytics from "../components/PremiumAnalytics";
import PortfolioRisk from "../components/PortfolioRisk";

function ModelDetailsPage({ symbol, prediction, performance, advancedIntelligence, insights, backtest, risk, premiumLoading }) {
  return (
    <main style={{ marginTop: 26 }}>
      <section style={{ padding: 22, borderRadius: 14, background: "#172554", border: "1px solid #1d4ed8", marginBottom: 18 }}>
        <span style={{ color: "#93c5fd", fontSize: 11, fontWeight: 800, letterSpacing: ".12em" }}>MODEL TRANSPARENCY</span>
        <h2 style={{ margin: "6px 0" }}>🧠 AI Model Details · {symbol}</h2>
        <p style={{ color: "#dbeafe", margin: 0, lineHeight: 1.7 }}>Forecast output, model identity, validation metrics, model comparison and advanced market intelligence. These are experimental research results, not guaranteed predictions or investment advice.</p>
      </section>
      <PredictionBox prediction={prediction} />
      <PredictionPerformance data={performance} loading={Boolean(performance?.loading)} />
      <AdvancedIntelligence data={advancedIntelligence} loading={Boolean(advancedIntelligence?.loading)} />
      <PremiumAnalytics insights={insights} backtest={backtest} loading={premiumLoading} />
      <PortfolioRisk data={risk} loading={premiumLoading} />
    </main>
  );
}
export default ModelDetailsPage;