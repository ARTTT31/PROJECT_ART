"""Reading the activity log is itself an activity.

The table and the CSV hold names, devices and details, so an investigation has
to be able to answer "who looked at this, under which filters, and what left in
a file". Opening the log is recorded once per filter set (the page refetches on
every keystroke, page click and anchor follow), while every export is its own
row because every export is a file that left the app.
"""

from datetime import datetime, timedelta

from sqlalchemy import select

from app.core.utils import utcnow
from app.models.audit_log import AuditLog
from app.models.user import User

from conftest import TEST_ADMIN_EMAIL


async def _admin_id(db_session) -> int:
    result = await db_session.execute(select(User).where(User.email == TEST_ADMIN_EMAIL))
    return result.scalar_one().id


async def _add_logs(db_session, user_id: int, action: str, count: int, details: str) -> None:
    for index in range(count):
        db_session.add(
            AuditLog(
                user_id=user_id,
                action=action,
                details=f"{details} {index}",
                created_at=datetime(2026, 11, 20, 12, 0, 0),
            )
        )
    await db_session.commit()


async def _rows(db_session, action: str) -> list[AuditLog]:
    await db_session.rollback()
    result = await db_session.execute(
        select(AuditLog)
        .where(AuditLog.action == action)
        .order_by(AuditLog.created_at.asc(), AuditLog.id.asc())
    )
    return list(result.scalars().all())


async def test_opening_the_log_records_the_filters_and_the_count(
    client, logged_in_admin_user, db_session
):
    admin_id = await _admin_id(db_session)
    await _add_logs(db_session, admin_id, "PROFILE_UPDATE", 3, "profile row")

    resp = await client.get("/api/v1/audit/paginated", params={"action": "PROFILE_UPDATE"})

    assert resp.status_code == 200, resp.text
    # The visit is recorded after the count, so it cannot count itself.
    assert resp.json()["total"] == 3

    rows = await _rows(db_session, "AUDIT_LOG_VIEWED")
    assert len(rows) == 1
    assert rows[0].user_id == admin_id
    assert rows[0].details == (
        "เปิดดูบันทึกกิจกรรม · ประเภท: PROFILE_UPDATE · 3 รายการ"
    )


async def test_a_visit_records_the_search_term_and_the_day_range(
    client, logged_in_admin_user, db_session
):
    await client.get(
        "/api/v1/audit/paginated",
        params={"q": "needle", "dateFrom": "2026-11-05", "dateTo": "2026-11-25"},
    )

    rows = await _rows(db_session, "AUDIT_LOG_VIEWED")
    assert len(rows) == 1
    assert rows[0].details == (
        "เปิดดูบันทึกกิจกรรม · ประเภท: ทั้งหมด · ค้นหา: \"needle\""
        " · วันที่: 2026-11-05 ถึง 2026-11-25 · 0 รายการ"
    )


async def test_refetching_the_same_view_stays_one_row(
    client, logged_in_admin_user, db_session
):
    """Search typing, paging and the anchor follow all hit the same endpoint."""
    for page in (1, 2, 1):
        resp = await client.get(
            "/api/v1/audit/paginated", params={"q": "needle", "page": page}
        )
        assert resp.status_code == 200, resp.text

    rows = await _rows(db_session, "AUDIT_LOG_VIEWED")
    assert len(rows) == 1


async def test_a_different_filter_set_is_a_different_visit(
    client, logged_in_admin_user, db_session
):
    for q in ("needle", "haystack"):
        resp = await client.get("/api/v1/audit/paginated", params={"q": q})
        assert resp.status_code == 200, resp.text

    rows = await _rows(db_session, "AUDIT_LOG_VIEWED")
    assert len(rows) == 2
    assert "needle" in rows[0].details
    assert "haystack" in rows[1].details


async def test_a_visit_outside_the_window_is_recorded_again(
    client, logged_in_admin_user, db_session
):
    admin_id = await _admin_id(db_session)
    summary = "ประเภท: ทั้งหมด"
    db_session.add(
        AuditLog(
            user_id=admin_id,
            action="AUDIT_LOG_VIEWED",
            details=f"เปิดดูบันทึกกิจกรรม · {summary} · 0 รายการ",
            created_at=utcnow() - timedelta(minutes=11),
        )
    )
    await db_session.commit()

    resp = await client.get("/api/v1/audit/paginated")
    assert resp.status_code == 200, resp.text

    rows = await _rows(db_session, "AUDIT_LOG_VIEWED")
    assert len(rows) == 2


async def test_the_recorded_rows_are_themselves_searchable(
    client, logged_in_admin_user, db_session
):
    await client.get("/api/v1/audit/paginated", params={"q": "needle"})

    resp = await client.get(
        "/api/v1/audit/paginated", params={"action": "AUDIT_LOG_VIEWED"}
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] >= 1
    assert {row["action"] for row in body["items"]} == {"AUDIT_LOG_VIEWED"}


async def test_export_is_recorded_with_what_the_file_holds(
    client, logged_in_admin_user, db_session
):
    admin_id = await _admin_id(db_session)
    await _add_logs(db_session, admin_id, "PROFILE_UPDATE", 3, "needle")

    resp = await client.get(
        "/api/v1/audit/export",
        params={"q": "needle", "dateFrom": "2026-11-05", "dateTo": "2026-11-25"},
    )

    assert resp.status_code == 200, resp.text
    rows = await _rows(db_session, "AUDIT_LOG_EXPORTED")
    assert len(rows) == 1
    assert rows[0].user_id == admin_id
    assert rows[0].details == (
        "ส่งออกบันทึกกิจกรรม CSV · ประเภท: ทั้งหมด · ค้นหา: \"needle\""
        " · วันที่: 2026-11-05 ถึง 2026-11-25 · ส่งออก 3 จาก 3 รายการ"
    )


async def test_export_notes_that_the_cap_shortened_the_file(
    client, logged_in_admin_user, db_session, monkeypatch
):
    from app.api.v1.endpoints import audit as audit_endpoint

    monkeypatch.setattr(audit_endpoint, "EXPORT_LIMIT", 2)
    admin_id = await _admin_id(db_session)
    await _add_logs(db_session, admin_id, "PROFILE_UPDATE", 5, "capped")

    resp = await client.get("/api/v1/audit/export", params={"action": "PROFILE_UPDATE"})

    assert resp.status_code == 200, resp.text
    rows = await _rows(db_session, "AUDIT_LOG_EXPORTED")
    assert len(rows) == 1
    assert "ส่งออก 2 จาก 5 รายการ" in rows[0].details
    assert "ถึงเพดานการส่งออก" in rows[0].details


async def test_two_exports_are_two_rows(client, logged_in_admin_user, db_session):
    for _ in range(2):
        resp = await client.get("/api/v1/audit/export")
        assert resp.status_code == 200, resp.text

    rows = await _rows(db_session, "AUDIT_LOG_EXPORTED")
    assert len(rows) == 2
