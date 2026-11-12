"""
BlindPay configuration, read from the environment.

Development works with no setup; ENVIRONMENT=production flips every default to
the restrictive option and refuses to start without the secrets it needs.
Secrets come from the environment, which in production must be populated by a
secret manager at runtime. They are never committed (see .env.example).
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="BLINDPAY_", extra="ignore")

    environment: str = "development"

    # SQLite for development; Postgres (with sslmode=require) in production.
    database_url: str = "sqlite:///./blindpay-dev.db"

    # Public URL of the web app, used to build approval and login links.
    public_base_url: str = "http://localhost:3002"

    # 32-byte AES-256-GCM key, base64. Encrypts spending limits at rest.
    # Required in production; development keeps a local key file instead.
    encryption_key: str = ""
    dev_key_file: str = ".blindpay-dev.key"

    # Admin token for creating companies (self-registration is disabled).
    admin_token: str = ""

    # ── WhatsApp Cloud API ───────────────────────────────────────────────
    whatsapp_app_secret: str = ""      # verifies X-Hub-Signature-256 on webhooks
    whatsapp_verify_token: str = ""    # Meta's webhook subscription handshake
    whatsapp_access_token: str = ""    # Graph API bearer token
    whatsapp_phone_number_id: str = ""
    whatsapp_api_base: str = "https://graph.facebook.com/v23.0"

    # ── RazorpayX (payouts) and Razorpay (subscriptions) ────────────────
    razorpayx_key_id: str = ""
    razorpayx_key_secret: str = ""
    razorpayx_account_number: str = ""
    razorpayx_webhook_secret: str = ""
    razorpay_webhook_secret: str = ""
    razorpay_plan_team: str = ""        # Razorpay plan_id for the Team tier
    razorpay_plan_business: str = ""    # Razorpay plan_id for the Business tier

    # ── Sessions and abuse limits ────────────────────────────────────────
    session_idle_minutes: int = 30
    session_absolute_hours: int = 12
    login_link_minutes: int = 15
    approval_link_minutes: int = 15
    auth_failure_limit: int = 5
    auth_failure_window_seconds: int = 900
    rate_limit_requests: int = 120
    rate_limit_window_seconds: int = 60
    max_body_bytes: int = 1_000_000

    # Policy
    limit_band_paise: int = 50_000          # limits are rounded down to ₹500 bands
    probe_alert_declines: int = 3           # declines per member per month before the owner is alerted
    free_requests_per_month: int = 30

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"production", "prod"}

    def require_production_secrets(self) -> None:
        if not self.is_production:
            return
        missing = [
            name for name in (
                "encryption_key", "admin_token", "whatsapp_app_secret", "whatsapp_verify_token",
                "whatsapp_access_token", "whatsapp_phone_number_id", "razorpayx_key_id",
                "razorpayx_key_secret", "razorpayx_account_number", "razorpayx_webhook_secret",
                "razorpay_webhook_secret",
            ) if not getattr(self, name)
        ]
        if missing:
            raise RuntimeError(f"missing production settings: {', '.join(missing)}")
        if not self.public_base_url.startswith("https://"):
            raise RuntimeError("public_base_url must be https in production")
        if self.database_url.startswith("sqlite"):
            raise RuntimeError("use Postgres in production")


settings = Settings()

PLAN_SEATS = {"free": 3, "team": 15, "business": 50}
