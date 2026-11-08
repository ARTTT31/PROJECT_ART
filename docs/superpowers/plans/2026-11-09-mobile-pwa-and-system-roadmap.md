# Roadmap: PWA Mobile Native Experience & System Enhancements
**Date Updated:** 2026-11-09  
**Status:** Planned (Pending user kickoff — DO NOT implement until requested)

---

## 🎯 1. Scope & Objectives
แผนงานยกระดับประสบการณ์การใช้งานบนมือถือ (Mobile Native PWA) และระบบออโตเมชันอัจฉริยะใน ART Workspace ให้เทียบเท่าแอปพลิเคชันเนทีฟบน iOS/Android สูงสุด ตามมาตรฐาน Apple Human Interface Guidelines (HIG) และ Ponytail Principle (ใช้ Web APIs มาตรฐาน หลีกเลี่ยงไลบรารีขนาดใหญ่)

---

## 📱 2. รายการฟีเจอร์ในแผนงาน (Detailed Feature Breakdown)

### 2.1 PWA App Icon Badge (ตัวเลขแจ้งเตือนบนไอคอนแอป) 🔴
- **วัตถุประสงค์**: แสดงตัวเลขเตือน (Badge Counter สีแดง) บนไอคอนแอปหน้าจอมือถือ/แท็บเล็ต/เดสก์ท็อป เมื่อมีงานค้างหรือการแจ้งเตือนใหม่
- **การทำงาน**:
  - ใช้ `navigator.setAppBadge(count)` และ `navigator.clearAppBadge()` (รองรับทั้ง iOS 16.4+ ติดตั้งบนโฮมสกรีน, Android Chrome, และ Edge/macOS)
  - คำนวณยอดรวม: `badgeCount = pendingTasks + unreadNotifications`
  - อัปเดตแบบเรียลไทม์เมื่อผู้ใช้ติ๊กงานเสร็จ, เพิ่มงานใหม่, หรือมี Push Notification เข้ามา
  - เคลียร์ตัวเลขอัตโนมัติเมื่อเปิดแอปและอ่านการแจ้งเตือนแล้ว

### 2.2 High-Resolution & Adaptive Mobile App Icons (ไอคอนมือถือความละเอียดสูงระดับ Retina) 🎨
- **วัตถุประสงค์**: ไอคอนแอปบนหน้าจอมือถือคมชัดระดับ Retina (ไม่เบลอ ไม่แตก) ทั้งเวลาใช้ค่าเริ่มต้น, อัปโหลดโลโก้เอง, หรือเลือกจาก Presets
- **การทำงาน**:
  - **Apple Touch Icon (180×180 & 192×192)**: คำนวณ Safe-zone Margins (Padding 15%) ป้องกันไม่ให้ระบบ iOS ครอปโดนขอบโลโก้
  - **Android Adaptive/Maskable Icons (192×192, 512×512)**: สร้างไอคอนพร้อม metadata `purpose: "any maskable"` ให้รองรับทั้งไอคอนทรงกลม, สี่เหลี่ยมมน, หรือ Teardrop ของแต่ละยี่ห้อ (Samsung, Pixel, Xiaomi)
  - **Auto Canvas Resizer**: เวลาอัปโหลดโลโก้ใหม่หรือเลือกเปลี่ยนไอคอน ระบบจะแปลงเป็นชุดขนาดไอคอนความละเอียดสูงพร้อมพื้นหลังสีธีมที่ถูกต้องให้อัตโนมัติ

### 2.3 Apple-style Haptic Feedback (ระบบสั่นสัมผัสเนทีฟ) 📳
- **วัตถุประสงค์**: มอบความรู้สึกทางกายภาพเหมือนใช้แอปเนทีฟบน iPhone/Android
- **การทำงาน**:
  - ใช้ `navigator.vibrate` แบบ Micro-pulses:
    - `Light Tap` (8-10ms): เมื่อกดปุ่ม Toggle, เปลี่ยนแท็บ, หรือเปิดเมนูด้านข้าง
    - `Success Feedback` ([12ms, 40ms, 12ms]): เมื่อบันทึกข้อมูลสำเร็จ, ทำ To-Do เสร็จ, หรือส่งออกการ์ดสรุปประจำวัน
    - `Warning/Error` ([30ms, 50ms, 30ms]): เมื่อใส่รหัสผ่านผิด หรือเกิดข้อผิดพลาดในการเชื่อมต่อ

### 2.4 Mobile Pull-to-Refresh (ลากหน้าจอลงเพื่อรีเฟรชข้อมูล) 🔄
- **วัตถุประสงค์**: ลากหน้าจอลงเพื่อดึงข้อมูลล่าสุดแบบเรียลไทม์บนมือถือ
- **การทำงาน**:
  - ติดตั้ง Gesture Hook ตรวจสอบตำแหน่ง Scroll ด้านบนสุด (`scrollTop === 0`)
  - อนิเมชันตัวหมุนวงกลม Apple HIG Spinner ที่หัวกระดาษอย่างนุ่มนวล พร้อมสั่งรีเฟรชข้อมูลทุกวิดเจ็ต

### 2.5 Customizable Daily Briefing Push Automation (ตั้งเวลาและเลือกหัวข้อส่งสรุปประจำวันอัตโนมัติ) ⏰
- **วัตถุประสงค์**: ยิง Push Notification สรุปข้อมูลประจำวันเข้ามือถืออัตโนมัติตามเวลาและหัวข้อที่ผู้ใช้กำหนดเอง
- **การทำงาน**:
  - **การตั้งเวลาส่ง (Delivery Time)**: ผู้ใช้เลือกเวลาได้เองอิสระในหน้าโปรไฟล์ (เช่น 07:00, 07:30, 08:00 น.)
  - **การเลือกหัวข้อ (Topic Selectors)**: มี Checkbox ให้เลือกเนื้อหาที่ต้องการรวมในการแจ้งเตือน:
    - [x] ราคาน้ำมันขายปลีก (ดีเซล / แก๊สโซฮอล์ 95)
    - [x] สภาพอากาศและค่าฝุ่น PM2.5 ประจำวัน
    - [x] ตลาดการเงินและดัชนี SET
    - [x] งานที่ยังค้างอยู่ในระบบ To-Do List
    - [x] วันหยุดราชการและรายการเตือนความจำส่วนตัว
  - **Backend Scheduler**: Background worker รันตรวจสอบเวลาของผู้ใช้แต่ละคนและส่งข้อความผ่าน `pywebpush`

### 2.6 Fuel Price Change Early Warning (แจ้งเตือนน้ำมันจะปรับราคาล่วงหน้าตอนเย็น 17:00 น.) ⛽
- **วัตถุประสงค์**: แจ้งเตือนผู้ใช้ล่วงหน้าเมื่อน้ำมันจะปรับขึ้นราคาในวันถัดไป
- **การทำงาน**:
  - ช่วงเวลา 17:00–18:00 น. ของทุกวัน ตรวจสอบฟิลด์ `has_change` จาก Bangchak API
  - หากตรวจพบว่าพรุ่งนี้ราคาน้ำมันจะปรับขึ้น ยิง Web Push แจ้งเตือนทันที: *"⚠️ พรุ่งนี้ราคาน้ำมันปรับขึ้น +0.50 บาท/ลิตร แนะนำแวะเติมน้ำมันก่อนกลับบ้านครับ"*

### 2.7 PWA Home Screen Quick Shortcuts (กดค้างไอคอนแอปเพื่อสั่งงานด่วน) ⚡
- **วัตถุประสงค์**: กดค้างไอคอนบนหน้าจอโฮมเพื่อเข้าถึงเมนูลัดทันที (PWA Shortcuts Metadata)
- **เมนูลัด**:
  - 📝 "จดโน้ตด่วน" (เปิด Dashboard พร้อมโฟกัสที่ช่อง Quick Notes)
  - ⛽ "เช็คราคาน้ำมัน" (เปิดหน้าราคาน้ำมันโดยตรง)
  - 🤖 "คุยกับ AI Copilot" (เปิดแอปพร้อมเด้งหน้าต่าง AI ผู้ช่วย)
  - 📹 "ดูกล้องวงจรปิด CCTV"

### 2.8 Web Share Target (รับข้อมูลที่แชร์จากแอปอื่นเข้า Workspace) 📥
- **วัตถุประสงค์**: เมื่อกดปุ่ม "แชร์" จาก Safari, LINE, หรือ Facebook สามารถเลือกส่งข้อความ/ลิงก์เข้ามาบันทึกลงใน ART Workspace ได้ทันที

### 2.9 Biometric Quick Unlock (ปลดล็อกแอปด้วย Face ID / Touch ID / Fingerprint) 🔒
- **วัตถุประสงค์**: เข้าใช้งานแอปได้อย่างปลอดภัยและรวดเร็วผ่าน WebAuthn โดยไม่ต้องกรอกรหัสผ่านทุกครั้ง

---

## 🛠️ 3. ตารางสรุปแผนงานและสถานะ (Roadmap Execution Matrix)

| ลำดับ | รายการฟีเจอร์ | สโคปงาน | สถานะ |
| :--- | :--- | :--- | :--- |
| **1** | **PWA App Icon Badge** | Frontend (`navigator.setAppBadge`) | วางแผนแล้ว (รอเริ่ม) |
| **2** | **Retina & Adaptive Mobile Icons** | Frontend Branding & Favicon Canvas | วางแผนแล้ว (รอเริ่ม) |
| **3** | **Apple-style Haptic Feedback** | Frontend Utility Hook (`navigator.vibrate`) | วางแผนแล้ว (รอเริ่ม) |
| **4** | **Mobile Pull-to-Refresh** | Frontend Gestures & Layout | วางแผนแล้ว (รอเริ่ม) |
| **5** | **Customizable Daily Push Scheduler** | Backend Cron + Profile Settings UI | วางแผนแล้ว (รอเริ่ม) |
| **6** | **แจ้งเตือนน้ำมันปรับราคาล่วงหน้า (17:00 น.)** | Backend Scheduled Checker + Push Dispatcher | วางแผนแล้ว (รอเริ่ม) |
| **7** | **PWA Home Screen Quick Shortcuts** | Manifest Shortcuts + Route Handlers | วางแผนแล้ว (รอเริ่ม) |
| **8** | **Web Share Target API** | Manifest Share Target + Ingest Handler | วางแผนแล้ว (รอเริ่ม) |
| **9** | **Biometric Unlock (Face ID / Touch ID)** | WebAuthn Credentials API | วางแผนแล้ว (รอเริ่ม) |
