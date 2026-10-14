"""Regression tests for UserLogin field limits and audit masking (T14).

- Login payloads are bounded to sane lengths (matching DB columns: user_agent
  500, device_label 255), so one request cannot pour megabytes into rows or
  logs.
- audit_logs.details for LOGIN_FAILED must NOT carry the raw identifier the
  attacker typed (PII / log-injection): it is masked.
"""

import pytest
from pydantic import ValidationError

from app.schemas.user import UserLogin


class TestUserLoginLimits:
    def test_email_has_a_max_length(self):
        with pytest.raises(ValidationError):
            UserLogin(email="a" * 300 + "@example.com", password="Passw0rd123")

    def test_password_has_a_max_length(self):
        with pytest.raises(ValidationError):
            UserLogin(email="u@example.com", password="p" * 200)

    def test_session_id_has_a_max_length(self):
        with pytest.raises(ValidationError):
            UserLogin(
                email="u@example.com", password="Passw0rd123",
                session_id="s" * 100,
            )

    def test_device_label_has_a_max_length(self):
        with pytest.raises(ValidationError):
            UserLogin(
                email="u@example.com", password="Passw0rd123",
                device_label="d" * 300,
            )

    def test_user_agent_has_a_max_length(self):
        with pytest.raises(ValidationError):
            UserLogin(
                email="u@example.com", password="Passw0rd123",
                user_agent="b" * 600,
            )

    def test_reasonable_payload_still_passes(self):
        ok = UserLogin(
            email="u@example.com", password="Passw0rd123",
            session_id="sess-1",
            device_label="Chrome on Windows",
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        )
        assert ok.email == "u@example.com"


async def test_failed_login_audit_details_are_masked(client, logged_in_user, db_session):
    """The audit row must not repeat the raw (attacker-typed) identifier."""
    from sqlalchemy import select

    from app.models.audit_log import AuditLog

    victim = "auditvictim@example.com"
    r = await client.post("/api/v1/auth/login", json={
        "email": victim, "password": "WrongPass1"})
    assert r.status_code == 401

    rows = (
        await db_session.execute(
            select(AuditLog).where(AuditLog.action == "LOGIN_FAILED")
        )
    ).scalars().all()
    assert rows, "failed login must be audited"
    joined = " | ".join(row.details or "" for row in rows)
    assert victim not in joined, f"raw identifier leaked into audit details: {joined!r}"
    assert "au***@example.com" in joined, "masked identifier must be recorded"
