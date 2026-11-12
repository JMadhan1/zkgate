"""
Spend request lifecycle: submit → (auto-decline | auto-approve | owner decision) → payout.

All state changes for one request happen here, so the WhatsApp channel and the
web dashboard behave identically.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import audit, notify, payouts
from app.config import PLAN_SEATS, settings
from app.crypto import new_token, token_hash
from app.gst import itc_eligible, normalise_gstin
from app.invoice import invoice_nullifier
from app.models import ApprovalLink, Company, Member, SpendRequest, utcnow
from app.money import inr
from app.policy import DECLINE_MESSAGES, declines_this_month, evaluate, month_bounds


class DuplicateInvoice(Exception):
    pass


class QuotaExceeded(Exception):
    pass


@dataclass
class Submission:
    amount_paise: int
    description: str
    category: str
    invoice_media_id: str | None = None
    vendor_gstin: str | None = None
    invoice_number: str | None = None
    invoice_date: str | None = None
    gst_paise: int | None = None
    billed_to_company: bool | None = None


def approvers(db: Session, company_id: str) -> list[Member]:
    return list(db.execute(select(Member).where(
        Member.company_id == company_id, Member.active.is_(True), Member.role.in_(("owner", "approver")),
    )).scalars())


def _free_quota_used(db: Session, company: Company) -> int:
    start, end = month_bounds()
    return len(db.execute(select(SpendRequest.id).where(
        SpendRequest.company_id == company.id, SpendRequest.created_at >= start, SpendRequest.created_at < end,
    )).all())


def submit(db: Session, member: Member, sub: Submission) -> SpendRequest:
    company = db.get(Company, member.company_id)
    if company.plan == "free" and _free_quota_used(db, company) >= settings.free_requests_per_month:
        raise QuotaExceeded()
    if company.plan_status != "active" and company.plan != "free":
        raise QuotaExceeded()

    req = SpendRequest(
        company_id=member.company_id, member_id=member.id, amount_paise=sub.amount_paise,
        category=sub.category, description=sub.description, invoice_media_id=sub.invoice_media_id,
    )
    vendor = normalise_gstin(sub.vendor_gstin)
    if vendor and sub.invoice_number:
        req.vendor_gstin, req.invoice_number, req.invoice_date = vendor, sub.invoice_number[:32], sub.invoice_date
        req.gst_paise, req.billed_to_company = sub.gst_paise, sub.billed_to_company
        req.itc_eligible = itc_eligible(
            company.gstin, company.gstin if sub.billed_to_company else None, vendor, sub.gst_paise,
        )
        req.invoice_nullifier = invoice_nullifier(
            company.id, vendor, sub.invoice_number, sub.amount_paise,
        )

    if req.invoice_nullifier and db.execute(select(SpendRequest.id).where(
        SpendRequest.company_id == company.id, SpendRequest.invoice_nullifier == req.invoice_nullifier,
    )).first():
        raise DuplicateInvoice()

    decision = evaluate(db, member.company_id, member.id, sub.amount_paise, sub.category)
    try:
        with db.begin_nested():  # savepoint: a race on the unique index undoes only this insert
            db.add(req)
            db.flush()
    except IntegrityError:
        raise DuplicateInvoice() from None

    if not decision.allowed:
        req.status, req.decline_rule, req.decided_at = "declined", decision.rule, utcnow()
        audit.record(db, req.company_id, f"member:{member.id}", "request.auto_declined",
                     f"request:{req.id}", {"rule": decision.rule})
        n = declines_this_month(db, member.company_id, member.id)
        if n == settings.probe_alert_declines:
            for a in approvers(db, member.company_id):
                notify.template(db, member.company_id, a.phone, "blindpay_probe_alert", [member.name, str(n)])
            audit.record(db, req.company_id, "system", "policy.probe_alert", f"member:{member.id}", {"declines": n})
        return req

    if decision.auto_approve:
        req.status, req.decided_at, req.decided_by = "approved", utcnow(), "policy"
        audit.record(db, req.company_id, "policy", "request.auto_approved", f"request:{req.id}")
        payouts.start_payout(db, req)
        return req

    req.status = "pending_approval"
    audit.record(db, req.company_id, f"member:{member.id}", "request.submitted", f"request:{req.id}",
                 {"policy_checked": decision.has_policy})
    send_approval_links(db, req, member)
    return req


def send_approval_links(db: Session, req: SpendRequest, member: Member) -> None:
    """A separate single-use, 15-minute link for each approver, so the decision names its maker."""
    expires = utcnow() + timedelta(minutes=settings.approval_link_minutes)
    for a in approvers(db, req.company_id):
        if a.id == member.id:
            continue  # nobody approves their own request
        token = new_token()
        db.add(ApprovalLink(token_hash=token_hash(token), company_id=req.company_id, request_id=req.id,
                            approver_id=a.id, expires_at=expires))
        # The token travels in the URL fragment: browsers never send fragments to
        # servers, so it stays out of access logs and Referer headers.
        notify.template(db, req.company_id, a.phone, "blindpay_approval_needed",
                        [member.name, inr(req.amount_paise), req.description[:60],
                         f"{settings.public_base_url}/approve#{token}"])


def decide(db: Session, req: SpendRequest, approver: Member, approve: bool) -> SpendRequest:
    if req.status != "pending_approval":
        raise ValueError("request is not awaiting a decision")
    if approver.company_id != req.company_id or approver.role not in ("owner", "approver") or not approver.active:
        raise PermissionError()
    if approver.id == req.member_id:
        raise PermissionError()
    # Re-check policy at decision time: other requests may have been paid since.
    if approve:
        d = evaluate(db, req.company_id, req.member_id, req.amount_paise, req.category, exclude_request=req.id)
        if not d.allowed:
            approve = False
            req.decline_rule = d.rule
    req.status = "approved" if approve else "declined"
    if not approve and not req.decline_rule:
        req.decline_rule = "owner_declined"
    req.decided_by, req.decided_at = approver.id, utcnow()
    for link in db.execute(select(ApprovalLink).where(ApprovalLink.request_id == req.id)).scalars():
        link.used = True  # every outstanding link for this request dies with the decision
    audit.record(db, req.company_id, f"member:{approver.id}", "request.approved" if approve else "request.declined",
                 f"request:{req.id}", {"rule": req.decline_rule} if not approve else {})
    member = db.get(Member, req.member_id)
    if member:
        verdict = "approved" if approve else f"declined: {DECLINE_MESSAGES.get(req.decline_rule, 'declined')}"
        notify.template(db, req.company_id, member.phone, "blindpay_decided",
                        [inr(req.amount_paise), req.description[:60], verdict])
    if approve:
        payouts.start_payout(db, req)
    return req


def seats_available(db: Session, company: Company) -> int:
    used = len(db.execute(select(Member.id).where(Member.company_id == company.id, Member.active.is_(True))).all())
    return PLAN_SEATS.get(company.plan, 3) - used
