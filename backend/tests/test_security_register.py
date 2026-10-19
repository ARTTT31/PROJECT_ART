"""Sign-up policy: REGISTRATION_MODE, the invite-only default, and the approval queue.

Three rules are pinned here:

- ``closed`` (the default) — the public endpoint refuses everyone, and the answer
  does not tell the caller whether the address exists.
- ``approval`` — a request creates an inactive, ``pending`` account; it cannot log
  in until an admin decides. The response is identical for a free address, one
  that is already registered and one that sits in the trash, because anything
  else turns the endpoint into an account-existence oracle.
- ``open`` — the historic behaviour, available only by explicit configuration.

An unauthenticated caller also can never choose their own role, in any mode.
"""

import pytest
from sqlalchemy import select

from app.core.config import settings
from app.models.user import User
from app.schemas.user import UserCreate
from app.api.dependencies import DEFAULT_PAGES, parse_accessible_pages

NEW_EMAIL = "newcomer@example.com"
PASSWORD = "Passw0rd123"


async def _register(client, email=NEW_EMAIL, **extra):
    # Consent is part of the sign-up contract (PDPA); tests that exercise the
    # refusal itself use the raw endpoint instead of this helper.
    return await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": PASSWORD,
            "name": "Newcomer",
            "accepted_terms": True,
            **extra,
        },
    )


async def _login(client, email=NEW_EMAIL, password=PASSWORD):
    return await client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )


# ── closed (the default) ────────────────────────────────────────────────


def test_closed_is_the_default_mode():
    """A deployment that configures nothing must not accept sign-ups."""
    assert settings.REGISTRATION_MODE == "closed"


async def test_closed_mode_refuses_everyone(client, db_session):
    r = await _register(client)

    assert r.status_code == 403, r.text
    assert "ปิดรับสมัคร" in r.json()["detail"]

    # Nothing was created, and no pending row was left behind either.
    rows = await db_session.execute(select(User).where(User.email == NEW_EMAIL))
    assert rows.scalars().one_or_none() is None


async def test_closed_mode_refusal_is_audited(client, db_session):
    from app.models.audit_log import AuditLog

    await _register(client)

    rows = await db_session.execute(
        select(AuditLog).where(AuditLog.action == "USER_REGISTER_BLOCKED")
    )
    entry = rows.scalars().one_or_none()
    assert entry is not None, "a refused sign-up attempt must be traceable"
    # The address is masked, so the log is not a list of everyone who tried.
    assert NEW_EMAIL not in (entry.details or "")


async def test_registration_mode_is_public_but_empty_of_data(client):
    """The login page needs the policy; it must not learn anything else."""
    r = await client.get("/api/v1/auth/registration-mode")

    assert r.status_code == 200
    assert r.json()["data"] == {"registration_mode": "closed"}


# ── approval ────────────────────────────────────────────────────────────


async def test_approval_mode_creates_a_pending_account_that_cannot_log_in(
    client, db_session, monkeypatch
):
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "approval")

    r = await _register(client)
    assert r.status_code == 201, r.text
    assert r.json()["data"]["status"] == "pending"

    user = (
        await db_session.execute(select(User).where(User.email == NEW_EMAIL))
    ).scalar_one()
    assert user.status == "pending"
    assert user.is_active is False, "a pending account must not be usable"

    denied = await _login(client)
    assert denied.status_code == 403, denied.text
    assert "รอผู้ดูแลระบบอนุมัติ" in denied.json()["detail"]


async def test_approval_mode_does_not_reveal_a_known_address(
    client, db_session, monkeypatch, make_user
):
    """A duplicate address gets the same 201 body as a free one, and no new row."""
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "approval")
    await make_user(email="taken@example.com")

    fresh = await _register(client, email="brand.new@example.com")
    duplicate = await _register(client, email="taken@example.com")

    assert fresh.status_code == duplicate.status_code == 201
    assert fresh.json() == duplicate.json()
    assert "taken@example.com" not in duplicate.text

    rows = await db_session.execute(select(User).where(User.email == "taken@example.com"))
    # The existing account was not turned into a pending request.
    assert rows.scalars().one().status is None


async def test_approval_mode_cannot_target_a_trashed_address(
    client, db_session, monkeypatch, logged_in_admin_user
):
    """The trash keeps the address reserved: a request for it is a silent no-op."""
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "approval")
    trashed = await _make_public_user(db_session, email="gone@example.com")
    assert (await client.delete(f"/api/v1/users/{trashed.id}")).status_code == 200

    r = await _register(client, email="gone@example.com")

    assert r.status_code == 201
    assert r.json()["data"]["status"] == "pending"
    await db_session.refresh(trashed)
    assert trashed.status is None, "a trashed account must not become a pending request"


async def _make_public_user(db_session, email):
    """Insert an ordinary (non-pending) account for a test."""
    user = User(
        email=email.lower(),
        hashed_password="x",
        name="Public",
        role="user",
        is_active=True,
        accessible_pages=None,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


# ── open ────────────────────────────────────────────────────────────────


async def test_open_mode_still_creates_an_active_account(client, db_session, monkeypatch):
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "open")

    r = await _register(client)
    assert r.status_code == 201, r.text

    user = (
        await db_session.execute(select(User).where(User.email == NEW_EMAIL))
    ).scalar_one()
    assert user.is_active is True
    assert user.status == "active" or user.status is None

    assert (await _login(client)).status_code == 200


# ── role escalation, in whichever mode is active ────────────────────────


async def test_register_cannot_choose_role(client, monkeypatch):
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "open")

    r = await client.post("/api/v1/auth/register", json={
        "email": "evil@example.com", "password": PASSWORD,
        "name": "Evil", "role": "admin", "accepted_terms": True})
    assert r.status_code in (201, 422)
    if r.status_code == 201:
        r = await _login(client, email="evil@example.com")
        tok = r.cookies.get("access_token")
        client.cookies.clear()
        r = await client.get("/api/v1/users/", headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 403, "self-registered user must NOT become admin"


async def test_register_ignores_whitehouse_role(client, monkeypatch):
    """Even a valid role value in the body must not grant admin on self-register."""
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "open")

    r = await client.post("/api/v1/auth/register", json={
        "email": "whitehouse@example.com", "password": PASSWORD,
        "name": "Wh", "role": "admin", "accepted_terms": True})
    assert r.status_code == 201
    r = await _login(client, email="whitehouse@example.com")
    tok = r.cookies.get("access_token")
    client.cookies.clear()
    r = await client.get("/api/v1/users/", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 403


async def test_approval_mode_ignores_a_role_in_the_body(client, db_session, monkeypatch):
    """The moderation queue is not a way around the role rule either."""
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "approval")

    r = await client.post("/api/v1/auth/register", json={
        "email": "sneaky@example.com", "password": PASSWORD,
        "name": "Sneaky", "role": "admin", "accepted_terms": True})
    assert r.status_code == 201

    user = (
        await db_session.execute(select(User).where(User.email == "sneaky@example.com"))
    ).scalar_one()
    assert user.role == "user"
    assert user.status == "pending"


def test_user_create_role_is_literal():
    """UserCreate (admin-only endpoint schema) restricts role to known values."""
    with pytest.raises(ValueError):
        UserCreate(email="x@y.com", password=PASSWORD, name="X", role="root")
    assert UserCreate(email="x@y.com", password=PASSWORD, name="X").role == "user"


def test_missing_page_list_means_the_historic_default():
    """NULL page access must not silently become \"everything\"."""
    assert parse_accessible_pages(None) == list(DEFAULT_PAGES)
    assert parse_accessible_pages("not json") == list(DEFAULT_PAGES)
    assert parse_accessible_pages('{"dashboard": true}') == list(DEFAULT_PAGES)
    assert parse_accessible_pages('["dashboard"]') == ["dashboard"]
