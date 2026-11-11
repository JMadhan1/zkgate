"""
Shared singletons and FastAPI dependencies.

The registries live for the process lifetime and are created once here, so every
router and every request sees the same nullifier store, audit chain and verifier
table. Tests import these too and reset them between cases.

Authentication model
--------------------
* Verifiers authenticate with an X-API-Key header (no cookies, no sessions).
* Every auth failure (missing, wrong, expired, or revoked key, bad admin token)
  answers exactly like a route that doesn't exist: 404 in the standard error
  shape. So probing can't tell "valid route, no access" from "no such route".
* Failed attempts are throttled per client IP: after `auth_failure_limit`
  failures inside `auth_failure_window_seconds` the IP is locked out (429 +
  Retry-After) for the rest of the window, with a growing delay before that.
* Every attempt, success or failure, is written to the security event log.
"""

from __future__ import annotations

import asyncio
import hmac

from fastapi import Header, HTTPException, Request

from config import settings
from security import SlidingWindowLimiter
from security_log import client_ip, key_fingerprint, security_event
from services.audit_logger import AuditLogger
from services.nullifier_registry import NullifierRegistry
from services.verifier_registry import Verifier, VerifierRegistry

nullifiers = NullifierRegistry(settings.redis_url or None)
audit = AuditLogger()
verifiers = VerifierRegistry(
    seed_demo=settings.seed_demo, max_key_age_days=settings.api_key_max_age_days
)

# Failed authentication attempts, per client IP.
auth_failures = SlidingWindowLimiter(
    settings.auth_failure_limit, settings.auth_failure_window_seconds
)


def _not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="Not Found")


async def _check_lockout(request: Request, action: str) -> None:
    retry = auth_failures.blocked(client_ip(request))
    if retry is not None:
        security_event(action, "locked_out", request=request, level=30)
        raise HTTPException(
            status_code=429,
            detail="too many failed attempts; try again later",
            headers={"Retry-After": str(int(retry) + 1)},
        )


async def _record_failure(request: Request, action: str, **fields) -> None:
    ip = client_ip(request)
    auth_failures.hit(ip)
    failures = auth_failures.count(ip)
    security_event(action, "failure", request=request, level=30, failures=failures, **fields)
    # Progressive delay: 0.1s, 0.2s, 0.4s, … capped at 2s. Slows online guessing
    # without tying up a worker thread (this is an async sleep).
    await asyncio.sleep(min(2.0, 0.1 * (2 ** max(0, failures - 1))))


async def _authenticate(request: Request, x_api_key: str | None) -> Verifier | None:
    """Resolve an API key. Raises 404 on a bad key; returns None if none sent."""
    if not x_api_key:
        return None
    await _check_lockout(request, "auth.api_key")
    v = verifiers.authenticate(x_api_key)
    if v is None:
        await _record_failure(request, "auth.api_key", key_fp=key_fingerprint(x_api_key))
        raise _not_found()
    security_event("auth.api_key", "success", request=request, actor=v.verifier_id)
    return v


async def require_verifier(
    request: Request,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> Verifier | None:
    """
    Resolve the calling verifier from its API key.

    When API keys are not required (local development by default) an
    unauthenticated call is allowed through as anonymous, so the portals work
    with no setup. In production a missing key is treated like a bad one.
    """
    v = await _authenticate(request, x_api_key)
    if v is not None:
        return v
    if settings.api_key_required:
        await _record_failure(request, "auth.api_key", reason="missing")
        raise _not_found()
    return None  # anonymous, demo mode


async def require_authenticated_verifier(
    request: Request,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> Verifier:
    """Like require_verifier, but never anonymous: for endpoints that return a
    verifier's own records."""
    v = await _authenticate(request, x_api_key)
    if v is None:
        await _record_failure(request, "auth.api_key", reason="missing")
        raise _not_found()
    return v


async def require_admin(
    request: Request,
    x_admin_token: str | None = Header(default=None, alias="X-Admin-Token"),
) -> None:
    """
    Gate for admin-only endpoints: a separate credential from verifier keys.

    With ADMIN_TOKEN configured, the header must match it (constant-time
    compare). Without one, admin endpoints exist only in local development;
    in production they are disabled.
    """
    await _check_lockout(request, "auth.admin")
    if settings.admin_token:
        if x_admin_token and hmac.compare_digest(
            x_admin_token.encode(), settings.admin_token.encode()
        ):
            security_event("auth.admin", "success", request=request, actor="admin")
            return
        await _record_failure(request, "auth.admin")
        raise _not_found()
    if settings.is_production:
        await _record_failure(request, "auth.admin", reason="admin disabled")
        raise _not_found()
    security_event("auth.admin", "success", request=request, actor="admin", mode="dev-open")
