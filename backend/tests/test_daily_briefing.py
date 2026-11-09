import pytest
from app.services.daily_briefing_service import (
    get_user_briefing_config,
    set_user_briefing_config,
    build_briefing_content,
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
    from app.services import weather_cache

    # Seed the same snapshot the oil-prices endpoint persists (L2 cache); the
    # briefing must report observed prices, not hardcoded constants.
    await weather_cache.store(db_session, "oil-prices", ("latest",), {
        "prices": [
            {"key": "gasohol_95", "name": "แก๊สโซฮอล์ 95", "price": 37.69, "unit": "บาท/ลิตร"},
            {"key": "diesel", "name": "ดีเซล", "price": 38.39, "unit": "บาท/ลิตร"},
        ],
        "is_stale": False,
    })

    user = User(
        id=1,
        email="test@example.com",
        username="testuser",
        quick_notes='[{"id":"1","text":"Review PR","done":false}]',
    )

    content = await build_briefing_content(db_session, user, {
        "oil_prices": True,
        "weather": True,
        "tasks": True,
    })

    assert "สรุปข้อมูลเช้านี้" in content["title"]
    assert "แก๊สโซฮอล์ 95: 37.69" in content["body"]
    assert "ดีเซล: 38.39" in content["body"]
    assert "สภาพอากาศ" in content["body"]
    assert "1 รายการในโน้ตด่วน" in content["body"]


@pytest.mark.asyncio
async def test_briefing_does_not_invent_missing_data(db_session):
    """No oil/market snapshot means an explicit "no data" line, not a fake one."""
    from app.models.user import User

    user = User(id=2, email="nodata@example.com", username="nodata")
    content = await build_briefing_content(db_session, user, {
        "oil_prices": True,
        "weather": True,
        "market": True,
        "holidays": True,
    })

    body = content["body"]
    assert "37.69" not in body
    assert "38.39" not in body
    assert "กรอบปกติ" not in body
    assert body.count("ยังไม่มี") >= 3


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

    # 3. Test send (with tasks enabled by default, and sending twice)
    test_res = await client.post("/api/v1/profile/daily-briefing/test")
    assert test_res.status_code == 200
    assert test_res.json()["result"] == "success"

    # 4. Test send second time (must not crash on duplicate key)
    test_res_2 = await client.post("/api/v1/profile/daily-briefing/test")
    assert test_res_2.status_code == 200
    assert test_res_2.json()["result"] == "success"
