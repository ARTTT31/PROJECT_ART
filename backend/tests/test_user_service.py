from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import pytest

from app.core.database import Base
from app.services.user_service import UserService
from app.schemas.user import UserCreate


def make_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


def test_create_user_success():
    db = make_session()
    svc = UserService(db)
    user_in = UserCreate(email="test@example.com", password="secret123", name="Tester")
    user = svc.create_user(user_in)
    assert user.id == 1
    assert user.email == "test@example.com"


def test_create_user_duplicate_email():
    db = make_session()
    svc = UserService(db)
    user_in = UserCreate(email="test@example.com", password="secret123", name="Tester")
    svc.create_user(user_in)
    with pytest.raises(ValueError):
        svc.create_user(user_in)
