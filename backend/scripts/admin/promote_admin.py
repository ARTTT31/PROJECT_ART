"""
Promote an existing account to admin (or create it as admin).

Run from the backend directory:

    py scripts/admin/promote_admin.py thanyapong.art@gmail.com
    py scripts/admin/promote_admin.py thanyapong.art@gmail.com --create

The script talks to whatever ``DATABASE_URL`` is configured for the environment
it runs in, so the same command works against the local SQLite database and,
from the Render shell, against production.

Only ``role`` is changed on an existing account: page access, password, and
sessions are left untouched so the promotion is a single, reviewable change.
A Google account signs in by email, so an account created here with a random
password still works through Google sign-in.
"""

import argparse
import asyncio
import secrets
import sys
from pathlib import Path
from urllib.parse import urlsplit

# Running this file by path puts ``scripts/admin`` on sys.path, not the backend
# root, so ``app`` would not be importable without this.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from sqlalchemy import func, select  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.database import SessionLocal  # noqa: E402
from app.core.security import get_password_hash  # noqa: E402
from app.core.utils import utcnow  # noqa: E402
from app.models.user import User  # noqa: E402


def describe_database(url: str) -> str:
    """Return ``url`` without credentials, so the target is visible but safe."""
    if url.startswith("sqlite"):
        return url
    parts = urlsplit(url)
    return f"{parts.scheme}://{parts.hostname}/{parts.path.lstrip('/')}"


async def promote(email: str, create: bool, activate: bool) -> int:
    async with SessionLocal() as db:
        result = await db.execute(
            select(User).where(func.lower(User.email) == email.lower())
        )
        user = result.scalar_one_or_none()

        if user is not None and user.deleted_at is not None:
            print(f"[ERROR] {email} is in the trash (deleted_at={user.deleted_at}).")
            print("   Restore it first: POST /api/v1/users/{id}/restore")
            return 1

        if user is None:
            if not create:
                print(f"[ERROR] No account with email {email} in this database.")
                print("   Sign in once (Google creates the account), then re-run this script,")
                print("   or pass --create to add it now.")
                return 1
            # Google sign-in matches on email, so the password is never needed;
            # a random one keeps password login impossible until it is reset.
            user = User(
                email=email,
                name=email.split("@")[0],
                hashed_password=get_password_hash(secrets.token_urlsafe(32)),
                role="admin",
                is_active=True,
                email_verified_at=utcnow(),
            )
            db.add(user)
            print(f"[NEW] Created account {email} as admin.")

        if user.role != "admin":
            user.role = "admin"

        if activate:
            was_inactive = not user.is_active or user.status
            user.is_active = True
            user.status = None
            user.is_locked = False
            user.locked_until = None
            user.failed_login_attempts = 0
            if was_inactive:
                print("[OK] Activated the account and cleared the lockout counters.")

        await db.commit()

        print("[OK] Admin promotion complete")
        print(f"   id:       {user.id}")
        print(f"   email:    {user.email}")
        print(f"   role:     {user.role}")
        print(f"   active:   {bool(user.is_active)}")
        if not user.is_active:
            print("[WARN] The account is inactive, so login still fails.")
            print("   Re-run with --activate (or approve it in the admin panel).")
        return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Promote an account to admin.")
    parser.add_argument("email", help="Account email address")
    parser.add_argument(
        "--create",
        action="store_true",
        help="Create the account when it does not exist yet",
    )
    parser.add_argument(
        "--activate",
        action="store_true",
        help="Also reactivate the account and clear lockout counters",
    )
    args = parser.parse_args()

    print(f"Database: {describe_database(settings.DATABASE_URL)}")
    return asyncio.run(promote(args.email.strip(), args.create, args.activate))


if __name__ == "__main__":
    sys.exit(main())
