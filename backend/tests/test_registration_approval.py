"""Admin decisions on sign-up requests, and the "one usable admin" invariant.

The approval queue is the only door into an ``approval``-mode deployment, so the
rights around it matter as much as the flow itself: only an admin may list,
approve or reject, every decision is audit-logged, and no admin may leave the
deployment without a usable administrator.
"""

from sqlalchemy import select

from app.core.config import settings
from app.models.audit_log import AuditLog
from app.models.user import User

HOPEFUL_EMAIL = "hopeful@example.com"
PASSWORD = "Passw0rd123"


async def _login(client, email, password=PASSWORD):
    """Log in and arm the CSRF header for later writes."""
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    if resp.status_code == 200:
        token = client.cookies.get("csrf_token")
        if not token:
            token = (await client.get("/api/v1/auth/csrf")).json()["data"]["csrf_token"]
        client.headers["X-CSRF-Token"] = token
    return resp


async def _submit_request(client, email=HOPEFUL_EMAIL):
    """Sign up through the public endpoint (approval mode)."""
    return await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": PASSWORD, "name": "Hopeful"},
    )


# ── the queue is admin-only ─────────────────────────────────────────────


async def test_pending_list_is_admin_only(client, logged_in_user, make_user):
    anonymous = await client.get("/api/v1/users/pending")
    # logged_in_user leaves an authenticated (non-admin) cookie in the jar.
    assert anonymous.status_code == 403, anonymous.text

    client.cookies.clear()
    client.headers.pop("X-CSRF-Token", None)
    assert (await client.get("/api/v1/users/pending")).status_code == 401


async def test_anonymous_cannot_approve_or_reject(client, make_user):
    target = await make_user(email="waiting@example.com", status="pending", is_active=False)

    for action in ("approve", "reject"):
        # A refusal answer hands out a CSRF cookie; drop it so the second call is
        # judged the same way as the first instead of being rejected as a forged
        # cookie-authenticated write.
        client.cookies.clear()
        resp = await client.post(f"/api/v1/users/{target.id}/{action}")
        assert resp.status_code == 401, resp.text


async def test_a_plain_user_cannot_approve_or_reject(client, logged_in_user, make_user):
    target = await make_user(email="waiting@example.com", status="pending", is_active=False)

    for action in ("approve", "reject"):
        resp = await client.post(f"/api/v1/users/{target.id}/{action}")
        assert resp.status_code == 403, resp.text


# ── approve ─────────────────────────────────────────────────────────────


async def test_a_signup_request_can_be_approved_into_a_working_account(
    client, db_session, monkeypatch, logged_in_admin_user
):
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "approval")
    assert (await _submit_request(client)).status_code == 201

    requested = (
        await db_session.execute(select(User).where(User.email == HOPEFUL_EMAIL))
    ).scalar_one()
    assert requested.status == "pending"

    listing = await client.get("/api/v1/users/pending")
    assert listing.status_code == 200
    assert [u["email"] for u in listing.json()] == [HOPEFUL_EMAIL]
    assert listing.headers["x-total-count"] == "1"

    # It cannot sign in while it waits.
    denied = await _login(client, HOPEFUL_EMAIL)
    assert denied.status_code == 403, denied.text

    approved = await client.post(f"/api/v1/users/{requested.id}/approve")
    assert approved.status_code == 200, approved.text
    await db_session.refresh(requested)
    assert requested.status == "active"
    assert requested.is_active is True

    # The same credentials work now (this also replaces the admin's cookies).
    assert (await _login(client, HOPEFUL_EMAIL)).status_code == 200

    logged = (
        await db_session.execute(
            select(AuditLog.action).where(AuditLog.action == "ADMIN_USER_APPROVE")
        )
    ).scalars().all()
    assert logged == ["ADMIN_USER_APPROVE"]


# ── reject ──────────────────────────────────────────────────────────────


async def test_a_signup_request_can_be_rejected(client, db_session, make_user, logged_in_admin_user):
    target = await make_user(
        email="refused@example.com", password=PASSWORD, status="pending", is_active=False
    )

    resp = await client.post(f"/api/v1/users/{target.id}/reject")

    assert resp.status_code == 200, resp.text
    await db_session.refresh(target)
    assert target.status == "rejected"
    assert target.is_active is False

    client.cookies.clear()
    client.headers.pop("X-CSRF-Token", None)
    # A wrong password is answered generically: the account state must not be
    # readable without it.
    wrong = await _login(client, "refused@example.com", password="WrongPass123")
    assert wrong.status_code == 401
    assert "ถูกปฏิเสธ" not in wrong.json()["detail"]

    # With the right password the refusal itself is explained.
    denied = await _login(client, "refused@example.com")
    assert denied.status_code == 403, denied.text
    assert "ถูกปฏิเสธ" in denied.json()["detail"]

    logged = (
        await db_session.execute(
            select(AuditLog.action).where(AuditLog.action == "ADMIN_USER_REJECT")
        )
    ).scalars().all()
    assert logged == ["ADMIN_USER_REJECT"]


async def test_a_rejected_request_may_be_resubmitted(client, db_session, monkeypatch):
    monkeypatch.setattr(settings, "REGISTRATION_MODE", "approval")
    first = await _submit_request(client, email="retry@example.com")
    assert first.status_code == 201

    user = (
        await db_session.execute(select(User).where(User.email == "retry@example.com"))
    ).scalar_one()
    user.status = "rejected"
    await db_session.commit()

    second = await _submit_request(client, email="retry@example.com")

    assert second.status_code == 201
    assert second.json()["data"]["status"] == "pending"
    await db_session.refresh(user)
    assert user.status == "pending", "a refused request must be able to come back"


# ── decisions only apply to a waiting request ───────────────────────────


async def test_deciding_an_account_that_is_not_pending_is_404(
    client, make_user, logged_in_admin_user
):
    settled = await make_user(email="settled@example.com")

    for action in ("approve", "reject"):
        resp = await client.post(f"/api/v1/users/{settled.id}/{action}")
        assert resp.status_code == 404, resp.text


async def test_the_edit_form_approves_a_pending_account(client, db_session, make_user, logged_in_admin_user):
    """Turning the account on through the ordinary form is the same decision."""
    target = await make_user(email="via.form@example.com", status="pending", is_active=False)

    resp = await client.put(f"/api/v1/users/{target.id}", json={"is_active": True})

    assert resp.status_code == 200, resp.text
    await db_session.refresh(target)
    assert target.is_active is True
    assert target.status == "active"


# ── the deployment keeps one usable admin ───────────────────────────────


async def _usable_admins(db_session) -> int:
    rows = await db_session.execute(
        select(User).where(
            User.role == "admin", User.is_active.is_(True), User.deleted_at.is_(None)
        )
    )
    return len(rows.scalars().all())


async def test_the_only_admin_cannot_remove_its_own_access(client, db_session, logged_in_admin_user):
    from conftest import TEST_ADMIN_EMAIL

    admin = (
        await db_session.execute(select(User).where(User.email == TEST_ADMIN_EMAIL))
    ).scalar_one()

    attempts = [
        ("put", f"/api/v1/users/{admin.id}", {"role": "user"}),
        ("put", f"/api/v1/users/{admin.id}", {"is_active": False}),
        ("put", f"/api/v1/users/{admin.id}", {"is_locked": True}),
        ("delete", f"/api/v1/users/{admin.id}", None),
    ]

    for method, url, body in attempts:
        if method == "put":
            resp = await client.put(url, json=body)
        else:
            resp = await client.delete(url)
        assert resp.status_code == 400, f"{method} {url} must be refused: {resp.text}"

    await db_session.refresh(admin)
    assert admin.role == "admin"
    assert admin.is_active is True
    assert admin.is_locked is False
    assert await _usable_admins(db_session) >= 1, "the deployment must stay manageable"


async def test_a_second_admin_can_still_be_demoted(client, db_session, make_user, logged_in_admin_user):
    """The safeguard must not freeze ordinary admin management."""
    second = await make_user(email="second.admin@example.com", role="admin")

    resp = await client.put(f"/api/v1/users/{second.id}", json={"role": "user"})

    assert resp.status_code == 200, resp.text
    await db_session.refresh(second)
    assert second.role == "user"
    assert await _usable_admins(db_session) >= 1
