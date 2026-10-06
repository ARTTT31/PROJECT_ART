# -*- coding: utf-8 -*-
"""
WebSocket notifications + the admin broadcast endpoint.

SCALING NOTE — the connection registry is process-local.
``manager`` lives in this module's memory, so a broadcast reaches only the
clients connected to the instance that served the request. That is correct for
the current single-instance deployment; running more than one instance requires
setting ``WS_BROADCAST_REDIS_URL`` so ``app.services.ws_bus`` fans the payload
out over Redis pub/sub. ``app.main.log_shared_state_limitations()`` logs which
mode is active at startup so it cannot fail silently.
"""

import json
import logging

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import authenticate_websocket, get_current_admin_user
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.services.ws_bus import broadcast_bus

logger = logging.getLogger(__name__)

router = APIRouter()

# RFC 6455 close codes. The frontend keys off these: 1008 means "your session is
# not valid, do not reconnect", while 1013 means "the instance is at capacity,
# back off and try again".
WS_CLOSE_UNAUTHORIZED = 1008
WS_CLOSE_CAPACITY = 1013


class ConnectionManager:
    """Tracks the WebSockets connected to *this* process (see module docstring).

    ``max_total`` and ``max_per_user`` bound how much memory a client can pin.
    The endpoint requires authentication, but every signed-in account can still
    open sockets and the frontend reconnects automatically, so without a cap a
    single account — or a client stuck in a reconnect loop — could grow this
    registry without bound.
    """

    def __init__(
        self,
        max_total: int | None = None,
        max_per_user: int | None = None,
    ) -> None:
        self.active_connections: list[WebSocket] = []
        self._owner: dict[WebSocket, int] = {}
        self._per_user: dict[int, int] = {}
        self.max_total = settings.WS_MAX_CONNECTIONS if max_total is None else max_total
        self.max_per_user = (
            settings.WS_MAX_CONNECTIONS_PER_USER if max_per_user is None else max_per_user
        )

    def can_accept(self, user_id: int) -> bool:
        """Whether this user may open one more connection right now."""
        return (
            len(self.active_connections) < self.max_total
            and self._per_user.get(user_id, 0) < self.max_per_user
        )

    async def connect(self, websocket: WebSocket, user_id: int) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)
        self._owner[websocket] = user_id
        self._per_user[user_id] = self._per_user.get(user_id, 0) + 1
        logger.info(
            "WebSocket connected (user=%s). Total: %d", user_id, len(self.active_connections)
        )

    def disconnect(self, websocket: WebSocket) -> None:
        """Drop a connection. Safe to call more than once for the same socket."""
        if websocket not in self._owner:
            return

        user_id = self._owner.pop(websocket)
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

        remaining = self._per_user.get(user_id, 0) - 1
        if remaining > 0:
            self._per_user[user_id] = remaining
        else:
            self._per_user.pop(user_id, None)

        logger.info(
            "WebSocket disconnected (user=%s). Total: %d", user_id, len(self.active_connections)
        )

    async def broadcast(self, message: dict) -> None:
        payload = json.dumps(message)
        for connection in list(self.active_connections):
            try:
                await connection.send_text(payload)
            except Exception as e:
                logger.error("Error sending message to client: %s", e)
                self.disconnect(connection)


manager = ConnectionManager()


@router.websocket("/notifications")
async def websocket_notifications(
    websocket: WebSocket,
    db: AsyncSession = Depends(get_db),
):
    """Live notifications for signed-in users.

    Without the authentication check the socket was reachable by anyone who knew
    the URL — including visitors who never logged in — and every broadcast would
    be delivered to them.

    A rejected handshake is *accepted and then closed* with the RFC 6455 code.
    Closing before ``accept()`` makes the ASGI server reject the HTTP upgrade
    with ``403``, which arrives in the browser as the generic abnormal-closure
    code ``1006``: indistinguishable from a network blip, so `NotificationBell`
    would keep retrying instead of stopping on ``1008``. Nothing is read, sent or
    registered on that socket, so no broadcast can reach it.
    """
    user = await authenticate_websocket(websocket, db)

    # The session is only needed for the handshake. Release it now: a socket can
    # stay open for hours, and holding a pooled connection for its whole lifetime
    # would exhaust the pool (pool_size is 5) with a handful of open dashboards.
    await db.close()

    if user is None:
        logger.info("Rejected unauthenticated WebSocket handshake")
        await websocket.accept()
        await websocket.close(code=WS_CLOSE_UNAUTHORIZED)
        return

    if not manager.can_accept(user.id):
        logger.warning(
            "Rejecting WebSocket for user %s: capacity reached (%d total)",
            user.id,
            len(manager.active_connections),
        )
        await websocket.accept()
        await websocket.close(code=WS_CLOSE_CAPACITY)
        return

    await manager.connect(websocket, user.id)
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
        logger.error("WebSocket error: %s", e)
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
    """Broadcast a notification to all connected WebSocket clients (admin only).

    Delivery goes through the bus so the message also reaches the clients of
    every other instance when ``WS_BROADCAST_REDIS_URL`` is configured.
    """
    payload_data = payload.model_dump()
    await broadcast_bus.publish(payload_data)
    return {"message": "Broadcast sent", "payload": payload_data}
