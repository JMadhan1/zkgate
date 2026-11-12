"""
Tally export: paid requests as TallyPrime "Payment" vouchers (XML import).

Each paid request becomes one voucher: debit the expense ledger for its
category, credit the payout ledger (the company's RazorpayX account). Built
with ElementTree, so text from employees is escaped, never concatenated into
markup. Import via TallyPrime: Import > Transactions > XML. Check ledger names
against the company's chart of accounts before the first import.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from collections.abc import Iterable

EXPENSE_LEDGERS = {
    "travel": "Travelling Expenses",
    "meals": "Staff Welfare Expenses",
    "supplies": "Office Expenses",
    "client": "Business Promotion Expenses",
    "telecom": "Telephone Expenses",
    "other": "Miscellaneous Expenses",
}


def _rupees(paise: int) -> str:
    return f"{paise // 100}.{paise % 100:02d}"


def _sub(parent: ET.Element, tag: str, text: str | None = None, **attrs) -> ET.Element:
    el = ET.SubElement(parent, tag, attrs)
    if text is not None:
        el.text = text
    return el


def build_vouchers_xml(company_name: str, payment_ledger: str, rows: Iterable[dict]) -> bytes:
    """rows: dicts with date (YYYYMMDD), number, amount_paise, category, narration."""
    env = ET.Element("ENVELOPE")
    header = _sub(env, "HEADER")
    _sub(header, "TALLYREQUEST", "Import Data")
    body = _sub(env, "BODY")
    imp = _sub(body, "IMPORTDATA")
    desc = _sub(imp, "REQUESTDESC")
    _sub(desc, "REPORTNAME", "Vouchers")
    sv = _sub(desc, "STATICVARIABLES")
    _sub(sv, "SVCURRENTCOMPANY", company_name)
    data = _sub(imp, "REQUESTDATA")
    for r in rows:
        msg = _sub(data, "TALLYMESSAGE")
        v = _sub(msg, "VOUCHER", VCHTYPE="Payment", ACTION="Create")
        _sub(v, "DATE", r["date"])
        _sub(v, "VOUCHERTYPENAME", "Payment")
        _sub(v, "VOUCHERNUMBER", r["number"])
        _sub(v, "NARRATION", r["narration"][:240])
        debit = _sub(v, "ALLLEDGERENTRIES.LIST")
        _sub(debit, "LEDGERNAME", EXPENSE_LEDGERS.get(r["category"], EXPENSE_LEDGERS["other"]))
        _sub(debit, "ISDEEMEDPOSITIVE", "Yes")
        _sub(debit, "AMOUNT", "-" + _rupees(r["amount_paise"]))
        credit = _sub(v, "ALLLEDGERENTRIES.LIST")
        _sub(credit, "LEDGERNAME", payment_ledger)
        _sub(credit, "ISDEEMEDPOSITIVE", "No")
        _sub(credit, "AMOUNT", _rupees(r["amount_paise"]))
    return ET.tostring(env, encoding="utf-8", xml_declaration=True)
