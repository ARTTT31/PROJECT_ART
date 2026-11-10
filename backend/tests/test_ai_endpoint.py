import pytest
from httpx import AsyncClient

from app.api.v1.endpoints import ai
from app.api.v1.endpoints.ai import parse_builtin_intent
from app.core.config import settings


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

    # Zero-context fallback still returns accurate retail prices
    oil_zero_ctx = parse_builtin_intent("ราคาน้ำมันวันนี้")
    assert "32.94" in oil_zero_ctx.reply
    assert "38.55" in oil_zero_ctx.reply

    # Specific fuel highlighting
    diesel_res = parse_builtin_intent("ดีเซลเท่าไหร่")
    assert "ราคาน้ำมันดีเซลวันนี้" in diesel_res.reply
    assert "32.94" in diesel_res.reply

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


def test_resolve_ai_provider_without_keys(monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER", "auto")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(settings, "AI_API_KEY", "")
    assert ai.resolve_ai_provider().name == "none"


def test_resolve_ai_provider_openai_compatible(monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER", "auto")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(settings, "AI_API_KEY", "sk-test")
    monkeypatch.setattr(settings, "AI_BASE_URL", "https://example.test/v1/")
    monkeypatch.setattr(settings, "AI_MODEL", "glm-4-flash")

    provider = ai.resolve_ai_provider()
    assert provider.name == "openai"
    # The trailing slash is removed so the request path is not doubled.
    assert provider.base_url == "https://example.test/v1"
    assert provider.model == "glm-4-flash"


def test_resolve_ai_provider_prefers_gemini_in_auto(monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER", "auto")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "gemini-test")
    monkeypatch.setattr(settings, "AI_API_KEY", "sk-test")
    monkeypatch.setattr(settings, "GEMINI_MODEL", "gemini-3.5-flash")

    provider = ai.resolve_ai_provider()
    assert provider.name == "gemini"
    assert provider.model == "gemini-3.5-flash"


def test_build_system_prompt_carries_context_and_no_hallucination_rule():
    prompt = ai.build_system_prompt({"pendingTasks": 3, "weather": {"temp": 32}})
    assert "pendingTasks" in prompt
    assert "32" in prompt
    assert "do not have it" in prompt


def test_conversation_keeps_only_recent_turns():
    history = [ai.ChatTurn(role="user", text=f"m{i}") for i in range(12)]
    turns = ai._conversation("now", history)
    assert len(turns) == ai.AI_HISTORY_LIMIT + 1
    assert turns[-1] == ("user", "now")


@pytest.mark.asyncio
async def test_openai_compatible_call_builds_request_and_reads_reply(monkeypatch):
    captured: dict = {}

    class FakeResponse:
        status_code = 200
        text = ""

        def json(self):
            return {"choices": [{"message": {"content": "  คำตอบ  "}}]}

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, url, json=None, headers=None):
            captured["url"] = url
            captured["payload"] = json
            captured["headers"] = headers
            return FakeResponse()

    monkeypatch.setattr(ai.httpx, "AsyncClient", lambda **kwargs: FakeClient())
    provider = ai.AIProvider("openai", "sk-test", "https://example.test/v1", "model-x")

    reply = await ai.call_openai_compatible_api(provider, "สวัสดี", {"pendingTasks": 1})

    assert reply == "คำตอบ"
    assert captured["url"] == "https://example.test/v1/chat/completions"
    assert captured["headers"]["Authorization"] == "Bearer sk-test"
    assert captured["payload"]["model"] == "model-x"
    assert captured["payload"]["messages"][0]["role"] == "system"


@pytest.mark.asyncio
async def test_ai_chat_falls_back_to_local_engine_without_provider(
    client: AsyncClient, logged_in_user, monkeypatch
):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(settings, "AI_API_KEY", "")

    resp = await client.post(
        "/api/v1/ai/chat",
        json={"message": "สรุปงานวันนี้", "context": {"pendingTasks": 2}},
    )

    assert resp.status_code == 200
    assert "2 รายการ" in resp.json()["reply"]
