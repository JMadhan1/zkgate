"""
Verifier registry — who is allowed to call /verify, and as whom.

A verifier is an institution (a bank, a liquor retailer, a government portal).
Each holds an API key and a stable numeric `verifier_id` that the citizen's
circuit binds the nullifier and pseudonym to. That binding is what makes
nullifiers unlinkable ACROSS verifiers, so the id has to be stable and public.

For the prototype this is an in-memory table seeded with a couple of demo
verifiers. Production would back it with Postgres and issue keys through an
onboarding flow — the interface here is deliberately small so that swap is local.
"""

from __future__ import annotations

import hashlib
import secrets
import time
from dataclasses import dataclass, field


@dataclass
class Verifier:
    verifier_id: str        # numeric string; bound into the circuit
    name: str
    api_key_hash: str
    active: bool = True
    key_created_at: float = field(default_factory=time.time)


def _hash_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode()).hexdigest()


class VerifierRegistry:
    def __init__(self, seed_demo: bool = True, max_key_age_days: int = 90) -> None:
        self._by_id: dict[str, Verifier] = {}
        self._id_by_keyhash: dict[str, str] = {}
        self.max_key_age_seconds = max(0, max_key_age_days) * 86400
        if seed_demo:
            self._seed_demo()

    def _seed_demo(self) -> None:
        # Two well-known demo verifiers. The keys are printed in the docs; they
        # are not secrets, they exist so the demo and tests have something to use.
        # Because they are public, they are NOT seeded in production (see
        # config.seed_demo_verifiers).
        self.register(verifier_id="99999", name="Demo Bank (KYC)", api_key="demo-bank-key")
        self.register(verifier_id="88888", name="Demo Liquor Retailer (age)", api_key="demo-age-key")

    def register(self, *, verifier_id: str, name: str, api_key: str | None = None) -> tuple[Verifier, str]:
        # 32 random bytes = 256 bits of entropy; product prefix makes leaked
        # keys identifiable by secret scanners. Only a SHA-256 digest is kept
        # (appropriate for high-entropy keys, unlike passwords).
        api_key = api_key or ("zkgate_sk_" + secrets.token_urlsafe(32))
        v = Verifier(verifier_id=verifier_id, name=name, api_key_hash=_hash_key(api_key))
        self._by_id[verifier_id] = v
        self._id_by_keyhash[v.api_key_hash] = verifier_id
        return v, api_key

    def get(self, verifier_id: str) -> Verifier | None:
        return self._by_id.get(verifier_id)

    def authenticate(self, api_key: str, now: float | None = None) -> Verifier | None:
        vid = self._id_by_keyhash.get(_hash_key(api_key))
        if vid is None:
            return None
        v = self._by_id[vid]
        if not v.active or self.key_expired(v, now):
            return None
        return v

    def key_expired(self, v: Verifier, now: float | None = None) -> bool:
        if not self.max_key_age_seconds:
            return False
        now = time.time() if now is None else now
        return now - v.key_created_at > self.max_key_age_seconds

    def rotate_key(self, verifier_id: str) -> str | None:
        """Issue a new key and invalidate the old one immediately. Returns the
        new plaintext key (shown once), or None if the verifier is unknown."""
        v = self._by_id.get(verifier_id)
        if v is None:
            return None
        self._id_by_keyhash.pop(v.api_key_hash, None)
        api_key = "zkgate_sk_" + secrets.token_urlsafe(32)
        v.api_key_hash = _hash_key(api_key)
        v.key_created_at = time.time()
        self._id_by_keyhash[v.api_key_hash] = verifier_id
        return api_key

    def revoke(self, verifier_id: str) -> bool:
        v = self._by_id.get(verifier_id)
        if v is None:
            return False
        v.active = False
        self._id_by_keyhash.pop(v.api_key_hash, None)
        return True

    def list_public(self) -> list[dict]:
        # Never expose key hashes.
        return [
            {"verifier_id": v.verifier_id, "name": v.name, "active": v.active}
            for v in self._by_id.values()
        ]
