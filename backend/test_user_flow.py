import os
import sys

# Set environment variables for testing BEFORE importing any app modules
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only"
os.environ["ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "30"
os.environ["REFRESH_TOKEN_EXPIRE_DAYS"] = "7"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"

# Add current directory to path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

import asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.core.database import Base, get_db
from app.models.user import User
from app.models.session import UserSession
from app.core.security import get_password_hash

# Set up test database
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session

app.dependency_overrides[get_db] = override_get_db

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

def run_tests():
    # Run the async initialization
    asyncio.run(init_db())
    
    # Use https and testserver.local to ensure secure cookies match domains properly
    client = TestClient(app, base_url="https://testserver.local")
    
    # Pre-create an admin user so we can test admin endpoints
    async def create_admin():
        async with TestingSessionLocal() as session:
            admin = User(
                email="admin@example.com",
                username="admin",
                display_name="System Admin",
                name="System Admin",
                hashed_password=get_password_hash("AdminPass123"),
                role="admin",
                is_active=True
            )
            session.add(admin)
            await session.commit()
    
    asyncio.run(create_admin())
    
    # ── Test 1: Admin creates a new user ──
    print("Running Test 1: Admin creates a new user...")
    # First, login as admin to get auth cookies
    admin_login_resp = client.post("/api/v1/auth/login", json={
        "email": "admin@example.com",
        "password": "AdminPass123"
    })
    assert admin_login_resp.status_code == 200, f"Admin login failed: {admin_login_resp.text}"
    print("Admin login successful. Cookies:", client.cookies)
    
    # Admin creates user
    create_resp = client.post("/api/v1/users/admin-create", json={
        "username": "testuser",
        "display_name": "Test User",
        "password": "UserPass123",
        "email": "testuser@example.com",
        "role": "user"
    })
    assert create_resp.status_code == 201, f"Admin user creation failed: {create_resp.text}"
    print("Test 1 Passed: User created successfully.")
    
    # Clear admin credentials from client to test standard user login
    client.cookies.clear()
    
    # ── Test 2: Login with Username + Password ──
    print("\nRunning Test 2: Login with Username + Password...")
    login_username_resp = client.post("/api/v1/auth/login", json={
        "email": "testuser",  # input is username
        "password": "UserPass123"
    })
    assert login_username_resp.status_code == 200, f"Login with username failed: {login_username_resp.text}"
    assert "access_token" in client.cookies, "Cookies do not contain access_token"
    print("Test 2 Passed: Logged in using username. Cookies:", client.cookies)
    
    # Clear cookies
    client.cookies.clear()
    
    # ── Test 3: Login with Email + Password ──
    print("\nRunning Test 3: Login with Email + Password...")
    login_email_resp = client.post("/api/v1/auth/login", json={
        "email": "testuser@example.com",  # input is email
        "password": "UserPass123"
    })
    assert login_email_resp.status_code == 200, f"Login with email failed: {login_email_resp.text}"
    assert "access_token" in client.cookies, "Cookies do not contain access_token"
    print("Test 3 Passed: Logged in using email. Cookies:", client.cookies)
    
    # Clear cookies
    client.cookies.clear()
    
    # ── Test 4: Login with incorrect password ──
    print("\nRunning Test 4: Login with incorrect password (expecting 401)...")
    login_wrong_resp = client.post("/api/v1/auth/login", json={
        "email": "testuser",
        "password": "WrongPassword"
    })
    assert login_wrong_resp.status_code == 401, f"Expected 401 but got: {login_wrong_resp.status_code}"
    print("Test 4 Passed: Got expected 401 error. Detail:", login_wrong_resp.json().get("detail"))

if __name__ == "__main__":
    try:
        run_tests()
        print("\nAll tests passed successfully!")
    except AssertionError as e:
        print(f"\nTest failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
