"""Nullifier status and anonymous statistics. No personal data is reachable here."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path

import dependencies
from dependencies import require_authenticated_verifier, require_verifier
from models.proof import ClaimType
from services.nullifier_registry import verifier_tag

router = APIRouter()


@router.get("/nullifiers/{claim_type}/{nullifier}")
async def nullifier_status(
    claim_type: ClaimType,
    nullifier: str = Path(..., pattern=r"^[0-9]{1,78}$"),
    caller=Depends(require_authenticated_verifier),
):
    """
    Has this proof been used *with me*? A verifier can check before honouring a
    proof they received out of band.

    Requires an API key and is scoped to the caller: nullifiers are bound to a
    verifier inside the circuit, so a record spent at another verifier is
    reported as not found, never revealed.
    """
    record = await dependencies.nullifiers.status(claim_type.value, nullifier)
    if record is None:
        return {"nullifier": nullifier, "claim_type": claim_type.value, "used": False}
    if record.get("verifier") != verifier_tag(caller.verifier_id):
        raise HTTPException(404, "Not Found")
    record.pop("verifier", None)
    return {"nullifier": nullifier, "claim_type": claim_type.value, "used": True, "record": record}


@router.get("/stats")
async def stats(caller=Depends(require_verifier)):
    """Aggregate counters (verifications and replay attempts). Nothing
    per-citizen or per-verifier. Requires an API key in production."""
    return await dependencies.nullifiers.stats()
