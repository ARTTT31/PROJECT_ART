# ART Workspace

## Google OAuth (Sign in with Google)

Quick setup to enable Sign in with Google:

1. In Google Cloud Console, create OAuth Client ID and add:
   - Authorized JavaScript origin: `http://localhost:3001`
   - Authorized redirect URI: `http://localhost:8000/api/v1/auth/google/callback`
2. Add to backend `.env` (do NOT commit secrets):
   - BACKEND_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
   - BACKEND_GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET
   - BACKEND_GOOGLE_REDIRECT=http://localhost:8000/api/v1/auth/google/callback
   - FRONTEND_URL=http://localhost:3001
3. Rebuild and start docker-compose:

```bash
docker-compose up -d --build
```

4. Open frontend login page: `http://localhost:3001/login` and click "Sign in with Google".

Behavior:
- Clicking the button redirects to Google consent screen.
- After consenting, the backend creates or finds a user, issues JWT access and refresh tokens, and redirects to `http://localhost:3001/login-success?access_token=...&refresh_token=...&name=...`.
- Frontend saves tokens to localStorage and redirects to `/dashboard`.

Security notes:
- Keep `BACKEND_GOOGLE_CLIENT_SECRET` private and do not commit to repo.

 - Modern Stack Edition

โปรเจกต์นี้เป็นเวอร์ชันใหม่ของ ART Workspace ที่ใช้ **Next.js 14** (Frontend) + **FastAPI** (Backend) + **PostgreSQL** (Database) แทน Google Apps Script เพื่อความยืดหยุ่นและประสิทธิภาพที่ดีกว่า

## 🎯 ภาพรวมโปรเจกต์

**ART Workspace Modern Stack** เป็นระบบจัดการงานและโปรเจกต์แบบ full-stack ที่ออกแบบมาเพื่อ:
- ✅ ระบบ Authentication และ Session Management ที่ปลอดภัย
- ✅ Dashboard พร้อม Widgets แบบ Real-time
- ✅ Profile Management และ User Settings
- ✅ RESTful API ที่มาตรฐาน
- ✅ Responsive Design ทำงานได้ทุกอุปกรณ์
- ✅ Docker-based Development สำหรับ setup ง่าย

## 🏗️ Tech Stack

### Frontend
- **Next.js 14** - React framework พร้อม App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **React Hooks** - State management

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - ORM สำหรับ database
- **Alembic** - Database migration tool
- **Pydantic** - Data validation
- **JWT** - Token-based authentication

### Database
- **PostgreSQL 15** - Relational database
- **pgAdmin** (optional) - Database management UI

### DevOps
- **Docker & Docker Compose** - Containerization
- **Hot Reload** - Auto-reload เมื่อแก้โค้ด
- **Volume Mounts** - Sync code ระหว่าง host และ container

## 📁 โครงสร้างโปรเจกต์

```
PROJECT_ART/
├── frontend/                    # Next.js Frontend
│   ├── src/
│   │   ├── app/                # App Router pages
│   │   │   ├── login/          # หน้า Login
│   │   │   ├── dashboard/      # หน้า Dashboard
│   │   │   ├── profile/        # หน้า Profile
│   │   │   ├── layout.tsx      # Root layout
│   │   │   ├── page.tsx        # Home (redirect to login)
│   │   │   ├── globals.css     # Global styles
│   │   │   └── providers.tsx   # Context providers
│   │   ├── components/         # React components
│   │   │   ├── Layout/         # Layout components
│   │   │   │   ├── DashboardLayout.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   └── Sidebar.tsx
│   │   │   └── ...
│   │   └── hooks/              # Custom React hooks
│   │       └── useAuth.ts      # Authentication hook
│   ├── public/                 # Static assets
│   ├── .env.local              # Environment variables
│   ├── next.config.js          # Next.js config
│   ├── tailwind.config.ts      # Tailwind config
│   ├── tsconfig.json           # TypeScript config
│   ├── package.json            # Dependencies
│   └── Dockerfile              # Frontend container
│
├── backend/                     # FastAPI Backend
│   ├── app/
│   │   ├── api/                # API endpoints
│   │   │   └── v1/
│   │   │       ├── auth.py     # Authentication endpoints
│   │   │       ├── users.py    # User management
│   │   │       └── profile.py  # Profile endpoints
│   │   ├── core/               # Core functionality
│   │   │   ├── config.py       # Configuration
│   │   │   ├── security.py     # Security utilities
│   │   │   └── database.py     # Database connection
│   │   ├── models/             # SQLAlchemy models
│   │   │   ├── user.py         # User model
│   │   │   └── session.py      # Session model
│   │   ├── schemas/            # Pydantic schemas
│   │   │   ├── user.py         # User schemas
│   │   │   └── auth.py         # Auth schemas
│   │   └── main.py             # FastAPI app entry
│   ├── alembic/                # Database migrations
│   ├── requirements.txt        # Python dependencies
│   ├── Dockerfile              # Backend container
│   └── create_admin_simple.py  # Script สร้าง admin user
│
├── docker-compose.yml           # Docker orchestration
├── .gitignore                   # Git ignore rules
├── README.md                    # เอกสารนี้
├── QUICK_REFERENCE.md           # คู่มือใช้งานด่วน
├── GETTING_STARTED.md           # คู่มือเริ่มต้น
└── PROJECT_STRUCTURE.md         # โครงสร้างโปรเจกต์แบบละเอียด
```

## 🚀 Quick Start

### ข้อกำหนดเบื้องต้น

- **Docker Desktop** (Windows/Mac) หรือ **Docker Engine** (Linux)
- **Git** สำหรับ clone repository
- **Port ว่าง**: 3000 (Frontend), 8000 (Backend), 5432 (PostgreSQL)

### การติดตั้งและรัน

1. **Clone repository**
```bash
cd PROJECT_ART
```

2. **เริ่มต้นใช้งาน (ครั้งแรก)**
```bash
# Start all services
docker-compose up -d

# รอ containers เริ่มต้น (ประมาณ 30 วินาที)
docker-compose logs -f

# สร้าง admin user
docker-compose exec -T backend python create_admin_simple.py
```

3. **เข้าใช้งาน**
- Frontend: http://localhost:3000
- Backend API Docs: http://localhost:8000/docs
- Login ด้วย:
  - Email: `admin@art.com`
  - Password: `Admin@123`

### คำสั่งที่ใช้บ่อย

```bash
# เริ่ม services
docker-compose up -d

# ดู logs
docker-compose logs -f
docker-compose logs -f frontend
docker-compose logs -f backend

# หยุด services
docker-compose stop

# หยุดและลบ containers
docker-compose down

# Restart service
docker-compose restart frontend
docker-compose restart backend

# Rebuild image
docker-compose up -d --build frontend
docker-compose up -d --build backend
```

## 🔐 Authentication Flow

1. **Login** - User ส่ง email/password ไปที่ `/api/v1/auth/login`
2. **Backend** - ตรวจสอบ credentials และสร้าง JWT token
3. **Response** - ส่ง `access_token`, `refresh_token`, `session_id` และ `user` data กลับ
4. **Frontend** - เก็บ tokens ใน `localStorage` และ redirect ไป `/dashboard`
5. **Protected Routes** - ทุก request ส่ง `Authorization: Bearer <token>` header
6. **Session Check** - Backend ตรวจสอบ token และ session validity

### localStorage Keys
- `access_token` - JWT access token (30 นาที)
- `refresh_token` - JWT refresh token (7 วัน)
- `session_id` - Session identifier
- `user` - User data (JSON string)

## 📊 Database Schema

### users table
| Column | Type | Description |
|--------|------|-------------|
| id | Integer | Primary key |
| email | String | Unique email (login) |
| hashed_password | String | Bcrypt hashed password |
| name | String | Display name |
| role | String | user/admin |
| avatar | Text | Avatar URL or base64 |
| is_active | Boolean | Account status |
| created_at | DateTime | Created timestamp |
| updated_at | DateTime | Updated timestamp |

### sessions table
| Column | Type | Description |
|--------|------|-------------|
| id | Integer | Primary key |
| session_id | String | Unique session ID |
| user_id | Integer | Foreign key to users |
| user_agent | String | Browser info |
| ip_address | String | Client IP |
| is_active | Boolean | Session status |
| expires_at | DateTime | Expiry time |
| created_at | DateTime | Created timestamp |

## 🛠️ Development Workflow

### 1. แก้ไข Frontend

```bash
# แก้ไฟล์ใน frontend/src/
# Hot reload จะทำงานอัตโนมัติ
# ดู logs
docker-compose logs -f frontend
```

### 2. แก้ไข Backend

```bash
# แก้ไฟล์ใน backend/app/
# Uvicorn จะ reload อัตโนมัติ
# ดู logs
docker-compose logs -f backend
```

### 3. Database Migration

```bash
# สร้าง migration ใหม่
docker-compose exec backend alembic revision --autogenerate -m "description"

# รัน migrations
docker-compose exec backend alembic upgrade head

# Rollback
docker-compose exec backend alembic downgrade -1
```

### 4. ทดสอบ API

เปิด Swagger UI: http://localhost:8000/docs

หรือใช้ curl:
```bash
# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@art.com","password":"Admin@123"}'

# Get profile (ต้องมี token)
curl -X GET http://localhost:8000/api/v1/profile/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Running tests (backend)

Run backend unit tests with pytest:

```bash
# from repository root
pytest -q

# or to run only backend tests
pytest backend -q
```

## 🐛 Troubleshooting

### Port ถูกใช้งานอยู่

```bash
# Windows - ดู process ที่ใช้ port
netstat -ano | findstr :3000
netstat -ano | findstr :8000
netstat -ano | findstr :5432

# หยุด process
taskkill /PID <PID> /F
```

### Frontend ไม่ทำงาน

```bash
# ดู logs
docker-compose logs frontend

# Restart
docker-compose restart frontend

# Rebuild
docker-compose down
docker-compose up -d --build frontend
```

### Backend ไม่ทำงาน

```bash
# ดู logs
docker-compose logs backend

# เข้าไปใน container
docker-compose exec backend bash

# Restart
docker-compose restart backend
```

### Database connection error

```bash
# ตรวจสอบ PostgreSQL
docker-compose ps postgres

# Restart
docker-compose restart postgres

# เข้าไปดู database
docker-compose exec postgres psql -U art_user -d art_workspace
```

### ลบทุกอย่างและเริ่มใหม่

```bash
# หยุดและลบทุกอย่าง (รวม volumes)
docker-compose down -v

# ลบ images
docker-compose down --rmi all -v

# เริ่มใหม่
docker-compose up -d --build

# สร้าง admin user ใหม่
docker-compose exec -T backend python create_admin_simple.py
```

### Login ไม่ได้

1. ตรวจสอบว่า backend ทำงานอยู่: http://localhost:8000/docs
2. เปิด DevTools (F12) → Network tab ดู request/response
3. ตรวจสอบ localStorage keys: `access_token`, `user`
4. ลอง clear localStorage และ login ใหม่
5. ตรวจสอบ credentials: `admin@art.com` / `Admin@123`

## 📝 API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/logout` - Logout
- `POST /api/v1/auth/refresh` - Refresh token

### Profile
- `GET /api/v1/profile/me` - Get current user profile
- `PUT /api/v1/profile/me` - Update profile
- `POST /api/v1/profile/change-password` - Change password

### Users (Admin only)
- `GET /api/v1/users/` - List all users
- `GET /api/v1/users/{id}` - Get user by ID
- `POST /api/v1/users/` - Create new user
- `PUT /api/v1/users/{id}` - Update user
- `DELETE /api/v1/users/{id}` - Delete user

## 🎨 UI Components

### หน้า Login
- Modern gradient background พร้อม animated blobs
- Glassmorphism card design
- Email/Password inputs พร้อม icons
- Password validation (อย่างน้อย 6 ตัวอักษร)
- Show/Hide password toggle
- Caps Lock warning
- Remember me checkbox
- Loading state พร้อม spinner
- Rate limit feedback (นับถอยหลัง countdown เมื่อถูก 429)
- Error messages แบบ inline
- Client-side navigation ด้วย Next.js router

### หน้า Dashboard
- Welcome bar พร้อม greeting ตามเวลา
- **Weather Widget** - Real-time weather data (Open-Meteo API)
  - Auto-detect GPS location เมื่อเปิดหน้า (ขอ permission อัตโนมัติ)
  - แสดงชื่อเขต + จังหวัด จาก reverse geocoding (BigDataCloud API)
  - Current weather, UV Index, ความชื้น, ลม
  - **PM2.5 Bar Indicator** - แสดงค่าฝุ่น µg/m³ พร้อม color-coded bar และระดับคุณภาพอากาศ
  - Temperature range bar
  - Auto-refresh every 2 minutes
  - ค้นหาตำแหน่งด้วย geocoding search
- **รายการงาน Widget** - ดึงข้อมูลจาก Google Calendar (iCal feed)
  - กรองหลัก: ทั้งหมด / IMACD / ธัญพงศ์ (ค้นหาจากทั้ง title และ description)
  - กรองรอง: ประเภทงาน (DEMO, Installation, Training, Onsite Services ฯลฯ)
  - งานที่มี tag IMACD หรือ ธัญพงศ์ จะแสดงเสมอ ไม่ถูกกรองทิ้งโดย category filter
  - รองรับ all-day events ด้วย timezone Asia/Bangkok
  - ค้นหาข้อความใน title, description, location
- **ปฏิทิน Widget** - Google Calendar Embed พร้อม navigation เดือน
  - Shared selectedMonth state กับ รายการงาน Widget

### หน้า Profile
- Profile card พร้อม avatar
- Update profile form
- Change password form พร้อม strength meter
- Login history
- Last login info

## 🔄 ความแตกต่างจากโปรเจกต์หลัก

| Feature | โปรเจกต์หลัก (Google Apps Script) | PROJECT_ART (Modern Stack) |
|---------|-----------------------------------|----------------------------|
| Frontend | Vanilla JS + AdminLTE | Next.js 14 + TypeScript |
| Backend | Google Apps Script | FastAPI + Python |
| Database | Google Sheets | PostgreSQL |
| Auth | Custom session | JWT + Session |
| Deployment | Google Drive | Docker containers |
| API | Web App URL | RESTful API |
| Hot Reload | ❌ | ✅ |
| Type Safety | ❌ | ✅ TypeScript |
| Database Migration | ❌ | ✅ Alembic |
| API Documentation | ❌ | ✅ Swagger UI |

## 📚 เอกสารเพิ่มเติม

- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - คู่มือใช้งานด่วน พร้อม troubleshooting
- [PRODUCT.md](PRODUCT.md) - ข้อมูลผลิตภัณฑ์และ Design Principles
- [GOOGLE_CALENDAR_SETUP.md](GOOGLE_CALENDAR_SETUP.md) - คู่มือตั้งค่า Google Calendar Integration
- [ACCESSIBILITY_IMPLEMENTATION_COMPLETE.md](ACCESSIBILITY_IMPLEMENTATION_COMPLETE.md) - สรุปงาน Accessibility (WCAG AAA)

## 🎯 Roadmap

### ✅ Phase 1 - Core Features (Complete)
- [x] ระบบ Login/Authentication
- [x] Dashboard พื้นฐาน
- [x] Profile Management
- [x] Session Management
- [x] JWT Token Authentication
- [x] Docker Setup
- [x] Hot Reload Development

### ✅ Phase 2 - Dashboard Widgets (Complete)
- [x] Weather Widget
  - [x] Open-Meteo API, UV Index, ความชื้น, ลม
  - [x] PM2.5 Bar Indicator พร้อม color scale และ threshold ticks
  - [x] Auto GPS location detection เมื่อโหลดหน้า
  - [x] แสดงชื่อเขต + จังหวัด (reverse geocoding)
  - [x] Search location ด้วย geocoding API
- [x] Calendar Widget (Google Calendar Embed + month navigation)
- [x] TaskList Widget (Google Calendar iCal feed)
  - [x] Filter IMACD / ธัญพงศ์ จาก title และ description
  - [x] Category filter รอง (DEMO, Installation ฯลฯ)
  - [x] Tagged events ผ่าน category filter เสมอ
  - [x] รองรับ all-day events ด้วย Asia/Bangkok timezone

### 📝 Phase 3 - Advanced Features (Next)
- [ ] User Management (Admin Panel)
- [ ] File Upload & Management
- [ ] Email Notifications
- [ ] Activity Logs & Audit Trail
- [ ] Advanced Dashboard Features (Charts, Analytics)
- [ ] Widget Settings & Customization
- [ ] Testing Suite (Unit, Integration, E2E)
- [ ] CI/CD Pipeline
- [ ] Production Deployment
- [ ] Mobile Responsive Improvements

## 🤝 Contributing

1. Fork repository
2. สร้าง feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. เปิด Pull Request

## 📄 License

This project is private and proprietary.

## 👥 Team

- **Developer**: ART Workspace Team
- **Project**: ART Workspace Modern Stack
- **Version**: 2.1.0
- **Last Updated**: June 2026

---

**Happy Coding! 🚀**

สำหรับคำถามหรือปัญหา กรุณาติดต่อทีมพัฒนา
