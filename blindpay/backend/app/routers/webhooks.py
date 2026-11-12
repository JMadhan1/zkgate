"""
Provider webhooks and billing.

Every webhook verifies the provider's HMAC signature over the RAW body before
parsing anything, rejects bad signatures with the standard 404, and drops
re-deliveries it has already processed (providers retry). In development,
with no secret configured, signatures are skipped and that is logged loudly;
production refuses to start without the secrets.
"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import audit, payouts
from app.config import settings
from app.conversation import handle_inbound
from app.crypto import constant_time_equal, hmac_sha256_hex
from app.db import get_db
from app.deps import Caller, not_found, owner_only, record_failure
from app.models import Company, InboundMessage, Payout
from app.providers import ProviderError, providers
from app.schemas import SubscribeIn
from app.security_log import security_event

router = APIRouter()
log = logging.getLogger("blindpay.webhooks")


def _verify(request: Request, raw: bytes, secret: str, header: str, prefix: str = "") -> None:
    if not secret:
        if settings.is_production:
            raise not_found()
        log.warning("webhook signature NOT verified (no secret configured, development only): %s", request.url.path)
        return
    sent = request.headers.get(header, "")
    expected = prefix + hmac_sha256_hex(secret, raw)
    if not sent or not constant_time_equal(sent, expected):
        record_failure(request, "webhook.signature", path=request.url.path)
        raise not_found()


def _first_time(db: Session, key: str) -> bool:
    """Record a delivery id; False if we've seen it before."""
    try:
        with db.begin_nested():
            db.add(InboundMessage(message_id=key[:128]))
            db.flush()
        return True
    except IntegrityError:
        return False


def _json(raw: bytes) -> dict:
    try:
        data = json.loads(raw)
    except ValueError:
        raise HTTPException(422, "invalid JSON") from None
    if not isinstance(data, dict):
        raise HTTPException(422, "invalid payload")
    return data


# ── WhatsApp Cloud API ───────────────────────────────────────────────────

@router.get("/webhooks/whatsapp")
def whatsapp_verify(mode: str = Query(alias="hub.mode", max_length=16),
                    token: str = Query(alias="hub.verify_token", max_length=128),
                    challenge: str = Query(alias="hub.challenge", pattern=r"^[0-9A-Za-z_-]{1,64}$")):
    """Meta's subscription handshake (its protocol puts these in the query string)."""
    if mode == "subscribe" and settings.whatsapp_verify_token and constant_time_equal(token, settings.whatsapp_verify_token):
        return PlainTextResponse(challenge)
    raise not_found()


@router.post("/webhooks/whatsapp")
async def whatsapp_inbound(request: Request, db: Session = Depends(get_db)):
    raw = await request.body()
    _verify(request, raw, settings.whatsapp_app_secret, "X-Hub-Signature-256", prefix="sha256=")
    data = _json(raw)
    for entry in data.get("entry", []) if isinstance(data.get("entry"), list) else []:
        for change in entry.get("changes", []) if isinstance(entry, dict) else []:
            value = change.get("value", {}) if isinstance(change, dict) else {}
            for msg in value.get("messages", []) if isinstance(value.get("messages"), list) else []:
                if not isinstance(msg, dict):
                    continue
                mid, phone, kind = str(msg.get("id", "")), str(msg.get("from", "")), str(msg.get("type", ""))
                if not mid or not phone.isdigit() or len(phone) > 15 or not _first_time(db, "wa:" + mid):
                    continue
                text = msg.get("text", {}).get("body") if kind == "text" and isinstance(msg.get("text"), dict) else None
                if kind == "button" and isinstance(msg.get("button"), dict):
                    kind, text = "text", msg["button"].get("text")
                media = msg.get("image", {}).get("id") if kind == "image" and isinstance(msg.get("image"), dict) else None
                if kind not in ("text", "image"):
                    continue
                handle_inbound(db, phone, kind, str(text)[:1000] if text else None, str(media)[:128] if media else None)
                db.commit()
    db.commit()
    return {"status": "ok"}


# ── RazorpayX payouts ────────────────────────────────────────────────────

@router.post("/webhooks/razorpayx")
async def razorpayx_event(request: Request, db: Session = Depends(get_db)):
    raw = await request.body()
    _verify(request, raw, settings.razorpayx_webhook_secret, "X-Razorpay-Signature")
    event_id = request.headers.get("X-Razorpay-Event-Id", "")
    if event_id and not _first_time(db, "rzpx:" + event_id):
        db.commit()
        return {"status": "duplicate"}
    data = _json(raw)
    event = str(data.get("event", ""))
    entity = (((data.get("payload") or {}).get("payout") or {}).get("entity") or {})
    pid = str(entity.get("id", ""))
    payout = db.execute(select(Payout).where(Payout.provider_payout_id == pid)).scalar_one_or_none() if pid else None
    if payout is None:
        db.commit()
        return {"status": "ignored"}
    if event == "payout.processed":
        payouts.mark_processed(db, payout, str(entity.get("utr") or "")[:64] or None)
    elif event in ("payout.failed", "payout.reversed", "payout.rejected"):
        payouts.mark_failed(db, payout, event.split(".")[1])
    elif event in ("payout.queued", "payout.pending", "payout.processing", "payout.initiated"):
        payout.status = "processing"
    db.commit()
    return {"status": "ok"}


# ── Razorpay subscriptions (billing) ────────────────────────────────────

def _plan_for(plan_id: str) -> str | None:
    if settings.razorpay_plan_team and plan_id == settings.razorpay_plan_team:
        return "team"
    if settings.razorpay_plan_business and plan_id == settings.razorpay_plan_business:
        return "business"
    if not settings.is_production and plan_id in ("plan_dev_team", "plan_dev_business"):
        return plan_id.removeprefix("plan_dev_")
    return None


@router.post("/billing/subscribe")
def subscribe(body: SubscribeIn, caller: Caller = Depends(owner_only), db: Session = Depends(get_db)):
    plan_id = settings.razorpay_plan_team if body.plan == "team" else settings.razorpay_plan_business
    if not plan_id:
        if settings.is_production:
            raise HTTPException(503, "billing is not configured")
        plan_id = f"plan_dev_{body.plan}"
    try:
        sub_id, url = providers.billing.create_subscription(plan_id, caller.company.id)
    except ProviderError:
        raise HTTPException(502, "couldn't start the subscription; try again") from None
    company = db.get(Company, caller.company.id)
    company.razorpay_subscription_id = sub_id
    audit.record(db, company.id, f"member:{caller.member.id}", "billing.subscribe_started", f"company:{company.id}", {"plan": body.plan})
    db.commit()
    return {"checkout_url": url}


@router.post("/webhooks/razorpay")
async def razorpay_event(request: Request, db: Session = Depends(get_db)):
    raw = await request.body()
    _verify(request, raw, settings.razorpay_webhook_secret, "X-Razorpay-Signature")
    event_id = request.headers.get("X-Razorpay-Event-Id", "")
    if event_id and not _first_time(db, "rzp:" + event_id):
        db.commit()
        return {"status": "duplicate"}
    data = _json(raw)
    event = str(data.get("event", ""))
    sub = (((data.get("payload") or {}).get("subscription") or {}).get("entity") or {})
    sid = str(sub.get("id", ""))
    company = db.execute(select(Company).where(Company.razorpay_subscription_id == sid)).scalar_one_or_none() if sid else None
    if company is None:
        db.commit()
        return {"status": "ignored"}
    if event in ("subscription.activated", "subscription.charged", "subscription.resumed"):
        plan = _plan_for(str(sub.get("plan_id", "")))
        if plan:
            company.plan, company.plan_status = plan, "active"
    elif event in ("subscription.halted", "subscription.pending"):
        company.plan_status = "halted"
    elif event in ("subscription.cancelled", "subscription.completed"):
        company.plan, company.plan_status = "free", "active"
    else:
        db.commit()
        return {"status": "ignored"}
    audit.record(db, company.id, "razorpay", f"billing.{event}", f"company:{company.id}", {"plan": company.plan})
    security_event("billing.webhook", event, request=request, actor="razorpay", resource=f"company:{company.id}")
    db.commit()
    return {"status": "ok"}
