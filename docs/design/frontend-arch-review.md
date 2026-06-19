## ART Workspace (Frontend) — รีวิว UX/UI + คุณภาพโค้ด/สถาปัตย์

ขอบเขตที่ตรวจ: `frontend/src/app/*`, `frontend/src/components/*`, `frontend/src/styles/*`, `frontend/src/lib/*`

---

# 1) สรุปผู้บริหาร (Executive summary)

**ภาพรวม:** UI ไปในทิศทาง “Liquid Glass” ชัดเจน (มี tokens + patterns ที่ตั้งใจ) และมี a11y พื้นฐานหลายจุดที่ดี (focus-visible, reduced-motion ในหลายส่วน, touch target ≥44px ฯลฯ) แต่มี “ความไม่สม่ำเสมอ” ระหว่างหน้าต่าง ๆ และมีจุดเสี่ยงด้านสถาปัตย์/ความปลอดภัย/ความสามารถในการดูแลระยะยาว

**Top ประเด็นที่กระทบมากที่สุด (เรียงตามความคุ้มค่า):**
1. **Auth/Session logic กระจายหลายจุด** (DashboardLayout + page แต่ละหน้า + apiClient interceptor) → เกิดซ้ำซ้อน/พฤติกรรมไม่เหมือนกัน/แก้บั๊กยาก
2. **Modal/Dropdown ยังไม่ครบ a11y แบบ product-grade** (ไม่มี focus trap, role=dialog/aria-modal, ESC close, restore focus)
3. **Dashboard “จัดวาง/จัดการวิดเจ็ต” ยังไม่ครบ flow** (มี modal แต่ไม่มี entrypoint ให้เปิด, DnD ไม่รองรับ keyboard/touch)
4. **API layer ไม่เป็นหนึ่งเดียว + มี endpoint bug ใน authService** (`baseURL=/api/v1` แต่เรียก `/api/v1/auth/*` ซ้ำ) และมีทั้ง `fetch` + `axios` ปนกัน
5. **มีจุดเสี่ยง XSS จาก `dangerouslySetInnerHTML`** ใน TaskListWidget (ดึง description มาแปลงเป็น HTML) ควร sanitize/เปลี่ยนวิธีแสดงผล

---

# 2) UX/UI Review (ข้อเสนอปรับปรุง)

## 2.1 Navigation / App Shell
- **Sidebar section title ใช้ uppercase + tracking สูง** (เช่น `text-[11px] uppercase tracking-wider`) ทำให้ “เสียง UI” แข็งและดูเป็น template ได้ง่าย  
  → แนะนำใช้ **sentence case** + ลด tracking และเน้น hierarchy ผ่าน spacing/weight แทน
- Header user menu ใช้ overlay แบบ `button className="fixed inset-0"` เพื่อปิดเมนู: ดีที่ปิดง่าย แต่ยังขาด:
  - ปิดด้วย **Esc**
  - **โฟกัสวนอยู่ในเมนู** (focus trap) และคืนโฟกัสกลับปุ่มเดิมเมื่อปิด

## 2.2 Dashboard: Widgets (Layout/Visibility/Sorting)
สิ่งที่มีแล้ว: มี `localStorage` เก็บ layout + visibility, มี DnD, มี WidgetSizeToggle

ช่องว่าง/ข้อเสนอ:
- มี state `showConfigModal` และ UI modal “การแสดงผลวิดเจ็ต” แต่ **ไม่มีปุ่ม/จุดเข้า** เพื่อเปิด modal (entrypoint)
  → เพิ่ม “แถบเครื่องมือ” บน Dashboard (เช่นมุมขวาบนของหน้า) มี:
  - ปุ่ม **จัดการวิดเจ็ต** (เปิด modal show/hide)
  - ปุ่ม **จัดวาง** (เข้าสู่ edit mode: แสดง drag handle, show drop indicator, มีปุ่ม reset layout)
- DnD ปัจจุบันเป็น HTML drag events:
  - ไม่รองรับ **touch** ดีพอ
  - ไม่รองรับ **keyboard reorder**
  → แนะนำย้ายไปใช้ `@dnd-kit` และทำ “Reorder actions” (ขึ้น/ลง) สำหรับ keyboard

## 2.3 Modals / Dialogs
ตัวอย่าง: Dashboard widget modal, CreateUserDialog

ปัจจุบันยังขาดมาตรฐาน product UI:
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby`
- โฟกัสเริ่มต้นเข้าไปใน dialog และ **ล็อกโฟกัสไม่ให้ออกไปข้างหลัง**
- ปิดด้วย Esc / คลิกด้านนอก (และควบคุมว่าควรปิดได้หรือไม่)
- ปิดแล้ว **คืนโฟกัส** ไปยัง element ก่อนหน้า

คำแนะนำ: ทำ component กลาง `Dialog` (เช่น Radix UI Dialog หรือ Headless UI) แล้วใช้ทุกที่

## 2.4 Motion & Visual Density
- แนวทาง “Liquid Glass” ทำได้สวย แต่บางจุด “motion-heavy” โดยเฉพาะ Weather widget + background animation หลายเลเยอร์
  - ใน `weather.css` มี animation ต่อเนื่องหลายชุด และยังไม่ครอบคลุม `prefers-reduced-motion` เท่าที่ควร
  → แนะนำ:
  - ใส่ `@media (prefers-reduced-motion: reduce)` ใน `weather.css` เพื่อปิด animation สำคัญทั้งหมด
  - ทำ “โหมดสงบ (Calm)” ให้ผู้ใช้ปิด background animation ของ widget ได้

## 2.5 Accessibility (AAA target) — ช่องที่ควรปิด
- Placeholder หลายจุดใช้โทนอ่อน (`#94a3b8`) บนพื้นขาว มีโอกาสไม่ถึง AAA  
  → ปรับ placeholder ให้เข้มขึ้น (เช่น `#64748b`) หรือเพิ่ม bg tint เพื่อให้ contrast ผ่าน
- “รายละเอียดงาน” ใน TaskListWidget ใช้ `dangerouslySetInnerHTML` และ inject `<a target="_blank">`  
  → นอกจาก security ยังมีเรื่อง a11y เช่น link text/keyboard focus state ควรกำหนดให้สม่ำเสมอ

---

# 3) Code Quality / Architecture Review (ข้อเสนอรีแฟคเตอร์)

## 3.1 Auth boundary (สำคัญสุด)
ปัจจุบันมีการตรวจ token/user ซ้ำใน:
- `useAuth.ts`
- `DashboardLayout.tsx`
- `dashboard/page.tsx`, `profile/page.tsx`, `admin/page.tsx` ฯลฯ
- `apiClient` interceptor 401 แล้ว `window.location.href = '/login'`

ข้อเสีย:
- behavior ไม่เหมือนกัน (บางที่ `router.push`, บางที่ `window.location.href`)
- หน้า render เป็น `null` ระหว่างรอ user → เกิด “หน้าขาว”

แนะนำโครง:
1. ทำ `AuthProvider` (Context) + `useAuth()` แบบเดียวทั้งระบบ
2. ทำ `AuthGuard` component สำหรับหน้าที่ต้องล็อกอิน:
   - แสดง skeleton/loading state
   - redirect ด้วย `router.replace('/login')`
3. จัดการ 401 ในที่เดียว (fetch/axios wrapper) และส่ง event ให้ AuthProvider logout

> หมายเหตุ: ระยะยาว “token ใน localStorage” เสี่ยง XSS; ถ้าทำได้แนะนำย้ายไป **HttpOnly cookie** (ต้องปรับ backend ด้วย)

## 3.2 API layer ให้เป็นหนึ่งเดียว + แก้ endpoint bug
พบว่า `src/lib/api/auth.ts` น่ามีบั๊ก:
- `client.ts` ตั้ง `baseURL = ${API_URL}/api/v1`
- แต่ `auth.ts` เรียก `apiClient.post('/api/v1/auth/login', ...)` ทำให้กลายเป็น `/api/v1/api/v1/auth/login`

แนะนำ:
- กำหนด convention เดียว: เรียก `apiClient.post('/auth/login', ...)` (ตัด `/api/v1` ออก)
- เลือกให้ชัดว่าจะใช้ `axios` หรือ `fetch`:
  - ถ้าใช้ `axios`: ให้หน้าต่าง ๆ หยุดใช้ `fetch` ตรง ๆ แล้วใช้ service layer
  - ถ้าใช้ `fetch`: ทำ `fetcher.ts` ที่ใส่ token + จัดการ 401 + timeout ให้หมด
- ใช้ `next.config.js` rewrite `/api/*` ให้จริง: ใน UI เรียก `/api/v1/...` (ไม่ต้อง hardcode host)

## 3.3 Security: ห้ามส่ง HTML ตรงเข้าหน้า
ใน `TaskListWidget.tsx` มี `dangerouslySetInnerHTML` กับ description

แนะนำทางเลือก (เลือก 1):
1. **ดีที่สุด:** backend ส่งเป็น plain text/structured fields แล้ว render เอง
2. ใช้ library sanitize (DOMPurify) ก่อน render
3. แสดงเป็น plain text โดย escape HTML และทำ link parsing แบบ whitelist

## 3.4 CSS architecture / Design system
พบว่า style มี 3 แนวผสมกัน:
- Tailwind utility
- global tokens + global element styles (`globals.css` จัดหนักกับ input/button)
- page CSS (`login.css`, `weather.css`) และยังมี `login.module.css` ที่ดูเหมือน “ซ้ำ/ไม่ถูกใช้”

แนะนำ:
- ตัดสินใจเรื่อง “ระดับ global”:
  - ควรเก็บไว้เป็น **tokens + utilities** มากกว่า override element ทั่วทั้งระบบ
- ลด duplicate: ถ้าไม่ใช้ `login.module.css` ให้ลบทิ้ง (ลดความสับสน)
- ทำ component primitives:
  - `Button`, `Input`, `Card`, `Badge`, `Dialog`
  - เพื่อให้หน้าต่าง ๆ ไม่ต้อง invent style ใหม่ทุกครั้ง

## 3.5 Data fetching strategy
มี React Query provider แต่ยังไม่ใช้ `useQuery/useMutation`

ทางเลือก:
- ถ้าจะใช้ React Query: ย้าย data-fetch ที่สำคัญ (users, audit logs, sessions, calendar events) ไปเป็น query/mutation เพื่อ cache + retries + loading/error state ที่สม่ำเสมอ
- ถ้าไม่ใช้: เอา provider ออกเพื่อความเรียบง่าย

---

# 4) แผนรีแฟคเตอร์ (แนะนำแบบจัดลำดับ)

## Quick wins (0.5–2 วัน)
1. เพิ่ม entrypoint “จัดการวิดเจ็ต” ให้เปิด `showConfigModal`
2. แก้ authService endpoint bug หรือถ้าไม่ใช้ให้ลบ/ย้ายให้ถูกที่
3. เปลี่ยน `window.location.href` → `router.replace` และรวม behavior redirect ให้เหมือนกัน
4. ใส่ `prefers-reduced-motion` ให้ `weather.css` (ปิด animation หลัก)
5. แก้ a11y modal ขั้นต้น: `role="dialog"`/`aria-modal`/`aria-labelledby` + Esc close

## Medium (3–10 วัน)
1. ทำ `AuthProvider + AuthGuard` และย้าย auth check ออกจากทุกหน้า
2. ทำ `Dialog` component กลาง แล้ว migrate modals ทั้งหมด
3. ทำ API wrapper/service layer เดียว (axios หรือ fetch อย่างใดอย่างหนึ่ง)
4. เปลี่ยน DnD ไป `@dnd-kit` + keyboard reorder

## Long (2–4 สัปดาห์)
1. ย้าย token จาก localStorage → HttpOnly cookie (ปรับ backend)
2. จัด design system ให้ “ชัดและเบา”: tokens + primitives + ลด global overrides
3. ปรับ Calendar widget จาก iframe → render ในระบบ (ถ้าต้องการ UX ที่ควบคุมได้)

---

# 5) ข้อเสนอ “เริ่มทำจริง” (เลือก 1 ชุดเพื่อเริ่มลงมือ)
A) ทำ **AuthProvider/AuthGuard** (ลดบั๊ก + ลดโค้ดซ้ำเร็วที่สุด)  
B) ทำ **Dialog system** (แก้ a11y + UX consistency ของ modal ทั้งระบบ)  
C) ทำ **Dashboard edit mode + widget manager** (เพิ่มคุณค่า UX โดยตรง)  

บอกผมได้เลยว่าคุณอยากเริ่มจาก A/B/C — ผมจะลงมือปรับโค้ดให้เป็นชุด ๆ พร้อมทดสอบรันให้ครับ

