# Security policy

ZKGate India is a research prototype. We still want to hear about anything that
could weaken its privacy or verification guarantees.

## Reporting a vulnerability

Please report privately through
[GitHub Security Advisories](https://github.com/JMadhan1/zkgate/security/advisories/new).
Don't open a public issue for security problems.

Include the affected component (`circuits/`, `backend/`, `sdk/`, `frontend/`,
`verifier-portal/`), steps to reproduce, and the impact you expect. We aim to
acknowledge reports within 3 working days.

## Scope

In scope: soundness bugs in the circuits (proving a false claim), verifier
bypasses (accepting an invalid, off-topic or replayed proof), anything that
leaks citizen data off the device, and the usual web and API issues on
zkgate.net and the verification API.

Known and documented limitations are out of scope:

- the single-party trusted setup (`docs/TRUSTED_SETUP.md`);
- the registered-issuer signature model, rather than in-circuit UIDAI XML
  signature verification (`docs/UIDAI_INTEGRATION.md`);
- the **publicly documented demo keys**: the demo issuer key in
  `frontend/lib/prove.ts` and the `demo-bank-key` / `demo-age-key` verifier
  keys. They exist so the demo runs end to end, proofs made with them always
  report `trust_level: "demo"`, and the demo verifiers aren't seeded when
  `ENVIRONMENT=production`.

The machine-readable contact is published at
[`/.well-known/security.txt`](https://zkgate.net/.well-known/security.txt).
