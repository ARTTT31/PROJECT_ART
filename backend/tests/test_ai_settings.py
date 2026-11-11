import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.api.v1.endpoints import ai
from app.models.user import User
from app.core.secret_box import decrypt_secret
from app.core.config import settings

KEY = "sk-personal-test-key-123456"


async def _saved_user(db_session, email: str) -> User:
    result = await db_session.execute(select(User).where(User.email == email))
    return result.scalar_one()


@pytest.mark.asyncio
async def test_ai_settings_defaults_to_server_source(client: AsyncClient, logged_in_user, monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(settings, "AI_API_KEY", "")

    resp = await client.get("/api/v1/ai/settings")

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["has_key"] is False
    assert data["source"] == "none"
    assert "api_key" not in data


@pytest.mark.asyncio
async def test_ai_settings_encrypts_key_and_never_returns_it(
    client: AsyncClient, logged_in_user, db_session, monkeypatch
):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(settings, "AI_API_KEY", "")

    resp = await client.put(
        "/api/v1/ai/settings",
        json={"provider": "openai", "api_key": KEY, "base_url": "https://api.openai.com/v1"},
    )

    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["provider"] == "openai"
    assert data["has_key"] is True
    assert data["source"] == "user"
    assert KEY not in resp.text

    user = await _saved_user(db_session, "test@example.com")
    assert user.ai_provider == "openai"
    assert user.ai_api_key_enc and KEY not in user.ai_api_key_enc
    assert decrypt_secret(user.ai_api_key_enc) == KEY

    # Saving other fields without the key keeps the stored one.
    saved_key = user.ai_api_key_enc
    resp = await client.put(
        "/api/v1/ai/settings",
        json={"provider": "openai", "model": "glm-4-flash"},
    )
    assert resp.status_code == 200, resp.text
    user = await _saved_user(db_session, "test@example.com")
    assert user.ai_api_key_enc == saved_key
    assert user.ai_model == "glm-4-flash"


@pytest.mark.asyncio
async def test_ai_settings_rejects_private_base_url(client: AsyncClient, logged_in_user):
    # https on purpose: over plain http the DEBUG=False deployment also rejects
    # it for the scheme, so the address check would never be reached in CI and
    # the assertion below would depend on whether a local .env sets DEBUG.
    resp = await client.put(
        "/api/v1/ai/settings",
        json={
            "provider": "openai",
            "api_key": KEY,
            "base_url": "https://127.0.0.1:8000/v1",
        },
    )

    assert resp.status_code == 400
    assert "ภายใน" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_ai_settings_requires_https_when_not_in_debug(
    client: AsyncClient, logged_in_user, monkeypatch
):
    monkeypatch.setattr(settings, "DEBUG", False)

    resp = await client.put(
        "/api/v1/ai/settings",
        json={
            "provider": "openai",
            "api_key": KEY,
            "base_url": "http://example.com/v1",
        },
    )

    assert resp.status_code == 400
    assert "https" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_ai_settings_requires_a_key_on_first_save(client: AsyncClient, logged_in_user):
    resp = await client.put("/api/v1/ai/settings", json={"provider": "gemini"})

    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_ai_chat_uses_the_accounts_own_provider(
    client: AsyncClient, logged_in_user, monkeypatch
):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(settings, "AI_API_KEY", "")

    await client.put(
        "/api/v1/ai/settings",
        json={"provider": "gemini", "api_key": "gemini-personal-key", "model": "gemini-3.5-flash"},
    )

    seen = {}

    async def fake_call(provider, prompt, context, history=None):
        seen["provider"] = provider
        return "ตอบจากคีย์ส่วนตัว"

    monkeypatch.setattr(ai, "call_ai_model", fake_call)

    resp = await client.post("/api/v1/ai/chat", json={"message": "ช่วยแนะนำร้านกาแฟหน่อย"})

    assert resp.status_code == 200, resp.text
    assert resp.json()["reply"] == "ตอบจากคีย์ส่วนตัว"
    assert seen["provider"].name == "gemini"
    assert seen["provider"].api_key == "gemini-personal-key"


@pytest.mark.asyncio
async def test_ai_settings_delete_falls_back_to_server(
    client: AsyncClient, logged_in_user, db_session, monkeypatch
):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(settings, "AI_API_KEY", "")
    await client.put("/api/v1/ai/settings", json={"provider": "gemini", "api_key": "gemini-key-123"})

    resp = await client.delete("/api/v1/ai/settings")

    assert resp.status_code == 200
    assert resp.json()["data"]["has_key"] is False
    user = await _saved_user(db_session, "test@example.com")
    assert user.ai_api_key_enc is None
    assert user.ai_provider is None


@pytest.mark.asyncio
async def test_ai_settings_test_reports_provider_failure(
    client: AsyncClient, logged_in_user, monkeypatch
):
    await client.put("/api/v1/ai/settings", json={"provider": "gemini", "api_key": "gemini-key-123"})

    async def failing_call(provider, prompt, context, history=None):
        return None

    monkeypatch.setattr(ai, "call_ai_model", failing_call)

    resp = await client.post("/api/v1/ai/settings/test")

    assert resp.status_code == 502


@pytest.mark.asyncio
async def test_ai_settings_requires_authentication(client: AsyncClient):
    resp = await client.get("/api/v1/ai/settings")

    assert resp.status_code == 401
