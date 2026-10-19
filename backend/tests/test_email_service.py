"""Email transport: console outbox, SMTP integration, soft failures.

The load-bearing property is that ``send()`` never raises: a broken provider
must not turn a password-reset request into a 500. Everything else here pins
the backend wiring and the Thai templates' links.
"""

import smtplib

import pytest

from app.core.config import settings
from app.services import email_service
from app.services.email_service import (
    EmailMessage,
    EmailService,
    account_approved_email,
    account_rejected_email,
    admin_new_request_email,
    outbox_clear,
    outbox_messages,
    password_reset_email,
    verify_email_message,
)


@pytest.fixture(autouse=True)
def _console_backend_and_clean_outbox(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "console")
    outbox_clear()
    yield
    outbox_clear()


async def test_console_backend_records_the_message():
    ok = await EmailService().send(
        EmailMessage(to="a@example.com", subject="Hi", text="body", html="<p>body</p>")
    )

    assert ok is True
    messages = outbox_messages("a@example.com")
    assert len(messages) == 1
    assert messages[0]["subject"] == "Hi"


async def test_smtp_backend_delivers_through_smtp(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "smtp")
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(settings, "SMTP_USERNAME", "user")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "pass")

    sent = {}

    class _FakeSMTP:
        def __init__(self, host, port, timeout=None):
            sent["host"] = host

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def starttls(self):
            sent["starttls"] = True

        def login(self, username, password):
            sent["login"] = (username, password)

        def send_message(self, mime):
            sent["message"] = mime

    monkeypatch.setattr(email_service.smtplib, "SMTP", _FakeSMTP)

    ok = await EmailService().send(
        EmailMessage(to="b@example.com", subject="S", text="T", html="<p>T</p>")
    )

    assert ok is True
    assert sent["host"] == "smtp.example.com"
    assert sent["login"] == ("user", "pass")
    assert sent["message"]["To"] == "b@example.com"


async def test_smtp_failure_is_reported_not_raised(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "smtp")
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.com")

    class _ExplodingSMTP:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            raise smtplib.SMTPConnectError(421, "no server")

        def __exit__(self, *a):
            return False

    monkeypatch.setattr(email_service.smtplib, "SMTP", _ExplodingSMTP)

    ok = await EmailService().send(EmailMessage(to="c@example.com", subject="S", text="T"))

    assert ok is False, "delivery failure must be a False return, never an exception"


async def test_resend_backend_without_api_key_fails_softly(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "resend")
    monkeypatch.setattr(settings, "RESEND_API_KEY", "")

    ok = await EmailService().send(EmailMessage(to="d@example.com", subject="S", text="T"))

    assert ok is False


def test_password_reset_template_contains_the_link():
    message = password_reset_email("u@example.com", "User", "https://app.example.com/reset-password?token=abc")

    assert "reset-password?token=abc" in message.text
    assert "reset-password?token=abc" in message.html
    assert "รหัสผ่าน" in message.subject


def test_verification_template_contains_the_link():
    message = verify_email_message("u@example.com", "User", "https://app.example.com/verify-email?token=xyz")

    assert "verify-email?token=xyz" in message.text
    assert "ยืนยันอีเมล" in message.subject


def test_approval_templates():
    approved = account_approved_email("u@example.com", "User", "https://app.example.com/login")
    rejected = account_rejected_email("u@example.com", "User")
    admin = admin_new_request_email(
        "admin@example.com", "Admin", "applicant@example.com", "https://app.example.com/profile?tab=admin"
    )

    assert "อนุมัติ" in approved.subject
    assert "ไม่ได้รับการอนุมัติ" in rejected.text
    assert "applicant@example.com" in admin.text
