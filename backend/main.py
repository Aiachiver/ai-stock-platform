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
from auth import create_token, verify_token

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
def buy(
    symbol: str,
    quantity: int = 1,
    db: Session = Depends(get_db),
    username: str = Depends(verify_token)
):
    if quantity <= 0:
        return {"error": "Quantity must be greater than 0"}

    price = get_price(symbol)

    if price is None:
        return {"error": "Unable to get current price"}

    # Current balance calculate karo
    trades = db.query(models.Trade).all()
    balance = 10000

    for t in trades:
        trade_quantity = t.quantity or 1

        if t.type == "BUY":
            balance -= t.price * trade_quantity

        elif t.type == "SELL":
            balance += t.price * trade_quantity

    # Order ki total cost
    order_value = price * quantity

    # Balance check
    if order_value > balance:
        return {
            "error": "Insufficient balance",
            "required": round(order_value, 2),
            "available": round(balance, 2)
        }

    trade = models.Trade(
        symbol=symbol,
        price=price,
        type="BUY",
        quantity=quantity
    )

    db.add(trade)
    db.commit()

    return {
        "msg": "bought",
        "symbol": symbol,
        "quantity": quantity,
        "price": price,
        "total": round(order_value, 2)
    }

# ================= SELL =================
@app.post("/sell/{symbol}")
def sell(
    symbol: str,
    quantity: int = 1,
    db: Session = Depends(get_db),
    username: str = Depends(verify_token)
):
    if quantity <= 0:
        return {"error": "Quantity must be greater than 0"}

    # Current holdings calculate karo
    trades = db.query(models.Trade).filter(
        models.Trade.symbol == symbol
    ).all()

    holdings = 0

    for t in trades:
        trade_quantity = t.quantity or 1

        if t.type == "BUY":
            holdings += trade_quantity
        elif t.type == "SELL":
            holdings -= trade_quantity

    # Check: jitne shares hain usse zyada sell na ho
    if quantity > holdings:
        return {
            "error": f"Not enough holdings. You have {holdings} {symbol} shares."
        }

    price = get_price(symbol)

    if price is None:
        return {"error": "Unable to get current price"}

    trade = models.Trade(
        symbol=symbol,
        price=price,
        type="SELL",
        quantity=quantity
    )

    db.add(trade)
    db.commit()

    return {
        "msg": "sold",
        "symbol": symbol,
        "quantity": quantity,
        "price": price
    }

# ================= HISTORY =================
@app.get("/history")
def history(
    db: Session = Depends(get_db),
    username: str = Depends(verify_token)
):
    return db.query(models.Trade).all()

# ================= PORTFOLIO =================
@app.get("/portfolio")
def portfolio(
    db: Session = Depends(get_db),
    username: str = Depends(verify_token)
):
    trades = db.query(models.Trade).all()

    balance = 10000
    holdings = 0

    for t in trades:
        quantity = t.quantity or 1

        if t.type == "BUY":
            balance -= t.price * quantity
            holdings += quantity

        elif t.type == "SELL":
            balance += t.price * quantity
            holdings -= quantity

    return {
        "balance": round(balance, 2),
        "holdings": holdings
    }

# ================= PORTFOLIO DETAILS =================
@app.get("/portfolio/details")
def portfolio_details(db: Session = Depends(get_db)):
    trades = db.query(models.Trade).order_by(models.Trade.id).all()

    balance = 10000
    positions = {}
    realized_profit = 0

    for t in trades:
        quantity = t.quantity or 1

        if t.symbol not in positions:
            positions[t.symbol] = {
                "quantity": 0,
                "total_cost": 0
            }

        position = positions[t.symbol]

        if t.type == "BUY":
            balance -= t.price * quantity

            position["quantity"] += quantity
            position["total_cost"] += t.price * quantity

        elif t.type == "SELL":

            # Sell se pehle available holdings check
            sell_quantity = min(quantity, position["quantity"])

            if sell_quantity > 0:
                average_price = (
                    position["total_cost"] / position["quantity"]
                )

                realized_profit += (
                    t.price - average_price
                ) * sell_quantity

                balance += t.price * sell_quantity

                position["quantity"] -= sell_quantity
                position["total_cost"] -= (
                    average_price * sell_quantity
                )

    invested = 0
    current_value = 0
    unrealized_profit = 0
    total_holdings = 0

    for symbol, position in positions.items():

        quantity = position["quantity"]

        if quantity <= 0:
            continue

        total_cost = position["total_cost"]

        average_price = total_cost / quantity

        current_price = get_price(symbol)

        if current_price is None:
            continue

        market_value = current_price * quantity

        invested += total_cost
        current_value += market_value
        total_holdings += quantity

        unrealized_profit += (
            market_value - total_cost
        )

    total_profit = realized_profit + unrealized_profit

    return {
        "balance": round(balance, 2),
        "holdings": total_holdings,
        "invested": round(invested, 2),
        "current": round(current_value, 2),
        "average_price": round(
            invested / total_holdings, 2
        ) if total_holdings > 0 else 0,
        "realized_profit": round(realized_profit, 2),
        "unrealized_profit": round(unrealized_profit, 2),
        "profit": round(total_profit, 2)
      }
# ================= PORTFOLIO POSITIONS =================
@app.get("/portfolio/positions")
def portfolio_positions(
    db: Session = Depends(get_db),
    username: str = Depends(verify_token)
):
    trades = db.query(models.Trade).order_by(models.Trade.id).all()

    positions = {}

    for t in trades:
        quantity = t.quantity or 1

        if t.symbol not in positions:
            positions[t.symbol] = {
                "quantity": 0,
                "total_cost": 0
            }

        position = positions[t.symbol]

        if t.type == "BUY":
            position["quantity"] += quantity
            position["total_cost"] += t.price * quantity

        elif t.type == "SELL":
            sell_quantity = min(quantity, position["quantity"])

            if sell_quantity > 0:
                average_price = (
                    position["total_cost"] / position["quantity"]
                )

                position["quantity"] -= sell_quantity
                position["total_cost"] -= (
                    average_price * sell_quantity
                )

    result = []

    for symbol, position in positions.items():

        quantity = position["quantity"]

        if quantity <= 0:
            continue

        average_price = position["total_cost"] / quantity
        current_price = get_price(symbol)

        if current_price is None:
            continue

        current_value = current_price * quantity
        profit = current_value - position["total_cost"]

        result.append({
            "symbol": symbol,
            "quantity": quantity,
            "average_price": round(average_price, 2),
            "current_price": round(current_price, 2),
            "current_value": round(current_value, 2),
            "profit": round(profit, 2)
        })

    return result
#========================== PORTFOLIO CHART =================
@app.get("/portfolio/chart")
def portfolio_chart(
    db: Session = Depends(get_db),
    username: str = Depends(verify_token)
):
    trades = db.query(models.Trade).order_by(models.Trade.id).all()

    positions = {}

    for t in trades:
        quantity = t.quantity or 1

        if t.symbol not in positions:
            positions[t.symbol] = {
                "quantity": 0,
                "invested": 0
            }

        if t.type == "BUY":
            positions[t.symbol]["quantity"] += quantity
            positions[t.symbol]["invested"] += t.price * quantity

        elif t.type == "SELL":
            current_qty = positions[t.symbol]["quantity"]

            if current_qty > 0:
                sell_qty = min(quantity, current_qty)
                avg_price = (
                    positions[t.symbol]["invested"] / current_qty
                )

                positions[t.symbol]["quantity"] -= sell_qty
                positions[t.symbol]["invested"] -= (
                    avg_price * sell_qty
                )

    result = []

    for symbol, position in positions.items():

        if position["quantity"] <= 0:
            continue

        current_price = get_price(symbol)

        if current_price is None:
            continue

        current_value = current_price * position["quantity"]

        result.append({
            "symbol": symbol,
            "invested": round(position["invested"], 2),
            "current_value": round(current_value, 2),
            "profit": round(
                current_value - position["invested"], 2
            )
        })

    return result
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