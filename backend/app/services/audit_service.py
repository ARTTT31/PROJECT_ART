from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog
from typing import Optional


class AuditService:
    """
    Service for audit log operations.

    NOTE: This service does NOT call db.commit().
    The caller is responsible for committing the transaction.
    This keeps transactional boundaries under the endpoint's control.
    """

    def __init__(self, db: Session):
        self.db = db

    def log_action(
        self,
        action: str,
        user_id: Optional[int] = None,
        details: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> AuditLog:
        db_log = AuditLog(
            user_id=user_id,
            action=action,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent
        )
        self.db.add(db_log)
        # Note: No commit() here — caller handles the transaction
        return db_log

    def get_logs(self, skip: int = 0, limit: int = 100):
        from sqlalchemy.orm import joinedload
        return (
            self.db.query(AuditLog)
            .options(joinedload(AuditLog.user))
            .order_by(AuditLog.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
