"""
ZKGate India — Verification API

Verifies zero-knowledge proofs from citizens and returns named claims. No
personal data is accepted, computed or stored: the only citizen-derived value
that touches this server is an anonymous nullifier.

    uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from config import settings
from routers import claims, health, nullifiers, verifiers, verify
from security import SecurityMiddleware, error_payload

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("zkgate")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fail fast if the circuit keys are not loadable — a verifier that cannot
    # verify should not report itself healthy.
    from services.proof_verifier import get_layout

    layout = get_layout()
    logger.info("ZKGate India API up. Circuits: %s", list(layout._circuits))
    logger.info("Nullifier backend: %s", settings.redis_url or "in-memory")
    logger.info("Zero personal data will be stored.")
    yield


app = FastAPI(
    lifespan=lifespan,
    title="ZKGate India API",
    version="1.0.0",
    description=(
        "Zero-Knowledge identity verification for India.\n\n"
        "Citizens prove facts about themselves (age, residency, citizenship, PAN) "
        "using cryptographic proofs generated on their own devices. This API "
        "checks those proofs and returns only the claim — never any personal data. "
        "Even a full breach of this service reveals nothing about any citizen, "
        "because nothing about any citizen is stored."
    ),
    # API docs are an attack-surface map; they are off in production.
    docs_url="/docs" if settings.docs_on else None,
    redoc_url="/redoc" if settings.docs_on else None,
    openapi_url="/openapi.json" if settings.docs_on else None,
)


@app.middleware("http")
async def timing(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Process-Time-Ms"] = f"{(time.perf_counter() - start) * 1000:.1f}"
    return response


# Order matters: the last middleware added is the outermost. Security limits run
# before routing; CORS wraps everything so even 413/415/429 answers are readable
# by the allowed browser origins.
app.add_middleware(SecurityMiddleware)
app.add_middleware(
    CORSMiddleware,
    # Strict allowlist — never "*", never a reflected Origin.
    allow_origins=[o for o in settings.cors_origins if o != "*"],
    # Auth is an X-API-Key header, never a cookie, so credentials stay off.
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-API-Key", "X-Admin-Token"],
    expose_headers=["X-Request-ID", "Retry-After"],
    max_age=600,
)


app.include_router(health.router, tags=["Health"])
app.include_router(verify.router, prefix="/v1", tags=["Verification"])
app.include_router(nullifiers.router, prefix="/v1", tags=["Nullifiers"])
app.include_router(claims.router, prefix="/v1", tags=["Claims"])
app.include_router(verifiers.router, prefix="/v1", tags=["Verifiers"])


# ── One error shape for every status; no stack traces or internals ────────

def _rid(request: Request) -> str | None:
    return request.scope.get("state", {}).get("request_id")


def _error(request: Request, status: int, message: str, headers=None) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content=error_payload(status, message, _rid(request)),
        headers=headers,
    )


@app.exception_handler(StarletteHTTPException)
async def _http_error(request: Request, exc: StarletteHTTPException):
    return _error(request, exc.status_code, str(exc.detail), getattr(exc, "headers", None))


@app.exception_handler(RequestValidationError)
async def _validation_error(request: Request, exc: RequestValidationError):
    # Field paths and reasons only — never echo the submitted values back.
    problems = [
        f"{'.'.join(str(p) for p in e.get('loc', ()) if p != 'body')}: {e.get('msg', 'invalid')}"
        for e in exc.errors()[:5]
    ]
    return _error(request, 422, "invalid request: " + "; ".join(problems))


@app.exception_handler(Exception)
async def _unhandled(request: Request, exc: Exception):  # pragma: no cover
    # Full detail goes to the server log (with the request id), never the client.
    logger.exception("unhandled error rid=%s path=%s", _rid(request), request.url.path)
    return _error(request, 500, "internal error")
