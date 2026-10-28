"""
Workspace logo processing shared by the global branding endpoint and the
per-user workspace branding endpoints.

Whatever a client uploads, what is stored is a bounded, square WebP encoded as a
data URL: the same value can then feed the sidebar logo, the favicon and the PWA
icon. SVG is refused by name because it is an XML document that can carry
script.
"""

import base64
import io
import logging
import re
import warnings

from fastapi import HTTPException, status
from PIL import Image, ImageOps

logger = logging.getLogger(__name__)

# Rendered at 34px in the sidebar, 192–512px as an app icon; 256px covers a 4x
# display. Slightly higher quality than avatars: logos are flat colour and line
# art, where compression artefacts are easy to see.
LOGO_MAX_DIMENSION = 256
LOGO_WEBP_QUALITY = 88

# Sizes a favicon / apple-touch-icon / PWA manifest may ask for.
LOGO_ICON_MIN_SIZE = 32
LOGO_ICON_MAX_SIZE = 512

ALLOWED_LOGO_MIMES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
LOGO_ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"]
LOGO_SUPPORTED_HINT = "รองรับเฉพาะไฟล์รูปภาพ JPEG, PNG, GIF หรือ WebP เท่านั้น (ไม่รองรับ SVG)"

# Only these two shapes are rendered by the UI: an absolute http(s) link, or the
# WebP/PNG data URL written by the logo upload endpoint. Anything else (notably
# `javascript:` or an SVG data URL) is refused before it reaches the database.
LOGO_VALUE_PATTERN = re.compile(
    r"^(https?://\S+$|data:image/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=\s]+$)",
    re.IGNORECASE,
)


def clean_logo_value(value: str | None) -> str | None:
    """Trim a logo value and refuse anything the UI cannot safely render."""
    if value is None:
        return value
    cleaned = value.strip()
    if not cleaned:
        return ""
    if not LOGO_VALUE_PATTERN.match(cleaned):
        raise ValueError("โลโก้ต้องเป็นลิงก์ http(s) หรือไฟล์รูปภาพที่อัปโหลดผ่านระบบเท่านั้น")
    return cleaned


def logo_data_url(webp_bytes: bytes) -> str:
    """Wrap normalised WebP bytes as a data URL (what the UI renders)."""
    encoded = base64.b64encode(webp_bytes).decode("utf-8")
    return f"data:image/webp;base64,{encoded}"


def validate_logo_content(data: bytes, declared_mime: str) -> str:
    """Sniff the real image type of an uploaded logo from its magic bytes."""
    if data.startswith(b"\xff\xd8\xff"):
        sniffed = "image/jpeg"
    elif data.startswith(b"\x89PNG\r\n\x1a\n"):
        sniffed = "image/png"
    elif data[:6] in (b"GIF87a", b"GIF89a"):
        sniffed = "image/gif"
    elif data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        sniffed = "image/webp"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=LOGO_SUPPORTED_HINT,
        )

    if declared_mime and declared_mime not in ALLOWED_LOGO_MIMES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Content-Type ของไฟล์ไม่อยู่ในประเภทที่รองรับ",
        )

    # The declared type is only a hint; the sniffed value wins, and a mismatch
    # (payload.html renamed to payload.png) is refused.
    if declared_mime and sniffed != declared_mime and declared_mime in ALLOWED_LOGO_MIMES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="เนื้อหาไฟล์ไม่ตรงกับประเภทที่ประกาศ",
        )
    return sniffed


def normalise_logo_image(data: bytes) -> bytes:
    """Downscale an uploaded logo to a bounded, square WebP.

    This deliberately does not reuse the avatar normaliser: that one flattens
    every image to RGB because a photo never needs alpha, which turned a
    transparent PNG logo into a black square in the sidebar. Logos keep their
    alpha channel here, and they are padded to a square so the same image can
    serve the sidebar, the browser favicon and the PWA icon.
    """
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as source:
                image = ImageOps.exif_transpose(source)
                has_alpha = image.mode in ("RGBA", "LA", "PA") or (
                    image.mode == "P" and "transparency" in image.info
                )
                image = image.convert("RGBA" if has_alpha else "RGB")
                image.thumbnail((LOGO_MAX_DIMENSION, LOGO_MAX_DIMENSION))

                if image.width != image.height:
                    side = max(image.width, image.height)
                    background = (0, 0, 0, 0) if has_alpha else (255, 255, 255)
                    canvas = Image.new(image.mode, (side, side), background)
                    canvas.paste(
                        image, ((side - image.width) // 2, (side - image.height) // 2)
                    )
                    image = canvas

                buffer = io.BytesIO()
                image.save(buffer, format="WEBP", quality=LOGO_WEBP_QUALITY)
        return buffer.getvalue()
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        logger.warning("brand logo refused: image exceeds the pixel ceiling")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="รูปภาพมีขนาดพิกเซลใหญ่เกินไป กรุณาใช้รูปภาพที่เล็กลง",
        )
    except Exception:
        logger.warning("brand logo could not be decoded", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ไม่สามารถประมวลผลไฟล์รูปภาพได้ กรุณาใช้ไฟล์ JPEG, PNG, GIF หรือ WebP ที่ถูกต้อง",
        )
