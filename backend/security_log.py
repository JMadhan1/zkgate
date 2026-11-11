"""
Structured security event log.

One JSON object per line on the "zkgate.security_events" logger, with the
fields the logging rules require: UTC ISO-8601 timestamp, request id, client
IP, actor (verifier id or "anonymous"/"admin"), action, resource and result.

Never pass secrets or personal data in here. API keys are reduced to a short
SHA-256 fingerprint by `key_fingerprint()` before they get anywhere near a log.
Ship this logger to append-only storage with >= 90 days retention.
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone

from fastapi import Request

_log = logging.getLogger("zkgate.security_events")

# Values that must never be logged even if a caller passes them by mistake.
_FORBIDDEN_FIELDS = {"api_key", "x_api_key", "admin_token", "token", "password", "authorization"}


def key_fingerprint(api_key: str | None) -> str | None:
    """A non-reversible 12-hex-char fingerprint of an API key, for correlation."""
    if not api_key:
        return None
    return hashlib.sha256(api_key.encode()).hexdigest()[:12]


def client_ip(request: Request | None) -> str:
    # The direct peer only. X-Forwarded-For is client-controlled unless a
    # trusted proxy rewrites it (configure uvicorn --forwarded-allow-ips).
    if request is None or request.client is None:
        return "unknown"
    return request.client.host


def request_id(request: Request | None) -> str | None:
    if request is None:
        return None
    return request.scope.get("state", {}).get("request_id")


def security_event(
    action: str,
    result: str,
    *,
    request: Request | None = None,
    actor: str | None = None,
    resource: str | None = None,
    level: int = logging.INFO,
    **fields,
) -> dict:
    """Emit one security event. Returns the event (handy for tests)."""
    event = {
        "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "request_id": request_id(request),
        "ip": client_ip(request),
        "actor": actor or "anonymous",
        "action": action,
        "resource": resource or (request.url.path if request is not None else None),
        "result": result,
    }
    for k, v in fields.items():
        if k.lower() in _FORBIDDEN_FIELDS:
            continue
        event[k] = v
    _log.log(level, json.dumps(event, separators=(",", ":"), default=str))
    return event
