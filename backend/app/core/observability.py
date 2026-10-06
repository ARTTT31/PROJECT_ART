"""
Observability helpers: log formatting, request correlation ids, and the ASGI
middleware that attaches them to every request.

The application previously logged through a mix of `print()` calls and the
stdlib logger, which meant startup/security notices could not be filtered by
level, had no timestamps, and could not be correlated with the request that
caused them. Everything now goes through the stdlib logger with a request id
on every record.
"""

import logging
import re
import uuid
from contextvars import ContextVar

from starlette.types import ASGIApp, Message, Receive, Scope, Send

REQUEST_ID_HEADER = "X-Request-ID"

# Attribute marking the handler this module installed, so repeated calls (app
# startup in tests, uvicorn reload) replace it instead of stacking duplicates.
_HANDLER_MARK = "art_console_handler"

# A caller-supplied id is echoed back in a response header and written to the
# logs, so the shape is validated: anything that could inject a newline or
# megabytes of text into either is discarded and replaced with a generated id.
_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")

_request_id: ContextVar[str] = ContextVar("request_id", default="-")


def current_request_id() -> str:
    """Request id for the current task, or ``"-"`` outside a request."""
    return _request_id.get()


def _new_request_id() -> str:
    return uuid.uuid4().hex


class _RequestIdFilter(logging.Filter):
    """Stamp every record with the current request id."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = _request_id.get()
        return True


def configure_logging(debug: bool = False) -> None:
    """Install a single stdout handler with request-correlated formatting.

    uvicorn configures its own loggers; this only touches the root logger, so
    ``logging.getLogger("app.…")`` output stops falling back to the bare
    ``WARNING:root:`` format.
    """
    root = logging.getLogger()
    for handler in list(root.handlers):
        if getattr(handler, _HANDLER_MARK, False):
            root.removeHandler(handler)

    handler = logging.StreamHandler()
    handler.setFormatter(
        logging.Formatter(
            "%(asctime)s %(levelname)-8s [%(name)s] rid=%(request_id)s %(message)s"
        )
    )
    handler.addFilter(_RequestIdFilter())
    setattr(handler, _HANDLER_MARK, True)

    root.addHandler(handler)
    # The root logger stays at INFO even in DEBUG: aiosqlite and httpcore log every
    # statement and every byte at DEBUG, which buries the application's own output.
    # Only this project's loggers follow the DEBUG switch.
    root.setLevel(logging.INFO)
    logging.getLogger("app").setLevel(logging.DEBUG if debug else logging.INFO)


class RequestIDMiddleware:
    """Give every request an id, echo it back, and log with it.

    Registered outermost so the id exists before any other middleware (CSRF,
    CSP) can reject the request — a rejected request is exactly the kind of log
    line that needs to be traceable.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        # WebSocket/lifespan scopes have no response headers; pass them through
        # with no id so a long-lived socket cannot leak one into later requests.
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        incoming = ""
        for name, value in scope.get("headers", []):
            if name.lower() == REQUEST_ID_HEADER.lower().encode():
                incoming = value.decode("latin-1").strip()
                break

        request_id = incoming if _SAFE_REQUEST_ID.match(incoming) else _new_request_id()
        token = _request_id.set(request_id)

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append((REQUEST_ID_HEADER.lower().encode(), request_id.encode()))
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            _request_id.reset(token)


__all__ = [
    "REQUEST_ID_HEADER",
    "RequestIDMiddleware",
    "configure_logging",
    "current_request_id",
]
