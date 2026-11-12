"""Sign-in by WhatsApp link, sessions, sign-out."""

from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import audit, notify
from app.config import settings
from app.crypto import new_token, token_hash
from app.db import get_db
from app.deps import SESSION_COOKIE, Caller, check_lockout, current, mutating, not_found, record_failure
from app.models import AuthSession, LoginLink, Member, utcnow
from app.schemas import LoginLinkIn, SessionIn
from app.security import SlidingWindowLimiter
from app.security_log import client_ip, security_event

router = APIRouter()
# 5 link requests per phone per 15 minutes (per account, not just per IP).
_link_limiter = SlidingWindowLimiter(5, 900)

GENERIC = {"status": "If that number belongs to an owner or approver, a sign-in link is on its way on WhatsApp."}


@router.post("/auth/login-link", status_code=202)
def login_link(body: LoginLinkIn, request: Request, db: Session = Depends(get_db)):
    check_lockout(request, "auth.login_link")
    if _link_limiter.hit("phone:" + token_hash(body.phone)) is not None or \
            _link_limiter.hit("ip:" + client_ip(request)) is not None:
        security_event("auth.login_link", "rate_limited", request=request, level=30)
        return GENERIC  # identical answer either way
    member = db.execute(select(Member).where(Member.phone == body.phone)).scalar_one_or_none()
    if member and member.active and member.role in ("owner", "approver"):
        token = new_token()
        db.add(LoginLink(token_hash=token_hash(token), member_id=member.id,
                         expires_at=utcnow() + timedelta(minutes=settings.login_link_minutes)))
        notify.template(db, member.company_id, member.phone, "blindpay_login_link",
                        [f"{settings.public_base_url}/login#{token}"])
        security_event("auth.login_link", "sent", request=request, actor=member.id)
        db.commit()
    else:
        security_event("auth.login_link", "no_match", request=request)
    return GENERIC


@router.post("/auth/session")
def create_session(body: SessionIn, request: Request, response: Response, db: Session = Depends(get_db)):
    check_lockout(request, "auth.login")
    link = db.get(LoginLink, token_hash(body.token))
    now = utcnow()
    expires = link.expires_at if link and link.expires_at.tzinfo else (link.expires_at.replace(tzinfo=now.tzinfo) if link else None)
    if link is None or link.used or expires < now:
        record_failure(request, "auth.login", reason="bad_link")
        raise not_found()
    link.used = True
    member = db.get(Member, link.member_id)
    if member is None or not member.active or member.role not in ("owner", "approver"):
        record_failure(request, "auth.login", reason="inactive")
        db.commit()
        raise not_found()
    token = new_token()
    db.add(AuthSession(token_hash=token_hash(token), member_id=member.id, company_id=member.company_id,
                       csrf_token=new_token()))
    audit.record(db, member.company_id, f"member:{member.id}", "auth.login", f"member:{member.id}")
    security_event("auth.login", "success", request=request, actor=member.id)
    db.commit()
    response.set_cookie(SESSION_COOKIE, token, httponly=True, secure=True, samesite="strict",
                        max_age=settings.session_absolute_hours * 3600, path="/")
    return {"status": "signed_in"}


@router.get("/session")
def session_info(caller: Caller = Depends(current)):
    m, c = caller.member, caller.company
    return {
        "member": {"id": m.id, "name": m.name, "role": m.role},
        "company": {"id": c.id, "name": c.name, "gstin": c.gstin, "plan": c.plan, "plan_status": c.plan_status},
        "csrf_token": caller.session.csrf_token,
    }


@router.post("/auth/logout")
def logout(response: Response, caller: Caller = Depends(mutating), db: Session = Depends(get_db)):
    row = db.get(AuthSession, caller.session.token_hash)
    row.revoked = True
    db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/", secure=True, httponly=True, samesite="strict")
    return {"status": "signed_out"}
