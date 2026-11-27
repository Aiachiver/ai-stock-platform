import asyncio
from starlette.concurrency import run_in_threadpool
from fastapi import WebSocket, WebSocketDisconnect

from services.trade_service import get_price


async def price_stream(websocket: WebSocket, symbol: str):
    """Stream provider snapshots without blocking FastAPI's event loop."""
    await websocket.accept()
    try:
        while True:
            try:
                latest = await run_in_threadpool(get_price, symbol)
                if latest is not None:
                    await websocket.send_json({"price": round(float(latest), 2)})
                else:
                    await websocket.send_json({"status": "unavailable", "symbol": symbol})
            except WebSocketDisconnect:
                raise
            except Exception:
                # A transient quote-provider failure must not crash the API loop.
                await websocket.send_json({"status": "unavailable", "symbol": symbol})
            await asyncio.sleep(15)
    except WebSocketDisconnect:
        return
