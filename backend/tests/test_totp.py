"""Two-factor authentication: the TOTP core and the login gate.

The core is checked against the published RFC 6238 vectors rather than against
itself, so a change that keeps generate/verify symmetric but breaks
interoperability with real authenticator apps still fails here.
"""

import json

from app.core.totp import (
    RECOVERY_CODE_COUNT,
    code_at,
    generate_recovery_codes,
    generate_secret,
    load_recovery_hashes,
    match_recovery_code,
    normalize_recovery_code,
    provisioning_uri,
    verify,
)

# RFC 6238 Appendix B: the ASCII secret "12345678901234567890" in base32.
RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"


class TestTotpCore:
    def test_matches_rfc6238_vectors(self):
        # The RFC publishes 8-digit codes; the last six digits are ours.
        assert code_at(RFC_SECRET, 59) == "287082"
        assert code_at(RFC_SECRET, 1111111109) == "081804"
        assert code_at(RFC_SECRET, 1234567890) == "005924"

    def test_accepts_one_step_of_clock_drift(self):
        # A code minted at T is still accepted when the server's clock is one
        # step ahead or behind — that is the whole point of the window.
        code = code_at(RFC_SECRET, 59)
        assert verify(RFC_SECRET, code, timestamp=59)
        assert verify(RFC_SECRET, code, timestamp=59 + 30)
        assert verify(RFC_SECRET, code, timestamp=59 - 30)

    def test_rejects_codes_outside_the_drift_window(self):
        code = code_at(RFC_SECRET, 59)
        assert not verify(RFC_SECRET, code, timestamp=59 + 90)
        assert not verify(RFC_SECRET, code, timestamp=59 - 90)

    def test_rejects_wrong_shape_without_raising(self):
        assert not verify(RFC_SECRET, "", timestamp=59)
        assert not verify(RFC_SECRET, "28708", timestamp=59)
        assert not verify(RFC_SECRET, "2870821", timestamp=59)
        assert not verify(RFC_SECRET, "abcdef", timestamp=59)
        assert not verify("", "287082", timestamp=59)

    def test_tolerates_the_spacing_apps_display(self):
        assert verify(RFC_SECRET, "287 082", timestamp=59)
        assert verify(RFC_SECRET, "287-082", timestamp=59)

    def test_generated_secrets_are_unique_and_usable(self):
        first, second = generate_secret(), generate_secret()
        assert first != second
        assert 16 <= len(first) <= 40
        assert verify(first, code_at(first))

    def test_provisioning_uri_carries_everything_an_app_needs(self):
        uri = provisioning_uri("ABC234", "user@example.com")
        assert uri.startswith("otpauth://totp/ART%20Workspace%3Auser%40example.com?")
        assert "secret=ABC234" in uri
        assert "algorithm=SHA1" in uri
        assert "digits=6" in uri
        assert "period=30" in uri


class TestRecoveryCodes:
    def test_codes_are_unique_and_stored_only_as_hashes(self):
        codes, hashes = generate_recovery_codes()
        assert len(codes) == RECOVERY_CODE_COUNT
        assert len(set(codes)) == RECOVERY_CODE_COUNT
        assert all("-" in code for code in codes)
        assert all(len(hashed) == 64 for hashed in hashes)
        # The plaintext must never be recoverable from what is stored.
        assert not any(code in hashes for code in codes)

    def test_matching_ignores_case_and_separators(self):
        codes, hashes = generate_recovery_codes(3)
        compact = normalize_recovery_code(codes[1])
        assert match_recovery_code(compact.lower(), hashes) == 1
        assert match_recovery_code(codes[1], hashes) == 1

    def test_unknown_code_matches_nothing(self):
        _, hashes = generate_recovery_codes(3)
        assert match_recovery_code("deadbeef00", hashes) is None
        assert match_recovery_code("", hashes) is None

    def test_corrupt_storage_reads_as_empty(self):
        assert load_recovery_hashes(None) == []
        assert load_recovery_hashes("") == []
        assert load_recovery_hashes("not json") == []
        assert load_recovery_hashes(json.dumps({"a": 1})) == []
        assert load_recovery_hashes(json.dumps(["x"])) == ["x"]


class TestTwoFactorLogin:
    async def test_password_only_login_asks_for_the_code(self, client, db_session):
        from conftest import seed_account

        user = await seed_account(db_session, "totp1@example.com", "Passw0rd123")
        user.totp_secret = generate_secret()
        user.totp_enabled = True
        await db_session.commit()

        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "totp1@example.com", "password": "Passw0rd123"},
        )

        assert response.status_code == 200
        assert response.json()["result"] == "totp_required"
        # No session may be minted before the second factor is presented.
        assert "access_token" not in response.cookies

    async def test_valid_code_completes_the_login(self, client, db_session):
        from conftest import seed_account

        user = await seed_account(db_session, "totp2@example.com", "Passw0rd123")
        user.totp_secret = generate_secret()
        user.totp_enabled = True
        await db_session.commit()

        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "totp2@example.com",
                "password": "Passw0rd123",
                "totp_code": code_at(user.totp_secret),
            },
        )

        assert response.status_code == 200
        assert response.json()["result"] == "success"
        assert response.cookies.get("access_token")

    async def test_wrong_code_is_rejected(self, client, db_session):
        from conftest import seed_account

        user = await seed_account(db_session, "totp3@example.com", "Passw0rd123")
        user.totp_secret = generate_secret()
        user.totp_enabled = True
        await db_session.commit()

        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "totp3@example.com",
                "password": "Passw0rd123",
                "totp_code": "000000",
            },
        )

        assert response.status_code == 401
        assert "access_token" not in response.cookies

    async def test_recovery_code_works_once(self, client, db_session):
        from conftest import seed_account

        user = await seed_account(db_session, "totp4@example.com", "Passw0rd123")
        codes, hashes = generate_recovery_codes()
        user.totp_secret = generate_secret()
        user.totp_enabled = True
        user.totp_recovery_codes = json.dumps(hashes)
        await db_session.commit()

        first = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "totp4@example.com",
                "password": "Passw0rd123",
                "recovery_code": codes[0],
            },
        )
        assert first.status_code == 200
        assert first.json()["result"] == "success"

        # A used code must not work twice.
        second = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "totp4@example.com",
                "password": "Passw0rd123",
                "recovery_code": codes[0],
            },
        )
        assert second.status_code == 401

        await db_session.refresh(user)
        assert len(load_recovery_hashes(user.totp_recovery_codes)) == len(codes) - 1

    async def test_setup_enable_disable_cycle(self, client, logged_in_user):
        from conftest import TEST_USER_PASSWORD

        status = await client.get("/api/v1/auth/2fa/status")
        assert status.json()["data"] == {"enabled": False, "recovery_codes_remaining": 0}

        setup = await client.post("/api/v1/auth/2fa/setup")
        assert setup.status_code == 200
        secret = setup.json()["data"]["secret"]
        assert setup.json()["data"]["otpauth_uri"].startswith("otpauth://totp/")

        # Starting a setup must not protect (or lock) the account yet.
        assert (await client.get("/api/v1/auth/2fa/status")).json()["data"]["enabled"] is False

        rejected = await client.post("/api/v1/auth/2fa/enable", json={"code": "000000"})
        assert rejected.status_code == 401

        enabled = await client.post(
            "/api/v1/auth/2fa/enable", json={"code": code_at(secret)}
        )
        assert enabled.status_code == 200
        codes = enabled.json()["data"]["recovery_codes"]
        assert len(codes) == RECOVERY_CODE_COUNT
        assert all("-" in code for code in codes)

        after = (await client.get("/api/v1/auth/2fa/status")).json()["data"]
        assert after == {"enabled": True, "recovery_codes_remaining": RECOVERY_CODE_COUNT}

        # A stolen session alone cannot strip the second factor.
        wrong_password = await client.post(
            "/api/v1/auth/2fa/disable",
            json={"password": "not-the-password", "code": code_at(secret)},
        )
        assert wrong_password.status_code == 401

        wrong_code = await client.post(
            "/api/v1/auth/2fa/disable",
            json={"password": TEST_USER_PASSWORD, "code": "000000"},
        )
        assert wrong_code.status_code == 401

        disabled = await client.post(
            "/api/v1/auth/2fa/disable",
            json={"password": TEST_USER_PASSWORD, "code": code_at(secret)},
        )
        assert disabled.status_code == 200
        assert disabled.json()["data"]["enabled"] is False

    async def test_setup_is_refused_when_already_enabled(self, client, logged_in_user):
        setup = await client.post("/api/v1/auth/2fa/setup")
        secret = setup.json()["data"]["secret"]
        await client.post("/api/v1/auth/2fa/enable", json={"code": code_at(secret)})

        again = await client.post("/api/v1/auth/2fa/setup")
        assert again.status_code == 400

    async def test_accounts_without_2fa_are_unaffected(self, client, db_session):
        from conftest import seed_account

        await seed_account(db_session, "totp5@example.com", "Passw0rd123")

        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "totp5@example.com", "password": "Passw0rd123"},
        )
        assert response.status_code == 200
        assert response.json()["result"] == "success"
