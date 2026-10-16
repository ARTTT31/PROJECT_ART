"""Admin user search / filter / pagination tests.

The panel shipped without any of this: it listed the first 100 rows with no way
to narrow them, so an admin looking for one account had to scroll. These tests
pin the query behaviour the search box and pager depend on — in particular that
``X-Total-Count`` counts *matches* rather than the page, because the pager uses
it to decide whether a next page exists.
"""

import pytest
from sqlalchemy import select

from app.models.user import User

ADMIN_EMAIL = "admin.query@example.com"
PASSWORD = "SecretPass123"


async def _register(client, email, name, username=None):
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": PASSWORD, "name": name},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _set_username_and_role(db_session, email, role="user", username=None):
    user = (await db_session.execute(select(User).where(User.email == email))).scalar_one()
    user.role = role
    if username:
        user.username = username
    await db_session.commit()
    return user.id


async def _login(client, email):
    resp = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert resp.status_code == 200, resp.text
    token = client.cookies.get("csrf_token")
    if not token:
        token = (await client.get("/api/v1/auth/csrf")).json()["data"]["csrf_token"]
    client.headers["X-CSRF-Token"] = token


@pytest.fixture
async def admin_client(client, db_session):
    """A signed-in admin for the query endpoints."""
    await _register(client, ADMIN_EMAIL, "Admin Query")
    await _set_username_and_role(db_session, ADMIN_EMAIL, role="admin")
    await _login(client, ADMIN_EMAIL)
    return client


@pytest.fixture
async def directory(client, db_session):
    """Five accounts with distinct names, one suspended, one a username login."""
    await _register(client, "alice.smith@example.com", "Alice Smith")
    await _register(client, "bob.jones@example.com", "Bob Jones")
    await _register(client, "somchai@example.com", "สมชาย ใจดี")
    await _register(client, "suspended@example.com", "Suspended Sam")
    await _set_username_and_role(
        db_session, "suspended@example.com", username="samsam"
    )
    user = (
        await db_session.execute(select(User).where(User.email == "suspended@example.com"))
    ).scalar_one()
    user.is_active = False
    await db_session.commit()
    return list((await db_session.execute(select(User))).scalars().all())


async def _list(client, **params):
    resp = await client.get("/api/v1/users/", params=params)
    assert resp.status_code == 200, resp.text
    return resp


def _emails(resp):
    return sorted(u["email"] for u in resp.json())


async def test_total_count_reports_matches_not_page_size(admin_client, directory):
    resp = await _list(admin_client, limit=2)

    assert len(resp.json()) == 2
    assert resp.headers["x-total-count"] == str(len(directory))


async def test_paging_walks_the_whole_directory_without_repeats(admin_client, directory):
    first = (await _list(admin_client, limit=2, skip=0)).json()
    second = (await _list(admin_client, limit=2, skip=2)).json()
    last = (await _list(admin_client, limit=2, skip=4)).json()

    ids = [u["id"] for u in first + second + last]
    assert len(ids) == len(set(ids)) == len(directory)


@pytest.mark.parametrize(
    "term, expected",
    [
        ("smith", ["alice.smith@example.com"]),  # email, case-insensitive
        ("BOB", ["bob.jones@example.com"]),  # name
        ("samsam", ["suspended@example.com"]),  # username
        ("สมชาย", ["somchai@example.com"]),  # non-ASCII stays intact
    ],
)
async def test_search_matches_name_email_or_username(admin_client, directory, term, expected):
    assert _emails(await _list(admin_client, q=term)) == expected


async def test_search_treats_wildcards_as_literals(admin_client, directory):
    """A bare ``%`` must not behave like "match everything"."""
    assert (await _list(admin_client, q="%")).json() == []
    assert (await _list(admin_client, q="example%com")).json() == []


async def test_filters_narrow_by_role_and_status(admin_client, directory, db_session):
    await _register(admin_client, "second.admin@example.com", "Second Admin")
    await _set_username_and_role(db_session, "second.admin@example.com", role="admin")

    assert _emails(await _list(admin_client, role="admin")) == sorted(
        [ADMIN_EMAIL, "second.admin@example.com"]
    )
    assert _emails(await _list(admin_client, is_active=False)) == ["suspended@example.com"]
    # Filters compose with search.
    assert _emails(await _list(admin_client, q="example.com", role="admin", is_active=True)) == sorted(
        [ADMIN_EMAIL, "second.admin@example.com"]
    )


async def test_filters_can_match_nothing(admin_client, directory):
    resp = await _list(admin_client, q="nobody-by-this-name")

    assert resp.json() == []
    assert resp.headers["x-total-count"] == "0"


async def test_an_unknown_role_is_rejected(admin_client, directory):
    resp = await admin_client.get("/api/v1/users/", params={"role": "superuser"})

    assert resp.status_code == 422, resp.text


async def test_limit_is_capped(admin_client, directory):
    """``limit`` is admin input: bound it so a page cannot ask for everything."""
    resp = await admin_client.get("/api/v1/users/", params={"limit": 5000})

    assert resp.status_code == 422, resp.text
