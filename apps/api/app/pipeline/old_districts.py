"""Old (pre-07/2025) district keys -> the new ward codes that received any part of them.

Built once from lexicon/former_wards.yaml (never hand-written): every former ward lists the new
wards that received it, wholly or partly. A new ward can receive parts of two old districts,
so the same ward code can belong to several districts and then matches each of them.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import yaml

from app.pipeline.normalize import location_key

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


def district_mentions(text: str) -> list[str]:
    """Old-district keys named in a real (non-demo) post, via Places.unconfirmed_districts.

    Passing an empty ward code makes every detected district "unconfirmed", i.e. returned.
    """
    catalog = area_catalog()
    found = []
    for name in _mention_places().unconfirmed_districts("", text):
        key = district_key(name)
        if key in catalog and key not in found:
            found.append(key)
    return found
