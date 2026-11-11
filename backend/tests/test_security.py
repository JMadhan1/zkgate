"""HTTP-layer security controls: headers, error shape, limits, authz."""

from __future__ import annotations

import pytest

from tests.conftest import bundle


@pytest.fixture(autouse=True)
def _reset_limiter():
    from security import limiter

    limiter.reset()
    yield
    limiter.reset()


def test_security_headers_and_no_version_disclosure(client):
    r = client.get("/health")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert "default-src 'none'" in r.headers["content-security-policy"]
    assert r.headers["x-request-id"]
    assert "server" not in r.headers
    assert "x-zkgate-version" not in r.headers


def test_unknown_route_uses_standard_error_shape(client):
    r = client.get("/nope")
    assert r.status_code == 404
    body = r.json()
    assert body["error"]["code"] == 404
    assert body["error"]["request_id"] == r.headers["x-request-id"]


def test_validation_error_does_not_echo_input(client, proofs):
    b = bundle(proofs["age18"], "age_above_18")
    b["verifier_id"] = "<script>alert(1)</script>"
    r = client.post("/v1/verify", json=b)
    assert r.status_code == 422
    assert "<script>" not in r.text
    assert set(r.json()) == {"error"}


def test_unknown_fields_rejected(client, proofs):
    b = bundle(proofs["age18"], "age_above_18")
    b["is_admin"] = True
    assert client.post("/v1/verify", json=b).status_code == 422


def test_non_numeric_public_signals_rejected(client, proofs):
    b = bundle(proofs["age18"], "age_above_18")
    b["proof_bundle"]["public_signals"] = ["1", {"$gt": ""}]
    assert client.post("/v1/verify", json=b).status_code == 422


def test_wrong_content_type_rejected(client):
    r = client.post("/v1/verify", content=b"a=1", headers={"Content-Type": "application/x-www-form-urlencoded"})
    assert r.status_code == 415


def test_oversized_body_rejected(client):
    from config import settings

    big = b'{"x":"' + b"a" * (settings.max_body_bytes + 10) + b'"}'
    r = client.post("/v1/verify", content=big, headers={"Content-Type": "application/json"})
    assert r.status_code == 413


def test_rate_limit_returns_429_with_retry_after(client):
    from config import settings

    for _ in range(settings.rate_limit_requests):
        assert client.get("/v1/stats").status_code == 200
    r = client.get("/v1/stats")
    assert r.status_code == 429
    assert int(r.headers["retry-after"]) >= 1


def test_audit_requires_key_and_is_tenant_scoped(client, proofs):
    client.post("/v1/verify", json=bundle(proofs["age18"], "age_above_18", verifier_id="99999"))
    client.post("/v1/verify", json=bundle(proofs["citizen"], "india_citizen", verifier_id="88888"))

    assert client.get("/v1/audit").status_code == 401
    assert client.get("/v1/audit", headers={"X-API-Key": "wrong"}).status_code == 401

    bank = client.get("/v1/audit", headers={"X-API-Key": "demo-bank-key"}).json()
    assert bank["events"] and all(e["verifier_id"] == "99999" for e in bank["events"])
    shop = client.get("/v1/audit", headers={"X-API-Key": "demo-age-key"}).json()
    assert shop["events"] and all(e["verifier_id"] == "88888" for e in shop["events"])


def test_audit_limit_is_bounded(client):
    h = {"X-API-Key": "demo-bank-key"}
    assert client.get("/v1/audit?limit=1000", headers=h).status_code == 422
    assert client.get("/v1/audit?limit=-5", headers=h).status_code == 422


def test_registration_requires_admin_token_when_configured(client, monkeypatch):
    from config import settings

    monkeypatch.setattr(settings, "admin_token", "s3cret-admin-token-for-tests")
    body = {"verifier_id": "12345", "name": "Test Verifier"}
    assert client.post("/v1/verifiers", json=body).status_code == 404
    assert client.post("/v1/verifiers", json=body, headers={"X-Admin-Token": "nope"}).status_code == 404
    r = client.post("/v1/verifiers", json=body, headers={"X-Admin-Token": "s3cret-admin-token-for-tests"})
    assert r.status_code == 200
    assert r.json()["api_key"].startswith("zkgate_sk_")


def test_registration_disabled_in_production_without_token(client, monkeypatch):
    from config import settings

    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "admin_token", "")
    r = client.post("/v1/verifiers", json={"verifier_id": "12345", "name": "X"})
    assert r.status_code == 404


def test_production_requires_api_key(client, proofs, monkeypatch):
    from config import settings

    monkeypatch.setattr(settings, "environment", "production")
    r = client.post("/v1/verify", json=bundle(proofs["age18"], "age_above_18"))
    assert r.status_code == 401
    r = client.post(
        "/v1/verify",
        json=bundle(proofs["age18"], "age_above_18"),
        headers={"X-API-Key": "demo-bank-key"},
    )
    assert r.status_code == 200


def test_production_defaults_are_restrictive(monkeypatch):
    from config import Settings

    s = Settings(environment="production")
    assert s.api_key_required and not s.docs_on and not s.seed_demo
    d = Settings(environment="development")
    assert not d.api_key_required and d.docs_on and d.seed_demo


def test_cors_allowlist_never_reflects_unknown_origin(client):
    r = client.options(
        "/v1/verify",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert r.headers.get("access-control-allow-origin") != "https://evil.example"
    r = client.options(
        "/v1/verify",
        headers={"Origin": "https://zkgate.net", "Access-Control-Request-Method": "POST"},
    )
    assert r.headers.get("access-control-allow-origin") == "https://zkgate.net"
    assert r.headers.get("access-control-allow-credentials") is None
