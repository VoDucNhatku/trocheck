"""M4 normalisation: deterministic span text -> values (docs/02-data/04-quy-tac-chuan-hoa.md).

Shared by Regex and LLM, so the two methods differ only in how spans are found (ADR-0003).
Every function takes the verbatim span text and works on its folded form (no accents,
lowercase). Pure functions: no network, no DB.
"""
from __future__ import annotations

import re
from decimal import Decimal

from app.pipeline.preprocess import fold

NORMALIZER_VERSION = "1.0.0"

# --- money ------------------------------------------------------------------

_NUM = r"\d+(?:[.,]\d+)*"
MONEY_TOKEN_RE = re.compile(
    rf"(?P<num>{_NUM})\s?"
    r"(?:(?P<big>trieu|tr|cu)(?:\s?(?P<tail>\d{1,3})(?![\d.,]))?"
    r"|(?P<small>k|nghin|ngan)(?P<ktail>\d)?(?![a-z\d])"
    r"|(?P<vnd>vnd|dong|d)\b)?"
)
_GROUPED_RE = re.compile(r"^\d{1,3}(?:[.,]\d{3})+$")


def _decimal(num: str) -> Decimal:
    return Decimal(num.replace(",", "."))


def money_value(token: str, default_unit: str | None = None) -> int | None:
    """Value in VND of one money token such as '5tr5', '3k5', '2.800.000đ'.

    Returns None for a bare number that is not clearly money ('3', '25').
    `default_unit` ('tr' or 'k') lets the first half of a range borrow the unit of the second.
    """
    m = MONEY_TOKEN_RE.fullmatch(fold(token).strip())
    if not m:
        return None
    num = m.group("num")
    if m.group("big") or (default_unit == "tr" and not (m.group("small") or m.group("vnd"))):
        if _GROUPED_RE.match(num) and num.count(".") + num.count(",") > 1:
            return None
        value = _decimal(num) * 1_000_000
        tail = m.group("tail")
        if tail:
            value += int(tail) * 10 ** (6 - len(tail))
        return int(value)
    if m.group("small") or default_unit == "k":
        value = _decimal(num) * 1_000
        if m.group("ktail"):
            value += int(m.group("ktail")) * 100
        return int(value)
    if _GROUPED_RE.match(num):
        return int(re.sub(r"[.,]", "", num))
    if num.isdigit() and int(num) >= 100_000:
        return int(num)
    return None


def _unit_of(token: str) -> str | None:
    m = MONEY_TOKEN_RE.fullmatch(fold(token).strip())
    if not m:
        return None
    if m.group("big"):
        return "tr"
    if m.group("small"):
        return "k"
    return None


_MONEY_FIND_RE = re.compile(
    rf"{_NUM}\s?(?:(?:trieu|tr|cu)(?:\s?\d{{1,3}}(?![\d.,])(?!\s?(?:m2|m\b|met|k\b|tr|nguoi|ng\b|pn|wc|phong|x\b|%)))?(?![a-z])"
    r"|(?:k|nghin|ngan)\d?(?![a-z\d])|(?:vnd|dong|d)\b)?"
)

_HIDDEN_RE = re.compile(
    r"\b(?:ib|inbox|ibx)\b|thoa\s*thuan|lien\s*he\s*(?:de\s*)?(?:biet\s*)?gia|\blh\s*gia\b"
)
_SLANG_RE = re.compile(r"\d+(?:[.,]\d+)?\s?(?:lit|chai)\b")
_RANGE_SEP = r"\s?(?:-|–|~|den|toi)\s?"
_INCLUDES = [
    (re.compile(r"\bdien\b"), "electricity"),
    (re.compile(r"\bnuoc\b"), "water"),
    (re.compile(r"\b(?:wifi|internet|mang)\b"), "internet"),
    (re.compile(r"\b(?:dich vu|dv)\b"), "service"),
    (re.compile(r"\bgui xe\b"), "parking"),
]


def _suffixes(folded: str) -> tuple[str, str]:
    basis, period = "unknown", "unknown"
    for part in re.findall(r"/\s?([a-z]+)", folded):
        if part in {"th", "thang", "t"}:
            period = "month"
        elif part == "ngay":
            period = "day"
        elif part in {"nguoi", "ng"}:
            basis = "per_person"
        elif part in {"phong", "can", "p"}:
            basis = "per_unit"
    if re.search(r"\bca phong\b", folded):
        basis = "per_unit"
    return basis, period


def _includes(folded: str) -> list[str]:
    m = re.search(r"\bbao\s+(.*)$", folded)
    if not m:
        return []
    out = []
    for pattern, fee_type in _INCLUDES:
        if pattern.search(m.group(1)) and fee_type not in out:
            out.append(fee_type)
    return out


def _money_tokens(folded: str) -> list[str]:
    """Candidate money tokens in order; callers skip those whose value is None."""
    return [m.group().strip() for m in _MONEY_FIND_RE.finditer(folded)]


def parse_rent(quote: str) -> dict:
    """Rent value from one PRICE span (quy-tac-chuan-hoa §1)."""
    folded = fold(quote)
    rent = {
        "visibility": "disclosed", "amount_form": "none", "amount_vnd": None,
        "min_vnd": None, "max_vnd": None, "basis": "unknown", "period": "unknown",
        "includes": [], "unsupported": False,
    }
    basis, period = _suffixes(folded)

    range_m = re.search(rf"(?<![\w.,])(?P<a>{_NUM}\s?(?:(?:tr|trieu|cu)\d{{0,3}}|k)?){_RANGE_SEP}(?P<b>{_NUM}\s?(?:tr|trieu|cu|k|d|vnd)?(?:\d{{1,3}})?)", folded)
    if range_m:
        b_unit = _unit_of(range_m.group("b"))
        lo = money_value(range_m.group("a"), default_unit=b_unit)
        hi = money_value(range_m.group("b"))
        if lo is not None and hi is not None and lo < hi:
            rent.update(amount_form="range", min_vnd=lo, max_vnd=hi, basis=basis, period=period,
                        includes=_includes(folded))
            return rent

    from_m = re.search(rf"\btu\s+({_NUM}\s?(?:tr|trieu|cu|k|d)?\s?\d{{0,3}})", folded)
    if from_m:
        value = money_value(from_m.group(1).strip())
        if value is not None:
            rent.update(amount_form="starting_from", min_vnd=value, basis=basis, period=period,
                        includes=_includes(folded))
            return rent

    for token in _money_tokens(folded):
        value = money_value(token)
        if value is not None:
            rent.update(amount_form="exact", amount_vnd=value, basis=basis, period=period,
                        includes=_includes(folded))
            return rent

    if _SLANG_RE.search(folded):
        rent["unsupported"] = True
        return rent
    if _HIDDEN_RE.search(folded):
        rent.update(visibility="hidden_explicit")
        return rent
    rent.update(visibility="not_stated")
    return rent


# --- context rules (quy-tac-chuan-hoa §6) -----------------------------------

def ctx_period_month(rent: dict, *, post_type: str) -> str | None:
    amount = rent.get("amount_vnd") or rent.get("min_vnd")
    if (rent["period"] == "unknown" and post_type == "rental_offer"
            and amount is not None and amount >= 500_000):
        rent["period"] = "month"
        return "CTX_PERIOD_MONTH"
    return None


_SHARED_RE = re.compile(r"\bnguoi\b|\bo ghep\b|\bslot\b")


def ctx_basis_unit_single(rent: dict, *, property_type: str, listing_count: int, text: str) -> str | None:
    if (rent["basis"] == "unknown" and listing_count == 1
            and property_type in {"ccmn", "can_ho_dich_vu", "nha_nguyen_can"}
            and rent["amount_form"] != "none"
            and not _SHARED_RE.search(fold(text))):
        rent["basis"] = "per_unit"
        return "CTX_BASIS_UNIT_SINGLE"
    return None


# --- fees (§2) ----------------------------------------------------------------

FEE_KEYWORDS = [
    (re.compile(r"\bdien\s+nuoc\b"), ["electricity", "water"]),
    (re.compile(r"\b(?:dat\s+)?coc\b"), ["deposit"]),
    (re.compile(r"\bdien\b"), ["electricity"]),
    (re.compile(r"\bnuoc\b"), ["water"]),
    (re.compile(r"\b(?:phi\s+)?(?:dich vu|dv|ve sinh|rac)\b"), ["service"]),
    (re.compile(r"\b(?:wifi|internet|mang)\b"), ["internet"]),
    (re.compile(r"\b(?:gui\s+)?xe\b"), ["parking"]),
    (re.compile(r"\bphi\b"), ["other"]),
]
_STATE_RATE_RE = re.compile(r"\bgia\s+nha\s+nuoc\b")
_FREE_RE = re.compile(r"\bfree\b|\bmien\s+phi\b")
_DEPOSIT_MONTHS_RE = re.compile(r"\bcoc\s+(\d+(?:[.,]5)?)\s*(?:thang|th)\b")


def fee_types_in(folded: str) -> list[str]:
    """Fee types named in a span, in order of first mention ('điện nước' -> both)."""
    found: list[tuple[int, str]] = []
    taken: list[tuple[int, int]] = []
    for pattern, types in FEE_KEYWORDS:
        for m in pattern.finditer(folded):
            if any(m.start() < e and s < m.end() for s, e in taken):
                continue
            taken.append((m.start(), m.end()))
            for t in types:
                found.append((m.start(), t))
    out: list[str] = []
    for _, t in sorted(found):
        if t not in out:
            out.append(t)
    return out


def _fee_unit(folded: str, fee_type: str) -> str:
    parts = set(re.findall(r"/\s?([a-z0-9]+)", folded))
    # Explicit person/consumption units take priority regardless of suffix order.
    if parts & {"nguoi", "ng"}:
        return "per_person_month"
    if parts & {"khoi", "m3"}:
        return "per_m3"
    if fee_type == "electricity" and parts & {"so", "kwh", "kw", "ki", "kg"}:
        return "per_kwh"
    if parts & {"phong", "can", "p", "thang", "th"}:
        return "per_unit_month"
    return "unknown"


def parse_fees(quote: str) -> list[dict]:
    """One FEE span -> one or more fee records (§2). Never summed with rent."""
    folded = fold(quote)
    # "nước" inside "giá nhà nước" is not a water fee.
    types = fee_types_in(_FREE_RE.sub(" ", _STATE_RATE_RE.sub(" ", folded))) or ["other"]
    if _STATE_RATE_RE.search(folded):
        return [{"type": t, "amount_vnd": None, "unit": "unknown", "state_rate": True} for t in types]
    if _FREE_RE.search(folded):
        return [{"type": t, "amount_vnd": 0, "unit": "unknown", "free": True} for t in types]
    fees = []
    for fee_type in types:
        if fee_type == "deposit":
            months = _DEPOSIT_MONTHS_RE.search(folded)
            if months:
                value = float(months.group(1).replace(",", "."))
                fees.append({"type": "deposit", "amount_vnd": None, "unit": "months_of_rent",
                             "months": int(value) if value.is_integer() else value})
                continue
        amount = None
        for token in _money_tokens(folded):
            amount = money_value(token)
            if amount is not None:
                break
        if fee_type == "deposit":
            unit = "one_time" if amount is not None else "unknown"
        else:
            unit = _fee_unit(folded, fee_type)
        fees.append({"type": fee_type, "amount_vnd": amount, "unit": unit})
    return fees


# --- area (§3) ----------------------------------------------------------------

_NUMF = r"\d+(?:[.,]\d+)?"
_M2 = r"(?:m2|m²|met vuong|m vuong)"


def _num(s: str) -> int | float:
    value = float(s.replace(",", "."))
    return int(value) if value.is_integer() else value


def parse_area(quote: str) -> dict:
    folded = fold(quote)
    area = {"amount_form": "none", "value_m2": None, "min_m2": None, "max_m2": None, "from_dimensions": False}
    m = re.search(rf"({_NUMF})\s?(?:-|–|~|den)\s?({_NUMF})\s?{_M2}", folded)
    if m:
        area.update(amount_form="range", min_m2=_num(m.group(1)), max_m2=_num(m.group(2)))
        return area
    m = re.search(rf"({_NUMF})\s?x\s?({_NUMF})", folded)
    if m:
        value = float(m.group(1).replace(",", ".")) * float(m.group(2).replace(",", "."))
        area.update(amount_form="exact", value_m2=int(value) if value.is_integer() else round(value, 2),
                    from_dimensions=True)
        return area
    m = re.search(rf"({_NUMF})\s?{_M2}", folded) or re.search(rf"(?:dt|dien tich)\s*:?\s*({_NUMF})\s?m\b", folded)
    if m:
        area.update(amount_form="exact", value_m2=_num(m.group(1)))
    return area


# --- room (§4) ----------------------------------------------------------------

PROPERTY_PATTERNS = [
    (re.compile(r"\b(?:ccmn|chung cu mini)\b"), "ccmn"),
    (re.compile(r"\b(?:can ho dich vu|chdv)\b"), "can_ho_dich_vu"),
    (re.compile(r"\b(?:nha nguyen can|nha rieng)\b"), "nha_nguyen_can"),
    (re.compile(r"\bphong (?:tro|khep kin)\b"), "phong_tro"),
]
_PRIVATE_RE = re.compile(r"\bkhep kin\b|\b(?:wc|vs|ve sinh|nha ve sinh) rieng\b")
_MEZZ_RE = re.compile(r"\bgac lung\b|\bco gac\b|\bgac xep\b")
_FURNISH = [
    (re.compile(r"\b(?:full|day du)\s+(?:noi that|do)\b|\bfull do\b"), "full"),
    (re.compile(r"\bnoi that co ban\b"), "basic"),
    (re.compile(r"\b(?:khong noi that|nha trong)\b"), "none"),
]


def parse_room(quote: str) -> dict:
    folded = fold(quote)
    room: dict = {}
    for pattern, ptype in PROPERTY_PATTERNS:
        if pattern.search(folded):
            room["property_type"] = ptype
            break
    m = re.search(r"(\d+)\s?pn\s?(\d+)\s?(?:wc|vs)\b", folded)
    if m:
        room["bedrooms"], room["bathrooms"] = int(m.group(1)), int(m.group(2))
    else:
        m = re.search(r"(\d+)\s?(?:pn|phong ngu)\b", folded)
        if m:
            room["bedrooms"] = int(m.group(1))
        m = re.search(r"(\d+)\s?(?:wc|vs|ve sinh)\b", folded)
        if m:
            room["bathrooms"] = int(m.group(1))
    if re.search(r"\bstudio\b", folded):
        room["bedrooms"] = 0
    if _MEZZ_RE.search(folded):
        room["mezzanine"] = True
    if _PRIVATE_RE.search(folded):
        room["private_bathroom"] = True
    for pattern, value in _FURNISH:
        if pattern.search(folded):
            room["furnishing"] = value
            break
    return room


# --- location (§5) --------------------------------------------------------------

_WARD_PREFIX = re.compile(r"^(?:p\.\s?|phường\s+|phuong\s+|xã\s+)", re.IGNORECASE)
_DISTRICT_PREFIX = re.compile(r"^(?:q\.\s?|quận\s+|huyện\s+|quan\s+|huyen\s+|tx\.\s?|thị xã\s+)", re.IGNORECASE)
_STREET_PREFIX = re.compile(r"^(?:đường|ngõ|ngách|hẻm|kiệt|phố|duong|ngo|ngach|hem|kiet|pho)\s+", re.IGNORECASE)


def location_kind(quote: str) -> str:
    """'ward' | 'district' | 'street' | 'landmark' for a LOC span."""
    q = quote.strip()
    if _WARD_PREFIX.match(q):
        return "ward"
    if _DISTRICT_PREFIX.match(q):
        return "district"
    if _STREET_PREFIX.match(q):
        return "street"
    return "landmark"


def strip_location_prefix(quote: str) -> str:
    q = quote.strip()
    for prefix in (_WARD_PREFIX, _DISTRICT_PREFIX):
        q = prefix.sub("", q)
    return q.strip(" ,.")


def location_key(value: str | None) -> str | None:
    """Normalised landmark/street key used for lexicon lookup and dedup."""
    if not value:
        return None
    return re.sub(r"\s+", " ", fold(value)).strip(" ,.")
