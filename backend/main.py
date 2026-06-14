from fastapi import FastAPI, Depends, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import engine, Base, SessionLocal
import models

from services.stock_service import get_stock_data
from services.prediction_service import get_prediction
from services.trade_service import get_price

from websocket import price_stream
from auth import create_token

# ================= DB INIT =================
Base.metadata.create_all(bind=engine)

app = FastAPI()

# ================= CORS =================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= ROOT =================
@app.get("/")
def home():
    return {"msg": "Backend is running 🚀"}

# ================= DB SESSION =================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ================= STOCK =================
@app.get("/stock/{symbol}")
def stock(symbol: str):

    try:

        data = get_stock_data(symbol)

        return {
            "ohlc": data
        }

    except Exception as e:

        return {
            "error": str(e)
        }

# ================= PREDICTION =================
@app.get("/predict/{symbol}")
def predict(symbol: str):
    return get_prediction(symbol)

# ================= BUY =================
@app.post("/buy/{symbol}")
def buy(symbol: str, db: Session = Depends(get_db)):

    price = get_price(symbol)

    trade = models.Trade(
        symbol=symbol,
        price=price,
        type="BUY"
    )

    db.add(trade)
    db.commit()

    return {
        "msg": "bought",
        "symbol": symbol,
        "price": price
    }

# ================= SELL =================
@app.post("/sell/{symbol}")
def sell(symbol: str, db: Session = Depends(get_db)):

    price = get_price(symbol)

    trade = models.Trade(
        symbol=symbol,
        price=price,
        type="SELL"
    )

    db.add(trade)
    db.commit()

    return {
        "msg": "sold",
        "symbol": symbol,
        "price": price
    }

# ================= HISTORY =================
@app.get("/history")
def history(db: Session = Depends(get_db)):
    return db.query(models.Trade).all()

# ================= PORTFOLIO =================
@app.get("/portfolio")
def portfolio(db: Session = Depends(get_db)):

    trades = db.query(models.Trade).all()

    balance = 10000
    holdings = 0

    for t in trades:

        if t.type == "BUY":
            balance -= t.price
            holdings += 1

        else:
            balance += t.price
            holdings -= 1

    return {
        "balance": round(balance, 2),
        "holdings": holdings
    }

# ================= PORTFOLIO DETAILS =================
@app.get("/portfolio/details")
def portfolio_details(db: Session = Depends(get_db)):

    trades = db.query(models.Trade).all()

    balance = 10000
    invested = 0
    current_value = 0

    for t in trades:

        current_price = get_price(t.symbol)

        if t.type == "BUY":

            invested += t.price
            current_value += current_price

            balance -= t.price

        else:

            invested -= t.price
            current_value -= current_price

            balance += t.price

    profit = current_value - invested

    return {
        "balance": round(balance, 2),
        "invested": round(invested, 2),
        "current": round(current_value, 2),
        "profit": round(profit, 2)
    }

# ================= WEBSOCKET =================
@app.websocket("/ws/{symbol}")
async def websocket_endpoint(websocket: WebSocket, symbol: str):

    await price_stream(websocket, symbol)

# ================= LOGIN =================
class LoginData(BaseModel):
    username: str
    password: str

users = {
    "admin": "1234"
}

@app.post("/login")
def login(data: LoginData):

    if (
        data.username in users
        and users[data.username] == data.password
    ):

        token = create_token(data.username)

        return {
            "status": "success",
            "token": token
        }

    return {
        "status": "fail"
    }