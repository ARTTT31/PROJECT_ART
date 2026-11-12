"""Tests for dispatching a daily briefing (push + external channels + history).

``build_briefing_content`` and the config helpers were covered; the part that
actually sends and records a briefing was not, so a failure there could only be
found in production.
"""

import datetime
import json

from sqlalchemy import select

from app.models.notification_log import NotificationLog
from app.services import daily_briefing_service as briefing


class _RecordingClient:
    def __init__(self, *args, **kwargs):
        self.calls = 0

    async def post(self, url, **kwargs):
        self.calls += 1

        class _Response:
            status_code = 200

        return _Response()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc_info):
        return False


def _patch_transports(monkeypatch, *, push_result=True, push_error=None):
    async def _push(**kwargs):
        if push_error is not None:
            raise push_error
        return push_result

    async def _channel(client, channel, config, message):
        return True

    monkeypatch.setattr(briefing, "send_web_push_to_user", _push)
    monkeypatch.setattr(briefing, "send_to_channel", _channel)
    monkeypatch.setattr(briefing.httpx, "AsyncClient", _RecordingClient)


async def test_a_briefing_reaches_push_and_external_channels_and_is_logged(
    monkeypatch, make_user, db_session
):
    _patch_transports(monkeypatch)
    user = await make_user(
        email="briefing@example.com",
        external_notifications=json.dumps({"webhook_url": "https://hook.example/x"}),
    )

    result = await briefing.dispatch_user_briefing(db_session, user)

    assert result["success"] is True
    assert result["web_push_sent"] is True
    assert result["external_sent"] is True
    assert "สรุปข้อมูลเช้านี้" in result["title"]

    rows = (
        await db_session.execute(select(NotificationLog).where(NotificationLog.user_id == user.id))
    ).scalars().all()
    assert len(rows) == 1
    row = rows[0]
    assert row.type == "system"
    assert row.level == "info"
    assert row.client_id.startswith("briefing-")
    assert row.client_id.endswith(f"-{user.id}")
    assert row.title == result["title"]
    assert row.body == result["body"]
    assert row.read_at is None


async def test_a_test_briefing_is_marked_as_a_test_in_the_title_and_log(monkeypatch, make_user, db_session):
    _patch_transports(monkeypatch)
    user = await make_user(email="briefing-test@example.com")

    result = await briefing.dispatch_user_briefing(db_session, user, is_test=True)

    assert result["title"].startswith("🔔 [ทดสอบ]")
    row = (
        await db_session.execute(select(NotificationLog).where(NotificationLog.user_id == user.id))
    ).scalars().one()
    assert row.client_id.startswith("briefing-test-")


async def test_a_failing_push_does_not_stop_the_briefing(monkeypatch, make_user, db_session):
    _patch_transports(monkeypatch, push_error=RuntimeError("push service down"))
    user = await make_user(email="push-down@example.com")

    result = await briefing.dispatch_user_briefing(db_session, user)

    assert result["success"] is True
    assert result["web_push_sent"] is False


async def test_a_failed_history_write_rolls_back_and_still_reports_success(
    monkeypatch, make_user, db_session
):
    _patch_transports(monkeypatch)
    user = await make_user(email="log-fails@example.com")

    rolled_back = []

    async def _boom_commit():
        raise RuntimeError("database is read-only")

    async def _rollback():
        rolled_back.append(True)

    monkeypatch.setattr(db_session, "commit", _boom_commit)
    monkeypatch.setattr(db_session, "rollback", _rollback)

    result = await briefing.dispatch_user_briefing(db_session, user)

    assert result["success"] is True
    assert rolled_back == [True]


async def test_scheduled_briefings_only_send_to_users_that_are_due(
    monkeypatch, make_user, db_session
):
    sent_to: list[str] = []

    async def _dispatch(db, user, is_test=False):
        sent_to.append(user.email)
        return {"success": True}

    monkeypatch.setattr(briefing, "dispatch_user_briefing", _dispatch)

    await make_user(
        email="morning@example.com",
        external_notifications=json.dumps({"daily_briefing": {"enabled": True, "time": "07:30"}}),
    )
    await make_user(
        email="later@example.com",
        external_notifications=json.dumps({"daily_briefing": {"enabled": True, "time": "08:00"}}),
    )
    await make_user(
        email="off@example.com",
        external_notifications=json.dumps({"daily_briefing": {"enabled": False, "time": "07:30"}}),
    )

    count = await briefing.dispatch_scheduled_briefings(
        db_session, datetime.datetime(2026, 11, 12, 7, 30)
    )

    assert count == 1
    assert sent_to == ["morning@example.com"]


async def test_one_broken_account_does_not_stop_the_scheduled_run(monkeypatch, make_user, db_session):
    async def _dispatch(db, user, is_test=False):
        raise RuntimeError("channel exploded")

    monkeypatch.setattr(briefing, "dispatch_user_briefing", _dispatch)
    await make_user(
        email="explode@example.com",
        external_notifications=json.dumps({"daily_briefing": {"enabled": True, "time": "07:30"}}),
    )

    assert (
        await briefing.dispatch_scheduled_briefings(
            db_session, datetime.datetime(2026, 11, 12, 7, 30)
        )
        == 0
    )


async def test_a_late_tick_still_delivers_within_the_catch_up_window(
    monkeypatch, make_user, db_session
):
    """A cold start at 07:45 must still send the 07:30 briefing.

    Matching the settings string against the exact current minute meant one
    missed tick lost the morning push for the whole day with nothing to show in
    the UI, which is what "ไม่เห็นมีการส่งสรุปให้เลย" looks like from the phone.
    """
    sent_to: list[str] = []

    async def _dispatch(db, user, is_test=False):
        sent_to.append(user.email)
        return {"success": True}

    monkeypatch.setattr(briefing, "dispatch_user_briefing", _dispatch)

    await make_user(
        email="morning@example.com",
        external_notifications=json.dumps({"daily_briefing": {"enabled": True, "time": "07:30"}}),
    )

    count = await briefing.dispatch_scheduled_briefings(
        db_session, datetime.datetime(2026, 11, 12, 8, 12)
    )

    assert count == 1
    assert sent_to == ["morning@example.com"]


async def test_nothing_is_sent_before_the_scheduled_time_or_after_the_window(
    monkeypatch, make_user, db_session
):
    async def _dispatch(db, user, is_test=False):
        raise AssertionError("must not dispatch outside the window")

    monkeypatch.setattr(briefing, "dispatch_user_briefing", _dispatch)
    await make_user(
        email="morning@example.com",
        external_notifications=json.dumps({"daily_briefing": {"enabled": True, "time": "07:30"}}),
    )

    # 07:29 — not due yet.
    assert (
        await briefing.dispatch_scheduled_briefings(
            db_session, datetime.datetime(2026, 11, 12, 7, 29)
        )
        == 0
    )
    # 10:31 — beyond the 180-minute catch-up window.
    assert (
        await briefing.dispatch_scheduled_briefings(
            db_session, datetime.datetime(2026, 11, 12, 10, 31)
        )
        == 0
    )


async def test_one_briefing_per_day_even_if_the_sweep_runs_again(
    monkeypatch, make_user, db_session
):
    """The loop ticks every minute; only the first tick may send."""
    sent_to: list[str] = []

    async def _dispatch(db, user, is_test=False):
        sent_to.append(user.email)
        return {"success": True}

    monkeypatch.setattr(briefing, "dispatch_user_briefing", _dispatch)
    user = await make_user(
        email="morning@example.com",
        external_notifications=json.dumps({"daily_briefing": {"enabled": True, "time": "07:30"}}),
    )

    # Today's log row is what makes the send idempotent across restarts and
    # across a second instance running the same sweep.
    db_session.add(
        NotificationLog(
            user_id=user.id,
            client_id=f"briefing-2026-11-12-{user.id}",
            type="system",
            level="info",
            title="already sent",
            body="already sent",
            occurred_at=datetime.datetime(2026, 11, 12, 7, 30),
        )
    )
    await db_session.commit()

    assert (
        await briefing.dispatch_scheduled_briefings(
            db_session, datetime.datetime(2026, 11, 12, 7, 30)
        )
        == 0
    )
    assert sent_to == []
