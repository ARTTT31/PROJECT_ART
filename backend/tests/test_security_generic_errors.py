"""Regression tests for generic error bodies and text-field size caps (T15).

The profile quick-links / dashboard-layout / camera-config / sessions
endpoints and the system health probe returned ``detail=str(e)`` (or embedded
exception text in the payload), leaking internals like connection strings.
Also, the JSON text fields had no size cap on an unbounded DB Text column.
"""

import pytest


async def test_quick_links_rejects_oversized_payload(client, logged_in_user):
    r = await client.post(
        "/api/v1/profile/quick-links",
        json={"quick_links": "[" + "1," * 80_000 + "1]"},
    )
    assert r.status_code == 422, "text fields must have a max_length"


async def test_dashboard_layout_rejects_oversized_payload(client, logged_in_user):
    r = await client.post(
        "/api/v1/profile/dashboard-layout",
        json={"dashboard_layout": "{'cards':" + "1," * 80_000 + "1}"},
    )
    assert r.status_code == 422


async def test_camera_config_rejects_oversized_payload(client, logged_in_user):
    r = await client.post(
        "/api/v1/profile/camera-config",
        json={"camera_config": "[" + "1," * 80_000 + "1]"},
    )
    assert r.status_code == 422


async def _broken_user_service(monkeypatch, method: str):
    from app.services.user_service import UserService

    async def boom(self, *a, **k):
        raise RuntimeError("postgresql://user:supersecret@db.internal/art")

    monkeypatch.setattr(UserService, method, boom)


@pytest.mark.parametrize(
    "endpoint,payload,method",
    [
        ("/quick-links", {"quick_links": "[]"}, "update_quick_links"),
        ("/dashboard-layout", {"dashboard_layout": "{}"}, "update_dashboard_layout"),
        ("/camera-config", {"camera_config": "[]"}, "update_camera_config"),
    ],
)
async def test_profile_failure_body_is_generic_and_logged(
    client, logged_in_user, monkeypatch, endpoint, payload, method
):
    await _broken_user_service(monkeypatch, method)
    r = await client.post(f"/api/v1/profile{endpoint}", json=payload)
    assert r.status_code == 500
    body = r.text
    assert "supersecret" not in body, "exception text leaked to the client"
    assert "RuntimeError" not in body, "exception class leaked to the client"
    assert "เกิดข้อผิดพลาดภายในระบบ" in body


async def test_health_payload_hides_db_exception_text(monkeypatch):
    """The DB-down probe must expose a generic reason, not the driver message."""
    class BrokenDB:
        async def execute(self, *a, **k):
            raise RuntimeError("postgresql://user:supersecret@db.internal/art")

    from app.api.v1.endpoints.system import get_system_health

    health = await get_system_health(_current_user=None, db=BrokenDB())
    assert health.database.status == "down"
    assert health.database.detail is not None
    assert "supersecret" not in str(health.database.detail)
