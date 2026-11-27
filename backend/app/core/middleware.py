"""HTTP middleware that is not about routing: CSP and CSRF.

Both used to live inside ``app/main.py`` next to the lifespan and the health
probes. They are independent of app assembly, so they live here and ``main``
only decides their order (which Starlette reverses: the last one added is the
outermost).
"""

import secrets
from http.cookies import SimpleCookie

from fastapi.responses import JSONResponse
from starlette.datastructures import Headers

from app.core.config import settings

# ── Content Security Policy (CSP) ──
# The backend serves JSON and the API docs; the Next.js frontend is a separate
# origin with its own policy. So the policy here is the strictest one that still
# works: `default-src 'none'` means nothing loads unless a directive says so,
# which is exactly right for an API response (an old allow-list of frontend
# origins, fonts and images was dead weight — no HTML page here needs them).
CSP_HEADER_VALUE = "default-src 'none'; frame-ancestors 'none'"

# Swagger UI (/docs) and ReDoc (/redoc) load their bundle and styles from
# cdn.jsdelivr.net, with the favicon from fastapi.tiangolo.com, so the strict
# policy above would render a blank page. These paths get a policy that permits
# exactly those assets and nothing else.
DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")
CSP_HEADER_VALUE_DOCS = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "img-src 'self' data: https://fastapi.tiangolo.com; "
    "font-src 'self' data: https://fonts.gstatic.com; "
    "worker-src 'self' blob:; "
    "object-src 'none'; "
    "base-uri 'none'; "
    "frame-ancestors 'none'"
)


def _csp_for_path(path: str) -> str:
    """Pick the policy for one request path."""
    for docs_path in DOCS_PATHS:
        if path == docs_path or path.startswith(docs_path + "/"):
            return CSP_HEADER_VALUE_DOCS
    return CSP_HEADER_VALUE


class CSPMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Do not modify OPTIONS preflight responses so CORSMiddleware handles them cleanly
        if scope.get("method") == "OPTIONS":
            await self.app(scope, receive, send)
            return

        # The policy is chosen per path: the Swagger pages need their CDN, the
        # API needs nothing at all.
        path = scope.get("path", "")

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))

                def set_header(name: bytes, value: bytes):
                    for idx, (h_name, h_val) in enumerate(headers):
                        if h_name.lower() == name.lower():
                            headers[idx] = (name, value)
                            return
                    headers.append((name, value))

                # Per-path CSP: the API gets `default-src 'none'`, the Swagger
                # pages get the CDN-capable policy they need to render.
                set_header(
                    b"content-security-policy",
                    _csp_for_path(path).encode("utf-8"),
                )
                set_header(b"x-content-type-options", b"nosniff")
                set_header(b"x-frame-options", b"DENY")
                # No referrer ever leaves the API, not even the origin.
                set_header(b"referrer-policy", b"no-referrer")
                set_header(b"permissions-policy", b"camera=(self), microphone=(), geolocation=(self)")
                # HSTS is meaningless (and harmful) on plain-HTTP local development,
                # so it is only sent by non-DEBUG deployments. One year with
                # includeSubDomains is the documented minimum for a live domain.
                if not settings.DEBUG:
                    set_header(
                        b"strict-transport-security",
                        b"max-age=31536000; includeSubDomains",
                    )
                message["headers"] = headers

            await send(message)

        await self.app(scope, receive, send_wrapper)


class CSRFMiddleware:
    """Double-submit-cookie CSRF protection for cookie-authenticated requests.

    Only mutating (`POST`/`PUT`/`PATCH`/`DELETE`) requests under `/api/` are
    checked. A readable `csrf_token` cookie is issued on first response and the
    caller must echo the same value back in the `X-CSRF-Token` header; otherwise
    the request is rejected with 403.

    Pre-authentication endpoints are exempt because no CSRF cookie can exist
    before the first login, and `/auth/refresh` is exempt so an expired session
    can always be renewed instead of locking the user out.
    """

    COOKIE_NAME = "csrf_token"
    HEADER_NAME = "x-csrf-token"
    SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}
    EXEMPT_PREFIXES = (
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/refresh",
        "/api/v1/auth/google",
        "/api/v1/auth/csrf",
        # Account-email flows. Same reasoning as login/register: they are
        # pre-authentication doors (a verification link arrives in an inbox, not
        # a browser session), and each state change requires a secret carried in
        # the body — a verification token is bound to its own account, so riding
        # a victim's cookies cannot verify anyone but the token's owner.
        "/api/v1/auth/verify-email",
        "/api/v1/auth/resend-verification",
        # A reset link is opened from an inbox, often in a fresh browser with no
        # CSRF cookie. The body carries the single-use token, which is bound to
        # its account, so riding a victim's cookies cannot reset their password.
        "/api/v1/auth/forgot-password",
        "/api/v1/auth/reset-password",
    )

    def __init__(self, app):
        self.app = app

    @classmethod
    def _is_exempt(cls, path: str) -> bool:
        return any(
            path == prefix or path.startswith(prefix + "/")
            for prefix in cls.EXEMPT_PREFIXES
        )

    @classmethod
    def _cookie_header(cls, token: str) -> bytes:
        max_age = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
        parts = [
            f"{cls.COOKIE_NAME}={token}",
            "Path=/",
            f"Max-Age={max_age}",
            f"SameSite={str(settings.COOKIE_SAMESITE_EFFECTIVE).lower()}",
        ]
        if settings.COOKIE_SECURE:
            parts.append("Secure")
        return "; ".join(parts).encode("latin-1")

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        method = scope.get("method", "GET").upper()
        headers = Headers(scope=scope)

        jar = SimpleCookie()
        try:
            jar.load(headers.get("cookie", ""))
        except Exception:
            pass
        cookie_token = jar[self.COOKIE_NAME].value if self.COOKIE_NAME in jar else None

        # Only requests that already carry an authenticated browser session can
        # be forged, so anonymous calls are left alone and keep returning their
        # normal 401 instead of a confusing 403.
        has_session_context = bool(
            cookie_token
            or "access_token" in jar
            or "refresh_token" in jar
        )

        needs_check = (
            settings.CSRF_PROTECTION_ENABLED
            and path.startswith("/api/")
            and method not in self.SAFE_METHODS
            and not self._is_exempt(path)
            and has_session_context
        )

        if needs_check:
            supplied = headers.get(self.HEADER_NAME)
            if (
                not cookie_token
                or not supplied
                or not secrets.compare_digest(str(supplied), str(cookie_token))
            ):
                response = JSONResponse(
                    status_code=403,
                    content={
                        "detail": "CSRF token missing or invalid",
                        "code": "csrf_failed",
                    },
                )
                if not cookie_token:
                    # Issue a token so the client can retry immediately.
                    response.raw_headers.append(
                        (b"set-cookie", self._cookie_header(secrets.token_urlsafe(32)))
                    )
                await response(scope, receive, send)
                return

        async def send_wrapper(message):
            if message["type"] == "http.response.start" and not cookie_token:
                raw_headers = list(message.get("headers", []))
                already_set = any(
                    name.lower() == b"set-cookie"
                    and self.COOKIE_NAME.encode() in value
                    for name, value in raw_headers
                )
                if not already_set:
                    raw_headers.append(
                        (b"set-cookie", self._cookie_header(secrets.token_urlsafe(32)))
                    )
                    message["headers"] = raw_headers
            await send(message)

        await self.app(scope, receive, send_wrapper)


__all__ = [
    "CSPMiddleware",
    "CSRFMiddleware",
    "CSP_HEADER_VALUE",
    "CSP_HEADER_VALUE_DOCS",
    "DOCS_PATHS",
]
