"""Web Push Service (RFC 8291 / RFC 8292 VAPID).

Manages VAPID keypair generation and asynchronous delivery of Web Push
notifications to browser endpoints (Google FCM, Apple APNs, Mozilla Autopush).
"""

import base64
import json
import logging
from typing import Any, Dict, List, Optional, Tuple

from cryptography.hazmat.primitives import serialization
from py_vapid import Vapid
from pywebpush import WebPushException, webpush_async
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User

logger = logging.getLogger(__name__)

# Cached VAPID keypair when not explicitly provided in environment
_in_memory_vapid: Optional[Vapid] = None
_in_memory_public_key: Optional[str] = None


def _init_in_memory_vapid() -> Tuple[Vapid, str]:
    """Initialize or retrieve the in-memory fallback VAPID keypair."""
    global _in_memory_vapid, _in_memory_public_key
    if _in_memory_vapid is None:
        vapid = Vapid()
        vapid.generate_keys()
        raw_pub = vapid.public_key.public_bytes(
            encoding=serialization.Encoding.X962,
            format=serialization.PublicFormat.UncompressedPoint,
        )
        pub_b64 = base64.urlsafe_b64encode(raw_pub).rstrip(b"=").decode("ascii")
        _in_memory_vapid = vapid
        _in_memory_public_key = pub_b64
    return _in_memory_vapid, _in_memory_public_key or ""


def get_vapid_public_key() -> str:
    """Return the base64url-encoded uncompressed P-256 public key (87 chars).

    Passed to the browser's pushManager.subscribe({ applicationServerKey: ... }).
    """
    if settings.VAPID_PUBLIC_KEY.strip():
        return settings.VAPID_PUBLIC_KEY.strip()
    _, pub_key = _init_in_memory_vapid()
    return pub_key


def get_vapid_private_key() -> Any:
    """Return the private key representation accepted by pywebpush."""
    if settings.VAPID_PRIVATE_KEY.strip():
        return settings.VAPID_PRIVATE_KEY.strip()
    vapid, _ = _init_in_memory_vapid()
    return vapid


async def send_web_push(
    subscription_info: Dict[str, Any],
    payload: Dict[str, Any],
    ttl: int = 86400,
) -> bool:
    """Send a Web Push notification to a single browser push subscription.

    Args:
        subscription_info: Dict containing "endpoint" and "keys" (p256dh, auth).
        payload: Dict with "title", "body", and optional "url", "icon".
        ttl: Time to live in seconds (default: 24 hours).

    Returns:
        True if sent successfully, False otherwise.
    """
    endpoint = subscription_info.get("endpoint", "")
    if not endpoint or endpoint.startswith("browser-native-notification"):
        logger.debug("Skipping simulated local subscription: %s", endpoint)
        return False

    vapid_key = get_vapid_private_key()
    subject = settings.VAPID_SUBJECT or "mailto:admin@example.com"
    data_str = json.dumps(payload, ensure_ascii=False)

    try:
        await webpush_async(
            subscription_info=subscription_info,
            data=data_str,
            vapid_private_key=vapid_key,
            vapid_claims={"sub": subject},
            ttl=ttl,
        )
        logger.info("Web push successfully dispatched to %s", endpoint[:45] + "...")
        return True
    except WebPushException as exc:
        logger.warning(
            "Web push delivery failed for endpoint %s: %s (status: %s)",
            endpoint[:45] + "...",
            exc,
            getattr(exc.response, "status_code", None),
        )
        raise exc
    except Exception as exc:
        logger.error("Unexpected error sending web push: %s", exc)
        return False


async def send_web_push_to_user(
    db: AsyncSession,
    user: User,
    title: str,
    body: str,
    url: str = "/dashboard",
    icon: str = "/icons/icon-192x192.png",
) -> bool:
    """Send a Web Push notification to all active devices registered to the user.

    If a subscription has expired or been revoked (HTTP 404 or 410 Gone),
    it is automatically pruned from the database.
    """
    raw_sub = getattr(user, "web_push_subscription", None)
    if not raw_sub:
        logger.debug("User %s has no web push subscription", user.id)
        return False

    try:
        data = json.loads(raw_sub)
    except Exception:
        logger.warning("Invalid JSON in web_push_subscription for user %s", user.id)
        return False

    subs: List[Dict[str, Any]] = data if isinstance(data, list) else [data]
    valid_subs: List[Dict[str, Any]] = []
    delivered_count = 0
    modified = False

    payload = {
        "title": title,
        "body": body,
        "url": url,
        "icon": icon,
    }

    for sub in subs:
        endpoint = sub.get("endpoint")
        if not endpoint:
            modified = True
            continue

        try:
            success = await send_web_push(sub, payload)
            if success:
                delivered_count += 1
            valid_subs.append(sub)
        except WebPushException as exc:
            status_code = getattr(exc.response, "status_code", None)
            if status_code in (404, 410):
                # Subscription expired or unsubscribed on browser side
                logger.info(
                    "Pruning expired web push subscription (%s) for user %s",
                    status_code,
                    user.id,
                )
                modified = True
            else:
                # Temporary failure (5xx or network); keep subscription
                valid_subs.append(sub)
        except Exception:
            valid_subs.append(sub)

    if modified:
        user.web_push_subscription = json.dumps(valid_subs) if valid_subs else None
        db.add(user)
        try:
            await db.commit()
        except Exception as exc:
            logger.error("Failed to prune expired subscription for user %s: %s", user.id, exc)

    return delivered_count > 0
