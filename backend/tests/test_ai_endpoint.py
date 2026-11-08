import pytest
from httpx import AsyncClient

from app.api.v1.endpoints.ai import parse_builtin_intent


def test_parse_builtin_intent_note():
    res = parse_builtin_intent("จดโน้ตว่า สรุปยอดขายประจำสัปดาห์")
    assert res.action is not None
    assert res.action.type == "add_note"
    assert res.action.data["text"] == "สรุปยอดขายประจำสัปดาห์"
    assert "จดบันทึกให้เรียบร้อยแล้ว" in res.reply


def test_parse_builtin_intent_reminder():
    res = parse_builtin_intent("เตือนว่า นัดคุยกับทีมดีไซน์")
    assert res.action is not None
    assert res.action.type == "add_reminder"
    assert res.action.data["title"] == "นัดคุยกับทีมดีไซน์"
    assert "เตือนความจำ" in res.reply


def test_parse_builtin_intent_oil_and_weather():
    oil_res = parse_builtin_intent("ราคาน้ำมันเป็นยังไงบ้าง", {"oil": {"diesel": 32.94, "gasohol95": 38.55}})
    assert "น้ำมัน" in oil_res.reply
    assert "32.94" in oil_res.reply

    weather_res = parse_builtin_intent("สภาพอากาศ", {"weather": {"temp": 32, "condition": "แดดจัด"}})
    assert "สภาพอากาศ" in weather_res.reply
    assert "32°C" in weather_res.reply


def test_parse_builtin_intent_summary():
    res = parse_builtin_intent("สรุปงานวันนี้", {"pendingTasks": 3})
    assert "3 รายการ" in res.reply


@pytest.mark.asyncio
async def test_ai_chat_endpoint_authenticated(client: AsyncClient, logged_in_user):
    resp = await client.post(
        "/api/v1/ai/chat",
        json={"message": "จดโน้ตว่า ซื้ออุปกรณ์ออฟฟิศ", "context": {"pendingTasks": 1}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["result"] == "success"
    assert data["action"]["type"] == "add_note"
    assert data["action"]["data"]["text"] == "ซื้ออุปกรณ์ออฟฟิศ"
