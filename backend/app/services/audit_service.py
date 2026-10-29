from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, or_, select
from sqlalchemy.orm import joinedload
from app.models.audit_log import AuditLog
from app.models.user import User
from typing import List, Optional


class AuditService:
    """
    Service for audit log operations.

    NOTE: This service does NOT call db.commit().
    The caller is responsible for committing the transaction.
    This keeps transactional boundaries under the endpoint's control.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def log_action(
        self,
        action: str,
        user_id: Optional[int] = None,
        details: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AuditLog:
        db_log = AuditLog(
            user_id=user_id,
            action=action,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self.db.add(db_log)
        # Note: No commit() here — caller handles the transaction
        return db_log

    @staticmethod
    def _filters(
        action: Optional[str] = None, q: Optional[str] = None
    ) -> List:
        """WHERE clauses shared by the listing and its total count.

        The admin page filters by action and by a free-text term that matches the
        details, the actor's name or the actor's email; both halves have to use
        the same clauses or the paging totals stop matching the rows.
        """
        conditions: List = []
        if action:
            conditions.append(AuditLog.action == action)
        term = (q or "").strip()
        if term:
            pattern = f"%{term.lower()}%"
            conditions.append(
                or_(
                    func.lower(AuditLog.details).like(pattern),
                    func.lower(User.name).like(pattern),
                    func.lower(User.email).like(pattern),
                )
            )
        return conditions

    async def get_logs(
        self,
        skip: int = 0,
        limit: int = 100,
        *,
        action: Optional[str] = None,
        q: Optional[str] = None,
    ):
        statement = (
            select(AuditLog)
            .options(joinedload(AuditLog.user))
            .outerjoin(User, AuditLog.user_id == User.id)
            .order_by(AuditLog.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        conditions = self._filters(action, q)
        if conditions:
            statement = statement.where(*conditions)
        result = await self.db.execute(statement)
        return result.scalars().all()

    async def count_logs(
        self, *, action: Optional[str] = None, q: Optional[str] = None
    ) -> int:
        statement = select(func.count(AuditLog.id)).outerjoin(
            User, AuditLog.user_id == User.id
        )
        conditions = self._filters(action, q)
        if conditions:
            statement = statement.where(*conditions)
        result = await self.db.execute(statement)
        return result.scalar() or 0
