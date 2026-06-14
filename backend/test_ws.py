import asyncio
import websockets

async def test():
    uri = "ws://127.0.0.1:8000/ws/AAPL"

    print("Connecting...")

    async with websockets.connect(uri) as websocket:
        print("CONNECTED ✅")

        while True:
            data = await websocket.recv()
            print("DATA:", data)

asyncio.run(test())