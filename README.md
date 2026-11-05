# TradeSight AI

TradeSight AI is an educational stock-research and paper-trading workspace built with React, FastAPI, SQLAlchemy and scikit-learn.

It combines market snapshots, historical OHLC charts, experimental next-session model estimates, transparent model evaluation, headline-keyword sentiment, simple strategy research and simulated portfolio tracking.

## Product capabilities

- **Market overview:** quote snapshot, previous close, day range, company metadata and historical OHLC.
- **Experimental ML forecasts:** chronological model selection across tree-based regressors, technical features and next-session estimates.
- **Model transparency:** chronological holdout metrics, balanced directional accuracy, signal accuracy/coverage, MAE, RMSE, MAPE and actual-versus-estimated chart.
- **Research tools:** Yahoo Finance headline keyword sentiment and moving-average strategy simulations.
- **Portfolio analytics:** simulated holdings, realized/unrealized P&L, allocation, historical volatility, VaR estimate and drawdown estimate.
- **Paper trading:** simulated cash and positions only. No broker connection or real order routing is implemented.
- **Account security:** bcrypt password hashes, bearer JWT sessions and legacy plaintext-password migration at successful login.

## Technology

- Frontend: React, Axios, ApexCharts, Recharts
- Backend: FastAPI, SQLAlchemy, PostgreSQL
- Data: Yahoo Finance through yfinance (may be delayed and is not an exchange-grade real-time feed)
- ML: pandas, NumPy, scikit-learn

## Local setup

### Backend

1. Create and activate a Python virtual environment.
2. Install dependencies:

   ```bash
   pip install -r backend/requirements.txt
   ```

3. Set the variables in `backend/.env.example` in your environment (do not commit real credentials).
4. Run from the backend directory:

   ```bash
   uvicorn main:app --reload
   ```

### Frontend

1. Copy `frontend/.env.example` to `frontend/.env`.
2. Set `REACT_APP_API_URL` to your FastAPI URL.
3. Install and start:

   ```bash
   cd frontend
   npm install
   npm start
   ```

## Production environment

Configure these values in the backend hosting provider:

- `DATABASE_URL`: PostgreSQL connection string.
- `JWT_SECRET`: unique random secret of at least 32 characters. Generate one with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Do not use a sample or commit it.
- `ALLOWED_ORIGINS`: comma-separated exact frontend origins, for example `https://your-app.vercel.app`. Avoid wildcard origins for a public production deployment.
- Frontend build variable: `REACT_APP_API_URL=https://your-api.onrender.com`.

**JWT secret rotation invalidates existing login sessions.** Users will need to sign in again after changing it.

## API quick reference

- `GET /` – service greeting
- `GET /health` – health check
- `GET /platform/status` – product mode and data-source disclosure
- `GET /quote/{symbol}` – market quote snapshot
- `GET /stock/{symbol}` – historical OHLC data
- `GET /predict/{symbol}` – experimental next-session estimate
- `GET /performance/{symbol}` – chronological holdout and model comparison
- `GET /insights/{symbol}` – headline keyword sentiment
- `GET /backtest/{symbol}` – historical moving-average simulation
- `GET /portfolio/risk` – authenticated paper-portfolio risk estimates
- `POST /buy/{symbol}` and `POST /sell/{symbol}` – authenticated simulated trades only

## Important limitations and disclosures

- Predictions are experimental statistical estimates, not guarantees, and are not personalized investment advice.
- Historical metrics are sample- and period-dependent. Validation results are not the same as final holdout results. Do not advertise a single accuracy figure without its symbol, horizon, test dates, sample count, benchmark and evaluation method.
- Signal accuracy is measured only on signals that cross the model's threshold. Signal coverage must be shown beside it.
- Headline sentiment is a simple keyword heuristic, not a contextual NLP model.
- Strategy backtests are historical simulations and currently do not fully model taxes, brokerage, slippage, liquidity, market impact or corporate actions.
- Yahoo Finance data may be delayed, incomplete or unavailable. Review provider terms and obtain appropriate market-data rights before commercial redistribution.
- This repository does not connect to a broker and does not route real orders.

## Commercial and regulatory readiness

This codebase is a software prototype, not a representation that the operator is registered or authorised to provide investment advice, research recommendations or algorithmic execution services. Before monetising recommendations, distributing paid research, making public performance claims, or enabling real-money order routing—especially for users in India—obtain a qualified legal/compliance review and confirm applicable SEBI, exchange, market-data licensing, privacy and consumer-protection requirements.

Useful official references:
- [SEBI Investment Adviser Regulations](https://www.sebi.gov.in/legal/regulations/nov-2025/securities-and-exchange-board-of-india-investment-advisers-regulations-2013-and-securities-last-amended-on-november-25-2025-_98246.html)
- [SEBI Research Analyst Regulations](https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=1&ssid=3)
- [SEBI caution on unregulated algorithmic-trading platforms](https://www.sebi.gov.in/media/press-releases/jun-2022/caution-to-investors-against-dealing-with-unregulated-platforms-offering-algorithmic-trading_59672.html)

## License

Add a license and third-party data/library notices before external commercial distribution.
