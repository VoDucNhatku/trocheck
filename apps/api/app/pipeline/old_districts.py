"""Old (pre-07/2025) district keys -> the new ward codes that received any part of them.

Built once from lexicon/former_wards.yaml (never hand-written): every former ward lists the new
wards that received it, wholly or partly. A new ward can receive parts of two old districts,
so the same ward code can belong to several districts and then matches each of them.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import yaml

from app.pipeline.normalize import location_key
from app.pipeline.preprocess import TextView, _fold_char, fold

LEXICON = Path(__file__).parent / "lexicon"
_CATEGORY = re.compile(r"^(quan|huyen|thanh pho|thi xa) ")


@dataclass(frozen=True)
class OldDistrict:
    key: str
    name: str
    ward_codes: frozenset[str]


def district_key(name: str) -> str:
    """'Quận 1' -> quan-1, 'Quận Bình Thạnh' -> binh-thanh, 'Thành phố Thủ Đức' -> thu-duc."""
    folded = (location_key(name) or "").replace("đ", "d")
    match = _CATEGORY.match(folded)
    rest = folded[match.end():] if match else folded
    if rest.isdigit():  # numbered districts keep their category: quan-1, quan-10
        rest = f"{match.group(1)} {rest}" if match else rest
    return re.sub(r"[^a-z0-9]+", "-", rest).strip("-")


@lru_cache
def old_districts() -> dict[str, OldDistrict]:
    doc = yaml.safe_load((LEXICON / "former_wards.yaml").read_text(encoding="utf-8"))
    names: dict[str, str] = {}
    codes: dict[str, set[str]] = {}
    for row in doc["former_wards"]:
        key = district_key(row["old_district_name"])
        if names.setdefault(key, row["old_district_name"]) != row["old_district_name"]:
            raise ValueError(f"Old district key collision: {key}")
        codes.setdefault(key, set()).update(str(r["new_ward_code"]) for r in row["relations"])
    return {key: OldDistrict(key, names[key], frozenset(codes[key])) for key in sorted(names)}


@lru_cache
def districts_of_ward() -> dict[str, tuple[str, ...]]:
    out: dict[str, list[str]] = {}
    for district in old_districts().values():
        for code in district.ward_codes:
            out.setdefault(code, []).append(district.key)
    return {code: tuple(keys) for code, keys in out.items()}


@lru_cache
def area_catalog() -> dict[str, OldDistrict]:
    """Every key the `area` filter accepts: old districts known from former wards, plus numbered
    districts that exist only as mentions (Quận 2, Quận 9 became Thủ Đức in 2021, so no former ward lists
    them). Mention-only districts have no ward codes and match through persisted mentions only."""
    catalog = dict(old_districts())
    for number in range(1, 13):
        key = f"quan-{number}"
        catalog.setdefault(key, OldDistrict(key, f"Quận {number}", frozenset()))
    return dict(sorted(catalog.items()))


@lru_cache
def _mention_places():
    """The real place dictionary, with the numbered districts the lexicon lacks added as known names
    so the existing district matcher (Q10, Q.10, quận 10, quan 10, not-accented forms) finds them."""
    from dataclasses import replace

    from app.pipeline.places import real_places

    places = real_places()
    names = dict(places.former_districts or {})
    for number in range(1, 13):
        names.setdefault(f"quan {number}", frozenset())
    return replace(places, former_districts=names)


MULTI_AREA_MIN = 3  # a post naming this many different districts as its own is an agency / multi-area ad


@dataclass(frozen=True)
class DistrictScan:
    keys: tuple[str, ...]
    multi_area: bool


# Words after which a district is talked about as a neighbour, not as the place of the listing. Folded
# (no accents), so "gần", "gan" and "GẦN" are the same.
_PROXIMITY = (r"giap ranh|giap|gan|sat|cach|ke|canh|ben canh|tien di|tien ra|thuan tien di chuyen|"
              r"thuan tien di lai|thuan tien di|thuan tien ra|di chuyen ra|di chuyen qua|di chuyen sang|"
              r"noi lien|giao giua|qua|sang|ra|ve|xuong|len|"
              r"\d+\s?(?:phut|p)\s?(?:di bo |chay xe |di xe )?(?:la )?(?:toi|den|ra|di|qua|sang|ve)")
_FILLER = r"(?:khu vuc|khu|vung|trung tam|cac|nhieu|nhung)"
_CATEGORY_WORDS = r"(?:quan|huyen|thi xa|thanh pho|tx\.?|tp\.?|q\.?)"
_NUMBER_TAIL = (r"(?:\s*(?:,|/|va|hoac)\s*\d{1,2}"
                r"(?![\d.,]|\s?(?:tr|k|m|trieu|nghin|pn|phong|phut|nguoi|p)\b))*")
_SEPARATOR = r"\s*(?:,|/|&|\+|-|va|hoac|hay|or)\s*"


@lru_cache
def _bare_names() -> tuple[tuple[str, str], ...]:
    """(folded, accented) bare names of the districts that are not numbered: ('binh thanh', 'bình thạnh')."""
    out = []
    for district in area_catalog().values():
        accented = unicodedata.normalize("NFC", district.name).casefold()
        accented = re.sub(r"^(?:quận|huyện|thị xã|thành phố)\s+", "", accented)
        if not accented.isdigit():
            out.append((fold(accented), accented))
    return tuple(sorted(out, key=lambda pair: -len(pair[0])))


@lru_cache
def _proximity_pattern() -> re.Pattern:
    names = "|".join(re.escape(folded) for folded, _ in _bare_names())
    number = rf"(?:quan|q\.?)\s?\d{{1,2}}(?!\d){_NUMBER_TAIL}"
    named = rf"(?:{_CATEGORY_WORDS}\s*)?(?:{names})(?![a-z0-9])"
    ref = rf"(?:{number}|{named})"
    bare = rf"(?:{names})(?![a-z0-9])"
    # A landmark may sit between the proximity word and a BARE district name ("tiện đi Aeon mall Tân Phú").
    gap = r"(?:(?!(?:quan|huyen|tx|tp|q)\b)[a-z0-9]+\s+){1,3}"
    chain = rf"(?:{ref}|{gap}{bare})(?:{_SEPARATOR}{ref})*"
    return re.compile(rf"(?<![a-z0-9])(?:{_PROXIMITY})(?![a-z0-9])\s*:?\s*(?:{_FILLER}\s+)*{chain}")


def _accent_conflict(seen: str, canonical: str) -> bool:
    """True when `seen` (accented text) spells the same letters with a different accent than the real name.
    A plain letter where the real name has an accent is tolerated ("Binh Thạnh" is still Bình Thạnh)."""
    return len(seen) == len(canonical) and any(
        s != c and s != _fold_char(s) for s, c in zip(seen, canonical))


def _short_forms(folded: str) -> str:
    """D10, D.10, D 10, quan10 and '#...quan10' hashtags -> 'quan 10' for the numbered districts 1-12."""
    def numbered(match: re.Match) -> str:
        return f" quan {match.group(1)} " if 1 <= int(match.group(1)) <= 12 else match.group()

    folded = re.sub(r"quan\s?(\d{1,2})(?!\d)", numbered, folded)
    return re.sub(r"(?<![a-z0-9])d\.?\s?(\d{1,2})(?![\d/]|\s?(?:m2|m\b|tr|k\b|nguoi|ng\b|pn|phong|phut|%))",
                  numbered, folded)


def district_scan(text: str) -> DistrictScan:
    """Old districts a real (non-demo) post gives as ITS OWN place, in order of appearance.

    On top of Places.unconfirmed_districts (the shared matcher) this removes what is not the listing's
    place: a district named after a proximity word ("gần Q1", "giao giữa quận 3, quận 1"), and a name that
    only matches once accents are dropped (the street "Bình Thành" is not Bình Thạnh). It also reads D10,
    Q.10, quan10 and hashtags. A post with MULTI_AREA_MIN or more own districts is a multi-area ad.
    """
    view = TextView.build(text or "")
    folded = list(view.folded)
    for plain, accented in _bare_names():
        for match in re.finditer(rf"(?<![a-z0-9]){re.escape(plain)}(?![a-z0-9])", view.folded):
            if _accent_conflict(view.lower[match.start():match.end()], accented):
                folded[match.start():match.end()] = " " * (match.end() - match.start())
    cleaned = _short_forms("".join(folded))
    cleaned = _proximity_pattern().sub(lambda match: " " * len(match.group()), cleaned)
    catalog = area_catalog()
    found: list[str] = []
    for name in _mention_places().unconfirmed_districts("", cleaned):
        key = district_key(name)
        if key in catalog and key not in found:
            found.append(key)
    return DistrictScan(tuple(found), len(found) >= MULTI_AREA_MIN)


def district_mentions(text: str) -> list[str]:
    """Old-district keys that are the post's own place (see district_scan)."""
    return list(district_scan(text).keys)
