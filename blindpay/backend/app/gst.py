"""
GSTIN validation and input-tax-credit (ITC) eligibility.

A GSTIN is 15 characters: 2-digit state code, 10-character PAN, entity number,
'Z', and a check character computed over the first 14 (base-36, weights 1,2).
ITC on a business expense needs a tax invoice billed to the company's own
GSTIN; an invoice in an employee's name doesn't qualify. Confirm the
operational rules with a CA before relying on the flag.
"""

from __future__ import annotations

import re

_ALNUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
_FORMAT = re.compile(r"^(0[1-9]|[1-3][0-9])[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")


def gstin_checksum(first14: str) -> str:
    total = 0
    for i, ch in enumerate(first14):
        product = _ALNUM.index(ch) * (1 if i % 2 == 0 else 2)
        total += product // 36 + product % 36
    return _ALNUM[(36 - total % 36) % 36]


def is_valid_gstin(gstin: str | None) -> bool:
    if not gstin:
        return False
    g = gstin.strip().upper()
    return bool(_FORMAT.match(g)) and gstin_checksum(g[:14]) == g[14]


def normalise_gstin(gstin: str | None) -> str | None:
    if not gstin:
        return None
    g = re.sub(r"\s", "", gstin).upper()
    return g if is_valid_gstin(g) else None


def itc_eligible(company_gstin: str | None, billed_to_gstin: str | None, vendor_gstin: str | None, gst_paise: int | None) -> bool:
    """Eligible only if a GST-registered vendor billed the company's own GSTIN with tax charged."""
    return bool(
        company_gstin and billed_to_gstin and vendor_gstin
        and is_valid_gstin(vendor_gstin)
        and billed_to_gstin.upper() == company_gstin.upper()
        and gst_paise and gst_paise > 0
    )
