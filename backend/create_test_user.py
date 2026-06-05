"""
Script to create test user for login testing
"""
from app.core.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash

def create_test_user():
    """Create test admin user"""
    db = SessionLocal()
    
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == "admin@art.com").first()
        
        if existing_user:
            print("✓ Test user already exists")
            print(f"  Email: admin@art.com")
            print(f"  Password: admin@123")
            return
        
        # Create new user
        test_user = User(
            email="admin@art.com",
            hashed_password=get_password_hash("admin@123"),
            name="Admin User",
            role="admin",
            is_active=True,
            is_locked=False,
            failed_login_attempts=0
        )
        
        db.add(test_user)
        db.commit()
        db.refresh(test_user)
        
        print("✓ Test user created successfully!")
        print(f"  Email: {test_user.email}")
        print(f"  Password: admin@123")
        print(f"  Role: {test_user.role}")
        
    except Exception as e:
        print(f"✗ Error creating test user: {str(e)}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_test_user()
