# -*- coding: utf-8 -*-
"""Optimistic concurrency for the JSON-blob profile writes, the notification
read/dismissed state that now lives with the account, and the daily AI budget.

Every case here exists because the previous behaviour lost data silently: two
devices replaced each other's notes, the badge never cleared across devices, and
one account could spend a deployment key's credits without limit.
"""

from sqlalchemy import select


def _note(note_id: str, text: str = "x"):
    return {"id": note_id, "text": text, "done": False}


class TestProfileVersionConflict:
    async def test_stale_base_version_is_refused_and_writes_nothing(
        self, client, logged_in_user
    ):
        me = await client.get("/api/v1/profile/me")
        version = me.json()["profile_version"]

        first = await client.put(
            "/api/v1/profile/quick-notes",
            json={"notes": [_note("n1")], "base_version": version},
        )
        assert first.status_code == 200

        # A second device that still holds the version from before that write.
        stale = await client.put(
            "/api/v1/profile/quick-notes",
            json={"notes": [_note("n2")], "base_version": version},
        )
        assert stale.status_code == 409
        assert "โหลดหน้าใหม่" in stale.json()["detail"]

        notes = await client.get("/api/v1/profile/quick-notes")
        assert [note["id"] for note in notes.json()["notes"]] == ["n1"]

    async def test_matching_version_saves_and_bumps(self, client, logged_in_user):
        version = (await client.get("/api/v1/profile/me")).json()["profile_version"]

        saved = await client.put(
            "/api/v1/profile/quick-notes",
            json={"notes": [_note("n1")], "base_version": version},
        )
        assert saved.status_code == 200

        after = (await client.get("/api/v1/profile/me")).json()["profile_version"]
        assert after == version + 1

    async def test_client_without_a_version_still_saves(self, client, logged_in_user):
        """Older builds keep working; they just cannot detect a conflict."""
        before = (await client.get("/api/v1/profile/me")).json()["profile_version"]

        saved = await client.put(
            "/api/v1/profile/quick-notes", json={"notes": [_note("n1")]}
        )
        assert saved.status_code == 200

        after = (await client.get("/api/v1/profile/me")).json()["profile_version"]
        assert after == before + 1

    async def test_layout_writes_are_guarded_too(self, client, logged_in_user):
        version = (await client.get("/api/v1/profile/me")).json()["profile_version"]

        assert (
            await client.post(
                "/api/v1/profile/dashboard-layout",
                json={"dashboard_layout": "[]", "base_version": version},
            )
        ).status_code == 200

        assert (
            await client.post(
                "/api/v1/profile/dashboard-layout",
                json={"dashboard_layout": "[]", "base_version": version},
            )
        ).status_code == 409


class TestNotificationState:
    async def test_saved_state_comes_back(self, client, logged_in_user):
        saved = await client.put(
            "/api/v1/profile/notification-state",
            json={"read": ["n1"], "dismissed": ["n2"]},
        )
        assert saved.status_code == 200

        state = (await client.get("/api/v1/profile/notification-state")).json()
        assert state["read"] == ["n1"]
        assert state["dismissed"] == ["n2"]

    async def test_state_belongs_to_the_account(self, client, logged_in_user, db_session):
        """A second account on the same browser starts with an empty state."""
        from app.models.user import User

        await client.put(
            "/api/v1/profile/notification-state", json={"read": ["n1"]}
        )

        users = (await db_session.execute(select(User))).scalars().all()
        # The account that saved has the column; nobody else does.
        assert sum(1 for user in users if user.notification_state) == 1

    async def test_stale_version_is_refused(self, client, logged_in_user):
        version = (await client.get("/api/v1/profile/me")).json()["profile_version"]

        first = await client.put(
            "/api/v1/profile/notification-state",
            json={"read": ["n1"], "base_version": version},
        )
        assert first.status_code == 200

        stale = await client.put(
            "/api/v1/profile/notification-state",
            json={"read": ["n2"], "base_version": version},
        )
        assert stale.status_code == 409

        state = (await client.get("/api/v1/profile/notification-state")).json()
        assert state["read"] == ["n1"]


class TestAiDailyQuota:
    async def test_budget_stops_the_third_message(self, db_session, make_user):
        from app.services.ai_quota import claim_daily_request

        user = await make_user()
        results = [
            await claim_daily_request(db_session, user.id, 2) for _ in range(3)
        ]

        assert [allowed for allowed, _ in results] == [True, True, False]
        assert results[-1][1] == 2

    async def test_accounts_have_separate_budgets(self, db_session, make_user):
        from app.services.ai_quota import claim_daily_request

        first = await make_user(email="a@example.com")
        second = await make_user(email="b@example.com")

        assert (await claim_daily_request(db_session, first.id, 1))[0] is True
        assert (await claim_daily_request(db_session, first.id, 1))[0] is False
        # The second account's budget is untouched by the first one's usage.
        assert (await claim_daily_request(db_session, second.id, 1))[0] is True

    async def test_zero_limit_is_unlimited(self, db_session, make_user):
        from app.services.ai_quota import claim_daily_request

        user = await make_user()
        allowed = []
        for _ in range(3):
            allowed.append((await claim_daily_request(db_session, user.id, 0))[0])

        assert allowed == [True, True, True]
