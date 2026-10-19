"""Disposable-email blocklist (signup hygiene).

A short built-in list of high-traffic throwaway providers, plus whatever the
deployment adds through ``DISPOSABLE_EMAIL_DOMAINS`` (comma-separated). This is
a spam filter, not a security boundary — it is deliberately small and cheap,
and every entry is a domain whose only purpose is single-use inboxes.
"""

from app.core.config import settings

BUILTIN_DISPOSABLE_DOMAINS = frozenset(
    {
        "10minutemail.com",
        "dispostable.com",
        "fakeinbox.com",
        "getnada.com",
        "guerrillamail.com",
        "guerrillamail.net",
        "mailcatch.com",
        "maildrop.cc",
        "mailinator.com",
        "mailnesia.com",
        "mintemail.com",
        "mohmal.com",
        "mytemp.email",
        "sharklasers.com",
        "spamgourmet.com",
        "temp-mail.org",
        "tempinbox.com",
        "tempmail.com",
        "throwawaymail.com",
        "trashmail.com",
        "yopmail.com",
    }
)


def extra_disposable_domains() -> set[str]:
    raw = (settings.DISPOSABLE_EMAIL_DOMAINS or "").strip()
    return {d.strip().lower() for d in raw.split(",") if d.strip()}


def email_domain(email: str) -> str:
    return (email or "").rsplit("@", 1)[-1].strip().lower()


def is_disposable_email(email: str) -> bool:
    domain = email_domain(email)
    if not domain:
        return False
    return domain in BUILTIN_DISPOSABLE_DOMAINS or domain in extra_disposable_domains()
