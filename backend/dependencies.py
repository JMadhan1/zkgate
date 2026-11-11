"""
Shared singletons and FastAPI dependencies.

The registries live for the process lifetime and are created once here, so every
router and every request sees the same nullifier store, audit chain and verifier
table. Tests import these too and reset them between cases.
"""

from __future__ import annotations

import hmac

from fastapi import Header, HTTPException

from config import settings
from services.audit_logger import AuditLogger
from services.nullifier_registry import NullifierRegistry
from services.verifier_registry import VerifierRegistry

nullifiers = NullifierRegistry(settings.redis_url or None)
audit = AuditLogger()
verifiers = VerifierRegistry(seed_demo=settings.seed_demo)


async def require_verifier(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
):
    """
    Resolve the calling verifier from its API key.

    When API keys are not required (local development by default) an
    unauthenticated call is allowed through as anonymous, so the portals work
    with no setup. In production a missing or bad key is a hard 401.
    """
    if x_api_key:
        v = verifiers.authenticate(x_api_key)
        if v is None:
            raise HTTPException(status_code=401, detail="invalid API key")
        return v

    if settings.api_key_required:
        raise HTTPException(status_code=401, detail="X-API-Key required")

    return None  # anonymous, demo mode


async def require_authenticated_verifier(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
):
    """Like require_verifier, but never anonymous — for endpoints that return
    a verifier's own records."""
    v = verifiers.authenticate(x_api_key) if x_api_key else None
    if v is None:
        raise HTTPException(status_code=401, detail="valid X-API-Key required")
    return v


async def require_admin(
    x_admin_token: str | None = Header(default=None, alias="X-Admin-Token"),
):
    """
    Gate for admin-only endpoints.

    With ADMIN_TOKEN configured, the header must match it (constant-time
    compare). Without one, admin endpoints exist only in local development;
    in production they are disabled. Failures answer 404 so the route's
    existence isn't confirmed to unauthenticated callers.
    """
    if settings.admin_token:
        if x_admin_token and hmac.compare_digest(
            x_admin_token.encode(), settings.admin_token.encode()
        ):
            return
        raise HTTPException(status_code=404, detail="Not Found")
    if settings.is_production:
        raise HTTPException(status_code=404, detail="Not Found")
