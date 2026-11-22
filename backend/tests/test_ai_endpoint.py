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


def test_build_system_prompt_answers_general_questions_too():
    """A saved key must not turn "ขอสูตรผัดไทย" into "no workspace data".

    The old wording ("quote numbers only from the workspace context") read as
    "answer nothing else", which is why a working key looked like a dumb one.
    """
    prompt = ai.build_system_prompt({})
    lowered = prompt.lower()

    assert "quote numbers only from the workspace" not in lowered
    assert "general assistant" in lowered
    assert "outside this workspace" in lowered
    # Grounding still applies to workspace figures.
    assert "do not invent a workspace figure" in lowered


def test_gemini_default_model_is_the_same_in_both_places():
    """Two owners of one default: a fictional id in either 404s every call."""
    declared = type(settings).model_fields["GEMINI_MODEL"].default

    assert declared == ai.DEFAULT_GEMINI_MODEL


def test_build_system_prompt_uses_the_bangkok_date():
    """A UTC host must not tell the model it is still yesterday until 07:00 ICT."""
    from zoneinfo import ZoneInfo

    import datetime as _dt

    bangkok_today = _dt.datetime.now(ZoneInfo("Asia/Bangkok")).date().isoformat()

    prompt = ai.build_system_prompt({})

    assert f"Today is {bangkok_today}" in prompt


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


@pytest.mark.asyncio
async def test_ai_chat_prefers_the_model_over_the_builtin_reply(
    client: AsyncClient, logged_in_user, monkeypatch
):
    """A connected key must answer common questions, not the canned parser.

    "ราคาน้ำมันวันนี้" is matched by the built-in intent engine, so it used to
    return identical text with or without a key — the reason a saved key looked
    like it changed nothing.
    """
    await client.put(
        "/api/v1/ai/settings",
        json={"provider": "gemini", "api_key": "gemini-personal-key", "model": "gemini-3.8-flash"},
    )

    prompts: list[str] = []

    async def fake_call(provider, prompt, context, history=None):
        prompts.append(prompt)
        return "ตอบจากโมเดลจริง"

    monkeypatch.setattr(ai, "call_ai_model", fake_call)

    resp = await client.post("/api/v1/ai/chat", json={"message": "ราคาน้ำมันวันนี้"})

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["reply"] == "ตอบจากโมเดลจริง"
    assert body["degraded"] is False
    assert prompts == ["ราคาน้ำมันวันนี้"]


@pytest.mark.asyncio
async def test_ai_chat_flags_a_provider_failure_instead_of_hiding_it(
    client: AsyncClient, logged_in_user, monkeypatch
):
    """When the saved key cannot answer, the reply says so."""
    await client.put(
        "/api/v1/ai/settings",
        json={"provider": "gemini", "api_key": "gemini-personal-key"},
    )

    async def failing_call(provider, prompt, context, history=None):
        return None

    monkeypatch.setattr(ai, "call_ai_model", failing_call)

    resp = await client.post("/api/v1/ai/chat", json={"message": "ราคาน้ำมันวันนี้"})

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["degraded"] is True
    assert "32.94" in body["reply"]


def test_model_listing_drops_models_that_cannot_chat():
    assert ai._is_non_chat_model("gemini-2.5-flash-image")
    assert ai._is_non_chat_model("text-embedding-3-small")
    assert ai._is_non_chat_model("gemini-3.8-flash-tts")
    assert not ai._is_non_chat_model("gemini-3.8-flash")


def test_suggested_model_prefers_the_newest_flash_generation():
    """Providers do not promise an order, so the id's version decides."""
    models = ["gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3.8-flash"]

    assert ai.suggested_model("gemini", models) == "gemini-3.8-flash"


def test_suggested_model_prefers_the_full_model_over_its_lite_twin():
    models = ["gemini-3.8-flash-lite", "gemini-3.8-flash"]

    assert ai.suggested_model("gemini", models) == "gemini-3.8-flash"


def test_suggested_model_skips_preview_ids():
    models = ["gemini-3.1-pro-preview", "gemini-3.8-flash", "gemini-3.5-flash-lite"]

    assert ai.suggested_model("gemini", models) == "gemini-3.8-flash"
