# Backend Scripts (`backend/scripts/`)

## 📁 Folder Structure

```
backend/scripts/
├── README.md           (This file)
├── admin/              🔐 User / Auth management (dev & ops only)
├── data/               🗓️ Data ingestion & external integrations
├── tests/              🧪 Manual one-off test scripts (NOT pytest)
└── ops/                🛠️ DB migration, server restart, schema ops
```

---

## 🔐 `admin/` — User / Auth (dev)

| Script | Usage | When to use |
|---|---|---|
| `create_admin.py` | `py scripts/admin/create_admin.py` <br> Prompt for email/password | ต้องการสร้าง admin user แบบ interactive |
| `create_admin_auto.py` | `py scripts/admin/create_admin_auto.py` <br> ใช้ค่า default จาก ENV | CI / first-time setup ไม่ต้องกรอกอะไร |
| `create_test_user.py` | `py scripts/admin/create_test_user.py` | สร้าง user ปกติ (user@test.test) สำหรับทดสอบ |
| `reset_user.py` | `py scripts/admin/reset_user.py <email> [new_password]` | รีเซ็ตรหัสผ่านลืม / unlock user ที่ล็อก |
| `check_password.py` | `py scripts/admin/check_password.py <email> <password>` | Debug ว่าที่ user บอก password นั้นตรงกับใน DB หรือไม่ |

## 🗓️ `data/` — Data / Integrations

| Script | Usage | Output / Side effect |
|---|---|---|
| `parse_oil.py` | `py scripts/data/parse_oil.py` | ดึงราคาน้ำมันล่าสุดจาก eppo.go.th → print JSON |
| `sync_calendar_server.py` | `py scripts/data/sync_calendar_server.py` | Pull calendar events จาก Google Calendar → sync เข้า local DB |

## 🧪 `tests/` — Manual Test scripts

> 💡 สำหรับ CI ให้ใช้ `cd backend && pytest -q` แทน (ดู `backend/tests/`)

| Script | What it tests | Prerequisites |
|---|---|---|
| `test_api.ps1` | API health + auth flow via PowerShell | Backend รันที่ `localhost:8000` |
| `test_login.py` | Login endpoint + session creation | User อยู่แล้วในฐานข้อมูล |
| `test_user_flow.py` | Register → Login → Profile refresh cycle | Fresh dev database |
| `test_calendar.py` | Calendar endpoints | Google OAuth env vars ตั้งค่าแล้ว |
| `test_oil_prices.py` | `/api/v1/oil-prices/*` endpoints | Network to EPPO / cached data |
| `test_db.js` | DB connectivity + schema existence (Node.js) | Postgres / SQLite รันแล้ว |

## 🛠️ `ops/` — Migration & Ops

| Script | Purpose | Command |
|---|---|---|
| `apply_migration.js` | Apply Alembic migrations ผ่าน Node.js wrapper | `node scripts/ops/apply_migration.js` |
| `get_schema.js` | Dump current schema as JavaScript object | `node scripts/ops/get_schema.js` |
| `restart_server.bat` | Windows batch: kill + start uvicorn again | Double-click หรือ `scripts\ops\restart_server.bat` |

---

## ⚠️ Do's & Don'ts

- ✅ **Do**: ใช้ `create_admin_auto.py` สำหรับ bootstrap production ครั้งแรก
- ✅ **Do**: ใช้ `reset_user.py` เมื่อ user ล็อกบัญชีจาก login ผิด 5 ครั้ง
- ❌ **Don't**: commit test output หรือ passwords จาก script เหล่านี้
- ❌ **Don't**: Run `parse_oil.py` แล้ว hardcode ผลลัพธ์ใน source — ใช้ `/api/v1/oil-prices` endpoint ที่มี cache อยู่แล้ว
- ❌ **Don't**: พึ่งพา `tests/test_*.py` ใน scripts/ — สำหรับ CI ให้เขียนใน `backend/tests/` (pytest)
