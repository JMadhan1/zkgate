"""
The employee's WhatsApp conversation.

    member: "₹1,850 cab to client site"
    bot:    asks for the bill photo, showing the company's GSTIN for the vendor
    member: <photo>             (or NOBILL)
    bot:    asks for the GST line: VENDOR-GSTIN INVOICE-NO GST-AMOUNT  (or SKIP)
    member: "29ABCDE1234F1ZW INV-881 282"
    bot:    "Does the bill show <company> GSTIN …? YES / NO"
    member: YES  → submitted → declined by policy | auto-approved | sent to approvers

Other commands: AGREE / STOP (consent), UPI <id>, STATUS, CANCEL, HELP.
Messages from numbers that aren't members get no reply, so the bot never
confirms whether a number is registered.
"""

from __future__ import annotations

import re
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import audit, notify, payouts
from app.lifecycle import DuplicateInvoice, QuotaExceeded, Submission, submit
from app.models import Company, Draft, Member, SpendRequest, utcnow
from app.money import describe, guess_category, inr, normalise_text, parse_amount
from app.policy import DECLINE_MESSAGES
from app.gst import normalise_gstin

VPA = re.compile(r"^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$")
DRAFT_TTL = timedelta(hours=24)

HELP = (
    "BlindPay: send what you spent and why, for example \"1850 cab to client site\". "
    "I'll ask for the bill, then send it for approval and pay you by UPI.\n"
    "Commands: STATUS, CANCEL, UPI <your UPI ID>, HELP."
)


def _company(db: Session, member: Member) -> Company:
    return db.get(Company, member.company_id)


def _gstin_card(company: Company) -> str:
    if not company.gstin:
        return ""
    return (f"\n\nAsk the vendor to bill it to:\n{company.name}\nGSTIN {company.gstin}\n"
            "That lets the company claim the GST back.")


def _set_draft(db: Session, member: Member, state: dict) -> None:
    d = db.get(Draft, member.id)
    if d is None:
        db.add(Draft(member_id=member.id, company_id=member.company_id, state=state))
    else:
        d.state, d.updated_at = state, utcnow()


def _get_draft(db: Session, member: Member) -> dict | None:
    d = db.get(Draft, member.id)
    if d is None or not d.state:
        return None
    updated = d.updated_at if d.updated_at.tzinfo else d.updated_at.replace(tzinfo=utcnow().tzinfo)
    if utcnow() - updated > DRAFT_TTL:
        d.state = {}
        return None
    return d.state


def _clear_draft(db: Session, member: Member) -> None:
    d = db.get(Draft, member.id)
    if d is not None:
        d.state = {}


def handle_inbound(db: Session, phone: str, kind: str, text: str | None, media_id: str | None) -> None:
    member = db.execute(select(Member).where(Member.phone == phone, Member.active.is_(True))).scalar_one_or_none()
    if member is None:
        return  # unknown number: no reply, so we never confirm who is registered

    body = normalise_text(text or "", 500)
    word = body.upper().split(" ")[0] if body else ""

    # ── consent comes first (DPDP: no processing before consent) ───────────
    if member.consent_at is None:
        if word == "AGREE":
            member.consent_at = utcnow()
            audit.record(db, member.company_id, f"member:{member.id}", "member.consented", f"member:{member.id}")
            notify.text(db, member.company_id, phone, "Thanks, you're set up.\n\n" + HELP)
        elif word == "STOP":
            _opt_out(db, member)
        else:
            notify.text(db, member.company_id, phone,
                        f"{_company(db, member).name} uses BlindPay for expense requests. Reply AGREE to continue, or STOP to opt out.")
        return

    if word == "STOP":
        _opt_out(db, member)
        return
    if word == "HELP":
        notify.text(db, member.company_id, phone, HELP)
        return
    if word == "CANCEL":
        _clear_draft(db, member)
        notify.text(db, member.company_id, phone, "Cancelled. Nothing was submitted.")
        return
    if word == "STATUS":
        _status(db, member)
        return
    if word == "UPI":
        _set_upi(db, member, body[3:].strip())
        return

    draft = _get_draft(db, member)
    if draft:
        _continue_draft(db, member, draft, kind, body, media_id)
        return

    amount = parse_amount(body) if kind == "text" else None
    if amount is None:
        notify.text(db, member.company_id, phone, "I couldn't find an amount in that. " + HELP)
        return
    state = {"step": "bill", "amount": amount, "description": describe(body), "category": guess_category(body)}
    _set_draft(db, member, state)
    notify.text(db, member.company_id, phone,
                f"{inr(amount)} for \"{state['description']}\" ({state['category']}).\n"
                "Send a photo of the bill, or reply NOBILL if there isn't one." + _gstin_card(_company(db, member)))


def _continue_draft(db: Session, member: Member, st: dict, kind: str, body: str, media_id: str | None) -> None:
    phone, company = member.phone, _company(db, member)
    word = body.upper().split(" ")[0] if body else ""

    if st["step"] == "bill":
        if kind == "image" and media_id:
            st.update(step="gst", media=media_id)
            _set_draft(db, member, st)
            notify.text(db, member.company_id, phone,
                        "Got the bill. If it shows GST, reply with: VENDOR-GSTIN INVOICE-NO GST-AMOUNT\n"
                        "for example: 29ABCDE1234F1ZW INV-881 282\nOtherwise reply SKIP.")
            return
        if word == "NOBILL":
            _finish(db, member, st)
            return
        notify.text(db, member.company_id, phone, "Please send a photo of the bill, or reply NOBILL.")
        return

    if st["step"] == "gst":
        if word == "SKIP":
            _finish(db, member, st)
            return
        # First word = vendor GSTIN, last word = GST amount, everything between =
        # the invoice number (which may contain spaces: "INV 42").
        parts = body.split()
        vendor = normalise_gstin(parts[0]) if parts else None
        gst = parse_amount(parts[-1]) if len(parts) >= 3 else None
        invoice = " ".join(parts[1:-1])[:32] if len(parts) >= 3 else ""
        if not vendor or not invoice or gst is None or gst >= st["amount"]:
            notify.text(db, member.company_id, phone,
                        "That didn't look right. Reply: VENDOR-GSTIN INVOICE-NO GST-AMOUNT (for example 29ABCDE1234F1ZW INV-881 282), or SKIP.")
            return
        st.update(step="billed", vendor=vendor, invoice=invoice, gst=gst)
        if not company.gstin:
            st["billed"] = False
            _finish(db, member, st)
            return
        _set_draft(db, member, st)
        notify.text(db, member.company_id, phone, f"Does the bill show {company.name}, GSTIN {company.gstin}? Reply YES or NO.")
        return

    if st["step"] == "billed":
        if word not in ("YES", "NO"):
            notify.text(db, member.company_id, phone, "Reply YES or NO.")
            return
        st["billed"] = word == "YES"
        _finish(db, member, st)
        return

    _clear_draft(db, member)


def _finish(db: Session, member: Member, st: dict) -> None:
    phone = member.phone
    sub = Submission(
        amount_paise=st["amount"], description=st["description"], category=st["category"],
        invoice_media_id=st.get("media"), vendor_gstin=st.get("vendor"), invoice_number=st.get("invoice"),
        invoice_date=st.get("date"), gst_paise=st.get("gst"), billed_to_company=st.get("billed"),
    )
    _clear_draft(db, member)
    try:
        req = submit(db, member, sub)
    except DuplicateInvoice:
        audit.record(db, member.company_id, f"member:{member.id}", "request.duplicate_invoice", f"member:{member.id}")
        notify.text(db, member.company_id, phone, "This bill has already been claimed, so it can't be submitted again.")
        return
    except QuotaExceeded:
        notify.text(db, member.company_id, phone, "Your company has reached its plan's request limit this month. Please tell your admin.")
        return

    gst_note = ""
    if st.get("vendor"):
        gst_note = ("\nGST credit: eligible." if req.itc_eligible
                    else "\nGST credit: not eligible (the bill must be in the company's name and GSTIN).")
    if req.status == "declined":
        notify.text(db, member.company_id, phone,
                    f"Not approved: {DECLINE_MESSAGES.get(req.decline_rule, 'declined by policy')}. You can talk to your manager.")
    elif req.status in ("approved", "paid"):
        notify.text(db, member.company_id, phone, f"Approved: {inr(req.amount_paise)}. Paying you now." + gst_note)
    else:
        notify.text(db, member.company_id, phone, f"Sent for approval: {inr(req.amount_paise)} for \"{req.description}\"." + gst_note)


def _status(db: Session, member: Member) -> None:
    rows = db.execute(select(SpendRequest).where(
        SpendRequest.company_id == member.company_id, SpendRequest.member_id == member.id,
    ).order_by(SpendRequest.created_at.desc()).limit(3)).scalars().all()
    if not rows:
        notify.text(db, member.company_id, member.phone, "You have no requests yet.")
        return
    lines = [f"{inr(r.amount_paise)} {r.description[:30]}: {r.status.replace('_', ' ')}" for r in rows]
    notify.text(db, member.company_id, member.phone, "Your latest requests:\n" + "\n".join(lines))


def _set_upi(db: Session, member: Member, vpa: str) -> None:
    if not VPA.match(vpa):
        notify.text(db, member.company_id, member.phone, "That doesn't look like a UPI ID. Example: UPI name@okbank")
        return
    member.upi_vpa = vpa
    member.payout_fund_account_id = None  # a new UPI ID needs a new fund account
    audit.record(db, member.company_id, f"member:{member.id}", "member.upi_updated", f"member:{member.id}")
    n = payouts.pay_waiting_requests(db, member)
    notify.text(db, member.company_id, member.phone,
                "UPI ID saved." + (f" Paying {n} approved request(s) now." if n else ""))


def _opt_out(db: Session, member: Member) -> None:
    member.consent_at = None
    audit.record(db, member.company_id, f"member:{member.id}", "member.opted_out", f"member:{member.id}")
    notify.text(db, member.company_id, member.phone,
                "You've opted out. BlindPay won't process new requests from you. Reply AGREE to opt back in.")
