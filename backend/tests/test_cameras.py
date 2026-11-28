"""Tests for per-account RTSP cameras, SSRF guards, probe, and isolation."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.core.url_safety import UnsafeURLError, ensure_public_rtsp_url
from app.main import app
from app.services.cctv_service import RtspProbeResult, build_rtsp_url, mask_rtsp_host
from tests.conftest import TEST_USER_EMAIL, TEST_USER_PASSWORD, _login, seed_account


def test_build_rtsp_url_encodes_special_chars() -> None:
    url = build_rtsp_url(
        host="tthanyapong.trueddns.com",
        port=49110,
        username="ART@IOT31",
        password="p@ss:1/2",
        path="stream2",
    )
    assert url == "rtsp://ART%40IOT31:p%40ss%3A1%2F2@tthanyapong.trueddns.com:49110/stream2"
    assert mask_rtsp_host(url) == "tthanyapong.trueddns.com:49110/stream2"


@pytest.mark.asyncio
async def test_ensure_public_rtsp_url_blocks_private_and_local() -> None:
    for bad in (
        "rtsp://127.0.0.1:554/stream2",
        "rtsp://localhost:554/stream2",
        "rtsp://192.168.1.43:554/stream2",
        "rtsp://169.254.169.254:554/latest",
        "http://58.9.110.55:80/stream",
    ):
        with pytest.raises(UnsafeURLError):
            await ensure_public_rtsp_url(bad)

    ok = await ensure_public_rtsp_url("rtsp://user:pass@58.9.110.55:49110/stream2")
    assert ok.startswith("rtsp://")


@pytest.mark.asyncio
async def test_camera_crud_and_user_isolation(client, db_session, monkeypatch) -> None:
    user_a = await seed_account(db_session, email=TEST_USER_EMAIL)
    user_b = await seed_account(db_session, email="other@example.com")

    monkeypatch.setattr(settings, "CCTV_MEDIAMTX_URL", "https://cctv.example.com")
    monkeypatch.setattr(settings, "CCTV_CONTROL_SECRET", "top-secret-control")

    async def fake_probe(rtsp_url: str, timeout: float = 8.0) -> RtspProbeResult:
        return RtspProbeResult(
            reachable=True,
            authenticated=True,
            codec="H264",
            resolution="1280x720",
        )

    synced: list[str] = []
    deleted: list[str] = []

    async def fake_sync(stream_key: str, rtsp_url: str) -> bool:
        synced.append(stream_key)
        return True

    async def fake_delete(stream_key: str) -> None:
        deleted.append(stream_key)

    monkeypatch.setattr("app.api.v1.endpoints.cameras.probe_rtsp_stream", fake_probe)
    monkeypatch.setattr("app.api.v1.endpoints.cameras.sync_mediamtx_path", fake_sync)
    monkeypatch.setattr("app.api.v1.endpoints.cameras.delete_mediamtx_path", fake_delete)

    await _login(client, user_a.email, TEST_USER_PASSWORD)

    # User A creates a camera using structured fields
    create_res = await client.post(
        "/api/v1/cameras",
        json={
            "name": "หน้าร้าน",
            "location": "ประตูหน้า",
            "preset": "tapo",
            "host": "58.9.110.55",
            "port": 49110,
            "username": "ART@IOT31",
            "password": "secret@password",
            "path": "/stream2",
            "fps": 25,
        },
    )
    assert create_res.status_code == 201
    created = create_res.json()["data"]["camera"]
    cam_id = created["id"]
    stream_key = created["stream_key"]
    assert created["hls_url"] == f"https://cctv.example.com/{stream_key}/index.m3u8"
    assert created["masked_host"] == "58.9.110.55:49110/stream2"
    assert "secret" not in str(created)
    assert synced == [stream_key]

    # User A sees it
    list_a = await client.get("/api/v1/cameras")
    assert len(list_a.json()["data"]["cameras"]) == 1

    # User B (separate client session) sees empty list and cannot activate/delete User A's camera
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://testserver.local") as client_b:
        await _login(client_b, user_b.email, TEST_USER_PASSWORD)
        list_b = await client_b.get("/api/v1/cameras")
        assert list_b.json()["data"]["cameras"] == []
        assert (await client_b.post(f"/api/v1/cameras/{cam_id}/activate")).status_code == 404
        assert (await client_b.delete(f"/api/v1/cameras/{cam_id}")).status_code == 404

    # User A can activate and delete
    act_res = await client.post(f"/api/v1/cameras/{cam_id}/activate")
    assert act_res.status_code == 200
    assert act_res.json()["data"]["camera"]["mediamtx_ready"] is True

    del_res = await client.delete(f"/api/v1/cameras/{cam_id}")
    assert del_res.status_code == 200
    assert deleted == [stream_key]


@pytest.mark.asyncio
async def test_probe_reports_h265_warning(client, db_session, monkeypatch) -> None:
    user = await seed_account(db_session)
    await _login(client, user.email, TEST_USER_PASSWORD)

    async def fake_probe(rtsp_url: str, timeout: float = 8.0) -> RtspProbeResult:
        return RtspProbeResult(
            reachable=True,
            authenticated=True,
            codec="H265",
            warning="กล้องส่งภาพเป็น H.265 ซึ่งเบราว์เซอร์ส่วนใหญ่เล่นไม่ได้",
        )

    monkeypatch.setattr("app.api.v1.endpoints.cameras.probe_rtsp_stream", fake_probe)

    res = await client.post(
        "/api/v1/cameras/probe",
        json={
            "host": "58.9.110.55",
            "port": 49110,
            "username": "ART@IOT31",
            "password": "pw",
            "path": "/stream1",
        },
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["codec"] == "H265"
    assert "H.265" in data["warning"]
