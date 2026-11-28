"""Per-account RTSP camera management and MediaMTX stream provisioning."""

import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_page_access
from app.core.database import get_db
from app.core.secret_box import decrypt_secret, encrypt_secret
from app.core.url_safety import UnsafeURLError, ensure_public_rtsp_url
from app.models.user import User
from app.models.user_camera import UserCamera
from app.schemas.camera import (
    CameraCreateRequest,
    CameraProbeResponse,
    RtspConnectionInput,
    UserCameraResponse,
)
from app.services.cctv_service import (
    build_hls_url,
    build_rtsp_url,
    delete_mediamtx_path,
    mask_rtsp_host,
    mediamtx_configured,
    probe_rtsp_stream,
    sync_mediamtx_path,
)

router = APIRouter()

CameraUserDep = Annotated[User, Depends(require_page_access("camera"))]
DbDep = Annotated[AsyncSession, Depends(get_db)]

_MAX_CAMERAS_PER_USER = 20


async def _resolve_and_validate_rtsp(payload: RtspConnectionInput) -> str:
    """Build (if structured) and SSRF-validate a public RTSP URL."""
    if payload.rtsp_url and payload.rtsp_url.strip():
        raw = payload.rtsp_url.strip()
    else:
        raw = build_rtsp_url(
            host=payload.host or "",
            port=payload.port,
            username=payload.username,
            password=payload.password,
            path=payload.path,
        )
    try:
        return await ensure_public_rtsp_url(raw)
    except UnsafeURLError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


def _to_response(camera: UserCamera, mediamtx_ready: bool = False) -> UserCameraResponse:
    return UserCameraResponse(
        id=camera.id,
        stream_key=camera.stream_key,
        name=camera.name,
        location=camera.location,
        preset=camera.preset,
        masked_host=camera.masked_host,
        hls_url=build_hls_url(camera.stream_key),
        codec=camera.codec,
        resolution=camera.resolution,
        fps=camera.fps,
        mediamtx_ready=mediamtx_ready,
    )


@router.get("", response_model=dict)
async def list_cameras(current_user: CameraUserDep, db: DbDep):
    """List only the signed-in user's RTSP cameras."""
    result = await db.execute(
        select(UserCamera)
        .where(UserCamera.user_id == current_user.id)
        .order_by(UserCamera.id.asc())
    )
    rows = result.scalars().all()
    return {
        "data": {
            "cameras": [_to_response(cam) for cam in rows],
            "mediamtx_configured": mediamtx_configured(),
        }
    }


@router.post("/probe", response_model=dict)
async def probe_camera(payload: RtspConnectionInput, current_user: CameraUserDep):
    """Test RTSP connectivity, credentials, and codec without saving."""
    _ = current_user
    rtsp_url = await _resolve_and_validate_rtsp(payload)
    probe = await probe_rtsp_stream(rtsp_url)
    return {
        "data": CameraProbeResponse(
            reachable=probe.reachable,
            authenticated=probe.authenticated,
            codec=probe.codec,
            resolution=probe.resolution,
            warning=probe.warning,
            error=probe.error,
        )
    }


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_camera(
    payload: CameraCreateRequest,
    current_user: CameraUserDep,
    db: DbDep,
):
    """Encrypt and save a per-account RTSP camera and register its MediaMTX path."""
    rtsp_url = await _resolve_and_validate_rtsp(payload)

    existing_count = (
        await db.execute(select(UserCamera.id).where(UserCamera.user_id == current_user.id))
    ).scalars().all()
    if len(existing_count) >= _MAX_CAMERAS_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"เพิ่มกล้องได้สูงสุด {_MAX_CAMERAS_PER_USER} ตัวต่อบัญชี",
        )

    probe = await probe_rtsp_stream(rtsp_url)
    stream_key = f"cam_{secrets.token_hex(12)}"
    camera = UserCamera(
        user_id=current_user.id,
        stream_key=stream_key,
        name=payload.name.strip(),
        location=payload.location.strip(),
        preset=payload.preset,
        rtsp_url_encrypted=encrypt_secret(rtsp_url),
        masked_host=mask_rtsp_host(rtsp_url),
        codec=probe.codec,
        resolution=probe.resolution,
        fps=payload.fps,
    )
    db.add(camera)
    await db.commit()
    await db.refresh(camera)

    ready = await sync_mediamtx_path(stream_key, rtsp_url)
    return {
        "data": {
            "camera": _to_response(camera, mediamtx_ready=ready),
            "probe": CameraProbeResponse(
                reachable=probe.reachable,
                authenticated=probe.authenticated,
                codec=probe.codec,
                resolution=probe.resolution,
                warning=probe.warning,
                error=probe.error,
            ),
        }
    }


@router.post("/{camera_id}/activate", response_model=dict)
async def activate_camera(
    camera_id: int,
    current_user: CameraUserDep,
    db: DbDep,
):
    """Ensure the user's MediaMTX path is registered before playback starts."""
    result = await db.execute(
        select(UserCamera).where(
            UserCamera.id == camera_id,
            UserCamera.user_id == current_user.id,
        )
    )
    camera = result.scalar_one_or_none()
    if camera is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ไม่พบกล้องนี้")

    rtsp_url = decrypt_secret(camera.rtsp_url_encrypted)
    if not rtsp_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ไม่สามารถถอดรหัสการเชื่อมต่อกล้องได้ กรุณาลบแล้วเพิ่มใหม่",
        )

    ready = await sync_mediamtx_path(camera.stream_key, rtsp_url)
    return {
        "data": {
            "camera": _to_response(camera, mediamtx_ready=ready),
        }
    }


@router.delete("/{camera_id}", response_model=dict)
async def delete_camera(
    camera_id: int,
    current_user: CameraUserDep,
    db: DbDep,
):
    """Delete a camera owned by the current user and remove its MediaMTX path."""
    result = await db.execute(
        select(UserCamera).where(
            UserCamera.id == camera_id,
            UserCamera.user_id == current_user.id,
        )
    )
    camera = result.scalar_one_or_none()
    if camera is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ไม่พบกล้องนี้")

    stream_key = camera.stream_key
    await db.delete(camera)
    await db.commit()
    await delete_mediamtx_path(stream_key)
    return {"message": "ลบกล้องเรียบร้อย"}
