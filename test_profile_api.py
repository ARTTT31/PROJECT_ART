"""
ทดสอบ Profile API - เปลี่ยนชื่อ, อีเมล์, รหัสผ่าน
"""
import requests
import json

BASE_URL = "http://localhost:8000/api/v1"

# สีสำหรับแสดงผล
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_success(msg):
    print(f"{Colors.GREEN}✅ {msg}{Colors.END}")

def print_error(msg):
    print(f"{Colors.RED}❌ {msg}{Colors.END}")

def print_info(msg):
    print(f"{Colors.BLUE}ℹ️  {msg}{Colors.END}")

def print_warning(msg):
    print(f"{Colors.YELLOW}⚠️  {msg}{Colors.END}")

# ขั้นตอนที่ 1: Login เพื่อรับ token
def login(email="admin@art.com", password="admin@123"):
    print_info(f"กำลัง Login ด้วย {email}...")
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={
            "email": email,
            "password": password
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        token = data.get("data", {}).get("access_token")
        user = data.get("data", {}).get("user")
        print_success(f"Login สำเร็จ! ผู้ใช้: {user.get('name')} ({user.get('email')})")
        return token, user
    else:
        print_error(f"Login ไม่สำเร็จ: {response.text}")
        return None, None

# ขั้นตอนที่ 2: ดึงข้อมูล Profile ปัจจุบัน
def get_profile(token):
    print_info("กำลังดึงข้อมูล Profile...")
    response = requests.get(
        f"{BASE_URL}/profile/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code == 200:
        user = response.json()
        print_success(f"ได้ข้อมูล Profile แล้ว")
        print(f"   ชื่อ: {user.get('name')}")
        print(f"   อีเมล์: {user.get('email')}")
        return user
    else:
        print_error(f"ไม่สามารถดึงข้อมูลได้: {response.text}")
        return None

# ขั้นตอนที่ 3: อัพเดทชื่อ
def update_name(token, new_name):
    print_info(f"กำลังเปลี่ยนชื่อเป็น '{new_name}'...")
    response = requests.put(
        f"{BASE_URL}/profile/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": new_name}
    )
    
    if response.status_code == 200:
        data = response.json()
        print_success(f"เปลี่ยนชื่อสำเร็จ! {data.get('message')}")
        return True
    else:
        print_error(f"เปลี่ยนชื่อไม่สำเร็จ: {response.text}")
        return False

# ขั้นตอนที่ 4: อัพเดทอีเมล์
def update_email(token, new_email):
    print_info(f"กำลังเปลี่ยนอีเมล์เป็น '{new_email}'...")
    response = requests.put(
        f"{BASE_URL}/profile/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"email": new_email}
    )
    
    if response.status_code == 200:
        data = response.json()
        print_success(f"เปลี่ยนอีเมล์สำเร็จ! {data.get('message')}")
        return True
    else:
        print_error(f"เปลี่ยนอีเมล์ไม่สำเร็จ: {response.text}")
        return False

# ขั้นตอนที่ 5: เปลี่ยนรหัสผ่าน
def change_password(token, old_password, new_password):
    print_info("กำลังเปลี่ยนรหัสผ่าน...")
    response = requests.post(
        f"{BASE_URL}/profile/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "old_password": old_password,
            "new_password": new_password
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        print_success(f"เปลี่ยนรหัสผ่านสำเร็จ! {data.get('message')}")
        return True
    else:
        print_error(f"เปลี่ยนรหัสผ่านไม่สำเร็จ: {response.text}")
        return False

# ขั้นตอนที่ 6: ทดสอบ Login ด้วยรหัสผ่านใหม่
def test_login_with_new_credentials(email, password):
    print_info(f"ทดสอบ Login ด้วยข้อมูลใหม่...")
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={
            "email": email,
            "password": password
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        user = data.get("data", {}).get("user")
        print_success(f"Login ด้วยข้อมูลใหม่สำเร็จ! ผู้ใช้: {user.get('name')}")
        return True
    else:
        print_error(f"Login ด้วยข้อมูลใหม่ไม่สำเร็จ: {response.text}")
        return False

# เริ่มทดสอบ
def main():
    print("\n" + "="*60)
    print("   🧪 ทดสอบ Profile API - เปลี่ยนชื่อ, อีเมล์, รหัสผ่าน")
    print("="*60 + "\n")
    
    # 1. Login
    token, user = login()
    if not token:
        return
    
    print("\n" + "-"*60 + "\n")
    
    # 2. ดึงข้อมูล Profile เดิม
    original_profile = get_profile(token)
    if not original_profile:
        return
    
    original_name = original_profile.get('name')
    original_email = original_profile.get('email')
    
    print("\n" + "-"*60 + "\n")
    
    # 3. ทดสอบเปลี่ยนชื่อ
    new_name = "ทดสอบ เปลี่ยนชื่อ"
    if update_name(token, new_name):
        updated_profile = get_profile(token)
        if updated_profile and updated_profile.get('name') == new_name:
            print_success(f"ตรวจสอบแล้ว: ชื่อเปลี่ยนเป็น '{new_name}' จริง!")
        else:
            print_error("ชื่อไม่เปลี่ยนในฐานข้อมูล")
    
    print("\n" + "-"*60 + "\n")
    
    # 4. ทดสอบเปลี่ยนอีเมล์
    new_email = "test_updated@art.com"
    old_password = "admin@123"  # กำหนดรหัสผ่านเดิมก่อน
    print_warning(f"กำลังเปลี่ยนอีเมล์จาก {original_email} เป็น {new_email}")
    if update_email(token, new_email):
        # Login ใหม่ด้วยอีเมล์ใหม่เพื่อรับ token ใหม่
        print_info("Login ใหม่ด้วยอีเมล์ใหม่เพื่อรับ token ใหม่...")
        token, _ = login(new_email, old_password)
        
        if token:
            updated_profile = get_profile(token)
            if updated_profile and updated_profile.get('email') == new_email:
                print_success(f"ตรวจสอบแล้ว: อีเมล์เปลี่ยนเป็น '{new_email}' จริง!")
            else:
                print_error("อีเมล์ไม่เปลี่ยนในฐานข้อมูล")
    
    print("\n" + "-"*60 + "\n")
    
    # 5. ทดสอบเปลี่ยนรหัสผ่าน
    new_password = "newpassword123"
    if change_password(token, old_password, new_password):
        print_success("เปลี่ยนรหัสผ่านสำเร็จ")
        
        print("\n" + "-"*60 + "\n")
        
        # 6. ทดสอบ Login ด้วยรหัสผ่านใหม่
        if test_login_with_new_credentials(new_email, new_password):
            print_success("ทดสอบ Login ด้วยข้อมูลใหม่สำเร็จ!")
        
        print("\n" + "-"*60 + "\n")
        
        # 7. เปลี่ยนกลับเป็นค่าเดิม
        print_info("กำลังเปลี่ยนข้อมูลกลับเป็นค่าเดิม...")
        token_new, _ = login(new_email, new_password)  # Login ด้วยข้อมูลใหม่
        if token_new:
            update_name(token_new, original_name)
            update_email(token_new, original_email)
            change_password(token_new, new_password, old_password)
            print_success("เปลี่ยนข้อมูลกลับเป็นค่าเดิมแล้ว")
    
    print("\n" + "="*60)
    print("   ✅ ทดสอบเสร็จสิ้น!")
    print("="*60 + "\n")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print_error(f"เกิดข้อผิดพลาด: {str(e)}")
        import traceback
        traceback.print_exc()
