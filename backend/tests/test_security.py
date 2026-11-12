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

    # Auth failures look exactly like a route that doesn't exist.
    missing = client.get("/v1/audit")
    wrong = client.get("/v1/audit", headers={"X-API-Key": "wrong"})
    nowhere = client.get("/v1/does-not-exist")
    for r in (missing, wrong):
        assert r.status_code == 404
        assert r.json()["error"]["message"] == nowhere.json()["error"]["message"]

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
    assert r.status_code == 404
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


# ── authentication hardening ─────────────────────────────────────────────────

@pytest.fixture
def no_delay(monkeypatch):
    """Skip the progressive auth-failure delay so tests stay fast."""
    import dependencies

    async def _instant(_s):
        return None

    monkeypatch.setattr(dependencies.asyncio, "sleep", _instant)


def test_lockout_after_repeated_bad_keys(client, no_delay):
    from config import settings

    h = {"X-API-Key": "zkgate_sk_guess"}
    for _ in range(settings.auth_failure_limit):
        assert client.get("/v1/audit", headers=h).status_code == 404
    locked = client.get("/v1/audit", headers=h)
    assert locked.status_code == 429
    assert int(locked.headers["retry-after"]) >= 1
    # Even the right key is refused from a locked-out client.
    assert client.get("/v1/audit", headers={"X-API-Key": "demo-bank-key"}).status_code == 429


def test_key_rotation_revokes_old_key(client):
    old = {"X-API-Key": "demo-bank-key"}
    assert client.get("/v1/audit", headers=old).status_code == 200
    r = client.post("/v1/verifiers/99999/rotate-key", json={})
    assert r.status_code == 200
    new_key = r.json()["api_key"]
    assert new_key.startswith("zkgate_sk_") and len(new_key) >= 50
    assert client.get("/v1/audit", headers=old).status_code == 404
    assert client.get("/v1/audit", headers={"X-API-Key": new_key}).status_code == 200


def test_rotate_unknown_verifier_is_404(client):
    assert client.post("/v1/verifiers/123/rotate-key", json={}).status_code == 404


def test_revoked_verifier_cannot_authenticate(client):
    assert client.post("/v1/verifiers/88888/revoke", json={}).status_code == 200
    assert client.get("/v1/audit", headers={"X-API-Key": "demo-age-key"}).status_code == 404


def test_keys_expire_after_max_age():
    from services.verifier_registry import VerifierRegistry

    reg = VerifierRegistry(seed_demo=False, max_key_age_days=90)
    v, key = reg.register(verifier_id="1", name="x")
    assert reg.authenticate(key) is v
    assert reg.authenticate(key, now=v.key_created_at + 91 * 86400) is None


def test_admin_endpoints_need_token_when_configured(client, monkeypatch):
    from config import settings

    monkeypatch.setattr(settings, "admin_token", "t" * 40)
    assert client.post("/v1/verifiers/99999/rotate-key", json={}).status_code == 404
    assert client.post("/v1/verifiers/99999/revoke", json={}).status_code == 404


# ── authorization: tenant scoping ────────────────────────────────────────────

def test_nullifier_status_requires_key_and_is_owner_only(client, proofs):
    r = client.post("/v1/verify", json=bundle(proofs["age18"], "age_above_18", verifier_id="99999")).json()
    assert r["valid"] is True
    path = f"/v1/nullifiers/age_above_18/{r['nullifier']}"

    assert client.get(path).status_code == 404  # no key
    mine = client.get(path, headers={"X-API-Key": "demo-bank-key"})
    assert mine.status_code == 200 and mine.json()["used"] is True
    assert "verifier" not in mine.json()["record"]
    # Another verifier can't learn that this nullifier was spent elsewhere.
    assert client.get(path, headers={"X-API-Key": "demo-age-key"}).status_code == 404


def test_stats_require_key_in_production(client, monkeypatch):
    from config import settings

    monkeypatch.setattr(settings, "environment", "production")
    assert client.get("/v1/stats").status_code == 404
    assert client.get("/v1/stats", headers={"X-API-Key": "demo-bank-key"}).status_code == 200


# ── information disclosure ───────────────────────────────────────────────────

def test_health_reports_booleans_only(client):
    body = client.get("/health").json()
    assert set(body) == {"status", "circuits_loaded", "nullifier_store_healthy", "audit_chain_intact"}
    assert all(isinstance(v, bool) for k, v in body.items() if k != "status")


def test_root_does_not_advertise_version(client, monkeypatch):
    from config import settings

    assert "version" not in client.get("/").json()
    monkeypatch.setattr(settings, "environment", "production")
    assert "docs" not in client.get("/").json()


def test_encode_does_not_echo_input(client):
    r = client.get("/v1/encode/state", params={"name": "Atlantis"})
    assert r.status_code == 404 and "Atlantis" not in r.text
    r = client.get("/v1/encode/state", params={"name": "<script>"})
    assert r.status_code == 422 and "<script>" not in r.text
    assert client.get("/v1/encode/state", params={"name": "x" * 200}).status_code == 422


def test_docs_disabled_in_production():
    """A fresh app built with production settings serves no API docs."""
    import importlib

    import config
    import main

    original = config.settings.environment
    try:
        config.settings.environment = "production"
        prod = importlib.reload(main).app
        from fastapi.testclient import TestClient

        c = TestClient(prod)
        for path in ("/docs", "/redoc", "/openapi.json"):
            assert c.get(path).status_code == 404
    finally:
        config.settings.environment = original
        importlib.reload(main)


# ── security event logging ───────────────────────────────────────────────────

def test_security_events_logged_without_secrets(client, caplog, no_delay):
    import json
    import logging

    caplog.set_level(logging.INFO, logger="zkgate.security_events")
    client.get("/v1/audit", headers={"X-API-Key": "demo-bank-key"})
    client.get("/v1/audit", headers={"X-API-Key": "zkgate_sk_wrong-secret-value"})

    events = [json.loads(r.getMessage()) for r in caplog.records if r.name == "zkgate.security_events"]
    ok = [e for e in events if e["action"] == "auth.api_key" and e["result"] == "success"]
    bad = [e for e in events if e["action"] == "auth.api_key" and e["result"] == "failure"]
    assert ok and bad
    for e in events:
        assert {"ts", "request_id", "ip", "actor", "action", "resource", "result"} <= set(e)
        assert e["ts"].endswith("Z")
    assert ok[0]["actor"] == "99999"
    blob = caplog.text
    assert "demo-bank-key" not in blob and "wrong-secret-value" not in blob


def test_rate_limit_trigger_is_logged(client, caplog):
    import logging

    from config import settings

    caplog.set_level(logging.INFO, logger="zkgate.security_events")
    for _ in range(settings.rate_limit_requests + 1):
        client.get("/v1/claims")
    assert '"action":"rate_limit"' in caplog.text


# ── semantic gate: the verifier's request wins over the prover's label ──────

def test_age_proof_cannot_satisfy_stricter_request_by_relabelling(client, proofs):
    """An 18+ proof labelled age_above_18 must not pass a request for 21+."""
    r = client.post(
        "/v1/verify",
        json=bundle(proofs["age18"], "age_above_18", expected={"age_threshold": 21}),
    ).json()
    assert r["valid"] is False
    assert "age>=18" in r["error"] and "age>=21" in r["error"]


def test_same_proof_still_passes_matching_request(client, proofs):
    r = client.post(
        "/v1/verify",
        json=bundle(proofs["age18"], "age_above_18", expected={"age_threshold": 18}),
    ).json()
    assert r["valid"] is True


def test_malformed_expected_is_rejected_not_500(client, proofs):
    for bad in ({"age_threshold": "abc"}, {"age_threshold": True}, {"age_threshold": -1}):
        r = client.post("/v1/verify", json=bundle(proofs["age18"], "age_above_18", expected=bad))
        assert r.status_code == 200
        assert r.json()["valid"] is False
    r = client.post("/v1/verify", json=bundle(proofs["locAP"], "state_resident", expected={"required_state_code": "x"}))
    assert r.status_code == 200 and r.json()["valid"] is False
