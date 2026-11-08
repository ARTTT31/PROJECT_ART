# AI Copilot & Daily Card Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the AI Copilot Assistant (interactive Thai workspace copilot with command execution) and the One-Click Daily Card Image Generator (high-res Apple HIG card rendering for LINE sharing).

**Architecture:**
1. **Backend AI Chat Endpoint (`/api/v1/ai/chat`)**: Receives conversational queries with workspace context (weather, oil, SET, tasks). If `GEMINI_API_KEY` is set, uses Gemini API; otherwise utilizes a smart Thai natural-language intent engine with structured workspace action returns (`add_note`, `add_reminder`, `get_summary`).
2. **Frontend Daily Card Generator (`cardGenerator.ts`)**: Generates an Apple HIG styled high-resolution infographic card using the built-in HTML Canvas API (zero extra dependencies, senior minimalist approach). Supports downloading PNG or mobile native sharing via `navigator.share`.
3. **Frontend AI Copilot Drawer (`AICopilotDrawer.tsx`)**: Bottom-right floating trigger with spring animation. Offers suggested prompt chips, markdown message rendering, and automatically syncs actions (like adding notes or reminders) into user storage.

**Tech Stack:**
- Backend: FastAPI, Pydantic, Python 3.11, `httpx`.
- Frontend: Next.js 15, TypeScript, Tailwind CSS, Lucide icons, Canvas API.

---

## Global Constraints
- **Ponytail Principle**: Use standard HTML5 Canvas API without installing bloat libraries like `html2canvas`.
- **Apple HIG**: `rounded-[18px]`, `border-[var(--hairline)]`, `bg-[var(--glass-95)]`, `active:scale-[0.95]`.
- **Zero Test Regression**: All existing 343 frontend tests and 532 backend tests must continue passing.

## Review Focus
1. Canvas rendering must support crisp Retina displays (`scale = 2` for high-DPI clarity).
2. Thai font rendering on canvas must fallback cleanly (`system-ui, -apple-system, Sarabun, sans-serif`).
3. AI Copilot must work seamlessly whether `GEMINI_API_KEY` is present or absent (built-in fallback intent parser).
4. Actions proposed by AI (e.g. adding a note) must validate data schema before updating local storage / API.
5. Floating Copilot button must not block essential mobile controls or the PWA install prompt.

---

### Task 1: Backend AI Settings & Chat Endpoint (`/api/v1/ai/chat`)

**Files:**
- Modify: `backend/app/core/config.py`
- Create: `backend/app/api/v1/endpoints/ai.py`
- Modify: `backend/app/api/v1/router.py`
- Create: `backend/tests/test_ai_endpoint.py`

- [ ] Add `GEMINI_API_KEY: str = ""` to `Settings` in `config.py`.
- [ ] Implement `backend/app/api/v1/endpoints/ai.py` with intent recognition for Thai workspace queries (summary, notes, reminders, oil, weather) and optional Gemini API forwarding.
- [ ] Register router in `backend/app/api/v1/router.py`.
- [ ] Write tests in `backend/tests/test_ai_endpoint.py` and verify with `pytest backend/tests/test_ai_endpoint.py --no-cov`.

---

### Task 2: Daily Digest Card Image Generator (`cardGenerator.ts`)

**Files:**
- Create: `frontend/src/utils/cardGenerator.ts`
- Create: `frontend/src/utils/cardGenerator.test.ts`
- Modify: `frontend/src/components/Widgets/DailyDigestWidget.tsx`

- [ ] Implement `renderDailyCard(data, preferences)` rendering crisp Apple HIG card onto an offscreen canvas and returning a Blob / PNG DataURL.
- [ ] Implement `shareOrDownloadCard(blob, filename)` with `navigator.share` on mobile and direct download on desktop.
- [ ] Add "แชร์ภาพการ์ด" button with `Share2` icon in `DailyDigestWidget.tsx`.
- [ ] Write unit test in `cardGenerator.test.ts` verifying canvas generation.
- [ ] Run `npm --prefix frontend test -- src/utils/cardGenerator.test.ts`.

---

### Task 3: AI Copilot Assistant Drawer Component

**Files:**
- Create: `frontend/src/components/AICopilot/AICopilotDrawer.tsx`
- Create: `frontend/src/components/AICopilot/AICopilotDrawer.test.tsx`
- Modify: `frontend/src/components/Layout/DashboardLayout.tsx`

- [ ] Implement `AICopilotDrawer.tsx` featuring:
  - Floating trigger button at bottom-right with Sparkles icon.
  - Chat window with Apple Liquid Glass aesthetic (`backdrop-blur-2xl`).
  - Quick action chips ("สรุปงานค้างวันนี้", "เช็คราคาน้ำมัน", "จดโน้ตด่วน").
  - Automated action handler that inserts generated notes or reminders into `localStorage` / backend.
- [ ] Mount `<AICopilotDrawer />` inside `DashboardLayout.tsx`.
- [ ] Write unit tests in `AICopilotDrawer.test.tsx`.
- [ ] Run vitest to verify.

---

### Task 4: Full Suite Verification & Deployment

- [ ] Run full frontend test suite (`vitest`), type-check, and lint.
- [ ] Run full backend test suite (`pytest`) verifying >= 75% coverage.
- [ ] Stage, commit, and push changes to `main` for Vercel and Render deployment.
