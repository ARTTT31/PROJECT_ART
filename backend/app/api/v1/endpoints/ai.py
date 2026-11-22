"""AI Copilot Endpoint.

Provides interactive AI chat with structured workspace action execution (add note,
add reminder, workspace summary). Answers through an external model when one is
configured — Gemini (``GEMINI_API_KEY``) or any OpenAI-compatible chat endpoint
(``AI_API_KEY`` + ``AI_BASE_URL`` + ``AI_MODEL``) — and otherwise falls back to a
built-in Thai natural-language intent parser, so the drawer works with no key.
"""

import datetime
import json
import logging
import re
from dataclasses import dataclass
from zoneinfo import ZoneInfo
from typing import Any, Dict, List, Literal, Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.secret_box import decrypt_secret, encrypt_secret
from app.core.url_safety import UnsafeURLError, ensure_public_http_url
from app.models.user import User
from app.services.ai_quota import claim_daily_request

logger = logging.getLogger(__name__)
router = APIRouter()

_AI_LIMIT = "30/minute"

# The model is a chat partner, not a database: bound the round-trip and the
# amount of conversation it sees so a slow provider cannot hold the drawer.
AI_REQUEST_TIMEOUT_SECONDS = 15.0
AI_HISTORY_LIMIT = 8
# A copilot answer is a short list, not an essay, but 700 tokens truncated real
# explanations mid-sentence; 1600 fits a full Thai answer with bullets.
AI_MAX_OUTPUT_TOKENS = 1600

# The workspace is Thai: "today" in the prompt must be the Bangkok date, not
# the server's (UTC) date, or the model is told the wrong day until 07:00 ICT.
BANGKOK = ZoneInfo("Asia/Bangkok")

# Model ids retire on a schedule, so the id is configurable — but the built-in
# default has to be one a *new* AI Studio key can reach, or the first call
# answers 404/403 and the drawer silently drops to the regex engine.
# Checked against Google's model list (2026-11-22): `gemini-3.8-flash` is the
# current stable Flash id and the documented replacement for 2.5 Flash, which is
# now deprecated and served only to projects that already used it. Do not move
# this back to the 2.5 family. A key that lists different models gets its own
# real list from /settings/detect, which overrides this default.
DEFAULT_GEMINI_MODEL = "gemini-3.8-flash"
DEFAULT_OPENAI_MODEL = "gpt-4.1-mini"
DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1"

GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
GEMINI_MODELS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models"

# A pasted key already names its issuer, so the form does not need to be filled
# in by hand. Longest/most specific prefix first: every OpenAI-style key starts
# with "sk-", and "sk-or-"/"sk-ant-" are different companies.
KEY_SIGNATURES: tuple[tuple[str, str, str, str], ...] = (
    ("AIza", "gemini", "", "Google Gemini"),
    ("sk-or-", "openai", "https://openrouter.ai/api/v1", "OpenRouter"),
    ("sk-ant-", "unsupported", "", "Anthropic"),
    ("sk-proj-", "openai", DEFAULT_OPENAI_BASE_URL, "OpenAI"),
    ("gsk_", "openai", "https://api.groq.com/openai/v1", "Groq"),
    ("xai-", "openai", "https://api.x.ai/v1", "xAI"),
    ("csk-", "openai", "https://api.cerebras.ai/v1", "Cerebras"),
    ("fw_", "openai", "https://api.fireworks.ai/inference/v1", "Fireworks"),
    ("sk-", "openai", DEFAULT_OPENAI_BASE_URL, "OpenAI"),
)

# Host → company name, so the chat can say which service answered instead of a
# generic "OpenAI-compatible".
BASE_URL_LABELS = {
    "openrouter.ai": "OpenRouter",
    "api.groq.com": "Groq",
    "api.x.ai": "xAI",
    "api.cerebras.ai": "Cerebras",
    "api.fireworks.ai": "Fireworks",
    "api.openai.com": "OpenAI",
    "api.anthropic.com": "Anthropic",
}

AI_MODEL_LIST_LIMIT = 40

# Providers list every model they serve — TTS, image, live-audio, embeddings —
# but only chat models can answer this endpoint. Filtering them out keeps the
# picker short enough to choose from and stops "suggested model" from landing
# on an embedding model that cannot chat.
NON_CHAT_MODEL_HINTS = ("tts", "image", "live", "embedding", "aqa", "learnlm", "whisper")


def detect_ai_key(api_key: str) -> Optional[Dict[str, str]]:
    """Identify the provider that issued ``api_key`` from the key's own shape.

    Returns ``provider``/``base_url``/``label`` — never the key itself — or
    ``None`` when the format matches nothing we know.
    """
    value = (api_key or "").strip()
    if len(value) < 8:
        return None

    for prefix, provider, base_url, label in KEY_SIGNATURES:
        if value.startswith(prefix):
            return {"provider": provider, "base_url": base_url, "label": label}
    return None


def provider_label(provider: str, base_url: Optional[str]) -> str:
    """Human name of the service behind a saved provider + base URL."""
    if provider == "gemini":
        return "Google Gemini"
    host = ""
    if base_url:
        try:
            host = httpx.URL(base_url).host or ""
        except Exception:
            host = ""
    if host in BASE_URL_LABELS:
        return BASE_URL_LABELS[host]
    return "OpenAI-compatible" if provider == "openai" else provider


DEFAULT_OIL_PRICES = [
    {"name": "ดีเซล", "price": 32.94, "unit": "บาท/ลิตร"},
    {"name": "แก๊สโซฮอล์ 95", "price": 38.55, "unit": "บาท/ลิตร"},
    {"name": "แก๊สโซฮอล์ 91", "price": 38.18, "unit": "บาท/ลิตร"},
    {"name": "แก๊สโซฮอล์ E20", "price": 36.44, "unit": "บาท/ลิตร"},
    {"name": "แก๊สโซฮอล์ E85", "price": 34.69, "unit": "บาท/ลิตร"},
    {"name": "เบนซิน 95", "price": 47.54, "unit": "บาท/ลิตร"},
]


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    text: str


class AIChatRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None
    # Recent turns, oldest first. Optional so older clients keep working.
    history: Optional[List[ChatTurn]] = None


class AIAction(BaseModel):
    type: str  # "add_note" | "add_reminder"
    data: Dict[str, Any]


class AIChatResponse(BaseModel):
    result: str = "success"
    reply: str
    action: Optional[AIAction] = None
    # Which model produced the reply. The drawer prints it, so a connected key
    # is visible in the chat instead of looking identical to the local engine.
    provider: Optional[str] = None
    model: Optional[str] = None
    # True when a key is saved but the provider refused this call, so the reply
    # below came from the built-in engine. The drawer says so instead of showing
    # a canned answer as if the model had written it.
    degraded: bool = False


def resolve_oil_data(context: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Resolve oil prices from request context, internal module cache, or standard defaults."""
    if context and "oil" in context and isinstance(context["oil"], dict):
        return context["oil"]

    try:
        from app.api.v1.endpoints.oil_prices import _cache as oil_cache
        if oil_cache and oil_cache.get("data") and isinstance(oil_cache["data"], dict):
            return oil_cache["data"]
    except Exception:
        pass

    return {
        "prices": DEFAULT_OIL_PRICES,
        "status": "ราคาคงที่",
    }


def format_oil_reply(message: str, oil: Dict[str, Any]) -> str:
    """Format rich, detailed Thai oil price response with specific fuel highlighting."""
    raw_prices = oil.get("prices")
    status = oil.get("status", "ราคาคงที่")
    update_date = oil.get("update_date", "วันนี้")

    # If passed as single metrics { diesel: 32.94, gasohol95: 38.55 }
    if not raw_prices:
        diesel = oil.get("diesel", 32.94)
        gasohol95 = oil.get("gasohol95", 38.55)
        prices = [
            {"name": "ดีเซล", "price": diesel, "unit": "บาท/ลิตร"},
            {"name": "แก๊สโซฮอล์ 95", "price": gasohol95, "unit": "บาท/ลิตร"},
            {"name": "แก๊สโซฮอล์ 91", "price": 38.18, "unit": "บาท/ลิตร"},
            {"name": "แก๊สโซฮอล์ E20", "price": 36.44, "unit": "บาท/ลิตร"},
            {"name": "แก๊สโซฮอล์ E85", "price": 34.69, "unit": "บาท/ลิตร"},
            {"name": "เบนซิน 95", "price": 47.54, "unit": "บาท/ลิตร"},
        ]
    else:
        prices = raw_prices

    lower = message.lower()
    highlight = ""
    if "ดีเซล" in lower or "diesel" in lower:
        d_item = next((p for p in prices if "ดีเซล" in p.get("name", "")), None)
        if d_item:
            highlight = f"⛽ **ราคาน้ำมันดีเซลวันนี้: {d_item['price']} บาท/ลิตร**\n\n"
    elif "95" in lower:
        g_item = next((p for p in prices if "95" in p.get("name", "") and "แก๊ส" in p.get("name", "")), None)
        if g_item:
            highlight = f"⛽ **ราคาน้ำมันแก๊สโซฮอล์ 95 วันนี้: {g_item['price']} บาท/ลิตร**\n\n"
    elif "91" in lower:
        g_item = next((p for p in prices if "91" in p.get("name", "")), None)
        if g_item:
            highlight = f"⛽ **ราคาน้ำมันแก๊สโซฮอล์ 91 วันนี้: {g_item['price']} บาท/ลิตร**\n\n"
    elif "e20" in lower:
        g_item = next((p for p in prices if "e20" in p.get("name", "").lower()), None)
        if g_item:
            highlight = f"⛽ **ราคาน้ำมันแก๊สโซฮอล์ E20 วันนี้: {g_item['price']} บาท/ลิตร**\n\n"

    lines = [f"• **{p['name']}**: {p['price']} บาท/ลิตร" for p in prices]
    price_list_str = "\n".join(lines)

    status_str = "ราคาคงที่ ยังไม่มีการปรับเปลี่ยนในรอบ 24 ชั่วโมง" if "คงที่" in status or status == "ปกติ" else status

    return (
        f"{highlight}⛽ **สรุปราคาน้ำมันขายปลีกวันนี้ (บางจาก / ราคามาตรฐาน):**\n\n"
        f"{price_list_str}\n\n"
        f"ℹ️ **สถานะราคา**: {status_str} (อัปเดต: {update_date})\n"
        f"🚗 สามารถแวะเติมพลังงานได้ที่สถานีบริการน้ำมันใกล้คุณครับ"
    )


def format_weather_reply(weather: Dict[str, Any]) -> str:
    """Format rich, detailed weather and air quality response."""
    temp = weather.get("temp", 31)
    cond = weather.get("condition", "ท้องฟ้าแจ่มใส มีเมฆบางส่วน")
    pm25 = weather.get("pm25", 16)

    try:
        pm_val = float(pm25)
        if pm_val <= 15:
            pm_status = "คุณภาพอากาศดีมาก (สีฟ้า)"
        elif pm_val <= 25:
            pm_status = "คุณภาพอากาศดี ปลอดภัย (สีเขียว)"
        elif pm_val <= 37.5:
            pm_status = "คุณภาพอากาศปานกลาง (สีเหลือง)"
        else:
            pm_status = "เริ่มมีผลกระทบต่อสุขภาพ (สีส้ม) ควรใส่หน้ากากอนามัย"
    except (ValueError, TypeError):
        pm_status = "อยู่ในเกณฑ์ปกติ"

    return (
        f"🌤️ **รายงานสภาพอากาศและสิ่งแวดล้อมวันนี้:**\n\n"
        f"• **อุณหภูมิ**: {temp}°C (รู้สึกเหมือน {int(temp) + 2 if isinstance(temp, (int, float)) else 33}°C)\n"
        f"• **สภาพอากาศ**: {cond}\n"
        f"• **คุณภาพอากาศ (PM2.5)**: {pm25} µg/m³ ({pm_status})\n"
        f"• **โอกาสเกิดฝน**: 20% (อาจมีฝนฟ้าคะนองบางแห่งช่วงบ่ายถึงค่ำ)\n\n"
        f"💡 **คำแนะนำ**: ช่วงกลางวันแดดค่อนข้างแรง แนะนำดื่มน้ำสม่ำเสมอ และพกร่มเผื่อฝนตกช่วงค่ำครับ ☂️"
    )


def format_market_reply(market: Dict[str, Any]) -> str:
    """Format SET Index and currency exchange rates."""
    set_index = market.get("setIndex", 1450.20)
    set_change = market.get("setChange", 4.20)
    usd = market.get("usdRate", 35.80)

    try:
        chg = float(set_change)
        sign = "+" if chg >= 0 else ""
        direction = "ปรับตัวขึ้นในแดนบวก" if chg >= 0 else "ปรับตัวลดลง"
    except (ValueError, TypeError):
        sign = ""
        direction = "ทรงตัว"

    return (
        f"📈 **สรุปภาวะตลาดการเงินและดัชนี SET วันนี้:**\n\n"
        f"• **ดัชนี SET Index**: {set_index} จุด ({sign}{set_change} จุด)\n"
        f"• **อัตราแลกเปลี่ยน (USD/THB)**: {usd} บาท/ดอลลาร์\n"
        f"• **ทิศทางตลาด**: ดัชนี{direction} มีแรงซื้อหมุนเวียนในกลุ่มพลังงานและค้าปลีก\n\n"
        f"📊 สามารถติดตามกราฟแนวโน้มและการคำนวณแบบเรียลไทม์ได้ในหน้า Dashboard ครับ"
    )


def format_summary_reply(context: Optional[Dict[str, Any]]) -> str:
    """Format comprehensive daily summary with task bullet list."""
    pending = context.get("pendingTasks", 0) if context else 0
    tasks: List[str] = context.get("tasks", []) if context else []

    task_block = ""
    if tasks:
        task_lines = "\n".join(f"{i + 1}. {t}" for i, t in enumerate(tasks[:5]))
        task_block = f"\n\n**รายการงานที่ค้างอยู่ขณะนี้:**\n{task_lines}"

    return (
        f"📋 **สรุปภาพรวมการทำงานวันนี้:**\n\n"
        f"• **งานค้างในระบบ**: มีงานที่ยังไม่ได้ทำ {pending} รายการ{task_block}\n"
        f"• **ข้อมูลภายนอก**: ราคาน้ำมันและสภาพอากาศปกติ พร้อมสำหรับการเดินทางและการทำงาน\n\n"
        f"✨ พิมพ์ *'จดโน้ตว่า...'* หรือ *'เตือนว่า...'* เพื่อเพิ่มรายการใหม่ได้ทันทีครับ"
    )


def parse_builtin_intent(message: str, context: Optional[Dict[str, Any]] = None) -> AIChatResponse:
    """Smart built-in Thai intent parser for workspace automation."""
    text = message.strip()
    lower = text.lower()

    # 1. Note creation intent: "จดโน้ต...", "บันทึกว่า...", "จดว่า..."
    note_match = re.search(r"(?:จดโน้ต(?:ว่า)?|บันทึก(?:ว่า)?|จดว่า|ช่วยจด(?:ว่า)?)\s*(.+)", text, re.IGNORECASE)
    if note_match:
        content = note_match.group(1).strip()
        if content:
            return AIChatResponse(
                reply=f"จดบันทึกให้เรียบร้อยแล้วครับ: \"{content}\" ✨",
                action=AIAction(type="add_note", data={"text": content}),
            )

    # 2. Reminder creation intent: "เตือนว่า...", "ช่วยเตือน...", "นัดหมาย..."
    reminder_match = re.search(
        r"(?:เตือน(?:ว่า)?|ช่วยเตือน(?:ว่า)?|ตั้งเตือน(?:ว่า)?|นัดหมาย(?:ว่า)?)\s*(.+)",
        text,
        re.IGNORECASE,
    )
    if reminder_match:
        content = reminder_match.group(1).strip()
        if content:
            return AIChatResponse(
                reply=f"สร้างรายการเตือนความจำ: \"{content}\" ให้เรียบร้อยแล้วครับ ⏰",
                action=AIAction(type="add_reminder", data={"title": content, "kind": "errand"}),
            )

    # 3. Oil price inquiry
    if any(k in lower for k in ["น้ำมัน", "ราคาน้ำมัน", "ดีเซล", "แก๊สโซฮอล์", "เบนซิน", "e20", "e85"]):
        oil = resolve_oil_data(context)
        return AIChatResponse(reply=format_oil_reply(text, oil))

    # 4. Weather inquiry
    if any(k in lower for k in ["อากาศ", "สภาพอากาศ", "ฝนตก", "ร้อน", "pm2.5", "ฝุ่น"]):
        weather = context.get("weather", {}) if context else {}
        return AIChatResponse(reply=format_weather_reply(weather))

    # 5. Market / Finance inquiry
    if any(k in lower for k in ["หุ้น", "ดัชนี", "set", "ตลาดการเงิน", "ดอลลาร์", "usd"]):
        market = context.get("market", {}) if context else {}
        return AIChatResponse(reply=format_market_reply(market))

    # 6. Summary / Tasks inquiry
    if any(k in lower for k in ["สรุป", "ภาพรวม", "งานค้าง", "มีงานอะไร", "สิ่งที่ต้องทำ", "todo", "to-do"]):
        return AIChatResponse(reply=format_summary_reply(context))

    # 7. Greetings
    if any(k in lower for k in ["สวัสดี", "หวัดดี", "hello", "hi", "hey"]):
        return AIChatResponse(
            reply=(
                "สวัสดีครับ! ผมคือ AI Copilot ผู้ช่วยประจำพื้นที่ทำงานของคุณ "
                "สามารถสอบถามราคาน้ำมันวันนี้, รายงานสภาพอากาศ, สรุปงานค้าง "
                "หรือสั่งให้ผม 'จดโน้ตว่า...' ได้ทันทีครับ 😊"
            ),
        )

    # 8. Help / Capabilities
    if any(k in lower for k in ["ช่วยอะไรได้บ้าง", "ทำอะไรได้บ้าง", "คำสั่ง", "help"]):
        return AIChatResponse(
            reply="คุณสามารถพิมพ์สั่งงานผมได้ดังนี้ครับ:\n"
                  "• 'ราคาน้ำมันวันนี้' / 'ดีเซลเท่าไหร่' — ตรวจสอบราคาน้ำมันขายปลีกทุกประเภท\n"
                  "• 'สภาพอากาศวันนี้' — รายงานอุณหภูมิและค่าฝุ่น PM2.5\n"
                  "• 'สรุปงานวันนี้' — แสดงรายการงานที่ค้างและต้องทำ\n"
                  "• 'จดโน้ตว่า [ข้อความ]' — บันทึกข้อความลง Quick Notes ทันที\n"
                  "• 'เตือนว่า [ข้อความ]' — ตั้งเตือนความจำลงระบบ Reminders",
        )

    # Default fallback
    return AIChatResponse(
        reply=(
            f"รับทราบครับ \"{text}\" มีสิ่งใดในพื้นที่ทำงานนี้ที่ต้องการให้ผมช่วยจดโน้ต "
            "ตั้งเตือนความจำ ตรวจสอบราคาน้ำมัน หรือสรุปภาพรวม แจ้งได้เสมอครับ!"
        ),
    )


@dataclass(frozen=True)
class AIProvider:
    """A configured chat provider. ``name == "none"`` means the local engine."""

    name: str
    api_key: str = ""
    base_url: str = ""
    model: str = ""


def _provider_from_user(user: User) -> Optional[AIProvider]:
    """The account's own provider, or ``None`` when it has not configured one."""
    name = (getattr(user, "ai_provider", None) or "").strip().lower()
    key = decrypt_secret(getattr(user, "ai_api_key_enc", None))
    if not name or not key:
        return None
    model = (getattr(user, "ai_model", None) or "").strip()
    if name == "gemini":
        return AIProvider(
            "gemini", key, model=model or (settings.GEMINI_MODEL or DEFAULT_GEMINI_MODEL).strip()
        )
    if name == "openai":
        base = (
            getattr(user, "ai_base_url", None) or settings.AI_BASE_URL or DEFAULT_OPENAI_BASE_URL
        ).strip().rstrip("/")
        return AIProvider(
            "openai", key, base_url=base, model=model or (settings.AI_MODEL or DEFAULT_OPENAI_MODEL).strip()
        )
    return None


def resolve_ai_provider(user: Optional[User] = None) -> AIProvider:
    """Pick the configured provider without ever inventing a key.

    A personal key saved from the profile page wins, so each account can bring
    its own provider. Without one, the deployment-wide env key is used: ``auto``
    prefers Gemini (the key this project already documents) and falls back to an
    OpenAI-compatible endpoint.
    """
    if user is not None:
        personal = _provider_from_user(user)
        if personal is not None:
            return personal

    provider = (settings.AI_PROVIDER or "auto").strip().lower()
    gemini_key = (settings.GEMINI_API_KEY or "").strip()
    generic_key = (settings.AI_API_KEY or "").strip()

    if provider in ("auto", "gemini") and gemini_key:
        model = (settings.GEMINI_MODEL or DEFAULT_GEMINI_MODEL).strip()
        return AIProvider("gemini", gemini_key, model=model)

    if provider in ("auto", "openai") and generic_key:
        base = (settings.AI_BASE_URL or DEFAULT_OPENAI_BASE_URL).strip().rstrip("/")
        model = (settings.AI_MODEL or DEFAULT_OPENAI_MODEL).strip()
        return AIProvider("openai", generic_key, base_url=base, model=model)

    return AIProvider("none")


def _conversation(
    prompt: str, history: Optional[List[ChatTurn]]
) -> List[tuple[str, str]]:
    """History plus the new message, with empty turns skipped."""
    turns: List[tuple[str, str]] = []
    for turn in (history or [])[-AI_HISTORY_LIMIT:]:
        text = (turn.text or "").strip()
        if text:
            turns.append((turn.role, text))
    turns.append(("user", prompt))
    return turns


def build_system_prompt(context: Optional[Dict[str, Any]]) -> str:
    """Instructions for a general assistant that is grounded on workspace facts.

    The first revision said "quote numbers only from the workspace context",
    which the model read as "answer nothing else": asking for a pad thai recipe
    came back as "no data in the workspace", so a working key looked broken.
    The two modes below keep workspace figures honest without gagging the model.
    """
    today = datetime.datetime.now(BANGKOK).date().strftime("%Y-%m-%d")
    payload = json.dumps(context or {}, ensure_ascii=False)
    return (
        "You are the AI Copilot of a Thai personal and team productivity "
        "workspace. Answer in Thai unless the user writes in another language. "
        "Be concise, practical and friendly, and use short bullet lines when "
        "listing values. You work in two modes and pick one per message: "
        "(1) General assistant — for anything outside this workspace (knowledge, "
        "explanations, advice, ideas, writing, code) answer from your own "
        "knowledge, fully and helpfully; never refuse because the workspace "
        "context does not mention the topic. "
        "(2) Workspace grounding — for questions about this workspace (tasks, "
        "notes, weather, oil price, income and expenses, market) read the JSON "
        "context below and quote its numbers exactly; do not invent a workspace "
        "figure, and if a value is missing, say you do not have it and say where "
        "the user can look instead of guessing. "
        "Reply in plain text without Markdown symbols. "
        f"Today is {today}. Workspace context (JSON): {payload}"
    )


async def _post_json(url: str, payload: dict, headers: dict) -> Optional[dict]:
    try:
        async with httpx.AsyncClient(timeout=AI_REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.post(url, json=payload, headers=headers)
    except Exception as exc:  # network error, DNS, timeout
        logger.warning("AI provider request failed: %s", exc)
        return None

    if response.status_code != 200:
        # Truncated body: enough to diagnose a 401/429/model-retired error
        # without dumping a whole provider response into the logs.
        logger.warning(
            "AI provider returned HTTP %s: %s",
            response.status_code,
            response.text[:300],
        )
        return None

    try:
        return response.json()
    except ValueError:
        logger.warning("AI provider returned a non-JSON body")
        return None


async def call_gemini_api(
    provider: AIProvider,
    prompt: str,
    context: Optional[Dict[str, Any]],
    history: Optional[List[ChatTurn]] = None,
) -> Optional[str]:
    """Call Gemini's generateContent endpoint with the chat history."""
    contents = [
        {
            "role": "model" if role == "assistant" else "user",
            "parts": [{"text": text}],
        }
        for role, text in _conversation(prompt, history)
    ]
    payload = {
        "contents": contents,
        "systemInstruction": {"parts": [{"text": build_system_prompt(context)}]},
        "generationConfig": {
            "temperature": 0.6,
            "maxOutputTokens": AI_MAX_OUTPUT_TOKENS,
        },
    }

    # The key travels in a header, not the query string: query strings are
    # written to access logs, proxies and Sentry breadcrumbs.
    data = await _post_json(
        GEMINI_ENDPOINT.format(model=provider.model),
        payload,
        {"x-goog-api-key": provider.api_key},
    )
    if not data:
        return None

    candidates = data.get("candidates") or []
    if not candidates:
        return None
    parts = candidates[0].get("content", {}).get("parts") or []
    if not parts or "text" not in parts[0]:
        return None
    return str(parts[0]["text"]).strip() or None


async def call_openai_compatible_api(
    provider: AIProvider,
    prompt: str,
    context: Optional[Dict[str, Any]],
    history: Optional[List[ChatTurn]] = None,
) -> Optional[str]:
    """Call any OpenAI-compatible ``/chat/completions`` endpoint."""
    messages: List[Dict[str, str]] = [
        {"role": "system", "content": build_system_prompt(context)}
    ]
    messages.extend(
        {"role": role, "content": text} for role, text in _conversation(prompt, history)
    )
    payload = {
        "model": provider.model,
        "messages": messages,
        "temperature": 0.6,
        "max_tokens": AI_MAX_OUTPUT_TOKENS,
    }
    data = await _post_json(
        f"{provider.base_url}/chat/completions",
        payload,
        {"Authorization": f"Bearer {provider.api_key}"},
    )
    if not data:
        return None

    choices = data.get("choices") or []
    if not choices:
        return None
    message = choices[0].get("message") or {}
    content = message.get("content")
    return str(content).strip() if content else None


async def call_ai_model(
    provider: AIProvider,
    prompt: str,
    context: Optional[Dict[str, Any]],
    history: Optional[List[ChatTurn]] = None,
) -> Optional[str]:
    if provider.name == "gemini":
        return await call_gemini_api(provider, prompt, context, history)
    if provider.name == "openai":
        return await call_openai_compatible_api(provider, prompt, context, history)
    return None


class AISettingsUpdate(BaseModel):
    """A provider the account wants the copilot to use.

    ``api_key`` is write-only: it is encrypted before storage and never appears
    in a response. Leaving it empty keeps the key that is already saved, so the
    other fields can be edited without re-typing the secret.
    """

    provider: Literal["gemini", "openai"]
    api_key: Optional[str] = Field(None, max_length=500)
    base_url: Optional[str] = Field(None, max_length=500)
    model: Optional[str] = Field(None, max_length=100)


def _ai_settings_data(user: User) -> Dict[str, Any]:
    """Public view of the account's AI settings — booleans, never the key."""
    personal_key = decrypt_secret(getattr(user, "ai_api_key_enc", None))
    saved_provider = (getattr(user, "ai_provider", None) or "").strip().lower()
    server = resolve_ai_provider()

    if personal_key and saved_provider:
        source = "user"
    elif server.name != "none":
        source = "server"
    else:
        source = "none"

    provider_name = saved_provider or (server.name if server.name != "none" else "gemini")
    base_url = getattr(user, "ai_base_url", None) or ""
    saved_model = getattr(user, "ai_model", None) or ""

    # What the next chat reply will actually use, even when the account left the
    # model empty and the deployment default applies.
    if saved_model:
        effective_model = saved_model
    elif source == "server" and server.model:
        effective_model = server.model
        base_url = base_url or server.base_url
    elif provider_name == "gemini":
        effective_model = (settings.GEMINI_MODEL or DEFAULT_GEMINI_MODEL).strip()
    else:
        effective_model = (settings.AI_MODEL or DEFAULT_OPENAI_MODEL).strip()

    return {
        "provider": provider_name,
        "provider_label": provider_label(provider_name, base_url),
        "has_key": bool(personal_key),
        "base_url": base_url,
        "model": saved_model,
        "effective_model": effective_model,
        "source": source,
    }


class AIDetectRequest(BaseModel):
    """A key the user is pasting, before it is saved anywhere."""

    api_key: str = Field(min_length=8, max_length=500)


async def _list_provider_models(provider: str, api_key: str, base_url: str) -> List[str]:
    """Ask the provider which chat models this key can use.

    Best effort by design: an unreachable or unhelpful listing endpoint must not
    block saving the connection, so the caller falls back to its own presets.
    """
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            if provider == "gemini":
                response = await client.get(GEMINI_MODELS_ENDPOINT, params={"key": api_key})
            else:
                response = await client.get(
                    f"{base_url.rstrip('/')}/models",
                    headers={"Authorization": f"Bearer {api_key}"},
                )
    except Exception as exc:  # network error, DNS, timeout
        logger.warning("AI model listing failed: %s", exc)
        return []

    if response.status_code != 200:
        logger.warning("AI model listing returned HTTP %s", response.status_code)
        return []

    try:
        payload = response.json()
    except Exception:
        return []

    if provider == "gemini":
        names: List[str] = []
        for item in payload.get("models") or []:
            name = str(item.get("name") or "").replace("models/", "", 1)
            methods = item.get("supportedGenerationMethods") or []
            if name and "generateContent" in methods and not _is_non_chat_model(name):
                names.append(name)
        return names[:AI_MODEL_LIST_LIMIT]

    return [
        str(item["id"])
        for item in (payload.get("data") or [])
        if isinstance(item, dict)
        and item.get("id")
        and not _is_non_chat_model(str(item["id"]))
    ][:AI_MODEL_LIST_LIMIT]


def _is_non_chat_model(model_id: str) -> bool:
    """True for models that cannot answer a chat message."""
    lowered = model_id.lower()
    return any(hint in lowered for hint in NON_CHAT_MODEL_HINTS)


def suggested_model(provider: str, models: List[str]) -> str:
    """Cheapest sensible default: a flash model for Gemini, a mini otherwise.

    Stable ids win over ``-preview`` ones: a preview id is what a user is most
    likely to lose access to later, and the suggestion is the model that will
    answer their chats from now on.
    """
    if not models:
        return DEFAULT_GEMINI_MODEL if provider == "gemini" else ""
    usable = [model for model in models if not _is_non_chat_model(model)] or models
    stable = [model for model in usable if "preview" not in model.lower()]
    for needle in ("flash", "mini", "instant", "turbo", "chat"):
        for model in stable or usable:
            if needle in model.lower():
                return model
    return (stable or usable)[0]


@router.post("/settings/detect")
@limiter.limit(_AI_LIMIT)
async def detect_ai_settings(
    request: Request,
    payload: AIDetectRequest,
    current_user: User = Depends(get_current_user),
):
    """Name the provider behind a pasted key and list its chat models.

    Lets the profile form fill provider, base URL and model by itself instead of
    asking the user to translate a key prefix into a dropdown choice.
    """
    detected = detect_ai_key(payload.api_key)
    if detected is None:
        raise HTTPException(
            status_code=422,
            detail="ไม่รู้จักรูปแบบคีย์นี้ — เลือกผู้ให้บริการเองแล้วกดบันทึกได้เลย",
        )

    if detected["provider"] == "unsupported":
        raise HTTPException(
            status_code=422,
            detail=(
                f"คีย์ {detected['label']} ยังใช้กับแชทนี้ไม่ได้โดยตรง "
                "— ใช้ OpenRouter เป็นตัวกลางแทน"
            ),
        )

    models = await _list_provider_models(
        detected["provider"], payload.api_key.strip(), detected["base_url"]
    )
    return {
        "result": "success",
        "data": {
            "provider": detected["provider"],
            "base_url": detected["base_url"],
            "label": detected["label"],
            "models": models,
            "model": suggested_model(detected["provider"], models),
        },
    }


@router.get("/settings")
@limiter.limit(_AI_LIMIT)
async def get_ai_settings(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """What this account has configured, plus whether a server key is available."""
    return {"result": "success", "data": _ai_settings_data(current_user)}


@router.put("/settings")
@limiter.limit(_AI_LIMIT)
async def update_ai_settings(
    request: Request,
    payload: AISettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save a personal provider so only this account's chats use that key."""
    provider_name = payload.provider
    api_key = (payload.api_key or "").strip()
    base_url = (payload.base_url or "").strip().rstrip("/")
    model = (payload.model or "").strip()
    has_stored_key = bool(decrypt_secret(current_user.ai_api_key_enc))

    if not api_key and not has_stored_key:
        raise HTTPException(status_code=400, detail="กรุณากรอก API Key ของผู้ให้บริการ")
    if api_key and len(api_key) < 8:
        raise HTTPException(status_code=400, detail="API Key สั้นเกินไป")

    if provider_name == "openai":
        base_url = base_url or (settings.AI_BASE_URL or DEFAULT_OPENAI_BASE_URL).rstrip("/")
        if not settings.DEBUG and not base_url.startswith("https://"):
            raise HTTPException(status_code=400, detail="Base URL ต้องขึ้นต้นด้วย https://")
        # The base URL is user-supplied and the server calls it: reject loopback
        # and private addresses so it cannot probe the deployment's network.
        try:
            await ensure_public_http_url(base_url)
        except UnsafeURLError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        model = model or (settings.AI_MODEL or DEFAULT_OPENAI_MODEL).strip()
    else:
        base_url = ""
        model = model or (settings.GEMINI_MODEL or DEFAULT_GEMINI_MODEL).strip()

    if api_key:
        current_user.ai_api_key_enc = encrypt_secret(api_key)
    current_user.ai_provider = provider_name
    current_user.ai_base_url = base_url or None
    current_user.ai_model = model or None
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)

    return {
        "result": "success",
        "message": "บันทึกการเชื่อมต่อ AI เรียบร้อยแล้ว",
        "data": _ai_settings_data(current_user),
    }


@router.delete("/settings")
@limiter.limit(_AI_LIMIT)
async def delete_ai_settings(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove the personal key; chats fall back to the server configuration."""
    current_user.ai_provider = None
    current_user.ai_api_key_enc = None
    current_user.ai_base_url = None
    current_user.ai_model = None
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return {
        "result": "success",
        "message": "ลบการเชื่อมต่อ AI ของบัญชีนี้แล้ว",
        "data": _ai_settings_data(current_user),
    }


@router.post("/settings/test")
@limiter.limit(_AI_LIMIT)
async def test_ai_settings(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Send one tiny prompt so the user knows the key and model actually work."""
    provider = resolve_ai_provider(current_user)
    if provider.name == "none":
        raise HTTPException(status_code=400, detail="ยังไม่ได้ตั้งค่าผู้ให้บริการ AI")

    reply = await call_ai_model(provider, "ตอบคำว่า OK เท่านั้น", None, None)
    if not reply:
        raise HTTPException(
            status_code=502,
            detail="เชื่อมต่อผู้ให้บริการไม่สำเร็จ ตรวจสอบ API Key, Model และ Base URL อีกครั้ง",
        )
    return {
        "result": "success",
        "message": f"เชื่อมต่อ {provider_label(provider.name, provider.base_url)} สำเร็จ (โมเดล {provider.model})",
        "data": {
            "provider": provider.name,
            "model": provider.model,
            "preview": reply[:160],
        },
    }


@router.post("/chat", response_model=AIChatResponse)
@limiter.limit(_AI_LIMIT)
async def ai_chat(
    request: Request,
    payload: AIChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Interactive AI chat endpoint.

    Uses Gemini if GEMINI_API_KEY is configured; otherwise processes with
    the built-in smart intent parser for immediate zero-config action execution.
    """
    message = payload.message.strip()
    if not message:
        return AIChatResponse(reply="สวัสดีครับ มีอะไรให้ผมช่วยไหมครับ?")

    # 1. Workspace actions run locally: "จดโน้ตว่า…" / "เตือนว่า…" must work the
    #    same with or without a key, and the reply carries the action payload.
    parsed = parse_builtin_intent(message, payload.context)
    if parsed.action is not None:
        return parsed

    # 2. A connected model answers everything else first.
    #    The built-in parser used to run before the model, so the most common
    #    questions ("สรุปงานวันนี้", "ราคาน้ำมัน") returned the same canned text
    #    whether or not a key was saved — which is why a connected key felt like
    #    it changed nothing. The context below still carries the real numbers,
    #    and the prompt forbids inventing values the model was not given.
    provider = resolve_ai_provider(current_user)
    if provider.name != "none":
        # A per-IP limiter does nothing for a deployment key: the same account can
        # rotate addresses, and every call spends the owner's credits. Reserve one
        # message from this account's daily budget first.
        allowed, used = await claim_daily_request(
            db, current_user.id, settings.AI_DAILY_MESSAGE_LIMIT
        )
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail=(
                    f"ใช้โควตา AI ของวันนี้ครบ {used} ข้อความแล้ว "
                    "โควตาจะรีเซ็ตเที่ยงคืนตามเวลา UTC"
                ),
            )
        reply = await call_ai_model(provider, message, payload.context, payload.history)
        if reply:
            return AIChatResponse(
                reply=reply,
                provider=provider_label(provider.name, provider.base_url),
                model=provider.model,
            )

        # The key is saved but this call failed (wrong model id, expired key,
        # quota, network). Answer anyway, and flag it so the drawer can point at
        # the AI settings instead of silently looking "not very smart".
        logger.warning(
            "AI provider %s/%s failed; answering with the built-in engine",
            provider.name,
            provider.model,
        )
        fallback = parse_builtin_intent(message, payload.context)
        fallback.degraded = True
        return fallback

    # 3. No key configured: the built-in engine is the answer, by design.
    return parsed
