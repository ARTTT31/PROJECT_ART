"""A hanging market provider must not hold the whole dashboard card.

The gold source is unreachable from some networks and used to sit on its 10s
httpx timeout, so /market/summary answered only after the slowest provider gave
up. ``_cached`` now abandons a source at its own timeout.
"""

import asyncio
import time

from app.api.v1.endpoints import market


async def _never_answers():
    await asyncio.sleep(10)
    return {"value": 1}


def test_slow_source_is_abandoned_at_the_timeout():
    market.reset_cache()

    async def run():
        started = time.monotonic()
        payload, stale = await market._cached(
            "gold:slow-test", 0, _never_answers, timeout=0.05
        )
        return payload, stale, time.monotonic() - started

    payload, stale, elapsed = asyncio.run(run())

    assert payload is None
    assert stale is False
    assert elapsed < 1


def test_expired_source_serves_its_cached_value_when_the_refetch_hangs():
    market.reset_cache()

    async def good():
        return {"value": 42}

    async def run():
        first, first_stale = await market._cached("gold:cache-test", 60, good, timeout=0.5)
        payload, stale = await market._cached(
            "gold:cache-test", -1, _never_answers, timeout=0.05
        )
        return first, first_stale, payload, stale

    first, first_stale, payload, stale = asyncio.run(run())

    assert first == {"value": 42}
    assert first_stale is False
    assert payload == {"value": 42}
    assert stale is True
