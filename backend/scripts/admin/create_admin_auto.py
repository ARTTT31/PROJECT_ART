"""
Create the first admin account from environment variables (CI / first deploy).

Run: ADMIN_EMAIL=you@domain.tld ADMIN_PASSWORD='…' python scripts/admin/create_admin_auto.py

The credentials used to be hardcoded (`admin@art.com` / `admin123`), which made
this script a published login for every deployment that ran it. They now come
from the environment and the script refuses to run without them.
"""

import os
import sys

from sqlalchemy.orm import Session

from app.core.database import SessionLocal, engine
from app.core.security import get_password_hash
from app.models.base import Base
from app.models.user import User

Base.metadata.create_all(bind=engine)

MIN_PASSWORD_LENGTH = 8


def create_admin_user(email: str, password: str, name: str = "Admin User") -> bool:
    """Create the admin account if the address is free."""
    db: Session = SessionLocal()

    try:
        existing_user = db.query(User).filter(User.email == email).first()

        if existing_user:
            print(f"User with email {email} already exists.")
            return True

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

        print("Admin user created successfully.")
        print(f"   Email: {email}")
        print(f"   Name:  {name}")
        print("   Role:  admin")
        return True

    except Exception as e:
        print(f"Error creating admin user: {e}")
        db.rollback()
        return False

    finally:
        db.close()


if __name__ == "__main__":
    email = (os.getenv("ADMIN_EMAIL") or "").strip()
    password = os.getenv("ADMIN_PASSWORD") or ""
    name = (os.getenv("ADMIN_NAME") or "Admin User").strip()

    if not email or "@" not in email or not password:
        print(
            "ADMIN_EMAIL and ADMIN_PASSWORD must be set; there are no default "
            "credentials in this script."
        )
        sys.exit(2)

    if len(password) < MIN_PASSWORD_LENGTH:
        print(f"The password must be at least {MIN_PASSWORD_LENGTH} characters.")
        sys.exit(2)

    sys.exit(0 if create_admin_user(email, password, name) else 1)
