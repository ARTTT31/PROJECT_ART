"""CSV export of the activity log.

The table shows 20 rows at a time, but the export is the file an admin keeps as
evidence, so it has to be the whole filtered set — and it has to admit how much
of the total it actually contains.
"""

from datetime import datetime

from sqlalchemy import select

from app.models.audit_log import AuditLog
from app.models.user import User

from conftest import TEST_ADMIN_EMAIL


async def _admin_id(db_session) -> int:
    result = await db_session.execute(select(User).where(User.email == TEST_ADMIN_EMAIL))
    return result.scalar_one().id


async def _add_logs(
    db_session,
    user_id: int,
    action: str,
    count: int,
    *,
    created_at: datetime | None = None,
    details: str = "row",
) -> None:
    for index in range(count):
        db_session.add(
            AuditLog(
                user_id=user_id,
                action=action,
                details=f"{details} {index}",
                created_at=created_at or datetime(2026, 11, 20, 12, 0, 0),
            )
        )
    await db_session.commit()


async def test_export_returns_every_matching_row_not_the_page(
    client, logged_in_admin_user, db_session
):
    """25 matches is more than one page; the export must not stop at 20."""
    admin_id = await _admin_id(db_session)
    # Not LOGIN_SUCCESS: logging the admin in already writes one of those.
    await _add_logs(db_session, admin_id, "PROFILE_UPDATE", 25)
    await _add_logs(db_session, admin_id, "LOGOUT", 5)

    resp = await client.get("/api/v1/audit/export", params={"action": "PROFILE_UPDATE"})

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["exported"] == 25
    assert body["total"] == 25
    assert body["truncated"] is False
    assert len(body["items"]) == 25
    assert {row["action"] for row in body["items"]} == {"PROFILE_UPDATE"}


async def test_export_applies_the_same_filters_as_the_list(
    client, logged_in_admin_user, db_session
):
    admin_id = await _admin_id(db_session)
    await _add_logs(
        db_session,
        admin_id,
        "LOGIN_FAILED",
        2,
        created_at=datetime(2026, 11, 1, 9, 0, 0),
        details="outside the range",
    )
    await _add_logs(
        db_session,
        admin_id,
        "LOGIN_FAILED",
        3,
        created_at=datetime(2026, 11, 10, 9, 0, 0),
        details="needle-in-the-haystack",
    )
    await _add_logs(
        db_session,
        admin_id,
        "LOGOUT",
        1,
        created_at=datetime(2026, 11, 10, 9, 0, 0),
        details="needle-in-the-haystack",
    )

    resp = await client.get(
        "/api/v1/audit/export",
        params={"q": "needle", "dateFrom": "2026-11-05", "dateTo": "2026-11-25"},
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    exported_actions = [row["action"] for row in body["items"]]
    assert set(exported_actions) == {"LOGIN_FAILED", "LOGOUT"}
    assert body["exported"] == 4
    assert body["total"] == 4


async def test_export_says_so_when_it_hits_the_cap(
    client, logged_in_admin_user, db_session, monkeypatch
):
    from app.api.v1.endpoints import audit as audit_endpoint

    monkeypatch.setattr(audit_endpoint, "EXPORT_LIMIT", 3)
    admin_id = await _admin_id(db_session)
    await _add_logs(db_session, admin_id, "PROFILE_UPDATE", 10)

    resp = await client.get("/api/v1/audit/export", params={"action": "PROFILE_UPDATE"})

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["exported"] == 3
    assert body["total"] == 10
    assert body["truncated"] is True


async def test_responses_do_not_ship_the_address_but_the_row_keeps_it(
    client, logged_in_admin_user, db_session
):
    """The log is read by browsers; the address stays server-side."""
    admin_id = await _admin_id(db_session)
    db_session.add(
        AuditLog(
            user_id=admin_id,
            action="PROFILE_UPDATE",
            details="address stays in the database",
            ip_address="203.0.113.7",
            created_at=datetime(2026, 11, 20, 12, 0, 0),
        )
    )
    await db_session.commit()

    page = await client.get("/api/v1/audit/paginated", params={"action": "PROFILE_UPDATE"})
    export = await client.get("/api/v1/audit/export", params={"action": "PROFILE_UPDATE"})

    assert page.status_code == 200, page.text
    assert export.status_code == 200, export.text
    assert all("ip_address" not in row for row in page.json()["items"])
    assert all("ip_address" not in row for row in export.json()["items"])

    await db_session.rollback()
    stored = (
        await db_session.execute(
            select(AuditLog).where(AuditLog.details == "address stays in the database")
        )
    ).scalar_one()
    assert stored.ip_address == "203.0.113.7"


async def test_export_rejects_a_reversed_date_range(client, logged_in_admin_user):
    resp = await client.get(
        "/api/v1/audit/export",
        params={"dateFrom": "2026-11-25", "dateTo": "2026-11-05"},
    )

    assert resp.status_code == 422, resp.text


async def test_non_admin_cannot_export(client, logged_in_user):
    resp = await client.get("/api/v1/audit/export")

    assert resp.status_code == 403, resp.text
