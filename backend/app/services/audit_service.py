from datetime import date, datetime, time

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, func, or_, select
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
        target_user_id: Optional[int] = None,
    ) -> AuditLog:
        db_log = AuditLog(
            user_id=user_id,
            target_user_id=target_user_id,
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
        action: Optional[str] = None,
        q: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> List:
        """WHERE clauses shared by the listing and its total count.

        The admin page filters by action, by a free-text term that matches the
        details, the actor's name or the actor's email, and by a calendar-day
        range; both halves have to use the same clauses or the paging totals
        stop matching the rows. ``date_to`` is inclusive.
        """
        conditions: List = []
        if action:
            conditions.append(AuditLog.action == action)
        if date_from:
            conditions.append(
                AuditLog.created_at >= datetime.combine(date_from, time.min)
            )
        if date_to:
            conditions.append(
                AuditLog.created_at <= datetime.combine(date_to, time.max)
            )
        term = (q or "").strip()
        if term:
            pattern = f"%{term.lower()}%"
            conditions.append(
                or_(
                    func.lower(AuditLog.details).like(pattern),
                    func.lower(User.name).like(pattern),
                    func.lower(User.email).like(pattern),
                    # The address is no longer shown, but a known address is
                    # still a way in: "what happened from here" must not be a
                    # dead end in the search box.
                    AuditLog.ip_address.like(pattern),
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
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ):
        statement = (
            select(AuditLog)
            .options(joinedload(AuditLog.user), joinedload(AuditLog.target_user))
            .outerjoin(User, AuditLog.user_id == User.id)
            # `id` breaks ties: rows written in the same second arrive in one
            # order, and the page an anchor lands on is counted with the same
            # order, so the two can never disagree about where a row sits.
            .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            .offset(skip)
            .limit(limit)
        )
        conditions = self._filters(action, q, date_from, date_to)
        if conditions:
            statement = statement.where(*conditions)
        result = await self.db.execute(statement)
        return result.scalars().all()

    async def count_logs(
        self,
        *,
        action: Optional[str] = None,
        q: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> int:
        statement = select(func.count(AuditLog.id)).outerjoin(
            User, AuditLog.user_id == User.id
        )
        conditions = self._filters(action, q, date_from, date_to)
        if conditions:
            statement = statement.where(*conditions)
        result = await self.db.execute(statement)
        return result.scalar() or 0

    async def find_page(
        self,
        log_id: int,
        size: int = 20,
        *,
        action: Optional[str] = None,
        q: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> Optional[int]:
        """The 1-based page holding ``log_id`` under the same filters, or None.

        A shared link such as ``/audit#entry-42`` names a row, not a page: this
        is what lets the page go wherever that row ended up instead of showing
        page 1 and leaving the anchor unresolved. The count follows the
        listing's own order (newest first, ``id`` breaking ties) and applies the
        active filters; a row the filters exclude is reported as missing rather
        than pointed at.
        """
        conditions = self._filters(action, q, date_from, date_to)
        target = await self.db.execute(
            select(AuditLog.created_at, AuditLog.id)
            .outerjoin(User, AuditLog.user_id == User.id)
            .where(AuditLog.id == log_id, *conditions)
        )
        row = target.first()
        if row is None:
            return None
        created_at, target_id = row

        earlier = await self.db.execute(
            select(func.count(AuditLog.id))
            .outerjoin(User, AuditLog.user_id == User.id)
            .where(
                or_(
                    AuditLog.created_at > created_at,
                    and_(
                        AuditLog.created_at == created_at,
                        AuditLog.id > target_id,
                    ),
                ),
                *conditions,
            )
        )
        return (earlier.scalar() or 0) // max(size, 1) + 1
