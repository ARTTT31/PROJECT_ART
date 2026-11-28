"""RTSP URL builder, connection/codec probe, and MediaMTX Control API client."""

from __future__ import annotations

import asyncio
import base64
import hashlib
import logging
import re
from dataclasses import dataclass
from urllib.parse import quote, unquote, urlsplit, urlunsplit

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_H265_RE = re.compile(r"\b(?:H265|HEVC)\b", re.IGNORECASE)
_H264_RE = re.compile(r"\bH264\b", re.IGNORECASE)
_FRAMESIZE_RE = re.compile(r"a=framesize:\d+\s+(\d+-\d+)", re.IGNORECASE)
_DIGEST_RE = re.compile(r'(\w+)="([^"]*)"')


@dataclass(slots=True)
class RtspProbeResult:
    """Outcome of probing an RTSP stream before saving or playing."""

    reachable: bool
    authenticated: bool
    codec: str | None = None
    resolution: str | None = None
    warning: str | None = None
    error: str | None = None


def build_rtsp_url(
    host: str,
    port: int = 554,
    username: str = "",
    password: str = "",
    path: str = "/stream2",
    scheme: str = "rtsp",
) -> str:
    """Build a properly percent-encoded RTSP URL from structured fields."""
    clean_host = host.strip()
    clean_path = path.strip() or "/stream2"
    if not clean_path.startswith("/"):
        clean_path = f"/{clean_path}"

    auth_part = ""
    if username or password:
        user_enc = quote(username.strip(), safe="")
        pass_enc = quote(password, safe="")
        auth_part = f"{user_enc}:{pass_enc}@" if password else f"{user_enc}@"

    host_part = f"[{clean_host}]" if ":" in clean_host and not clean_host.startswith("[") else clean_host
    return f"{scheme}://{auth_part}{host_part}:{port}{clean_path}"


def mask_rtsp_host(rtsp_url: str) -> str:
    """Return ``host:port/path`` without username or password for UI display."""
    parts = urlsplit(rtsp_url)
    host = parts.hostname or ""
    port = parts.port
    port_suffix = f":{port}" if port else ""
    return f"{host}{port_suffix}{parts.path or ''}"


def _clean_rtsp_uri(rtsp_url: str) -> str:
    """Return the RTSP URI without embedded userinfo for RTSP request lines."""
    parts = urlsplit(rtsp_url)
    host = parts.hostname or ""
    if ":" in host and not host.startswith("["):
        host = f"[{host}]"
    netloc = f"{host}:{parts.port}" if parts.port else host
    return urlunsplit((parts.scheme, netloc, parts.path or "/", parts.query, ""))


def _parse_rtsp_response(raw: bytes) -> tuple[int, dict[str, str], str]:
    """Parse an RTSP response head and optional SDP body."""
    text = raw.decode("utf-8", errors="replace")
    head, _, body = text.partition("\r\n\r\n")
    lines = head.splitlines()
    status_code = 0
    if lines and lines[0].startswith("RTSP/"):
        tokens = lines[0].split()
        if len(tokens) >= 2 and tokens[1].isdigit():
            status_code = int(tokens[1])
    headers: dict[str, str] = {}
    for line in lines[1:]:
        if ":" in line:
            k, v = line.split(":", 1)
            headers[k.strip().lower()] = v.strip()
    return status_code, headers, body


def _build_auth_header(
    challenge: str,
    method: str,
    uri: str,
    username: str,
    password: str,
) -> str | None:
    """Build a Basic or Digest Authorization header from WWW-Authenticate."""
    if not username and not password:
        return None
    lower = challenge.lower()
    if lower.startswith("digest "):
        params = dict(_DIGEST_RE.findall(challenge))
        realm = params.get("realm", "")
        nonce = params.get("nonce", "")
        ha1 = hashlib.md5(f"{username}:{realm}:{password}".encode("utf-8")).hexdigest()
        ha2 = hashlib.md5(f"{method}:{uri}".encode("utf-8")).hexdigest()
        resp = hashlib.md5(f"{ha1}:{nonce}:{ha2}".encode("utf-8")).hexdigest()
        return (
            f'Digest username="{username}", realm="{realm}", '
            f'nonce="{nonce}", uri="{uri}", response="{resp}"'
        )
    token = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("ascii")
    return f"Basic {token}"


async def _send_rtsp(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    method: str,
    uri: str,
    cseq: int,
    extra_headers: dict[str, str] | None = None,
    timeout: float = 6.0,
) -> tuple[int, dict[str, str], str]:
    lines = [f"{method} {uri} RTSP/1.0", f"CSeq: {cseq}", "User-Agent: WorkspaceCCTV/1.0"]
    if extra_headers:
        for key, val in extra_headers.items():
            lines.append(f"{key}: {val}")
    payload = ("\r\n".join(lines) + "\r\n\r\n").encode("utf-8")
    writer.write(payload)
    await asyncio.wait_for(writer.drain(), timeout=timeout)

    head_bytes = await asyncio.wait_for(reader.readuntil(b"\r\n\r\n"), timeout=timeout)
    status_code, headers, _ = _parse_rtsp_response(head_bytes)
    content_len = int(headers.get("content-length", "0") or "0")
    body_bytes = b""
    if content_len > 0:
        body_bytes = await asyncio.wait_for(reader.readexactly(min(content_len, 16384)), timeout=timeout)
    return status_code, headers, body_bytes.decode("utf-8", errors="replace")


async def probe_rtsp_stream(rtsp_url: str, timeout: float = 8.0) -> RtspProbeResult:
    """Test TCP reachability, RTSP credentials, and video codec (H.264 vs H.265)."""
    parts = urlsplit(rtsp_url)
    host = parts.hostname or ""
    port = parts.port or 554
    username = unquote(parts.username or "")
    password = unquote(parts.password or "")
    clean_uri = _clean_rtsp_uri(rtsp_url)

    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port), timeout=timeout
        )
    except OSError as exc:
        return RtspProbeResult(
            reachable=False,
            authenticated=False,
            error=f"เชื่อมต่อ {host}:{port} ไม่ได้ ({exc}) — ตรวจสอบ Port Forward / TrueDDNS",
        )

    try:
        status, headers, _ = await _send_rtsp(
            reader, writer, "OPTIONS", clean_uri, cseq=1, timeout=timeout
        )
        if status == 0:
            return RtspProbeResult(
                reachable=True,
                authenticated=False,
                error="ปลายทางไม่ได้ตอบกลับแบบ RTSP",
            )

        desc_headers = {"Accept": "application/sdp"}
        status, headers, body = await _send_rtsp(
            reader, writer, "DESCRIBE", clean_uri, cseq=2, extra_headers=desc_headers, timeout=timeout
        )
        if status == 401 and "www-authenticate" in headers:
            auth = _build_auth_header(
                headers["www-authenticate"], "DESCRIBE", clean_uri, username, password
            )
            if not auth:
                return RtspProbeResult(
                    reachable=True,
                    authenticated=False,
                    error="กล้องต้องการ Username และ Password",
                )
            desc_headers["Authorization"] = auth
            status, headers, body = await _send_rtsp(
                reader, writer, "DESCRIBE", clean_uri, cseq=3, extra_headers=desc_headers, timeout=timeout
            )

        if status == 401:
            return RtspProbeResult(
                reachable=True,
                authenticated=False,
                error="Username หรือ Password ของกล้องไม่ถูกต้อง (401)",
            )
        if status >= 400:
            return RtspProbeResult(
                reachable=True,
                authenticated=True,
                error=f"กล้องปฏิเสธ path นี้ (RTSP {status}) — ตรวจสอบ /stream2 หรือ path ของกล้อง",
            )

        codec: str | None = None
        warning: str | None = None
        if _H265_RE.search(body):
            codec = "H265"
            warning = (
                "กล้องส่งภาพเป็น H.265 ซึ่งเบราว์เซอร์ส่วนใหญ่เล่นไม่ได้ (จอดำ) "
                "— แนะนำใช้ /stream2 หรือเปลี่ยนการตั้งค่ากล้องเป็น H.264"
            )
        elif _H264_RE.search(body):
            codec = "H264"

        resolution: str | None = None
        if match := _FRAMESIZE_RE.search(body):
            resolution = match.group(1).replace("-", "x")

        return RtspProbeResult(
            reachable=True,
            authenticated=True,
            codec=codec,
            resolution=resolution,
            warning=warning,
        )
    except (asyncio.TimeoutError, asyncio.IncompleteReadError, OSError) as exc:
        return RtspProbeResult(
            reachable=True,
            authenticated=False,
            error=f"การสื่อสารกับกล้องขาดหายระหว่างตรวจสอบ ({exc})",
        )
    finally:
        writer.close()
        try:
            await writer.wait_closed()
        except OSError:
            pass


def mediamtx_configured() -> bool:
    """True when both the MediaMTX edge URL and control secret are configured."""
    return bool(settings.CCTV_MEDIAMTX_URL.strip() and settings.CCTV_CONTROL_SECRET.strip())


def build_hls_url(stream_key: str) -> str:
    """Build the public HLS manifest URL served by MediaMTX for ``stream_key``."""
    base = settings.CCTV_MEDIAMTX_URL.strip().rstrip("/")
    return f"{base}/{stream_key}/index.m3u8" if base else ""


async def sync_mediamtx_path(stream_key: str, rtsp_url: str) -> bool:
    """Register or update ``stream_key`` on MediaMTX over /_control/v3."""
    if not mediamtx_configured():
        return False
    base = settings.CCTV_MEDIAMTX_URL.strip().rstrip("/")
    headers = {"Authorization": f"Bearer {settings.CCTV_CONTROL_SECRET.strip()}"}
    payload = {
        "source": rtsp_url,
        "sourceOnDemand": True,
        "sourceOnDemandCloseAfter": "30s",
        "rtspTransport": "tcp",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                f"{base}/_control/v3/config/paths/add/{stream_key}",
                json=payload,
                headers=headers,
            )
            if res.status_code == 400 and "already exists" in res.text.lower():
                res = await client.patch(
                    f"{base}/_control/v3/config/paths/patch/{stream_key}",
                    json=payload,
                    headers=headers,
                )
            if res.is_success:
                return True
            logger.warning(
                "MediaMTX sync failed for %s: %s %s",
                stream_key,
                res.status_code,
                res.text[:200],
            )
            return False
    except httpx.HTTPError as exc:
        logger.warning("MediaMTX control request failed for %s: %s", stream_key, exc)
        return False


async def delete_mediamtx_path(stream_key: str) -> None:
    """Best-effort removal of ``stream_key`` from MediaMTX."""
    if not mediamtx_configured():
        return
    base = settings.CCTV_MEDIAMTX_URL.strip().rstrip("/")
    headers = {"Authorization": f"Bearer {settings.CCTV_CONTROL_SECRET.strip()}"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.delete(
                f"{base}/_control/v3/config/paths/delete/{stream_key}",
                headers=headers,
            )
    except httpx.HTTPError as exc:
        logger.warning("MediaMTX delete failed for %s: %s", stream_key, exc)
