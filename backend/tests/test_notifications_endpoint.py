"""Tests for the notification archive and sync endpoints.

Verifies timezone serialization (explicit UTC offset), sync deduplication,
occurred_at UTC normalization, read-all, clear, and health probe.
"""

import datetime
from sqlalchemy import select

from app.models.notification_log import NotificationLog


async def test_notifications_sync_and_list_with_utc_offset(client, logged_in_admin_user, db_session):
    # 1. Sync two items: one with Z, one with +07:00
    sync_payload = {
        "items": [
            {
                "client_id": "test-sync-1",
                "type": "weather",
                "level": "info",
                "title": "ฝนตกเล็กน้อย",
                "body": "มีเมฆมากและฝนตกปรอยๆ",
                "at": "2026-11-14T06:30:00.000Z",
            },
            {
                "client_id": "test-sync-2",
                "type": "oilprice",
                "level": "warning",
                "title": "ราคาน้ำมันปรับขึ้น",
                "body": "ดีเซลปรับขึ้น 0.50 บาท",
                "at": "2026-11-14T13:30:00.000+07:00",
            },
        ]
    }
    sync_res = await client.post("/api/v1/notifications/sync", json=sync_payload)
    assert sync_res.status_code == 200
    sync_data = sync_res.json()
    assert len(sync_data["items"]) >= 2
    assert sync_data["unread"] >= 2

    # Verify both items were saved in DB as naive UTC (06:30:00)
    db_items = (
        await db_session.execute(
            select(NotificationLog).where(
                NotificationLog.client_id.in_(["test-sync-1", "test-sync-2"])
            )
        )
    ).scalars().all()
    assert len(db_items) == 2
    for item in db_items:
        # 13:30 in UTC+7 is 06:30 UTC
        assert item.occurred_at.hour == 6
        assert item.occurred_at.minute == 30

    # 2. List notifications and verify UTC ISO format with explicit offset
    list_res = await client.get("/api/v1/notifications")
    assert list_res.status_code == 200
    list_data = list_res.json()
    items_by_client_id = {item["client_id"]: item for item in list_data["items"]}

    item1 = items_by_client_id["test-sync-1"]
    assert "+00:00" in item1["at"] or item1["at"].endswith("Z")
    assert "2026-11-14T06:30:00" in item1["at"]
    assert item1["read"] is False

    item2 = items_by_client_id["test-sync-2"]
    assert "+00:00" in item2["at"] or item2["at"].endswith("Z")
    assert "2026-11-14T06:30:00" in item2["at"]


async def test_notifications_sync_is_idempotent(client, logged_in_admin_user, db_session):
    payload = {
        "items": [
            {
                "client_id": "test-idempotent-1",
                "type": "system",
                "level": "info",
                "title": "ยินดีต้อนรับ",
                "body": "ข้อความทดสอบ",
                "at": "2026-11-14T07:00:00Z",
            }
        ]
    }
    # First sync
    res1 = await client.post("/api/v1/notifications/sync", json=payload)
    assert res1.status_code == 200

    # Second sync of the same client_id should not duplicate
    res2 = await client.post("/api/v1/notifications/sync", json=payload)
    assert res2.status_code == 200

    matching = (
        await db_session.execute(
            select(NotificationLog).where(NotificationLog.client_id == "test-idempotent-1")
        )
    ).scalars().all()
    assert len(matching) == 1


async def test_notifications_read_all_and_clear(client, logged_in_admin_user):
    # Sync one item
    await client.post(
        "/api/v1/notifications/sync",
        json={
            "items": [
                {
                    "client_id": "test-read-1",
                    "type": "holiday",
                    "level": "info",
                    "title": "วันหยุดสุดสัปดาห์",
                    "body": "พักผ่อนให้สบาย",
                }
            ]
        },
    )

    # Mark all read
    read_res = await client.post("/api/v1/notifications/read-all")
    assert read_res.status_code == 200
    assert read_res.json()["unread"] == 0

    # Clear all
    clear_res = await client.delete("/api/v1/notifications")
    assert clear_res.status_code == 200
    assert clear_res.json()["items"] == []
    assert clear_res.json()["unread"] == 0


async def test_notifications_health_probe(client, logged_in_admin_user):
    res = await client.get("/api/v1/notifications/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert len(data["today"]) == 10  # YYYY-MM-DD
    assert data["now"] != "00:00:00"  # Must not be the default dummy 00:00:00
