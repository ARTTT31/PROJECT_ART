"""A shared row link names an entry, not a page.

``/audit#entry-42`` used to open page 1 and stop there: the row was on some
other page and the page had no way to find out which. ``anchor`` turns that into
an answer — which page holds the row under the active filters — so the client
can follow it. A row the filters exclude is reported as missing.
"""

from datetime import datetime

from app.models.audit_log import AuditLog


async def _seed(db_session, count: int = 5) -> list:
    """Rows one minute apart, so newest-first order is unambiguous."""
    rows = []
    for index in range(count):
        log = AuditLog(
            action="LOGIN_SUCCESS",
            details=f"anchor-test row {index}",
            created_at=datetime(2026, 11, 20, 9, index, 0),
        )
        db_session.add(log)
        rows.append(log)
    await db_session.commit()
    return rows


async def test_anchor_page_is_the_page_the_row_sits_on(
    client, logged_in_admin_user, db_session
):
    rows = await _seed(db_session)

    resp = await client.get(
        "/api/v1/audit/paginated",
        params={"size": 2, "anchor": rows[0].id, "q": "anchor-test"},
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 5
    # Newest first, two per page: the oldest row is on the third page.
    assert body["anchorPage"] == 3
    # Asking does not move the listing itself.
    assert body["page"] == 1


async def test_anchor_page_is_the_current_page_for_a_row_already_shown(
    client, logged_in_admin_user, db_session
):
    rows = await _seed(db_session)

    resp = await client.get(
        "/api/v1/audit/paginated",
        params={"size": 2, "page": 1, "anchor": rows[-1].id, "q": "anchor-test"},
    )

    assert resp.status_code == 200, resp.text
    assert resp.json()["anchorPage"] == 1


async def test_anchor_page_is_null_when_the_filters_exclude_the_row(
    client, logged_in_admin_user, db_session
):
    rows = await _seed(db_session)

    resp = await client.get(
        "/api/v1/audit/paginated",
        params={"size": 2, "anchor": rows[0].id, "q": "no-such-row"},
    )

    assert resp.status_code == 200, resp.text
    assert resp.json()["anchorPage"] is None


async def test_anchor_page_is_null_for_an_unknown_id(
    client, logged_in_admin_user, db_session
):
    await _seed(db_session)

    resp = await client.get(
        "/api/v1/audit/paginated",
        params={"size": 2, "anchor": 999999, "q": "anchor-test"},
    )

    assert resp.status_code == 200, resp.text
    assert resp.json()["anchorPage"] is None


async def test_rows_written_in_the_same_second_keep_one_order(
    client, logged_in_admin_user, db_session
):
    """The count and the listing must break ties the same way (``id``), or a
    row's reported page can differ from the page it is actually rendered on."""
    same = datetime(2026, 11, 21, 9, 0, 0)
    rows = []
    for index in range(4):
        log = AuditLog(
            action="LOGIN_SUCCESS",
            details=f"tie-test row {index}",
            created_at=same,
        )
        db_session.add(log)
        rows.append(log)
    await db_session.commit()

    resp = await client.get(
        "/api/v1/audit/paginated",
        params={"size": 2, "anchor": rows[0].id, "q": "tie-test"},
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    # The highest id is newest within the same timestamp, so the first row is
    # last on page 2 of 2.
    assert body["items"][0]["id"] == rows[-1].id
    assert body["anchorPage"] == 2
