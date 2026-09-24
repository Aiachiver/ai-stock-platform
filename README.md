AI Stock Trading Platform

Full-stack stock dashboard with React, FastAPI, MySQL, JWT authentication, live WebSocket prices, ML prediction, paper trading, multi-user portfolios, weighted-average cost basis and realized/unrealized P/L.

Frontend

Copy .env.example to .env.

Set VITE_API_URL to the FastAPI backend URL.

Install dependencies and start the Vite app.

Backend

Run FastAPI from the backend directory with the project's virtual environment activated.

Health check:

GET /health

Important production setting

The frontend no longer needs a hard-coded API URL. Set VITE_API_URL to the deployed backend URL before the production build.

The backend CORS configuration is ready for browser requests. For a locked-down production deployment, replace allow_origins=["*"] with the exact frontend origin.

Trading behavior

BUY reduces the logged-in user's cash balance. SELL increases that user's cash balance. Multiple BUY transactions use a weighted-average cost basis. Partial SELL reduces the remaining cost basis and records realized P/L. Open positions report unrealized P/L using the current market price.