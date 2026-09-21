"""Private personal-task endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.task import PersonalTask
from app.models.user import User
from app.schemas.task import PersonalTaskCreate, PersonalTaskResponse, PersonalTaskUpdate

router = APIRouter()


async def _get_owned_task(task_id: int, user_id: int, db: AsyncSession) -> PersonalTask:
    result = await db.execute(
        select(PersonalTask).where(PersonalTask.id == task_id, PersonalTask.user_id == user_id)
    )
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ไม่พบรายการงาน")
    return task


@router.get("/", response_model=list[PersonalTaskResponse])
async def list_tasks(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(PersonalTask)
        .where(PersonalTask.user_id == current_user.id)
        .order_by(
            PersonalTask.is_completed,
            PersonalTask.due_date.is_(None),
            PersonalTask.due_date,
            PersonalTask.created_at.desc(),
        )
    )
    return result.scalars().all()


@router.post("/", response_model=PersonalTaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: PersonalTaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = PersonalTask(user_id=current_user.id, **payload.model_dump())
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.patch("/{task_id}", response_model=PersonalTaskResponse)
async def update_task(
    task_id: int,
    payload: PersonalTaskUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await _get_owned_task(task_id, current_user.id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    await db.commit()
    await db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await _get_owned_task(task_id, current_user.id, db)
    await db.delete(task)
    await db.commit()
