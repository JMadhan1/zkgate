"""Liveness and readiness."""

from __future__ import annotations

import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse

import dependencies
from config import settings
from services.proof_verifier import get_layout

logger = logging.getLogger("zkgate")

router = APIRouter()


@router.get("/")
async def root():
    # No version or internal links: don't advertise what's running.
    body = {
        "service": "ZKGate India",
        "privacy": "Zero personal data is stored. Only anonymous nullifiers.",
    }
    if settings.docs_on:
        body["docs"] = "/docs"
    return body


@router.get("/health")
async def health():
    """Readiness probe. Public, so it reports only booleans: no versions,
    backend names, counts or error text (those go to the server log)."""
    redis_ok = await dependencies.nullifiers.health()
    chain_ok, broken = dependencies.audit.verify_chain()

    # If we cannot load the circuit layout/keys we cannot verify anything.
    try:
        circuits_ok = bool(get_layout()._circuits)
    except Exception:  # pragma: no cover
        logger.exception("health: circuit layout failed to load")
        circuits_ok = False
    if not chain_ok:
        logger.error("health: audit chain broken at index %s", broken)

    ready = circuits_ok and chain_ok
    return JSONResponse(
        status_code=200 if ready else 503,
        content={
            "status": "ready" if ready else "degraded",
            "circuits_loaded": circuits_ok,
            "nullifier_store_healthy": redis_ok,
            "audit_chain_intact": chain_ok,
        },
    )
