# Design Spec: Profile & Notifications UX Redesign

## 1. Intent & Context
Users report that the current `/profile` page is overwhelming, cluttered, and difficult to navigate. The primary pain points are:
1. **Double-stacked tabs**: A primary segmented control (`ข้อมูลส่วนตัว & ความปลอดภัย` vs `ทางลัด & ปรับแต่งเมนู`) immediately sits atop a second sub-bar with 5 sub-tabs (`เมนูและทางลัด`, `รูปลักษณ์`, `การแจ้งเตือนและรูปแบบ`, `เชื่อมต่อ AI`, `ข้อมูล workspace`), creating visual noise and confusion.
2. **Misleading labels**: The tab labeled `ทางลัด & ปรับแต่งเมนู` hides Themes, Notifications, AI integration, and Workspace administration.
3. **Cluttered Notifications section**: `การแจ้งเตือนและรูปแบบ` bundles 4 disparate vertical cards, including `DateFormatCard` (date format & language display settings, which is not an alert).

## 2. Selected Approach: Single-Tier Clear Navigation + Notifications Overhaul
- **Approach 1 Selected**: Flatten all tabs into a single, intuitive Apple HIG segmented bar.
- **Scope**:
  - Flatten profile tabs to 4-5 direct, meaningful tabs.
  - Move Date & Language format (`DateFormatCard`) to Appearance & Display where it belongs.
  - Redesign the Notifications section into 3 cleanly grouped, cohesive blocks with enhanced UI clarity.

## 3. Detailed Architecture & Design

### 3.1 Unified Single-Level Tabs
The tabs navigation on `/profile` is simplified to:
1. 👤 **ข้อมูลส่วนตัว (Profile & Security)**:
   - Account Details (Name, Email, Role)
   - Password change
   - Two-Factor Authentication (2FA)
   - Active Sessions & Devices
   - (Simple sub-toggle: `ข้อมูลบัญชี` | `ความปลอดภัย`)
2. 🎨 **การแสดงผล & เมนู (Appearance & Menu)**:
   - Theme (Light / Dark / System) & Accent Color Picker
   - Regional & Date Format (`DateFormatCard`: พ.ศ./ค.ศ. and Thai/English)
   - Sidebar Main Menu reorder (Admin only) & Custom Quick Links
3. 🔔 **การแจ้งเตือน (Notifications)**:
   - Browser Web Push & Bell Sound
   - Daily Morning Briefing
   - External Channels (LINE / Telegram / Webhook)
4. 🤖 **เชื่อมต่อ AI (AI Services)**:
   - AI provider keys and model preferences
5. 🏢 **พื้นที่ทำงาน (Workspace)** *(Admin only)*:
   - Workspace Branding (Name & Logo)
   - Company Holiday Calendar
   - Workspace Backup & Export

### 3.2 Redesigned Notifications Section
Grouped into 3 structured, intuitive cards:

#### Block A: การแจ้งเตือนบนอุปกรณ์นี้ (In-App & Browser Alerts)
- **Web Push**:
  - Status pill badge (`เปิดใช้งานแล้ว` / `ถูกปิดกั้น` / `ไม่รองรับ`)
  - Instant "ทดสอบ" button with spinner
  - Switch toggle
- **เสียงกระดิ่ง (Bell Sound)**:
  - Description of sound trigger
  - Instant "ทดลองเสียง" button
  - Switch toggle
- **เตือนวันหยุดและวันสำคัญ (Holiday Alerts)**:
  - Advance 7-day reminder switch
- **เตือนรายการสิ่งที่ต้องทำ (Personal Reminder Alerts)**:
  - Personal task reminder switch

#### Block B: สรุปข้อมูลประจำวัน (Daily Morning Briefing)
- Header with unified Master Toggle switch (`เปิดใช้งานสรุปข่าวสารยามเช้า`)
- When enabled, clean interactive layout:
  - **เวลาจัดส่ง (Delivery Time)**: Pill selection for time slots (06:30, 07:00, 07:30, 08:00, 08:30, 09:00)
  - **หัวข้อที่ต้องการรับ (Topics)**: Multi-select interactive badge chips:
    - ⛽ ราคาน้ำมัน
    - ⛅ สภาพอากาศ
    - 📈 ดัชนีตลาด
    - 📝 สิ่งที่ต้องทำ
    - 📅 วันหยุด
  - **การทดสอบ**: Button "ส่งสรุปทดสอบตอนนี้" (Send test briefing)

#### Block C: ช่องทางแจ้งเตือนภายนอก (External Channels)
- Segmented channel switcher:
  - `LINE Notify / Webhook`
  - `Telegram Bot`
  - `Custom Webhook`
- Live connection badge (`🟢 เชื่อมต่อแล้ว` vs `⚪ ยังไม่เปิดใช้งาน`)
- Inset credentials fields (Token, Chat ID, Secret) with secure masking
- Event toggles (ราคาน้ำมัน, สรุปข่าว, ตลาด)
- Clear Test & Save buttons

### 3.3 State & URL Compatibility
- Support query params: `?tab=profile`, `?tab=appearance`, `?tab=notifications`, `?tab=ai`, `?tab=workspace`
- Backwards compatibility: `?tab=preferences` maps smoothly to `?tab=appearance`
- Preserves all existing APIs, localStorage syncing, and i18n support.

## 4. Verification Plan
1. **Automated Tests**:
   - `npm --prefix frontend test` (All 61 test suites / 396+ tests pass).
   - `npm --prefix frontend run type-check` (Clean TypeScript check).
   - Update tests for any modified tab labels or component structures.
2. **Visual & Interaction Checks**:
   - Verify single-layer tab switcher renders cleanly without nested duplicate bars.
   - Verify switching between tabs maintains state and URL query params.
   - Verify Notifications page displays all 3 blocks cleanly and test buttons trigger expected actions.
