"""
API endpoint tests for ART Workspace backend.
Uses FastAPI TestClient with in-memory SQLite.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import patch

from app.core.database import Base, get_db
from app.main import app
from app.schemas.user import UserCreate


# ── Fixtures ──────────────────────────────────────────────

@pytest.fixture
def db_session():
    """Create a fresh in-memory SQLite database for each test."""
    engine = create_engine(
        "sqlite:///:memory:", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture
def client(db_session):
    """Create a TestClient with overridden DB dependency."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def registered_user(client):
    """Register a user and return the response data."""
    resp = client.post("/api/v1/auth/register", json={
        "email": "test@example.com",
        "password": "SecretPass123",
        "name": "Test User",
    })
    return resp.json()


@pytest.fixture
def logged_in_user(client, registered_user):
    """Login and return the response data with tokens."""
    resp = client.post("/api/v1/auth/login", json={
        "email": "test@example.com",
        "password": "SecretPass123",
    })
    return resp.json()


# ── Health Check Tests ────────────────────────────────────

class TestHealthCheck:
    def test_root_endpoint(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["message"] == "ART Workspace API"
        assert data["status"] == "running"

    def test_health_endpoint(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"


# ── Auth API Tests ────────────────────────────────────────

class TestAuthAPI:
    def test_register_success(self, client):
        resp = client.post("/api/v1/auth/register", json={
            "email": "new@example.com",
            "password": "NewPass123",
            "name": "New User",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["result"] == "success"

    def test_register_duplicate_email(self, client, registered_user):
        resp = client.post("/api/v1/auth/register", json={
            "email": "test@example.com",
            "password": "AnotherPass",
            "name": "Another User",
        })
        assert resp.status_code == 400

    def test_login_success(self, client, registered_user):
        resp = client.post("/api/v1/auth/login", json={
            "email": "test@example.com",
            "password": "SecretPass123",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["result"] == "success"
        assert "access_token" in data["data"]
        assert "refresh_token" in data["data"]
        assert data["data"]["user"]["email"] == "test@example.com"

    def test_login_wrong_password(self, client, registered_user):
        resp = client.post("/api/v1/auth/login", json={
            "email": "test@example.com",
            "password": "WrongPassword",
        })
        assert resp.status_code == 401

    def test_login_nonexistent_email(self, client):
        resp = client.post("/api/v1/auth/login", json={
            "email": "nobody@example.com",
            "password": "Whatever",
        })
        assert resp.status_code == 401

    def test_login_inactive_user(self, client, registered_user, db_session):
        from app.models.user import User
        user = db_session.query(User).filter(User.email == "test@example.com").first()
        user.is_active = False
        db_session.commit()

        resp = client.post("/api/v1/auth/login", json={
            "email": "test@example.com",
            "password": "SecretPass123",
        })
        assert resp.status_code == 403

    def test_refresh_token_success(self, client, logged_in_user):
        refresh_token = logged_in_user["data"]["refresh_token"]
        resp = client.post("/api/v1/auth/refresh", params={"refresh_token": refresh_token})
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data

    def test_refresh_token_invalid(self, client):
        resp = client.post("/api/v1/auth/refresh", params={"refresh_token": "invalid.token"})
        assert resp.status_code == 401

    def test_logout_success(self, client, logged_in_user):
        session_id = logged_in_user["data"]["session_id"]
        resp = client.post("/api/v1/auth/logout", params={"session_id": session_id})
        assert resp.status_code == 200
        data = resp.json()
        assert data["result"] == "success"


# ── Profile API Tests ─────────────────────────────────────

class TestProfileAPI:
    def test_get_profile(self, client, logged_in_user):
        token = logged_in_user["data"]["access_token"]
        resp = client.get("/api/v1/profile/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200

    def test_get_profile_unauthorized(self, client):
        resp = client.get("/api/v1/profile/me")
        assert resp.status_code in [401, 403]