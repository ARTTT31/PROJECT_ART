# 🚀 Technical Migration & Deployment Document
**Project:** ART Workspace  
**Document Purpose:** บันทึกประวัติการย้ายระบบจาก Localhost สู่ Cloud Production Environment รวมถึงปัญหาที่พบ (Troubleshooting) และแนวทางการแก้ไข 

---

## 1. สถาปัตยกรรมระบบคลาวด์ (Infrastructure Architecture)
ระบบได้รับการออกแบบและแยกส่วนการทำงานเพื่อให้ง่ายต่อการสเกลและดูแลรักษา โดยเลือกใช้บริการคลาวด์ดังต่อไปนี้:

* **หน้าบ้าน (Frontend):** พัฒนาด้วย Next.js และนำไปรันบน **Vercel** เพื่อประสิทธิภาพสูงสุดในการให้บริการฝั่งไคลเอนต์ (Edge Network)
* **หลังบ้าน (Backend):** พัฒนาด้วย FastAPI และนำไปรันเป็น Web Service บน **Render** ซึ่งเหมาะสมกับการรองรับการประมวลผลและการเชื่อมต่อแบบ Asynchronous
* **ฐานข้อมูล (Database):** ใช้ PostgreSQL รันอยู่บน **Neon.tech** (Serverless Postgres) เพื่อความยืดหยุ่นในการจัดการ Connection Pool

---

## 2. ลำดับขั้นตอนการเปลี่ยนแปลงโครงสร้างโค้ดและการตั้งค่า (Key Changes & Configurations)

### 2.1 การปรับแต่งตัวแปรสภาพแวดล้อม (Environment Variables)
เพื่อให้โค้ดบน Render สื่อสารกับบริการภายนอกได้ถูกต้อง ได้มีการตั้งค่า Environment Variables สำคัญดังนี้:
* `BACKEND_GOOGLE_CLIENT_ID`: รหัส Client ID จาก Google Cloud Console
* `BACKEND_GOOGLE_CLIENT_SECRET`: รหัส Secret จาก Google Cloud Console
* `BACKEND_GOOGLE_REDIRECT`: URL สำหรับรับ Callback จาก Google ต้องชี้มาที่โดเมนของ Render (เช่น `https://<render-domain>/api/v1/auth/google/callback`)
* `DATABASE_URL`: Connection String สำหรับต่อเข้าฐานข้อมูล Neon.tech
* `FRONTEND_URL`: URL ของหน้าบ้านที่รันบน Vercel เพื่อใช้สำหรับการ Redirect กลับไปพร้อมข้อมูลหลังล็อกอินสำเร็จ

### 2.2 การย้ายสถาปัตยกรรมตัวเชื่อมต่อฐานข้อมูลสู่ระบบ Asynchronous
เพื่อป้องกันปัญหา Event Loop Blocked บน FastAPI เราได้เปลี่ยนสถาปัตยกรรมการเชื่อมต่อฐานข้อมูลจากแบบ Synchronous ไปเป็น Asynchronous เต็มรูปแบบ:
* เปลี่ยนจากการใช้ `create_engine` เป็น `create_async_engine`
* เปลี่ยนตัวจัดการเซสชันจาก `sessionmaker` เป็น `async_sessionmaker` ผูกกับ `AsyncSession`
* อัปเกรด Driver ฐานข้อมูลใน `requirements.txt` จากเดิมมาใช้ `asyncpg`

### 2.3 การเปิดใช้งานระบบรักษาความปลอดภัย SSL (Database Connection)
การเชื่อมต่อเข้า Managed Database อย่าง Neon จำเป็นต้องมีการส่งข้อมูลผ่านช่องทางที่เข้ารหัส:
* ทำการฝังพารามิเตอร์ `connect_args={"ssl": True}` เข้าไปในระดับ Engine ของ SQLAlchemy เพื่อบังคับให้ `asyncpg` ยืนยันการทำงานผ่าน SSL Mode เสมอ

---

## 3. สรุปบันทึกการแก้ไขปัญหาหน้างาน (Troubleshooting & Bug Fixes)

ระหว่างการนำระบบขึ้นสู่คลาวด์ พบปัญหาหลักและได้ดำเนินการแก้ไขเรียบร้อยแล้ว ดังนี้:

### 🔴 ปัญหา 1: `Error 400: redirect_uri_mismatch` (ฝั่ง Google OAuth)
* **สาเหตุ:** URL ต้นทางและปลายทางในการทำ OAuth ไม่ตรงกับที่มีในระบบ
* **วิธีแก้ไข:** เข้าไปตั้งค่าในหน้า Google Cloud Console (API & Services > Credentials) เพื่ออัปเดต **Authorized JavaScript origins** ให้ตรงกับโดเมน Vercel และ **Authorized redirect URIs** ให้ตรงกับเส้นทางของ Render (`/api/v1/auth/google/callback`)

### 🔴 ปัญหา 2: `connection is insecure (try using sslmode=require)`
* **สาเหตุ:** Driver `asyncpg` ของ Python ไม่อนุญาตให้เชื่อมต่อฐานข้อมูล Neon โดยไม่มีการเข้ารหัส
* **วิธีแก้ไข:** ลบ Query String `?sslmode=require` ออกจากท้าย `DATABASE_URL` เดิม และย้ายมาเปิดอ็อปชัน `{"ssl": True}` ตรง `connect_args` ตอนสร้าง `create_async_engine` แทน

### 🔴 ปัญหา 3: `InvalidPasswordError` (การเชื่อมต่อฐานข้อมูล)
* **สาเหตุ:** รหัสผ่านหรือสตริงการเชื่อมต่อ (Connection String) ผิดพลาด หรือไม่ได้ใช้รหัสผ่านสำหรับ Connection Pooling ของ Neon
* **วิธีแก้ไข:** ทำความสะอาดสตริงเชื่อมต่อ และปรับไปใช้ Connection String แบบ Pooler ตัวล่าสุดที่คัดลอกจากหน้าแดชบอร์ดของ Neon โดยตรง

### 🔴 ปัญหา 4: `AttributeError: 'AsyncSession' object has no attribute 'query'`
* **สาเหตุ:** การเรียกใช้คำสั่ง `.query()` เป็น Syntax ของเซสชันแบบ Synchronous ซึ่งไม่รองรับบน `AsyncSession`
* **วิธีแก้ไข:** รื้อแก้ Syntax การเขียนคิวรีในเซิร์ฟเวอร์ย่อย (เช่น `user_service.py`) เปลี่ยนมาใช้คำสั่ง `select(...)` ของ SQLAlchemy 2.0 แทน และสั่งรันข้อมูลผ่าน `await db.execute(...)` 

### 🔴 ปัญหา 5: `AttributeError: 'coroutine' object has no attribute 'email'`
* **สาเหตุ:** มีการเรียกใช้ฟังก์ชันเช็คผู้ใช้ที่เป็น Coroutine/Async (เช่น `get_user_by_email`) แต่ลืมใส่คำสั่ง `await` เพื่อรอรับผลลัพธ์ ทำให้ข้อมูลที่คืนค่ากลับมายังคงเป็นกล่อง Coroutine 
* **วิธีแก้ไข:** ไล่เติมคีย์เวิร์ด `await` นำหน้าการเรียกฟังก์ชัน Async ในไฟล์ `auth.py` และ Service ต่างๆ ทั้งหมด เพื่อรอแกะข้อมูล Model ออกมาให้เรียบร้อยก่อนนำไปใช้สร้าง JWT Token

### 🔴 ปัญหา 6: หน้าต่างเตือน "App not verified" ตอนล็อกอินผ่าน Google
* **สาเหตุ:** โปรเจกต์ OAuth บน Google Cloud ยังถูกตั้งค่าจำกัดอยู่ในโหมดทดสอบ (Testing)
* **วิธีแก้ไข:** ทำการเปลี่ยนสถานะแอปพลิเคชัน (Publishing Status) ภายในเมนู OAuth Consent Screen จาก **Testing** เป็น **In Production** เพื่อปลดล็อกให้บัญชี Google ทั่วไปสามารถล็อกอินใช้งานได้

---

## 4. สถานะปัจจุบันของระบบ (Current System Status)
✅ **สถานะ:** **LIVE (Production Ready)**
* โปรเจกต์สามารถทำการบิวด์และ Deploy ผ่านสำเร็จ 100% ทั้งบริการหน้าบ้าน (Vercel) และหลังบ้าน (Render)
* ระบบ API ทำงานในสถานะพร้อมรับโหลด (Green Status) 
* ระบบไหลเวียนของการล็อกอิน (OAuth Callback Sequence) สามารถพูดคุยกันระหว่าง Vercel, Render และ Google ได้อย่างสมบูรณ์
* มีการเชื่อมต่อฐานข้อมูลสร้าง/บันทึกข้อมูลผู้ใช้งาน และออกตั๋วความปลอดภัย JWT Token สำหรับอนุญาตสิทธิ์เข้าสู่หน้าแดชบอร์ดได้อย่างมั่นคงและปลอดภัย

---

## 5. แผนการในอนาคต: การเปลี่ยนผ่านสู่ระบบไร้ตู้คอนเทนเนอร์ (Docker-less & Fully Cloud-Managed Roadmap)

เพื่อลดภาระการทำงานของเครื่องผู้พัฒนา (Localhost) และย้ายกระบวนการประมวลผลและการรันระบบทั้งหมดขึ้นสู่ระบบคลาวด์ 100% (Fully Cloud-Managed) โปรเจกต์นี้มีแผนงานในการ**ยกเลิกการใช้ Docker ในการพัฒนาและติดตั้ง** โดยมีแนวทางและขั้นตอนดังนี้:

### 5.1 สถาปัตยกรรมเป้าหมาย (Target Architecture)
* **ไม่ต้องติดตั้ง Docker/Docker Desktop** บนเครื่องของผู้พัฒนา
* **ไม่มีการรันฐานข้อมูลโลคอล** (ย้ายไปต่อกับ Neon.tech โดยตรงผ่านช่องทางเข้ารหัส)
* **GitHub-Driven Deployment (CI/CD):** 
  * การแก้ไขโค้ดทั้งหมดจะกระทำผ่านเครื่องโลคอล (แก้ไขไฟล์เปล่า ๆ)
  * เมื่อทำการ `git push` โค้ดเข้าสู่ GitHub:
    * **Vercel** จะรับหน้าที่ดึงโค้ดฝั่งหน้าบ้าน (`frontend`) ไปบิวด์และให้บริการบนเว็บโดยอัตโนมัติ (ฟรี)
    * **Render** จะรับหน้าที่ดึงโค้ดฝั่งหลังบ้าน (`backend`) ไปรันเป็น Web Service โดยอัตโนมัติ (ฟรี)
    * ทั้งหมดเชื่อมต่อแบบไร้สายไปยังฐานข้อมูล **Neon.tech** (Serverless Postgres ฟรี)

### 5.2 วิธีการพัฒนาในเครื่องโลคอลแบบไม่ใช้ Docker (Docker-less Development Workflow)
ผู้พัฒนาสามารถเขียนโค้ดและทดสอบระบบในเครื่องได้ทันทีด้วยเครื่องมือแบบ Native:

#### A. สำหรับ Backend (FastAPI):
1. เปิด Command Line เข้าไปที่โฟลเดอร์ `/backend`
2. สร้าง virtual environment ของ Python:
   ```bash
   python -m venv venv
   ```
3. เปิดใช้งาน (Activate) สภาพแวดล้อม:
   * Windows PowerShell: `.\venv\Scripts\Activate.ps1`
   * Windows Command Prompt: `.\venv\Scripts\activate.bat`
   * macOS/Linux: `source venv/bin/activate`
4. ติดตั้ง dependencies:
   ```bash
   pip install -r requirements.txt
   ```
5. รันเซิร์ฟเวอร์หลังบ้าน:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

#### B. สำหรับ Frontend (Next.js):
1. เปิด Command Line อีกหน้าต่างและเข้าไปที่โฟลเดอร์ `/frontend`
2. ติดตั้ง dependencies:
   ```bash
   npm install
   ```
3. รันเซิร์ฟเวอร์หน้าบ้าน:
   ```bash
   npm run dev
   ```

### 5.3 ประโยชน์ที่ได้รับ
1. **ลดการใช้ทรัพยากรเครื่อง:** ไม่กินแรมและ CPU ในการจำลองคอมพิวเตอร์ผ่าน Docker Desktop
2. **ความรวดเร็วในการพัฒนา:** ระบบ Hot-Reload ทำงานได้อย่างมีประสิทธิภาพสูงสุดโดยตรงผ่าน OS File System
3. **ลดความซับซ้อน:** ไม่จำเป็นต้องดูแลไฟล์ `Dockerfile` และ `docker-compose.yml` อีกต่อไปหลังการเปลี่ยนผ่านสมบูรณ์

