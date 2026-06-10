"""
Session Model for tracking user sessions
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, _utcnow


class UserSession(Base, TimestampMixin):
    """Session model for tracking active user sessions"""

    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(255), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Session metadata
    user_agent = Column(String(500), nullable=True)
    device_label = Column(String(255), nullable=True)
    ip_address = Column(String(45), nullable=True)
    
    # Session status
    is_active = Column(Boolean, default=True, nullable=False)
    last_activity = Column(DateTime, default=_utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="sessions")

    def __repr__(self):
        return f"<UserSession(id={self.id}, user_id={self.user_id}, session_id='{self.session_id[:8]}...')>"
