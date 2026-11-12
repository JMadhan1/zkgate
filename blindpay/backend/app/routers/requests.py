"""Spend requests: list, decide (session or single-use link), stats, Tally export, audit."""

from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import audit, lifecycle
from app.crypto import token_hash
from app.db import get_db
from app.deps import Caller, check_lockout, current, mutating, not_found, record_failure
from app.models import ApprovalLink, Member, SpendRequest, utcnow
from app.policy import DECLINE_MESSAGES, IST, month_bounds
from app.routers.company import UUID
from app.schemas import DecisionIn, TokenDecisionIn
from app.tally import build_vouchers_xml

router = APIRouter()
STATUSES = ("pending_approval", "approved", "paid", "declined", "payout_failed")


def _out(r: SpendRequest, member_name: str | None = None) -> dict:
    return {
        "id": r.id, "member_id": r.member_id, "member_name": member_name, "amount_paise": r.amount_paise,
        "category": r.category, "description": r.description, "status": r.status,
        "decline_reason": DECLINE_MESSAGES.get(r.decline_rule) if r.decline_rule else None,
        "has_bill": bool(r.invoice_media_id), "vendor_gstin": r.vendor_gstin, "invoice_number": r.invoice_number,
        "gst_paise": r.gst_paise, "itc_eligible": r.itc_eligible, "has_proof": r.proof is not None,
        "created_at": r.created_at.isoformat(), "decided_at": r.decided_at.isoformat() if r.decided_at else None,
    }


@router.get("/requests")
def list_requests(status: str | None = Query(default=None, pattern="^(" + "|".join(STATUSES) + ")$"),
                  limit: int = Query(default=50, ge=1, le=100), offset: int = Query(default=0, ge=0, le=100_000),
                  caller: Caller = Depends(current), db: Session = Depends(get_db)):
    q = select(SpendRequest, Member.name).join(Member, Member.id == SpendRequest.member_id).where(
        SpendRequest.company_id == caller.company.id)
    if status:
        q = q.where(SpendRequest.status == status)
    rows = db.execute(q.order_by(SpendRequest.created_at.desc()).limit(limit).offset(offset)).all()
    return {"requests": [_out(r, name) for r, name in rows], "limit": limit, "offset": offset}


def _own_request(db: Session, caller: Caller, request_id: str) -> SpendRequest:
    r = db.get(SpendRequest, request_id)
    if r is None or r.company_id != caller.company.id:
        raise not_found()
    return r


@router.post("/requests/{request_id}/decision")
def decide(body: DecisionIn, request_id: str = Path(pattern=UUID),
           caller: Caller = Depends(mutating), db: Session = Depends(get_db)):
    r = _own_request(db, caller, request_id)
    try:
        lifecycle.decide(db, r, caller.member, body.decision == "approve")
    except ValueError:
        raise HTTPException(409, "this request has already been decided") from None
    except PermissionError:
        raise not_found() from None
    db.commit()
    return _out(r)


# ── Single-use approval link (token in the URL fragment, sent in the body) ──

def _by_token(db: Session, request: Request, token: str) -> tuple[SpendRequest, ApprovalLink]:
    check_lockout(request, "auth.approval_link")
    link = db.get(ApprovalLink, token_hash(token))
    now = utcnow()
    exp = None
    if link is not None:
        exp = link.expires_at if link.expires_at.tzinfo else link.expires_at.replace(tzinfo=now.tzinfo)
    r = db.get(SpendRequest, link.request_id) if link else None
    if link is None or link.used or exp < now or r is None or r.status != "pending_approval":
        record_failure(request, "auth.approval_link")
        raise not_found()
    return r, link


@router.post("/approvals/view")
def approval_view(body: TokenDecisionIn, request: Request, db: Session = Depends(get_db)):
    r, link = _by_token(db, request, body.token)
    m = db.get(Member, r.member_id)
    return {"request": _out(r, m.name if m else None), "expires_at": link.expires_at.isoformat()}


@router.post("/approvals/decide")
def approval_decide(body: TokenDecisionIn, request: Request, db: Session = Depends(get_db)):
    if body.decision is None:
        raise HTTPException(422, "decision is required")
    r, link = _by_token(db, request, body.token)
    approver = db.get(Member, link.approver_id)
    try:
        lifecycle.decide(db, r, approver, body.decision == "approve")
    except PermissionError:
        record_failure(request, "auth.approval_link", reason="approver_inactive")
        raise not_found() from None
    audit.record(db, r.company_id, f"member:{approver.id}", "approval_link.used", f"request:{r.id}")
    db.commit()
    return _out(r)


# ── Reporting ──────────────────────────────────────────────────────────

@router.get("/stats")
def stats(caller: Caller = Depends(current), db: Session = Depends(get_db)):
    start, end = month_bounds()
    base = (SpendRequest.company_id == caller.company.id, SpendRequest.created_at >= start, SpendRequest.created_at < end)

    def total(*cond):
        return int(db.execute(select(func.coalesce(func.sum(SpendRequest.amount_paise), 0)).where(*base, *cond)).scalar_one())

    def count(*cond):
        return int(db.execute(select(func.count()).select_from(SpendRequest).where(*base, *cond)).scalar_one())

    return {
        "month": start.astimezone(IST).strftime("%Y-%m"),
        "paid_paise": total(SpendRequest.status == "paid"),
        "approved_unpaid_paise": total(SpendRequest.status.in_(("approved", "payout_failed"))),
        "pending_count": count(SpendRequest.status == "pending_approval"),
        "declined_count": count(SpendRequest.status == "declined"),
        "itc_eligible_gst_paise": int(db.execute(select(func.coalesce(func.sum(SpendRequest.gst_paise), 0)).where(
            *base, SpendRequest.itc_eligible.is_(True), SpendRequest.status.in_(("approved", "paid")))).scalar_one()),
        "itc_missed_count": count(SpendRequest.vendor_gstin.is_not(None), SpendRequest.itc_eligible.is_(False)),
    }


@router.get("/exports/tally")
def tally_export(month: str = Query(pattern=r"^20[0-9]{2}-(0[1-9]|1[0-2])$"),
                 caller: Caller = Depends(current), db: Session = Depends(get_db)):
    from datetime import datetime

    y, m = map(int, month.split("-"))
    start_ist = datetime(y, m, 1, tzinfo=IST)
    end_ist = datetime(y + (m == 12), 1 if m == 12 else m + 1, 1, tzinfo=IST)
    rows = db.execute(select(SpendRequest, Member.name).join(Member, Member.id == SpendRequest.member_id).where(
        SpendRequest.company_id == caller.company.id, SpendRequest.status == "paid",
        SpendRequest.decided_at >= start_ist, SpendRequest.decided_at < end_ist,
    ).order_by(SpendRequest.decided_at)).all()
    vouchers = [{
        "date": (r.decided_at if r.decided_at.tzinfo else r.decided_at.replace(tzinfo=utcnow().tzinfo)).astimezone(IST).strftime("%Y%m%d"),
        "number": "BP-" + r.id[:8].upper(),
        "amount_paise": r.amount_paise, "category": r.category,
        "narration": f"{name}: {r.description}" + (f" (inv {r.invoice_number}, {r.vendor_gstin})" if r.invoice_number else ""),
    } for r, name in rows]
    xml = build_vouchers_xml(caller.company.name, caller.company.tally_payment_ledger, vouchers)
    safe = re.sub(r"[^A-Za-z0-9_-]", "", caller.company.name)[:40] or "company"
    return Response(content=xml, media_type="application/xml", headers={
        "Content-Disposition": f'attachment; filename="blindpay-{safe}-{month}.xml"'})


@router.get("/audit")
def audit_log(limit: int = Query(default=50, ge=1, le=100), caller: Caller = Depends(current), db: Session = Depends(get_db)):
    from app.models import AuditEvent

    intact, broken = audit.verify_chain(db, caller.company.id)
    rows = db.execute(select(AuditEvent).where(AuditEvent.company_id == caller.company.id)
                      .order_by(AuditEvent.seq.desc()).limit(limit)).scalars()
    return {"chain_intact": intact, "broken_at": broken, "events": [
        {"seq": e.seq, "ts": e.ts, "actor": e.actor, "action": e.action, "resource": e.resource, "data": e.data}
        for e in rows]}
