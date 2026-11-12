"""
HTTP-layer security controls, applied to every request:

  * request ID (X-Request-ID) for log correlation
  * request body size limit (413), enforced on the stream, not just the header
  * Content-Type allowlist for request bodies (415)
  * sliding-window rate limiting per API key or client IP (429 + Retry-After)
  * security response headers, no server/version disclosure
  * one error shape for every status: {"error": {"code", "message", "request_id"}}

Written as plain ASGI middleware so limits apply before FastAPI parses a body.
The rate limiter is in-process; behind several replicas, put a shared limiter
(e.g. at the CDN/load balancer or in Redis) in front as well.
"""

from __future__ import annotations

import hashlib
import json
import logging
import time
import uuid
from collections import deque

from starlette.requests import Request

from config import settings
from security_log import security_event

logger = logging.getLogger("zkgate.security")

_BODY_METHODS = {b"POST", b"PUT", b"PATCH"}

_SECURITY_HEADERS = [
    (b"x-content-type-options", b"nosniff"),
    (b"x-frame-options", b"DENY"),
    (b"referrer-policy", b"no-referrer"),
    (b"permissions-policy", b"camera=(), microphone=(), geolocation=(), payment=()"),
    (b"cross-origin-resource-policy", b"cross-origin"),
    (b"cache-control", b"no-store"),
]
# The JSON API never serves HTML or scripts. The interactive docs (dev only) do.
_API_CSP = (b"content-security-policy", b"default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
_HSTS = (b"strict-transport-security", b"max-age=63072000; includeSubDomains; preload")
_DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")


def error_payload(status: int, message: str, request_id: str | None) -> dict:
    return {"error": {"code": status, "message": message, "request_id": request_id}}


def error_body(status: int, message: str, request_id: str | None) -> bytes:
    return json.dumps(error_payload(status, message, request_id)).encode()


async def send_error(send, status: int, message: str, request_id: str | None, extra_headers=()):
    body = error_body(status, message, request_id)
    headers = [
        (b"content-type", b"application/json"),
        (b"content-length", str(len(body)).encode()),
        *extra_headers,
    ]
    if request_id:
        headers.append((b"x-request-id", request_id.encode()))
    await send({"type": "http.response.start", "status": status, "headers": headers})
    await send({"type": "http.response.body", "body": body})


class SlidingWindowLimiter:
    """Exact sliding-window counter: a deque of hit timestamps per key."""

    def __init__(self, limit: int, window: float, max_keys: int = 50_000) -> None:
        self.limit = limit
        self.window = window
        self.max_keys = max_keys
        self._hits: dict[str, deque[float]] = {}

    def hit(self, key: str, now: float | None = None) -> float | None:
        """Record a hit. Returns None if allowed, else seconds until retry."""
        now = time.monotonic() if now is None else now
        q = self._hits.get(key)
        if q is None:
            if len(self._hits) >= self.max_keys:
                self._evict(now)
            q = self._hits[key] = deque()
        cutoff = now - self.window
        while q and q[0] <= cutoff:
            q.popleft()
        if len(q) >= self.limit:
            return max(0.0, q[0] + self.window - now)
        q.append(now)
        return None

    def _live(self, key: str, now: float) -> deque[float] | None:
        q = self._hits.get(key)
        if q is not None:
            cutoff = now - self.window
            while q and q[0] <= cutoff:
                q.popleft()
        return q

    def count(self, key: str, now: float | None = None) -> int:
        """Hits for key inside the current window (does not record a hit)."""
        q = self._live(key, time.monotonic() if now is None else now)
        return len(q) if q else 0

    def blocked(self, key: str, now: float | None = None) -> float | None:
        """Seconds until key may try again if it's at the limit, else None.
        Does not record a hit."""
        now = time.monotonic() if now is None else now
        q = self._live(key, now)
        if q and len(q) >= self.limit:
            return max(0.0, q[0] + self.window - now)
        return None

    def _evict(self, now: float) -> None:
        cutoff = now - self.window
        for k in [k for k, q in self._hits.items() if not q or q[-1] <= cutoff]:
            del self._hits[k]
        if len(self._hits) >= self.max_keys:  # still full: drop the oldest half
            for k in list(self._hits)[: self.max_keys // 2]:
                del self._hits[k]

    def reset(self) -> None:
        self._hits.clear()


limiter = SlidingWindowLimiter(settings.rate_limit_requests, settings.rate_limit_window_seconds)


def _header(scope, name: bytes) -> bytes | None:
    for k, v in scope.get("headers", []):
        if k == name:
            return v
    return None


def _client_key(scope) -> str:
    api_key = _header(scope, b"x-api-key")
    if api_key:
        # Never keep raw keys in memory longer than needed; bucket by a digest.
        return "key:" + hashlib.sha256(api_key).hexdigest()[:24]
    # The direct peer only: X-Forwarded-For is client-controlled unless a
    # trusted proxy rewrites it (configure uvicorn --forwarded-allow-ips for that).
    client = scope.get("client")
    return "ip:" + (client[0] if client else "unknown")


class SecurityMiddleware:
    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        request_id = uuid.uuid4().hex
        scope.setdefault("state", {})["request_id"] = request_id
        method = scope["method"].encode()
        path = scope.get("path", "")

        # ── rate limit (health checks exempt so orchestrators can probe) ──
        if path != "/health":
            retry = limiter.hit(_client_key(scope))
            if retry is not None:
                security_event(
                    "rate_limit", "blocked", request=Request(scope), level=logging.WARNING,
                    method=scope["method"],
                )
                return await send_error(
                    send, 429, "rate limit exceeded", request_id,
                    [(b"retry-after", str(int(retry) + 1).encode())],
                )

        # ── body checks ───────────────────────────────────────────────────
        if method in _BODY_METHODS:
            ctype = (_header(scope, b"content-type") or b"").split(b";")[0].strip().lower()
            if ctype != b"application/json":
                return await send_error(send, 415, "content-type must be application/json", request_id)
            length = _header(scope, b"content-length")
            if length is not None:
                try:
                    if int(length) > settings.max_body_bytes:
                        return await send_error(send, 413, "request body too large", request_id)
                except ValueError:
                    return await send_error(send, 400, "invalid content-length", request_id)

        received = 0
        too_large = False

        async def limited_receive():
            nonlocal received, too_large
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > settings.max_body_bytes:
                    too_large = True
                    # Hand the app an empty, finished body; we answer 413 below.
                    return {"type": "http.request", "body": b"", "more_body": False}
            return message

        forwarded = False  # has a response start already gone to the client?

        async def secured_send(message):
            nonlocal forwarded
            if message["type"] == "http.response.start":
                if too_large:
                    return
                forwarded = True
                headers = [
                    (k, v) for k, v in message.get("headers", [])
                    if k.lower() not in (b"server", b"x-powered-by")
                ]
                headers.extend(_SECURITY_HEADERS)
                if not path.startswith(_DOCS_PATHS):
                    headers.append(_API_CSP)
                if settings.is_production:
                    headers.append(_HSTS)
                headers.append((b"x-request-id", request_id.encode()))
                message = {**message, "headers": headers}
            elif message["type"] == "http.response.body" and not forwarded:
                return
            await send(message)

        await self.app(scope, limited_receive, secured_send)
        if too_large and not forwarded:
            await send_error(send, 413, "request body too large", request_id)
