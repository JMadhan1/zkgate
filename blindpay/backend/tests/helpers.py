from __future__ import annotations

import itertools
import re

from tests.conftest import COMPANY_GSTIN, OWNER

_ids = itertools.count(1)


def inbound(client, phone: str, text: str | None = None, image: str | None = None):
    msg = {"from": phone, "id": f"wamid.in.{next(_ids)}"}
    if image:
        msg.update(type="image", image={"id": image})
    else:
        msg.update(type="text", text={"body": text})
    payload = {"object": "whatsapp_business_account",
               "entry": [{"changes": [{"value": {"messages": [msg]}}]}]}
    r = client.post("/v1/webhooks/whatsapp", json=payload)
    assert r.status_code == 200, r.text
    return msg["id"]


def make_company(client, owner=OWNER, name="Acme Traders", gstin=COMPANY_GSTIN, plan="team") -> str:
    r = client.post("/v1/admin/companies", json={"name": name, "gstin": gstin, "owner_name": "Asha Owner",
                                                 "owner_phone": owner, "plan": plan})
    assert r.status_code == 201, r.text
    return r.json()["company_id"]


def link_token(wa, phone: str, template: str) -> str:
    msg = next(m for m in reversed(wa.sent) if m["to"] == phone and m.get("name") == template)
    url = msg["params"][-1] if template == "blindpay_approval_needed" else msg["params"][0]
    return re.search(r"#(bp_[A-Za-z0-9_-]+)$", url).group(1)


def login(client, wa, phone=OWNER) -> str:
    assert client.post("/v1/auth/login-link", json={"phone": phone}).status_code == 202
    token = link_token(wa, phone, "blindpay_login_link")
    r = client.post("/v1/auth/session", json={"token": token})
    assert r.status_code == 200, r.text
    return client.get("/v1/session").json()["csrf_token"]


def agree(client, phone):
    inbound(client, phone, "AGREE")


def texts_to(wa, phone):
    return [m.get("body") or m.get("name") for m in wa.sent if m["to"] == phone]
