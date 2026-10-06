"""
Fan-out for WebSocket notification broadcasts.

The connection registry lives inside the process
(``app.api.v1.endpoints.websockets``), so on one instance a broadcast is just a
loop over the local sockets. With more than one instance that loop reaches only
the clients connected to the instance that served the ``POST /broadcast`` — the
reason ``app.main`` logs a ``[SCALING]`` notice.

Setting ``WS_BROADCAST_REDIS_URL`` moves the fan-out onto Redis pub/sub: the
publisher writes one message and every instance (including the publisher) sees
it through its subscription and delivers it to its own clients. Redis is
imported lazily and every failure degrades to local delivery — losing the
cross-instance fan-out is far better than losing the notification.
"""

import asyncio
import json
import logging
from typing import Any, Awaitable, Callable, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

LocalHandler = Callable[[dict], Awaitable[None]]


class BroadcastBus:
    """Publishes notification payloads to every instance that has subscribers."""

    def __init__(self, url: Optional[str] = None, channel: Optional[str] = None) -> None:
        raw_url = settings.WS_BROADCAST_REDIS_URL if url is None else url
        self._url = (raw_url or "").strip()
        self._channel = channel if channel is not None else settings.WS_BROADCAST_CHANNEL
        self._handler: Optional[LocalHandler] = None
        self._client: Any = None
        self._listener: Optional["asyncio.Task[None]"] = None

    @property
    def shared(self) -> bool:
        """Whether broadcasts are routed through Redis (cross-instance)."""
        return bool(self._url)

    async def start(self, handler: LocalHandler) -> None:
        """Register the local delivery callback, subscribing when configured."""
        self._handler = handler

        if not self.shared:
            logger.info(
                "WebSocket broadcasts are process-local (set WS_BROADCAST_REDIS_URL "
                "to fan them out across instances)"
            )
            return

        try:
            import redis.asyncio as redis  # imported lazily: optional dependency
        except ImportError:
            logger.error(
                "WS_BROADCAST_REDIS_URL is set but the `redis` package is not "
                "installed; broadcasts stay process-local."
            )
            return

        try:
            self._client = redis.from_url(self._url, decode_responses=True)
            await self._client.ping()
            self._listener = asyncio.create_task(self._listen())
        except Exception as exc:
            logger.error(
                "Could not start the WebSocket broadcast bus (%s); broadcasts "
                "stay process-local.",
                exc,
            )
            self._client = None

    async def publish(self, message: dict) -> None:
        """Deliver a notification to every instance, or locally when not shared."""
        if self.shared and self._client is not None:
            try:
                await self._client.publish(self._channel, json.dumps(message))
                return
            except Exception as exc:
                logger.error(
                    "Redis broadcast failed (%s); delivering to this instance only", exc
                )

        await self._deliver(message)

    async def stop(self) -> None:
        """Cancel the subscription, close the client, drop the handler."""
        # Cleared first: a delivery already in flight must not call into a
        # registry that is being torn down.
        self._handler = None

        if self._listener is not None:
            self._listener.cancel()
            await asyncio.gather(self._listener, return_exceptions=True)
            self._listener = None

        if self._client is not None:
            try:
                await self._client.aclose()
            except Exception as exc:  # pragma: no cover - shutdown best effort
                logger.debug("Closing the broadcast Redis client failed: %s", exc)
            self._client = None

    async def _listen(self) -> None:
        """Deliver messages published by any instance until cancelled."""
        assert self._client is not None  # guarded by start()
        pubsub = self._client.pubsub()
        await pubsub.subscribe(self._channel)
        try:
            async for raw in pubsub.listen():
                self._handle_message(raw)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.error("WebSocket broadcast subscription stopped: %s", exc)
        finally:
            try:
                await pubsub.aclose()
            except Exception:  # pragma: no cover - shutdown best effort
                pass

    def _handle_message(self, raw: Any) -> None:
        """Schedule delivery of one pub/sub message (ignores subscribe notices)."""
        if not isinstance(raw, dict) or raw.get("type") != "message":
            return

        data = raw.get("data")
        if isinstance(data, (bytes, bytearray)):
            data = data.decode("utf-8", errors="replace")
        if not isinstance(data, str):
            return

        try:
            payload = json.loads(data)
        except ValueError:
            logger.warning("Discarding undecodable broadcast payload")
            return
        if not isinstance(payload, dict):
            return

        asyncio.create_task(self._deliver(payload))

    async def _deliver(self, message: dict) -> None:
        if self._handler is None:
            # No lifespan has run (bare TestClient), so there is nothing to feed.
            return
        try:
            await self._handler(message)
        except Exception as exc:
            logger.error("Local WebSocket delivery failed: %s", exc)


broadcast_bus = BroadcastBus()

__all__ = ["BroadcastBus", "broadcast_bus"]
