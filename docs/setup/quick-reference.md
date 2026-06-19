# Quick Reference - ART Workspace Modern Stack

## ✅ ระบบพร้อมใช้งานแล้ว!

### 🌐 URLs สำคัญ

- **Frontend (Login)**: http://localhost:3000/login
- **Dashboard**: http://localhost:3000/dashboard
- **Profile**: http://localhost:3000/profile
- **Backend API**: http://localhost:8000
- **API Documentation (Swagger)**: http://localhost:8000/docs
- **API ReDoc**: http://localhost:8000/redoc

### 🔐 Default Admin Login

```
Email: admin@art.com
Password: Admin@123
```

**⚠️ สำคัญ**: 
- เปลี่ยนรหัสผ่านหลังจาก login ครั้งแรก!
- ใช้ email/password นี้สำหรับ development เท่านั้น
- Production ต้องสร้าง admin user ใหม่และลบ default admin

---

## 📋 คำสั่งที่ใช้บ่อย

### เริ่มต้นใช้งาน (ครั้งแรก)

```bash
# 1. เข้าโฟลเดอร์โปรเจกต์
cd PROJECT_ART

# 2. เริ่ม services ทั้งหมด (ครั้งแรกจะ download images และ build)
docker-compose up -d

# 3. รอให้ services เริ่มต้น (ประมาณ 30-60 วินาที)
docker-compose logs -f

# 4. สร้าง admin user (กด Ctrl+C เพื่อออกจาก logs ก่อน)
docker-compose exec -T backend python create_admin_simple.py

# 5. เปิด browser ไปที่ http://localhost:3000/login
# Login ด้วย admin@art.com / Admin@123
```

### เริ่มต้นใช้งาน (วันถัดไป)

```bash
# เข้าโฟลเดอร์โปรเจกต์
cd PROJECT_ART

# เริ่ม services (รวดเร็วกว่าครั้งแรก)
docker-compose up -d

# ดู logs (optional)
docker-compose logs -f

# เปิด browser ไปที่ http://localhost:3000/login
```

### ดู Logs และ Debug

```bash
# ดู logs ทั้งหมด (real-time)
docker-compose logs -f

# ดู logs เฉพาะ frontend
docker-compose logs -f frontend

# ดู logs เฉพาะ backend
docker-compose logs -f backend

# ดู logs เฉพาะ database
docker-compose logs -f postgres

# ดู logs ย้อนหลัง 50 บรรทัด
docker logs art_frontend --tail 50
docker logs art_backend --tail 50

# ดูสถานะ containers
docker-compose ps
```

### หยุดและลบ

```bash
# หยุด services (เก็บข้อมูล)
docker-compose stop

# หยุดและลบ containers (เก็บข้อมูล database)
docker-compose down

# หยุดและลบทั้ง containers + volumes (⚠️ ลบข้อมูล database)
docker-compose down -v

# ลบ images ด้วย (เพื่อ rebuild ใหม่ทั้งหมด)
docker-compose down --rmi all -v
```

### Restart Services

```bash
# Restart ทั้งหมด
docker-compose restart

# Restart เฉพาะ frontend
docker-compose restart frontend

# Restart เฉพาะ backend
docker-compose restart backend

# Restart เฉพาะ database
docker-compose restart postgres
```

### Rebuild Services

```bash
# Rebuild frontend (เมื่อแก้ Dockerfile หรือ dependencies)
docker-compose up -d --build frontend

# Rebuild backend
docker-compose up -d --build backend

# Rebuild ทั้งหมด
docker-compose up -d --build

# Rebuild แบบไม่ใช้ cache (clean build)
docker-compose build --no-cache frontend
docker-compose up -d frontend
```

### Database Management

```bash
# เข้า PostgreSQL shell
docker-compose exec postgres psql -U art_user -d art_workspace

# คำสั่งใน psql:
\dt                    # แสดง tables ทั้งหมด
\d users               # แสดง schema ของ users table
SELECT * FROM users;   # ดูข้อมูล users
\q                     # ออกจาก psql

# สร้าง migration ใหม่
docker-compose exec backend alembic revision --autogenerate -m "add new field"

# รัน migrations
docker-compose exec backend alembic upgrade head

# Rollback migration
docker-compose exec backend alembic downgrade -1

# ดู migration history
docker-compose exec backend alembic history

# ดู current revision
docker-compose exec backend alembic current
```

### สร้าง User เพิ่ม

```bash
# สร้าง admin user (ใช้ script)
docker-compose exec -T backend python create_admin_simple.py

# หรือสร้างผ่าน API (ต้อง login ด้วย admin ก่อน)
# ดูตัวอย่างใน API Documentation: http://localhost:8000/docs
```

### เข้าไปใน Container

```bash
# เข้า frontend container
docker-compose exec frontend sh

# เข้า backend container
docker-compose exec backend bash

# เข้า postgres container
docker-compose exec postgres bash

# ออกจาก container
exit
```

---

## 🔧 Troubleshooting

### Port ถูกใช้งานอยู่

ถ้า port 3000, 8000 หรือ 5432 ถูกใช้งาน:

```bash
# Windows - ดู process ที่ใช้ port
netstat -ano | findstr :3000
netstat -ano | findstr :8000
netstat -ano | findstr :5432

# หยุด process (ใช้ PID จากคำสั่งด้านบน)
taskkill /PID <PID> /F

# หรือเปลี่ยน port ใน docker-compose.yml
# เช่น "3001:3000" แทน "3000:3000"
```

### Frontend ไม่ทำงาน

```bash
# 1. ดู logs
docker-compose logs frontend

# 2. ตรวจสอบว่า container รันอยู่
docker-compose ps

# 3. Restart frontend
docker-compose restart frontend

# 4. ถ้ายังไม่ได้ ลบ .next cache และ rebuild
docker-compose down
docker volume prune -f
docker-compose up -d --build frontend

# 5. ตรวจสอบว่า http://localhost:3000 เปิดได้
```

### Backend ไม่ทำงาน

```bash
# 1. ดู logs
docker-compose logs backend

# 2. ตรวจสอบว่า database พร้อม
docker-compose ps postgres

# 3. Restart backend
docker-compose restart backend

# 4. ถ้ายังไม่ได้ rebuild
docker-compose up -d --build backend

# 5. ตรวจสอบว่า http://localhost:8000/docs เปิดได้
```

### Database connection error

```bash
# 1. ตรวจสอบ PostgreSQL
docker-compose ps postgres

# 2. ดู logs
docker-compose logs postgres

# 3. Restart PostgreSQL
docker-compose restart postgres

# 4. เข้าไปตรวจสอบใน container
docker-compose exec postgres psql -U art_user -d art_workspace

# 5. ถ้ายังไม่ได้ ลบและสร้างใหม่
docker-compose down -v
docker-compose up -d
docker-compose exec -T backend python create_admin_simple.py
```

### Login ไม่ได้

```bash
# 1. ตรวจสอบว่า backend ทำงาน
curl http://localhost:8000/docs

# 2. ตรวจสอบว่ามี admin user
docker-compose exec postgres psql -U art_user -d art_workspace -c "SELECT email, name, role FROM users;"

# 3. ถ้าไม่มี สร้างใหม่
docker-compose exec -T backend python create_admin_simple.py

# 4. เปิด DevTools (F12) → Network tab ดู request/response

# 5. ตรวจสอบ localStorage
# เปิด DevTools → Application → Local Storage
# ต้องมี keys: access_token, user, refresh_token, session_id

# 6. ลอง clear localStorage และ login ใหม่
localStorage.clear()
```

### Hydration Error (Next.js)

```bash
# 1. ลบ .next cache
docker-compose down
docker volume prune -f

# 2. Rebuild frontend
docker-compose up -d --build frontend

# 3. Hard refresh browser (Ctrl+Shift+R)
```

### ลบทุกอย่างและเริ่มใหม่

```bash
# ⚠️ คำเตือน: จะลบข้อมูล database ทั้งหมด!

# 1. หยุดและลบทุกอย่าง
docker-compose down -v

# 2. ลบ images (optional)
docker-compose down --rmi all -v

# 3. ลบ dangling volumes
docker volume prune -f

# 4. เริ่มใหม่
docker-compose up -d --build

# 5. รอให้ services เริ่มต้น
docker-compose logs -f

# 6. สร้าง admin user ใหม่
docker-compose exec -T backend python create_admin_simple.py

# 7. เปิด browser ไปที่ http://localhost:3000/login
```

### Widget ไม่แสดงข้อมูล

```bash
# Weather Widget ไม่แสดงข้อมูล:
# 1. เปิด DevTools → Network tab
# 2. ดู request ไปที่ Open-Meteo API
# 3. ถ้า CORS error → ตรวจสอบ API endpoint
# 4. ถ้า timeout → ลอง refresh หรือรอสักครู่
# 5. ตรวจสอบ localStorage → weather_cache

# Oil Price Widget ไม่แสดงข้อมูล:
# 1. เปิด DevTools → Network tab
# 2. ดู request ไปที่ Thai Oil API
# 3. ถ้า CORS error → Widget จะใช้ fallback proxy
# 4. ถ้าทุก proxy ล้มเหลว → แสดง error message
# 5. ตรวจสอบ localStorage → oil_price_cache

# Todo Widget ไม่บันทึกข้อมูล:
# 1. เปิด DevTools → Application → Local Storage
# 2. ตรวจสอบว่ามี key "todos"
# 3. ถ้าไม่มี → localStorage อาจถูก block
# 4. ลอง clear localStorage และเพิ่ม todo ใหม่
# 5. ตรวจสอบ Console → ไม่ควรมี localStorage errors

# Calculator Widget ไม่ทำงาน:
# 1. ตรวจสอบ Console → ไม่ควรมี JavaScript errors
# 2. ลอง refresh page (Ctrl+R)
# 3. ทดสอบด้วยเมาส์และ keyboard แยกกัน

# Barcode/QR Widget ไม่ generate:
# 1. ตรวจสอบ Console → ไม่ควรมี Canvas errors
# 2. ลอง refresh page (Ctrl+R)
# 3. ลองเปลี่ยนข้อความและ generate ใหม่
# 4. Download/Copy/Share อาจไม่ทำงานใน HTTP (ต้อง HTTPS)
```

### Widget Performance Issues

```bash
# Widget โหลดช้า:
# 1. ตรวจสอบ Network tab → ดู API response time
# 2. Weather Widget: Open-Meteo API ควรตอบกลับภายใน 1-2 วินาที
# 3. Oil Price Widget: Thai Oil API อาจช้า ใช้ cache
# 4. ลอง clear localStorage cache และ refresh

# Widget ใช้ memory มาก:
# 1. เปิด DevTools → Performance tab
# 2. Record และดู memory usage
# 3. Todo Widget: ถ้ามี todos เยอะมาก (>1000) อาจช้า
# 4. ลอง clear completed todos

# Auto-refresh ทำให้ช้า:
# 1. Weather Widget refresh ทุก 2 นาที
# 2. ถ้าต้องการปิด → แก้ไข WeatherWidget.tsx
# 3. เปลี่ยน REFRESH_INTERVAL หรือลบ useEffect
```

---

## 📊 API Endpoints

### Authentication

```bash
# Login
POST http://localhost:8000/api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@art.com",
  "password": "Admin@123"
}

# Response:
{
  "result": "success",
  "message": "เข้าสู่ระบบสำเร็จ",
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "token_type": "bearer",
    "session_id": "uuid",
    "user": {
      "id": 1,
      "email": "admin@art.com",
      "name": "Admin User",
      "role": "admin"
    }
  }
}

# Register
POST http://localhost:8000/api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123",
  "name": "User Name"
}

# Logout
POST http://localhost:8000/api/v1/auth/logout
Content-Type: application/json

{
  "session_id": "uuid"
}
```

### Profile (ต้อง login)

```bash
# Get profile
GET http://localhost:8000/api/v1/profile/me
Authorization: Bearer <access_token>

# Update profile
PUT http://localhost:8000/api/v1/profile/me
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "New Name"
}

# Change password
POST http://localhost:8000/api/v1/profile/change-password
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "old_password": "Admin@123",
  "new_password": "NewPassword123"
}
```

### Users (Admin only)

```bash
# List users
GET http://localhost:8000/api/v1/users/
Authorization: Bearer <access_token>

# Get user by ID
GET http://localhost:8000/api/v1/users/1
Authorization: Bearer <access_token>

# Create user
POST http://localhost:8000/api/v1/users/
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "Password123",
  "name": "New User",
  "role": "user"
}

# Delete user
DELETE http://localhost:8000/api/v1/users/1
Authorization: Bearer <access_token>
```

---

## 🗄️ Database Schema

### users table

| Column | Type | Description |
|--------|------|-------------|
| id | Integer | Primary key |
| email | String | Unique email |
| hashed_password | String | Bcrypt hashed password |
| name | String | User's name |
| role | String | user/admin |
| avatar | Text | Base64 or URL |
| quick_links | Text | JSON string |
| is_active | Boolean | Account active status |
| is_locked | Boolean | Account locked status |
| last_login | DateTime | Last login timestamp |
| last_login_ip | String | Last login IP |
| last_login_device | String | Last login device |
| failed_login_attempts | Integer | Failed login count |
| locked_until | DateTime | Lock expiry time |
| created_at | DateTime | Created timestamp |
| updated_at | DateTime | Updated timestamp |

### sessions table

| Column | Type | Description |
|--------|------|-------------|
| id | Integer | Primary key |
| session_id | String | Unique session ID |
| user_id | Integer | Foreign key to users |
| user_agent | String | Browser user agent |
| device_label | String | Device description |
| ip_address | String | Client IP |
| is_active | Boolean | Session active status |
| last_activity | DateTime | Last activity time |
| expires_at | DateTime | Session expiry |
| created_at | DateTime | Created timestamp |
| updated_at | DateTime | Updated timestamp |

---

## 📝 Development Workflow

### 1. เริ่มต้นวัน

```bash
cd PROJECT_ART
docker-compose up -d
docker-compose logs -f
```

### 2. พัฒนา Frontend

```bash
# แก้ไข code ใน frontend/src/
# Hot reload จะทำงานอัตโนมัติ
# ดู logs เพื่อ debug
docker-compose logs -f frontend
```

### 3. พัฒนา Backend

```bash
# แก้ไข code ใน backend/app/
# Uvicorn จะ reload อัตโนมัติ
# ดู logs เพื่อ debug
docker-compose logs -f backend
```

### 4. ทดสอบ API

```bash
# เปิด Swagger UI
open http://localhost:8000/docs

# หรือใช้ curl
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@art.com","password":"Admin@123"}'
```

### 5. Database Changes

```bash
# แก้ไข models ใน backend/app/models/

# สร้าง migration
docker-compose exec backend alembic revision --autogenerate -m "add new field"

# รัน migration
docker-compose exec backend alembic upgrade head

# ตรวจสอบใน database
docker-compose exec postgres psql -U art_user -d art_workspace
```

### 6. จบวัน

```bash
# หยุด services (เก็บข้อมูล)
docker-compose stop

# หรือปล่อยให้รันต่อ (ใช้ทรัพยากร)
```

---

## 🎯 Next Steps

### ✅ เสร็จแล้ว
1. ✅ ระบบ Login/Authentication
2. ✅ Dashboard พื้นฐาน
3. ✅ Profile Management
4. ✅ Session Management
5. ✅ JWT Token Authentication
6. ✅ Docker Setup
7. ✅ Hot Reload Development
8. ✅ **Dashboard Widgets (Phase 2)**
   - ✅ Weather Widget (Open-Meteo API, UV Index, Sunrise/Sunset, PM2.5, AQI, 7-day forecast)
   - ✅ Oil Price Widget (Thai Oil API, Price Change Indicator, Percentage)
   - ✅ Todo Widget (CRUD, Filter, localStorage, Stats)
   - ✅ Calculator Widget (Basic operations, Keyboard support)
   - ✅ Barcode/QR Widget (Generate, Download, Copy, Share, Print)

### 📝 ต่อไป
1. 📝 User Management (Admin Panel)
2. 📝 File Upload
3. 📝 Email Notifications
4. 📝 Activity Logs
5. 📝 Advanced Dashboard Features (Charts, Analytics)
6. 📝 Testing Suite (Unit, Integration, E2E)
7. 📝 CI/CD Pipeline
8. 📝 Production Deployment
9. 📝 Performance Optimization
10. 📝 Mobile Responsive Improvements

---

## 🎨 Dashboard Widgets

### Weather Widget
- **API**: Open-Meteo (ฟรี, ไม่ต้อง API key)
- **Features**:
  - Current weather (อุณหภูมิ, ความชื้น, ลม, ความกดอากาศ)
  - UV Index พร้อม emoji สี (🟢🟡🟠🔴🟣)
  - Sunrise/Sunset time (เวลาไทย)
  - Visibility (ทัศนวิสัย km)
  - PM2.5 & AQI (คุณภาพอากาศ)
  - พยากรณ์อากาศ 7 วัน
  - Auto-refresh ทุก 2 นาที พร้อม countdown
  - Cache system (localStorage)
- **Location**: Bangkok (13.7563°N, 100.5018°E)

### Oil Price Widget
- **API**: Thai Oil API (ฟรี)
- **Features**:
  - ราคาน้ำมันทุกชนิด (Gasohol, Diesel, NGV, LPG)
  - Price Change Indicator (↑↓)
  - Change Percentage (%)
  - เปรียบเทียบกับราคาก่อนหน้า
  - สีตามการเปลี่ยนแปลง (แดง=ขึ้น, เขียว=ลง)
  - Fallback proxies (3 ระดับ)
  - Cache system (localStorage)

### Todo Widget
- **Storage**: localStorage
- **Features**:
  - CRUD operations (Add/Edit/Delete)
  - Mark as complete/incomplete
  - Filter (All/Active/Completed)
  - Clear completed tasks
  - Inline edit (double-click)
  - Stats display (Total/Active/Completed)
  - Responsive design

### Calculator Widget
- **Features**:
  - Basic operations (+, -, ×, ÷)
  - Decimal, Percentage, Toggle sign
  - Clear, Clear Entry, Backspace
  - **Keyboard support**:
    - Numbers: 0-9
    - Operations: +, -, *, /
    - Enter: Calculate
    - Escape: Clear
    - Backspace: Delete last digit
  - Operation display
  - Error handling (Division by zero)
  - Number formatting (commas)

### Barcode/QR Widget
- **Technology**: Canvas-based (ไม่ต้องติดตั้ง library)
- **Features**:
  - Generate Barcode (Code 128)
  - Generate QR Code
  - Color picker (foreground/background)
  - **Download** (PNG format)
  - **Copy to clipboard** (as image)
  - **Share** (Web Share API)
  - **Print** (window.print)
  - Auto-generate on mount
  - Responsive design

### Widget Files
```
frontend/src/components/Widgets/
├── WeatherWidget.tsx
├── OilPriceWidget.tsx
├── TodoWidget.tsx
├── CalculatorWidget.tsx
└── BarcodeQRWidget.tsx
```

### Dashboard Integration
- **File**: `frontend/src/app/dashboard/page.tsx`
- **Layout**: Grid layout (responsive)
- **Quick Stats**: Dynamic stats from widgets
- **Features**: All widgets integrated and working

### Testing Widgets

```bash
# 1. เริ่ม services
cd PROJECT_ART
docker-compose up -d

# 2. เปิด browser ไปที่ Dashboard
open http://localhost:3000/dashboard

# 3. ทดสอบแต่ละ Widget:

# Weather Widget:
# - ดูว่าแสดงข้อมูลอากาศปัจจุบัน
# - ตรวจสอบ UV Index, Sunrise/Sunset, PM2.5
# - ดู countdown auto-refresh
# - ตรวจสอบ 7-day forecast

# Oil Price Widget:
# - ดูราคาน้ำมันทุกชนิด
# - ตรวจสอบ Price Change Indicator (↑↓)
# - ดู Change Percentage (%)

# Todo Widget:
# - เพิ่ม todo ใหม่
# - Mark as complete/incomplete
# - Edit todo (double-click)
# - Delete todo
# - Filter (All/Active/Completed)
# - Clear completed

# Calculator Widget:
# - คำนวณด้วยเมาส์
# - ทดสอบ keyboard (0-9, +, -, *, /, Enter, Esc)
# - ทดสอบ decimal, percentage, toggle sign

# Barcode/QR Widget:
# - Generate barcode/QR code
# - เปลี่ยนสี
# - Download PNG
# - Copy to clipboard
# - Share (ถ้า browser รองรับ)
# - Print

# 4. ตรวจสอบ localStorage
# เปิด DevTools (F12) → Application → Local Storage
# ต้องมี keys:
# - weather_cache
# - oil_price_cache
# - todos

# 5. ตรวจสอบ Console
# เปิด DevTools (F12) → Console
# ไม่ควรมี errors (ยกเว้น API errors ที่ handle แล้ว)
```

---

## 📚 เอกสารเพิ่มเติม

- `README.md` - ภาพรวมโปรเจกต์และ Tech Stack
- `GETTING_STARTED.md` - คู่มือเริ่มต้นแบบละเอียด
- `PROJECT_STRUCTURE.md` - โครงสร้างโปรเจกต์
- `PHASE2_COMPLETE.md` - สรุป Phase 2 Dashboard Widgets
- `WIDGET_IMPLEMENTATION_SUMMARY.md` - รายละเอียด Widgets
- `CHANGELOG_WIDGETS.md` - ประวัติการเปลี่ยนแปลง Widgets
- `docs/MIGRATION.md` - คู่มือ migrate จากโปรเจกต์หลัก
- `docs/API.md` - API Documentation
- `docs/DEPLOYMENT.md` - คู่มือ Deploy

---

## 💡 Tips & Best Practices

### Development

1. **Hot Reload**: Code changes จะ auto-reload ไม่ต้อง restart
2. **API Docs**: ใช้ Swagger UI ที่ `/docs` สำหรับทดสอบ API
3. **Database**: ข้อมูลเก็บใน Docker volume ไม่หายเมื่อ restart
4. **Logs**: ใช้ `docker-compose logs -f` เพื่อ debug
5. **Clean Start**: ใช้ `docker-compose down -v` เพื่อเริ่มใหม่หมด
6. **Widgets**: ทุก Widget มี error handling และ cache system
7. **localStorage**: Widgets ใช้ localStorage สำหรับ cache และ persistence
8. **TypeScript**: ตรวจสอบ types ด้วย `npm run type-check` (ใน frontend container)

### Security

1. **Passwords**: เปลี่ยนรหัสผ่าน default ทันที
2. **Tokens**: เก็บ tokens ใน localStorage (development) หรือ httpOnly cookies (production)
3. **CORS**: ตั้งค่า CORS ให้ถูกต้องใน production
4. **Environment Variables**: ใช้ `.env` files และไม่ commit ลง git
5. **Database**: Backup database เป็นประจำ

### Performance

1. **Docker**: ใช้ volume mounts สำหรับ development
2. **Next.js**: ใช้ Image Optimization และ Code Splitting
3. **FastAPI**: ใช้ async/await สำหรับ I/O operations
4. **Database**: สร้าง indexes สำหรับ queries ที่ใช้บ่อย
5. **Caching**: ใช้ Redis สำหรับ session และ cache (future)
6. **Widgets**: ใช้ localStorage cache เพื่อลด API calls
7. **Auto-refresh**: Weather Widget refresh ทุก 2 นาที (ปรับได้)

---

## 🎨 Widget Customization

### เปลี่ยน Weather Location

แก้ไขไฟล์ `frontend/src/components/Widgets/WeatherWidget.tsx`:

```typescript
// เปลี่ยนพิกัด (latitude, longitude)
const BANGKOK_LAT = 13.7563;  // เปลี่ยนเป็นพิกัดที่ต้องการ
const BANGKOK_LON = 100.5018; // เปลี่ยนเป็นพิกัดที่ต้องการ

// เปลี่ยนชื่อเมือง
<h3 className="text-lg font-semibold mb-2">กรุงเทพฯ</h3>
// เปลี่ยนเป็น
<h3 className="text-lg font-semibold mb-2">เชียงใหม่</h3>
```

### เปลี่ยน Auto-refresh Interval

แก้ไขไฟล์ `frontend/src/components/Widgets/WeatherWidget.tsx`:

```typescript
// เปลี่ยนจาก 2 นาที เป็น 5 นาที
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

// หรือปิด auto-refresh (ลบ useEffect)
// ลบหรือ comment out:
useEffect(() => {
  const timer = setInterval(() => {
    setCountdown(REFRESH_INTERVAL / 1000);
  }, 1000);
  return () => clearInterval(timer);
}, []);
```

### เปลี่ยนสี Widget

แก้ไขไฟล์ Widget ที่ต้องการ:

```typescript
// เปลี่ยนสีพื้นหลัง
<div className="bg-white rounded-lg shadow-md p-6">
// เป็น
<div className="bg-blue-50 rounded-lg shadow-md p-6">

// เปลี่ยนสีข้อความ
<h3 className="text-lg font-semibold mb-2">
// เป็น
<h3 className="text-lg font-semibold mb-2 text-blue-600">
```

### เพิ่ม Widget ใหม่

1. สร้างไฟล์ใหม่ใน `frontend/src/components/Widgets/`:

```typescript
// MyWidget.tsx
'use client';

import { useState, useEffect } from 'react';

export default function MyWidget() {
  const [data, setData] = useState(null);

  useEffect(() => {
    // Fetch data
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">My Widget</h3>
      {/* Widget content */}
    </div>
  );
}
```

2. เพิ่มใน Dashboard (`frontend/src/app/dashboard/page.tsx`):

```typescript
import MyWidget from '@/components/Widgets/MyWidget';

// เพิ่มใน JSX
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {/* Existing widgets */}
  <MyWidget />
</div>
```

### ปรับ Layout Dashboard

แก้ไขไฟล์ `frontend/src/app/dashboard/page.tsx`:

```typescript
// เปลี่ยนจาก 3 columns เป็น 4 columns
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

// หรือเปลี่ยน gap
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

// หรือใช้ different layout สำหรับ mobile/tablet/desktop
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
```

### ปรับ Cache Duration

แก้ไขไฟล์ Widget ที่ต้องการ:

```typescript
// Weather Widget - เปลี่ยนจาก 10 นาที เป็น 30 นาที
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Oil Price Widget - เปลี่ยนจาก 1 ชั่วโมง เป็น 2 ชั่วโมง
const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours
```

---

**Happy Coding! 🚀**

สำหรับคำถามหรือปัญหา ดูเอกสารเพิ่มเติมหรือติดต่อทีมพัฒนา
