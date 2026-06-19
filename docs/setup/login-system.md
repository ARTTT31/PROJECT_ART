# คู่มือ Login System

## การตั้งค่า

### Backend (Port 8888)
Backend ทำงานบน port 8888 เพื่อหลีกเลี่ยงการชนกับ Docker ที่ใช้ port 8000

**เริ่ม Backend Server:**
```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8888 --reload
```

### Frontend (Port 3000)
Frontend ต้องตั้งค่าให้ชี้ไปที่ backend port 8888 ใน `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8888
```

**เริ่ม Frontend Server:**
```bash
cd frontend
npm run dev
# หรือ
yarn dev
```

**หมายเหตุ:** หลังจากแก้ไข `.env.local` ต้อง restart frontend server เพื่อให้โหลดค่าใหม่

## ข้อมูล Login สำหรับทดสอบ

- **Email:** admin@art.com
- **Password:** admin@123
- **Role:** admin

## Port ที่ใช้งาน

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8888
- **API Docs:** http://localhost:8888/docs
- **Docker:** port 8000 (ใช้โดย Docker Desktop)

## สร้าง Test User เพิ่ม

```bash
cd backend
python create_test_user.py
```

## ทดสอบ API โดยตรง

### PowerShell
```powershell
$body = @{
    email = "admin@art.com"
    password = "admin@123"
    session_id = "test_session"
    user_agent = "PowerShell"
    device_label = "Desktop"
} | ConvertTo-Json

Invoke-RestMethod -Uri 'http://localhost:8888/api/v1/auth/login' `
    -Method POST `
    -Body $body `
    -ContentType 'application/json'
```

### cURL
```bash
curl -X POST http://localhost:8888/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@art.com",
    "password": "admin@123",
    "session_id": "test_session",
    "user_agent": "curl",
    "device_label": "Desktop"
  }'
```

## การแก้ปัญหา

### ปัญหา: ERR_EMPTY_RESPONSE
**สาเหตุ:** Port 8000 ถูกใช้งานโดย Docker หรือ process อื่น

**วิธีแก้:**
1. ใช้ port 8888 สำหรับ backend แทน
2. อัพเดท `NEXT_PUBLIC_API_URL` ใน frontend/.env.local
3. Restart frontend server

### ปัญหา: Database ไม่มี User
**วิธีแก้:**
```bash
cd backend
python create_test_user.py
```

### ปัญหา: CORS Error
**วิธีแก้:** ตรวจสอบว่า CORS_ORIGINS ใน backend/.env รวม frontend URL:
```
CORS_ORIGINS=http://localhost:3000,http://localhost:80
```

## Architecture

```
Frontend (Next.js)          Backend (FastAPI)           Database (SQLite)
Port 3000                   Port 8888                   art_workspace.db
    |                           |                             |
    |-- POST /login ----------->|                             |
    |                           |-- Query User -------------->|
    |                           |<-- User Data ---------------|
    |                           |-- Create Session ---------->|
    |                           |-- Generate JWT Tokens       |
    |<-- Tokens + User Data ----|                             |
    |                           |                             |
```

## Security Features

1. **Password Hashing:** bcrypt
2. **JWT Tokens:** Access token (30 min) + Refresh token (7 days)
3. **Account Lockout:** 5 failed attempts = 30 min lock
4. **Session Tracking:** IP, User Agent, Device Label
5. **Failed Login Attempts:** Tracked per user

## API Endpoints

- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout (invalidate session)
- `GET /health` - Health check
- `GET /` - API info
