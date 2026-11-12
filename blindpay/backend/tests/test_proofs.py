"""Proof-of-policy: real Groth16 proofs on approvals, the commitment log, and the CA Audit Pack."""

from __future__ import annotations

import json
from datetime import datetime

import pytest

from app import proofs
from app.policy import IST
from tests.conftest import EMP, OWNER
from tests.helpers import agree, inbound, login, make_company

pytestmark = pytest.mark.skipif(not proofs.available(), reason="circuit not built: run blindpay/circuits/build.sh")

LIMIT = 1_525_000          # owner types ₹15,250
BANDED = 1_500_000         # stored as ₹15,000


def team(client, wa, policy):
    make_company(client)
    agree(client, OWNER)
    h = {"X-CSRF-Token": login(client, wa)}
    emp = client.post("/v1/members", json={"name": "Ravi Kumar", "phone": EMP}, headers=h).json()
    agree(client, EMP)
    client.put(f"/v1/members/{emp['id']}/policy", json=policy, headers=h)
    return h, emp


def request_and_approve(client, h, text):
    inbound(client, EMP, text)
    inbound(client, EMP, "NOBILL")
    rid = client.get("/v1/requests").json()["requests"][0]["id"]
    r = client.post(f"/v1/requests/{rid}/decision", json={"decision": "approve"}, headers=h)
    assert r.json()["status"] == "approved", r.text
    return rid


def month() -> str:
    return datetime.now(IST).strftime("%Y-%m")


def pack(client) -> dict:
    r = client.get("/v1/audit-pack", params={"month": month()})
    assert r.status_code == 200 and r.headers["content-disposition"].startswith("attachment;")
    return r.json()


def ca_verify(p: dict) -> list[str]:
    """What the CA's verifier checks, in Python (the browser verifier does the same)."""
    problems = []
    prev = proofs.GENESIS
    by_seq = {}
    for e in p["policy_log"]:
        h = proofs.log_hash(p["company"]["id"], e["seq"], e["ts"], e["member_tag"], e["period"], e["version"], e["commitment"], prev)
        if e["prev_hash"] != prev or e["hash"] != h:
            problems.append(f"log broken at {e['seq']}")
        prev = e["hash"]
        by_seq[e["seq"]] = e
    spent: dict[str, int] = {}
    for a in p["approvals"]:
        pr = a["proof"]
        if pr is None:
            continue
        sig = pr["public_signals"]
        entry = by_seq.get(pr["commitment_seq"])
        if entry is None or entry["ts"] > a["decided_at"]:
            problems.append(f"{a['request_id']}: commitment not logged before the decision")
        expected = [entry["commitment"], a["member_tag"], str(p["period"]), str(a["amount_paise"]),
                    str(spent.get(a["member_tag"], 0)),
                    proofs.request_hash(a["request_id"], a["member_tag"], p["period"], a["amount_paise"])]
        if sig != expected:
            problems.append(f"{a['request_id']}: public signals don't match the pack")
        if not proofs.verify(pr["proof"], sig):
            problems.append(f"{a['request_id']}: proof invalid")
        spent[a["member_tag"]] = spent.get(a["member_tag"], 0) + a["amount_paise"]
    return problems


def test_every_approval_carries_a_verifiable_proof(client, wa):
    h, emp = team(client, wa, {"monthly_limit_paise": LIMIT})
    request_and_approve(client, h, "1850 cab to client")
    request_and_approve(client, h, "900 lunch")
    p = pack(client)
    assert len(p["approvals"]) == 2 and all(a["proof"] for a in p["approvals"])
    assert p["approvals"][1]["proof"]["public_signals"][4] == "185000"  # spent_before = first approval
    assert ca_verify(p) == []


def test_audit_pack_never_contains_the_limit(client, wa):
    team(client, wa, {"monthly_limit_paise": LIMIT})
    raw = client.get("/v1/audit-pack", params={"month": month()}).text
    assert str(LIMIT) not in raw and str(BANDED) not in raw and "15,000" not in raw and "monthly_limit" not in raw


def test_tampered_amount_fails_verification(client, wa):
    h, _ = team(client, wa, {"monthly_limit_paise": LIMIT})
    request_and_approve(client, h, "1850 cab")
    p = pack(client)
    p["approvals"][0]["amount_paise"] = 1_850  # someone edits the pack after the fact
    assert any("public signals" in x for x in ca_verify(p))
    sig = list(p["approvals"][0]["proof"]["public_signals"])
    sig[3] = "1850"
    assert proofs.verify(p["approvals"][0]["proof"]["proof"], sig) is False


def test_rewritten_policy_log_is_detected(client, wa):
    h, _ = team(client, wa, {"monthly_limit_paise": LIMIT})
    request_and_approve(client, h, "1850 cab")
    p = pack(client)
    p["policy_log"][0]["commitment"] = "1"  # swap in a different committed limit
    assert any("log broken" in x for x in ca_verify(p))


def test_policy_change_mid_month_is_a_new_logged_commitment(client, wa):
    h, emp = team(client, wa, {"monthly_limit_paise": LIMIT})
    request_and_approve(client, h, "1850 cab")
    client.put(f"/v1/members/{emp['id']}/policy", json={"monthly_limit_paise": 3_000_000}, headers=h)
    request_and_approve(client, h, "900 lunch")
    p = pack(client)
    # Each version is logged for this month and next month as soon as it's saved.
    this_month = [e for e in p["policy_log"] if e["period"] == p["period"]]
    assert [e["version"] for e in this_month] == [1, 2]
    assert [a["proof"]["commitment_seq"] for a in p["approvals"]] == [e["seq"] for e in this_month]
    assert ca_verify(p) == []


def test_no_policy_means_no_proof(client, wa):
    make_company(client)
    agree(client, OWNER)
    h = {"X-CSRF-Token": login(client, wa)}
    client.post("/v1/members", json={"name": "Ravi", "phone": EMP}, headers=h)
    agree(client, EMP)
    request_and_approve(client, h, "500 tea")
    p = pack(client)
    assert p["approvals"][0]["proof"] is None and p["policy_log"] == []


def test_auto_approved_requests_are_proved_too(client, wa):
    team(client, wa, {"monthly_limit_paise": LIMIT, "auto_approve_under_paise": 50_000})
    inbound(client, EMP, "250 courier")
    inbound(client, EMP, "NOBILL")
    p = pack(client)
    assert p["approvals"][0]["decided_by"] == "policy" and p["approvals"][0]["proof"]
    assert ca_verify(p) == []


def test_pack_is_valid_json_with_verification_key(client, wa):
    team(client, wa, {"monthly_limit_paise": LIMIT})
    p = pack(client)
    assert p["format"] == "blindpay.audit-pack/1"
    assert p["verification_key"]["protocol"] == "groth16" and p["verification_key"]["nPublic"] == 6
    json.dumps(p)
