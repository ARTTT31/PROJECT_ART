from app.core.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash

db = SessionLocal()

# Find user by any email
user = db.query(User).filter(User.role == 'admin').first()

if user:
    print(f"Found user: {user.email}")
    
    # Reset to original values
    user.email = "admin@art.com"
    user.name = "Admin User"
    user.hashed_password = get_password_hash('admin@123')
    
    db.commit()
    print(f"✅ User reset successfully!")
    print(f"   Email: admin@art.com")
    print(f"   Name: Admin User")
    print(f"   Password: admin@123")
else:
    print("No admin user found!")

db.close()
