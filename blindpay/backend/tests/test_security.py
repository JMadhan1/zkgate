"""Security rules: auth, CSRF, tenant isolation, signatures, headers, input validation."""

from __future__ import annotations

import json

from app.crypto import hmac_sha256_hex
from tests.conftest import EMP, OWNER
from tests.helpers import agree, inbound, login, make_company

OWNER_B = "919700000001"
EMP_B = "919700000002"


def test_login_link_reveals_nothing(client, wa):
    make_company(client)
    known = client.post("/v1/auth/login-link", json={"phone": OWNER})
    unknown = client.post("/v1/auth/login-link", json={"phone": "919811112222"})
    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()


def test_login_link_is_single_use_and_cookie_is_strict(client, wa):
    import re

    make_company(client)
    client.post("/v1/auth/login-link", json={"phone": OWNER})
    url = next(m for m in wa.sent if m.get("name") == "blindpay_login_link")["params"][0]
    assert "#bp_" in url  # token in the fragment, never in a query string
    token = re.search(r"#(bp_\S+)$", url).group(1)
    r = client.post("/v1/auth/session", json={"token": token})
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "secure" in cookie and "samesite=strict" in cookie
    assert client.post("/v1/auth/session", json={"token": token}).status_code == 404


def test_login_link_rate_limited_per_phone(client, wa):
    make_company(client)
    for _ in range(7):
        client.post("/v1/auth/login-link", json={"phone": OWNER})
    assert len([m for m in wa.sent if m.get("name") == "blindpay_login_link"]) == 5


def test_employees_cannot_sign_in(client, wa):
    make_company(client)
    agree(client, OWNER)
    h = {"X-CSRF-Token": login(client, wa)}
    client.post("/v1/members", json={"name": "Ravi", "phone": EMP}, headers=h)
    client.post("/v1/auth/login-link", json={"phone": EMP})
    assert not any(m["to"] == EMP and m.get("name") == "blindpay_login_link" for m in wa.sent)


def test_unauthenticated_and_missing_routes_look_identical(client):
    a = client.get("/v1/requests")
    b = client.get("/v1/does-not-exist")
    assert a.status_code == b.status_code == 404
    assert a.json()["error"]["message"] == b.json()["error"]["message"]


def test_mutations_need_csrf(client, wa):
    make_company(client)
    agree(client, OWNER)
    login(client, wa)
    assert client.post("/v1/members", json={"name": "Ravi", "phone": EMP}).status_code == 404
    assert client.post("/v1/members", json={"name": "Ravi", "phone": EMP}, headers={"X-CSRF-Token": "bp_wrong"}).status_code == 404


def test_tenant_isolation(client, wa):
    # Company A with a pending request
    make_company(client)
    agree(client, OWNER)
    h_a = {"X-CSRF-Token": login(client, wa)}
    emp_a = client.post("/v1/members", json={"name": "Ravi", "phone": EMP}, headers=h_a).json()
    agree(client, EMP)
    inbound(client, EMP, "700 paper")
    inbound(client, EMP, "NOBILL")
    rid = client.get("/v1/requests").json()["requests"][0]["id"]
    client.cookies.clear()

    # Company B's owner sees nothing of A and can't touch it
    make_company(client, owner=OWNER_B, name="Beta Pvt Ltd", gstin=None)
    agree(client, OWNER_B)
    h_b = {"X-CSRF-Token": login(client, wa, OWNER_B)}
    assert client.get("/v1/requests").json()["requests"] == []
    assert [m["name"] for m in client.get("/v1/members").json()["members"]] == ["Asha Owner"]
    assert client.post(f"/v1/requests/{rid}/decision", json={"decision": "approve"}, headers=h_b).status_code == 404
    assert client.get(f"/v1/members/{emp_a['id']}/policy").status_code == 404
    assert client.put(f"/v1/members/{emp_a['id']}/policy", json={"monthly_limit_paise": 100000}, headers=h_b).status_code == 404
    assert client.patch(f"/v1/members/{emp_a['id']}", json={"active": False}, headers=h_b).status_code == 404


def test_approver_cannot_read_limits(client, wa):
    make_company(client)
    agree(client, OWNER)
    h = {"X-CSRF-Token": login(client, wa)}
    emp = client.post("/v1/members", json={"name": "Ravi", "phone": EMP}, headers=h).json()
    client.put(f"/v1/members/{emp['id']}/policy", json={"monthly_limit_paise": 500000}, headers=h)
    client.post("/v1/members", json={"name": "Meena", "phone": "919800000003", "role": "approver"}, headers=h)
    client.cookies.clear()
    agree(client, "919800000003")
    login(client, wa, "919800000003")
    assert client.get(f"/v1/members/{emp['id']}/policy").status_code == 404


def test_unknown_fields_and_bad_input_rejected(client, wa):
    make_company(client)
    agree(client, OWNER)
    h = {"X-CSRF-Token": login(client, wa)}
    assert client.post("/v1/members", json={"name": "Ravi", "phone": EMP, "role": "owner"}, headers=h).status_code == 422
    assert client.post("/v1/members", json={"name": "Ravi", "phone": EMP, "is_admin": True}, headers=h).status_code == 422
    assert client.post("/v1/members", json={"name": "<b>x</b>", "phone": EMP}, headers=h).status_code == 422
    assert client.post("/v1/members", json={"name": "Ravi", "phone": "12345"}, headers=h).status_code == 422
    emp = client.post("/v1/members", json={"name": "Ravi", "phone": EMP}, headers=h).json()
    assert client.put(f"/v1/members/{emp['id']}/policy", json={"monthly_limit_paise": "lots"}, headers=h).status_code == 422
    assert client.put(f"/v1/members/{emp['id']}/policy", json={"monthly_limit_paise": 10_000}, headers=h).status_code == 422  # below one band
    assert client.get("/v1/requests", params={"limit": 1000}).status_code == 422


def test_whatsapp_signature_enforced_when_configured(client, wa, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "whatsapp_app_secret", "wa-test-secret")
    body = json.dumps({"entry": []}).encode()
    bad = client.post("/v1/webhooks/whatsapp", content=body, headers={"Content-Type": "application/json",
                                                                       "X-Hub-Signature-256": "sha256=00"})
    assert bad.status_code == 404
    good = client.post("/v1/webhooks/whatsapp", content=body, headers={
        "Content-Type": "application/json", "X-Hub-Signature-256": "sha256=" + hmac_sha256_hex("wa-test-secret", body)})
    assert good.status_code == 200


def test_razorpayx_signature_enforced_when_configured(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "razorpayx_webhook_secret", "rzp-secret")
    body = json.dumps({"event": "payout.processed"}).encode()
    assert client.post("/v1/webhooks/razorpayx", content=body, headers={"Content-Type": "application/json"}).status_code == 404
    sig = hmac_sha256_hex("rzp-secret", body)
    assert client.post("/v1/webhooks/razorpayx", content=body, headers={
        "Content-Type": "application/json", "X-Razorpay-Signature": sig}).status_code == 200


def test_whatsapp_verify_handshake(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "whatsapp_verify_token", "verify-me")
    ok = client.get("/v1/webhooks/whatsapp", params={"hub.mode": "subscribe", "hub.verify_token": "verify-me", "hub.challenge": "12345"})
    assert ok.status_code == 200 and ok.text == "12345"
    assert client.get("/v1/webhooks/whatsapp", params={"hub.mode": "subscribe", "hub.verify_token": "nope", "hub.challenge": "1"}).status_code == 404


def test_duplicate_whatsapp_delivery_processed_once(client, wa):
    make_company(client)
    payload = {"entry": [{"changes": [{"value": {"messages": [{"from": OWNER, "id": "wamid.dup", "type": "text", "text": {"body": "AGREE"}}]}}]}]}
    client.post("/v1/webhooks/whatsapp", json=payload)
    n = len(wa.sent)
    client.post("/v1/webhooks/whatsapp", json=payload)
    assert len(wa.sent) == n


def test_security_headers_and_no_server_banner(client):
    r = client.get("/health")
    assert r.headers["x-frame-options"] == "DENY"
    assert r.headers["x-content-type-options"] == "nosniff"
    assert "server" not in r.headers


def test_admin_requires_token_when_configured(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "admin_token", "a" * 40)
    body = {"name": "X", "owner_name": "Y", "owner_phone": "919700000009"}
    assert client.post("/v1/admin/companies", json=body).status_code == 404
    assert client.post("/v1/admin/companies", json=body, headers={"X-Admin-Token": "a" * 40}).status_code == 201


def test_production_refuses_to_start_without_secrets():
    import pytest

    from app.config import Settings

    with pytest.raises(RuntimeError, match="missing production settings"):
        Settings(environment="production").require_production_secrets()


def test_auth_lockout(client):
    for _ in range(5):
        client.post("/v1/auth/session", json={"token": "bp_" + "x" * 40})
    assert client.post("/v1/auth/session", json={"token": "bp_" + "y" * 40}).status_code == 429


def test_dev_outbox_absent_in_production(client):
    import importlib

    from fastapi.testclient import TestClient

    import app.config as config
    import app.main as main

    assert client.get("/v1/dev/outbox", params={"to": "919800000001"}).status_code == 200  # dev: present
    original = config.settings.environment
    try:
        config.settings.environment = "production"
        prod = TestClient(importlib.reload(main).app, base_url="https://testserver")  # no lifespan: no secrets needed
        assert prod.get("/v1/dev/outbox", params={"to": "919800000001"}).status_code == 404
    finally:
        config.settings.environment = original
        importlib.reload(main)
