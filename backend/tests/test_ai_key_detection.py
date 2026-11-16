"""Provider detection from a pasted API key.

The profile form used to ask the user to translate a key prefix into a provider
dropdown and to type a model name by hand. These tests pin the mapping and the
endpoint that fills the form in, including the parts that must not break: an
unknown key is refused with a Thai message, and the key never comes back in the
response.
"""

import pytest
from httpx import AsyncClient

from app.api.v1.endpoints import ai


@pytest.mark.parametrize(
    ("key", "provider", "label", "base_url"),
    [
        ("AIzaSyD-example-key-1234567890", "gemini", "Google Gemini", ""),
        ("sk-or-v1-0123456789abcdef", "openai", "OpenRouter", "https://openrouter.ai/api/v1"),
        ("sk-proj-0123456789abcdef", "openai", "OpenAI", "https://api.openai.com/v1"),
        ("sk-0123456789abcdef", "openai", "OpenAI", "https://api.openai.com/v1"),
        ("gsk_0123456789abcdef", "openai", "Groq", "https://api.groq.com/openai/v1"),
        ("xai-0123456789abcdef", "openai", "xAI", "https://api.x.ai/v1"),
        ("sk-ant-0123456789abcdef", "unsupported", "Anthropic", ""),
    ],
)
def test_detect_ai_key_names_the_provider(key, provider, label, base_url):
    detected = ai.detect_ai_key(key)

    assert detected == {"provider": provider, "base_url": base_url, "label": label}
    # The secret itself is never part of the detection result.
    assert key not in str(detected)


def test_detect_ai_key_ignores_unrecognised_or_short_values():
    assert ai.detect_ai_key("") is None
    assert ai.detect_ai_key("short") is None
    assert ai.detect_ai_key("totally-unrelated-token-value") is None


def test_provider_label_prefers_the_service_behind_the_base_url():
    assert ai.provider_label("gemini", "") == "Google Gemini"
    assert ai.provider_label("openai", "https://openrouter.ai/api/v1") == "OpenRouter"
    assert ai.provider_label("openai", "https://example.invalid/v1") == "OpenAI-compatible"


def test_suggested_model_picks_a_cheap_default():
    assert ai.suggested_model("gemini", ["gemini-2.5-pro", "gemini-2.5-flash"]) == "gemini-2.5-flash"
    assert ai.suggested_model("openai", ["gpt-4o", "gpt-4o-mini"]) == "gpt-4o-mini"
    assert ai.suggested_model("gemini", []) == ai.DEFAULT_GEMINI_MODEL
    assert ai.suggested_model("openai", []) == ""


@pytest.mark.asyncio
async def test_detect_endpoint_returns_provider_and_model_list(
    client: AsyncClient, logged_in_user, monkeypatch
):
    async def fake_models(provider, api_key, base_url):
        assert provider == "openai"
        assert base_url == "https://openrouter.ai/api/v1"
        return ["openai/gpt-4o-mini", "openai/gpt-4o"]

    monkeypatch.setattr(ai, "_list_provider_models", fake_models)

    resp = await client.post(
        "/api/v1/ai/settings/detect",
        json={"api_key": "sk-or-v1-0123456789abcdef"},
    )

    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["provider"] == "openai"
    assert data["base_url"] == "https://openrouter.ai/api/v1"
    assert data["label"] == "OpenRouter"
    assert data["models"] == ["openai/gpt-4o-mini", "openai/gpt-4o"]
    assert data["model"] == "openai/gpt-4o-mini"
    assert "sk-or-v1-0123456789abcdef" not in resp.text


@pytest.mark.asyncio
async def test_detect_endpoint_refuses_unknown_and_unsupported_keys(
    client: AsyncClient, logged_in_user, monkeypatch
):
    async def fake_models(provider, api_key, base_url):  # pragma: no cover - not reached
        return []

    monkeypatch.setattr(ai, "_list_provider_models", fake_models)

    unknown = await client.post(
        "/api/v1/ai/settings/detect",
        json={"api_key": "totally-unrelated-token"},
    )
    assert unknown.status_code == 422
    assert "ไม่รู้จักรูปแบบคีย์นี้" in unknown.json()["detail"]

    anthropic = await client.post(
        "/api/v1/ai/settings/detect",
        json={"api_key": "sk-ant-0123456789abcdef"},
    )
    assert anthropic.status_code == 422
    assert "OpenRouter" in anthropic.json()["detail"]


@pytest.mark.asyncio
async def test_ai_settings_report_which_model_will_answer(
    client: AsyncClient, logged_in_user, monkeypatch
):
    monkeypatch.setattr(ai.settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(ai.settings, "AI_API_KEY", "")

    saved = await client.put(
        "/api/v1/ai/settings",
        json={
            "provider": "openai",
            "api_key": "sk-or-v1-0123456789abcdef",
            "base_url": "https://openrouter.ai/api/v1",
            "model": "openai/gpt-4o-mini",
        },
    )
    assert saved.status_code == 200, saved.text

    resp = await client.get("/api/v1/ai/settings")
    data = resp.json()["data"]
    assert data["provider_label"] == "OpenRouter"
    assert data["effective_model"] == "openai/gpt-4o-mini"
