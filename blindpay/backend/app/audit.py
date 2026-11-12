"""
Per-company hash-chained audit log.

Each event's hash covers the previous event's hash, so editing or deleting
history breaks the chain from that point. Events name actors by member id and
never carry policy numbers, tokens or free-text personal data.
"""

from __future__ import annotations

import hashlib
import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditEvent, utcnow

GENESIS = "0" * 64


def _digest(company_id: str, seq: int, ts: str, actor: str, action: str, resource: str, data: dict, prev: str) -> str:
    blob = json.dumps(
        {"c": company_id, "s": seq, "t": ts, "a": actor, "x": action, "r": resource, "d": data, "p": prev},
        sort_keys=True, separators=(",", ":"),
    )
    return hashlib.sha256(blob.encode()).hexdigest()


def record(db: Session, company_id: str, actor: str, action: str, resource: str, data: dict | None = None) -> AuditEvent:
    last = db.execute(
        select(AuditEvent).where(AuditEvent.company_id == company_id).order_by(AuditEvent.seq.desc()).limit(1)
    ).scalar_one_or_none()
    seq = (last.seq + 1) if last else 1
    prev = last.hash if last else GENESIS
    ts = utcnow().isoformat(timespec="milliseconds").replace("+00:00", "Z")
    data = data or {}
    ev = AuditEvent(
        company_id=company_id, seq=seq, ts=ts, actor=actor, action=action, resource=resource,
        data=data, prev_hash=prev, hash=_digest(company_id, seq, ts, actor, action, resource, data, prev),
    )
    db.add(ev)
    db.flush()
    return ev


def verify_chain(db: Session, company_id: str) -> tuple[bool, int | None]:
    prev = GENESIS
    rows = db.execute(
        select(AuditEvent).where(AuditEvent.company_id == company_id).order_by(AuditEvent.seq)
    ).scalars()
    for i, ev in enumerate(rows, start=1):
        if ev.seq != i or ev.prev_hash != prev or ev.hash != _digest(
            ev.company_id, ev.seq, ev.ts, ev.actor, ev.action, ev.resource, ev.data, ev.prev_hash
        ):
            return False, i
        prev = ev.hash
    return True, None
