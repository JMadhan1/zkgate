"""
Authentication and authorisation dependencies.

* Owners and approvers sign in with a single-use, 15-minute link sent to their
  own WhatsApp number (no passwords exist). The link carries the token in the
  URL fragment; the web app POSTs it to /v1/auth/session.
* A session is a 256-bit random token in an HttpOnly, Secure, SameSite=Strict
  cookie. Only its SHA-256 is stored. Sessions expire after 30 idle minutes or
  12 hours, whichever is first.
* State-changing requests must also send X-CSRF-Token, which must match the
  session's CSRF token (double defence with SameSite=Strict).
* Every failure answers the standard 404, so probing can't tell a protected
  route from a missing one. Failed attempts per IP are throttled.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.crypto import constant_time_equal, token_hash
from app.db import get_db
from app.models import AuthSession, Company, Member, utcnow
from app.security import SlidingWindowLimiter
from app.security_log import client_ip, security_event

SESSION_COOKIE = "bp_session"
auth_failures = SlidingWindowLimiter(settings.auth_failure_limit, settings.auth_failure_window_seconds)


def not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="Not Found")


def check_lockout(request: Request, action: str) -> None:
    retry = auth_failures.blocked(client_ip(request))
    if retry is not None:
        security_event(action, "locked_out", request=request, level=30)
        raise HTTPException(429, "too many failed attempts; try again later", headers={"Retry-After": str(int(retry) + 1)})


def record_failure(request: Request, action: str, **fields) -> None:
    auth_failures.hit(client_ip(request))
    security_event(action, "failure", request=request, level=30, **fields)


def _aware(dt):
    return dt if dt.tzinfo else dt.replace(tzinfo=utcnow().tzinfo)


@dataclass
class Caller:
    member: Member
    company: Company
    session: AuthSession


def current(request: Request, db: Session = Depends(get_db)) -> Caller:
    check_lockout(request, "auth.session")
    token = request.cookies.get(SESSION_COOKIE)
    row = db.get(AuthSession, token_hash(token)) if token else None
    now = utcnow()
    if row is None or row.revoked:
        if token:
            record_failure(request, "auth.session", reason="unknown")
        raise not_found()
    if now - _aware(row.last_seen_at) > timedelta(minutes=settings.session_idle_minutes) or \
            now - _aware(row.created_at) > timedelta(hours=settings.session_absolute_hours):
        row.revoked = True
        db.commit()
        raise not_found()
    member = db.get(Member, row.member_id)
    if member is None or not member.active or member.role not in ("owner", "approver"):
        raise not_found()
    row.last_seen_at = now
    db.commit()
    return Caller(member=member, company=db.get(Company, member.company_id), session=row)


def mutating(request: Request, caller: Caller = Depends(current),
             x_csrf_token: str | None = Header(default=None, alias="X-CSRF-Token")) -> Caller:
    if not x_csrf_token or not constant_time_equal(x_csrf_token, caller.session.csrf_token):
        record_failure(request, "auth.csrf")
        raise not_found()
    return caller


def owner_only(caller: Caller = Depends(mutating)) -> Caller:
    if caller.member.role != "owner":
        raise not_found()
    return caller


def require_admin(request: Request, x_admin_token: str | None = Header(default=None, alias="X-Admin-Token")) -> None:
    check_lockout(request, "auth.admin")
    if settings.admin_token:
        if x_admin_token and constant_time_equal(x_admin_token, settings.admin_token):
            security_event("auth.admin", "success", request=request, actor="admin")
            return
        record_failure(request, "auth.admin")
        raise not_found()
    if settings.is_production:
        record_failure(request, "auth.admin", reason="disabled")
        raise not_found()
    security_event("auth.admin", "success", request=request, actor="admin", mode="dev-open")
