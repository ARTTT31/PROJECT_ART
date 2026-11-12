"""
Create the first admin account.

Run: python scripts/admin/create_admin.py

The email and password are asked for explicitly — this script used to ship
`admin@art.com` / `Admin@123` defaults, which is a published credential on any
repository that contains it. Nothing is defaulted now: an empty answer aborts.
"""

import getpass
import sys

from sqlalchemy.orm import Session

from app.core.database import SessionLocal, engine
from app.core.security import get_password_hash
from app.models.base import Base
from app.models.user import User

# A deployment owns its schema through Alembic; this only helps a fresh dev DB.
Base.metadata.create_all(bind=engine)

MIN_PASSWORD_LENGTH = 8


def create_admin_user(email: str, password: str, name: str = "Admin User") -> bool:
    """Create the admin account if the address is free."""
    db: Session = SessionLocal()

    try:
        existing_user = db.query(User).filter(User.email == email).first()

        if existing_user:
            print(f"User with email {email} already exists!")
            return False

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

        # The password is deliberately not echoed: a terminal scrollback is a log.
        print("Admin user created successfully!")
        print(f"   Email: {email}")
        print(f"   Name:  {name}")
        print("   Role:  admin")
        print("\nChange the password after the first login.")
        return True

    except Exception as e:
        print(f"Error creating admin user: {e}")
        db.rollback()
        return False

    finally:
        db.close()


if __name__ == "__main__":
    print("Creating admin user...")
    print("-" * 50)

    email = input("Admin email: ").strip()
    password = getpass.getpass("Admin password: ").strip()
    name = input("Admin name (default: Admin User): ").strip() or "Admin User"

    if not email or "@" not in email:
        print("A valid email address is required.")
        sys.exit(2)

    if len(password) < MIN_PASSWORD_LENGTH:
        print(f"The password must be at least {MIN_PASSWORD_LENGTH} characters.")
        sys.exit(2)

    print("-" * 50)
    sys.exit(0 if create_admin_user(email, password, name) else 1)
