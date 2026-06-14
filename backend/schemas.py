from pydantic import BaseModel

class TradeSchema(BaseModel):
    symbol: str
    price: float
    type: str