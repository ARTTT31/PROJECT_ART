"""
Rate Limiter (SlowAPI) setup.

Kept in its own module to avoid a circular import between:
  app.main → app.api.v1.router → app.api.v1.endpoints.auth → app.main (limiter)

Both main.py and endpoint modules import from this single source of truth.
"""

from slowapi import Limiter
from fastapi import Request

from app.core.config import settings


def get_real_client_ip(request: Request) -> str:
    """Extract real client IP behind proxies (Render / Vercel / CDNs).

    Respects ``X-Forwarded-For`` (comma-separated list, leftmost = original
    client) when present, otherwise falls back to ``request.client``.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


def _build_limiter() -> Limiter:
    """Build a SlowAPI Limiter using the configured storage backend.

    Falls back to in-memory storage if Redis is configured but not available,
    so the app can still start during a transient redis outage.
    """
    uri = settings.SLOWAPI_STORAGE_URI
    try:
        if uri and uri != "memory://":
            return Limiter(key_func=get_real_client_ip, storage_uri=uri)
    except Exception as exc:  # pragma: no cover - defensive fallback
        print(
            f"[RATE-LIMIT] WARNING: Failed to init storage '{uri}' ({exc}). "
            "Falling back to in-memory backend."
        )
    return Limiter(key_func=get_real_client_ip)


limiter = _build_limiter()
limiter.key_function = get_real_client_ip  # type: ignore[attr-defined]

__all__ = ["limiter", "get_real_client_ip", "Limiter"]
