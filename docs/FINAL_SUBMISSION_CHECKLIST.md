# Final Submission Checklist — TradeSight AI

## Project scope
TradeSight AI is an educational stock-research and paper-trading application. It uses historical market data, experimental machine-learning estimates, research indicators and simulated portfolio transactions. It does not connect to a broker or place real orders.

## Main modules
- React frontend for market overview, charts, prediction results, portfolio and simulated trades.
- FastAPI backend for authentication, market data, prediction, model evaluation and portfolio APIs.
- SQLAlchemy persistence with PostgreSQL in deployment.
- Yahoo Finance via yfinance for historical/quote data.
- scikit-learn models for experimental next-session estimates and V3.1 probability-based research.

## Production configuration
Backend hosting (Render):
- DATABASE_URL: configured PostgreSQL connection string.
- JWT_SECRET: unique random secret with at least 32 characters.
- ALLOWED_ORIGINS: exact deployed frontend origin, e.g. https://ai-stock-platform-nine.vercel.app.
- Install dependencies from backend/requirements.txt.

Frontend hosting (Vercel):
- REACT_APP_API_URL=https://tradesight-ai-backend.onrender.com
- Redeploy after changing environment variables.

Never commit .env files, JWT secrets, database passwords or API credentials.

## Smoke tests
Public endpoints:
- GET /health
- GET /platform/status
- GET /quote/AAPL
- GET /stock/AAPL
- GET /predict/AAPL
- GET /performance/AAPL
- GET /intelligence/AAPL

Authenticated endpoints (send Authorization: Bearer <JWT>):
- GET /portfolio
- GET /portfolio/details
- GET /portfolio/positions
- GET /portfolio/chart
- GET /history
- POST /buy/{symbol}
- POST /sell/{symbol}

For a local backend test, from the backend directory:
```bash
pip install -r requirements.txt
python -m unittest discover -s tests -v
uvicorn main:app --reload
```

For the frontend:
```bash
cd frontend
npm ci
npm run build
```

## Current verification record
The following were manually smoke-tested against the deployed backend by the project owner:
- /platform/status returned a successful JSON response.
- /portfolio/details returned portfolio balance, holdings, invested value and current value when called with a valid JWT.
- /intelligence/AAPL returned a V3 JSON response with 2,312 observations and 347 final test samples.

Observed AAPL V3 result at the time of testing:
- Directional accuracy: 53.31%.
- Balanced accuracy: 49.47%.
- Brier score: 0.24874.
- High-confidence coverage: 0%.
- Paper strategy exposure and return: 0%.
- Buy-and-hold return over that test window: 78.65%.

These are historical, symbol- and period-specific diagnostics, not expected future performance. They do not establish a profitable strategy or 70–80% accuracy.

## Known limitations to disclose in a college submission
- Yahoo Finance data can be delayed, revised, incomplete or unavailable.
- Forecasts are experimental and may abstain with NO TRADE when confidence is below the configured threshold.
- Backtests are simplified and do not fully represent taxes, brokerage, slippage, liquidity, market impact or corporate actions.
- Market regime proxy is currently the S&P 500; this is not ideal for every non-US listed stock.
- No live brokerage execution, guaranteed return, or personalized investment advice is provided.
- Legal, regulatory and market-data licensing review is required before commercial investment-recommendation use.

## Final release gate
Before calling the submission fully deployed, verify:
1. Render deployment is Live and /health returns status=ok.
2. Vercel production build completes and the live dashboard loads without console errors.
3. Login/register, stock switching, charts and model panels work.
4. Paper BUY/SELL updates balance, holdings, history and P&L correctly.
5. Mobile layout is usable.
6. All environment variables are set in hosting dashboards, not committed to Git.
7. The final GitHub PR is reviewed and merged, then both hosts complete a fresh deployment.
