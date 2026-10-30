# 🚀 Production Readiness — เปิดใช้งานหลายคน / สาธารณะ

**Last updated:** 30 October 2026

เอกสารนี้คือ checklist สำหรับ deploy ระบบให้คนทั่วไปใช้งาน ครอบคลุมสิ่งที่ต้องตั้งค่า
ขั้นตอนทดสอบ และสิ่งที่ยังต้องทำด้วยมือ (บัญชีผู้ให้บริการ, โดเมน, การแจ้งเตือน)

> ส่วนที่ implement แล้วในโค้ด (อีเมล, ลืมรหัสผ่าน, ยืนยันอีเมล, Turnstile,
> approval workflow) ทำงานได้ทันทีเมื่อตั้งค่า environment variable ด้านล่าง
> ส่วนหน้า `/terms` / `/privacy` ถูกถอดออกแล้ว — ดูสถานะล่าสุดในข้อ 7

---

## 1. สิ่งที่ต้องมี / ตัดสินใจก่อนเปิด

| หัวข้อ | ค่าแนะนำ | หมายเหตุ |
|---|---|---|
| โหมดสมัครสมาชิก | `REGISTRATION_MODE=approval` | คนทั่วไปขอสมัครได้ แต่ต้องรอแอดมินอนุมัติ (ปลอดภัยสุดสำหรับเปิดสาธารณะ) ใช้ `open` เมื่อพร้อมรับคนเยอะจริงๆ |
| ลายเซ็นอีเมล | `EMAIL_BACKEND`, `EMAIL_FROM`, provider key/SMTP | ดูข้อ 2 |
| ยืนยันอีเมล | `REQUIRE_EMAIL_VERIFICATION=false` ก่อน → `true` เมื่ออีเมลใช้งานได้จริง | false = สมัครแล้วเข้าได้เลย; true = ต้องกดลิงก์ในอีเมลก่อน |
| CAPTCHA | `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile ฟรี; ว่าง = ปิดการตรวจ (ระบบยังทำงานปกติ) |
| ข้อตกลง/PDPA | ยังไม่มีหน้า `/terms` หรือ `/privacy` ในโค้ด (ถอดออก 27 ต.ค. 2026) | ฟอร์มสมัครยังส่ง `accepted_terms=true` และ backend ยังบันทึก `terms_version`; ก่อนเปิดสาธารณะต้องเพิ่มหน้านโยบายจริงหรือเอา consent ออกให้ตรงกัน |
| Redis (ถ้ามีหลาย instance) | `SLOWAPI_STORAGE_URI`, `WS_BROADCAST_REDIS_URL` | ดูข้อ 4 |
| Secret | `SECRET_KEY` (≥32 ตัวอักษร) | ระบบจะปฏิเสธการ start ถ้าใช้ค่า placeholder ตอน `DEBUG=False` |
| Database (Aiven) | `DATABASE_URL`, `SSL_CA_CERT_PATH` | Aiven บังคับ TLS และ CA ของ Aiven ไม่อยู่ใน certifi — ดาวน์โหลด CA จาก Console (Service → Overview → CA certificate) วางบน host แล้วชี้ path ไปที่ไฟล์นั้น |

**ลำดับ deploy ที่ถูกต้อง (ทุกครั้งที่มี migration ใหม่):**

```bash
cd backend && alembic upgrade head     # schema มาก่อนเสมอ (เช่น migration status/email_tokens รอบนี้)
# จากนั้น Render จะ deploy code ใหม่ — ตั้ง env vars ให้ครบก่อน restart
```

**ตรวจว่าโหมดที่ใช้จริงคือ approval:** เรียก
`GET /api/v1/auth/registration-mode` แล้วต้องได้ `{"data":{"registration_mode":"approval"}}`
ค่าเดียวกับ `GET /api/v1/system/branding` มิฉะนั้นหน้า login จะโชว์ฟอร์มแต่สมัครไม่ผ่าน
ถ้ายังได้ `closed`:

1. รัน `alembic upgrade head` อีกครั้ง — migration `20261022_registration_mode_seed`
   จะเติมแถว `system_settings.registration_mode` ที่ฐานข้อมูลเก่ายังไม่มี (ค่าเดิมไม่ถูกเขียนทับ)
2. หรือให้แอดมินเข้า **โปรไฟล์ → การตั้งค่าแบรนด์ → โหมดรับสมัครสมาชิก = approval** แล้วกดบันทึก
   (ค่านี้อยู่ในฐานข้อมูลและมีผลเหนือ environment variable)

---

## 2. อีเมล (จำเป็นสำหรับ "ใช้งานทั่วไป")

ระบบมี 3 backend เลือกผ่าน `EMAIL_BACKEND`:

- **`console`** (ค่าเริ่มต้น) — ไม่ส่งจริง ข้อความถูก log + เก็บในหน่วยความจำ
  ใช้ตอน dev/ทดสอบได้เลย **ลิงก์ลืมรหัสผ่านจะถูกพิมพ์ใน log ของเซิร์ฟเวอร์**
- **`smtp`** — ใช้กับผู้ให้บริการรายใดก็ได้ที่ให้ SMTP (`SMTP_HOST/PORT/USERNAME/PASSWORD/STARTTLS`)
- **`resend`** — ใช้ HTTP API ของ Resend (`RESEND_API_KEY`)

### เลือกผู้ให้บริการ (มีใน Gravity catalog)

| ผู้ให้บริการ | จุดเด่น | เหมาะกับ |
|---|---|---|
| **Resend** | API ง่ายสุดสำหรับ dev, เอกสารดี | มีโดเมนของตัวเอง แนะนำเริ่มที่นี่ |
| **Brevo** | free plan ใจกว้าง (รายวัน), มี SMTP | งบจำกัด, ไม่มีโดเมนก็เริ่มได้ (ยืนยัน sender อีเมลเดียว) |
| **Postmark** | deliverability สูงสุด | อีเมลสำคัญที่ต้องถึงกล่องแน่ๆ |
| **AWS SES** | ถูกสุดเมื่อ volume สูง | มี AWS อยู่แล้ว, รับ sandbox/production review ได้ |

### ข้อจำกัดสำคัญเรื่องโดเมน

ผู้ให้บริการส่วนใหญ่ **บังคับ verify โดเมน** ก่อนส่งถึงผู้รับทั่วไป (ไม่งั้นส่งได้แค่
อีเมลตัวเอง = โหมดทดสอบ) ถ้ายังไม่มีโดเมน:
- ใช้ **Brevo/SendGrid** แบบยืนยัน "sender email" เดียว (ส่งถึงใครก็ได้) หรือ
- ใช้ **Gmail app password ผ่าน SMTP** สำหรับช่วงเริ่ม (จำกัด ~500 ฉบับ/วัน)

เมื่อมีโดเมนแล้วตั้ง **SPF + DKIM + DMARC** ให้ครบ ไม่งั้นอีเมลจะเข้า spam

### ตรวจว่าอีเมลทำงาน

1. ตั้ง env → restart backend
2. ขอ "ลืมรหัสผ่าน" จากหน้า login → ต้องได้อีเมลภายใน 1 นาที
3. สมัครบัญชีใหม่ (โหมด approval) → แอดมินต้องได้อีเมลแจ้งคำขอ
4. อนุมัติ → ผู้สมัครต้องได้อีเมลผลอนุมัติ

---

## 3. Local / ทดสอบโดยไม่ส่งอีเมลจริง

- คง `EMAIL_BACKEND=console` — ลิงก์ตั้งรหัสผ่าน/ยืนยันอีเมลจะโผล่ใน log ของ uvicorn
- เทสต์ทั้งชุดของ backend ใช้ console backend อยู่แล้ว (outbox ในหน่วยความจำ)
- อย่าตั้ง `REQUIRE_EMAIL_VERIFICATION=true` ตอนที่ยังใช้ console backend ในเครื่องคนอื่น

---

## 4. Scale: จาก 1 instance → หลาย instance

โค้ดรองรับแล้วทั้งคู่ แต่ค่าเริ่มต้นเป็นแบบ single-instance:

| ส่วน | ตัวแปร | ค่า |
|---|---|---|
| Rate limiter | `SLOWAPI_STORAGE_URI` | `redis://default:...@host:port` (Upstash ฯลฯ) |
| WebSocket broadcast | `WS_BROADCAST_REDIS_URL` | Redis URL เดียวกัน |

- ตอน start ระบบจะ log `[SCALING]` เตือนถ้ายังใช้ค่า process-local
- เมื่อ provision Redis: ตั้งทั้งสองตัวแปร → deploy → เช็ค log ว่าไม่มี `[SCALING]` อีก
- **Load test ก่อนเปิดรับคนเยอะ** — ใช้สคริปต์ `scripts/loadtest/k6-login.js`
  (ต้องติดตั้ง [k6](https://k6.io/) และ**ยิงใส่ staging เท่านั้น**)

---

## 5. Backup / Disaster recovery (Aiven for PostgreSQL)

Production ใช้ **Aiven for PostgreSQL** (project `thanyapong-8a15`, service `pg-8a0b819`)

1. ตรวจ backup retention / PITR (point-in-time restore) ของ service ตาม plan ที่ใช้ — Aiven Console → Service → Backups
2. **ซ้อม restore 1 ครั้ง** ด้วยการ fork service (หรือ restore ไป service ใหม่) แล้วรัน `alembic current` ตรวจ schema
3. จด runbook สั้นๆ: ใคร restore, restore จาก service/backup ไหน, แจ้งใคร

ข้อมูลที่ไม่ต้อง backup แยก: รูปโปรไฟล์เก็บเป็น base64 ใน DB และค่าตั้งค่าอื่นๆ อยู่ใน DB/env
ทั้งหมด → backup ของ Aiven คือ backup ของระบบ

---

## 6. Monitoring / Alerting

| สิ่งที่ต้องมี | วิธี |
|---|---|
| Error tracking | `SENTRY_DSN` (backend) + `NEXT_PUBLIC_SENTRY_DSN` (frontend) แล้วตั้ง **Alert Rule** ส่งอีเมล/Slack เมื่อ error rate เกินปกติ |
| Uptime | UptimeRobot/BetterStack ยิง `GET /health/ready` ทุก 1–5 นาที (503 = DB ล่ม) และ `GET /health` (liveness + latency DB) |
| Logs | Render log drain (ถ้าต้องเก็บยาว) — ทุก response มี `X-Request-ID` ให้ตามรอยได้ |
| Session cleanup | ทำงานอัตโนมัติทุก `SESSION_CLEANUP_INTERVAL_HOURS` (ลบ session หมดอายุ + email token หมดอายุ) |

---

## 7. PDPA / เอกสารนโยบาย (สถานะปัจจุบัน)

- หน้า `/terms` และ `/privacy` ถูกถอดออกจากโค้ดเมื่อ 27 ต.ค. 2026 พร้อมส่วน PDPA ในหน้าโปรไฟล์
- ฟอร์มสมัครยังส่ง `accepted_terms=true` และ backend ยังบันทึก `terms_version` — ถ้าไม่มีหน้านโยบายจริง ต้องตัดสินใจว่าจะคืนหน้าเหล่านั้นหรือเอา consent ออก
- ถ้าจะเปิดสาธารณะ ควรมี: หน้านโยบาย + ลิงก์จากฟอร์มสมัคร, เจ้าของข้อมูล/ช่องทางติดต่อ, นโยบาย retention ของ audit log, และขั้นตอนแจ้งเหตุละเมิดภายใน 72 ชม.
- API ยังมี `GET /api/v1/profile/export` และ `DELETE /api/v1/profile/me` แต่ยังไม่มีปุ่มใน UI หลังการถอดส่วนนั้น; ถ้าจะให้ผู้ใช้ใช้เองต้องเพิ่มปุ่มกลับเข้าไป
- ก่อนแก้ข้อตกลง ให้ bump `TERMS_VERSION` เพื่อให้บันทึก consent แยกเวอร์ชันได้

---

## 8. Checklist ก่อนเปิดสาธารณะ

- [ ] `alembic upgrade head` บน production แล้ว (head ปัจจุบัน `20261029_user_main_menu`)
- [ ] ตั้ง env ครบตามข้อ 1 บน Render (backend) และ Vercel (frontend)
- [ ] `CORS_ORIGINS` = โดเมน frontend จริงเท่านั้น (ห้าม `*`)
- [ ] `FRONTEND_URL` = โดเมน frontend จริง (ใช้สร้างลิงก์ในอีเมล)
- [ ] `COOKIE_SECURE=true`, `DEBUG=false`, `ENABLE_API_DOCS=false`
- [ ] ทดสอบ flow จริง: สมัคร → แอดมินเห็นคำขอใน `/admin` → อนุมัติ → ผู้สมัครได้อีเมล → เข้าสู่ระบบ → ลืมรหัสผ่าน → ตั้งรหัสใหม่
- [ ] Uptime monitor + Sentry alert ทำงาน
- [ ] ซ้อม restore ฐานข้อมูล 1 ครั้ง
- [ ] Load test บน staging เสร็จ รู้ว่า capacity เท่าไร
