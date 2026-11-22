"""
Rate Limiter (SlowAPI) setup.

Kept in its own module to avoid a circular import between:
  app.main → app.api.v1.router → app.api.v1.endpoints.auth → app.main (limiter)

Both main.py and endpoint modules import from this single source of truth.
"""

import ipaddress
import logging
from typing import List, Union

from slowapi import Limiter
from fastapi import Request

from app.core.config import settings

logger = logging.getLogger(__name__)

IPNetwork = Union[ipaddress.IPv4Network, ipaddress.IPv6Network]

# Peers trusted by default. Deliberately an explicit list rather than
# ``address.is_private``: Python also calls reserved and documentation ranges
# (192.0.2.0/24, 203.0.113.0/24, 240.0.0.0/4, …) private, so that shortcut would
# trust addresses a public client can genuinely appear to come from.
DEFAULT_TRUSTED_NETWORKS: List[IPNetwork] = [
    ipaddress.ip_network("127.0.0.0/8"),      # loopback (an nginx sidecar, a test client)
    ipaddress.ip_network("10.0.0.0/8"),       # RFC1918
    ipaddress.ip_network("172.16.0.0/12"),    # RFC1918
    ipaddress.ip_network("192.168.0.0/16"),   # RFC1918
    ipaddress.ip_network("::1/128"),          # IPv6 loopback
    ipaddress.ip_network("fc00::/7"),         # IPv6 unique local
]

# Parsing TRUSTED_PROXY_IPS on every request would be wasteful, but caching it
# once at import time makes the setting untestable (and unreloadable). Cache the
# raw string instead and re-parse whenever it changes.
_cached_raw: str | None = None
_cached_networks: List[IPNetwork] = []


def _parse_trusted_networks(raw: str) -> List[IPNetwork]:
    """Parse a comma-separated list of IPs/CIDRs, ignoring malformed entries."""
    networks: List[IPNetwork] = []
    for chunk in (raw or "").split(","):
        entry = chunk.strip()
        if not entry:
            continue
        try:
            networks.append(ipaddress.ip_network(entry, strict=False))
        except ValueError:
            logger.warning("Ignoring invalid TRUSTED_PROXY_IPS entry: %r", entry)
    return networks


def trusted_networks() -> List[IPNetwork]:
    """Currently configured trusted proxy networks (empty = private peers only)."""
    global _cached_raw, _cached_networks
    raw = settings.TRUSTED_PROXY_IPS or ""
    if raw != _cached_raw:
        _cached_raw = raw
        _cached_networks = _parse_trusted_networks(raw)
    return _cached_networks


def _normalise(host: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address | None:
    """Parse a peer address, unwrapping IPv4-mapped IPv6 (``::ffff:10.0.0.1``)."""
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return None
    if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped is not None:
        return address.ipv4_mapped
    return address


def is_trusted_proxy(host: str) -> bool:
    """Whether a direct peer is allowed to speak for someone else via XFF.

    With ``TRUSTED_PROXY_IPS`` unset only loopback and RFC1918/ULA peers qualify
    — which is what a platform load balancer (Render, Fly, an nginx sidecar)
    looks like from inside the container, while a connection arriving straight
    from the public internet never does. Unparseable hosts (Starlette's
    TestClient reports ``testclient``) are never trusted.
    """
    address = _normalise(host)
    if address is None:
        return False

    networks = trusted_networks() or DEFAULT_TRUSTED_NETWORKS
    return any(address in network for network in networks)


# Vercel's edge overwrites these headers, so a request that really travelled
# through the Vercel rewrite carries the client address in them. A caller that
# reaches this origin directly can forge them just as easily, which is why they
# are believed only when the deployment opts in (``TRUST_VERCEL_PROXY``) and the
# direct peer is a trusted proxy.
VERCEL_IP_HEADERS = ("X-Vercel-Forwarded-For", "X-Real-IP")


def _vercel_client_ip(request: Request) -> str:
    """Address Vercel's edge recorded, or "" when it recorded no usable one."""
    for header in VERCEL_IP_HEADERS:
        raw = request.headers.get(header) or ""
        for part in raw.split(","):
            candidate = part.strip()
            if candidate and _normalise(candidate) is not None:
                return candidate
    return ""


def _forwarded_chain(request: Request) -> List[str]:
    """Addresses claimed by the request, right-to-left as proxies appended them."""
    raw = request.headers.get("X-Forwarded-For")
    if raw is None:
        # Some proxies set only X-Real-IP; treat it as a one-hop chain.
        raw = request.headers.get("X-Real-IP") or ""
    return [part.strip() for part in raw.split(",") if part.strip()]


def get_real_client_ip(request: Request) -> str:
    """Client address used as the rate-limit key, resistant to header spoofing.

    ``X-Forwarded-For`` is only believed when the *direct peer* is a trusted
    proxy, and the chain is then walked from the right: entries that are
    themselves trusted proxies are skipped and the first untrusted address wins.
    Reading the leftmost entry (the previous behaviour) let any caller prepend
    its own address and therefore get an unlimited number of fresh buckets.

    Behind Vercel the chain ends at a Vercel edge address, not the client, so an
    opted-in deployment (``TRUST_VERCEL_PROXY``) reads the address Vercel itself
    recorded instead; without the opt-in those headers are treated as
    client-supplied like any other and ignored.
    """
    peer = request.client.host if request.client else ""
    if peer and is_trusted_proxy(peer):
        if settings.TRUST_VERCEL_PROXY:
            vercel_ip = _vercel_client_ip(request)
            if vercel_ip:
                return vercel_ip
        for candidate in reversed(_forwarded_chain(request)):
            if not is_trusted_proxy(candidate):
                return candidate
        # Entire chain is proxies: the leftmost entry is the closest we get.
        chain = _forwarded_chain(request)
        if chain:
            return chain[0]

    return peer or "127.0.0.1"


def _build_limiter() -> Limiter:
    """Build a SlowAPI Limiter using the configured storage backend.

    Falls back to in-memory storage if Redis is configured but not available,
    so the app can still start during a transient redis outage.
    """
    uri = settings.SLOWAPI_STORAGE_URI
    try:
        if uri and uri != "memory://":
            return Limiter(key_func=get_real_client_ip, storage_uri=uri)
    except Exception as exc:  # pragma: no cover - defensive fallback
        logger.warning(
            "Failed to init rate-limit storage '%s' (%s). Falling back to the "
            "in-memory backend.",
            uri,
            exc,
        )
    return Limiter(key_func=get_real_client_ip)


limiter = _build_limiter()
limiter.key_function = get_real_client_ip  # type: ignore[attr-defined]

__all__ = ["limiter", "get_real_client_ip", "is_trusted_proxy", "trusted_networks", "Limiter"]
