# -*- coding: utf-8 -*-
"""Single-use tickets for the notification WebSocket handshake.

The session cookie belongs to the origin that *set* it. In the Vercel → Render
deployment every browser call goes through the same-origin ``/api`` rewrite, so
``access_token`` is stored for the frontend origin and is never attached to the
``wss://<api-host>`` upgrade: the backend accepts the socket and closes it with
1008, which the browser reports as "WebSocket connection failed".

The browser therefore trades that cookie for a ticket over same-origin HTTP
(where the cookie is first-party) and presents the ticket exactly once on the
upgrade request. A ticket is a random 256-bit value that resolves to the
caller's access token, so every account/session rule (revoked session, inactive
account) still applies, and it is single-use and short-lived so a proxy log
holding the upgrade URL cannot be replayed later.
"""

import secrets
import threading
import time

DEFAULT_TTL_SECONDS = 30
MAX_TICKETS = 1024


class WsTicketStore:
    """Process-local ticket table (the socket registry is process-local too)."""

    def __init__(
        self,
        ttl_seconds: int = DEFAULT_TTL_SECONDS,
        max_tickets: int = MAX_TICKETS,
    ) -> None:
        self.ttl_seconds = ttl_seconds
        self.max_tickets = max_tickets
        self._tickets: dict[str, tuple[str, float]] = {}
        self._lock = threading.Lock()

    def issue(self, access_token: str) -> str:
        """Mint a ticket for an already-validated access token."""
        ticket = secrets.token_urlsafe(32)
        now = time.monotonic()
        with self._lock:
            self._purge(now)
            if len(self._tickets) >= self.max_tickets:
                # Dicts keep insertion order and a ticket is only useful for a
                # few seconds, so the oldest entry is the least useful one.
                self._tickets.pop(next(iter(self._tickets)), None)
            self._tickets[ticket] = (access_token, now + self.ttl_seconds)
        return ticket

    def redeem(self, ticket: str) -> str | None:
        """Consume a ticket, returning the access token it was issued for."""
        if not ticket:
            return None

        with self._lock:
            entry = self._tickets.pop(ticket, None)

        if entry is None:
            return None

        access_token, expires_at = entry
        if expires_at <= time.monotonic():
            return None

        return access_token

    def _purge(self, now: float) -> None:
        expired = [key for key, (_, expires_at) in self._tickets.items() if expires_at <= now]
        for key in expired:
            self._tickets.pop(key, None)


ws_tickets = WsTicketStore()
