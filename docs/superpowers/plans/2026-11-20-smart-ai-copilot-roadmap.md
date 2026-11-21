# Roadmap & Implementation Plan: Smart AI Copilot

> **Goal:** ปรับปรุงและยกระดับ AI Copilot จากระบบ Regex Fallback สู่ AI Assistant อัจฉริยะที่สามารถถาม-ตอบความรู้ทั่วไปได้รอบด้าน เชื่อมต่อกับ LLM ได้อย่างเสถียร และมีขีดความสามารถด้าน Function Calling ในการสั่งงานระบบได้ด้วยภาษาธรรมชาติ

**Architecture:**
- **Backend (`app/api/v1/endpoints/ai.py`)**: ปรับปรุง System Prompt ให้รองรับการถามตอบอิสระ, แก้ไข Model Default/Presets ให้ตรงกับความเป็นจริงของ API ปลายทาง, ยกระดับ Action Detection จาก Regex สู่ LLM Function Calling, และเพิ่มการจัดการ Error Feedback
- **Frontend (`AICopilotDrawer.tsx`, `AISettingsCard.tsx`)**: ปรับปรุง UI ให้แสดงสถานะการเชื่อมต่อชัดเจน, ปรับปรุงคำเตือน Degraded Mode, รองรับการแสดงผล Markdown จัดระเบียบข้อความให้อ่านง่าย, และเตรียมพร้อมสำหรับ Multi-turn Memory

**Tech Stack:** FastAPI, Pydantic v2, Google Gemini API, OpenAI-compatible API, Next.js 16, React 19, Tailwind CSS v4, Lucide React, Vitest, Pytest.

---

## 🧭 สรุป 4 ระยะของการพัฒนา (Roadmap Phases)

```
[ Phase 1: ปลดล็อกข้อจำกัด & ซ่อมจุดขัดข้อง (Quick Wins - 1-2 วัน) ]
  ├── 1.1 ปรับ System Prompt ใน ai.py ปลดล็อกให้ตอบคำถามทั่วไปได้
  ├── 1.2 แก้ Model Defaults (เปลี่ยน default จากชื่อที่ไม่มีจริง สู่ gemini-2.0-flash / gemini-1.5-flash)
  └── 1.3 ปรับปรุง Error & Degraded Diagnostics ใน Drawer ให้ผู้ใช้รู้ทันทีเมื่อคีย์มีปัญหา

[ Phase 2: ยกระดับเป็น Agentic Assistant ด้วย Function Calling (3-5 วัน) ]
  ├── 2.1 ใช้ LLM Tool/Function Calling แทน Regex matching
  ├── 2.2 เพิ่ม Tools: บันทึกรายรับ-รายจ่าย (Finance), ค้นหาบันทึกเก่า
  └── 2.3 รองรับ Rich Markdown Rendering ในหน้าต่างแชต

[ Phase 3: ขยายบริบทและความจำ (Context & Memory - 1 สัปดาห์) ]
  ├── 3.1 บันทึกประวัติการแชตใน LocalStorage / Session ไม่ให้หายเมื่อปิด Drawer
  └── 3.2 ขยาย Live Context ให้ครอบคลุมรายการการเงินย้อนหลังและปฏิทินนัดหมาย

[ Phase 4: ความสามารถระดับสูง (Advanced Intelligence - อนาคต) ]
  ├── 4.1 เปิดใช้งาน Google Search Grounding ดึงข้อมูลสดจากอินเทอร์เน็ต
  └── 4.2 รองรับ Multimodal (แนบรูปภาพสลิป/เอกสารเพื่อถาม-ตอบ)
```

---

## รายละเอียดแต่ละระยะ (Detailed Task Breakdown)

### 📌 Phase 1: ปลดล็อกข้อจำกัด & ซ่อมจุดขัดข้องทันที (Immediate Fixes)
*เป้าหมาย: แก้ปัญหา "ผูกคีย์แล้วยังไม่ฉลาด / ตอบอะไรไม่ได้" ให้ใช้งานได้จริง 100% ทันที*

#### Task 1.1: ปรับปรุง System Prompt ใน `backend/app/api/v1/endpoints/ai.py`
- **ปัญหาปัจจุบัน:** มีประโยค *"Quote numbers only from the workspace context below; if a value is missing, say you do not have it instead of guessing."* ทำให้โมเดลปฏิเสธการตอบคำถามทั่วไปรอบตัว
- **การแก้ไข:**
  - ปรับ System Prompt ให้มี 2 โหมดในตัว:
    1. **General Intelligence:** ตอบคำถามทั่วไป ให้คำปรึกษา วิเคราะห์ คิดไอเดีย เขียนโปรแกรม หรือคุยเล่นได้อย่างอิสระและฉลาด
    2. **Workspace Grounding:** หากผู้ใช้ถามเรื่องในระบบ (ราคาน้ำมัน, สภาพอากาศ, งานค้าง, รายรับ-รายจ่าย) ให้อ้างอิงจาก Context ที่ส่งไปให้
- **การทดสอบ:**
  - เพิ่ม Pytest ทดสอบว่าเมื่อถาม "ขอสูตรทำผัดไทย" หรือ "แนะนำวิธีประหยัดเงิน" โมเดลไม่ตอบว่า "ไม่มีข้อมูลใน workspace"

#### Task 1.2: ระบบตรวจสอบและเลือกโมเดลอัตโนมัติเมื่อวาง API Key (Auto Model Detection & Smart Selection)
- **วัตถุประสงค์:** ผู้ใช้วาง API Key ลงในช่องปุ๊บ ระบบต้องตรวจจับค่าย ค้นหารายชื่อโมเดลจริงที่ใช้ได้ และเลือกโมเดลที่ดีที่สุดให้อัตโนมัติ โดยผู้ใช้ไม่ต้องจำหรือพิมพ์ชื่อโมเดลเอง
- **ปัญหาปัจจุบัน:**
  - ค่าเริ่มต้น `DEFAULT_GEMINI_MODEL = "gemini-3.8-flash"` เป็นชื่อที่ไม่มีใน Google Generative Language API v1beta ส่งผลให้เกิด HTTP 404 แล้วดีดกลับไปใช้สคริปต์พื้นฐาน
  - เมื่อระบบตรวจพบโมเดลจาก API แล้ว กลับไม่มีปุ่มชิปให้คลิกเลือก ต้องพิมพ์ชื่อโมเดลเองในช่อง InsetField
- **การแก้ไขและปรับปรุง:**
  1. **Live Model Discovery**: เมื่อผู้ใช้วางคีย์ (Key Prefix `AIza...` สำหรับ Gemini, `sk-...` สำหรับ OpenAI/OpenRouter, `gsk_...` สำหรับ Groq) ให้ยิงเรียก Provider API ปลายทางทันทีเพื่อดึงรายชื่อโมเดลที่บัญชีนั้นเข้าถึงได้จริง
  2. **Smart Model Prioritization**: ปรับฟังก์ชัน `suggested_model()` ให้เลือกโมเดลที่ฉลาดและเสถียรที่สุดในปัจจุบัน:
     - Google Gemini: ลำดับที่ 1 = `gemini-2.0-flash`, ลำดับที่ 2 = `gemini-1.5-flash`, ลำดับที่ 3 = `gemini-1.5-pro` (ไม่เลือกโมเดลทดลองที่อาจถูกปิด หรือโมเดลที่ไม่มีจริง)
     - OpenAI: `gpt-4o-mini`
     - Groq: `llama-3.3-70b-versatile`
  3. **Interactive Clickable Chips บน Frontend**:
     - ใน `frontend/src/components/Profile/AISettingsCard.tsx` เพิ่มแถบชิปโมเดล (Clickable Chips) จากผลการตรวจสอบ เช่น `[gemini-2.0-flash (แนะนำ)]`, `[gemini-1.5-flash]`, `[gemini-1.5-pro]` เพื่อให้คลิกสลับโมเดลได้ทันที
  4. **Bulletproof Fallback**: หากเชื่อมต่ออินเทอร์เน็ตไม่ได้ตอนดึงลิสต์ ให้ Fallback ไปที่ `gemini-2.0-flash` เสมอ ห้ามใส่ชื่อโมเดลที่ไม่มีจริง
- **การทดสอบ:**
  - รันการทดสอบ Unit Tests `test_ai_settings.py` และ `test_ai_key_detection.py` ให้ครอบคลุมการเลือกโมเดลใหม่อย่างแม่นยำ

#### Task 1.3: ปรับปรุงการแจ้งเตือน Degraded Mode บนหน้า UI
- **ปัญหาปัจจุบัน:** เมื่อ API Key ตอบไม่ได้ (เช่น Quota หมด หรือคีย์ผิด) ผู้ใช้จะไม่ทราบและเข้าใจว่า AI ยังไม่ฉลาด
- **การแก้ไข:**
  - ใน `AICopilotDrawer.tsx` เมื่อ `msg.degraded === true` ให้แสดงแบนเนอร์แจ้งเตือนเด่นชัดขึ้น พร้อมระบุสาเหตุ (เช่น HTTP 404, 429 หรือ 401) และมีปุ่มคลิก "เปิดหน้าตั้งค่า AI" ได้ทันที

---

### 📌 Phase 2: ก้าวสู่ Agentic Copilot ด้วย Function Calling
*เป้าหมาย: สั่งงานระบบด้วยภาษาธรรมชาติโดยไม่ต้องพึ่งพา Regex ตายตัว*

#### Task 2.1: นำ Gemini Function Calling & OpenAI Tools มาใช้
- **การแก้ไข:**
  - นิยาม Tool Declarations ใน `ai.py`:
    - `add_note(text: str)`
    - `add_reminder(title: str, due_date: str, kind: str)`
    - `add_expense(amount: float, category: str, note: str)`
  - ส่ง Tools ไปพร้อมกับการเรียก `generateContent` หรือ `chat/completions`
  - เมื่อโมเดลตอบกลับมาเป็น `functionCall` ฝั่ง Backend จะส่ง Action กลับมาให้ Frontend ทำการบันทึกลงฐานข้อมูล
- **ผลลัพธ์:**
  - ผู้ใช้สามารถพูดภาษาธรรมชาติได้หลากหลาย เช่น *"ช่วยเตือนจ่ายค่าเน็ต 500 บาท สิ้นเดือนนี้"* โมเดลจะแยกแยะและตั้งเตือนให้อัตโนมัติ

#### Task 2.2: รองรับ Rich Markdown ใน AICopilotDrawer
- **ปัญหาปัจจุบัน:** แชตแสดงผลเป็นข้อความธรรมดา (`whitespace-pre-line`)
- **การแก้ไข:**
  - ใช้ตัวจัดรูปแบบ Markdown ที่ปลอดภัย (Safe Markdown parser) เพื่อรองรับตัวหนา หัวข้อ รายการจุด (Bullet points) และตาราง ทำให้อ่านคำตอบที่เป็นทางการได้ง่ายและสวยงามตาม Apple HIG

---

### 📌 Phase 3: ความจำและบริบทที่กว้างขึ้น (Context & Memory)
*เป้าหมาย: คุยต่อเนื่องได้ รู้จักงานของผู้ใช้มากขึ้น*

#### Task 3.1: จัดเก็บประวัติการสนทนาข้าม Session
- ปัจจุบันแชตจะรีเซ็ตกลับเป็นข้อความต้อนรับทุกครั้งที่รีเฟรชหน้าเว็บ
- ปรับให้เก็บประวัติล่าสุด 20 ข้อความไว้ใน `localStorage` หรือในตารางประวัติ เพื่อให้ผู้ใช้สามารถกลับมาอ่านคำตอบเดิมหรือคุยต่อได้

#### Task 3.2: รวม Context ด้านการเงินและนัดหมายใน System Prompt
- ดึงข้อมูลสรุปรายจ่ายเดือนปัจจุบัน และนัดหมาย 3 วันข้างหน้าเข้ามาใน Snapshot Context
- ผู้ใช้จะสามารถถามได้ เช่น *"เดือนนี้ใช้เงินไปเท่าไหร่แล้ว"* หรือ *"สัปดาห์นี้มีนัดอะไรบ้าง"*

---

### 📌 Phase 4: ฟีเจอร์ระดับสูง (Advanced Intelligence)
*เป้าหมาย: ค้นหาข้อมูลสดภายนอกและประมวลผลรูปภาพ*

#### Task 4.1: Google Search Grounding
- เปิดตัวเลือก `google_search_retrieval` ใน Gemini API
- ทำให้ AI Copilot สามารถค้นหาข้อมูลราคาสินค้า ข่าวเศรษฐกิจปัจจุบัน กฎหมาย หรือข้อมูลที่สดใหม่ระดับวัน/ชั่วโมงได้

#### Task 4.2: Multimodal Input (ถามด้วยภาพ)
- เพิ่มปุ่มคลิกส่งรูปภาพใน `AICopilotDrawer`
- ผู้ใช้สามารถอัปโหลดภาพถ่ายสลิปโอนเงิน หรือใบเสร็จ แล้วพิมพ์สั่ง *"บันทึกรายการนี้"* AI จะอ่านยอดเงินและบันทึกลงระบบให้อัตโนมัติ

---

## 🎯 แผนดำเนินการเริ่มต้น (Next Immediate Action)

หากต้องการเริ่มลงมือทำ แนะนำให้เริ่มจาก **Phase 1** ทันที ซึ่งสามารถทำได้โดยตรงในเวลาสั้นๆ:
1. แก้ไข `DEFAULT_GEMINI_MODEL` และ Model Presets ใน [backend/app/api/v1/endpoints/ai.py](file:///d:/Program/Project/PROJECT_ART/backend/app/api/v1/endpoints/ai.py)
2. ปรับปรุง `build_system_prompt` ให้เปิดกว้างสำหรับการตอบคำถามทั่วไป
3. ทดสอบความถูกต้องด้วย Pytest และ Vitest เพื่อไม่ให้กระทบระบบเดิม
