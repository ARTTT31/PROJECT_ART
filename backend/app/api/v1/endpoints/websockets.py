import json
import logging
from typing import List, Dict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

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

from pydantic import BaseModel
class NotificationPayload(BaseModel):
    id: str
    type: str  # 'holiday' | 'weather' | 'oilprice' | 'system'
    level: str # 'info' | 'warning' | 'danger'
    title: str
    body: str

@router.post("/broadcast")
async def broadcast_notification(payload: NotificationPayload):
    """Admin endpoint to broadcast a notification to all connected WebSocket clients."""
    await manager.broadcast(payload.dict())
    return {"message": "Broadcast sent", "payload": payload.dict()}
