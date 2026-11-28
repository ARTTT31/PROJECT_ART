"""Pydantic schemas for per-account RTSP cameras."""

from typing import Literal

from pydantic import BaseModel, Field, model_validator

CameraPreset = Literal["tapo", "hikvision", "dahua", "reolink", "custom"]


class RtspConnectionInput(BaseModel):
    """Structured or raw RTSP connection details."""

    rtsp_url: str | None = Field(default=None, max_length=512)
    host: str | None = Field(default=None, max_length=255)
    port: int = Field(default=554, ge=1, le=65535)
    username: str = Field(default="", max_length=128)
    password: str = Field(default="", max_length=128)
    path: str = Field(default="/stream2", max_length=255)

    @model_validator(mode="after")
    def validate_source(self) -> "RtspConnectionInput":
        has_raw = bool((self.rtsp_url or "").strip())
        has_host = bool((self.host or "").strip())
        if not has_raw and not has_host:
            raise ValueError("กรุณาระบุ rtsp_url หรือ host ของกล้อง")
        return self


class CameraCreateRequest(RtspConnectionInput):
    """Create a per-account RTSP camera."""

    name: str = Field(..., min_length=1, max_length=100)
    location: str = Field(default="", max_length=120)
    preset: CameraPreset = "custom"
    fps: int | None = Field(default=25, ge=1, le=120)


class CameraProbeResponse(BaseModel):
    """Result of probing an RTSP camera."""

    reachable: bool
    authenticated: bool
    codec: str | None = None
    resolution: str | None = None
    warning: str | None = None
    error: str | None = None


class UserCameraResponse(BaseModel):
    """Public camera payload returned to the owning account (never includes credentials)."""

    id: int
    stream_key: str
    name: str
    location: str
    preset: str
    masked_host: str
    hls_url: str
    codec: str | None = None
    resolution: str | None = None
    fps: int | None = None
    mediamtx_ready: bool = False
