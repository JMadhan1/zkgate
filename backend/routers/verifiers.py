"""Verifier directory and audit access."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from pydantic import BaseModel, ConfigDict, Field

import dependencies
from dependencies import require_admin, require_authenticated_verifier
from security_log import security_event

router = APIRouter()


class RegisterVerifier(BaseModel):
    # Explicit fields only (no mass assignment); unknown fields are rejected.
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    verifier_id: str = Field(..., pattern=r"^[0-9]{1,18}$", description="Numeric id bound into circuits")
    name: str = Field(..., min_length=1, max_length=100, pattern=r"^[^\x00-\x1f<>]+$")


@router.get("/verifiers")
async def list_verifiers():
    """Public directory of registered verifiers (no secrets)."""
    return {"verifiers": dependencies.verifiers.list_public()}


@router.post("/verifiers", dependencies=[Depends(require_admin)])
async def register_verifier(body: RegisterVerifier, request: Request):
    """
    Register a verifier and mint an API key. Admin only (X-Admin-Token).

    The key is shown ONCE in the response and only its hash is retained — we
    cannot show it again, which is the point. Without ADMIN_TOKEN configured
    this endpoint is open only in local development and disabled in production.
    """
    if dependencies.verifiers.get(body.verifier_id) is not None:
        security_event("admin.verifier.create", "conflict", request=request, actor="admin",
                       resource=f"verifier:{body.verifier_id}")
        raise HTTPException(409, "verifier_id already exists")
    v, api_key = dependencies.verifiers.register(verifier_id=body.verifier_id, name=body.name)
    security_event("admin.verifier.create", "success", request=request, actor="admin",
                   resource=f"verifier:{v.verifier_id}")
    return {
        "verifier_id": v.verifier_id,
        "name": v.name,
        "api_key": api_key,
        "note": "Store this key now — it is not recoverable.",
    }


@router.get("/audit")
async def audit_tail(
    limit: int = Query(50, ge=1, le=100),
    caller=Depends(require_authenticated_verifier),
):
    """
    The calling verifier's own recent audit events, plus a live integrity
    check of the whole hash chain.

    Requires a valid X-API-Key and is scoped to that verifier: one verifier
    can never read another's records.
    """
    intact, broken_at = dependencies.audit.verify_chain()
    events = dependencies.audit.events_for(caller.verifier_id, limit)
    return {
        "chain_intact": intact,
        "broken_at": broken_at,
        "count": len(events),
        "events": events,
    }


VerifierIdPath = Path(..., pattern=r"^[0-9]{1,18}$")


@router.post("/verifiers/{verifier_id}/rotate-key", dependencies=[Depends(require_admin)])
async def rotate_verifier_key(request: Request, verifier_id: str = VerifierIdPath):
    """Admin only. Issue a new API key (shown once); the old key stops working
    immediately. Keys also expire on their own after API_KEY_MAX_AGE_DAYS."""
    new_key = dependencies.verifiers.rotate_key(verifier_id)
    if new_key is None:
        security_event("admin.verifier.rotate_key", "not_found", request=request, actor="admin",
                       resource=f"verifier:{verifier_id}")
        raise HTTPException(404, "Not Found")
    security_event("admin.verifier.rotate_key", "success", request=request, actor="admin",
                   resource=f"verifier:{verifier_id}")
    return {"verifier_id": verifier_id, "api_key": new_key,
            "note": "Store this key now — it is not recoverable. The previous key is revoked."}


@router.post("/verifiers/{verifier_id}/revoke", dependencies=[Depends(require_admin)])
async def revoke_verifier(request: Request, verifier_id: str = VerifierIdPath):
    """Admin only. Deactivate a verifier; its key stops working immediately."""
    if not dependencies.verifiers.revoke(verifier_id):
        security_event("admin.verifier.revoke", "not_found", request=request, actor="admin",
                       resource=f"verifier:{verifier_id}")
        raise HTTPException(404, "Not Found")
    security_event("admin.verifier.revoke", "success", request=request, actor="admin",
                   resource=f"verifier:{verifier_id}")
    return {"verifier_id": verifier_id, "active": False}
