"""
Script to create initial admin user
Run: python create_admin.py
"""
import sys
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, engine
from app.models.base import Base
from app.models.user import User
from app.core.security import get_password_hash

# Create tables
Base.metadata.create_all(bind=engine)


def create_admin_user(
    email: str = "admin@art.com",
    password: str = "Admin@123",
    name: str = "Admin User",
):
    """Create admin user if not exists"""
    db: Session = SessionLocal()
    
    try:
        # Check if admin already exists
        existing_user = db.query(User).filter(User.email == email).first()
        
        if existing_user:
            print(f"❌ User with email {email} already exists!")
            return False
        
        # Create admin user
        admin_user = User(
            email=email,
            hashed_password=get_password_hash(password),
            name=name,
            role="admin",
            is_active=True,
        )
        
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        
        print("✅ Admin user created successfully!")
        print(f"   Email: {email}")
        print(f"   Password: {password}")
        print(f"   Name: {name}")
        print(f"   Role: admin")
        print("\n⚠️  Please change the password after first login!")
        
        return True
        
    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        db.rollback()
        return False
        
    finally:
        db.close()


if __name__ == "__main__":
    print("🚀 Creating admin user...")
    print("-" * 50)
    
    # You can customize these values
    email = input("Admin email (default: admin@art.com): ").strip() or "admin@art.com"
    password = input("Admin password (default: Admin@123): ").strip() or "Admin@123"
    name = input("Admin name (default: Admin User): ").strip() or "Admin User"
    
    print("-" * 50)
    success = create_admin_user(email, password, name)
    
    if success:
        sys.exit(0)
    else:
        sys.exit(1)
