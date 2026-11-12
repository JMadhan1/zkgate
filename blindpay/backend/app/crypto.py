"""
Encryption at rest and token handling.

* Spending policies are encrypted with AES-256-GCM, a fresh 96-bit nonce per
  record, and the owning company + member ids bound in as associated data, so a
  ciphertext copied onto another member's row fails to decrypt.
* Bearer tokens (sessions, login links, approval links) are 256-bit random
  values. Only their SHA-256 digest is stored, so a database leak can't be
  replayed. (SHA-256 is right for high-entropy tokens; passwords would need a
  slow hash, but BlindPay has no passwords.)
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import stat
from functools import lru_cache
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import settings


@lru_cache(maxsize=1)
def _key() -> bytes:
    if settings.encryption_key:
        key = base64.b64decode(settings.encryption_key)
    elif settings.is_production:
        raise RuntimeError("BLINDPAY_ENCRYPTION_KEY is required in production")
    else:
        path = Path(settings.dev_key_file)
        if path.exists():
            key = base64.b64decode(path.read_text().strip())
        else:
            key = AESGCM.generate_key(bit_length=256)
            path.write_text(base64.b64encode(key).decode())
            os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)
    if len(key) != 32:
        raise RuntimeError("encryption key must be 32 bytes (base64)")
    return key


def _aad(company_id: str, member_id: str) -> bytes:
    return f"blindpay:policy:{company_id}:{member_id}".encode()


def encrypt_json(obj: dict, company_id: str, member_id: str) -> bytes:
    nonce = secrets.token_bytes(12)
    ct = AESGCM(_key()).encrypt(nonce, json.dumps(obj, separators=(",", ":")).encode(), _aad(company_id, member_id))
    return nonce + ct


def decrypt_json(blob: bytes, company_id: str, member_id: str) -> dict:
    return json.loads(AESGCM(_key()).decrypt(blob[:12], blob[12:], _aad(company_id, member_id)))


def new_token() -> str:
    """A URL-safe 256-bit random token, prefixed for secret scanners."""
    return "bp_" + secrets.token_urlsafe(32)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def constant_time_equal(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())


def hmac_sha256_hex(secret: str, body: bytes) -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
