"""Sign-up hygiene: PDPA consent, disposable domains, Turnstile.

All three apply to the public password sign-up; none of them may fire when the
deployment has not configured the feature (Turnstile unset) or when the claim
is genuinely fine.
"""

import pytest

import app.core.turnstile as turnstile
from app.core.config import settings
from app.services.email_service import outbox_clear

PASSWORD = "Passw0rd123"


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "console")
    monkeypatch.setattr(settings, "TURNSTILE_SECRET_KEY", "")
    outbox_clear()
    yield
    outbox_clear()


async def _register(client, email="new@example.com", **extra):
    body = {"email": email, "password": PASSWORD, "name": "New", **extra}
    return await client.post("/api/v1/auth/register", json=body)


# ── consent (PDPA) ─────────────────────────────────────────────────────────


async def test_signup_without_consent_is_refused(client, monkeypatch):
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "open")

    r = await _register(client, accepted_terms=False)

    assert r.status_code == 400
    assert "ข้อตกลง" in r.json()["detail"]


async def test_consent_is_recorded_on_the_account(client, db_session, monkeypatch):
    from sqlalchemy import select

    from app.models.user import User

    monkeypatch.setattr(settings, "REGISTRATION_MODE", "open")

    assert (await _register(client, accepted_terms=True)).status_code == 201

    user = (
        await db_session.execute(select(User).where(User.email == "new@example.com"))
    ).scalars().one()
    assert user.terms_accepted_at is not None
    assert user.terms_version == settings.TERMS_VERSION


async def test_consent_is_required_in_approval_mode_too(client, monkeypatch):
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "approval")

    r = await _register(client, accepted_terms=False)

    assert r.status_code == 400


# ── disposable domains ─────────────────────────────────────────────────────


async def test_disposable_email_is_refused(client, db_session, monkeypatch):
    from sqlalchemy import select

    from app.models.user import User

    monkeypatch.setattr(settings, "REGISTRATION_MODE", "open")

    r = await _register(client, email="throwaway@mailinator.com", accepted_terms=True)

    assert r.status_code == 400
    assert "อีเมลชั่วคราว" in r.json()["detail"]
    rows = await db_session.execute(select(User).where(User.email == "throwaway@mailinator.com"))
    assert rows.scalars().one_or_none() is None


async def test_extra_domains_from_settings_are_honoured(client, monkeypatch):
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "open")
    monkeypatch.setattr(settings, "DISPOSABLE_EMAIL_DOMAINS", "burner.example")

    r = await _register(client, email="x@burner.example", accepted_terms=True)

    assert r.status_code == 400


# ── Turnstile ──────────────────────────────────────────────────────────────


class _FakeSiteverify:
    def __init__(self, success: bool):
        self.success = success

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def post(self, url, data=None):
        success = self.success
        return type("R", (), {"status_code": 200, "json": lambda _self=None: {"success": success}})()


@pytest.fixture
def turnstile_factory(monkeypatch):
    def _factory(success: bool):
        # AsyncClient(...) must return an async context manager directly, not a
        # coroutine, because the code under test uses ``async with``.
        def _fake_client(*a, **k):
            return _FakeSiteverify(success)

        monkeypatch.setattr(turnstile.httpx, "AsyncClient", _fake_client)

    return _factory


async def test_turnstile_not_required_when_unconfigured(client, monkeypatch):
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "open")

    assert (await _register(client, accepted_terms=True)).status_code == 201


async def test_turnstile_blocks_signup_without_a_token(client, monkeypatch):
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "open")
    monkeypatch.setattr(settings, "TURNSTILE_SECRET_KEY", "test-secret")

    r = await _register(client, accepted_terms=True)

    assert r.status_code == 400
    assert "CAPTCHA" in r.json()["detail"]


async def test_turnstile_accepts_a_verified_token(client, monkeypatch, turnstile_factory):
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "open")
    monkeypatch.setattr(settings, "TURNSTILE_SECRET_KEY", "test-secret")
    turnstile_factory(success=True)

    r = await _register(client, accepted_terms=True, turnstile_token="tok")

    assert r.status_code == 201, r.text


async def test_turnstile_rejects_a_failed_verification(client, monkeypatch, turnstile_factory):
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "open")
    monkeypatch.setattr(settings, "TURNSTILE_SECRET_KEY", "test-secret")
    turnstile_factory(success=False)

    r = await _register(client, accepted_terms=True, turnstile_token="tok")

    assert r.status_code == 400


async def test_forgot_password_also_checks_turnstile(client, make_user, monkeypatch):
    await make_user(email="forgetful@example.com")
    monkeypatch.setattr(settings, "TURNSTILE_SECRET_KEY", "test-secret")

    r = await client.post(
        "/api/v1/auth/forgot-password", json={"email": "forgetful@example.com"}
    )

    assert r.status_code == 400
    assert "CAPTCHA" in r.json()["detail"]
