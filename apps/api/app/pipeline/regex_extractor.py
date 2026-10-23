"""M3a Regex extraction: spans with rule ids (lexicon/regex_rules.yaml).

Output spans are in code points of the original text. Money amounts are labelled FEE when a
fee keyword (cọc, điện, nước, dịch vụ…) precedes them in the same clause, otherwise PRICE.
Multi-listing posts are segmented by markers (P1, P2 / phòng 1, phòng 2).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import yaml

from app.pipeline.preprocess import TextView

LEXICON = Path(__file__).parent / "lexicon"

# Order matters: a number taken by an earlier rule cannot be reused (AREA before PRICE, etc.).
PRIORITY = [
    "AREA_RANGE", "AREA_DIMENSIONS", "AREA_M2", "AREA_DT_M",
    "FEE_STATE_RATE", "FEE_DEPOSIT_MONTHS", "FEE_FREE",
    "PRICE_RANGE", "PRICE_FROM", "PRICE_BIGNUM", "PRICE_MONEY",
    "PRICE_HIDDEN", "PRICE_INBOX_ONLY", "PRICE_SLANG_UNSURE",
    "ROOM_TYPE", "ROOM_BED_BATH", "ROOM_FEATURE", "ROOM_FURNISHING", "ROOM_GENERIC",
    "LOC_WARD", "LOC_OLD_DISTRICT", "LOC_STREET", "LOC_LANDMARK",
]
NUMERIC_LABELS = {"PRICE", "FEE", "AREA"}
MONEY_RULES = {"PRICE_RANGE", "PRICE_FROM", "PRICE_BIGNUM", "PRICE_MONEY"}
FEE_SUFFIX_RE = re.compile(r"(?:\s?/\s?(?:so|kwh|kw|ki|khoi|m3|nguoi|ng|phong|p|can|thang|th)\b)+")
CLAUSE_BREAK = re.compile(r"[,.;!?\n()\[\]+]")


@dataclass
class Span:
    start: int
    end: int
    quote: str
    label: str
    method: str
    rule_id: str | None = None
    listing_index: int | None = None  # None = applies to every listing of the post


@dataclass
class Rule:
    id: str
    label: str
    view: str
    regex: re.Pattern


@dataclass
class RuleSet:
    version: str
    rules: list[Rule]
    marker: re.Pattern
    fee_window: int
    fee_keywords: re.Pattern
    rent_keywords: re.Pattern
    raw: dict = field(repr=False, default_factory=dict)


def _expand(pattern: str, blocks: dict[str, str]) -> str:
    for name, body in blocks.items():
        pattern = pattern.replace("{" + name + "}", body)
    return pattern


@lru_cache
def load_rules() -> RuleSet:
    data = yaml.safe_load((LEXICON / "regex_rules.yaml").read_text(encoding="utf-8"))
    blocks = data["blocks"]
    by_id = {}
    for r in data["rules"]:
        by_id[r["id"]] = Rule(r["id"], r["label"], r["view"], re.compile(_expand(r["pattern"], blocks)))
    missing = [rid for rid in PRIORITY if rid not in by_id]
    if missing or len(by_id) != len(PRIORITY):
        raise ValueError(f"regex_rules.yaml and PRIORITY disagree: {missing or set(by_id) - set(PRIORITY)}")
    fc = data["fee_context"]
    return RuleSet(
        version=data["version"],
        rules=[by_id[rid] for rid in PRIORITY],
        marker=re.compile(data["listing_markers"]["pattern"]),
        fee_window=fc["window_chars"],
        fee_keywords=re.compile(fc["keywords"]),
        rent_keywords=re.compile(fc["rent_keywords"]),
        raw=data,
    )


def regex_version() -> str:
    return load_rules().version


def _overlaps(a: tuple[int, int], taken: list[tuple[int, int]]) -> bool:
    return any(a[0] < e and s < a[1] for s, e in taken)


def _fee_start(view: TextView, start: int, rules: RuleSet) -> int | None:
    """View index of the fee keyword governing the money at `start`, or None for rent."""
    window_start = max(0, start - rules.fee_window)
    before = view.folded[window_start:start]
    breaks = list(CLAUSE_BREAK.finditer(before))
    clause_offset = breaks[-1].end() if breaks else 0
    clause = before[clause_offset:]
    fee_hits = list(rules.fee_keywords.finditer(clause))
    rent_hits = list(rules.rent_keywords.finditer(clause))
    if not fee_hits:
        return None
    last_fee = fee_hits[-1]
    if rent_hits and rent_hits[-1].start() > last_fee.start():
        return None
    # Use the first fee keyword of the run ("điện nước 100k" starts at "điện").
    return window_start + clause_offset + fee_hits[0].start()


def find_spans(view: TextView) -> list[Span]:
    rules = load_rules()
    spans: list[Span] = []
    taken: dict[str, list[tuple[int, int]]] = {"NUM": [], "ROOM": [], "LOC": []}
    for rule in rules.rules:
        haystack = view.folded if rule.view == "folded" else view.lower
        group = "NUM" if rule.label in NUMERIC_LABELS else rule.label
        for m in rule.regex.finditer(haystack):
            vs, ve = m.start(), m.end()
            while ve > vs and haystack[ve - 1].isspace():
                ve -= 1
            if ve <= vs or _overlaps((vs, ve), taken[group]):
                continue
            label = rule.label
            if rule.id in MONEY_RULES:
                fee_at = _fee_start(view, vs, rules)
                if fee_at is not None:
                    label = "FEE"
                    if not _overlaps((fee_at, vs), taken[group]):
                        vs = fee_at
                    suffix = FEE_SUFFIX_RE.match(view.folded, ve)
                    if suffix:
                        ve = suffix.end()
            taken[group].append((vs, ve))
            s, e, quote = view.quote(vs, ve)
            spans.append(Span(s, e, quote, label, "regex", rule.id))
    spans.sort(key=lambda sp: (sp.start, sp.end))
    return spans


@dataclass
class Segment:
    index: int
    start: int  # code points
    end: int
    marker: Span


def find_segments(view: TextView, spans: list[Span]) -> list[Segment]:
    """Listing segments from markers P1/P2/phòng 1/phòng 2 (needs >= 2 increasing markers,
    each followed by its own price). Text after the last segment's sentence is shared."""
    rules = load_rules()
    markers = []
    for m in rules.marker.finditer(view.folded):
        number = int(m.group(1))
        s, e, quote = view.quote(m.start(), m.end())
        markers.append((number, s, e, quote))
    # keep an increasing run starting at 1
    run = []
    for number, s, e, quote in markers:
        if number == len(run) + 1:
            run.append((s, e, quote))
    if len(run) < 2:
        return []
    segments = []
    text = view.text
    for i, (s, e, quote) in enumerate(run):
        end = run[i + 1][0] if i + 1 < len(run) else len(text)
        segments.append(Segment(i, s, end, Span(s, e, quote, "ROOM", "regex", "LISTING_MARKER", i)))
    # Last segment ends at the sentence break after its first price.
    last = segments[-1]
    prices = [sp for sp in spans if sp.label == "PRICE" and last.start <= sp.start < last.end]
    if prices:
        stop = re.search(r"[.;!\n]", text[prices[0].end:])
        if stop:
            last.end = prices[0].end + stop.start()
    for seg in segments:
        if not any(sp.label == "PRICE" and seg.start <= sp.start < seg.end for sp in spans):
            return []
    return segments


def assign_listings(spans: list[Span], segments: list[Segment]) -> int:
    """Set `listing_index` on spans inside a segment; returns the listing count."""
    if not segments:
        for sp in spans:
            sp.listing_index = None
        return 1
    for sp in spans:
        sp.listing_index = None
        for seg in segments:
            if seg.start <= sp.start < seg.end:
                sp.listing_index = seg.index
                break
    return len(segments)


def pair_without_markers(spans: list[Span]) -> int:
    """'phòng 20m2 2tr8, phòng 30m2 3tr5': equal numbers of areas and distinct exact prices
    alternating in order are paired. Returns the listing count (1 when not applicable)."""
    seq = [sp for sp in spans if sp.label in {"AREA", "PRICE"} and sp.rule_id != "PRICE_HIDDEN"]
    areas = [sp for sp in seq if sp.label == "AREA"]
    prices = [sp for sp in seq if sp.label == "PRICE"]
    if len(areas) < 2 or len(areas) != len(prices):
        return 1
    labels = [sp.label for sp in seq]
    pattern_ap = ["AREA", "PRICE"] * len(areas)
    pattern_pa = ["PRICE", "AREA"] * len(areas)
    if labels not in (pattern_ap, pattern_pa):
        return 1
    if len({sp.quote for sp in prices}) < 2:
        return 1
    for i in range(len(areas)):
        areas[i].listing_index = i
        prices[i].listing_index = i
    return len(areas)
