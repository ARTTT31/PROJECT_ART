"""Transactional email — one place that sends every account-related message.

Three pluggable backends, chosen with ``EMAIL_BACKEND``:

- ``console`` (default): nothing is delivered. The message is logged and kept
  in an in-memory outbox, which is what tests and local development inspect.
- ``smtp``: any provider's SMTP relay (Brevo, a Gmail app password, AWS SES,
  ...) via stdlib smtplib, run in a worker thread so the event loop stays free.
- ``resend``: the Resend HTTP API (https://api.resend.com/emails).

``send()`` NEVER raises. A password-reset request must not fail with a 500
because the mail provider is down; the failure is logged and (where the caller
cares) the boolean return says so. Delivering a *link* is also safe to lose:
the user can simply request a new one.
"""

from __future__ import annotations

import asyncio
import html as html_escape
import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage as _MimeMessage
from typing import Dict, List, Optional

import httpx

from app.core.config import settings
from app.core.utils import utcnow

logger = logging.getLogger(__name__)

# Console backend outbox. Bounded so a long-running dev process cannot grow it
# without limit; tests read it through the helpers below instead of the list.
OUTBOX: List[Dict[str, str]] = []
_OUTBOX_LIMIT = 200

RESEND_ENDPOINT = "https://api.resend.com/emails"


@dataclass
class EmailMessage:
    """A single transactional message, backend-independent."""

    to: str
    subject: str
    text: str
    html: str = ""


def outbox_clear() -> None:
    """Empty the console backend's outbox (tests call this between cases)."""
    OUTBOX.clear()


def outbox_messages(to: Optional[str] = None) -> List[Dict[str, str]]:
    """Messages the console backend captured, optionally filtered by recipient."""
    if to is None:
        return list(OUTBOX)
    wanted = to.strip().lower()
    return [m for m in OUTBOX if m["to"].strip().lower() == wanted]


def _outbox_append(message: EmailMessage) -> None:
    OUTBOX.append(
        {
            "to": message.to,
            "subject": message.subject,
            "text": message.text,
            "html": message.html,
            "sent_at": utcnow().isoformat(),
        }
    )
    if len(OUTBOX) > _OUTBOX_LIMIT:
        del OUTBOX[0 : len(OUTBOX) - _OUTBOX_LIMIT]


class EmailService:
    """Send a message through the configured backend. Never raises on delivery."""

    async def send(self, message: EmailMessage) -> bool:
        try:
            backend = settings.EMAIL_BACKEND
            if backend == "smtp":
                await asyncio.to_thread(self._send_smtp_blocking, message)
            elif backend == "resend":
                await self._send_resend(message)
            else:
                self._send_console(message)
            return True
        except Exception:
            # Logged, never raised: callers treat email as best-effort (the
            # user can always request a fresh link).
            logger.exception(
                "Email delivery failed (backend=%s, to=%s)",
                settings.EMAIL_BACKEND,
                message.to,
            )
            return False

    # ── backends ────────────────────────────────────────────────────────────

    @staticmethod
    def _send_console(message: EmailMessage) -> None:
        _outbox_append(message)
        logger.info(
            "[EMAIL:console] to=%s subject=%s\n%s",
            message.to,
            message.subject,
            message.text,
        )

    @staticmethod
    def _send_smtp_blocking(message: EmailMessage) -> None:
        if not settings.SMTP_HOST:
            raise RuntimeError("SMTP_HOST is not configured")
        mime = _MimeMessage()
        mime["From"] = settings.EMAIL_FROM
        mime["To"] = message.to
        mime["Subject"] = message.subject
        mime.set_content(message.text)
        if message.html:
            mime.add_alternative(message.html, subtype="html")

        timeout = settings.EMAIL_TIMEOUT_SECONDS
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=timeout) as smtp:
            if settings.SMTP_STARTTLS:
                smtp.starttls()
            if settings.SMTP_USERNAME:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(mime)

    @staticmethod
    async def _send_resend(message: EmailMessage) -> None:
        if not settings.RESEND_API_KEY:
            raise RuntimeError("RESEND_API_KEY is not configured")
        payload = {
            "from": settings.EMAIL_FROM,
            "to": [message.to],
            "subject": message.subject,
            "text": message.text,
        }
        if message.html:
            payload["html"] = message.html
        async with httpx.AsyncClient(timeout=settings.EMAIL_TIMEOUT_SECONDS) as client:
            resp = await client.post(
                RESEND_ENDPOINT,
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        # 2xx = accepted for delivery; anything else is a failure worth logging.
        if resp.status_code >= 300:
            raise RuntimeError(
                f"Resend returned HTTP {resp.status_code}: {resp.text[:200]}"
            )


def get_email_service() -> EmailService:
    """FastAPI-dependency-friendly accessor (kept as a function for overrides)."""
    return EmailService()


# ═══════════════════════════════════════════════════════════════════════════════
# Message templates (Thai copy — the product language)
# ═══════════════════════════════════════════════════════════════════════════════

_LAYOUT = """\
<!doctype html>
<html lang="th">
<body style="margin:0;padding:24px;background:#f5f5f7;font-family:'Helvetica Neue',Arial,sans-serif;color:#1d1d1f;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:18px;padding:32px;">
        <tr><td style="font-size:15px;line-height:1.6;">
          <p style="margin:0 0 4px;font-size:19px;font-weight:700;">ART Workspace</p>
          {body}
        </td></tr>
      </table>
      <p style="font-size:12px;color:#6e6e73;margin:16px 0 0;">
        อีเมลนี้ส่งโดยระบบอัตโนมัติ กรุณาอย่าตอบกลับ
      </p>
    </td></tr>
  </table>
</body>
</html>
"""

_BUTTON = (
    '<p style="margin:20px 0;">'
    '<a href="{url}" style="display:inline-block;background:#0066cc;color:#ffffff;'
    'text-decoration:none;padding:12px 28px;border-radius:999px;font-weight:600;">'
    "{label}</a></p>"
)


def _wrap(body_html: str) -> str:
    return _LAYOUT.format(body=body_html)


def _greeting(name: Optional[str]) -> str:
    safe = html_escape.escape(name) if name else "ผู้ใช้งาน"
    return f"<p style=\"margin:0 0 16px;\">สวัสดีคุณ {safe}</p>"


def password_reset_email(to: str, name: Optional[str], reset_url: str) -> EmailMessage:
    text = (
        f"สวัสดีคุณ {name or 'ผู้ใช้งาน'}\n\n"
        "มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ\n"
        f"เปิดลิงก์นี้เพื่อตั้งรหัสผ่านใหม่: {reset_url}\n\n"
        f"ลิงก์จะหมดอายุใน {settings.PASSWORD_RESET_TOKEN_MINUTES} นาที และใช้ได้ครั้งเดียว\n"
        "ถ้าคุณไม่ได้เป็นเจ้าของคำขอนี้ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ"
    )
    body = (
        _greeting(name)
        + "<p style=\"margin:0 0 8px;\">มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ "
        "หากต้องการดำเนินการ กรุณากดปุ่มด้านล่าง</p>"
        + _BUTTON.format(url=html_escape.escape(reset_url), label="ตั้งรหัสผ่านใหม่")
        + f"<p style=\"margin:0;font-size:13px;color:#6e6e73;\">ลิงก์จะหมดอายุใน "
        f"{settings.PASSWORD_RESET_TOKEN_MINUTES} นาที และใช้ได้ครั้งเดียว "
        "ถ้าคุณไม่ได้ส่งคำขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ</p>"
    )
    return EmailMessage(
        to=to, subject="ตั้งรหัสผ่านใหม่ — ART Workspace", text=text, html=_wrap(body)
    )


def verify_email_message(to: str, name: Optional[str], verify_url: str) -> EmailMessage:
    text = (
        f"สวัสดีคุณ {name or 'ผู้ใช้งาน'}\n\n"
        "กรุณายืนยันอีเมลของคุณเพื่อเปิดใช้งานบัญชี ART Workspace\n"
        f"เปิดลิงก์นี้เพื่อยืนยัน: {verify_url}\n\n"
        f"ลิงก์จะหมดอายุใน {settings.EMAIL_VERIFY_TOKEN_MINUTES // 60} ชั่วโมง"
    )
    body = (
        _greeting(name)
        + "<p style=\"margin:0 0 8px;\">กรุณายืนยันอีเมลของคุณเพื่อเปิดใช้งานบัญชี "
        "กดปุ่มด้านล่างได้เลย</p>"
        + _BUTTON.format(url=html_escape.escape(verify_url), label="ยืนยันอีเมล")
        + f"<p style=\"margin:0;font-size:13px;color:#6e6e73;\">ลิงก์จะหมดอายุใน "
        f"{settings.EMAIL_VERIFY_TOKEN_MINUTES // 60} ชั่วโมง "
        "ถ้าคุณไม่ได้สมัครบัญชีนี้ กรุณาเพิกเฉยอีเมลฉบับนี้</p>"
    )
    return EmailMessage(
        to=to, subject="ยืนยันอีเมลของคุณ — ART Workspace", text=text, html=_wrap(body)
    )


def admin_new_request_email(
    to: str, admin_name: Optional[str], applicant: str, panel_url: str
) -> EmailMessage:
    text = (
        f"สวัสดีคุณ {admin_name or 'ผู้ดูแลระบบ'}\n\n"
        f"มีคำขอสมัครบัญชีใหม่จาก {applicant} รอการอนุมัติของคุณ\n"
        f"ตรวจสอบและอนุมัติได้ที่: {panel_url}"
    )
    body = (
        _greeting(admin_name)
        + f"<p style=\"margin:0 0 8px;\">มีคำขอสมัครบัญชีใหม่จาก "
        f"<strong>{html_escape.escape(applicant)}</strong> รอการอนุมัติของคุณ</p>"
        + _BUTTON.format(url=html_escape.escape(panel_url), label="เปิดหน้าจัดการผู้ใช้")
    )
    return EmailMessage(
        to=to, subject="มีคำขอสมัครบัญชีใหม่รออนุมัติ — ART Workspace", text=text, html=_wrap(body)
    )


def account_approved_email(to: str, name: Optional[str], login_url: str) -> EmailMessage:
    text = (
        f"สวัสดีคุณ {name or 'ผู้ใช้งาน'}\n\n"
        "บัญชี ART Workspace ของคุณได้รับการอนุมัติแล้ว เข้าสู่ระบบได้ทันทีที่:\n"
        f"{login_url}"
    )
    body = (
        _greeting(name)
        + "<p style=\"margin:0 0 8px;\">บัญชีของคุณได้รับการอนุมัติแล้ว "
        "เข้าสู่ระบบได้ทันที</p>"
        + _BUTTON.format(url=html_escape.escape(login_url), label="เข้าสู่ระบบ")
    )
    return EmailMessage(
        to=to, subject="บัญชีของคุณได้รับการอนุมัติแล้ว — ART Workspace", text=text, html=_wrap(body)
    )


def account_rejected_email(to: str, name: Optional[str]) -> EmailMessage:
    text = (
        f"สวัสดีคุณ {name or 'ผู้ใช้งาน'}\n\n"
        "ขออภัย คำขอสมัครบัญชี ART Workspace ของคุณไม่ได้รับการอนุมัติ\n"
        "หากคิดว่าเป็นความผิดพลาด กรุณาติดต่อผู้ดูแลระบบโดยตรง"
    )
    body = (
        _greeting(name)
        + "<p style=\"margin:0 0 8px;\">ขออภัย คำขอสมัครบัญชีของคุณไม่ได้รับการอนุมัติ "
        "หากคิดว่าเป็นความผิดพลาด กรุณาติดต่อผู้ดูแลระบบโดยตรง</p>"
    )
    return EmailMessage(
        to=to, subject="ผลการพิจารณาคำขอสมัครบัญชี — ART Workspace", text=text, html=_wrap(body)
    )
