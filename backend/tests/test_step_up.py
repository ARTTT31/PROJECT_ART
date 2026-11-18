"""Step-up re-verification for dangerous account actions.

A session cookie authenticates a browser, not a person. These tests pin the
second proof that password rotation, sign-out-everywhere, data export and
"forget every trusted browser" demand when the account has 2FA: a code typed
minutes ago in *this* session, not a cookie copied from somewhere else.
"""

import json

from sqlalchemy import select

from app.core.config import settings
from app.core.security import create_step_up_token
from app.core.totp import code_at, generate_recovery_codes, generate_secret
from app.models.session import UserSession
from app.models.trusted_device import TrustedDevice


async def _enable_2fa(db_session, user) -> str:
    secret = generate_secret()
    _, hashes = generate_recovery_codes()
    user.totp_secret = secret
    user.totp_enabled = True
    user.totp_recovery_codes = json.dumps(hashes)
    await db_session.commit()
    return secret


async def _sign_in_2fa(client, email: str, password: str, secret: str) -> None:
    """Log in with a live code and arm the CSRF header for mutations."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password, "totp_code": code_at(secret)},
    )
    assert response.status_code == 200, response.text
    assert response.json()["result"] == "success"
    token = client.cookies.get("csrf_token")
    assert token
    client.headers["X-CSRF-Token"] = token


def _change_payload(old: str = "Password123!", new: str = "NewPassword456!") -> dict:
    return {"old_password": old, "new_password": new}


class TestStepUpGate:
    async def test_change_password_is_refused_without_a_fresh_code(
        self, client, db_session
    ):
        from conftest import seed_account

        user = await seed_account(db_session, "stepup-basic@example.com", "Password123!")
        secret = await _enable_2fa(db_session, user)
        await _sign_in_2fa(client, "stepup-basic@example.com", "Password123!", secret)

        response = await client.post(
            "/api/v1/profile/change-password", json=_change_payload()
        )

        assert response.status_code == 403
        assert response.json()["detail"]["code"] == "step_up_required"

    async def test_a_verified_code_unlocks_the_action_for_this_session(
        self, client, db_session
    ):
        from conftest import seed_account

        user = await seed_account(db_session, "stepup-ok@example.com", "Password123!")
        secret = await _enable_2fa(db_session, user)
        await _sign_in_2fa(client, "stepup-ok@example.com", "Password123!", secret)

        step = await client.post(
            "/api/v1/auth/step-up", json={"code": code_at(secret)}
        )

        assert step.status_code == 200, step.text
        # The window is a setting, not a literal: the cookie and the message
        # quoted to the user must expire together.
        assert (
            f"Max-Age={settings.STEP_UP_TTL_SECONDS}"
            in step.headers.get("set-cookie", "")
        )

        response = await client.post(
            "/api/v1/profile/change-password", json=_change_payload()
        )
        assert response.status_code == 200, response.text

    async def test_a_wrong_code_is_refused(self, client, db_session):
        from conftest import seed_account

        user = await seed_account(db_session, "stepup-wrong@example.com", "Password123!")
        secret = await _enable_2fa(db_session, user)
        await _sign_in_2fa(client, "stepup-wrong@example.com", "Password123!", secret)

        response = await client.post("/api/v1/auth/step-up", json={"code": "000000"})

        assert response.status_code == 401
        assert "step_up" not in client.cookies

    async def test_a_recovery_code_works_and_is_burned(self, client, db_session):
        from conftest import seed_account

        user = await seed_account(db_session, "stepup-rec@example.com", "Password123!")
        secret = generate_secret()
        codes, hashes = generate_recovery_codes()
        user.totp_secret = secret
        user.totp_enabled = True
        user.totp_recovery_codes = json.dumps(hashes)
        await db_session.commit()
        await _sign_in_2fa(client, "stepup-rec@example.com", "Password123!", secret)

        first = await client.post("/api/v1/auth/step-up", json={"code": codes[0]})
        assert first.status_code == 200, first.text

        second = await client.post("/api/v1/auth/step-up", json={"code": codes[0]})
        assert second.status_code == 401

    async def test_a_proof_from_another_session_is_rejected(self, client, db_session):
        from conftest import seed_account

        user = await seed_account(db_session, "stepup-sid@example.com", "Password123!")
        secret = await _enable_2fa(db_session, user)
        await _sign_in_2fa(client, "stepup-sid@example.com", "Password123!", secret)

        # A valid signature for the same account, minted for a different browser.
        client.cookies.set("step_up", create_step_up_token(user.id, "another-session"))

        response = await client.post(
            "/api/v1/profile/change-password", json=_change_payload()
        )

        assert response.status_code == 403
        assert response.json()["detail"]["code"] == "step_up_required"

    async def test_export_is_gated_and_then_allowed(self, client, db_session):
        from conftest import seed_account

        user = await seed_account(db_session, "stepup-export@example.com", "Password123!")
        secret = await _enable_2fa(db_session, user)
        await _sign_in_2fa(client, "stepup-export@example.com", "Password123!", secret)

        assert (await client.get("/api/v1/profile/export")).status_code == 403

        await client.post("/api/v1/auth/step-up", json={"code": code_at(secret)})
        exported = await client.get("/api/v1/profile/export")

        assert exported.status_code == 200
        assert exported.json()["account"]["email"] == "stepup-export@example.com"

    async def test_revoke_every_other_session_needs_a_code_then_keeps_this_one(
        self, client, db_session
    ):
        from conftest import seed_account

        user = await seed_account(db_session, "stepup-sessions@example.com", "Password123!")
        secret = await _enable_2fa(db_session, user)
        await _sign_in_2fa(
            client, "stepup-sessions@example.com", "Password123!", secret
        )
        db_session.add(UserSession(session_id="other-device", user_id=user.id))
        await db_session.commit()

        refused = await client.delete("/api/v1/profile/sessions")
        assert refused.status_code == 403
        assert refused.json()["detail"]["code"] == "step_up_required"

        await client.post("/api/v1/auth/step-up", json={"code": code_at(secret)})
        response = await client.delete("/api/v1/profile/sessions")

        assert response.status_code == 200, response.text
        assert response.json()["data"]["revoked"] == 1
        remaining = (
            await db_session.execute(
                select(UserSession).where(UserSession.user_id == user.id)
            )
        ).scalars().all()
        assert [row.session_id for row in remaining] != ["other-device"]
        # This browser still works — the point is evicting the others.
        assert (await client.get("/api/v1/profile/me")).status_code == 200

    async def test_forget_every_trusted_browser_needs_a_code(
        self, client, db_session
    ):
        from conftest import seed_account

        user = await seed_account(db_session, "stepup-trust@example.com", "Password123!")
        secret = await _enable_2fa(db_session, user)
        trusted_login = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "stepup-trust@example.com",
                "password": "Password123!",
                "totp_code": code_at(secret),
                "trust_device": True,
            },
        )
        assert trusted_login.status_code == 200, trusted_login.text
        client.headers["X-CSRF-Token"] = client.cookies.get("csrf_token") or ""

        refused = await client.delete("/api/v1/auth/2fa/trusted-devices")
        assert refused.status_code == 403
        assert refused.json()["detail"]["code"] == "step_up_required"

        await client.post("/api/v1/auth/step-up", json={"code": code_at(secret)})
        response = await client.delete("/api/v1/auth/2fa/trusted-devices")

        assert response.status_code == 200, response.text
        assert response.json()["data"]["revoked"] == 1
        rows = (
            await db_session.execute(
                select(TrustedDevice).where(TrustedDevice.user_id == user.id)
            )
        ).scalars().all()
        assert rows and all(row.revoked_at is not None for row in rows)
        # The cookie that skipped the code is gone with the rows.
        assert "trusted_device" not in client.cookies

    async def test_accounts_without_2fa_keep_their_password_form(
        self, client, logged_in_user
    ):
        response = await client.post(
            "/api/v1/profile/change-password",
            json={"old_password": "SecretPass123", "new_password": "NewSecret456"},
        )

        assert response.status_code == 200, response.text
