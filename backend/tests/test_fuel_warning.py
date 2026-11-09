import pytest
import datetime
from app.models.system_setting import SystemSetting
from app.services.fuel_warning_service import (
    parse_bangchak_tomorrow_changes,
    dispatch_fuel_warning_if_changed,
    LAST_WARNING_SETTING_KEY,
)


def test_parse_bangchak_tomorrow_changes_detects_price_increase():
    mock_payload = [
        {
            "OilList": [
                {
                    "OilName": "Gasohol 95",
                    "PriceToday": "37.50",
                    "PriceTomorrow": "38.00",
                },
                {
                    "OilName": "Diesel",
                    "PriceToday": "33.00",
                    "PriceTomorrow": "33.00",
                },
            ]
        }
    ]

    changes = parse_bangchak_tomorrow_changes(mock_payload)
    assert len(changes) == 1
    assert changes[0]["name"] == "Gasohol 95"
    assert changes[0]["diff"] == 0.50
    assert changes[0]["today"] == 37.50
    assert changes[0]["tomorrow"] == 38.00


def test_parse_bangchak_returns_empty_when_no_tomorrow_change():
    mock_payload = [
        {
            "OilList": [
                {
                    "OilName": "Gasohol 95",
                    "PriceToday": "37.50",
                    "PriceTomorrow": "37.50",
                }
            ]
        }
    ]
    changes = parse_bangchak_tomorrow_changes(mock_payload)
    assert len(changes) == 0


@pytest.mark.asyncio
async def test_dispatch_fuel_warning_if_changed_sends_alert(db_session, registered_user):
    mock_changes = [
        {
            "name": "Gasohol 95",
            "today": 37.50,
            "tomorrow": 38.00,
            "diff": 0.50,
        }
    ]

    res = await dispatch_fuel_warning_if_changed(
        db=db_session,
        mock_changes=mock_changes,
        force=True,
    )

    assert res["sent"] is True
    assert "ปรับขึ้น" in res["title"]
    assert "+0.50" in res["body"]

    # Verify de-duplication setting was written
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    setting = await db_session.get(SystemSetting, LAST_WARNING_SETTING_KEY)
    assert setting is not None
    assert setting.value == today_str

    # Second run without force should not send again today
    second_res = await dispatch_fuel_warning_if_changed(
        db=db_session,
        mock_changes=mock_changes,
        force=False,
    )
    assert second_res["sent"] is False
    assert "Already notified today" in second_res["reason"]


@pytest.mark.asyncio
async def test_api_check_warning_endpoint(client, logged_in_admin_user):
    resp = await client.post("/api/v1/oil-prices/check-warning?force=true")
    assert resp.status_code == 200
    data = resp.json()
    assert "sent" in data
