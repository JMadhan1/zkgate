# BlindPay

Employees ask for money on WhatsApp, owners approve with one tap, payouts go
out by UPI, every bill is captured GST-correct, and the books export to Tally.
Plan and research: the "BlindPay — Deep Research & Build Map" doc.

| Part | What it is |
| --- | --- |
| `backend/` | FastAPI API: WhatsApp webhook and conversation, policy engine (limits encrypted, declines never show numbers), approvals, RazorpayX payouts, Razorpay billing, Tally export, hash-chained audit |
| `web/` | Owner PWA (Next.js): sign-in by WhatsApp link, one-tap approve page, dashboard, and the public CA verifier at `/verify` |
| `circuits/` | Proof-of-policy: `policyCheck.circom` (Groth16, 940 constraints), build script, Node prover |

## Proof-of-policy (Phase 2)

Every approval of a member who has a policy carries a Groth16 proof that
`spent_before + amount <= limit`, where the limit is hidden behind a Poseidon
commitment written to a hash-chained policy log *before* any spend can use it
(on save, for this month and next). The owner exports a monthly **Audit Pack**;
the company's CA opens `/verify`, drops the file in, and the browser checks
the log chain, recomputes every request hash and running total, and verifies
each proof, without ever seeing a limit (the pack contains none).

v1 proves on the server (it holds the encrypted limit); the verifier is the CA,
which is what makes the proof meaningful. v2 moves proving to the owner's phone.

```bash
npm ci && npm --workspace blindpay/circuits run build   # wasm, zkey, verification key (git-ignored)
```

The build's trusted setup is single-party: fine for development and CI, not
for production. Run a multi-party ceremony (docs/TRUSTED_SETUP_CEREMONY_PLAN.md)
and publish the verification key and transcript where CAs can fetch them.

## Run locally

```bash
cd blindpay/backend && python -m venv .venv && .venv/bin/pip install -r requirements.txt
BLINDPAY_PUBLIC_BASE_URL=http://localhost:3002 .venv/bin/uvicorn app.main:app --port 8010
```

```bash
npm ci && npm --workspace blindpay/web run build && npm --workspace blindpay/web run start   # http://localhost:3002
```

With no WhatsApp/RazorpayX credentials the API uses recording stand-ins:
create a company with `POST /v1/admin/companies`, send WhatsApp messages by
POSTing Meta-shaped payloads to `/v1/webhooks/whatsapp`, and read what the bot
"sent" (including sign-in and approval links) at `GET /v1/dev/outbox?to=<phone>`.
That outbox route doesn't exist in production.

## Going live

1. Meta: verify the business, register the number, submit the utility
   templates listed in `backend/app/notify.py`, point the webhook at
   `https://<api>/v1/webhooks/whatsapp`.
2. RazorpayX: current account, API keys, webhook `payout.*` to `/v1/webhooks/razorpayx`.
3. Razorpay: Team and Business plans, webhook `subscription.*` to `/v1/webhooks/razorpay`.
4. Set every `BLINDPAY_*` secret from a secret manager (see `backend/.env.example`);
   `ENVIRONMENT=production` refuses to start without them.
5. Postgres with TLS and a least-privilege user; serve the web app and API
   behind HTTPS on one origin (`/api/*` → API).

## Tests

```bash
cd blindpay/backend && python -m pytest -q
```
