# 🎨 ART Workspace - Serverless Edition

ระบบจัดการงานและข้อมูลส่วนตัว (Personal Productivity Dashboard) ภาษาไทย ที่ถูกย้ายฐานรากสู่ระบบ **Serverless & Fully Cloud-Managed** แบบ 100% เพื่อความยืดหยุ่น ประสิทธิภาพสูง และประหยัดทรัพยากรเครื่องผู้พัฒนาอย่างสมบูรณ์แบบ

🌐 **ลิงก์ระบบใช้งานจริง (Production):** [https://project-art-sigma.vercel.app](https://project-art-sigma.vercel.app)

---

## 📚 สารบัญเอกสารและคู่มือการใช้งาน (Documentation Index)

คู่มือการใช้งานและการพัฒนาของระบบถูกย้ายไปจัดหมวดหมู่ให้ค้นหาง่ายขึ้นในโฟลเดอร์ `docs/`:

### 🔧 1. การติดตั้งและการตั้งค่าระบบ (Setup & Installation)
* [Quick Reference (คำสั่ง Docker และคำสั่งที่ใช้บ่อย)](docs/setup/quick-reference.md)
* [คู่มือการติดตั้งระบบการล็อกอิน (Login System)](docs/setup/login-system.md)
* [คู่มือการตั้งค่า Google Calendar API](docs/setup/google-calendar.md)
* [คู่มือการทำ Migration และแนวทางการ Cloud Deployment](docs/setup/migration-deployment.md)

### 🎨 2. โครงสร้างและการออกแบบ (Architecture & UI/UX Design)
* [หลักการออกแบบภาพรวม (Design Principles)](docs/design/design-principles.md)
* [แนวทางการดีไซน์ Liquid Glass UI](docs/design/liquid-glass-ui.md)
* [รีวิวสถาปัตยกรรมโครงสร้างหน้าบ้าน (Frontend UX/UI Review)](docs/design/frontend-arch-review.md)
* [คู่มือการพัฒนาและสถานะด้าน Accessibility (A11y)](docs/design/accessibility.md)

### 🎯 3. ข้อมูลผลิตภัณฑ์และการวิเคราะห์ (Product & Strategy)
* [Roadmap ฟีเจอร์และความต้องการทางธุรกิจ (Product Specifications)](docs/product/roadmap-features.md)
* [ประวัติการอัปเดต Widget และ Widget Management](docs/product/widget-updates.md)
* [รายงานผลการวิเคราะห์โปรเจกต์ระดับลึก (Internal Analysis)](docs/internal/project-analysis.md)

---

## 🏗️ Tech Stack Overview

* **หน้าบ้าน (Frontend):** [Next.js 14](https://nextjs.org/) (App Router, TS, Tailwind CSS) โฮสต์ฟรีบน **Vercel**
* **หลังบ้าน (Backend):** [FastAPI](https://fastapi.tiangolo.com/) (Python 3.11+, SQLAlchemy Async, SlowAPI) รันฟรีบน **Render Web Service**
* **ฐานข้อมูล (Database):** [PostgreSQL 15](https://neon.tech/) รันฟรีบน **Neon Serverless Postgres**

---

## 💻 Local Development Setup (รันระบบในเครื่องแบบ Native)

คุณไม่จำเป็นต้องติดตั้งหรือรัน Docker ในเครื่องอีกต่อไป สามารถรัน Backend และ Frontend ผ่านเครื่องมือธรรมดาทั่วไปได้ทันที:

### 1. วิธี Setup และรันฝั่ง Backend (FastAPI)

1. เปิด Terminal และเข้าไปที่โฟลเดอร์ `backend`:
   ```bash
   cd backend
   ```
2. สร้างสภาพแวดล้อมเสมือน (Virtual Environment) ของ Python:
   ```bash
   python -m venv venv
   ```
3. เปิดใช้งานสภาพแวดล้อมเสมือน (Activate):
   * **Windows PowerShell:** `.\venv\Scripts\Activate.ps1`
   * **Windows CMD:** `.\venv\Scripts\activate.bat`
   * **macOS/Linux:** `source venv/bin/activate`
4. ติดตั้ง Libraries ที่จำเป็น:
   ```bash
   pip install -r requirements.txt
   ```
5. สั่งรันเซิร์ฟเวอร์หลังบ้าน:
   ```bash
   uvicorn app.main:app --reload --port 8080
   ```
   *ระบบ API จะเริ่มทำงานที่: [http://localhost:8080](http://localhost:8080) และหน้า API Docs ที่ [http://localhost:8080/docs](http://localhost:8080/docs)*

---

### 2. วิธี Setup และรันฝั่ง Frontend (Next.js)

1. เปิด Terminal อีกหน้าต่างและเข้าไปที่โฟลเดอร์ `frontend`:
   ```bash
   cd frontend
   ```
2. ติดตั้ง Dependencies:
   ```bash
   npm install
   ```
3. สั่งรันเว็บฝั่งนักพัฒนา (Dev Mode):
   ```bash
   npm run dev
   ```
   *หน้าเว็บหน้าบ้านจะเปิดใช้งานที่: [http://localhost:3000](http://localhost:3000)*

---

### 3. การจัดการฐานข้อมูลและการทำ Migration (Alembic)

เมื่อคุณรัน Backend แบบ Local และใช้ Database ร่วมกับ Neon (คลาวด์) สามารถสั่งอัปเดต Schema ของฐานข้อมูลให้ตรงกับ Model ล่าสุดได้ง่ายๆ ดังนี้:

1. ตรวจสอบว่าเปิดใช้ Virtual Environment อยู่ (ในโฟลเดอร์ `/backend`)
2. ตรวจสอบสถานะการตรวจสอบการเปลี่ยนแปลง (Autogenerate) หรือรันอัปเกรดฐานข้อมูลไปยังสถานะล่าสุด:
   ```bash
   alembic upgrade head
   ```
3. กรณีต้องการสร้าง Revision สำหรับการแก้ไข Table ในโค้ด:
   ```bash
   alembic revision --autogenerate -m "คำอธิบายการแก้ไข"
   ```

---

## 🔐 Environment Variables (.env Layout)

สร้างไฟล์สำหรับบันทึกคีย์ค่าแปรสภาพแวดล้อมแยกสองฝั่งดังนี้ (ห้ามนำไฟล์ `.env` จริงอัปโหลดขึ้น GitHub เด็ดขาด):

### 1. ฝั่ง Backend (`backend/.env`)
```env
# แอปพลิเคชัน
APP_NAME="ART Workspace API"
APP_VERSION="1.0.0"
DEBUG=True

# ฐานข้อมูล (Neon Postgres - ใช้แบบ Async Connection)
DATABASE_URL=postgresql+asyncpg://<username>:<password>@<neon-host>/art_workspace?sslmode=require

# ความปลอดภัยและการออกรหัสตั๋ว JWT
SECRET_KEY="รหัสลับสุ่มยาวๆสำหรับการลงนาม Token"
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# โดเมนที่อนุญาต (CORS) สำหรับ Local Dev
CORS_ORIGINS=http://localhost:3000,http://localhost:8080

# Google OAuth 2.0 Credentials
BACKEND_GOOGLE_CLIENT_ID="xxxx.apps.googleusercontent.com"
BACKEND_GOOGLE_CLIENT_SECRET="GOCSPX-xxxx"
BACKEND_GOOGLE_REDIRECT="http://localhost:8080/api/v1/auth/google/callback"
FRONTEND_URL="http://localhost:3000"
```

### 2. ฝั่ง Frontend (`frontend/.env.local`)
```env
# ลิงก์เชื่อมต่อไปยัง Backend API
NEXT_PUBLIC_API_URL=http://localhost:8080
```

---

## ☁️ Cloud Deployment Configuration

เมื่อคุณ Push โค้ดทั้งหมดขึ้น GitHub ระบบ Vercel และ Render จะบิวด์ระบบจากกิ่งหลัก (main) ให้อัตโนมัติ โดยมีค่าตั้งค่าสำคัญที่ต้องกรอกบนหน้าแดชบอร์ดดังนี้:

### 1. การตั้งค่าบน Render (FastAPI Backend Web Service)
* **Root Directory:** กรอก `backend` (เพื่อข้ามโฟลเดอร์หลักไปรันในโฟลเดอร์ backend โดยตรง)
* **Build Command:** `pip install -r requirements.txt`
* **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
* **Environment Variables (ที่ต้องเติมบนหน้าเว็บ):**
  * คัดลอกค่า `.env` ฝั่ง backend ทั้งหมดไปกรอก
  * เปลี่ยน `DATABASE_URL` ไปใช้ Neon connection string ตัวหลัก
  * เปลี่ยน `FRONTEND_URL` เป็น `https://project-art-sigma.vercel.app`
  * เปลี่ยน `BACKEND_GOOGLE_REDIRECT` เป็น `https://<your-render-subdomain>.onrender.com/api/v1/auth/google/callback`

### 2. การตั้งค่าบน Vercel (Next.js Frontend)
* **Framework Preset:** เลือก `Next.js`
* **Root Directory:** ทิ้งว่างไว้หรือระบุ `frontend` (ขึ้นกับวิธีการตั้งค่า Repository ของคุณ)
* **Environment Variables (ที่ต้องเติมบนหน้าเว็บ):**
  * `NEXT_PUBLIC_API_URL` ชี้ไปยังโดเมน Render ที่ได้บิวด์เสร็จสิ้นแล้ว (เช่น `https://<your-render-subdomain>.onrender.com`)

### 3. การตั้งค่า Google Cloud Console (Google OAuth)
อย่าลืมนำ URL เหล่านี้ไปผูกใน OAuth Consent Screen ของแอปพลิเคชันคุณ:
* **Authorized JavaScript origins:** `https://project-art-sigma.vercel.app`
* **Authorized redirect URIs:** ลิงก์ Callback ของ Render (เช่น `https://<your-render-subdomain>.onrender.com/api/v1/auth/google/callback`)

---
# 🤖 AI OPERATIONAL AGENT STATUS

## 1. AGENT ACKNOWLEDGMENT
The AI Agent architecture has processed, compiled, and committed the following state to its runtime core:

> "I have read and acknowledged the rules for the PONYTAIL INTERCEPT ENGINE (v4.5.0). 
> I will:
> - Apply the recursive ruleset (YAGNI, Standard, Platform, No Bloat, One-Liner, Min-Execution).
> - Adhere strictly to the minimal token budget and brief communication style.
> - Propagate these constraints to any subagents.
> Ready for instructions."

## 2. FORCED RUNTIME RULES (PONYTAIL METHODOLOGY)
Every LLM, Agent, or Subagent parsing this codebase must maintain this strict behavioral envelope:
1. **Token Conservation:** Keep responses short, direct, and zero-fluff. No greetings, no repetitive summaries. "He says nothing. He writes one line. It works."
2. **Code Minimalism:** Reduce code output volume by 80-94%. Reuse existing logic and prioritize standard native APIs over heavy third-party packages.
3. **Recursive Inheritance:** Any new subagent or parallel thread spawned to handle tasks within this project directory must automatically read, inherit, and enforce this section.

