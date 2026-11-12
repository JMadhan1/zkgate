"""Parse rupee amounts out of short WhatsApp messages. All money is integer paise."""

from __future__ import annotations

import re
import unicodedata

MAX_REQUEST_PAISE = 10_00_000 * 100   # ₹10 lakh per request: far above SMB spend, blocks typos

_AMOUNT = re.compile(
    r"(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+|\d+)(?:\.(\d{1,2}))?",
    re.IGNORECASE,
)

CATEGORIES = {
    "travel": ("cab", "taxi", "uber", "ola", "auto", "rapido", "bus", "train", "flight", "metro", "fuel", "petrol", "diesel", "toll", "parking"),
    "meals": ("lunch", "dinner", "breakfast", "food", "meal", "tea", "coffee", "snacks", "swiggy", "zomato"),
    "supplies": ("stationery", "printer", "paper", "courier", "supplies", "office", "hardware", "cable"),
    "client": ("client", "customer", "gift", "hospitality"),
    "telecom": ("recharge", "mobile", "internet", "wifi", "data"),
}


def normalise_text(text: str, limit: int = 280) -> str:
    """NFC-normalise, drop control characters and NUL bytes, collapse spaces, cap length."""
    text = unicodedata.normalize("NFC", text)
    text = "".join(ch for ch in text if ch in "\n\t" or unicodedata.category(ch)[0] != "C")
    return " ".join(text.split())[:limit]


def parse_amount(text: str) -> int | None:
    """First amount in the text, in paise. None if absent or out of range."""
    m = _AMOUNT.search(normalise_text(text))
    if not m:
        return None
    rupees = int(m.group(1).replace(",", ""))
    paise = int((m.group(2) or "0").ljust(2, "0"))
    total = rupees * 100 + paise
    return total if 0 < total <= MAX_REQUEST_PAISE else None


def guess_category(text: str) -> str:
    words = set(re.findall(r"[a-z]+", text.lower()))
    for cat, keys in CATEGORIES.items():
        if words.intersection(keys):
            return cat
    return "other"


def describe(text: str) -> str:
    """The request text with the amount removed, as a short description."""
    t = normalise_text(text)
    t = _AMOUNT.sub("", t, count=1).strip(" -:,")
    return t[:120] or "Expense"


def inr(paise: int) -> str:
    """₹1,23,456.50 in Indian digit grouping."""
    rupees, p = divmod(abs(paise), 100)
    s = str(rupees)
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        s = ",".join(groups + [tail])
    out = f"₹{s}" + (f".{p:02d}" if p else "")
    return ("-" if paise < 0 else "") + out
