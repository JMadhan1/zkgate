"""
External providers: WhatsApp Cloud API, RazorpayX payouts, Razorpay subscriptions.

Each has a real HTTP client (used whenever its credentials are configured) and
an in-memory stand-in for development and tests that records what would have
been sent. Production refuses to start without credentials
(config.require_production_secrets), so the stand-ins can't run there.

API shapes follow the providers' public docs:
  WhatsApp: POST {base}/{phone_number_id}/messages (Bearer token)
  RazorpayX: POST /v1/contacts, /v1/fund_accounts, /v1/payouts (Basic auth,
             X-Payout-Idempotency header)
  Razorpay:  POST /v1/subscriptions
Verify request/response fields against the live docs before go-live.
"""

from __future__ import annotations

import itertools
import logging
from dataclasses import dataclass, field

import httpx

from app.config import settings

log = logging.getLogger("blindpay.providers")
TIMEOUT = httpx.Timeout(10.0, connect=5.0)


class ProviderError(RuntimeError):
    """A provider call failed. The message is safe to log; it never holds secrets."""


# ── WhatsApp ─────────────────────────────────────────────────────────────


class WhatsAppClient:
    def __init__(self) -> None:
        self._url = f"{settings.whatsapp_api_base}/{settings.whatsapp_phone_number_id}/messages"
        self._headers = {"Authorization": f"Bearer {settings.whatsapp_access_token}"}

    def _post(self, payload: dict) -> str:
        try:
            r = httpx.post(self._url, json=payload, headers=self._headers, timeout=TIMEOUT)
        except httpx.HTTPError as exc:
            raise ProviderError(f"whatsapp transport error: {type(exc).__name__}") from None
        if r.status_code >= 300:
            raise ProviderError(f"whatsapp send failed: HTTP {r.status_code}")
        return r.json().get("messages", [{}])[0].get("id", "")

    def send_text(self, to: str, body: str) -> str:
        """Free-form text: only valid inside the 24-hour window after the member wrote to us."""
        return self._post({"messaging_product": "whatsapp", "to": to, "type": "text",
                           "text": {"body": body[:4096], "preview_url": False}})

    def send_template(self, to: str, name: str, params: list[str], lang: str = "en") -> str:
        """A pre-approved utility template, for messages we start (owner approvals, login links)."""
        return self._post({
            "messaging_product": "whatsapp", "to": to, "type": "template",
            "template": {"name": name, "language": {"code": lang},
                         "components": [{"type": "body", "parameters": [{"type": "text", "text": p[:1024]} for p in params]}]},
        })


@dataclass
class FakeWhatsApp:
    sent: list[dict] = field(default_factory=list)
    _ids: itertools.count = field(default_factory=lambda: itertools.count(1))

    def send_text(self, to: str, body: str) -> str:
        mid = f"wamid.fake.{next(self._ids)}"
        self.sent.append({"to": to, "type": "text", "body": body, "id": mid})
        log.info("whatsapp(fake) text to=%s… %s", to[:4], body.splitlines()[0][:60])
        return mid

    def send_template(self, to: str, name: str, params: list[str], lang: str = "en") -> str:
        mid = f"wamid.fake.{next(self._ids)}"
        self.sent.append({"to": to, "type": "template", "name": name, "params": params, "id": mid})
        log.info("whatsapp(fake) template=%s to=%s…", name, to[:4])
        return mid

    def last_to(self, to: str) -> dict | None:
        return next((m for m in reversed(self.sent) if m["to"] == to), None)


# ── RazorpayX payouts ────────────────────────────────────────────────────


class RazorpayXClient:
    BASE = "https://api.razorpay.com/v1"

    def __init__(self) -> None:
        self._auth = (settings.razorpayx_key_id, settings.razorpayx_key_secret)

    def _post(self, path: str, payload: dict, idem: str | None = None) -> dict:
        headers = {"X-Payout-Idempotency": idem} if idem else {}
        try:
            r = httpx.post(f"{self.BASE}{path}", json=payload, auth=self._auth, headers=headers, timeout=TIMEOUT)
        except httpx.HTTPError as exc:
            raise ProviderError(f"razorpayx transport error: {type(exc).__name__}") from None
        if r.status_code >= 300:
            raise ProviderError(f"razorpayx {path} failed: HTTP {r.status_code}")
        return r.json()

    def create_vpa_fund_account(self, member_id: str, name: str, phone: str, vpa: str) -> tuple[str, str]:
        contact = self._post("/contacts", {"name": name[:50], "contact": phone, "type": "employee",
                                            "reference_id": member_id})
        fa = self._post("/fund_accounts", {"contact_id": contact["id"], "account_type": "vpa",
                                            "vpa": {"address": vpa}})
        return contact["id"], fa["id"]

    def create_payout(self, fund_account_id: str, amount_paise: int, idempotency_key: str,
                      reference_id: str, narration: str) -> tuple[str, str]:
        p = self._post("/payouts", {
            "account_number": settings.razorpayx_account_number, "fund_account_id": fund_account_id,
            "amount": amount_paise, "currency": "INR", "mode": "UPI", "purpose": "reimbursement",
            "queue_if_low_balance": True, "reference_id": reference_id[:40], "narration": narration[:30],
        }, idem=idempotency_key)
        return p["id"], p.get("status", "processing")


@dataclass
class FakeRazorpayX:
    payouts: list[dict] = field(default_factory=list)
    fail_next: bool = False
    _ids: itertools.count = field(default_factory=lambda: itertools.count(1))

    def create_vpa_fund_account(self, member_id: str, name: str, phone: str, vpa: str) -> tuple[str, str]:
        n = next(self._ids)
        return f"cont_fake{n}", f"fa_fake{n}"

    def create_payout(self, fund_account_id: str, amount_paise: int, idempotency_key: str,
                      reference_id: str, narration: str) -> tuple[str, str]:
        if self.fail_next:
            self.fail_next = False
            raise ProviderError("razorpayx /payouts failed: HTTP 400")
        # Idempotency: the same key returns the same payout, like the real API.
        for p in self.payouts:
            if p["idempotency_key"] == idempotency_key:
                return p["id"], p["status"]
        pid = f"pout_fake{next(self._ids)}"
        self.payouts.append({"id": pid, "fund_account_id": fund_account_id, "amount": amount_paise,
                             "idempotency_key": idempotency_key, "reference_id": reference_id, "status": "processing"})
        return pid, "processing"


# ── Razorpay subscriptions ───────────────────────────────────────────────


class RazorpayBillingClient:
    BASE = "https://api.razorpay.com/v1"

    def create_subscription(self, plan_id: str, company_id: str) -> tuple[str, str]:
        try:
            r = httpx.post(f"{self.BASE}/subscriptions", auth=(settings.razorpayx_key_id, settings.razorpayx_key_secret),
                           json={"plan_id": plan_id, "total_count": 120, "customer_notify": 1,
                                 "notes": {"company_id": company_id}}, timeout=TIMEOUT)
        except httpx.HTTPError as exc:
            raise ProviderError(f"razorpay transport error: {type(exc).__name__}") from None
        if r.status_code >= 300:
            raise ProviderError(f"razorpay /subscriptions failed: HTTP {r.status_code}")
        body = r.json()
        return body["id"], body["short_url"]


@dataclass
class FakeBilling:
    created: list[dict] = field(default_factory=list)

    def create_subscription(self, plan_id: str, company_id: str) -> tuple[str, str]:
        sid = f"sub_fake{len(self.created) + 1}"
        self.created.append({"id": sid, "plan_id": plan_id, "company_id": company_id})
        return sid, f"https://rzp.io/i/{sid}"


# ── Selection ────────────────────────────────────────────────────────────


class Providers:
    """Process-wide provider instances; tests swap them for fakes."""

    def __init__(self) -> None:
        self.whatsapp = WhatsAppClient() if settings.whatsapp_access_token else FakeWhatsApp()
        self.payouts = RazorpayXClient() if settings.razorpayx_key_id else FakeRazorpayX()
        self.billing = RazorpayBillingClient() if settings.razorpayx_key_id else FakeBilling()


providers = Providers()
