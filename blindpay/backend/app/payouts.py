"""
Paying an approved request through RazorpayX.

The payout's idempotency key is derived from the request id, so a retry (a
double tap, a crashed worker, a re-delivered webhook) can never pay twice:
RazorpayX returns the original payout for a repeated key, and our own
payouts.request_id is unique.
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import audit, notify
from app.models import Member, Payout, SpendRequest, utcnow
from app.money import inr
from app.providers import ProviderError, providers

log = logging.getLogger("blindpay.payouts")


def ensure_fund_account(db: Session, member: Member) -> bool:
    if member.payout_fund_account_id:
        return True
    if not member.upi_vpa:
        return False
    try:
        cid, fid = providers.payouts.create_vpa_fund_account(member.id, member.name, member.phone, member.upi_vpa)
    except ProviderError as exc:
        log.warning("fund account creation failed: %s", exc)
        return False
    member.payout_contact_id, member.payout_fund_account_id = cid, fid
    return True


def start_payout(db: Session, req: SpendRequest) -> Payout | None:
    """Pay an approved request. Returns None if the member has no UPI ID yet."""
    if req.status not in ("approved", "payout_failed"):
        return None
    member = db.get(Member, req.member_id)
    if member is None or not ensure_fund_account(db, member):
        if member is not None and not member.upi_vpa:
            notify.text(db, req.company_id, member.phone,
                        f"Your request for {inr(req.amount_paise)} is approved. Reply with your UPI ID "
                        "(for example: UPI name@okbank) so we can pay you.")
        return None
    payout = db.execute(select(Payout).where(Payout.request_id == req.id)).scalar_one_or_none()
    if payout is None:
        payout = Payout(company_id=req.company_id, request_id=req.id, idempotency_key=f"bp-{req.id}",
                        amount_paise=req.amount_paise)
        db.add(payout)
        db.flush()
    try:
        pid, status = providers.payouts.create_payout(
            member.payout_fund_account_id, req.amount_paise, payout.idempotency_key,
            reference_id=req.id, narration="BlindPay reimbursement",
        )
    except ProviderError as exc:
        log.warning("payout failed for request %s: %s", req.id, exc)
        payout.status = "failed"
        payout.updated_at = utcnow()
        req.status = "payout_failed"
        audit.record(db, req.company_id, "system", "payout.failed", f"request:{req.id}")
        return payout
    payout.provider_payout_id, payout.status, payout.updated_at = pid, status, utcnow()
    audit.record(db, req.company_id, "system", "payout.created", f"request:{req.id}", {"payout": payout.id})
    return payout


def pay_waiting_requests(db: Session, member: Member) -> int:
    """After a member adds a UPI ID, pay everything already approved for them."""
    waiting = db.execute(select(SpendRequest).where(
        SpendRequest.company_id == member.company_id, SpendRequest.member_id == member.id,
        SpendRequest.status == "approved",
    )).scalars().all()
    for req in waiting:
        start_payout(db, req)
    return len(waiting)


def mark_processed(db: Session, payout: Payout, utr: str | None) -> None:
    if payout.status == "processed":
        return
    payout.status, payout.utr, payout.updated_at = "processed", utr, utcnow()
    req = db.get(SpendRequest, payout.request_id)
    if req is None:
        return
    req.status = "paid"
    audit.record(db, req.company_id, "razorpayx", "payout.processed", f"request:{req.id}")
    member = db.get(Member, req.member_id)
    if member:
        notify.template(db, req.company_id, member.phone, "blindpay_payout_done",
                        [inr(req.amount_paise), req.description[:60], utr or "pending"])


def mark_failed(db: Session, payout: Payout, status: str) -> None:
    payout.status, payout.updated_at = status, utcnow()
    req = db.get(SpendRequest, payout.request_id)
    if req is not None and req.status != "paid":
        req.status = "payout_failed"
        audit.record(db, req.company_id, "razorpayx", f"payout.{status}", f"request:{req.id}")
