from sqlalchemy import Column, Integer, String, Float
from database import Base

class Trade(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String)
    price = Column(Float)
    type = Column(String)