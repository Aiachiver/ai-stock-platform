from sqlalchemy import Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    username = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True
    )

    password = Column(
        String(255),
        nullable=False
    )

    balance = Column(
        Float,
        default=10000.0,
        nullable=False
    )

    trades = relationship(
        "Trade",
        back_populates="user",
        cascade="all, delete-orphan"
    )


class Trade(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, index=True)

    symbol = Column(
        String(20),
        nullable=False
    )

    price = Column(
        Float,
        nullable=False
    )

    type = Column(
        String(10),
        nullable=False
    )

    quantity = Column(
        Integer,
        default=1,
        nullable=False
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    user = relationship(
        "User",
        back_populates="trades"
    )