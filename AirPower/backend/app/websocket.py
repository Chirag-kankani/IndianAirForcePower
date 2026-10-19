"""
WebSocket Connection Manager and Endpoint for AirPower Platform.
Handles real-time tactical broadcasts to all connected commander dashboards.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["WebSocket"])


class ConnectionManager:
    """Manages active WebSocket connections and broadcasts JSON messages."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_json(self, websocket: WebSocket, message: Dict[str, Any]) -> None:
        try:
            await websocket.send_json(message)
        except Exception:
            self.disconnect(websocket)

    async def broadcast(self, message_type: str, data: Any) -> None:
        """Broadcasts structured tactical payload to all connected clients."""
        payload = {
            "type": message_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": data,
        }
        for connection in list(self.active_connections):
            try:
                await connection.send_json(payload)
            except Exception:
                self.disconnect(connection)


manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    from app.state import state_store

    await manager.connect(websocket)
    try:
        # Send full initial snapshot upon connection
        snapshot = await state_store.get_snapshot_async()
        await websocket.send_json({
            "type": "STATE_SNAPSHOT",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": snapshot.model_dump(),
        })

        # Listen for client heartbeat or custom pings
        while True:
            text = await websocket.receive_text()
            if text == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
