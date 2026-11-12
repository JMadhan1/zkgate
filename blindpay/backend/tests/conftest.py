"""Test setup: a fresh SQLite database per test, fake providers, reset limiters."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

_tmp = Path(tempfile.mkdtemp(prefix="blindpay-test-"))
os.environ["BLINDPAY_DATABASE_URL"] = f"sqlite:///{_tmp / 'test.db'}"
os.environ["BLINDPAY_DEV_KEY_FILE"] = str(_tmp / "dev.key")
os.environ["BLINDPAY_PUBLIC_BASE_URL"] = "https://app.blindpay.test"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import providers as prov  # noqa: E402
from app.db import Base, engine  # noqa: E402

COMPANY_GSTIN = "29AAACB1234C1ZB"   # fictitious, checksum-valid
VENDOR_GSTIN = "29ABCDE1234F1ZW"    # fictitious, checksum-valid
OWNER = "919800000001"
EMP = "919800000002"
APPROVER = "919800000003"


@pytest.fixture(autouse=True)
def fresh():
    from app import deps
    from app.routers import auth as auth_router
    from app.security import limiter

    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    prov.providers.whatsapp = prov.FakeWhatsApp()
    prov.providers.payouts = prov.FakeRazorpayX()
    prov.providers.billing = prov.FakeBilling()
    for lim in (limiter, deps.auth_failures, auth_router._link_limiter):
        lim.reset()
    yield


@pytest.fixture
def client():
    from app.main import app

    with TestClient(app, base_url="https://testserver") as c:
        yield c


@pytest.fixture
def wa():
    return prov.providers.whatsapp


@pytest.fixture
def rzpx():
    return prov.providers.payouts
