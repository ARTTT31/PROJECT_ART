# ⚡ Quick Start Guide - PROJECT_ART

## 🎯 เริ่มต้นใช้งานโปรเจค

### 📦 สิ่งที่ต้องมี
- Node.js 18+ (Frontend)
- Python 3.10+ (Backend)
- Git

---

## 🚀 Setup โปรเจค

### 1. Clone Repository
```bash
git clone https://github.com/ARTTT31/PROJECT_ART.git
cd PROJECT_ART
```

### 2. Setup Backend
```bash
cd backend

# สร้าง virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Linux/Mac)
source venv/bin/activate

# ติดตั้ง dependencies
pip install -r requirements.txt

# สร้าง .env file
cp .env.example .env
# แก้ไข .env ตามต้องการ

# รัน backend
python -m app.main
```

Backend จะรันที่: http://localhost:8080

### 3. Setup Frontend
```bash
cd frontend

# ติดตั้ง dependencies
npm install

# สร้าง .env.local
cp .env.example .env.local
# แก้ไข environment variables

# รัน development server
npm run dev
```

Frontend จะรันที่: http://localhost:3000

---

## 🧪 ทดสอบ APIs

### Test Oil Prices API
```bash
# ใช้ Python script
python backend/scripts/tests/test_oil_prices.py

# หรือใช้ curl
curl "http://localhost:8080/api/v1/oil-prices/health"
```

---

## 🔧 Configuration

### Backend Environment Variables (`.env`)
```env
# Database
DATABASE_URL=sqlite:///./art_workspace.db

# Security
SECRET_KEY=your-secret-key-here-minimum-32-characters
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Frontend Environment Variables (`.env.local`)
```env
# API URL
NEXT_PUBLIC_API_URL=http://localhost:8080

# Google Sign-In (Optional)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

---

## 📚 การแก้ไขและ Commit

### วิธีที่ 1: Auto-commit Script (แนะนำ)

**Windows PowerShell:**
```powershell
# Auto-commit with generated message
.\scripts\auto-commit-docs.ps1

# Custom message
.\scripts\auto-commit-docs.ps1 "fix: update calendar widget"
```

**Windows CMD:**
```cmd
scripts\auto-commit-docs.bat
```

**Linux/macOS:**
```bash
chmod +x scripts/auto-commit-docs.sh
./scripts/auto-commit-docs.sh "fix: update something"
```

### วิธีที่ 2: Manual Git

```bash
# Stage changes
git add .

# Commit
git commit -m "feat: add new feature"

# Push
git push origin main
```

---

## 🌐 Deployment

### Deploy Backend (Render)
1. Push to GitHub (triggers auto-deploy)
2. Monitor: https://dashboard.render.com
3. Check logs for errors

### Deploy Frontend (Vercel)
1. Push to GitHub (triggers auto-deploy)
2. Monitor: https://vercel.com/dashboard
3. Check deployment status

---

## 📋 Common Commands

### Backend
```bash
# Run server
python -m app.main

# Run with auto-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8080

# Run tests (if available)
pytest

# Lint
flake8 backend/
```

### Frontend
```bash
# Development
npm run dev

# Build
npm run build

# Start production
npm run start

# Lint
npm run lint

# Format
npm run format
```

---

## 🐛 Troubleshooting

### Backend ไม่สามารถรันได้
```bash
# ตรวจสอบ Python version
python --version  # ต้อง 3.10+

# ติดตั้ง dependencies ใหม่
pip install -r requirements.txt --upgrade

# ตรวจสอบ .env file
cat .env  # หรือ type .env (Windows)
```

### Frontend ไม่สามารถรันได้
```bash
# ตรวจสอบ Node version
node --version  # ต้อง 18+

# ลบ node_modules และติดตั้งใหม่
rm -rf node_modules
npm install

# Clear cache
npm cache clean --force
```

### Oil Prices Widget แสดง Stale Data
- นี่เป็นเรื่องปกติเมื่อ EPPO ช้าหรือล่ม
- Widget จะ auto-refresh ทุก 5 นาที
- ข้อมูล stale ดีกว่าไม่มีข้อมูล

---

## 📖 Documentation

### Setup & Guides
- **Quick Reference:** `docs/setup/quick-reference.md`
- **Login System:** `docs/setup/login-system.md`
- **Migration & Deployment:** `docs/setup/migration-deployment.md`
- **Oil Prices Troubleshooting:** `docs/setup/OIL_PRICES_TROUBLESHOOTING.md`
- **Scripts Documentation:** `scripts/README.md`

---

## 🔗 Important URLs

| Service | URL |
|---------|-----|
| **Backend (Local)** | http://localhost:8080 |
| **Frontend (Local)** | http://localhost:3000 |
| **Backend API Docs** | http://localhost:8080/docs |
| **Backend (Production)** | https://project-art-c7eh.onrender.com |
| **Frontend (Production)** | https://project-art-sigma.vercel.app |
| **Render Dashboard** | https://dashboard.render.com |
| **Vercel Dashboard** | https://vercel.com/dashboard |
| **GitHub Repo** | https://github.com/ARTTT31/PROJECT_ART |

---

## 🎓 Development Workflow

### 1. Create Feature Branch
```bash
git checkout -b feature/new-feature
```

### 2. Make Changes
```bash
# Edit files
# Test locally
```

### 3. Commit Changes
```bash
# Use auto-commit script
.\scripts\auto-commit-docs.ps1 "feat: add new feature"

# Or manual
git add .
git commit -m "feat: add new feature"
```

### 4. Push and Deploy
```bash
git push origin feature/new-feature

# Or merge to main for auto-deploy
git checkout main
git merge feature/new-feature
git push origin main
```

---

## 💡 Pro Tips

### Tip 1: Use Scripts
ใช้ auto-commit scripts จะช่วยประหยัดเวลาและสร้าง consistent commit messages

### Tip 2: Test Before Deploy
รัน test scripts ก่อน push เสมอ:
```bash
python backend/scripts/tests/test_calendar.py
python backend/scripts/tests/test_oil_prices.py
```

### Tip 3: Monitor Logs
เปิด backend logs และ browser console เพื่อจับ bugs ได้เร็ว

### Tip 4: Use Health Checks
เช็ค health endpoints ก่อนรัน frontend:
```bash
curl http://localhost:8080/health
curl http://localhost:8080/api/v1/calendar/health?calendar_id=YOUR_ID
curl http://localhost:8080/api/v1/oil-prices/health
```

### Tip 5: Read Documentation
มี documentation ครบถ้วนใน `docs/` - อ่านก่อนถาม!

---

## 🆘 Need Help?

1. **Check Documentation:** ดู `docs/` folder
2. **Run Test Scripts:** ใช้ scripts ใน `backend/scripts/`
3. **Check Logs:** Backend logs และ browser console
4. **Review Code:** อ่าน comments ในโค้ด
5. **Ask Questions:** สร้าง GitHub issue

---

## ✨ Key Features

✅ **Dashboard** - หน้าหลักพร้อมวิดเจ็ตที่ปรับแต่งและจัดเรียงได้
✅ **Calendar Widget** - แสดง events จาก Google Calendar
✅ **Oil Prices Widget** - แสดงราคาน้ำมันจาก EPPO
✅ **Weather & AQI Widget** - สภาพอากาศและค่าฝุ่น PM 2.5 แบบ real-time
✅ **Holiday Widget** - ปฏิทินวันหยุดนักขัตฤกษ์ไทย (ปีปัจจุบัน dynamic)
✅ **QR Code Widget** - สร้าง QR Code
✅ **Quick Links** - ลิงก์ด่วนในแถบเมนูด้านข้าง ตั้งค่าได้ที่หน้าโปรไฟล์
✅ **Notification Bell** - แจ้งเตือนอัตโนมัติ (วันหยุด, สภาพอากาศ, ราคาน้ำมัน)
✅ **Profile Page** - แก้ไขชื่อ, อีเมล, รหัสผ่าน และ Quick Links
✅ **Auto-commit Scripts** - Commit อัตโนมัติ (Bash, Batch, PowerShell)
✅ **Health Check Endpoints** - ตรวจสอบ API status
✅ **Graceful Fallbacks** - ระบบทำงานต่อได้แม้ API ล่ม
✅ **Thai UI** - ข้อความและ error ภาษาไทยทั้งหมด

---

## 🖥️ UI Components Overview

### Layout
- **Header** — แถบบนสุด แสดงชื่อหน้า, breadcrumb, นาฬิกา, และกระดิ่งแจ้งเตือน
- **Sidebar** — เมนูด้านข้าง แสดงเมนูหลักและ Quick Links (ปรับได้ที่โปรไฟล์)

### Pages
| หน้า | URL | คำอธิบาย |
|------|-----|----------|
| Login | `/login` | หน้าเข้าสู่ระบบ (Email/Password + Google) |
| Dashboard | `/dashboard` | หน้าหลักพร้อมวิดเจ็ต drag-and-drop |
| Profile | `/profile` | ตั้งค่าข้อมูลส่วนตัว, รหัสผ่าน, Quick Links, เมนูหลัก |

### Widgets (Dashboard)
| Widget | ขนาด (S/M/L) | ข้อมูลจาก |
|--------|-------------|----------|
| วันหยุดนักขัตฤกษ์ | S/M/L | ข้อมูลคงที่ (ไทย) |
| สภาพอากาศ & PM 2.5 | S/M/L | open-meteo.com |
| ราคาน้ำมัน | S/M/L | EPPO (ผ่าน backend) |
| สร้าง QR Code | S/M/L | client-side |

---

## 🔄 Recent Changes (UI)

### สิ่งที่ถูกลบออก (cleanup)
- ลบ badge "วิดเจ็ตเปิดใช้งาน X/X ตัว" ออกจาก dashboard
- ลบชื่อผู้ใช้และตำแหน่งออกจาก header
- ลบวันที่และข้อความต้อนรับออกจาก dashboard hero
- ลบ status dot สีข้างไอคอน Quick Links
- ลบ gradient สีม่วง-น้ำเงินออกจาก profile banner
- ลบปุ่มกล้องโปรไฟล์ที่ไม่มีฟังก์ชัน
- ลบ badge "ผู้ดูแลระบบ" ออกจาก header และ profile
- ลบจุดเขียวกระพริบ (animate-ping) จากนาฬิกาและหน้า login
- ลบ brand header "ART Workspace" ออกจาก sidebar
- ลบ avatar วงกลมออกจาก header

### สิ่งที่เพิ่ม/แก้ไข
- Profile hero ขาวล้วน จัดกึ่งกลาง
- เพิ่มช่อง Username (read-only) ในหน้าโปรไฟล์
- Holiday widget แสดงปีและจำนวนวันหยุดแบบ dynamic
- Dashboard loading spinner อยู่ใน DashboardLayout แล้ว
- Notification "ระบบพร้อมใช้งาน" ใช้ sessionStorage ไม่โผล่ซ้ำ
- Touch target ของ Sidebar เพิ่มเป็น 48px (WCAG)

---

**พร้อมเริ่มพัฒนาแล้ว! 🚀**

สำหรับข้อมูลเพิ่มเติม อ่าน `README_COMPLETE_FIX.md`
