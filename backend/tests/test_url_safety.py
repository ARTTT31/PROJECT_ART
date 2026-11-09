import pytest

from app.core.url_safety import UnsafeURLError, ensure_public_http_url

pytestmark = pytest.mark.asyncio


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1:8000/hook",
        "http://localhost/hook",
        "http://169.254.169.254/latest/meta-data",
        "http://10.0.0.5/hook",
        "http://[::1]/hook",
        "http://[::ffff:127.0.0.1]/hook",
        "http://service.internal/hook",
        "ftp://example.com/hook",
        "not-a-url",
    ],
)
async def test_private_and_malformed_targets_are_refused(url):
    with pytest.raises(UnsafeURLError):
        await ensure_public_http_url(url)


async def test_public_literal_is_allowed():
    # An IP literal avoids DNS, so this stays a unit test.
    assert await ensure_public_http_url("https://1.1.1.1/hook") == "https://1.1.1.1/hook"
