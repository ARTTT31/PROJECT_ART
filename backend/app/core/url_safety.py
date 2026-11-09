# -*- coding: utf-8 -*-
"""Guard user-supplied outbound URLs against SSRF.

Webhook / LINE targets are chosen by the account holder, so without a check a
request can be aimed at the deployment's own network: ``http://localhost:8000``,
``http://169.254.169.254`` (cloud metadata), or any private-range address. The
hostname is resolved here and every answer must be a public unicast address.

This is a mitigation, not a sandbox: DNS can still change between this check and
the actual connection (rebinding). Callers therefore also disable redirects, so
a public URL cannot bounce the request into the internal network.
"""

import asyncio
import ipaddress
import socket
from urllib.parse import urlsplit

# Suffixes that never make sense as a public webhook target.
_BLOCKED_HOST_SUFFIXES = (".localhost", ".local", ".internal", ".home.arpa")


class UnsafeURLError(ValueError):
    """The URL is not a public http(s) endpoint."""


def _is_public_address(value: str) -> bool:
    try:
        address = ipaddress.ip_address(value.split("%", 1)[0])
    except ValueError:
        return False
    # ``::ffff:127.0.0.1`` is an IPv6 literal wrapping a private IPv4 address;
    # check the embedded address, not the wrapper.
    if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped:
        address = address.ipv4_mapped
    return not (
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_multicast
        or address.is_reserved
        or address.is_unspecified
    )


async def ensure_public_http_url(url: str) -> str:
    """Return ``url`` unchanged, or raise ``UnsafeURLError``.

    Only ``http``/``https`` is accepted; IP literals are checked directly and
    hostnames are resolved (IPv4 + IPv6) before the request is made. Every
    resolved address must be public, so a hostname with a private A record is
    rejected just like a literal private IP.
    """
    candidate = (url or "").strip()
    parts = urlsplit(candidate)
    if parts.scheme not in ("http", "https"):
        raise UnsafeURLError("URL ต้องขึ้นต้นด้วย http:// หรือ https://")

    host = (parts.hostname or "").strip().lower()
    if not host:
        raise UnsafeURLError("URL ไม่มี hostname")

    if host == "localhost" or host.endswith(_BLOCKED_HOST_SUFFIXES):
        raise UnsafeURLError("ไม่อนุญาตให้เรียกปลายทางภายในเครื่อง")

    try:
        ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        if not _is_public_address(host):
            raise UnsafeURLError("ไม่อนุญาตให้เรียก IP ภายในหรือ IP ที่สงวนไว้")
        return candidate

    port = parts.port or (443 if parts.scheme == "https" else 80)
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(
            host, port, type=socket.SOCK_STREAM
        )
    except OSError as exc:
        raise UnsafeURLError("ไม่สามารถตรวจสอบปลายทางของ URL ได้") from exc

    addresses = {str(info[4][0]) for info in infos if info[4]}
    if not addresses or any(not _is_public_address(addr) for addr in addresses):
        raise UnsafeURLError("ปลายทางของ URL ชี้ไปยังเครือข่ายภายใน")

    return candidate
