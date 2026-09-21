"""Schemas for private dashboard tasks."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


TaskPriority = Literal["low", "medium", "high"]


class PersonalTaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=250)
    priority: TaskPriority = "medium"
    due_date: date | None = None


class PersonalTaskUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=250)
    priority: TaskPriority | None = None
    due_date: date | None = None
    is_completed: bool | None = None


class PersonalTaskResponse(BaseModel):
    id: int
    title: str
    priority: TaskPriority
    due_date: date | None
    is_completed: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
