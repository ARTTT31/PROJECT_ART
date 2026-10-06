"""
WebSocket notifications + the admin broadcast endpoint.

SCALING NOTE — the connection registry is process-local.
``manager`` lives in this module's memory, so a broadcast reaches only the
clients connected to the instance that served the request. That is correct for
the current single-instance deployment; running more than one instance requires
a shared broker (the same Redis instance used for ``SLOWAPI_STORAGE_URI``) with
pub/sub fan-out. ``app.main.log_shared_state_limitations()`` logs this at
startup so it cannot fail silently.
"""

import json
import logging

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.api.dependencies import get_current_admin_user
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    """Tracks the WebSockets connected to *this* process (see module docstring)."""

    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        payload = json.dumps(message)
        for connection in list(self.active_connections):
            try:
                await connection.send_text(payload)
            except Exception as e:
                logger.error(f"Error sending message to client: {e}")
                self.disconnect(connection)


manager = ConnectionManager()


@router.websocket("/notifications")
async def websocket_notifications(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # wait for messages from client (e.g. ping to keep connection alive)
            data = await websocket.receive_text()
            # If client sends ping, we could reply pong, but not strictly necessary
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


class NotificationPayload(BaseModel):
    id: str
    type: str  # 'holiday' | 'weather' | 'oilprice' | 'system'
    level: str  # 'info' | 'warning' | 'danger'
    title: str
    body: str


@router.post("/broadcast")
async def broadcast_notification(
    payload: NotificationPayload,
    current_user: User = Depends(get_current_admin_user),
):
    """Broadcast a notification to all connected WebSocket clients (admin only)."""
    payload_data = payload.model_dump()
    await manager.broadcast(payload_data)
    return {"message": "Broadcast sent", "payload": payload_data}
