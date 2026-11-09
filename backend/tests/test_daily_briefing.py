import pytest
from app.services.daily_briefing_service import (
    get_user_briefing_config,
    set_user_briefing_config,
    build_briefing_content,
    dispatch_user_briefing,
    dispatch_scheduled_briefings,
)


def test_briefing_config_defaults_and_mutation(registered_user, db_session):
    # Retrieve user model
    from app.models.user import User
    user = User(id=1, email="test@example.com", username="testuser")

    default_cfg = get_user_briefing_config(user)
    assert default_cfg["enabled"] is False
    assert default_cfg["time"] == "07:30"
    assert default_cfg["topics"]["oil_prices"] is True

    # Mutate
    set_user_briefing_config(user, {
        "enabled": True,
        "time": "08:00",
        "topics": {"oil_prices": False, "weather": True},
    })

    updated = get_user_briefing_config(user)
    assert updated["enabled"] is True
    assert updated["time"] == "08:00"
    assert updated["topics"]["oil_prices"] is False
    assert updated["topics"]["weather"] is True


@pytest.mark.asyncio
async def test_build_briefing_content(db_session):
    from app.models.user import User
    user = User(id=1, email="test@example.com", username="testuser", quick_notes='[{"id":"1","text":"Review PR","done":false}]')

    content = await build_briefing_content(db_session, user, {
        "oil_prices": True,
        "weather": True,
        "tasks": True,
    })

    assert "สรุปข้อมูลเช้านี้" in content["title"]
    assert "แก๊สโซฮอล์ 95" in content["body"]
    assert "สภาพอากาศ" in content["body"]
    assert "1 รายการในโน้ตด่วน" in content["body"]


@pytest.mark.asyncio
async def test_api_daily_briefing_lifecycle(client, logged_in_admin_user):
    # 1. Get
    get_res = await client.get("/api/v1/profile/daily-briefing")
    assert get_res.status_code == 200
    assert "enabled" in get_res.json()["data"]

    # 2. Update
    put_res = await client.put("/api/v1/profile/daily-briefing", json={
        "enabled": True,
        "time": "07:00",
        "topics": {"oil_prices": True, "weather": True, "tasks": False},
    })
    assert put_res.status_code == 200
    assert put_res.json()["data"]["enabled"] is True
    assert put_res.json()["data"]["time"] == "07:00"

    # 3. Test send
    test_res = await client.post("/api/v1/profile/daily-briefing/test")
    assert test_res.status_code == 200
    assert test_res.json()["result"] == "success"
