"""Request bodies. Explicit fields only; unknown fields are rejected (no mass assignment)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

PHONE = r"^91[6-9][0-9]{9}$"         # Indian mobile, E.164 without '+'
NAME = r"^[^\x00-\x1f<>]{1,80}$"


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class LoginLinkIn(Strict):
    phone: str = Field(pattern=PHONE)


class SessionIn(Strict):
    token: str = Field(min_length=20, max_length=80, pattern=r"^bp_[A-Za-z0-9_-]+$")


class CompanyIn(Strict):
    name: str = Field(pattern=NAME)
    gstin: str | None = Field(default=None, min_length=15, max_length=15)
    owner_name: str = Field(pattern=NAME)
    owner_phone: str = Field(pattern=PHONE)
    plan: Literal["free", "team", "business"] = "free"


class MemberIn(Strict):
    name: str = Field(pattern=NAME)
    phone: str = Field(pattern=PHONE)
    role: Literal["employee", "approver"] = "employee"
    grade: str | None = Field(default=None, max_length=32, pattern=r"^[A-Za-z0-9 _-]{1,32}$")


class MemberPatch(Strict):
    active: bool | None = None
    role: Literal["employee", "approver"] | None = None
    grade: str | None = Field(default=None, max_length=32, pattern=r"^[A-Za-z0-9 _-]{1,32}$")


class PolicyIn(Strict):
    monthly_limit_paise: int = Field(ge=1, le=10**11)
    per_request_cap_paise: int | None = Field(default=None, ge=1, le=10**11)
    auto_approve_under_paise: int | None = Field(default=None, ge=0, le=10**11)
    categories: dict[Literal["travel", "meals", "supplies", "client", "telecom", "other"], int] | None = None


class DecisionIn(Strict):
    decision: Literal["approve", "decline"]


class TokenDecisionIn(Strict):
    token: str = Field(min_length=20, max_length=80, pattern=r"^bp_[A-Za-z0-9_-]+$")
    decision: Literal["approve", "decline"] | None = None


class CompanyPatch(Strict):
    gstin: str | None = Field(default=None, min_length=15, max_length=15)
    tally_payment_ledger: str | None = Field(default=None, pattern=r"^[A-Za-z0-9 &().,_-]{1,80}$")


class SubscribeIn(Strict):
    plan: Literal["team", "business"]
