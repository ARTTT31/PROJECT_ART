"""
Script to create initial admin user automatically
Run: python create_admin_auto.py
"""
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, engine
from app.models.base import Base
from app.models.user import User
from app.core.security import get_password_hash

# Create tables
Base.metadata.create_all(bind=engine)

def create_admin_user():
    """Create admin user if not exists"""
    db: Session = SessionLocal()
    
    email = "admin@art.com"
    password = "admin123"
    name = "Admin User"
    
    try:
        # Check if admin already exists
        existing_user = db.query(User).filter(User.email == email).first()
        
        if existing_user:
            print(f"User with email {email} already exists!")
            print(f"Email: {email}")
            print(f"Password: admin123")
            return True
        
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
        
        print("Admin user created successfully!")
        print(f"Email: {email}")
        print(f"Password: {password}")
        print(f"Name: {name}")
        print(f"Role: admin")
        
        return True
        
    except Exception as e:
        print(f"Error creating admin user: {e}")
        db.rollback()
        return False
        
    finally:
        db.close()

if __name__ == "__main__":
    print("Creating admin user...")
    create_admin_user()
