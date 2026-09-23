import asyncio
import yfinance as yf
from fastapi import WebSocket, WebSocketDisconnect


async def price_stream(websocket: WebSocket, symbol: str):

    await websocket.accept()

    try:
        while True:

            df = yf.download(
                symbol,
                period="1d",
                interval="1m",
                auto_adjust=False,
                progress=False
            )

            if not df.empty:

                latest = float(
                    df["Close"].dropna().iloc[-1].item()
                )

                await websocket.send_json({
                    "price": round(latest, 2)
                })

            else:
                print(f"NO LIVE PRICE: {symbol}")

            # Yahoo ko unnecessarily baar-baar hit nahi karenge
            await asyncio.sleep(15)

    except WebSocketDisconnect:
        print(f"WebSocket disconnected: {symbol}")

    except Exception as e:
        print("WS ERROR:", e)