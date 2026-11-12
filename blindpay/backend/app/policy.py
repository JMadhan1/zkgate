"""
Spending policy: storage and evaluation.

A policy is a small JSON document, encrypted at rest (app/crypto.py):

    {"monthly_limit_paise": 1500000,          # required, rounded down to a ₹500 band
     "per_request_cap_paise": 500000,         # optional
     "categories": {"travel": 800000, ...},   # optional monthly cap per category;
                                              # if present, unlisted categories are refused
     "auto_approve_under_paise": 50000}       # optional: no owner tap needed below this

Evaluation never reveals a number. A decline names the rule ("monthly_limit"),
so the employee learns *that* a limit was hit, not *where* it is. Because each
answer still leaks one bit, the owner is alerted once a member collects
`probe_alert_declines` declines in a month (binary search needs ~14–20 tries).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.crypto import decrypt_json, encrypt_json
from app.models import Policy, SpendRequest, utcnow

IST = ZoneInfo("Asia/Kolkata")
COUNTED_STATUSES = ("pending_approval", "approved", "paid")
CATEGORIES = ("travel", "meals", "supplies", "client", "telecom", "other")
MAX_LIMIT_PAISE = 1_00_00_000 * 100  # ₹1 crore a month: bounds integer input


class PolicyError(ValueError):
    pass


def _band(paise: int) -> int:
    return (paise // settings.limit_band_paise) * settings.limit_band_paise


def _check_amount(name: str, value, *, allow_zero: bool = False) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise PolicyError(f"{name} must be an integer number of paise")
    if value < 0 or value > MAX_LIMIT_PAISE or (value == 0 and not allow_zero):
        raise PolicyError(f"{name} is out of range")
    return value


def normalise_policy(raw: dict) -> dict:
    """Validate and band a policy before it is encrypted."""
    out: dict = {"monthly_limit_paise": _band(_check_amount("monthly_limit_paise", raw.get("monthly_limit_paise")))}
    if out["monthly_limit_paise"] == 0:
        raise PolicyError(f"monthly_limit_paise must be at least one band ({settings.limit_band_paise} paise)")
    if raw.get("per_request_cap_paise") is not None:
        out["per_request_cap_paise"] = _check_amount("per_request_cap_paise", raw["per_request_cap_paise"])
    if raw.get("auto_approve_under_paise") is not None:
        out["auto_approve_under_paise"] = _check_amount("auto_approve_under_paise", raw["auto_approve_under_paise"], allow_zero=True)
    cats = raw.get("categories")
    if cats is not None:
        if not isinstance(cats, dict) or not cats:
            raise PolicyError("categories must be a non-empty object")
        clean = {}
        for k, v in cats.items():
            if k not in CATEGORIES:
                raise PolicyError(f"unknown category: {k}")
            clean[k] = _band(_check_amount(f"categories.{k}", v))
        out["categories"] = clean
    return out


def set_policy(db: Session, company_id: str, member_id: str, raw: dict) -> int:
    pol = normalise_policy(raw)
    blob = encrypt_json(pol, company_id, member_id)
    row = db.get(Policy, member_id)
    if row is None:
        row = Policy(member_id=member_id, company_id=company_id, ciphertext=blob, version=1)
        db.add(row)
    else:
        if row.company_id != company_id:
            raise PolicyError("policy belongs to another company")
        row.ciphertext = blob
        row.version += 1
        row.updated_at = utcnow()
    return row.version


def get_policy(db: Session, company_id: str, member_id: str) -> dict | None:
    row = db.get(Policy, member_id)
    if row is None or row.company_id != company_id:
        return None
    return decrypt_json(row.ciphertext, company_id, member_id)


def month_bounds(now: datetime | None = None) -> tuple[datetime, datetime]:
    """Start and end of the current calendar month in IST, as UTC datetimes."""
    now = (now or datetime.now(timezone.utc)).astimezone(IST)
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    nxt = start.replace(year=start.year + 1, month=1) if start.month == 12 else start.replace(month=start.month + 1)
    return start.astimezone(timezone.utc), nxt.astimezone(timezone.utc)


def spent_this_month(db: Session, company_id: str, member_id: str, category: str | None = None,
                     now: datetime | None = None, exclude_request: str | None = None) -> int:
    start, end = month_bounds(now)
    q = select(func.coalesce(func.sum(SpendRequest.amount_paise), 0)).where(
        SpendRequest.company_id == company_id,
        SpendRequest.member_id == member_id,
        SpendRequest.status.in_(COUNTED_STATUSES),
        SpendRequest.created_at >= start,
        SpendRequest.created_at < end,
    )
    if category:
        q = q.where(SpendRequest.category == category)
    if exclude_request:
        q = q.where(SpendRequest.id != exclude_request)
    return int(db.execute(q).scalar_one())


def declines_this_month(db: Session, company_id: str, member_id: str, now: datetime | None = None) -> int:
    start, end = month_bounds(now)
    return int(db.execute(
        select(func.count()).select_from(SpendRequest).where(
            SpendRequest.company_id == company_id,
            SpendRequest.member_id == member_id,
            SpendRequest.status == "declined",
            SpendRequest.decline_rule.is_not(None),
            SpendRequest.created_at >= start,
            SpendRequest.created_at < end,
        )
    ).scalar_one())


@dataclass
class Decision:
    allowed: bool
    rule: str | None = None          # which rule declined it; never a number
    auto_approve: bool = False
    has_policy: bool = True


def evaluate(db: Session, company_id: str, member_id: str, amount_paise: int, category: str,
             now: datetime | None = None, exclude_request: str | None = None) -> Decision:
    pol = get_policy(db, company_id, member_id)
    if pol is None:
        # No policy yet: nothing to check automatically; the owner decides.
        return Decision(allowed=True, has_policy=False)
    cap = pol.get("per_request_cap_paise")
    if cap is not None and amount_paise > cap:
        return Decision(False, "per_request_cap")
    cats = pol.get("categories")
    if cats is not None:
        if category not in cats:
            return Decision(False, "category_not_allowed")
        used = spent_this_month(db, company_id, member_id, category, now, exclude_request)
        if used + amount_paise > cats[category]:
            return Decision(False, "category_limit")
    used = spent_this_month(db, company_id, member_id, None, now, exclude_request)
    if used + amount_paise > pol["monthly_limit_paise"]:
        return Decision(False, "monthly_limit")
    auto = pol.get("auto_approve_under_paise")
    return Decision(True, auto_approve=bool(auto) and amount_paise < auto)


DECLINE_MESSAGES = {
    "per_request_cap": "this is above the per-request amount your company allows",
    "category_not_allowed": "this category isn't covered by your company's policy",
    "category_limit": "it would exceed this month's policy for this category",
    "monthly_limit": "it would exceed this month's policy",
    "owner_declined": "your approver declined it",
}
