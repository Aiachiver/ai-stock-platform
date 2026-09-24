import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# .env se DATABASE_URL load karo
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Supabase PostgreSQL connection
engine = create_engine(
    DATABASE_URL,
    echo=False
)

# Database sessions
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# SQLAlchemy base
Base = declarative_base()