"""DATABASE_URL normalisation: dashboard templates and libpq-only arguments."""

import pytest
from pydantic import ValidationError

from app.core.config import Settings

PLACEHOLDER_URL = (
    "postgresql://postgres.cnyndllyvyqawzazczdj:[YOUR-DATABASE-PASSWORD]"
    "@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
)


def _settings(url: str) -> Settings:
    return Settings(DATABASE_URL=url, SECRET_KEY="x" * 40, _env_file=None)


def test_pasted_password_placeholder_is_rejected_with_an_actionable_message() -> None:
    """The panel shows ``[YOUR-DATABASE-PASSWORD]``; pasting it must not deploy."""
    with pytest.raises(ValidationError, match="password placeholder"):
        _settings(PLACEHOLDER_URL)


def test_placeholder_does_not_surface_as_an_ipv6_error() -> None:
    """The bracket in the placeholder used to be read as an IPv6 host literal."""
    with pytest.raises(ValidationError) as excinfo:
        _settings(PLACEHOLDER_URL)

    assert "IPv4 or IPv6" not in str(excinfo.value)


def test_pooler_url_loses_the_libpq_only_query_arguments() -> None:
    url = (
        "postgresql://postgres.ref:secret@aws-1-ap-northeast-1.pooler.supabase.com"
        ":5432/postgres?sslmode=require&channel_binding=require"
    )

    assert _settings(url).DATABASE_URL == (
        "postgresql+asyncpg://postgres.ref:secret@aws-1-ap-northeast-1.pooler"
        ".supabase.com:5432/postgres"
    )
