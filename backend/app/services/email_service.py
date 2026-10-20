"""Simplified email service — no-op for deployments without email configured."""

from __future__ import annotations

from typing import Optional


async def send(message: Optional[object] = None) -> bool:
    """No-op: always returns True without actually sending email."""
    return True


def get_email_service():
    """Return a no-op email service instance."""
    return type("NoOpEmailService", (), {"send": lambda self, m: True})()