"""Companies (admin-created), members and their encrypted policies. All tenant-scoped."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import audit, notify, proofs
from app.config import PLAN_SEATS
from app.db import get_db
from app.deps import Caller, current, not_found, owner_only, require_admin
from app.gst import normalise_gstin
from app.lifecycle import seats_available
from app.models import Company, Member
from app.policy import PolicyError, get_policy, set_policy
from app.schemas import CompanyIn, CompanyPatch, MemberIn, MemberPatch, PolicyIn
from app.security_log import security_event

router = APIRouter()
UUID = r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"


def _member_out(m: Member) -> dict:
    return {"id": m.id, "name": m.name, "phone_last4": m.phone[-4:], "role": m.role, "grade": m.grade,
            "active": m.active, "consented": m.consent_at is not None, "has_upi": bool(m.upi_vpa)}


def _phone_taken(db: Session, phone: str) -> bool:
    return db.execute(select(Member.id).where(Member.phone == phone)).first() is not None


@router.post("/admin/companies", dependencies=[Depends(require_admin)], status_code=201)
def create_company(body: CompanyIn, request: Request, db: Session = Depends(get_db)):
    gstin = normalise_gstin(body.gstin) if body.gstin else None
    if body.gstin and not gstin:
        raise HTTPException(422, "invalid GSTIN")
    if _phone_taken(db, body.owner_phone):
        raise HTTPException(409, "that phone number is already registered")
    c = Company(name=body.name, gstin=gstin, plan=body.plan)
    db.add(c)
    db.flush()
    owner = Member(company_id=c.id, name=body.owner_name, phone=body.owner_phone, role="owner")
    db.add(owner)
    db.flush()
    audit.record(db, c.id, "admin", "company.created", f"company:{c.id}", {"plan": body.plan})
    security_event("admin.company.create", "success", request=request, actor="admin", resource=f"company:{c.id}")
    notify.template(db, c.id, owner.phone, "blindpay_consent_request", [c.name])
    db.commit()
    return {"company_id": c.id, "owner_id": owner.id}


@router.patch("/company")
def patch_company(body: CompanyPatch, caller: Caller = Depends(owner_only), db: Session = Depends(get_db)):
    c = db.get(Company, caller.company.id)
    if body.gstin is not None:
        g = normalise_gstin(body.gstin)
        if not g:
            raise HTTPException(422, "invalid GSTIN")
        c.gstin = g
    if body.tally_payment_ledger is not None:
        c.tally_payment_ledger = body.tally_payment_ledger
    audit.record(db, c.id, f"member:{caller.member.id}", "company.updated", f"company:{c.id}")
    db.commit()
    return {"gstin": c.gstin, "tally_payment_ledger": c.tally_payment_ledger}


@router.get("/members")
def list_members(caller: Caller = Depends(current), db: Session = Depends(get_db)):
    rows = db.execute(select(Member).where(Member.company_id == caller.company.id).order_by(Member.created_at)).scalars()
    return {"members": [_member_out(m) for m in rows], "seats": PLAN_SEATS.get(caller.company.plan, 3)}


@router.post("/members", status_code=201)
def add_member(body: MemberIn, caller: Caller = Depends(owner_only), db: Session = Depends(get_db)):
    if seats_available(db, caller.company) <= 0:
        raise HTTPException(402, "your plan has no free seats; upgrade to add members")
    if _phone_taken(db, body.phone):
        raise HTTPException(409, "that phone number is already registered")
    m = Member(company_id=caller.company.id, name=body.name, phone=body.phone, role=body.role, grade=body.grade)
    db.add(m)
    db.flush()
    audit.record(db, caller.company.id, f"member:{caller.member.id}", "member.added", f"member:{m.id}", {"role": m.role})
    notify.template(db, caller.company.id, m.phone, "blindpay_consent_request", [caller.company.name])
    db.commit()
    return _member_out(m)


def _own_member(db: Session, caller: Caller, member_id: str) -> Member:
    m = db.get(Member, member_id)
    if m is None or m.company_id != caller.company.id:
        raise not_found()  # another tenant's member looks exactly like a missing one
    return m


@router.patch("/members/{member_id}")
def patch_member(body: MemberPatch, member_id: str = Path(pattern=UUID),
                 caller: Caller = Depends(owner_only), db: Session = Depends(get_db)):
    m = _own_member(db, caller, member_id)
    if m.role == "owner":
        raise HTTPException(422, "the owner can't be changed here")
    if body.active is not None:
        if body.active and not m.active and seats_available(db, caller.company) <= 0:
            raise HTTPException(402, "your plan has no free seats")
        m.active = body.active
    if body.role is not None:
        m.role = body.role
    if body.grade is not None:
        m.grade = body.grade
    audit.record(db, caller.company.id, f"member:{caller.member.id}", "member.updated", f"member:{m.id}",
                 {"active": m.active, "role": m.role})
    db.commit()
    return _member_out(m)


@router.put("/members/{member_id}/policy")
def put_policy(body: PolicyIn, member_id: str = Path(pattern=UUID),
               caller: Caller = Depends(owner_only), db: Session = Depends(get_db)):
    m = _own_member(db, caller, member_id)
    try:
        version = set_policy(db, caller.company.id, m.id, body.model_dump(exclude_none=True))
    except PolicyError as exc:
        raise HTTPException(422, str(exc)) from None
    # The audit records that the policy changed and its version, never its numbers.
    proofs.commit_policy(db, caller.company.id, m.id)  # logged before any spend can use it
    audit.record(db, caller.company.id, f"member:{caller.member.id}", "policy.updated", f"member:{m.id}", {"version": version})
    db.commit()
    return {"member_id": m.id, "version": version}


@router.get("/members/{member_id}/policy")
def read_policy(member_id: str = Path(pattern=UUID), caller: Caller = Depends(current), db: Session = Depends(get_db)):
    if caller.member.role != "owner":
        raise not_found()  # approvers decide requests but never see limits
    m = _own_member(db, caller, member_id)
    pol = get_policy(db, caller.company.id, m.id)
    return {"member_id": m.id, "policy": pol}
