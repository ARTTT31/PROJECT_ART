"""Google sign-in vs the registration policy (regression tests).

Two rules are pinned here:

- An EXISTING account signs in with Google in every mode. The provisioning
  gates used to run before the account lookup, so ``closed`` refused even
  accounts that already existed — that regression broke the production login
  and is the main thing these tests guard.
- CREATING an account follows ``GOOGLE_SIGNUP_ENABLED`` (default false).
  With the flag off, creation follows ``REGISTRATION_MODE``; enabling it is an
  explicit decision to let a verified Google email create a working account.

Both Google entry points are covered: POST /google/verify-token and the
GET /google → /google/callback redirect flow.
"""

from urllib.parse import parse_qs, urlparse

import app.api.v1.endpoints.auth as auth_mod
from app.core.config import settings
from sqlalchemy.future import select

from app.models.user import User


def _fake_google(payload):
    class G:
        @staticmethod
        def verify_oauth2_token(tok, req, *a, **k):
            return payload

    return G


def _google_checks(monkeypatch, payload):
    """Wire the fake google-auth objects + valid client ID for an endpoint call."""
    monkeypatch.setenv("GOOGLE_VALID_CLIENT_IDS", "legit.apps.googleusercontent.com")
    monkeypatch.setattr(auth_mod, "_GOOGLE_AUTH_AVAILABLE", True)
    monkeypatch.setattr(
        auth_mod,
        "google_requests",
        type("R", (), {"Request": staticmethod(lambda: None)}),
    )
    monkeypatch.setattr(auth_mod, "google_id_token", _fake_google(payload))


def _fake_code_exchange(monkeypatch):
    """Stub the callback's code→token HTTP call with a fixed id_token."""

    class _FakeResponse:
        status_code = 200

        @staticmethod
        def json():
            return {"id_token": "x.y.z"}

    class _FakeAsyncClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, *a, **k):
            return _FakeResponse()

    monkeypatch.setattr(auth_mod.httpx, "AsyncClient", _FakeAsyncClient)


def _google_error_from(location: str) -> str:
    """Read back the readable refusal the callback appended to the login URL."""
    query = parse_qs(urlparse(location).query)
    return query["google_error"][0]


async def _sign_in_with_google(client, email="member@example.com", **extra):
    payload = {
        "aud": "legit.apps.googleusercontent.com",
        "email": email,
        "email_verified": True,
        "name": "Member",
        **extra,
    }
    return await client.post("/api/v1/auth/google/verify-token", json={"id_token": "x.y.z"}), payload


# ── existing accounts ───────────────────────────────────────────────────────


async def test_existing_account_signs_in_while_signups_are_closed(
    client, make_user, monkeypatch
):
    """The production regression: closed mode must not lock out members."""
    await make_user(email="member@example.com", name="Member")
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "closed")
    monkeypatch.setattr(settings, "GOOGLE_SIGNUP_ENABLED", False)
    _google_checks(
        monkeypatch,
        {
            "aud": "legit.apps.googleusercontent.com",
            "email": "member@example.com",
            "email_verified": True,
            "name": "Member",
        },
    )

    r = await client.post("/api/v1/auth/google/verify-token", json={"id_token": "x.y.z"})

    assert r.status_code == 200, r.text
    assert r.json()["data"]["user"]["email"] == "member@example.com"


async def test_existing_account_ignores_the_provisioning_domain_allowlist(
    client, make_user, monkeypatch
):
    """The allow-list decides who may be CREATED, never who may sign in."""
    await make_user(email="member@gmail.com", name="Member")
    monkeypatch.setenv("GOOGLE_ALLOWED_DOMAINS", "example.co.th")
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "closed")
    monkeypatch.setattr(settings, "GOOGLE_SIGNUP_ENABLED", False)
    _google_checks(
        monkeypatch,
        {
            "aud": "legit.apps.googleusercontent.com",
            "email": "member@gmail.com",
            "email_verified": True,
            "name": "Member",
        },
    )

    r = await client.post("/api/v1/auth/google/verify-token", json={"id_token": "x.y.z"})

    assert r.status_code == 200, r.text


# ── first sign-in (account creation) ────────────────────────────────────────


async def test_first_signin_creates_an_account_when_explicitly_enabled(client, db_session, make_user, monkeypatch):
    """Enabling GOOGLE_SIGNUP_ENABLED keeps the historic open-Google behaviour."""
    monkeypatch.setattr(settings, "GOOGLE_SIGNUP_ENABLED", True)
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "closed")  # strictest mode
    _google_checks(
        monkeypatch,
        {
            "aud": "legit.apps.googleusercontent.com",
            "email": "fresh@gmail.com",
            "email_verified": True,
            "name": "Fresh",
        },
    )

    r = await client.post("/api/v1/auth/google/verify-token", json={"id_token": "x.y.z"})

    assert r.status_code == 200, r.text
    created = (
        await db_session.execute(select(User).where(User.email == "fresh@gmail.com"))
    ).scalars().one_or_none()
    assert created is not None and created.is_active is True
    # Google verified the address, so the account never needs the email flow.
    assert created.email_verified_at is not None


async def test_first_signin_cannot_bypass_approval_by_default(
    client, db_session, make_user, monkeypatch
):
    """The secure default queues a first Google sign-in instead of admitting it."""
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "approval")
    monkeypatch.setattr(settings, "GOOGLE_SIGNUP_ENABLED", False)
    _google_checks(
        monkeypatch,
        {
            "aud": "legit.apps.googleusercontent.com",
            "email": "pending@gmail.com",
            "email_verified": True,
            "name": "Pending",
        },
    )

    r = await client.post("/api/v1/auth/google/verify-token", json={"id_token": "x.y.z"})

    assert r.status_code == 403, r.text
    created = (
        await db_session.execute(select(User).where(User.email == "pending@gmail.com"))
    ).scalars().one_or_none()
    assert created is not None
    assert created.is_active is False
    assert created.status == "pending"


async def test_creation_refused_when_flag_off_and_mode_closed(client, db_session, make_user, monkeypatch):
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "closed")
    monkeypatch.setattr(settings, "GOOGLE_SIGNUP_ENABLED", False)
    _google_checks(
        monkeypatch,
        {
            "aud": "legit.apps.googleusercontent.com",
            "email": "stranger@gmail.com",
            "email_verified": True,
            "name": "Stranger",
        },
    )

    r = await client.post("/api/v1/auth/google/verify-token", json={"id_token": "x.y.z"})

    assert r.status_code == 403
    assert "ปิดรับสมัคร" in r.json()["detail"]
    rows = await db_session.execute(select(User).where(User.email == "stranger@gmail.com"))
    assert rows.scalars().one_or_none() is None, "no account may be created"


async def test_creation_queues_for_approval_when_flag_off_and_mode_approval(
    client, db_session, make_user, monkeypatch
):
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "approval")
    monkeypatch.setattr(settings, "GOOGLE_SIGNUP_ENABLED", False)
    _google_checks(
        monkeypatch,
        {
            "aud": "legit.apps.googleusercontent.com",
            "email": "hopeful@gmail.com",
            "email_verified": True,
            "name": "Hopeful",
        },
    )

    r = await client.post("/api/v1/auth/google/verify-token", json={"id_token": "x.y.z"})

    # The round trip is refused, but the request is queued for an admin.
    assert r.status_code == 403
    assert "รอผู้ดูแลระบบอนุมัติ" in r.json()["detail"]
    queued = (
        await db_session.execute(select(User).where(User.email == "hopeful@gmail.com"))
    ).scalars().one_or_none()
    assert queued is not None and queued.status == "pending" and queued.is_active is False


async def test_flag_on_overrides_approval_mode_too(client, db_session, make_user, monkeypatch):
    """The flag (default true) keeps Google signing people in, whatever the mode."""
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "approval")
    monkeypatch.setattr(settings, "GOOGLE_SIGNUP_ENABLED", True)
    _google_checks(
        monkeypatch,
        {
            "aud": "legit.apps.googleusercontent.com",
            "email": "instant@gmail.com",
            "email_verified": True,
            "name": "Instant",
        },
    )

    r = await client.post("/api/v1/auth/google/verify-token", json={"id_token": "x.y.z"})

    assert r.status_code == 200, r.text
    created = (
        await db_session.execute(select(User).where(User.email == "instant@gmail.com"))
    ).scalars().one_or_none()
    assert created is not None and created.is_active is True


# ── the redirect flow has the same rule ─────────────────────────────────────


async def test_callback_signs_in_an_existing_account_when_closed(client, make_user, monkeypatch):
    """GET /google/callback must not repeat the verify-token endpoint's old bug."""
    await make_user(email="member@example.com", name="Member")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "legit.apps.googleusercontent.com")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setattr(settings, "GOOGLE_SIGNUP_ENABLED", False)
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "closed")
    _google_checks(
        monkeypatch,
        {
            "aud": "legit.apps.googleusercontent.com",
            "email": "member@example.com",
            "email_verified": True,
            "name": "Member",
        },
    )

    _fake_code_exchange(monkeypatch)

    # Start the flow to obtain the state cookie the callback verifies.
    start = await client.get("/api/v1/auth/google")
    assert start.status_code in (302, 307)
    state = client.cookies.get("oauth_state")
    assert state

    r = await client.get(f"/api/v1/auth/google/callback?code=abc&state={state}")

    assert r.status_code in (302, 307), r.text
    assert "/login-success" in r.headers.get("location", "")
    assert client.cookies.get("access_token"), "the callback must issue cookies"


async def test_callback_sends_a_refused_first_signin_to_the_login_page(
    client, db_session, make_user, monkeypatch
):
    """A refusal must not strand the browser on raw JSON at the API origin.

    The callback is a full-page navigation from Google, so the 403 the API
    raises for a closed deployment has nobody to render it — the person only
    sees the JSON body. It has to become a redirect the login page can explain.
    """
    monkeypatch.setenv("FRONTEND_URL", "https://app.example.com")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "legit.apps.googleusercontent.com")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setattr(settings, "GOOGLE_SIGNUP_ENABLED", False)
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "closed")
    _google_checks(
        monkeypatch,
        {
            "aud": "legit.apps.googleusercontent.com",
            "email": "stranger@gmail.com",
            "email_verified": True,
            "name": "Stranger",
        },
    )
    _fake_code_exchange(monkeypatch)

    # Start the flow to obtain the state cookie the callback verifies.
    start = await client.get("/api/v1/auth/google")
    assert start.status_code in (302, 307)
    state = client.cookies.get("oauth_state")
    assert state

    r = await client.get(f"/api/v1/auth/google/callback?code=abc&state={state}")

    assert r.status_code in (302, 307), r.text
    location = r.headers["location"]
    assert location.startswith("https://app.example.com/login?")
    assert "ปิดรับสมัคร" in _google_error_from(location)
    assert client.cookies.get("access_token") is None, "no session may be issued"
    # The single-use state cookie is consumed even on a refusal.
    assert not client.cookies.get("oauth_state")
    rows = await db_session.execute(select(User).where(User.email == "stranger@gmail.com"))
    assert rows.scalars().one_or_none() is None, "no account may be created"


async def test_callback_returns_a_cancelled_consent_to_the_login_page(
    client, make_user, monkeypatch
):
    """Google says no with ?error=access_denied and no code — not raw JSON."""
    monkeypatch.setenv("FRONTEND_URL", "https://app.example.com")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "legit.apps.googleusercontent.com")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "test-client-secret")

    start = await client.get("/api/v1/auth/google")
    assert start.status_code in (302, 307)
    state = client.cookies.get("oauth_state")
    assert state

    r = await client.get(
        f"/api/v1/auth/google/callback?error=access_denied&state={state}"
    )

    assert r.status_code in (302, 307), r.text
    assert "ถูกยกเลิก" in _google_error_from(r.headers["location"])
