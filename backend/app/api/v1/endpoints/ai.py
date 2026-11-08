"""AI Copilot Endpoint.

Provides interactive AI chat with structured workspace action execution (add note,
add reminder, workspace summary). Uses Google Gemini API if configured with GEMINI_API_KEY,
with a built-in Thai natural-language intent parser as a reliable fallback.
"""

import json
import logging
import re
from typing import Any, Dict, Optional
import httpx
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.api.dependencies import get_current_user
from app.core.config import settings
from app.models.user import User

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter()

_AI_LIMIT = "30/minute"


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
    reminder_match = re.search(r"(?:เตือน(?:ว่า)?|ช่วยเตือน(?:ว่า)?|ตั้งเตือน(?:ว่า)?|นัดหมาย(?:ว่า)?)\s*(.+)", text, re.IGNORECASE)
    if reminder_match:
        content = reminder_match.group(1).strip()
        if content:
            return AIChatResponse(
                reply=f"สร้างรายการเตือนความจำ: \"{content}\" ให้เรียบร้อยแล้วครับ ⏰",
                action=AIAction(type="add_reminder", data={"title": content, "kind": "errand"}),
            )

    # 3. Oil price inquiry
    if any(k in lower for k in ["น้ำมัน", "ราคาน้ำมัน", "ดีเซล", "แก๊สโซฮอล์"]):
        oil_info = ""
        if context and "oil" in context:
            oil = context["oil"]
            oil_info = f" (ดีเซล {oil.get('diesel', '-')} บาท / แก๊สโซฮอล์ 95 {oil.get('gasohol95', '-')} บาท สถานะ: {oil.get('status', 'ปกติ')})"
        return AIChatResponse(
            reply=f"ราคาน้ำมันขายปลีกในไทยล่าสุด{oil_info} ยังคงเปิดให้บริการตามปกติครับ หากมีแผนเดินทางสามารถแวะเติมพลังงานได้เลยครับ ⛽",
        )

    # 4. Weather inquiry
    if any(k in lower for k in ["อากาศ", "สภาพอากาศ", "ฝนตก", "ร้อน", "pm2.5", "ฝุ่น"]):
        weather_info = ""
        if context and "weather" in context:
            w = context["weather"]
            weather_info = f" อุณหภูมิประมาณ {w.get('temp', 31)}°C สภาพ: {w.get('condition', 'แจ่มใส')} ค่า PM2.5: {w.get('pm25', 'ปกติ')}"
        return AIChatResponse(
            reply=f"รายงานสภาพอากาศวันนี้:{weather_info} มีลมพัดสบายตลอดวัน แนะนำพกร่มเผื่อฝนตกช่วงบ่ายถึงค่ำครับ 🌤️",
        )

    # 5. Summary / Tasks inquiry
    if any(k in lower for k in ["สรุป", "ภาพรวม", "งานค้าง", "มีงานอะไร", "สิ่งที่ต้องทำ", "todo", "to-do"]):
        pending = context.get("pendingTasks", 0) if context else 0
        return AIChatResponse(
            reply=f"สรุปภาพรวมวันนี้: ปัจจุบันมีงานที่ค้างอยู่ในระบบ {pending} รายการ ข้อมูลสภาพอากาศและตลาดอยู่ในเกณฑ์ปกติ พร้อมให้คุณเริ่มงานได้อย่างมีประสิทธิภาพครับ 📋",
        )

    # 6. Greetings
    if any(k in lower for k in ["สวัสดี", "หวัดดี", "hello", "hi", "hey"]):
        return AIChatResponse(
            reply="สวัสดีครับ! ผมคือ AI Copilot ผู้ช่วยส่วนตัวประจำ ART Workspace สามารถสั่งให้ผมช่วยสรุปงานค้าง, เช็คราคาน้ำมัน, หรือพิมพ์ว่า 'จดโน้ตว่า...' เพื่อให้ผมช่วยจดบันทึกได้ทันทีครับ 😊",
        )

    # 7. Help / Capabilities
    if any(k in lower for k in ["ช่วยอะไรได้บ้าง", "ทำอะไรได้บ้าง", "คำสั่ง", "help"]):
        return AIChatResponse(
            reply="คุณสามารถพิมพ์สั่งงานผมได้ดังนี้ครับ:\n"
                  "• 'จดโน้ตว่า [ข้อความ]' — บันทึกข้อความลง Quick Notes\n"
                  "• 'เตือนว่า [ข้อความ]' — บันทึกเตือนความจำลง Reminders\n"
                  "• 'สรุปงานวันนี้' — สรุปภาพรวมและงานค้างทั้งหมด\n"
                  "• 'เช็คราคาน้ำมัน' / 'สภาพอากาศ' — รายงานข้อมูลประจำวัน",
        )

    # Default fallback
    return AIChatResponse(
        reply=f"รับทราบครับ \"{text}\" มีสิ่งใดใน ART Workspace ที่ต้องการให้ผมช่วยจดโน้ต ตั้งเตือนความจำ หรือสรุปข้อมูลเพิ่มเติม แจ้งได้เสมอครับ!",
    )


async def call_gemini_api(prompt: str, context: Optional[Dict[str, Any]]) -> Optional[str]:
    """Call Google Gemini REST API if GEMINI_API_KEY is configured."""
    key = settings.GEMINI_API_KEY.strip()
    if not key:
        return None

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={key}"
    sys_instruction = (
        "You are the executive AI Copilot for ART Workspace, a personal & team productivity dashboard. "
        "Answer politely, helpfully, and concisely in Thai. You can help users with tasks, schedules, "
        "and daily briefings."
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
            resp = await client.post(url, json=payload)
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
