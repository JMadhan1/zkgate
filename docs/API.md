# API Reference

Base URL (dev): `http://localhost:8000`. Interactive docs at `/docs` in
development only. They're disabled when `ENVIRONMENT=production`.

**Authentication.** Verifiers send `X-API-Key`. Keys are required in production
and optional in development, so the local demo works without setup (override
with `REQUIRE_API_KEY`). Two demo verifiers are seeded **outside production
only**: `99999` (key `demo-bank-key`) and `88888` (key `demo-age-key`). Their
keys are public.

**Request rules.** Request bodies must be `application/json` (else `415`) and at
most 1 MB (else `413`). Unknown fields are rejected (`422`). Each client gets
120 requests per 60 s, sliding window, per API key or else per IP; over the
limit returns `429` with `Retry-After`.

**Errors.** Every error, whatever the status, has the same shape and never
contains stack traces or echoed input:

```json
{ "error": { "code": 422, "message": "invalid request: verifier_id: …", "request_id": "…" } }
```

The `request_id` is also returned in the `X-Request-ID` header and in server logs.

## Verification

### `POST /v1/verify`
Verify one proof bundle.

```jsonc
// request
{
  "proof_bundle": {
    "proof": { "pi_a": [...], "pi_b": [...], "pi_c": [...], "protocol": "groth16" },
    "public_signals": ["1", "2165713258...", "18", "2026", "7", "17", "99999", "1784305661"],
    "claim_type": "age_above_18",
    "generated_at": 1784302061,
    "demo": true
  },
  "verifier_id": "99999",
  "expected": { "age_threshold": 18 }        // what you asked for; guards against off-topic proofs
}
```

```jsonc
// response
{
  "valid": true,
  "claims": { "age_above_18": true, "age_threshold_proven": 18, "expires_at": 1784305661 },
  "proof_id": "prf_1a2b3c4d5e6f",
  "nullifier": "2165713258...",
  "trust_level": "demo",                      // "demo" | "attested"
  "fresh": true,                              // false => replay
  "verified_at": "2026-07-17T14:23:00Z",
  "expires_at": "2026-07-17T15:23:00Z",
  "error": null
}
```

A valid-but-replayed proof returns `valid: false, fresh: false`. A valid proof that
doesn't match `expected` returns `valid: false` with an `error` explaining the
mismatch.

### `POST /v1/verify/batch`
Up to 100 bundles: `{ "proofs": [ <VerifyRequest>, ... ] }` →
`{ results, total, valid_count, invalid_count }`.

## Nullifiers & stats

- `GET /v1/nullifiers/{claim_type}/{nullifier}` — has this proof been used? `{ used: bool, record? }`
- `GET /v1/stats` — anonymous counters `{ verified, replay, backend }`

## Claims & encoding

- `GET /v1/claims` — the catalogue: each claim, its circuit, public-signal names, and what it reveals
- `GET /v1/encode/state?name=Andhra%20Pradesh` — `{ state_code: 28, canonical: "Andhra Pradesh" }`
- `GET /v1/encode/district?state=Andhra%20Pradesh&district=Chittoor` — `{ district_code: ... }`

## Verifiers & audit

- `GET /v1/verifiers`: public directory (no secrets)
- `POST /v1/verifiers` (**admin only**, `X-Admin-Token`): register `{ verifier_id, name }`
  and get back a `zkgate_sk_…` API key, shown **once**. Without `ADMIN_TOKEN` configured
  this is open in development and disabled in production. It answers `404` to anyone
  not authorised.
- `GET /v1/audit?limit=50` (**requires `X-API-Key`**, `1 ≤ limit ≤ 100`): the calling
  verifier's **own** recent audit events, plus a live hash-chain integrity check.

## Health

- `GET /` — service banner
- `GET /health` — `{ status: "ready"|"degraded", circuits_loaded, nullifier_backend, audit_chain_intact, ... }`

## Privacy guarantee

No endpoint accepts or returns personal data. The only citizen-derived value the
server ever receives is the proof's public signals — a boolean claim, an anonymous
nullifier, and the verifier's own parameters echoed back. There is deliberately no
endpoint that accepts an Aadhaar XML.
