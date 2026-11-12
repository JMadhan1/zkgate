"""
Outbound WhatsApp messages.

Replies inside a member's 24-hour window go as free text. Messages we start
(approval requests, login links, alerts) must be pre-approved utility
templates; TEMPLATES below is the list to submit to Meta, with their text.
Every send is recorded in outbound_messages.
"""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.models import OutboundMessage
from app.providers import ProviderError, providers

log = logging.getLogger("blindpay.notify")

# name -> body text with {{1}}.. placeholders, as submitted to Meta (category: UTILITY)
TEMPLATES = {
    "blindpay_approval_needed": "{{1}} requested {{2}} for \"{{3}}\". Review and approve or decline: {{4}} (link expires in 15 minutes)",
    "blindpay_login_link": "Your BlindPay sign-in link: {{1}} It expires in 15 minutes and works once. If you didn't ask for it, ignore this message.",
    "blindpay_consent_request": "{{1}} uses BlindPay to handle expense requests and reimbursements. Reply AGREE to let BlindPay process your name, phone number and expense details for this. Reply STOP to opt out.",
    "blindpay_probe_alert": "{{1}} has had {{2}} requests declined by policy this month. Repeated declines can be an attempt to discover a limit. Review in BlindPay.",
    "blindpay_payout_done": "{{1}} has been sent to your UPI ID for \"{{2}}\". UTR: {{3}}",
    "blindpay_decided": "Your request for {{1}} (\"{{2}}\") was {{3}}.",
}


def _record(db: Session, company_id: str | None, to: str, template: str, params: list[str], mid: str | None) -> None:
    db.add(OutboundMessage(company_id=company_id, to_phone=to, template=template, params=params, provider_message_id=mid))


def text(db: Session, company_id: str | None, to: str, body: str) -> None:
    try:
        mid = providers.whatsapp.send_text(to, body)
    except ProviderError as exc:
        log.warning("send_text failed: %s", exc)
        mid = None
    _record(db, company_id, to, "_text", [body[:200]], mid)


def template(db: Session, company_id: str | None, to: str, name: str, params: list[str]) -> None:
    assert name in TEMPLATES, name
    try:
        mid = providers.whatsapp.send_template(to, name, params)
    except ProviderError as exc:
        log.warning("send_template %s failed: %s", name, exc)
        mid = None
    _record(db, company_id, to, name, params, mid)
