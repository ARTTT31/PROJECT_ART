from app.core.database import SessionLocal
from app.models.user import User
from app.core.security import verify_password, get_password_hash

db = SessionLocal()
user = db.query(User).filter(User.email == 'admin@art.com').first()

if user:
    print(f"User: {user.email}")
    print(f"Name: {user.name}")
    print(f"Role: {user.role}")
    print(f"\nTesting passwords:")
    print(f"  admin@123: {verify_password('admin@123', user.hashed_password)}")
    print(f"  admin123: {verify_password('admin123', user.hashed_password)}")
    
    # Reset password to admin@123
    print(f"\nResetting password to 'admin@123'...")
    user.hashed_password = get_password_hash('admin@123')
    db.commit()
    print("Password reset successfully!")
else:
    print("User not found!")

db.close()
