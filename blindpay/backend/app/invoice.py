"""
One claim per invoice.

The nullifier is a keyed hash of the invoice's identity (vendor GSTIN, invoice
number, amount), scoped to the company. GST rules make a vendor's invoice
numbers unique within a financial year, so these three identify one bill; the
date is deliberately left out because employees don't type it reliably. A unique constraint on
(company_id, invoice_nullifier) makes the same bill impossible to claim twice,
even by two different employees. Keying it per company means the stored value
can't be matched across companies.
"""

from __future__ import annotations

import hashlib
import hmac
import re


def _norm_invoice_no(s: str) -> str:
    return re.sub(r"[^0-9A-Z]", "", s.upper())


def invoice_nullifier(company_id: str, vendor_gstin: str, invoice_number: str, amount_paise: int) -> str:
    material = "|".join([vendor_gstin.upper(), _norm_invoice_no(invoice_number), str(amount_paise)])
    return hmac.new(f"blindpay:invoice:{company_id}".encode(), material.encode(), hashlib.sha256).hexdigest()
