"""Ward and place dictionaries (quy-tac-chuan-hoa §5).

- wards.yaml: wards of the new 2-level system (from 01/07/2025) the team covers: code, name, aliases.
- places.yaml: team dictionary street/landmark -> ward, with who added it and when it was checked.

The real ward directory covers HCMC; the street/landmark dictionary remains empty.
No ward is ever guessed from a vague landmark. Demo posts use separate dictionaries, which
never apply to real posts.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import yaml

from app.pipeline.normalize import location_key

LEXICON = Path(__file__).parent / "lexicon"

# This is a publication guard, not an additional ward extraction rule.
_DISTRICT_PREFIX = re.compile(
    r"\b(?:quan\s+|q\.?\s*(?=\d)|q\.\s*|huyen\s+|thi\s+xa\s+|tx\.?\s+|"
    r"thanh\s+pho\s+|tp\.\s*|tp\s+)")
_DISTRICT_CATEGORY = re.compile(r"^(?:quan|huyen|thi xa|thanh pho) ")


def _ward_words(text: str, start: int) -> bool:
    return bool(re.search(r"\b(?:phuong|p\.?|xa|x\.?|dac khu)\s*$", text[:start]))


def _accent_key(value: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", value).casefold()).strip(" ,.")


@dataclass(frozen=True)
class Ward:
    code: str
    name: str


@dataclass
class Places:
    version: str
    wards: dict[str, Ward]          # folded name/alias -> ward
    entries: dict[tuple[str, str], Ward]  # (kind, folded match) -> ward
    accented_wards: dict[str, Ward] = field(default_factory=dict)
    ambiguous_keys: frozenset[str] = frozenset()
    ambiguous_accented_keys: frozenset[str] = frozenset()
    former_districts: dict[str, frozenset[str]] | None = None
    provinces: dict[str, str] = field(default_factory=dict)
    city_former_names: tuple[str, ...] = ()

    def ward(self, name: str | None, *, original: str | None = None) -> Ward | None:
        key = location_key(name)
        if not key:
            return None
        accented = _accent_key(name)
        has_accents = accented != key or (original is not None and _accent_key(original) != location_key(original))
        if accented in self.ambiguous_accented_keys:
            return None
        if key in self.ambiguous_keys:
            # A fully folded spelling cannot disambiguate two different units.
            return self.accented_wards.get(accented) if has_accents else None
        return self.accented_wards.get(accented) if has_accents else self.wards.get(key)

    def unconfirmed_districts(self, code: str, text: str) -> list[str]:
        if self.former_districts is None:
            return []
        text = location_key(text) or ""
        # A former province name must not become a bare former city/district mention.
        for name in self.city_former_names:
            pattern = r"\b(?:tinh\s+)?" + re.escape(name).replace(r"\ \-\ ", r"\s*[-–—]?\s*") + r"\b"
            text = re.sub(pattern, lambda match: " " * len(match.group()), text)
        unconfirmed = []
        covered = []
        for match in _DISTRICT_PREFIX.finditer(text):
            tail = location_key(text[match.end():]) or ""
            prefix = location_key(match.group()).strip(" .")
            category = {"q": "quan", "tx": "thi xa", "tp": "thanh pho"}.get(prefix, prefix)
            is_city = category == "thanh pho"
            # The current municipality is not a former district-level unit.
            if is_city and any(re.match(re.escape(name) + r"\b", tail)
                               for name in ("ho chi minh", "hcm", "sai gon")):
                continue
            # Match the complete known name, never a substring of another word.
            candidates = [name for name in self.former_districts
                          if re.match(re.escape(name) + r"\b", category + " " + tail)]
            name = max(candidates, key=len) if candidates else None
            end = match.end() + (len(_DISTRICT_CATEGORY.sub("", name)) if name else 0)
            covered.append((match.start(), end))
            if name is None or code not in self.former_districts[name]:
                unconfirmed.append(name or match.group().strip())
        # Bare district names are common, but a prefixed ward's own words are not districts.
        names = dict(self.former_districts)
        for number in range(1, 13):
            names.setdefault(f"quan {number}", frozenset())
        for name, codes in names.items():
            bare = _DISTRICT_CATEGORY.sub("", name)
            for match in re.finditer(r"\b" + re.escape(bare) + r"\b", text):
                if bare.isdigit() and not (re.search(r",\s*$", text[:match.start()])
                                           and re.match(r"\s*(?:[,.;]|$)", text[match.end():])):
                    continue
                if _ward_words(text, match.start()):
                    continue
                if any(start <= match.start() < end for start, end in covered):
                    continue
                if code not in codes:
                    unconfirmed.append(name)
        return unconfirmed

    def outside_provinces(self, text: str) -> list[str]:
        text = location_key(text) or ""
        return [name for name, code in self.provinces.items() if code != "79"
                and any(not _ward_words(text, match.start())
                        for match in re.finditer(r"\b" + re.escape(name) + r"\b", text))]

    def lookup(self, kind: str, value: str | None) -> Ward | None:
        key = location_key(value)
        if not key:
            return None
        if (kind, key) in self.entries:
            return self.entries[(kind, key)]
        # "gần ĐH FPT" matches an entry "ĐH FPT"; the prefix word is not part of the place name.
        for (k, match), ward in self.entries.items():
            if k == kind and (key.endswith(" " + match) or key == match):
                return ward
        return None


def _load(wards_file: Path, places_file: Path, districts_file: Path | None = None) -> Places:
    wards_doc = yaml.safe_load(wards_file.read_text(encoding="utf-8")) or {}
    places_doc = yaml.safe_load(places_file.read_text(encoding="utf-8")) or {}
    wards: dict[str, Ward] = {}
    accented_wards: dict[str, Ward] = {}
    ambiguous: set[str] = set()
    ambiguous_accented: set[str] = set()

    def add(index: dict[str, Ward], blocked: set[str], key: str, ward: Ward) -> None:
        if key in blocked:
            return
        if key in index and index[key].code != ward.code:
            del index[key]
            blocked.add(key)
        else:
            index[key] = ward

    by_code: dict[str, Ward] = {}
    for w in wards_doc.get("wards") or []:
        ward = Ward(code=str(w["code"]), name=w["name"])
        by_code[ward.code] = ward
        for name in [w["name"], *(w.get("aliases") or [])]:
            bare = name.split(" ", 1)[1] if name.lower().startswith(("phường ", "xã ")) else None
            names = [name]
            if bare:
                names.append(bare)
            for value in names:
                add(wards, ambiguous, location_key(value), ward)
                add(accented_wards, ambiguous_accented, _accent_key(value), ward)
    entries: dict[tuple[str, str], Ward] = {}
    for e in places_doc.get("places") or []:
        ward = by_code.get(str(e["ward_code"]))
        if ward is None:
            raise ValueError(f"places entry {e['match']!r} points to unknown ward {e['ward_code']!r}")
        entries[(e["kind"], location_key(e["match"]))] = ward
    version = f"{wards_doc.get('version', '0')}+{places_doc.get('version', '0')}"
    districts = None
    if districts_file is not None:
        doc = yaml.safe_load(districts_file.read_text(encoding="utf-8"))
        districts = {location_key(d["name"]):
                     frozenset(str(r["new_ward_code"]) for r in d["relations"])
                     for d in doc["districts"]}
        version += f"+districts:{doc['version']}"
    return Places(version=version, wards=wards, entries=entries, accented_wards=accented_wards,
                  ambiguous_keys=frozenset(ambiguous),
                  ambiguous_accented_keys=frozenset(ambiguous_accented), former_districts=districts)


@lru_cache
def real_places() -> Places:
    places = _load(LEXICON / "wards.yaml", LEXICON / "places.yaml", LEXICON / "districts.yaml")
    doc = yaml.safe_load((LEXICON / "provinces.yaml").read_text(encoding="utf-8"))
    places.provinces = {re.sub(r"^(?:tinh|thanh pho) ", "", location_key(row["name"])): str(row["code"])
                        for row in doc["provinces"]}
    places.city_former_names = tuple(location_key(name) for name in doc["city_former_names"])
    places.version += f"+provinces:{doc['version']}"
    return places


@lru_cache
def demo_places() -> Places:
    return _load(LEXICON / "wards.demo.yaml", LEXICON / "places.demo.yaml")


def places_for(is_demo: bool) -> Places:
    return demo_places() if is_demo else real_places()
