"""
Lightweight WebSocket Test Client for AirPower Tactical Stream.
Connects to ws://localhost:8000/ws and prints live broadcast streams.
"""
from __future__ import annotations

import asyncio
import json
import sys
import websockets


async def listen_to_stream(uri: str = "ws://localhost:8000/ws"):
    print(f"[AirPower WS Client] Connecting to tactical WebSocket stream at {uri} ...")
    try:
        async with websockets.connect(uri) as websocket:
            print("[AirPower WS Client] Connected! Listening for real-time broadcasts...\n")
            while True:
                message = await websocket.recv()
                try:
                    payload = json.loads(message)
                    msg_type = payload.get("type", "UNKNOWN")
                    timestamp = payload.get("timestamp", "")
                    data = payload.get("data", {})

                    print(f"=== [{timestamp}] RECEIVED: {msg_type} ===")
                    if msg_type == "EVENT_ALERT":
                        print(f" Alert: {data.get('message')}")
                        for act in data.get("retasking_actions", []):
                            print(f"  -> Action: {act.get('action_type')} | Mission: {act.get('mission_id')} | Details: {act.get('details')}")
                    elif msg_type == "STATE_SNAPSHOT":
                        print(f" Snapshot: {len(data.get('aircraft_fleet', []))} jets, {len(data.get('active_missions', []))} active missions, {len(data.get('threat_environment', []))} threats.")
                    else:
                        print(json.dumps(payload, indent=2))
                    print("=" * 60 + "\n")
                except json.JSONDecodeError:
                    print(f"[Raw Text]: {message}")
    except ConnectionRefusedError:
        print("[AirPower WS Client] Connection refused. Is the FastAPI backend running on port 8000?")
    except Exception as e:
        print(f"[AirPower WS Client] Connection closed: {e}")


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "ws://localhost:8000/ws"
    try:
        asyncio.run(listen_to_stream(url))
    except KeyboardInterrupt:
        print("\n[AirPower WS Client] Exited by user.")
