# BlindPay

Employees ask for money on WhatsApp, owners approve with one tap, payouts go
out by UPI, every bill is captured GST-correct, and the books export to Tally.
Plan and research: the "BlindPay — Deep Research & Build Map" doc.

| Part | What it is |
| --- | --- |
| `backend/` | FastAPI API: WhatsApp webhook and conversation, policy engine (limits encrypted, declines never show numbers), approvals, RazorpayX payouts, Razorpay billing, Tally export, hash-chained audit |
| `web/` | Owner PWA (Next.js): sign-in by WhatsApp link, one-tap approve page, dashboard |

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
