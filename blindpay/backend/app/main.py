"""
BlindPay API.

    uvicorn app.main:app --port 8010

The web app proxies /api/* to this service, so browsers talk to one origin
(no CORS needed) and session cookies stay SameSite=Strict.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.db import init_db
from app.routers import auth, company, requests, webhooks
from app.security import SecurityMiddleware, error_payload

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("blindpay")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.require_production_secrets()
    init_db()
    logger.info("BlindPay API up (%s)", settings.environment)
    yield


docs = not settings.is_production
app = FastAPI(
    title="BlindPay API", lifespan=lifespan,
    docs_url="/docs" if docs else None, redoc_url=None, openapi_url="/openapi.json" if docs else None,
)
app.add_middleware(SecurityMiddleware)

for r in (auth.router, company.router, requests.router, webhooks.router):
    app.include_router(r, prefix="/v1")


@app.get("/health")
def health():
    return {"status": "ok"}


def _rid(request: Request) -> str | None:
    return request.scope.get("state", {}).get("request_id")


def _error(request: Request, status: int, message: str, headers=None) -> JSONResponse:
    return JSONResponse(status_code=status, content=error_payload(status, message, _rid(request)), headers=headers)


@app.exception_handler(StarletteHTTPException)
async def _http_error(request: Request, exc: StarletteHTTPException):
    return _error(request, exc.status_code, str(exc.detail), getattr(exc, "headers", None))


@app.exception_handler(RequestValidationError)
async def _validation_error(request: Request, exc: RequestValidationError):
    problems = [f"{'.'.join(str(p) for p in e.get('loc', ()) if p != 'body')}: {e.get('msg', 'invalid')}"
                for e in exc.errors()[:5]]
    return _error(request, 422, "invalid request: " + "; ".join(problems))


@app.exception_handler(Exception)
async def _unhandled(request: Request, exc: Exception):  # pragma: no cover
    logger.exception("unhandled error rid=%s path=%s", _rid(request), request.url.path)
    return _error(request, 500, "internal error")
