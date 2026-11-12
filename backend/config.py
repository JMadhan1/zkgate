"""Configuration via environment. Sensible dev defaults so `uvicorn main:app`
just runs; production (ENVIRONMENT=production) flips every default to the
restrictive option. Override individual settings explicitly if you must."""

from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"

    # Empty string => in-memory registry (no Redis needed for local dev/tests).
    redis_url: str = ""

    # Empty string => in-memory audit chain (no Postgres needed for local dev).
    database_url: str = ""

    circuit_keys_dir: str = str(
        Path(__file__).resolve().parent.parent / "circuits" / "keys"
    )

    # Whether verifiers must present a registered API key. None => on in
    # production, off elsewhere (so the local demo works out of the box).
    require_api_key: bool | None = None

    # Serve /docs, /redoc and /openapi.json. None => off in production.
    docs_enabled: bool | None = None

    # Seed the publicly documented demo verifiers (demo-bank-key, …).
    # None => only outside production; their keys are public knowledge.
    seed_demo_verifiers: bool | None = None

    # Shared secret for admin-only endpoints (verifier registration), sent as
    # X-Admin-Token. Empty => registration is disabled in production and open
    # only in local development. Inject from a secret manager; never commit it.
    admin_token: str = ""

    # API keys older than this stop working (rotate via
    # POST /v1/verifiers/{id}/rotate-key). 0 disables expiry.
    api_key_max_age_days: int = 90

    # Failed authentication attempts per client IP before a lockout, and the
    # window they're counted over (the lockout lasts the rest of the window).
    auth_failure_limit: int = 5
    auth_failure_window_seconds: int = 900

    # Requests per client per window (sliding window; per API key when one is
    # presented, else per client IP).
    rate_limit_requests: int = 120
    rate_limit_window_seconds: int = 60

    # Maximum request body. A batch of 100 proofs is well under this.
    max_body_bytes: int = 1_000_000

    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://zkgate.net",
        "https://www.zkgate.net",
        "https://zkgate.in",
        "https://verifier.zkgate.in",
    ]

    # ── derived ──────────────────────────────────────────────────────────
    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"production", "prod"}

    @property
    def api_key_required(self) -> bool:
        return self.is_production if self.require_api_key is None else self.require_api_key

    @property
    def docs_on(self) -> bool:
        return (not self.is_production) if self.docs_enabled is None else self.docs_enabled

    @property
    def seed_demo(self) -> bool:
        return (not self.is_production) if self.seed_demo_verifiers is None else self.seed_demo_verifiers


settings = Settings()
