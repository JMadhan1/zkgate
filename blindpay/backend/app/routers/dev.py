"""
Development-only outbox: what the fake WhatsApp provider "sent".

Mounted only when ENVIRONMENT isn't production AND the fake provider is in
use (no WhatsApp credentials), so it can't exist in a real deployment.
Admin-gated like other admin routes. Used for local demos and browser E2E.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.deps import require_admin
from app.providers import FakeWhatsApp, providers

router = APIRouter()


@router.get("/dev/outbox", dependencies=[Depends(require_admin)])
def outbox(to: str = Query(pattern=r"^[0-9]{10,15}$"), limit: int = Query(default=20, ge=1, le=100)):
    if not isinstance(providers.whatsapp, FakeWhatsApp):
        return {"messages": []}
    return {"messages": [m for m in providers.whatsapp.sent if m["to"] == to][-limit:]}
