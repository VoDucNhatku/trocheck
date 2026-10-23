"""M8 listing-level dedup (gop-trung-va-thong-ke §1, mức 2). Pure functions.

Two listings are suspected to be the same room when ALL hold: same property_type and ward
(or same normalised landmark when no ward), area within 2 m² (or both missing), rent within
10%, and TF-IDF cosine of the post texts >= 0.8. >= 0.9 merges automatically; 0.8-0.9 goes to
the review queue. Thresholds are configuration and must be checked on pilot posts.
"""
from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass

from app.pipeline.preprocess import fold

_WORD = re.compile(r"[a-z0-9]+")


@dataclass
class DedupItem:
    listing_id: str
    cluster_id: str | None
    post_id: str
    property_type: str
    ward_code: str | None
    landmark_key: str | None
    area_m2: float | None
    rent_vnd: int | None
    text: str


@dataclass
class DedupConfig:
    area_tolerance_m2: float = 2.0
    price_tolerance_percent: float = 10.0
    suggest_cosine: float = 0.8
    auto_cosine: float = 0.9


def tokens(text: str) -> list[str]:
    return [t for t in _WORD.findall(fold(text)) if t != "sdt"]


class TfIdf:
    def __init__(self, documents: list[str]):
        self.n = len(documents)
        df: Counter = Counter()
        for doc in documents:
            df.update(set(tokens(doc)))
        self.idf = {t: math.log((1 + self.n) / (1 + c)) + 1 for t, c in df.items()}

    def vector(self, text: str) -> dict[str, float]:
        tf = Counter(tokens(text))
        vec = {t: c * self.idf.get(t, math.log(1 + self.n) + 1) for t, c in tf.items()}
        norm = math.sqrt(sum(v * v for v in vec.values())) or 1.0
        return {t: v / norm for t, v in vec.items()}

    def cosine(self, a: str, b: str) -> float:
        va, vb = self.vector(a), self.vector(b)
        return sum(v * vb.get(t, 0.0) for t, v in va.items())


def same_room_conditions(a: DedupItem, b: DedupItem, cfg: DedupConfig) -> bool:
    if a.property_type != b.property_type:
        return False
    if a.ward_code or b.ward_code:
        if a.ward_code != b.ward_code:
            return False
    elif not (a.landmark_key and a.landmark_key == b.landmark_key):
        return False
    if (a.area_m2 is None) != (b.area_m2 is None):
        return False
    if a.area_m2 is not None and abs(a.area_m2 - b.area_m2) > cfg.area_tolerance_m2:
        return False
    if a.rent_vnd is None or b.rent_vnd is None:
        return False
    base = max(a.rent_vnd, b.rent_vnd)
    return abs(a.rent_vnd - b.rent_vnd) <= base * cfg.price_tolerance_percent / 100


@dataclass
class DedupDecision:
    action: str  # merge | suggest | separate
    cluster_id: str | None
    cosine: float
    other_listing_id: str | None


def decide(target: DedupItem, candidates: list[DedupItem], tfidf: TfIdf, cfg: DedupConfig) -> DedupDecision:
    best: tuple[float, DedupItem] | None = None
    for other in candidates:
        if other.listing_id == target.listing_id or other.post_id == target.post_id:
            continue
        if not same_room_conditions(target, other, cfg):
            continue
        score = tfidf.cosine(target.text, other.text)
        if best is None or score > best[0]:
            best = (score, other)
    if best is None or best[0] < cfg.suggest_cosine:
        return DedupDecision("separate", None, best[0] if best else 0.0, None)
    score, other = best
    action = "merge" if score >= cfg.auto_cosine else "suggest"
    return DedupDecision(action, other.cluster_id, round(score, 4), other.listing_id)
