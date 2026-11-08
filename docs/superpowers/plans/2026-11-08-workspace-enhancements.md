# Plan: ART Workspace Enhancements (Multi-Dashboard Tabs, Self-Service Notifications, AI Daily Digest, Finance Export)

## 1. Overview & Scope
Implement the 4 agreed-upon productivity and personalization features for ART Workspace:
1. **Finance CSV Export**: Export personal income/expense data to `.csv` with UTF-8 BOM for Microsoft Excel Thai language compatibility.
2. **Multi-Dashboard Tabs / Views**: Switchable segmented dashboard views (Overview, Work, Finance) with view-specific layouts and smooth Apple HIG transitions.
3. **Self-Service External Notifications**: Per-user configuration card in `/profile` to connect LINE Notify / Telegram / Webhook with test notification dispatching.
4. **AI Daily Digest Widget**: Smart executive briefing widget synthesizing real-time weather, oil price shifts, market summary, and today's pending tasks.

---

## 2. Tasks & Step-by-Step Implementation

### Feature 1: Finance CSV Export
- **File**: `frontend/src/utils/financeExport.ts`
  - Function `exportFinanceToCsv(entries: FinanceEntry[], filename?: string): void`
  - Generates RFC 4180 compliant CSV string prefixed with UTF-8 BOM (`\uFEFF`)
  - Columns: `วันที่`, `เวลา`, `ประเภท`, `หมวดหมู่`, `รายการ`, `จำนวนเงิน (บาท)`
  - Formats date into Thai readable format
  - Triggers browser download via blob URL
- **Test**: `frontend/src/utils/financeExport.test.ts`
  - Tests CSV escaping (commas, quotes, newlines), BOM inclusion, date formatting
- **UI Integration**:
  - `frontend/src/components/Widgets/FinanceWidget.tsx`: Add download CSV button next to "สรุปยอด"
  - `frontend/src/components/Widgets/FinanceSummaryDialog.tsx`: Add "ดาวน์โหลด CSV" button in dialog footer

### Feature 2: Multi-Dashboard Tabs / Views
- **File**: `frontend/src/hooks/useDashboardLayout.ts`
  - Add type `DashboardView = 'overview' | 'work' | 'finance'`
  - Add view presets filtering active widgets:
    - `overview`: all enabled widgets
    - `work`: `quicknotes`, `focustimer`, `personalreminders`, `calendar`, `qrcode`
    - `finance`: `finance`, `market`, `watchlist`, `oilprice`, `currency`, `pricecalc`
  - Provide `currentView`, `setCurrentView`, and view-filtered `activeWidgets`
- **UI Integration**:
  - `frontend/src/app/(main)/dashboard/page.tsx`: Render Apple HIG segmented control pills at the top of the dashboard
  - Add smooth transition when switching views

### Feature 3: Self-Service External Notifications (LINE / Telegram / Webhook)
- **Backend Model & Schema**:
  - `backend/app/models/user.py`: Add `external_notifications: Mapped[str | None] = mapped_column(Text)`
  - `backend/app/schemas/user.py`: Add `ExternalNotificationSettings` and `ExternalNotificationsUpdate`
  - `backend/app/api/v1/endpoints/profile.py`:
    - Add `PATCH /profile/external-notifications`
    - Add `POST /profile/external-notifications/test` to dispatch test alerts to LINE / Telegram / Webhook
  - Alembic migration for SQLite: `alembic revision --autogenerate -m "add external_notifications to user"` & `alembic upgrade head`
- **Frontend UI**:
  - `frontend/src/components/Profile/ExternalNotificationCard.tsx`:
    - Clean SectionCard with `@icons-pack/react-simple-icons` (`SiLine`, `SiTelegram`)
    - Inputs for LINE Token, Telegram Bot Token & Chat ID, Webhook URL
    - Checkboxes for notification topics (Oil Price changes, Market targets, Daily summaries)
    - "ทดสอบส่งการแจ้งเตือน" button with loading state and toast feedback
  - Integrate into `frontend/src/app/(main)/profile/page.tsx`

### Feature 4: AI Daily Digest / Smart Briefing Widget
- **File**: `frontend/src/components/Widgets/DailyDigestWidget.tsx`
  - Reads current weather, today's oil price changes, market summary, and today's tasks
  - Synthesizes an executive daily briefing card
  - Apple HIG card with refresh button and springy interactions
- **Registration**:
  - Register in `frontend/src/app/(main)/dashboard/page.tsx` widget catalogue
  - Add skeleton in `Skeletons.tsx`

---

## 3. Verification & Acceptance Criteria
- `npm run type-check`: 0 errors
- `npm run lint`: 0 errors
- Vitest: All existing and new unit tests pass (100% green)
- Backend Pytest: All tests pass
