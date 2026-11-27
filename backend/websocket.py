import asyncio
import json
from starlette.concurrency import run_in_threadpool
from fastapi import WebSocket, WebSocketDisconnect
import websockets

from services.trade_service import get_price

BINANCE_SYMBOLS = {
    "BTC-USD": "btcusdt", "ETH-USD": "ethusdt", "SOL-USD": "solusdt",
    "XRP-USD": "xrpusdt", "DOGE-USD": "dogeusdt", "BNB-USD": "bnbusdt",
}


async def price_stream(websocket: WebSocket, symbol: str):
    """Legacy polling stream for non-crypto symbols."""
    await websocket.accept()
    try:
        while True:
            try:
                latest = await run_in_threadpool(get_price, symbol)
                if latest is not None:
                    await websocket.send_json({"price": round(float(latest), 2), "source": "Yahoo Finance snapshot"})
                else:
                    await websocket.send_json({"status": "unavailable", "symbol": symbol})
            except WebSocketDisconnect:
                raise
            except Exception:
                await websocket.send_json({"status": "unavailable", "symbol": symbol})
            await asyncio.sleep(15)
    except WebSocketDisconnect:
        return


async def crypto_trade_stream(websocket: WebSocket, symbol: str):
    """Proxy Binance public trade ticks to the browser over a persistent socket."""
    pair = BINANCE_SYMBOLS.get(symbol.upper())
    await websocket.accept()
    if not pair:
        await websocket.send_json({"status": "unsupported_symbol", "symbol": symbol})
        await websocket.close(code=1008)
        return
    url = f"wss://stream.binance.com:9443/ws/{pair}@trade"
    try:
        while True:
            try:
                async with websockets.connect(url, ping_interval=20, ping_timeout=20, close_timeout=5) as upstream:
                    await websocket.send_json({"status": "connected", "symbol": symbol, "source": "Binance Spot public trade stream"})
                    async for raw in upstream:
                        trade = json.loads(raw)
                        await websocket.send_json({
                            "price": float(trade["p"]),
                            "quantity": float(trade["q"]),
                            "event_time": int(trade["T"]),
                            "source": "Binance Spot",
                        })
            except WebSocketDisconnect:
                raise
            except Exception as exc:
                print(f"CRYPTO STREAM DISCONNECTED ({symbol}): {exc}")
                try:
                    await websocket.send_json({"status": "reconnecting", "source": "Binance Spot"})
                except Exception:
                    break
                await asyncio.sleep(2)
    except WebSocketDisconnect:
        return
