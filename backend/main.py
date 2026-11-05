import os
from fastapi import FastAPI, Depends, WebSocket, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import engine, Base, SessionLocal
import models
from services.stock_service import get_stock_data
from services.quote_service import get_stock_quote
from services.prediction_service import get_prediction
from ml_model import evaluate_prediction
from services.premium_service import get_market_intelligence, get_strategy_backtest, get_portfolio_risk
from services.trade_service import get_price
from websocket import price_stream
from auth import create_token, verify_token
from security import hash_password, verify_password

Base.metadata.create_all(bind=engine)
app = FastAPI(
    title="TradeSight AI API",
    version="1.1.0",
    description=(
        "Educational stock research and paper-trading platform. "
        "Market data may be delayed. Model outputs are experimental and are not investment advice."
    ),
)
allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "*").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(username: str, db: Session):
    return db.query(models.User).filter(models.User.username == username).first()

def normalize_symbol(symbol: str):
    return symbol.strip().upper()

def calculate_user_positions(trades):
    positions = {}
    realized_profit = 0.0
    for trade in trades:
        quantity = trade.quantity or 1
        symbol = normalize_symbol(trade.symbol)
        position = positions.setdefault(symbol, {"quantity": 0, "total_cost": 0.0})
        if trade.type == "BUY":
            position["quantity"] += quantity
            position["total_cost"] += trade.price * quantity
        elif trade.type == "SELL" and position["quantity"] > 0:
            sell_quantity = min(quantity, position["quantity"])
            average_price = position["total_cost"] / position["quantity"]
            realized_profit += (trade.price - average_price) * sell_quantity
            position["quantity"] -= sell_quantity
            position["total_cost"] -= average_price * sell_quantity
    return positions, realized_profit

def get_portfolio_snapshot(trades):
    positions, realized_profit = calculate_user_positions(trades)
    invested = current_value = unrealized_profit = 0.0
    total_holdings = 0
    for symbol, position in positions.items():
        quantity = position["quantity"]
        if quantity <= 0:
            continue
        current_price = get_price(symbol)
        if current_price is None:
            continue
        total_cost = position["total_cost"]
        market_value = current_price * quantity
        invested += total_cost
        current_value += market_value
        total_holdings += quantity
        unrealized_profit += market_value - total_cost
    return {"positions": positions,"realized_profit": realized_profit,"invested": invested,"current_value": current_value,"unrealized_profit": unrealized_profit,"total_profit": realized_profit + unrealized_profit,"holdings": total_holdings}

@app.get("/")
def home():
    return {"msg": "Backend is running 🚀"}

@app.get("/health")
def health():
    return {"status": "ok", "service": "tradesight-ai-api"}


@app.get("/platform/status")
def platform_status():
    """Public product-mode and data-provenance disclosure for clients."""
    return {
        "platform": "TradeSight AI",
        "mode": "paper_trading",
        "real_order_execution": False,
        "market_data_provider": "Yahoo Finance via yfinance",
        "market_data_note": "Quotes may be delayed and are not an exchange-grade real-time feed.",
        "prediction_horizon": "Next trading session",
        "prediction_status": "Experimental model output; not investment advice or a guaranteed result.",
        "risk_disclosure": "Historical model metrics do not guarantee future performance.",
    }

@app.get("/stock/{symbol}")
def stock(symbol: str):
    try:
        return {"ohlc": get_stock_data(normalize_symbol(symbol))}
    except Exception as e:
        return {"error": str(e), "ohlc": []}

@app.get("/quote/{symbol}")
def stock_quote(symbol: str):
    try:
        return get_stock_quote(normalize_symbol(symbol))
    except Exception as e:
        return {"symbol": normalize_symbol(symbol), "error": str(e)}

@app.get("/performance/{symbol}")
def prediction_performance(symbol: str):
    return evaluate_prediction(normalize_symbol(symbol))

@app.get("/predict/{symbol}")
def predict(symbol: str):
    try:
        return get_prediction(normalize_symbol(symbol))
    except Exception as e:
        return {"error": str(e)}

@app.post("/buy/{symbol}")
def buy(symbol: str, quantity: int = 1, db: Session = Depends(get_db), username: str = Depends(verify_token)):
    symbol = normalize_symbol(symbol)
    if quantity <= 0:
        return {"error": "Quantity must be greater than 0"}
    user = get_current_user(username, db)
    if not user:
        return {"error": "User not found"}
    price = get_price(symbol)
    if price is None:
        return {"error": "Unable to get current price"}
    order_value = price * quantity
    if order_value > user.balance:
        return {"error": "Insufficient balance", "required": round(order_value, 2), "available": round(user.balance, 2)}
    try:
        user.balance -= order_value
        db.add(models.Trade(symbol=symbol, price=price, type="BUY", quantity=quantity, user_id=user.id))
        db.commit()
        return {"msg": "bought", "symbol": symbol, "quantity": quantity, "price": price, "total": round(order_value, 2), "balance": round(user.balance, 2)}
    except Exception as e:
        db.rollback()
        return {"error": f"Buy failed: {str(e)}"}

@app.post("/sell/{symbol}")
def sell(symbol: str, quantity: int = 1, db: Session = Depends(get_db), username: str = Depends(verify_token)):
    symbol = normalize_symbol(symbol)
    if quantity <= 0:
        return {"error": "Quantity must be greater than 0"}
    user = get_current_user(username, db)
    if not user:
        return {"error": "User not found"}
    trades = db.query(models.Trade).filter(models.Trade.user_id == user.id, models.Trade.symbol == symbol).order_by(models.Trade.id).all()
    holdings = 0
    for trade in trades:
        trade_quantity = trade.quantity or 1
        holdings += trade_quantity if trade.type == "BUY" else -trade_quantity if trade.type == "SELL" else 0
    if quantity > holdings:
        return {"error": f"Not enough holdings. You have {holdings} {symbol} shares."}
    price = get_price(symbol)
    if price is None:
        return {"error": "Unable to get current price"}
    total = price * quantity
    try:
        user.balance += total
        db.add(models.Trade(symbol=symbol, price=price, type="SELL", quantity=quantity, user_id=user.id))
        db.commit()
        return {"msg": "sold", "symbol": symbol, "quantity": quantity, "price": price, "total": round(total, 2), "balance": round(user.balance, 2)}
    except Exception as e:
        db.rollback()
        return {"error": f"Sell failed: {str(e)}"}

@app.get("/history")
def history(db: Session = Depends(get_db), username: str = Depends(verify_token)):
    user = get_current_user(username, db)
    if not user:
        return {"error": "User not found"}
    return db.query(models.Trade).filter(models.Trade.user_id == user.id).order_by(models.Trade.id).all()

@app.get("/portfolio")
def portfolio(db: Session = Depends(get_db), username: str = Depends(verify_token)):
    user = get_current_user(username, db)
    if not user:
        return {"error": "User not found"}
    trades = db.query(models.Trade).filter(models.Trade.user_id == user.id).order_by(models.Trade.id).all()
    snapshot = get_portfolio_snapshot(trades)
    return {"balance": round(user.balance, 2), "holdings": snapshot["holdings"], "invested": round(snapshot["invested"], 2), "current": round(snapshot["current_value"], 2), "profit": round(snapshot["total_profit"], 2)}

@app.get("/portfolio/details")
def portfolio_details(db: Session = Depends(get_db), username: str = Depends(verify_token)):
    user = get_current_user(username, db)
    if not user:
        return {"error": "User not found"}
    trades = db.query(models.Trade).filter(models.Trade.user_id == user.id).order_by(models.Trade.id).all()
    snapshot = get_portfolio_snapshot(trades)
    holdings = snapshot["holdings"]
    invested = snapshot["invested"]
    return {"balance": round(user.balance, 2), "holdings": holdings, "invested": round(invested, 2), "current": round(snapshot["current_value"], 2), "average_price": round(invested / holdings, 2) if holdings > 0 else 0, "realized_profit": round(snapshot["realized_profit"], 2), "unrealized_profit": round(snapshot["unrealized_profit"], 2), "profit": round(snapshot["total_profit"], 2)}

@app.get("/portfolio/positions")
def portfolio_positions(db: Session = Depends(get_db), username: str = Depends(verify_token)):
    user = get_current_user(username, db)
    if not user:
        return {"error": "User not found"}
    trades = db.query(models.Trade).filter(models.Trade.user_id == user.id).order_by(models.Trade.id).all()
    positions, _ = calculate_user_positions(trades)
    result = []
    for symbol, position in positions.items():
        quantity = position["quantity"]
        if quantity <= 0:
            continue
        current_price = get_price(symbol)
        if current_price is None:
            continue
        average_price = position["total_cost"] / quantity
        current_value = current_price * quantity
        profit = current_value - position["total_cost"]
        result.append({"symbol": symbol,"quantity": quantity,"average_price": round(average_price, 2),"current_price": round(current_price, 2),"current_value": round(current_value, 2),"invested": round(position["total_cost"], 2),"profit": round(profit, 2),"profit_percent": round((profit / position["total_cost"]) * 100, 2) if position["total_cost"] > 0 else 0})
    return result

@app.get("/portfolio/chart")
def portfolio_chart(db: Session = Depends(get_db), username: str = Depends(verify_token)):
    user = get_current_user(username, db)
    if not user:
        return {"error": "User not found"}
    trades = db.query(models.Trade).filter(models.Trade.user_id == user.id).order_by(models.Trade.id).all()
    positions, _ = calculate_user_positions(trades)
    result = []
    for symbol, position in positions.items():
        quantity = position["quantity"]
        if quantity <= 0:
            continue
        current_price = get_price(symbol)
        if current_price is None:
            continue
        current_value = current_price * quantity
        invested = position["total_cost"]
        result.append({"symbol": symbol,"invested": round(invested, 2),"current_value": round(current_value, 2),"profit": round(current_value - invested, 2)})
    return result

@app.get("/insights/{symbol}")
def market_intelligence(symbol: str):
    try:
        return get_market_intelligence(normalize_symbol(symbol))
    except Exception as e:
        return {"symbol": normalize_symbol(symbol), "error": "Market intelligence is temporarily unavailable"}

@app.get("/backtest/{symbol}")
def strategy_backtest(symbol: str, fast_window: int = 20, slow_window: int = 50):
    try:
        return get_strategy_backtest(normalize_symbol(symbol), fast_window, slow_window)
    except Exception as e:
        return {"error": "Unable to run strategy backtest"}

@app.get("/portfolio/risk")
def portfolio_risk(db: Session = Depends(get_db), username: str = Depends(verify_token)):
    user = get_current_user(username, db)
    if not user:
        return {"error": "User not found"}
    trades = db.query(models.Trade).filter(models.Trade.user_id == user.id).order_by(models.Trade.id).all()
    try:
        return get_portfolio_risk(trades)
    except Exception:
        return {"error": "Unable to calculate portfolio risk"}

@app.websocket("/ws/{symbol}")
async def websocket_endpoint(websocket: WebSocket, symbol: str):
    await price_stream(websocket, normalize_symbol(symbol))

class LoginData(BaseModel):
    username: str
    password: str

@app.post("/login")
def login(data: LoginData, db: Session = Depends(get_db)):
    username = data.username.strip()
    if not username or not data.password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username and password are required")

    user = db.query(models.User).filter(models.User.username == username).first()
    if not user or not verify_password(data.password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    # Migrate legacy plaintext passwords to bcrypt after a successful login.
    if not user.password.startswith(("$2a$", "$2b$", "$2y$")):
        user.password = hash_password(data.password)
        db.commit()

    return {"status": "success", "token": create_token(user.username)}

@app.get("/me")
def current_user(db: Session = Depends(get_db), username: str = Depends(verify_token)):
    user = get_current_user(username, db)
    if not user:
        return {"error": "User not found"}
    return {"id": user.id, "username": user.username, "balance": round(user.balance, 2)}

@app.post("/register")
def register(data: LoginData, db: Session = Depends(get_db)):
    username = data.username.strip()
    if len(username) < 3 or len(username) > 50:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Username must be 3–50 characters")
    if len(data.password) < 8:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Password must be at least 8 characters")
    if len(data.password.encode("utf-8")) > 72:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Password must be at most 72 UTF-8 bytes")
    existing_user = db.query(models.User).filter(models.User.username == username).first()
    if existing_user:
        return {"status": "fail", "message": "Username already exists"}
    new_user = models.User(username=username, password=hash_password(data.password), balance=10000.0)
    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return {"status": "success", "message": "Registration successful", "user_id": new_user.id}
    except Exception:
        db.rollback()
        return {"status": "fail", "message": "Registration failed. Please try again."}
