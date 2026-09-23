from sqlalchemy import Column, Integer, String, Float
from database import Base


class Trade(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, index=True)

    symbol = Column(String(20), nullable=False)

    price = Column(Float, nullable=False)

    type = Column(String(10), nullable=False)

    quantity = Column(Integer, default=1, nullable=False)