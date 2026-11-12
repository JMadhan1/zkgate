"""
BlindPay data model.

Every tenant-owned row carries company_id, and every query in the routers
filters on the caller's company (see app/deps.py). Ids are UUIDv4 strings.
Spending policies are stored only as AES-GCM ciphertext; there is no
plaintext limit column anywhere.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON, Boolean, DateTime, ForeignKey, Integer, LargeBinary, String, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(120))
    gstin: Mapped[str | None] = mapped_column(String(15), nullable=True)
    plan: Mapped[str] = mapped_column(String(16), default="free")          # free | team | business
    plan_status: Mapped[str] = mapped_column(String(16), default="active")  # active | halted | cancelled
    razorpay_subscription_id: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)
    tally_payment_ledger: Mapped[str] = mapped_column(String(80), default="RazorpayX")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Member(Base):
    __tablename__ = "members"
    __table_args__ = (UniqueConstraint("phone", name="uq_member_phone"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    # E.164 without '+', as WhatsApp reports it. One active company per phone,
    # so an inbound WhatsApp message maps to exactly one member.
    phone: Mapped[str] = mapped_column(String(16))
    role: Mapped[str] = mapped_column(String(16), default="employee")   # owner | approver | employee
    grade: Mapped[str | None] = mapped_column(String(32), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    upi_vpa: Mapped[str | None] = mapped_column(String(64), nullable=True)
    payout_contact_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    payout_fund_account_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Policy(Base):
    """A member's spending policy. Only ciphertext is stored."""

    __tablename__ = "policies"

    member_id: Mapped[str] = mapped_column(ForeignKey("members.id"), primary_key=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)
    ciphertext: Mapped[bytes] = mapped_column(LargeBinary)
    version: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SpendRequest(Base):
    __tablename__ = "spend_requests"
    __table_args__ = (UniqueConstraint("company_id", "invoice_nullifier", name="uq_invoice_once"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)
    member_id: Mapped[str] = mapped_column(ForeignKey("members.id"), index=True)
    amount_paise: Mapped[int] = mapped_column(Integer)
    category: Mapped[str] = mapped_column(String(24), default="other")
    description: Mapped[str] = mapped_column(String(280))
    # draft → pending_approval → approved → paid | payout_failed ; or declined
    status: Mapped[str] = mapped_column(String(20), default="pending_approval", index=True)
    decline_rule: Mapped[str | None] = mapped_column(String(48), nullable=True)
    # GST
    vendor_gstin: Mapped[str | None] = mapped_column(String(15), nullable=True)
    invoice_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    invoice_date: Mapped[str | None] = mapped_column(String(10), nullable=True)   # YYYY-MM-DD
    gst_paise: Mapped[int | None] = mapped_column(Integer, nullable=True)
    billed_to_company: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    itc_eligible: Mapped[bool] = mapped_column(Boolean, default=False)
    invoice_media_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    invoice_nullifier: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Approval
    decided_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Phase 2: proof-of-policy
    proof: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class PolicyCommitment(Base):
    """
    Public, hash-chained log of policy commitments (proof-of-policy).

    One entry per (member, period, policy version): Poseidon(limit, salt,
    member_tag, period). The salt is kept encrypted so the company can prove
    against it later; the limit itself is never stored here. Entries are only
    ever appended, so a limit can't be raised after the fact without a new,
    later-timestamped entry that the CA sees.
    """

    __tablename__ = "policy_commitments"
    __table_args__ = (
        UniqueConstraint("company_id", "seq", name="uq_commit_seq"),
        UniqueConstraint("member_id", "period", "version", name="uq_commit_member_period_version"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)
    member_id: Mapped[str] = mapped_column(ForeignKey("members.id"), index=True)
    seq: Mapped[int] = mapped_column(Integer)
    ts: Mapped[str] = mapped_column(String(32))
    member_tag: Mapped[str] = mapped_column(String(80))
    period: Mapped[int] = mapped_column(Integer)          # YYYYMM, IST
    version: Mapped[int] = mapped_column(Integer)         # policy version it commits to
    commitment: Mapped[str] = mapped_column(String(80))
    salt_ciphertext: Mapped[bytes] = mapped_column(LargeBinary)
    prev_hash: Mapped[str] = mapped_column(String(64))
    hash: Mapped[str] = mapped_column(String(64))


class ApprovalLink(Base):
    """One single-use link per approver per request, so every decision names who made it."""

    __tablename__ = "approval_links"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)
    request_id: Mapped[str] = mapped_column(ForeignKey("spend_requests.id"), index=True)
    approver_id: Mapped[str] = mapped_column(ForeignKey("members.id"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used: Mapped[bool] = mapped_column(Boolean, default=False)


class Payout(Base):
    __tablename__ = "payouts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)
    request_id: Mapped[str] = mapped_column(ForeignKey("spend_requests.id"), unique=True)
    idempotency_key: Mapped[str] = mapped_column(String(64), unique=True)
    provider_payout_id: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)
    amount_paise: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="queued")   # queued|processing|processed|failed|reversed
    utr: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AuditEvent(Base):
    """Per-company hash-chained log: editing or deleting history breaks the chain."""

    __tablename__ = "audit_events"
    __table_args__ = (UniqueConstraint("company_id", "seq", name="uq_audit_seq"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)
    seq: Mapped[int] = mapped_column(Integer)
    ts: Mapped[str] = mapped_column(String(32))
    actor: Mapped[str] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(48))
    resource: Mapped[str] = mapped_column(String(80))
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    prev_hash: Mapped[str] = mapped_column(String(64))
    hash: Mapped[str] = mapped_column(String(64))


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    member_id: Mapped[str] = mapped_column(ForeignKey("members.id"), index=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"))
    csrf_token: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)


class LoginLink(Base):
    __tablename__ = "login_links"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    member_id: Mapped[str] = mapped_column(ForeignKey("members.id"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used: Mapped[bool] = mapped_column(Boolean, default=False)


class InboundMessage(Base):
    """WhatsApp message ids already processed (Meta retries deliveries)."""

    __tablename__ = "inbound_messages"

    message_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Draft(Base):
    """A member's in-progress WhatsApp conversation state (one per member)."""

    __tablename__ = "drafts"

    member_id: Mapped[str] = mapped_column(ForeignKey("members.id"), primary_key=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"))
    state: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class OutboundMessage(Base):
    """Every WhatsApp message we send (template name + params), for support and audit."""

    __tablename__ = "outbound_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    company_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    to_phone: Mapped[str] = mapped_column(String(16))
    template: Mapped[str] = mapped_column(String(48))
    params: Mapped[list] = mapped_column(JSON, default=list)
    provider_message_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
