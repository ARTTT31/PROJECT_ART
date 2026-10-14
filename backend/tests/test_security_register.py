"""Regression tests for the public /auth/register endpoint (T1).

Guarantees that an unauthenticated caller cannot choose their own role —
``role`` in the request body must be ignored (or rejected), never honored.
"""

from app.schemas.user import UserCreate

import pytest


async def test_register_cannot_choose_role(client):
    r = await client.post("/api/v1/auth/register", json={
        "email": "evil@example.com", "password": "Passw0rd123",
        "name": "Evil", "role": "admin"})
    assert r.status_code in (201, 422)
    if r.status_code == 201:
        r = await client.post(
            "/api/v1/auth/login",
            json={"email": "evil@example.com", "password": "Passw0rd123"},
        )
        tok = r.cookies.get("access_token")
        client.cookies.clear()
        r = await client.get("/api/v1/users/", headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 403, "self-registered user must NOT become admin"


async def test_register_ignores_whitehouse_role(client):
    """Even a valid role value in the body must not grant admin on self-register."""
    r = await client.post("/api/v1/auth/register", json={
        "email": "whitehouse@example.com", "password": "Passw0rd123",
        "name": "Wh", "role": "admin"})
    assert r.status_code == 201
    r = await client.post(
        "/api/v1/auth/login",
        json={"email": "whitehouse@example.com", "password": "Passw0rd123"},
    )
    tok = r.cookies.get("access_token")
    client.cookies.clear()
    r = await client.get("/api/v1/users/", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 403


def test_user_create_role_is_literal():
    """UserCreate (admin-only endpoint schema) restricts role to known values."""
    with pytest.raises(ValueError):
        UserCreate(email="x@y.com", password="Passw0rd123", name="X", role="root")
    assert UserCreate(email="x@y.com", password="Passw0rd123", name="X").role == "user"
