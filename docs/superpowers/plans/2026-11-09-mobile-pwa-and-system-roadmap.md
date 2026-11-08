# Roadmap: PWA Mobile Native Experience & System Enhancements
**Date Created:** 2026-11-09  
**Status:** Planned (Pending user kickoff — DO NOT implement until requested)

---

## 🎯 1. Scope & Objectives
แผนงานยกระดับประสบการณ์การใช้งานบนมือถือ (Mobile Native PWA) และฟังก์ชันอำนวยความสะดวกใน ART Workspace ให้ใกล้เคียงแอปพลิเคชันเนทีฟบน iOS/Android สูงสุด ตามมาตรฐาน Apple Human Interface Guidelines (HIG) และ Ponytail Principle (ใช้ Web APIs มาตรฐาน ไม่เพิ่มโค้ดเทอะทะ)

---

## 📱 2. รายการฟีเจอร์ในแผนงาน (Detailed Feature Breakdown)

### 2.1 PWA App Icon Badge (ตัวเลขแจ้งเตือนบนไอคอนแอป)
- **วัตถุประสงค์**: แสดงตัวเลขเตือน (Badge Counter สีแดง) บนไอคอนแอปหน้าจอมือถือ/แท็บเล็ต/เดสก์ท็อป เมื่อมีงานค้างหรือการแจ้งเตือนใหม่
- **การทำงาน**:
  - ใช้ `navigator.setAppBadge(count)` และ `navigator.clearAppBadge()` (รองรับทั้ง iOS 16.4+ ติดตั้งบนโฮมสกรีน, Android Chrome, และ Edge/macOS)
  - คำนวณยอดรวม: `badgeCount = pendingTasks + unreadNotifications`
  - อัปเดตแบบเรียลไทม์เมื่อผู้ใช้ติ๊กงานเสร็จ, เพิ่มงานใหม่, หรือมี Push Notification เข้ามา
  - รองรับการเคลียร์ Badge เมื่อเปิดแอปและอ่านการแจ้งเตือนแล้ว

### 2.2 High-Resolution & Adaptive Mobile App Icons (ไอคอนมือถือความละเอียดสูง)
- **วัตถุประสงค์**: ไอคอนแอปบนหน้าจอมือถือคมชัดระดับ Retina (ไม่เบลอ ไม่แตก) ทั้งเวลาใช้ค่าเริ่มต้น, อัปโหลดโลโก้เอง, หรือเลือกจาก Presets
- **การทำงาน**:
  - **Apple Touch Icon (180×180 & 192×192)**: คำนวณ Safe-zone Margins (Padding 15%) ป้องกันไม่ให้ระบบ iOS ครอปโดนขอบโลโก้
  - **Android Adaptive/Maskable Icons (192×192, 512×512)**: สร้างไอคอนพร้อม metadata `purpose: "any maskable"` ให้รองรับทั้งไอคอนทรงกลม, สี่เหลี่ยมมน, หรือ Teardrop ของแต่ละยี่ห้อ (Samsung, Pixel, Xiaomi)
  - **Real-time Canvas Exporter**: เมื่อผู้ใช้เปลี่ยนโลโก้ในหน้าโปรไฟล์ ระบบจะประมวลผลผ่าน Canvas เป็นชุดขนาด 180×180, 192×192, 512×512 ความคมชัดสูงพร้อมพื้นหลังสีพื้นตามธีมโดยอัตโนมัติ

### 2.3 Haptic Feedback Engine (ระบบสั่นสัมผัสเนทีฟ Apple Style)
- **วัตถุประสงค์**: เพิ่มมิติความรู้สึกทางกายภาพเหมือนใช้แอปเนทีฟบน iPhone/Android
- **การทำงาน**:
  - ใช้ `navigator.vibrate` แบบ Micro-pulses:
    - `Light Tap` (8-10ms): เมื่อกดปุ่ม Toggle หรือคลิกเปิดเมนู
    - `Success Feedback` ([12ms, 40ms, 12ms]): เมื่อบันทึกข้อมูลสำเร็จ, ทำ To-Do เสร็จ, หรือแชร์การ์ดสำเร็จ
    - `Warning/Error` ([30ms, 50ms, 30ms]): เมื่อใส่รหัสผ่านผิด หรือเกิดข้อผิดพลาด

### 2.4 Mobile Pull-to-Refresh (ลากจอลงเพื่อรีเฟรชข้อมูล)
- **วัตถุประสงค์**: บนเบราว์เซอร์มือถือหรือโหมด PWA ผู้ใช้สามารถลากหน้าจอลงเพื่อดึงข้อมูลสภาพอากาศ ราคาน้ำมัน และงานค้างล่าสุดได้ทันที
- **การทำงาน**:
  - สร้าง Gesture Hook ตรวจสอบตำแหน่ง Scroll ด้านบนสุด (`scrollTop === 0`)
  - อนิเมชันตัวหมุนวงกลม Apple HIG Spinner ที่หัวกระดาษอย่างนุ่มนวล

### 2.5 Thai Voice-to-Command สำหรับ AI Copilot (สั่งงานด้วยเสียงภาษาไทย)
- **วัตถุประสงค์**: สั่งงาน AI Copilot ด้วยเสียงแบบ Hands-free โดยไม่ต้องพิมพ์
- **การทำงาน**:
  - ปุ่มไมค์ใน `AICopilotDrawer` ใช้ Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) ของเบราว์เซอร์
  - แปลงเสียงพูดเป็นข้อความภาษาไทยแบบเรียลไทม์ และส่งไปยัง Intent Engine เพื่อจดโน้ตหรือเช็คราคาน้ำมันทันที

### 2.6 Daily Morning Briefing Push (ส่ง Push สรุปภาพรวมเช้าอัตโนมัติ)
- **วัตถุประสงค์**: ยิง Push แจ้งเตือนสรุปประจำวัน (ราคาน้ำมัน + อากาศ + งานค้าง) เข้ามือถืออัตโนมัติทุกเช้า 07:30 น.
- **การทำงาน**:
  - Background Cron / Worker บน Backend ทำงานผ่าน `web_push_service` ส่ง Notification ตามเวลาที่ผู้ใช้ตั้งไว้

---

## 🛠️ 3. สรุปความพร้อมและขั้นตอนปฏิบัติการ (Execution Plan)
| ลำดับ | รายการ | ไฟล์ที่เกี่ยวข้อง | สถานะ |
| :--- | :--- | :--- | :--- |
| **1** | PWA App Icon Badge Engine | `frontend/src/hooks/useAppBadge.ts`, `DashboardLayout.tsx` | วางแผนแล้ว (รอคำสั่ง) |
| **2** | Retina Mobile Icons & Safe-zone Canvas | `frontend/src/components/Branding/`, `BrandingFavicon.tsx` | วางแผนแล้ว (รอคำสั่ง) |
| **3** | Apple Haptic Feedback Hook | `frontend/src/utils/haptics.ts` | วางแผนแล้ว (รอคำสั่ง) |
| **4** | Voice-to-Command for Copilot | `frontend/src/components/AICopilot/AICopilotDrawer.tsx` | วางแผนแล้ว (รอคำสั่ง) |
| **5** | Morning Briefing Push Worker | `backend/app/services/scheduler.py`, `web_push_service.py` | วางแผนแล้ว (รอคำสั่ง) |
