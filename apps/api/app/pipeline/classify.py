"""M2 post classification by keyword rules (lexicon/classify.yaml)."""
from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import yaml

LEXICON = Path(__file__).parent / "lexicon"
POST_TYPES = ("rental_offer", "seeking", "roommate", "sale", "spam", "other")


@dataclass(frozen=True)
class Classification:
    post_type: str
    confident: bool
    keyword: str | None = None


@lru_cache
def _rules() -> tuple[str, dict[str, list[re.Pattern]], dict]:
    data = yaml.safe_load((LEXICON / "classify.yaml").read_text(encoding="utf-8"))
    compiled = {k: [re.compile(p) for p in v] for k, v in data["keywords"].items()}
    return data["version"], compiled, data["fallback"]


def classifier_version() -> str:
    return _rules()[0]


def classify(folded: str, *, has_price_or_area: bool) -> Classification:
    _, rules, fallback = _rules()
    best: tuple[int, str, str] | None = None
    for post_type, patterns in rules.items():
        for pattern in patterns:
            m = pattern.search(folded)
            if m and (best is None or m.start() < best[0]):
                best = (m.start(), post_type, m.group())
    if best:
        return Classification(best[1], confident=True, keyword=best[2])
    key = "with_price_or_area" if has_price_or_area else "otherwise"
    return Classification(fallback[key], confident=False)
