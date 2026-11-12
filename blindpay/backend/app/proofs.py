"""
Proof-of-policy: commitments, proofs, and the CA Audit Pack.

Every approval of a member with a policy carries a Groth16 proof that
    spent_before + amount <= limit
against a Poseidon commitment to the limit, logged before the spend. In v1
the server proves (it holds the encrypted limit); the point is that the
VERIFIER is someone else: the company's CA, who checks the Audit Pack in a
browser without ever seeing a limit. v2 moves proving to the owner's device.

Proving runs blindpay/circuits/prove.mjs as a child process: fixed argv, no
shell, data only on stdin. If the circuit artifacts aren't built, proofs are
skipped (logged) and the request simply carries no proof.
"""

from __future__ import annotations

import hashlib
import json
import logging
import secrets
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.crypto import decrypt_json, encrypt_json
from app.models import Company, Member, Policy, PolicyCommitment, SpendRequest, utcnow
from app.policy import IST, get_policy

log = logging.getLogger("blindpay.proofs")

FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617
GENESIS = "0" * 64
CIRCUITS = Path(__file__).resolve().parents[2] / "circuits"


def circuit_dir() -> Path:
    return Path(settings.circuit_dir) if settings.circuit_dir else CIRCUITS / "build"


def available() -> bool:
    d = circuit_dir()
    return bool(shutil.which(settings.node_binary)) and all(
        (d / f).exists() for f in ("policyCheck.wasm", "policyCheck.zkey", "verification_key.json"))


def _run(payload: dict) -> dict:
    proc = subprocess.run(
        [shutil.which(settings.node_binary) or settings.node_binary, str(CIRCUITS / "prove.mjs")],
        input=json.dumps(payload).encode(), capture_output=True, timeout=60, check=False,
        env={"BLINDPAY_CIRCUIT_DIR": str(circuit_dir()), "PATH": "/usr/bin:/bin"},
    )
    if proc.returncode != 0:
        raise RuntimeError("prover failed: " + proc.stderr.decode(errors="replace")[:160])
    return json.loads(proc.stdout)


def _field_from(text: str) -> str:
    """A BN128 field element (as a decimal string) derived from text via SHA-256 (248 bits)."""
    return str(int.from_bytes(hashlib.sha256(text.encode()).digest()[:31], "big"))


def member_tag(member_id: str) -> str:
    return _field_from(f"blindpay:member:{member_id}")


def request_hash(request_id: str, tag: str, period: int, amount_paise: int) -> str:
    """Recomputable by the CA from the Audit Pack (same recipe in the browser verifier)."""
    return _field_from(f"{request_id}|{tag}|{period}|{amount_paise}")


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=utcnow().tzinfo)


def period_of(dt: datetime) -> int:
    local = _aware(dt).astimezone(IST)
    return local.year * 100 + local.month


def log_hash(company_id: str, seq: int, ts: str, tag: str, period: int, version: int, commitment: str, prev: str) -> str:
    """Canonical entry hash; the browser verifier rebuilds this exact JSON (sorted keys, no spaces)."""
    blob = json.dumps({"c": company_id, "k": commitment, "m": tag, "p": period, "prev": prev, "s": seq,
                       "t": ts, "v": version}, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(blob.encode()).hexdigest()


def ensure_commitment(db: Session, company_id: str, member_id: str, period: int) -> PolicyCommitment | None:
    """The commitment for this member's CURRENT policy version and period; logged if new."""
    pol_row = db.get(Policy, member_id)
    if pol_row is None or pol_row.company_id != company_id:
        return None
    existing = db.execute(select(PolicyCommitment).where(
        PolicyCommitment.member_id == member_id, PolicyCommitment.period == period,
        PolicyCommitment.version == pol_row.version)).scalar_one_or_none()
    if existing:
        return existing
    pol = get_policy(db, company_id, member_id)
    tag = member_tag(member_id)
    salt = str(secrets.randbelow(FIELD))
    commitment = _run({"mode": "commit", "limit": str(pol["monthly_limit_paise"]), "salt": salt,
                       "memberTag": tag, "period": str(period)})["commitment"]
    last = db.execute(select(PolicyCommitment).where(PolicyCommitment.company_id == company_id)
                      .order_by(PolicyCommitment.seq.desc()).limit(1)).scalar_one_or_none()
    seq, prev = (last.seq + 1, last.hash) if last else (1, GENESIS)
    ts = utcnow().isoformat(timespec="milliseconds").replace("+00:00", "Z")
    entry = PolicyCommitment(
        company_id=company_id, member_id=member_id, seq=seq, ts=ts, member_tag=tag, period=period,
        version=pol_row.version, commitment=commitment,
        salt_ciphertext=encrypt_json({"salt": salt}, company_id, member_id),
        prev_hash=prev, hash=log_hash(company_id, seq, ts, tag, period, pol_row.version, commitment, prev),
    )
    db.add(entry)
    db.flush()
    return entry


def next_period(period: int) -> int:
    y, m = divmod(period, 100)
    return (y + 1) * 100 + 1 if m == 12 else period + 1


def commit_policy(db: Session, company_id: str, member_id: str) -> None:
    """Log commitments for this period and the next as soon as a policy is saved,
    so the commitment always predates any spend checked against it."""
    if not available():
        return
    now = period_of(utcnow())
    try:
        for period in (now, next_period(now)):
            ensure_commitment(db, company_id, member_id, period)
    except (RuntimeError, subprocess.TimeoutExpired, ValueError) as exc:
        log.warning("couldn't log policy commitment for member %s: %s", member_id, exc)


def precommit(db: Session, company_id: str, member_id: str) -> None:
    """Called just BEFORE a decision is timestamped: guarantees the commitment
    for this period exists first (covers month rollovers)."""
    if not available():
        return
    try:
        ensure_commitment(db, company_id, member_id, period_of(utcnow()))
    except (RuntimeError, subprocess.TimeoutExpired, ValueError) as exc:
        log.warning("couldn't log policy commitment for member %s: %s", member_id, exc)


def spent_before(db: Session, req: SpendRequest, period: int) -> int:
    """Approved/paid spend by this member in this period, decided before this request."""
    rows = db.execute(select(SpendRequest.amount_paise, SpendRequest.decided_at).where(
        SpendRequest.company_id == req.company_id, SpendRequest.member_id == req.member_id,
        SpendRequest.status.in_(("approved", "paid", "payout_failed")), SpendRequest.id != req.id,
        SpendRequest.decided_at.is_not(None))).all()
    cutoff = _aware(req.decided_at)
    return sum(a for a, d in rows if period_of(d) == period and _aware(d) <= cutoff)


def attach_proof(db: Session, req: SpendRequest) -> bool:
    """Prove an approval against its committed policy. Returns False (and leaves no proof) if not possible."""
    if req.decided_at is None or not available():
        if not available():
            log.warning("proofs disabled: circuit artifacts not built (blindpay/circuits/build.sh)")
        return False
    period = period_of(req.decided_at)
    try:
        entry = ensure_commitment(db, req.company_id, req.member_id, period)
        if entry is None:
            return False  # no policy: the owner decided by hand, nothing to prove
        pol = get_policy(db, req.company_id, req.member_id)
        salt = decrypt_json(entry.salt_ciphertext, req.company_id, req.member_id)["salt"]
        before = spent_before(db, req, period)
        rh = request_hash(req.id, entry.member_tag, period, req.amount_paise)
        out = _run({"mode": "prove", "limit": str(pol["monthly_limit_paise"]), "salt": salt,
                    "commitment": entry.commitment, "memberTag": entry.member_tag, "period": str(period),
                    "amount": str(req.amount_paise), "spentBefore": str(before), "requestHash": rh})
    except (RuntimeError, subprocess.TimeoutExpired, ValueError) as exc:
        log.warning("proof failed for request %s: %s", req.id, exc)
        return False
    req.proof = {"proof": out["proof"], "public_signals": out["publicSignals"], "commitment_seq": entry.seq,
                 "spent_before_paise": before, "period": period}
    return True


def verify(proof: dict, public_signals: list[str]) -> bool:
    return bool(_run({"mode": "verify", "proof": proof, "publicSignals": public_signals})["valid"])


def verification_key() -> dict | None:
    p = circuit_dir() / "verification_key.json"
    return json.loads(p.read_text()) if p.exists() else None


def audit_pack(db: Session, company: Company, period: int) -> dict:
    """Everything a CA needs to verify a month without seeing any limit."""
    entries = db.execute(select(PolicyCommitment).where(PolicyCommitment.company_id == company.id)
                         .order_by(PolicyCommitment.seq)).scalars().all()
    names = dict(db.execute(select(Member.id, Member.name).where(Member.company_id == company.id)).all())
    reqs = db.execute(select(SpendRequest).where(
        SpendRequest.company_id == company.id, SpendRequest.decided_at.is_not(None),
        SpendRequest.status.in_(("approved", "paid", "payout_failed")),
    ).order_by(SpendRequest.decided_at)).scalars().all()
    approvals = []
    for r in reqs:
        if period_of(r.decided_at) != period:
            continue
        dec = r.decided_at if r.decided_at.tzinfo else r.decided_at.replace(tzinfo=utcnow().tzinfo)
        approvals.append({
            "request_id": r.id, "member": names.get(r.member_id, ""), "member_tag": member_tag(r.member_id),
            "amount_paise": r.amount_paise, "description": r.description, "status": r.status,
            "decided_at": dec.isoformat(timespec="milliseconds").replace("+00:00", "Z"),
            "decided_by": "policy" if r.decided_by == "policy" else ("owner/approver" if r.decided_by else None),
            "proof": r.proof,
        })
    return {
        "format": "blindpay.audit-pack/1",
        "company": {"id": company.id, "name": company.name, "gstin": company.gstin},
        "period": period,
        "generated_at": utcnow().isoformat(timespec="seconds").replace("+00:00", "Z"),
        "verification_key": verification_key(),
        "policy_log": [{"seq": e.seq, "ts": e.ts, "member_tag": e.member_tag, "period": e.period,
                        "version": e.version, "commitment": e.commitment, "prev_hash": e.prev_hash,
                        "hash": e.hash} for e in entries],
        "policy_log_head": entries[-1].hash if entries else GENESIS,
        "approvals": approvals,
        "how_to_verify": "Open the BlindPay verifier (/verify) and load this file. It checks the policy log hash "
                         "chain, recomputes each spent_before and request hash, and verifies every Groth16 proof "
                         "against the verification key. No limit appears anywhere in this file.",
    }
