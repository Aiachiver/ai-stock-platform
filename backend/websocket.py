import asyncio
import yfinance as yf

async def price_stream(websocket, symbol):

    await websocket.accept()

    while True:

        try:

            df = yf.download(
                symbol,
                period="1d",
                interval="1m",
                auto_adjust=False
            )

            latest = float(
                df["Close"].dropna().iloc[-1].item()
            )

            await websocket.send_json({
                "price": round(latest, 2)
            })

            await asyncio.sleep(5)

        except Exception as e:

            print("WS ERROR:", e)

            await asyncio.sleep(5)