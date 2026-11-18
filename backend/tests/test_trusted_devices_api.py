"""Trusted devices: the list, per-device revocation, logout and the audit trail.

A trusted-device cookie skips the second factor for 30 days, so these tests pin
the parts that make it withdrawable: the row behind the cookie, the settings
value that both the JWT and the cookie lifetime come from, and the audit rows
that explain a sign-in where no code was typed.
"""

import json
from datetime import timedelta

from sqlalchemy import select

from app.core.config import settings
from app.core.security import get_password_hash
from app.core.totp import code_at, generate_recovery_codes, generate_secret
from app.models.audit_log import AuditLog
from app.models.trusted_device import TrustedDevice


def _arm_csrf(client) -> None:
    """Echo the readable CSRF cookie, as the browser helper does."""
    token = client.cookies.get("csrf_token")
    if token:
        client.headers["X-CSRF-Token"] = token


async def _enable_2fa(db_session, user) -> str:
    """Turn 2FA on for a seeded account and return its TOTP secret."""
    secret = generate_secret()
    _, hashes = generate_recovery_codes()
    user.totp_secret = secret
    user.totp_enabled = True
    user.totp_recovery_codes = json.dumps(hashes)
    await db_session.commit()
    return secret


async def _trust_current_browser(client, email: str, password: str, secret: str):
    """Log in with a live code and "remember this device"; return the response."""
    response = await client.post(
        "/api/v1/auth/login",
        json={
            "email": email,
            "password": password,
            "totp_code": code_at(secret),
            "trust_device": True,
        },
    )
    return response


async def _actions_for(db_session, user_id: int) -> set[str]:
    rows = (
        await db_session.execute(select(AuditLog).where(AuditLog.user_id == user_id))
    ).scalars().all()
    return {row.action for row in rows}


class TestTrustedDevicesApi:
    async def test_cookie_lifetime_comes_from_settings(self, client, db_session):
        from conftest import seed_account

        user = await seed_account(db_session, "trustttl@example.com", "Password123!")
        secret = await _enable_2fa(db_session, user)

        response = await _trust_current_browser(
            client, "trustttl@example.com", "Password123!", secret
        )
        assert response.status_code == 200
        # One number drives the JWT and the cookie: a literal here is how the
        # browser keeps a cookie the server already treats as expired.
        assert (
            f"Max-Age={settings.TRUSTED_DEVICE_COOKIE_MAX_AGE}"
            in response.headers.get("set-cookie", "")
        )

    async def test_list_shows_the_trusted_browser(self, client, db_session):
        from conftest import seed_account

        user = await seed_account(db_session, "trustlist@example.com", "Password123!")
        secret = await _enable_2fa(db_session, user)
        await _trust_current_browser(
            client, "trustlist@example.com", "Password123!", secret
        )

        response = await client.get("/api/v1/auth/2fa/trusted-devices")
        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) == 1
        assert data[0]["id"] > 0
        assert data[0]["expires_at"]

    async def test_stale_salt_rows_are_hidden_and_the_read_deletes_nothing(
        self, client, db_session
    ):
        from conftest import seed_account

        user = await seed_account(db_session, "trustsalt@example.com", "Password123!")
        secret = await _enable_2fa(db_session, user)
        await _trust_current_browser(
            client, "trustsalt@example.com", "Password123!", secret
        )

        # A password change re-derives the salt, so the cookie can never verify
        # again. Listing it would promise a bypass that no longer exists.
        user.hashed_password = get_password_hash("NewPassword123!")
        await db_session.commit()

        response = await client.get("/api/v1/auth/2fa/trusted-devices")
        assert response.status_code == 200
        assert response.json()["data"] == []

        # The endpoint is a read: cleanup belongs to the scheduled job, not to
        # every profile page load.
        still_there = (
            await db_session.execute(
                select(TrustedDevice).where(TrustedDevice.user_id == user.id)
            )
        ).scalars().all()
        assert len(still_there) == 1

    async def test_scheduled_cleanup_removes_expired_and_revoked_rows(
        self, client, db_session
    ):
        from app.core.utils import utcnow
        from app.services.session_cleanup import cleanup_expired_sessions_async
        from conftest import seed_account

        user = await seed_account(db_session, "trustgc@example.com", "Password123!")
        db_session.add_all(
            [
                TrustedDevice(
                    user_id=user.id,
                    token_id="gc-expired",
                    salt_version="salt",
                    expires_at=utcnow() - timedelta(minutes=5),
                ),
                TrustedDevice(
                    user_id=user.id,
                    token_id="gc-revoked",
                    salt_version="salt",
                    expires_at=utcnow() + timedelta(days=30),
                    revoked_at=utcnow(),
                ),
                TrustedDevice(
                    user_id=user.id,
                    token_id="gc-live",
                    salt_version="salt",
                    expires_at=utcnow() + timedelta(days=30),
                ),
            ]
        )
        await db_session.commit()

        await cleanup_expired_sessions_async(db_session)

        remaining = (
            await db_session.execute(
                select(TrustedDevice).where(TrustedDevice.user_id == user.id)
            )
        ).scalars().all()
        assert [row.token_id for row in remaining] == ["gc-live"]

    async def test_revoke_makes_the_next_login_ask_for_a_code(
        self, client, db_session
    ):
        from conftest import seed_account

        user = await seed_account(db_session, "trustrevoke@example.com", "Password123!")
        secret = await _enable_2fa(db_session, user)
        await _trust_current_browser(
            client, "trustrevoke@example.com", "Password123!", secret
        )

        listed = await client.get("/api/v1/auth/2fa/trusted-devices")
        device_id = listed.json()["data"][0]["id"]

        _arm_csrf(client)
        revoked = await client.delete(f"/api/v1/auth/2fa/trusted-devices/{device_id}")
        assert revoked.status_code == 200
        # Revoking the browser you are using drops its cookie too.
        assert "trusted_device" not in client.cookies

        client.cookies.clear()
        retry = await client.post(
            "/api/v1/auth/login",
            json={"email": "trustrevoke@example.com", "password": "Password123!"},
        )
        assert retry.status_code == 200
        assert retry.json()["result"] == "totp_required"

    async def test_cannot_revoke_another_accounts_device(self, client, db_session):
        from conftest import seed_account

        owner = await seed_account(db_session, "trustowner@example.com", "Password123!")
        secret = await _enable_2fa(db_session, owner)
        await _trust_current_browser(
            client, "trustowner@example.com", "Password123!", secret
        )
        owner_device_id = (
            await client.get("/api/v1/auth/2fa/trusted-devices")
        ).json()["data"][0]["id"]

        # Another account, signed in on the same client.
        await seed_account(db_session, "trustattacker@example.com", "Password123!")
        client.cookies.clear()
        await client.post(
            "/api/v1/auth/login",
            json={"email": "trustattacker@example.com", "password": "Password123!"},
        )
        _arm_csrf(client)

        response = await client.delete(
            f"/api/v1/auth/2fa/trusted-devices/{owner_device_id}"
        )
        assert response.status_code == 404

        still_there = (
            await db_session.execute(
                select(TrustedDevice).where(TrustedDevice.id == owner_device_id)
            )
        ).scalar_one()
        assert still_there.revoked_at is None

    async def test_logout_forgets_the_browser(self, client, db_session):
        from conftest import seed_account

        user = await seed_account(db_session, "trustlogout@example.com", "Password123!")
        secret = await _enable_2fa(db_session, user)
        await _trust_current_browser(
            client, "trustlogout@example.com", "Password123!", secret
        )

        _arm_csrf(client)
        logged_out = await client.post("/api/v1/auth/logout", json={})
        assert logged_out.status_code == 200
        assert "trusted_device" not in client.cookies

        row = (
            await db_session.execute(
                select(TrustedDevice).where(TrustedDevice.user_id == user.id)
            )
        ).scalar_one()
        assert row.revoked_at is not None

    async def test_trusting_a_browser_sends_a_notice(
        self, client, db_session, monkeypatch
    ):
        from app.services.email_service import outbox_clear, outbox_messages
        from conftest import seed_account

        monkeypatch.setattr(settings, "EMAIL_BACKEND", "console")
        outbox_clear()

        user = await seed_account(db_session, "trustmail@example.com", "Password123!")
        secret = await _enable_2fa(db_session, user)
        await _trust_current_browser(
            client, "trustmail@example.com", "Password123!", secret
        )

        # The cookie announced here bypasses the second factor for weeks, so the
        # owner has to learn about it at the moment it is minted.
        messages = outbox_messages("trustmail@example.com")
        assert messages
        assert str(settings.TRUSTED_DEVICE_EXPIRE_DAYS) in messages[-1]["text"]
        outbox_clear()

    async def test_audit_records_issued_used_and_revoked(self, client, db_session):
        from conftest import seed_account

        user = await seed_account(db_session, "trustaudit@example.com", "Password123!")
        secret = await _enable_2fa(db_session, user)
        await _trust_current_browser(
            client, "trustaudit@example.com", "Password123!", secret
        )
        trusted_cookie = client.cookies.get("trusted_device")
        assert trusted_cookie

        # Password-only sign-in on the trusted cookie: no code, so the audit
        # trail is the only place that explains how it passed.
        client.cookies.clear()
        client.cookies.set("trusted_device", trusted_cookie)
        second = await client.post(
            "/api/v1/auth/login",
            json={"email": "trustaudit@example.com", "password": "Password123!"},
        )
        assert second.status_code == 200
        assert second.json()["result"] == "success"

        device_id = (await client.get("/api/v1/auth/2fa/trusted-devices")).json()[
            "data"
        ][0]["id"]
        _arm_csrf(client)
        assert (
            await client.delete(f"/api/v1/auth/2fa/trusted-devices/{device_id}")
        ).status_code == 200

        actions = await _actions_for(db_session, user.id)
        assert {
            "TRUSTED_DEVICE_ISSUED",
            "TRUSTED_DEVICE_USED",
            "TRUST_DEVICE_REVOKED",
        } <= actions

    async def test_recovery_code_login_is_audited(self, client, db_session):
        from conftest import seed_account

        user = await seed_account(db_session, "trustrecover@example.com", "Password123!")
        secret = generate_secret()
        codes, hashes = generate_recovery_codes()
        user.totp_secret = secret
        user.totp_enabled = True
        user.totp_recovery_codes = json.dumps(hashes)
        await db_session.commit()

        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "trustrecover@example.com",
                "password": "Password123!",
                "recovery_code": codes[0],
            },
        )
        assert response.status_code == 200
        assert response.json()["result"] == "success"
        assert "2FA_RECOVERY_CODE_USED" in await _actions_for(db_session, user.id)

    async def test_trusted_device_use_is_audited_at_most_once_a_day(
        self, client, db_session
    ):
        from app.core.utils import utcnow
        from conftest import seed_account

        user = await seed_account(db_session, "trustnoise@example.com", "Password123!")
        secret = await _enable_2fa(db_session, user)
        await _trust_current_browser(
            client, "trustnoise@example.com", "Password123!", secret
        )

        async def skip_count() -> int:
            rows = (
                await db_session.execute(
                    select(AuditLog).where(
                        AuditLog.user_id == user.id,
                        AuditLog.action == "TRUSTED_DEVICE_USED",
                    )
                )
            ).scalars().all()
            return len(rows)

        async def sign_in_again() -> None:
            response = await client.post(
                "/api/v1/auth/login",
                json={"email": "trustnoise@example.com", "password": "Password123!"},
            )
            assert response.status_code == 200
            assert response.json()["result"] == "success"

        await sign_in_again()
        assert await skip_count() == 1

        # Same browser minutes later: LOGIN_SUCCESS already records that this
        # happened, so a second identical row would be noise in the trail.
        await sign_in_again()
        assert await skip_count() == 1

        # A day later the skip is news again — a new IP on a shared machine is
        # exactly what this row is supposed to surface.
        device = (
            await db_session.execute(
                select(TrustedDevice).where(TrustedDevice.user_id == user.id)
            )
        ).scalars().first()
        assert device is not None
        device.last_used_at = utcnow() - timedelta(hours=25)
        await db_session.commit()

        await sign_in_again()
        assert await skip_count() == 2
