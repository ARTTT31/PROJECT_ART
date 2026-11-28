"""Production email configuration must fail loudly instead of losing mail.

``log_email_delivery_configuration`` used to warn for every misconfiguration.
That is enough for an operator who is still wiring a provider, but not for a
deployment that *requires* verification: every new account would be locked out
while the log line scrolled past. These tests pin the fatal cases and the
console-without-verification case that stays a warning.
"""

import logging

import pytest

from app.core.config import settings
from app.main import log_email_delivery_configuration


@pytest.fixture
def production_email(monkeypatch):
    """Put the settings in a production-shaped email state."""
    monkeypatch.setattr(settings, "DEBUG", False)
    monkeypatch.setattr(settings, "REQUIRE_EMAIL_VERIFICATION", False)
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "console")
    monkeypatch.setattr(settings, "RESEND_API_KEY", "")
    monkeypatch.setattr(settings, "SMTP_HOST", "")
    return monkeypatch


def test_console_backend_without_verification_only_warns(production_email, caplog):
    with caplog.at_level(logging.WARNING):
        log_email_delivery_configuration()

    assert "EMAIL_BACKEND=console" in caplog.text


def test_console_backend_with_verification_required_fails(production_email):
    production_email.setattr(settings, "REQUIRE_EMAIL_VERIFICATION", True)

    with pytest.raises(RuntimeError, match="REQUIRE_EMAIL_VERIFICATION"):
        log_email_delivery_configuration()


def test_resend_without_api_key_fails(production_email):
    production_email.setattr(settings, "EMAIL_BACKEND", "resend")

    with pytest.raises(RuntimeError, match="RESEND_API_KEY"):
        log_email_delivery_configuration()


def test_smtp_without_host_fails(production_email):
    production_email.setattr(settings, "EMAIL_BACKEND", "smtp")

    with pytest.raises(RuntimeError, match="SMTP_HOST"):
        log_email_delivery_configuration()


def test_debug_skips_the_check(production_email):
    production_email.setattr(settings, "DEBUG", True)
    production_email.setattr(settings, "EMAIL_BACKEND", "smtp")
    production_email.setattr(settings, "SMTP_HOST", "")

    # Local development is allowed to run without a transport.
    log_email_delivery_configuration()
