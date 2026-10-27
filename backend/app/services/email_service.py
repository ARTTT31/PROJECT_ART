"""Transactional email: Thai templates plus console / SMTP / Resend delivery.

The load-bearing property is that :meth:`EmailService.send` never raises. A
password reset that 500s because the mail provider is down is worse than one
that silently skips the mail, so every delivery failure becomes a ``False``
return and a log line.

``EMAIL_BACKEND=console`` (the default) records each message in an in-memory
outbox instead of sending it, which is what the test suite and local
development read back through :func:`outbox_messages`.
"""

from __future__ import annotations

import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage as MimeMessage
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

RESEND_ENDPOINT = "https://api.resend.com/emails"
SMTP_TIMEOUT_SECONDS = 10

# Recipient address (lower-cased) -> messages the console backend "sent" it.
_OUTBOX: Dict[str, List[Dict[str, Any]]] = {}


@dataclass
class EmailMessage:
    """One outbound message. ``html`` is optional; ``text`` is always present.

    ``text`` is required rather than derived so the plain-text part can carry
    the links on its own — the templates below put the same URL in both parts.
    """

    to: str
    subject: str
    text: str
    html: Optional[str] = None


def outbox_messages(to: str) -> List[Dict[str, Any]]:
    """Messages recorded for ``to``, oldest first (console backend only)."""
    return list(_OUTBOX.get((to or "").strip().lower(), []))


def outbox_clear() -> None:
    """Forget every recorded message. Called between tests and on demand."""
    _OUTBOX.clear()


def _record(message: EmailMessage) -> None:
    key = (message.to or "").strip().lower()
    _OUTBOX.setdefault(key, []).append(
        {
            "to": message.to,
            "subject": message.subject,
            "text": message.text,
            "html": message.html,
        }
    )


def _build_mime(message: EmailMessage) -> MimeMessage:
    mime = MimeMessage()
    mime["From"] = settings.EMAIL_FROM
    mime["To"] = message.to
    mime["Subject"] = message.subject
    mime.set_content(message.text)
    if message.html:
        mime.add_alternative(message.html, subtype="html")
    return mime


class EmailService:
    """Delivers :class:`EmailMessage` through the configured backend."""

    async def send(self, message: EmailMessage) -> bool:
        """Deliver one message. Returns ``False`` instead of raising."""
        if not (message.to or "").strip():
            logger.warning("Email dropped: no recipient for %r", message.subject)
            return False

        backend = (settings.EMAIL_BACKEND or "console").strip().lower()
        try:
            if backend == "console":
                _record(message)
                logger.info(
                    "[EMAIL:console] to=%s subject=%s", message.to, message.subject
                )
                return True
            if backend == "smtp":
                return self._send_smtp(message)
            if backend == "resend":
                return await self._send_resend(message)

            # A typo in EMAIL_BACKEND must not lose the message silently.
            logger.warning(
                "Unknown EMAIL_BACKEND %r; recording to the console outbox", backend
            )
            _record(message)
            return True
        except Exception:
            logger.exception("Email delivery failed for %s", message.to)
            return False

    def _send_smtp(self, message: EmailMessage) -> bool:
        host = (settings.SMTP_HOST or "").strip()
        if not host:
            logger.warning(
                "EMAIL_BACKEND=smtp but SMTP_HOST is empty; dropping %r",
                message.subject,
            )
            return False

        with smtplib.SMTP(host, settings.SMTP_PORT, timeout=SMTP_TIMEOUT_SECONDS) as smtp:
            if settings.SMTP_STARTTLS:
                smtp.starttls()
            if settings.SMTP_USERNAME:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(_build_mime(message))
        return True

    async def _send_resend(self, message: EmailMessage) -> bool:
        api_key = (settings.RESEND_API_KEY or "").strip()
        if not api_key:
            logger.warning(
                "EMAIL_BACKEND=resend but RESEND_API_KEY is empty; dropping %r",
                message.subject,
            )
            return False

        payload: Dict[str, Any] = {
            "from": settings.EMAIL_FROM,
            "to": [message.to],
            "subject": message.subject,
            "text": message.text,
        }
        if message.html:
            payload["html"] = message.html

        async with httpx.AsyncClient(timeout=SMTP_TIMEOUT_SECONDS) as client:
            response = await client.post(
                RESEND_ENDPOINT,
                json=payload,
                headers={"Authorization": f"Bearer {api_key}"},
            )

        if response.status_code >= 400:
            logger.warning(
                "Resend refused the message (%s): %s",
                response.status_code,
                response.text[:200],
            )
            return False
        return True


_service = EmailService()


def get_email_service() -> EmailService:
    """The shared service instance (stateless; safe to reuse)."""
    return _service


# ── Templates ───────────────────────────────────────────────────────────────
# Every template repeats the link in both parts: a plain-text-only client still
# has a clickable URL, and the HTML part is the same information laid out.


def _wrap_html(title: str, body: str, link: str, label: str) -> str:
    return (
        '<div style="font-family:-apple-system,BlinkMacSystemFont,'
        "'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:24px;"
        'color:#1d1d1f">'
        f'<h2 style="font-size:20px;margin:0 0 16px">{title}</h2>'
        f'<div style="font-size:15px;line-height:1.6">{body}</div>'
        '<p style="margin:24px 0">'
        f'<a href="{link}" style="background:#0066cc;color:#fff;'
        'padding:12px 20px;border-radius:980px;text-decoration:none;'
        f'display:inline-block">{label}</a></p>'
        '<p style="font-size:13px;color:#6e6e73">'
        f"ถ้าปุ่มไม่ทำงาน ให้คัดลอกลิงก์นี้: {link}</p>"
        "</div>"
    )


def password_reset_email(to: str, name: str, link: str) -> EmailMessage:
    """Link that lets the owner of ``to`` choose a new password."""
    greeting = f"สวัสดี {name}" if name else "สวัสดี"
    text = (
        f"{greeting}\n\n"
        "เราได้รับคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีนี้ "
        "กดลิงก์ด้านล่างเพื่อตั้งรหัสผ่านใหม่:\n\n"
        f"{link}\n\n"
        f"ลิงก์นี้ใช้ได้ครั้งเดียวและจะหมดอายุใน "
        f"{settings.PASSWORD_RESET_TOKEN_MINUTES} นาที\n"
        "ถ้าคุณไม่ได้เป็นผู้ขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ"
    )
    html = _wrap_html(
        "ตั้งรหัสผ่านใหม่",
        f"<p>{greeting}</p><p>เราได้รับคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีนี้ "
        f"ลิงก์นี้ใช้ได้ครั้งเดียวและจะหมดอายุใน "
        f"{settings.PASSWORD_RESET_TOKEN_MINUTES} นาที</p>",
        link,
        "ตั้งรหัสผ่านใหม่",
    )
    return EmailMessage(to=to, subject="ตั้งรหัสผ่านใหม่ — ART Workspace", text=text, html=html)


def verify_email_message(to: str, name: str, link: str) -> EmailMessage:
    """Link that proves the address belongs to the account."""
    greeting = f"สวัสดี {name}" if name else "สวัสดี"
    text = (
        f"{greeting}\n\n"
        "ขอบคุณที่สมัครใช้งาน ART Workspace "
        "กดลิงก์ด้านล่างเพื่อยืนยันอีเมลของคุณ:\n\n"
        f"{link}\n\n"
        f"ลิงก์นี้จะหมดอายุใน {settings.EMAIL_VERIFY_TOKEN_MINUTES} นาที\n"
        "ถ้าคุณไม่ได้สมัครใช้งาน ไม่ต้องทำอะไร"
    )
    html = _wrap_html(
        "ยืนยันอีเมล",
        f"<p>{greeting}</p><p>ขอบคุณที่สมัครใช้งาน ART Workspace "
        f"ลิงก์นี้จะหมดอายุใน {settings.EMAIL_VERIFY_TOKEN_MINUTES} นาที</p>",
        link,
        "ยืนยันอีเมล",
    )
    return EmailMessage(to=to, subject="ยืนยันอีเมล — ART Workspace", text=text, html=html)


def account_approved_email(to: str, name: str, login_url: str) -> EmailMessage:
    """Notice that a pending sign-up request was approved."""
    greeting = f"สวัสดี {name}" if name else "สวัสดี"
    text = (
        f"{greeting}\n\n"
        "คำขอสมัครบัญชี ART Workspace ของคุณได้รับการอนุมัติแล้ว "
        "เข้าสู่ระบบได้ทันทีที่:\n\n"
        f"{login_url}\n"
    )
    html = _wrap_html(
        "บัญชีของคุณได้รับการอนุมัติ",
        f"<p>{greeting}</p><p>คำขอสมัครบัญชี ART Workspace ของคุณได้รับการอนุมัติแล้ว</p>",
        login_url,
        "เข้าสู่ระบบ",
    )
    return EmailMessage(
        to=to, subject="บัญชีของคุณได้รับการอนุมัติ — ART Workspace", text=text, html=html
    )


def account_rejected_email(to: str, name: str) -> EmailMessage:
    """Notice that a pending sign-up request was refused."""
    greeting = f"สวัสดี {name}" if name else "สวัสดี"
    text = (
        f"{greeting}\n\n"
        "คำขอสมัครบัญชี ART Workspace ของคุณไม่ได้รับการอนุมัติในครั้งนี้\n"
        "หากคิดว่าเป็นการเข้าใจผิด กรุณาติดต่อผู้ดูแลระบบของคุณ"
    )
    html = _wrap_html(
        "ผลการพิจารณาคำขอสมัครบัญชี",
        f"<p>{greeting}</p><p>คำขอสมัครบัญชี ART Workspace ของคุณ"
        "ไม่ได้รับการอนุมัติในครั้งนี้ หากคิดว่าเป็นการเข้าใจผิด "
        "กรุณาติดต่อผู้ดูแลระบบของคุณ</p>",
        f"{settings.FRONTEND_BASE_URL}/login",
        "ไปที่หน้าล็อกอิน",
    )
    return EmailMessage(
        to=to,
        subject="ผลการพิจารณาคำขอสมัครบัญชี — ART Workspace",
        text=text,
        html=html,
    )


def admin_new_request_email(
    to: str, name: str, applicant_email: str, review_url: str
) -> EmailMessage:
    """Tell an admin that somebody is waiting for a decision."""
    greeting = f"สวัสดี {name}" if name else "สวัสดี"
    text = (
        f"{greeting}\n\n"
        f"มีคำขอสมัครบัญชีใหม่จาก {applicant_email} รอการอนุมัติของคุณ\n"
        f"ตรวจสอบและพิจารณาได้ที่:\n\n{review_url}\n"
    )
    html = _wrap_html(
        "มีคำขอสมัครบัญชีใหม่",
        f"<p>{greeting}</p><p>มีคำขอสมัครบัญชีใหม่จาก "
        f"<strong>{applicant_email}</strong> รอการอนุมัติของคุณ</p>",
        review_url,
        "ตรวจสอบคำขอ",
    )
    return EmailMessage(
        to=to, subject="มีคำขอสมัครบัญชีใหม่รออนุมัติ — ART Workspace", text=text, html=html
    )
