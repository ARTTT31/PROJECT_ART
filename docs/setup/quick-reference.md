# Quick Reference - ART Workspace Modern Stack

## ✅ System Ready!

### 🌐 Important URLs

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

**⚠️ Important**: 
- Change password after first login!
- Use this email/password for development only.
- Production requires creating a new admin user and deleting the default admin.

---

## 📋 Frequently Used Commands

### Initial Setup (First Time)

```bash
# 1. Enter project folder
cd PROJECT_ART

# 2. Start all services (downloads images and builds on first run)
docker-compose up -d

# 3. Wait for services to start (approx 30-60 seconds)
docker-compose logs -f

# 4. Create admin user (Press Ctrl+C to exit logs first)
docker-compose exec -T backend python create_admin_simple.py

# 5. Open browser to http://localhost:3000/login
# Login with admin@art.com / Admin@123
```

### Daily Startup

```bash
# Enter project folder
cd PROJECT_ART

# Start services (faster than first time)
docker-compose up -d

# View logs (optional)
docker-compose logs -f

# Open browser to http://localhost:3000/login
```

### View Logs and Debug

```bash
# View all logs (real-time)
docker-compose logs -f

# View frontend logs only
docker-compose logs -f frontend

# View backend logs only
docker-compose logs -f backend

# View database logs only
docker-compose logs -f postgres

# View last 50 lines of logs
docker logs art_frontend --tail 50
docker logs art_backend --tail 50

# View container status
docker-compose ps
```

### Stop and Remove

```bash
# Stop services (keep data)
docker-compose stop

# Stop and remove containers (keep database data)
docker-compose down

# Stop and remove containers + volumes (⚠️ Deletes database data)
docker-compose down -v

# Remove images too (for complete rebuild)
docker-compose down --rmi all -v
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart frontend only
docker-compose restart frontend

# Restart backend only
docker-compose restart backend

# Restart database only
docker-compose restart postgres
```

### Rebuild Services

```bash
# Rebuild frontend (when Dockerfile or dependencies change)
docker-compose up -d --build frontend

# Rebuild backend
docker-compose up -d --build backend

# Rebuild all
docker-compose up -d --build

# Clean build without cache
docker-compose build --no-cache frontend
docker-compose up -d frontend
```

### Database Management

```bash
# Enter PostgreSQL shell
docker-compose exec postgres psql -U art_user -d art_workspace

# psql commands:
\dt                    # Show all tables
\d users               # Show schema of users table
SELECT * FROM users;   # View users data
\q                     # Exit psql

# Create new migration
docker-compose exec backend alembic revision --autogenerate -m "add new field"

# Run migrations
docker-compose exec backend alembic upgrade head

# Rollback migration
docker-compose exec backend alembic downgrade -1

# View migration history
docker-compose exec backend alembic history

# View current revision
docker-compose exec backend alembic current
```

### Create Additional Users

```bash
# Create admin user (using script)
docker-compose exec -T backend python create_admin_simple.py

# Or create via API (requires admin login first)
# See examples in API Documentation: http://localhost:8000/docs
```

### Accessing Containers

```bash
# Enter frontend container
docker-compose exec frontend sh

# Enter backend container
docker-compose exec backend bash

# Enter postgres container
docker-compose exec postgres bash

# Exit container
exit
```

---

## 🔧 Troubleshooting

### Port is already in use

If port 3000, 8000, or 5432 is in use:

```bash
# Windows - View process using the port
netstat -ano | findstr :3000
netstat -ano | findstr :8000
netstat -ano | findstr :5432

# Kill process (use PID from above command)
taskkill /PID <PID> /F

# Or change port in docker-compose.yml
# e.g. "3001:3000" instead of "3000:3000"
```

### Frontend is not working

```bash
# 1. View logs
docker-compose logs frontend

# 2. Check if container is running
docker-compose ps

# 3. Restart frontend
docker-compose restart frontend

# 4. If still not working, remove .next cache and rebuild
docker-compose down
docker volume prune -f
docker-compose up -d --build frontend

# 5. Check if http://localhost:3000 is accessible
```

### Backend is not working

```bash
# 1. View logs
docker-compose logs backend

# 2. Check if database is ready
docker-compose ps postgres

# 3. Restart backend
docker-compose restart backend

# 4. If still not working, rebuild
docker-compose up -d --build backend

# 5. Check if http://localhost:8000/docs is accessible
```

### Database connection error

```bash
# 1. Check PostgreSQL
docker-compose ps postgres

# 2. View logs
docker-compose logs postgres

# 3. Restart PostgreSQL
docker-compose restart postgres

# 4. Check inside container
docker-compose exec postgres psql -U art_user -d art_workspace

# 5. If still not working, remove and recreate
docker-compose down -v
docker-compose up -d
docker-compose exec -T backend python create_admin_simple.py
```

### Cannot Login

```bash
# 1. Check if backend is running
curl http://localhost:8000/docs

# 2. Check if admin user exists
docker-compose exec postgres psql -U art_user -d art_workspace -c "SELECT email, name, role FROM users;"

# 3. If missing, recreate
docker-compose exec -T backend python create_admin_simple.py

# 4. Open DevTools (F12) → Network tab to view request/response

# 5. Check localStorage
# Open DevTools → Application → Local Storage
# Should contain keys: access_token, user, refresh_token, session_id

# 6. Try clearing localStorage and logging in again
localStorage.clear()
```

### Hydration Error (Next.js)

```bash
# 1. Remove .next cache
docker-compose down
docker volume prune -f

# 2. Rebuild frontend
docker-compose up -d --build frontend

# 3. Hard refresh browser (Ctrl+Shift+R)
```

### Delete Everything and Start Over

```bash
# ⚠️ Warning: Will delete all database data!

# 1. Stop and remove everything
docker-compose down -v

# 2. Remove images (optional)
docker-compose down --rmi all -v

# 3. Remove dangling volumes
docker volume prune -f

# 4. Start over
docker-compose up -d --build

# 5. Wait for services to start
docker-compose logs -f

# 6. Create new admin user
docker-compose exec -T backend python create_admin_simple.py

# 7. Open browser to http://localhost:3000/login
```

### Widgets Not Showing Data

```bash
# Weather Widget not showing data:
# 1. Open DevTools → Network tab
# 2. View request to Open-Meteo API
# 3. If CORS error → Check API endpoint
# 4. If timeout → Try refreshing or wait a moment
# 5. Check localStorage → weather_cache

# Oil Price Widget not showing data:
# 1. Open DevTools → Network tab
# 2. View request to Thai Oil API
# 3. If CORS error → Widget will use fallback proxy
# 4. If all proxies fail → Shows error message
# 5. Check localStorage → oil_price_cache

# Todo Widget not saving data:
# 1. Open DevTools → Application → Local Storage
# 2. Check for "todos" key
# 3. If missing → localStorage might be blocked
# 4. Try clearing localStorage and adding a new todo
# 5. Check Console → Should have no localStorage errors

# Calculator Widget not working:
# 1. Check Console → Should have no JavaScript errors
# 2. Try refreshing page (Ctrl+R)
# 3. Test with mouse and keyboard separately

# Barcode/QR Widget not generating:
# 1. Check Console → Should have no Canvas errors
# 2. Try refreshing page (Ctrl+R)
# 3. Try changing text and generating again
# 4. Download/Copy/Share might not work on HTTP (HTTPS required)
```

### Widget Performance Issues

```bash
# Widgets loading slowly:
# 1. Check Network tab → View API response time
# 2. Weather Widget: Open-Meteo API should respond within 1-2 seconds
# 3. Oil Price Widget: Thai Oil API might be slow, uses cache
# 4. Try clearing localStorage cache and refreshing

# Widgets using high memory:
# 1. Open DevTools → Performance tab
# 2. Record and view memory usage
# 3. Todo Widget: Might be slow with many todos (>1000)
# 4. Try clearing completed todos

# Auto-refresh causing slowdown:
# 1. Weather Widget refreshes every 2 minutes
# 2. To disable → Edit WeatherWidget.tsx
# 3. Change REFRESH_INTERVAL or remove useEffect
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
  "message": "Login successful",
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

### Profile (requires login)

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

### 1. Start of Day

```bash
cd PROJECT_ART
docker-compose up -d
docker-compose logs -f
```

### 2. Frontend Development

```bash
# Edit code in frontend/src/
# Hot reload will work automatically
# View logs to debug
docker-compose logs -f frontend
```

### 3. Backend Development

```bash
# Edit code in backend/app/
# Uvicorn will auto-reload
# View logs to debug
docker-compose logs -f backend
```

### 4. Testing API

```bash
# Open Swagger UI
open http://localhost:8000/docs

# Or use curl
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@art.com","password":"Admin@123"}'
```

### 5. Database Changes

```bash
# Edit models in backend/app/models/

# Create migration
docker-compose exec backend alembic revision --autogenerate -m "add new field"

# Run migration
docker-compose exec backend alembic upgrade head

# Check in database
docker-compose exec postgres psql -U art_user -d art_workspace
```

### 6. End of Day

```bash
# Stop services (keep data)
docker-compose stop

# Or leave running (uses resources)
```

---

## 🎯 Next Steps

### ✅ Completed
1. ✅ Login/Authentication System
2. ✅ Basic Dashboard
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

### 📝 Up Next
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
- **API**: Open-Meteo (Free, no API key required)
- **Features**:
  - Current weather (Temperature, Humidity, Wind, Pressure)
  - UV Index with color emoji (🟢🟡🟠🔴🟣)
  - Sunrise/Sunset time (Local time)
  - Visibility (km)
  - PM2.5 & AQI (Air Quality)
  - 7-day forecast
  - Auto-refresh every 2 minutes with countdown
  - Cache system (localStorage)
- **Location**: Bangkok (13.7563°N, 100.5018°E)

### Oil Price Widget
- **API**: Thai Oil API (Free)
- **Features**:
  - All fuel prices (Gasohol, Diesel, NGV, LPG)
  - Price Change Indicator (↑↓)
  - Change Percentage (%)
  - Comparison with previous price
  - Colors based on change (Red=Up, Green=Down)
  - Fallback proxies (3 levels)
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
- **Technology**: Canvas-based (no library installation required)
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
# 1. Start services
cd PROJECT_ART
docker-compose up -d

# 2. Open browser to Dashboard
open http://localhost:3000/dashboard

# 3. Test each Widget:

# Weather Widget:
# - Check if current weather displays
# - Verify UV Index, Sunrise/Sunset, PM2.5
# - Watch auto-refresh countdown
# - Verify 7-day forecast

# Oil Price Widget:
# - View all fuel prices
# - Verify Price Change Indicator (↑↓)
# - View Change Percentage (%)

# Todo Widget:
# - Add new todo
# - Mark as complete/incomplete
# - Edit todo (double-click)
# - Delete todo
# - Filter (All/Active/Completed)
# - Clear completed

# Calculator Widget:
# - Calculate using mouse
# - Test keyboard (0-9, +, -, *, /, Enter, Esc)
# - Test decimal, percentage, toggle sign

# Barcode/QR Widget:
# - Generate barcode/QR code
# - Change color
# - Download PNG
# - Copy to clipboard
# - Share (if supported by browser)
# - Print

# 4. Check localStorage
# Open DevTools (F12) → Application → Local Storage
# Should contain keys:
# - weather_cache
# - oil_price_cache
# - todos

# 5. Check Console
# Open DevTools (F12) → Console
# Should have no errors (except handled API errors)
```

---

## 📚 Additional Documentation

- `README.md` - Project Overview and Tech Stack
- `GETTING_STARTED.md` - Detailed Starter Guide
- `PROJECT_STRUCTURE.md` - Project Structure
- `PHASE2_COMPLETE.md` - Phase 2 Dashboard Widgets Summary
- `WIDGET_IMPLEMENTATION_SUMMARY.md` - Widgets Details
- `CHANGELOG_WIDGETS.md` - Widgets Changelog
- `docs/MIGRATION.md` - Migration Guide from main project
- `docs/API.md` - API Documentation
- `docs/DEPLOYMENT.md` - Deployment Guide

---

## 💡 Tips & Best Practices

### Development

1. **Hot Reload**: Code changes will auto-reload without restarting
2. **API Docs**: Use Swagger UI at `/docs` to test APIs
3. **Database**: Data is stored in Docker volumes and persists across restarts
4. **Logs**: Use `docker-compose logs -f` to debug
5. **Clean Start**: Use `docker-compose down -v` to start completely fresh
6. **Widgets**: Every Widget has error handling and caching
7. **localStorage**: Widgets use localStorage for caching and persistence
8. **TypeScript**: Check types using `npm run type-check` (in frontend container)

### Security

1. **Passwords**: Change default passwords immediately
2. **Tokens**: Store tokens in localStorage (development) or httpOnly cookies (production)
3. **CORS**: Configure CORS correctly in production
4. **Environment Variables**: Use `.env` files and never commit to git
5. **Database**: Backup database regularly

### Performance

1. **Docker**: Use volume mounts for development
2. **Next.js**: Use Image Optimization and Code Splitting
3. **FastAPI**: Use async/await for I/O operations
4. **Database**: Create indexes for frequently used queries
5. **Caching**: Use Redis for session and caching (future)
6. **Widgets**: Use localStorage cache to reduce API calls
7. **Auto-refresh**: Weather Widget refreshes every 2 minutes (customizable)

---

## 🎨 Widget Customization

### Change Weather Location

Edit `frontend/src/components/Widgets/WeatherWidget.tsx`:

```typescript
// Change coordinates (latitude, longitude)
const BANGKOK_LAT = 13.7563;  // Change to desired latitude
const BANGKOK_LON = 100.5018; // Change to desired longitude

// Change city name
<h3 className="text-lg font-semibold mb-2">Bangkok</h3>
// To
<h3 className="text-lg font-semibold mb-2">Chiang Mai</h3>
```

### Change Auto-refresh Interval

Edit `frontend/src/components/Widgets/WeatherWidget.tsx`:

```typescript
// Change from 2 minutes to 5 minutes
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Or disable auto-refresh (remove useEffect)
// Remove or comment out:
useEffect(() => {
  const timer = setInterval(() => {
    setCountdown(REFRESH_INTERVAL / 1000);
  }, 1000);
  return () => clearInterval(timer);
}, []);
```

### Change Widget Color

Edit desired Widget file:

```typescript
// Change background color
<div className="bg-white rounded-lg shadow-md p-6">
// To
<div className="bg-blue-50 rounded-lg shadow-md p-6">

// Change text color
<h3 className="text-lg font-semibold mb-2">
// To
<h3 className="text-lg font-semibold mb-2 text-blue-600">
```

### Add New Widget

1. Create new file in `frontend/src/components/Widgets/`:

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

2. Add to Dashboard (`frontend/src/app/dashboard/page.tsx`):

```typescript
import MyWidget from '@/components/Widgets/MyWidget';

// Add to JSX
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {/* Existing widgets */}
  <MyWidget />
</div>
```

### Adjust Dashboard Layout

Edit `frontend/src/app/dashboard/page.tsx`:

```typescript
// Change from 3 columns to 4 columns
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

// Or change gap
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

// Or use different layout for mobile/tablet/desktop
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
```

### Adjust Cache Duration

Edit desired Widget file:

```typescript
// Weather Widget - Change from 10 minutes to 30 minutes
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Oil Price Widget - Change from 1 hour to 2 hours
const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours
```

---

**Happy Coding! 🚀**

For questions or issues, refer to additional documentation or contact the development team.
