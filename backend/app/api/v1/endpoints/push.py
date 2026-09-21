import json
import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from pywebpush import WebPushException, webpush
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.user import User

router = APIRouter()


class PushSubscription(BaseModel):
    endpoint: str
    keys: dict[str, str]


class TestPushRequest(BaseModel):
    title: str = "ทดสอบการแจ้งเตือน"
    body: str = "การแจ้งเตือนจาก ART Workspace ทำงานได้ปกติครับ! 🚀"


@router.post("/subscribe")
async def subscribe_push(
    subscription: PushSubscription,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        subscriptions = json.loads(current_user.push_subscriptions or "[]")
        if not any(item.get("endpoint") == subscription.endpoint for item in subscriptions):
            subscriptions.append(subscription.model_dump())
            current_user.push_subscriptions = json.dumps(subscriptions)
            await db.commit()
        return {"status": "success", "message": "Subscription saved"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/test")
async def test_push(request: TestPushRequest, current_user: User = Depends(get_current_user)):
    if not current_user.push_subscriptions:
        raise HTTPException(status_code=400, detail="คุณยังไม่ได้เปิดรับการแจ้งเตือนในอุปกรณ์นี้")

    vapid_private_key = os.getenv("VAPID_PRIVATE_KEY")
    vapid_subject = os.getenv("VAPID_SUBJECT")
    if not vapid_private_key or not vapid_subject:
        raise HTTPException(status_code=500, detail="เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า VAPID keys")

    errors: list[str] = []
    success_count = 0
    for subscription in json.loads(current_user.push_subscriptions):
        try:
            webpush(
                subscription_info=subscription,
                data=json.dumps({"title": request.title, "body": request.body}),
                vapid_private_key=vapid_private_key,
                vapid_claims={"sub": vapid_subject},
            )
            success_count += 1
        except WebPushException as exc:
            errors.append(str(exc))

    if success_count == 0 and errors:
        raise HTTPException(status_code=500, detail=f"ส่งการแจ้งเตือนไม่สำเร็จ: {errors}")
    return {"status": "success", "message": f"ส่งการแจ้งเตือนไป {success_count} อุปกรณ์สำเร็จแล้ว"}
