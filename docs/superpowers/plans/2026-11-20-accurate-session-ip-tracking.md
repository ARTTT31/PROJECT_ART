# Accurate Session IP Resolution & Dynamic Tracking Implementation Plan

> **Goal:** ปรับปรุงระบบตรวจจับและบันทึก IP ของอุปกรณ์ผู้ใช้ ให้ตรงกับอุปกรณ์และตำแหน่งอินเทอร์เน็ตจริง ไม่ถูกทับด้วย IP ของ Reverse Proxy (Vercel) และอัปเดต IP อัตโนมัติเมื่อผู้ใช้เปลี่ยนเครือข่าย (Wi-Fi ➔ 4G/5G)

**Architecture:**
- **Proxy Header Resolution (`backend/app/core/rate_limit.py`)**: ปรับปรุงฟังก์ชัน `get_real_client_ip()` ให้รองรับการอ่าน Header จาก Vercel (`x-vercel-forwarded-for`, `x-real-ip`) และตรวจสอบลูกโซ่ของ Proxy ที่ถูกต้อง เพื่อไม่ให้คืนค่าเป็น IP ของเซิร์ฟเวอร์ Vercel
- **Dynamic Session IP Refresh (`backend/app/services/auth_service.py`)**: อัปเดต `refresh_access_token()` ให้รับ `client_ip` และทำการอัปเดตฟิลด์ `session.ip_address` ทุกครั้งที่มีการ Refresh Token หรือมีการใช้งานต่อเนื่อง
- **Active Sessions & Device Display (`frontend/src/components/Profile/MyDevicesCard.tsx`, `ActiveSessionsCard.tsx`)**: ตรวจสอบการแสดงผล IP ให้ระบุชัดเจน และรองรับการดึงข้อมูลเซสชันที่อัปเดตล่าสุด

**Tech Stack:** FastAPI, Starlette Request Headers, SQLAlchemy Async, Next.js 16 Rewrites, Vitest, Pytest.

---

## 📌 ปัญหาที่พบในปัจจุบัน (Current Gaps)

1. **Proxy IP Spoofing / Overwrite**:
   - หน้าบ้านอยู่บน Vercel และหลังบ้านอยู่บน Render โดย Next.js มีการทำ `/api/:path*` Rewrite
   - เมื่อคำขอวิ่งผ่าน Vercel ➔ Render, Header `X-Forwarded-For` จะมีทั้ง Client IP และ Vercel Public IP
   - เนื่องจาก IP ของ Vercel เป็น Public IP (ไม่ใช่ Private Network RFC1918) ฟังก์ชัน `get_real_client_ip()` จึงหยุดที่ IP ของ Vercel ทำให้ IP ที่บันทึกลง Session กลายเป็น IP ของเซิร์ฟเวอร์ Vercel (สหรัฐฯ/สิงคโปร์)
2. **Static IP at Login (IP ไม่เคยอัปเดตตามการใช้งานจริง)**:
   - ฟิลด์ `session.ip_address` ถูกเขียนค่าเฉพาะในฟังก์ชัน `auth_service.login()` เท่านั้น
   - เมื่อผู้ใช้ถืออุปกรณ์ย้ายจากเน็ตบ้าน (Wi-Fi) ไปใช้เน็ตมือถือ (4G/5G) หรือเปลี่ยนออฟฟิศ ระบบอัปเดตเฉพาะเวลา `last_activity` แต่เลข IP ยังคงเป็นเลขเดิมตอนล็อกอินครั้งแรกสุด

---

## 🧭 รายละเอียดแผนงาน (Task Breakdown)

### Task 1: ปรับปรุงการถอดรหัส IP จาก Vercel Proxy ใน `app/core/rate_limit.py`
- **การแก้ไข:**
  - เพิ่มการตรวจสอบ Header เฉพาะทางจาก Vercel เช่น `x-vercel-forwarded-for` หรือ `x-real-ip`
  - ปรับปรุงการตรวจสอบ `_forwarded_chain()`: หากปลายทางเป็น Vercel Edge ให้ดึง Client Origin IP ที่เป็น IP ต้นทางจริงของผู้ใช้มาใช้งาน
  - รองรับการตั้งค่า Environment `TRUSTED_PROXY_IPS` ให้ครอบคลุมเครือข่าย Proxy ได้ยืดหยุ่น
- **การทดสอบ:**
  - เพิ่ม Pytest ใน `test_rate_limit.py` หรือ `test_security_headers.py` จำลอง Header `X-Forwarded-For: 49.228.1.1, 76.76.21.21` (Client + Vercel) และยืนยันว่า `get_real_client_ip()` คืนค่า `49.228.1.1` ไม่ใช่ Vercel IP

### Task 2: เพิ่มการอัปเดต IP แบบ Real-time ตอน Token Refresh ใน `auth_service.py`
- **การแก้ไข:**
  - ในฟังก์ชัน `AuthService.refresh_access_token(refresh_token: str, client_ip: Optional[str] = None)`
  - เมื่อการตรวจสอบ Refresh Token ผ่านและทำการ Rotate Token ให้สั่ง:
    ```python
    if client_ip:
        session.ip_address = client_ip
    session.last_activity = now
    ```
  - ใน `backend/app/api/v1/endpoints/auth.py` ที่เรียก `refresh_access_token` ให้ส่ง `client_ip = get_real_client_ip(request)` เข้าไปด้วย
- **ผลลัพธ์:**
  - เมื่อผู้ใช้อุปกรณ์เดิมใช้งานข้ามวัน หรือสลับเครือข่าย เลข IP ในหน้า "อุปกรณ์ของฉัน" (My Devices) และ "Active Sessions" ของแอดมิน จะอัปเดตเป็น IP ปัจจุบันโดยอัตโนมัติ

### Task 3: ตรวจสอบและแสดงผลใน Frontend (`MyDevicesCard.tsx`, `ActiveSessionsCard.tsx`)
- **การแก้ไข:**
  - ตรวจสอบให้มั่นใจว่าเมื่อมีการโหลดรายการอุปกรณ์ จะแสดงข้อมูล IP และชื่ออุปกรณ์ที่ตรงกับเซสชันปัจจุบันอย่างชัดเจน
  - แสดงป้ายกำกับแยกความต่างระหว่าง `อุปกรณ์นี้ (เซสชันปัจจุบัน)` กับอุปกรณ์อื่น
- **การทดสอบ:**
  - รัน `npm --prefix frontend test` ตรวจสอบว่าเทสต์ของ `MyDevicesCard.test.tsx` และ `ActiveSessionsCard.test.ts` ผ่านครบถ้วน

---

## 🎯 สถานะแผนงาน (Status)
- [x] **ทำเสร็จ 2026-11-22** — Task 1 ทำผ่าน `TRUST_VERCEL_PROXY` (default off เพราะ header ปลอมได้ถ้า origin เข้าถึงตรง), Task 2 ส่ง `client_ip` เข้า `refresh_access_token()` และเขียน `session.ip_address`, Task 3 ตรวจแล้วไม่ต้องแก้ UI (label `อุปกรณ์นี้` + IP มีอยู่แล้ว) รายละเอียดใน `docs/internal/changelog.md`
