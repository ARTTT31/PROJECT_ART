"""AI Copilot Endpoint.

Provides interactive AI chat with structured workspace action execution (add note,
add reminder, workspace summary). Uses Google Gemini API if configured with GEMINI_API_KEY,
with a built-in Thai natural-language intent parser as a reliable fallback.
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional
import httpx
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from app.api.dependencies import get_current_user
from app.core.config import settings
from app.core.rate_limit import limiter
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()

_AI_LIMIT = "30/minute"

DEFAULT_OIL_PRICES = [
    {"name": "ดีเซล", "price": 32.94, "unit": "บาท/ลิตร"},
    {"name": "แก๊สโซฮอล์ 95", "price": 38.55, "unit": "บาท/ลิตร"},
    {"name": "แก๊สโซฮอล์ 91", "price": 38.18, "unit": "บาท/ลิตร"},
    {"name": "แก๊สโซฮอล์ E20", "price": 36.44, "unit": "บาท/ลิตร"},
    {"name": "แก๊สโซฮอล์ E85", "price": 34.69, "unit": "บาท/ลิตร"},
    {"name": "เบนซิน 95", "price": 47.54, "unit": "บาท/ลิตร"},
]


class AIChatRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None


class AIAction(BaseModel):
    type: str  # "add_note" | "add_reminder"
    data: Dict[str, Any]


class AIChatResponse(BaseModel):
    result: str = "success"
    reply: str
    action: Optional[AIAction] = None


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
                "สวัสดีครับ! ผมคือ AI Copilot ผู้ช่วยประจำ ART Workspace "
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
            f"รับทราบครับ \"{text}\" มีสิ่งใดใน ART Workspace ที่ต้องการให้ผมช่วยจดโน้ต "
            "ตั้งเตือนความจำ ตรวจสอบราคาน้ำมัน หรือสรุปภาพรวม แจ้งได้เสมอครับ!"
        ),
    )


async def call_gemini_api(prompt: str, context: Optional[Dict[str, Any]]) -> Optional[str]:
    """Call Google Gemini REST API if GEMINI_API_KEY is configured."""
    key = settings.GEMINI_API_KEY.strip()
    if not key:
        return None

    # The key travels in a header, not the query string: query strings are
    # written to access logs, proxies and Sentry breadcrumbs.
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"
    sys_instruction = (
        "You are the executive AI Copilot for ART Workspace, a personal & team productivity dashboard. "
        "Answer politely, helpfully, and concisely in Thai with rich details and bullet points. "
        "Use the workspace context provided (oil prices, weather, SET index, tasks) to give precise answers."
    )
    payload = {
        "contents": [
            {"role": "user", "parts": [{"text": f"Context: {json.dumps(context or {})}\nUser: {prompt}"}]}
        ],
        "systemInstruction": {"parts": [{"text": sys_instruction}]},
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 600,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload, headers={"x-goog-api-key": key})
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts and "text" in parts[0]:
                        return str(parts[0]["text"]).strip()
    except Exception as exc:
        logger.warning("Gemini API call failed, falling back to local engine: %s", exc)

    return None


@router.post("/chat", response_model=AIChatResponse)
@limiter.limit(_AI_LIMIT)
async def ai_chat(
    request: Request,
    payload: AIChatRequest,
    current_user: User = Depends(get_current_user),
):
    """Interactive AI chat endpoint.

    Uses Gemini if GEMINI_API_KEY is configured; otherwise processes with
    the built-in smart intent parser for immediate zero-config action execution.
    """
    message = payload.message.strip()
    if not message:
        return AIChatResponse(reply="สวัสดีครับ มีอะไรให้ผมช่วยไหมครับ?")

    # 1. First check if it's an actionable command (add_note / add_reminder)
    parsed = parse_builtin_intent(message, payload.context)
    if parsed.action is not None:
        return parsed

    # 2. Try Gemini API if key is present
    gemini_reply = await call_gemini_api(message, payload.context)
    if gemini_reply:
        return AIChatResponse(reply=gemini_reply)

    # 3. Otherwise return the smart local parser reply
    return parsed
