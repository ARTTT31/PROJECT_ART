"""Tests for 2FA Trusted Device Token helpers and Login Integration."""

import json
import pytest
from datetime import timedelta
from app.core.security import (
    create_trusted_device_token,
    verify_trusted_device_token,
    get_user_2fa_salt,
)
from app.core.totp import code_at, generate_secret, generate_recovery_codes


def test_trusted_device_token_lifecycle():
    user_id = 42
    pwd_hash = "$argon2id$v=19$m=65536,t=3,p=4$somehash"
    totp_sec = "JBSWY3DPEHPK3PXP"
    salt = get_user_2fa_salt(pwd_hash, totp_sec)

    token_id = "test-token-id"
    token = create_trusted_device_token(user_id, salt, token_id)
    assert token is not None

    # Valid token verification
    assert verify_trusted_device_token(token, user_id, salt) is True

    # Wrong user id
    assert verify_trusted_device_token(token, 999, salt) is False

    # Password changed -> salt changed -> invalid
    new_salt = get_user_2fa_salt("$argon2id$v=19$m=65536,t=3,p=4$newhash", totp_sec)
    assert verify_trusted_device_token(token, user_id, new_salt) is False

    # 2FA secret changed / reset -> salt changed -> invalid
    new_salt_2fa = get_user_2fa_salt(pwd_hash, "NEWSECRETKEY1234")
    assert verify_trusted_device_token(token, user_id, new_salt_2fa) is False

    # Expired token
    expired_token = create_trusted_device_token(
        user_id, salt, token_id, expires_delta=-timedelta(seconds=1)
    )
    assert verify_trusted_device_token(expired_token, user_id, salt) is False

    # Malformed token
    assert verify_trusted_device_token("garbage.token.value", user_id, salt) is False


class TestTrustedDeviceLoginIntegration:
    async def test_trusted_device_flow_sets_cookie_and_skips_totp(
        self, client, db_session
    ):
        from conftest import seed_account

        user = await seed_account(db_session, "trustdevice@example.com", "Password123!")
        secret = generate_secret()
        _, hashes = generate_recovery_codes()
        user.totp_secret = secret
        user.totp_enabled = True
        user.totp_recovery_codes = json.dumps(hashes)
        await db_session.commit()

        # 1. Normal login without 2FA code returns totp_required
        client.cookies.clear()
        res1 = await client.post(
            "/api/v1/auth/login",
            json={"email": "trustdevice@example.com", "password": "Password123!"},
        )
        assert res1.status_code == 200
        assert res1.json()["result"] == "totp_required"

        # 2. Login with 2FA code and trust_device=True
        code = code_at(secret)
        res2 = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "trustdevice@example.com",
                "password": "Password123!",
                "totp_code": code,
                "trust_device": True,
            },
        )
        assert res2.status_code == 200
        assert res2.json()["result"] == "success"
        assert "trusted_device" in res2.cookies
        trusted_cookie_val = res2.cookies["trusted_device"]

        # 3. Subsequent login with password only on the trusted device:
        # clear session cookies but KEEP trusted_device cookie
        client.cookies.clear()
        client.cookies.set("trusted_device", trusted_cookie_val)

        res3 = await client.post(
            "/api/v1/auth/login",
            json={"email": "trustdevice@example.com", "password": "Password123!"},
        )
        assert res3.status_code == 200
        assert res3.json()["result"] == "success"
        assert "access_token" in res3.cookies

    async def test_trusted_device_invalidated_on_secret_change(
        self, client, db_session
    ):
        from conftest import seed_account

        user = await seed_account(db_session, "trustdevice2@example.com", "Password123!")
        secret = generate_secret()
        user.totp_secret = secret
        user.totp_enabled = True
        await db_session.commit()

        # Login and trust device
        code = code_at(secret)
        res = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "trustdevice2@example.com",
                "password": "Password123!",
                "totp_code": code,
                "trust_device": True,
            },
        )
        assert res.status_code == 200
        trusted_cookie = res.cookies["trusted_device"]

        # Invalidate by changing 2FA secret
        user.totp_secret = generate_secret()
        await db_session.commit()

        # Login with trusted_device cookie -> must ask for totp_required because salt changed!
        client.cookies.clear()
        client.cookies.set("trusted_device", trusted_cookie)

        res_retry = await client.post(
            "/api/v1/auth/login",
            json={"email": "trustdevice2@example.com", "password": "Password123!"},
        )
        assert res_retry.status_code == 200
        assert res_retry.json()["result"] == "totp_required"
