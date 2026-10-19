"""Admin "create user" tests.

The panel gained a create form, which means two things the API did not do
before: it accepts the page access list up front (so a new account is not
created with unrestricted pages and fixed afterwards), and it has to explain a
duplicate e-mail/username that belongs to a *trashed* account — a user the admin
cannot even see in the list.
"""

from sqlalchemy import select

from conftest import seed_account
from app.models.user import User

ADMIN_EMAIL = "admin.create@example.com"
PASSWORD = "SecretPass123"


async def _seed(db_session, email, name="Admin"):
    """Create an account directly — self-registration is closed by default."""
    return await seed_account(db_session, email, PASSWORD, name=name)


async def _login(client, email):
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert resp.status_code == 200, resp.text
    token = client.cookies.get("csrf_token")
    if not token:
        token = (await client.get("/api/v1/auth/csrf")).json()["data"]["csrf_token"]
    client.headers["X-CSRF-Token"] = token


async def _make_admin(client, db_session, email=ADMIN_EMAIL):
    await _seed(db_session, email, "Admin")
    user = (await db_session.execute(select(User).where(User.email == email))).scalar_one()
    user.role = "admin"
    await db_session.commit()
    await _login(client, email)
    return user.id


async def test_create_user_stores_the_chosen_page_access(client, db_session):
    await _make_admin(client, db_session)
    pages = '["dashboard","profile"]'

    resp = await client.post(
        "/api/v1/users/admin-create",
        json={
            "username": "limited.user",
            "display_name": "Limited User",
            "password": PASSWORD,
            "email": "limited@example.com",
            "role": "user",
            "accessible_pages": pages,
        },
    )

    assert resp.status_code == 201, resp.text
    created = (
        await db_session.execute(select(User).where(User.username == "limited.user"))
    ).scalar_one()
    assert created.accessible_pages == pages
    assert created.role == "user"
    assert created.deleted_at is None


async def test_create_user_without_a_page_list_stays_unrestricted(client, db_session):
    """NULL means "all pages" for the panel, so it must stay NULL."""
    await _make_admin(client, db_session)

    resp = await client.post(
        "/api/v1/users/admin-create",
        json={
            "username": "open.user",
            "display_name": "Open User",
            "password": PASSWORD,
        },
    )

    assert resp.status_code == 201, resp.text
    created = (
        await db_session.execute(select(User).where(User.username == "open.user"))
    ).scalar_one()
    assert created.accessible_pages is None


async def test_a_trashed_account_does_not_look_like_an_ordinary_duplicate(
    client, db_session
):
    """The e-mail is still taken, but the admin needs to know where it went."""
    await _make_admin(client, db_session)
    await _seed(db_session, "returning@example.com", "Returning")

    victim = (
        await db_session.execute(select(User).where(User.email == "returning@example.com"))
    ).scalar_one()
    victim_id = victim.id
    assert (await client.delete(f"/api/v1/users/{victim_id}")).status_code == 200

    blocked = await client.post(
        "/api/v1/users/admin-create",
        json={
            "username": "returning.again",
            "display_name": "Returning Again",
            "password": PASSWORD,
            "email": "returning@example.com",
        },
    )

    assert blocked.status_code == 400, blocked.text
    detail = blocked.json()["detail"]
    assert "ถังขยะ" in detail, "the message must point at the trash, not a dead end"

    # Restoring the account frees nothing up, but it does make the hint true.
    assert (await client.post(f"/api/v1/users/{victim_id}/restore")).status_code == 200

    still_taken = await client.post(
        "/api/v1/users/admin-create",
        json={
            "username": "returning.again",
            "display_name": "Returning Again",
            "password": PASSWORD,
            "email": "returning@example.com",
        },
    )
    assert still_taken.status_code == 400
    assert "ถังขยะ" not in still_taken.json()["detail"]


async def test_a_plain_user_cannot_create_accounts(client, db_session):
    await _seed(db_session, "plain.creator@example.com", "Plain")
    await _login(client, "plain.creator@example.com")

    resp = await client.post(
        "/api/v1/users/admin-create",
        json={"username": "nope", "display_name": "Nope", "password": PASSWORD},
    )

    assert resp.status_code == 403, resp.text
