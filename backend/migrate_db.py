import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

LOCAL_DATABASE_URL = os.getenv("LOCAL_DATABASE_URL")
SUPABASE_DATABASE_URL = os.getenv("DATABASE_URL")

if not LOCAL_DATABASE_URL:
    raise ValueError("LOCAL_DATABASE_URL missing in .env")

if not SUPABASE_DATABASE_URL:
    raise ValueError("DATABASE_URL missing in .env")

mysql_engine = create_engine(LOCAL_DATABASE_URL)
supabase_engine = create_engine(SUPABASE_DATABASE_URL)

print("Reading users from MySQL...")

with mysql_engine.connect() as mysql:
    users = mysql.execute(text("""
        SELECT id, username, password, balance
        FROM users
        ORDER BY id
    """)).mappings().all()

print(f"Users found: {len(users)}")

print("Reading trades from MySQL...")

with mysql_engine.connect() as mysql:
    trades = mysql.execute(text("""
        SELECT id, symbol, price, type, quantity, user_id
        FROM trades
        ORDER BY id
    """)).mappings().all()

print(f"Trades found: {len(trades)}")

with supabase_engine.begin() as db:
    for user in users:
        db.execute(
            text("""
                INSERT INTO users
                (id, username, password, balance)
                VALUES
                (:id, :username, :password, :balance)
                ON CONFLICT (id) DO NOTHING
            """),
            user
        )

    for trade in trades:
        db.execute(
            text("""
                INSERT INTO trades
                (id, symbol, price, type, quantity, user_id)
                VALUES
                (:id, :symbol, :price, :type, :quantity, :user_id)
                ON CONFLICT (id) DO NOTHING
            """),
            trade
        )

    db.execute(text("""
        SELECT setval(
            pg_get_serial_sequence('users', 'id'),
            COALESCE((SELECT MAX(id) FROM users), 1),
            true
        )
    """))

    db.execute(text("""
        SELECT setval(
            pg_get_serial_sequence('trades', 'id'),
            COALESCE((SELECT MAX(id) FROM trades), 1),
            true
        )
    """))

print("Migration completed successfully.")