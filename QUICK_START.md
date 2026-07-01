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

### Test Calendar API
```bash
# ใช้ Python script
python backend/scripts/test_calendar.py YOUR_CALENDAR_ID

# หรือใช้ curl
curl "http://localhost:8080/api/v1/calendar/health?calendar_id=YOUR_ID"
```

### Test Oil Prices API
```bash
# ใช้ Python script
python backend/scripts/test_oil_prices.py

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

# Google Calendar
NEXT_PUBLIC_GOOGLE_CALENDAR_ID=your-calendar-id@group.calendar.google.com

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

### Calendar Widget แสดง Error
1. ตรวจสอบว่าปฏิทินเป็น **Public** ใน Google Calendar
2. ตรวจสอบ Calendar ID ใน `.env.local`
3. รัน test script: `python backend/scripts/test_calendar.py`
4. ดู logs: DevTools → Console

### Oil Prices Widget แสดง Stale Data
- นี่เป็นเรื่องปกติเมื่อ EPPO ช้าหรือล่ม
- Widget จะ auto-refresh ทุก 5 นาที
- ข้อมูล stale ดีกว่าไม่มีข้อมูล

---

## 📖 Documentation

### Quick Start Guides
- **Complete Fix:** `README_COMPLETE_FIX.md`
- **Calendar Fix:** `README_CALENDAR_FIX.md`
- **Oil Prices Fix:** `README_OIL_PRICES_FIX.md`

### Detailed Documentation
- **Calendar Troubleshooting:** `docs/CALENDAR_TROUBLESHOOTING.md`
- **Calendar Quick Reference:** `docs/CALENDAR_QUICK_REFERENCE.md`
- **Oil Prices Troubleshooting:** `docs/OIL_PRICES_TROUBLESHOOTING.md`
- **Deployment Checklist:** `docs/DEPLOYMENT_CHECKLIST.md`
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
python backend/scripts/test_calendar.py
python backend/scripts/test_oil_prices.py
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

✅ **Calendar Widget** - แสดง events จาก Google Calendar
✅ **Oil Prices Widget** - แสดงราคาน้ำมันจาก EPPO
✅ **Auto-commit Scripts** - Commit อัตโนมัติ (Bash, Batch, PowerShell)
✅ **Health Check Endpoints** - ตรวจสอบ API status
✅ **Test Scripts** - ทดสอบ APIs ก่อน deploy
✅ **Comprehensive Docs** - เอกสารครบถ้วนภาษาไทย
✅ **Graceful Fallbacks** - ระบบทำงานต่อได้แม้ API ล่ม
✅ **Thai Error Messages** - ข้อความ error เข้าใจง่าย

---

**พร้อมเริ่มพัฒนาแล้ว! 🚀**

สำหรับข้อมูลเพิ่มเติม อ่าน `README_COMPLETE_FIX.md`
