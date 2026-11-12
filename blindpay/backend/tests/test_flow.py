"""End-to-end flows through the real API and WhatsApp webhook, with fake providers."""

from __future__ import annotations

import xml.etree.ElementTree as ET

from app.money import inr, parse_amount
from tests.conftest import APPROVER, COMPANY_GSTIN, EMP, OWNER, VENDOR_GSTIN
from tests.helpers import agree, inbound, link_token, login, make_company


def setup_team(client, wa, policy=None):
    make_company(client)
    agree(client, OWNER)
    csrf = login(client, wa)
    h = {"X-CSRF-Token": csrf}
    emp = client.post("/v1/members", json={"name": "Ravi Kumar", "phone": EMP}, headers=h).json()
    agree(client, EMP)
    if policy:
        r = client.put(f"/v1/members/{emp['id']}/policy", json=policy, headers=h)
        assert r.status_code == 200, r.text
    return h, emp


def submit_with_bill(client, phone, text="1850 cab to client site", invoice="INV-881", gst="282", billed="YES"):
    inbound(client, phone, text)
    inbound(client, phone, image="media-1")
    inbound(client, phone, f"{VENDOR_GSTIN} {invoice} {gst}")
    inbound(client, phone, billed)


# ── happy path ──────────────────────────────────────────────────────────

def test_request_to_payout_end_to_end(client, wa, rzpx):
    h, emp = setup_team(client, wa, {"monthly_limit_paise": 1_000_000})

    inbound(client, EMP, "₹1,850 cab to client site")
    prompt = wa.last_to(EMP)["body"]
    assert "₹1,850" in prompt and COMPANY_GSTIN in prompt  # vendor is told whom to bill
    inbound(client, EMP, image="media-1")
    inbound(client, EMP, f"{VENDOR_GSTIN} INV-881 282")
    inbound(client, EMP, "YES")
    assert "Sent for approval" in wa.last_to(EMP)["body"]
    assert "GST credit: eligible" in wa.last_to(EMP)["body"]

    # The owner gets a single-use link; the token rides in the URL fragment.
    token = link_token(wa, OWNER, "blindpay_approval_needed")
    view = client.post("/v1/approvals/view", json={"token": token}).json()["request"]
    assert view["amount_paise"] == 185_000 and view["itc_eligible"] is True
    r = client.post("/v1/approvals/decide", json={"token": token, "decision": "approve"})
    assert r.json()["status"] == "approved"

    # No UPI ID yet → asked for one; adding it pays everything waiting.
    assert any("Reply with your UPI ID" in (m.get("body") or "") for m in wa.sent if m["to"] == EMP)
    inbound(client, EMP, "UPI ravi@okaxis")
    assert len(rzpx.payouts) == 1 and rzpx.payouts[0]["amount"] == 185_000

    # RazorpayX confirms → paid, employee notified with the UTR.
    pid = rzpx.payouts[0]["id"]
    ev = {"event": "payout.processed", "payload": {"payout": {"entity": {"id": pid, "status": "processed", "utr": "UTR123"}}}}
    assert client.post("/v1/webhooks/razorpayx", json=ev, headers={"X-Razorpay-Event-Id": "evt1"}).status_code == 200
    reqs = client.get("/v1/requests").json()["requests"]
    assert reqs[0]["status"] == "paid"
    done = wa.last_to(EMP)
    assert done["name"] == "blindpay_payout_done" and "UTR123" in done["params"]

    stats = client.get("/v1/stats").json()
    assert stats["paid_paise"] == 185_000 and stats["itc_eligible_gst_paise"] == 28_200

    # Replayed webhook is ignored; the link is dead after one use.
    assert client.post("/v1/webhooks/razorpayx", json=ev, headers={"X-Razorpay-Event-Id": "evt1"}).json()["status"] == "duplicate"
    assert client.post("/v1/approvals/view", json={"token": token}).status_code == 404


def test_payout_retry_is_idempotent(client, wa, rzpx):
    from app.db import SessionLocal
    from app.models import SpendRequest
    from app.payouts import start_payout

    h, emp = setup_team(client, wa, {"monthly_limit_paise": 1_000_000})
    inbound(client, EMP, "UPI ravi@okaxis")
    inbound(client, EMP, "500 tea for team")
    inbound(client, EMP, "NOBILL")
    rid = client.get("/v1/requests").json()["requests"][0]["id"]
    client.post(f"/v1/requests/{rid}/decision", json={"decision": "approve"}, headers=h)
    with SessionLocal() as db:
        req = db.get(SpendRequest, rid)
        req.status = "payout_failed"  # simulate a crash after RazorpayX accepted it
        start_payout(db, req)
        db.commit()
    assert len(rzpx.payouts) == 1  # same idempotency key → same payout, never twice


# ── policy ──────────────────────────────────────────────────────────────

def test_policy_decline_never_reveals_the_number(client, wa):
    setup_team(client, wa, {"monthly_limit_paise": 200_000})
    inbound(client, EMP, "2500 hotel")
    inbound(client, EMP, "NOBILL")
    msg = wa.last_to(EMP)["body"]
    assert msg.startswith("Not approved") and "month's policy" in msg
    assert "2,000" not in msg and "2000" not in msg


def test_limits_are_banded_and_only_the_owner_reads_them(client, wa):
    h, emp = setup_team(client, wa, {"monthly_limit_paise": 1_525_000})
    pol = client.get(f"/v1/members/{emp['id']}/policy").json()["policy"]
    assert pol["monthly_limit_paise"] == 1_500_000  # rounded down to a ₹500 band


def test_policy_stored_only_as_ciphertext(client, wa):
    from sqlalchemy import text

    from app.db import engine

    setup_team(client, wa, {"monthly_limit_paise": 777_500})
    with engine.connect() as c:
        blob = c.execute(text("select ciphertext from policies")).scalar_one()
    assert b"777500" not in blob and b"monthly_limit" not in blob


def test_probing_alerts_the_owner(client, wa):
    setup_team(client, wa, {"monthly_limit_paise": 100_000})
    for amt in ("5000", "3000", "2000"):
        inbound(client, EMP, f"{amt} misc")
        inbound(client, EMP, "NOBILL")
    alert = [m for m in wa.sent if m["to"] == OWNER and m.get("name") == "blindpay_probe_alert"]
    assert len(alert) == 1 and alert[0]["params"] == ["Ravi Kumar", "3"]


def test_auto_approve_under_threshold(client, wa, rzpx):
    setup_team(client, wa, {"monthly_limit_paise": 1_000_000, "auto_approve_under_paise": 30_000})
    inbound(client, EMP, "UPI ravi@okaxis")
    inbound(client, EMP, "250 courier")
    inbound(client, EMP, "NOBILL")
    assert "Approved" in wa.last_to(EMP)["body"]
    assert len(rzpx.payouts) == 1
    assert not any(m.get("name") == "blindpay_approval_needed" for m in wa.sent)


def test_category_rules(client, wa):
    setup_team(client, wa, {"monthly_limit_paise": 1_000_000, "categories": {"travel": 300_000}})
    inbound(client, EMP, "900 lunch with team")
    inbound(client, EMP, "NOBILL")
    assert "category isn't covered" in wa.last_to(EMP)["body"]
    inbound(client, EMP, "3500 cab")
    inbound(client, EMP, "NOBILL")
    assert "for this category" in wa.last_to(EMP)["body"]


# ── invoices and GST ────────────────────────────────────────────────────

def test_same_invoice_cannot_be_claimed_twice(client, wa):
    h, emp = setup_team(client, wa, {"monthly_limit_paise": 1_000_000})
    client.post("/v1/members", json={"name": "Meena", "phone": APPROVER}, headers=h)
    agree(client, APPROVER)
    submit_with_bill(client, EMP, invoice="INV-42")
    submit_with_bill(client, APPROVER, invoice="inv 42")  # different person, reformatted number
    assert "already been claimed" in wa.last_to(APPROVER)["body"]


def test_bill_not_in_company_name_loses_itc(client, wa):
    setup_team(client, wa, {"monthly_limit_paise": 1_000_000})
    submit_with_bill(client, EMP, billed="NO")
    assert "GST credit: not eligible" in wa.last_to(EMP)["body"]


def test_bad_gst_line_is_rejected(client, wa):
    setup_team(client, wa)
    inbound(client, EMP, "1850 cab")
    inbound(client, EMP, image="m")
    inbound(client, EMP, "29AAPFU0939F1ZX INV 282")  # checksum fails
    assert "didn't look right" in wa.last_to(EMP)["body"]


# ── consent, unknown numbers, quotas ────────────────────────────────────

def test_no_processing_before_consent(client, wa):
    make_company(client)
    agree(client, OWNER)
    csrf = login(client, wa)
    client.post("/v1/members", json={"name": "Ravi", "phone": EMP}, headers={"X-CSRF-Token": csrf})
    inbound(client, EMP, "1850 cab")
    assert "Reply AGREE" in wa.last_to(EMP)["body"]
    assert client.get("/v1/requests").json()["requests"] == []


def test_unknown_number_gets_no_reply(client, wa):
    make_company(client)
    before = len(wa.sent)
    inbound(client, "919811111111", "1850 cab")
    assert len(wa.sent) == before


def test_free_plan_seat_and_request_limits(client, wa):
    from app.config import settings

    make_company(client, plan="free")
    agree(client, OWNER)
    h = {"X-CSRF-Token": login(client, wa)}
    for i in range(2):
        assert client.post("/v1/members", json={"name": f"E{i}", "phone": f"91980000010{i}"}, headers=h).status_code == 201
    assert client.post("/v1/members", json={"name": "E3", "phone": "919800000109"}, headers=h).status_code == 402
    agree(client, "919800000100")
    for _ in range(settings.free_requests_per_month):
        inbound(client, "919800000100", "100 tea")
        inbound(client, "919800000100", "NOBILL")
    inbound(client, "919800000100", "100 tea")
    inbound(client, "919800000100", "NOBILL")
    assert "request limit" in wa.last_to("919800000100")["body"]


# ── approvals ───────────────────────────────────────────────────────────

def test_each_approver_gets_their_own_link_and_it_names_them(client, wa):
    h, emp = setup_team(client, wa)
    appr = client.post("/v1/members", json={"name": "Meena", "phone": APPROVER, "role": "approver"}, headers=h).json()
    inbound(client, EMP, "700 printer paper")
    inbound(client, EMP, "NOBILL")
    t_owner = link_token(wa, OWNER, "blindpay_approval_needed")
    t_appr = link_token(wa, APPROVER, "blindpay_approval_needed")
    assert t_owner != t_appr
    client.post("/v1/approvals/decide", json={"token": t_appr, "decision": "decline"})
    assert client.post("/v1/approvals/view", json={"token": t_owner}).status_code == 404  # all links die
    events = client.get("/v1/audit").json()["events"]
    assert any(e["action"] == "request.declined" and e["actor"] == f"member:{appr['id']}" for e in events)
    assert "your approver declined it" in wa.last_to(EMP)["params"][2]


def test_owner_cannot_approve_own_request(client, wa):
    make_company(client)
    agree(client, OWNER)
    h = {"X-CSRF-Token": login(client, wa)}
    inbound(client, OWNER, "900 client lunch")
    inbound(client, OWNER, "NOBILL")
    rid = client.get("/v1/requests").json()["requests"][0]["id"]
    assert client.post(f"/v1/requests/{rid}/decision", json={"decision": "approve"}, headers=h).status_code == 404


def test_expired_approval_link(client, wa):
    from datetime import timedelta

    from app.db import SessionLocal
    from app.models import ApprovalLink, utcnow

    setup_team(client, wa)
    inbound(client, EMP, "700 paper")
    inbound(client, EMP, "NOBILL")
    token = link_token(wa, OWNER, "blindpay_approval_needed")
    with SessionLocal() as db:
        for link in db.query(ApprovalLink):
            link.expires_at = utcnow() - timedelta(minutes=1)
        db.commit()
    assert client.post("/v1/approvals/decide", json={"token": token, "decision": "approve"}).status_code == 404


# ── exports and audit ───────────────────────────────────────────────────

def test_tally_export_is_valid_escaped_xml(client, wa, rzpx):
    h, emp = setup_team(client, wa, {"monthly_limit_paise": 1_000_000})
    inbound(client, EMP, "UPI ravi@okaxis")
    inbound(client, EMP, "1200 <script>alert(1)</script> & courier")
    inbound(client, EMP, "NOBILL")
    rid = client.get("/v1/requests").json()["requests"][0]["id"]
    client.post(f"/v1/requests/{rid}/decision", json={"decision": "approve"}, headers=h)
    ev = {"event": "payout.processed", "payload": {"payout": {"entity": {"id": rzpx.payouts[0]["id"], "utr": "U1"}}}}
    client.post("/v1/webhooks/razorpayx", json=ev)
    from app.policy import IST
    from datetime import datetime

    month = datetime.now(IST).strftime("%Y-%m")
    r = client.get("/v1/exports/tally", params={"month": month})
    assert r.headers["content-disposition"].startswith("attachment;")
    assert b"<script>" not in r.content
    root = ET.fromstring(r.content)
    v = root.find(".//VOUCHER")
    assert v.get("VCHTYPE") == "Payment"
    amounts = [e.text for e in v.iter("AMOUNT")]
    assert amounts == ["-1200.00", "1200.00"]
    assert "<script>" in v.find("NARRATION").text  # stored as text, escaped on output


def test_audit_chain_detects_tampering(client, wa):
    from app.audit import verify_chain
    from app.db import SessionLocal
    from app.models import AuditEvent

    setup_team(client, wa, {"monthly_limit_paise": 500_000})
    assert client.get("/v1/audit").json()["chain_intact"] is True
    with SessionLocal() as db:
        ev = db.query(AuditEvent).order_by(AuditEvent.seq).first()
        cid = ev.company_id
        ev.action = "company.deleted"
        db.commit()
        assert verify_chain(db, cid) == (False, 1)


def test_audit_never_contains_limits(client, wa):
    from sqlalchemy import text

    from app.db import engine

    setup_team(client, wa, {"monthly_limit_paise": 913_500})
    with engine.connect() as c:
        rows = c.execute(text("select data from audit_events")).scalars().all()
    assert not any("913500" in str(r) or "913000" in str(r) for r in rows)


# ── billing ─────────────────────────────────────────────────────────────

def test_subscription_upgrades_plan(client, wa):
    make_company(client, plan="free")
    agree(client, OWNER)
    h = {"X-CSRF-Token": login(client, wa)}
    url = client.post("/v1/billing/subscribe", json={"plan": "team"}, headers=h).json()["checkout_url"]
    sid = url.rsplit("/", 1)[1]
    ev = {"event": "subscription.activated", "payload": {"subscription": {"entity": {"id": sid, "plan_id": "plan_dev_team"}}}}
    assert client.post("/v1/webhooks/razorpay", json=ev, headers={"X-Razorpay-Event-Id": "e1"}).json()["status"] == "ok"
    assert client.get("/v1/session").json()["company"]["plan"] == "team"


# ── units ───────────────────────────────────────────────────────────────

def test_amount_parsing():
    assert parse_amount("₹1,850 cab") == 185_000
    assert parse_amount("Rs. 1,23,456.5 hotel") == 12_345_650
    assert parse_amount("paid 99.99 for tea") == 9_999
    assert parse_amount("no amount here") is None
    assert parse_amount("0 rupees") is None
    assert parse_amount("99999999 yacht") is None  # above the ₹10 lakh request cap
    assert inr(12_345_650) == "₹1,23,456.50"
    assert inr(185_000) == "₹1,850"
