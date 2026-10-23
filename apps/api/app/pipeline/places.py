"""Ward and place dictionaries (quy-tac-chuan-hoa §5).

- wards.yaml: wards of the new 2-level system (from 01/07/2025) the team covers: code, name, aliases.
- places.yaml: team dictionary street/landmark -> ward, with who added it and when it was checked.

Both ship empty: the team fills them for its 3-5 chosen wards. No ward is ever guessed from a
vague landmark. Demo posts use the separate demo dictionaries (codes prefixed `DEMO-`), which
never apply to real posts.
"""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import yaml

from app.pipeline.normalize import location_key

LEXICON = Path(__file__).parent / "lexicon"


@dataclass(frozen=True)
class Ward:
    code: str
    name: str


@dataclass
class Places:
    version: str
    wards: dict[str, Ward]          # folded name/alias -> ward
    entries: dict[tuple[str, str], Ward]  # (kind, folded match) -> ward

    def ward(self, name: str | None) -> Ward | None:
        key = location_key(name)
        return self.wards.get(key) if key else None

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


def _load(wards_file: Path, places_file: Path) -> Places:
    wards_doc = yaml.safe_load(wards_file.read_text(encoding="utf-8")) or {}
    places_doc = yaml.safe_load(places_file.read_text(encoding="utf-8")) or {}
    wards: dict[str, Ward] = {}
    by_code: dict[str, Ward] = {}
    for w in wards_doc.get("wards") or []:
        ward = Ward(code=str(w["code"]), name=w["name"])
        by_code[ward.code] = ward
        for name in [w["name"], *(w.get("aliases") or [])]:
            wards[location_key(name)] = ward
            bare = location_key(name.split(" ", 1)[1]) if name.lower().startswith(("phường ", "xã ")) else None
            if bare:
                wards.setdefault(bare, ward)
    entries: dict[tuple[str, str], Ward] = {}
    for e in places_doc.get("places") or []:
        ward = by_code.get(str(e["ward_code"]))
        if ward is None:
            raise ValueError(f"places entry {e['match']!r} points to unknown ward {e['ward_code']!r}")
        entries[(e["kind"], location_key(e["match"]))] = ward
    version = f"{wards_doc.get('version', '0')}+{places_doc.get('version', '0')}"
    return Places(version=version, wards=wards, entries=entries)


@lru_cache
def real_places() -> Places:
    return _load(LEXICON / "wards.yaml", LEXICON / "places.yaml")


@lru_cache
def demo_places() -> Places:
    return _load(LEXICON / "wards.demo.yaml", LEXICON / "places.demo.yaml")


def places_for(is_demo: bool) -> Places:
    return demo_places() if is_demo else real_places()
