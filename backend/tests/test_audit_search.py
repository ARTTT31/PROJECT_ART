"""The activity-log search box: what it can find, not just what it shows.

The address is no longer part of any response, but an admin who knows one is
investigating still needs to find the rows from it. That lookup is server-side
and must keep working without shipping the value back.
"""

from datetime import datetime

from sqlalchemy import select

from app.models.audit_log import AuditLog
from app.models.user import User

from conftest import TEST_ADMIN_EMAIL


async def _admin_id(db_session) -> int:
    result = await db_session.execute(select(User).where(User.email == TEST_ADMIN_EMAIL))
    return result.scalar_one().id


async def test_search_finds_rows_by_ip_without_returning_it(
    client, logged_in_admin_user, db_session
):
    admin_id = await _admin_id(db_session)
    db_session.add(
        AuditLog(
            user_id=admin_id,
            action="LOGIN_FAILED",
            details="failed sign-in",
            ip_address="198.51.100.23",
            created_at=datetime(2026, 11, 20, 9, 0, 0),
        )
    )
    await db_session.commit()

    resp = await client.get("/api/v1/audit/paginated", params={"q": "198.51.100.23"})

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["details"] == "failed sign-in"
    assert "ip_address" not in body["items"][0]
