"""Pipeline M1 -> M5 for one post text. Shared by the worker, the Lab page and eval/run_eval.py,
so the numbers in the report come from the same code the user sees.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.pipeline import normalize as n
from app.pipeline.assemble import build_listings, empty_draft
from app.pipeline.classify import classify, classifier_version
from app.pipeline.llm_extractor import LlmClient, LlmOutcome, extract, prompt_version
from app.pipeline.places import Places, real_places
from app.pipeline.preprocess import TextView
from app.pipeline.reconcile import ListingMeta, finalize_status, reconcile
from app.pipeline.regex_extractor import (Span, assign_listings, find_segments, find_spans,
                                          pair_without_markers, regex_version)

PIPELINE_VERSION = "1.0.0"
MODES = ("production", "eval_regex", "eval_llm", "eval_hybrid")


@dataclass
class PipelineResult:
    extraction: dict
    listing_meta: list[ListingMeta]
    llm_status: str  # ok | not_run | error
    llm: LlmOutcome | None
    regex_spans: list[Span]
    llm_spans: list[Span]
    versions: dict
    post_type_confident: bool
    money_count: int
    llm_reasons: list[str] = field(default_factory=list)

    @property
    def partial(self) -> bool:
        return self.llm_status == "error"


def versions(model_id: str | None = None) -> dict:
    return {
        "pipeline_version": PIPELINE_VERSION,
        "regex_version": regex_version(),
        "classifier_version": classifier_version(),
        "prompt_version": prompt_version(),
        "normalizer_version": n.NORMALIZER_VERSION,
        "model_id": model_id,
    }


def llm_triggers(spans: list[Span], count: int, money_count: int, confident: bool) -> list[str]:
    """Economy mode: when the LLM is worth calling (pipeline-xu-ly §M5)."""
    reasons = []
    labels = [sp for sp in spans if sp.label == "PRICE" and sp.rule_id != "PRICE_HIDDEN"]
    if not labels:
        reasons.append("missing_price")
    if not any(sp.label == "AREA" for sp in spans):
        reasons.append("missing_area")
    if money_count >= 3:
        reasons.append("many_amounts")
    if count > 1 or len({sp.quote for sp in labels}) > 1:
        reasons.append("multi_listing")
    if labels and all(n.parse_rent(sp.quote)["basis"] == "unknown" for sp in labels):
        reasons.append("basis_unknown")
    if not confident:
        reasons.append("post_type_uncertain")
    return reasons


def _llm_count(spans: list[Span]) -> int:
    return max((sp.listing_index or 0 for sp in spans), default=0) + 1


def run_pipeline(text: str, *, mode: str = "production", llm: LlmClient | None = None,
                 places: Places | None = None, llm_max_attempts: int = 3,
                 llm_cached: dict | None = None, sleep=None) -> PipelineResult:
    if mode not in MODES:
        raise ValueError(f"unknown mode {mode}")
    places = places or real_places()
    view = TextView.build(text)
    spans = find_spans(view)
    segments = find_segments(view, spans)
    count = assign_listings(spans, segments)
    if count == 1:
        count = pair_without_markers(spans)
    for seg in segments:
        spans.append(seg.marker)
    spans.sort(key=lambda sp: (sp.start, sp.end))
    money_count = sum(1 for sp in spans if sp.label in ("PRICE", "FEE")
                      and sp.rule_id in ("PRICE_RANGE", "PRICE_FROM", "PRICE_MONEY", "PRICE_BIGNUM"))
    has_price_or_area = any(sp.label in ("AREA",) or sp.rule_id in ("PRICE_MONEY", "PRICE_BIGNUM",
                            "PRICE_RANGE", "PRICE_FROM") and sp.label == "PRICE" for sp in spans)
    cls = classify(view.folded, has_price_or_area=has_price_or_area)

    # Decide whether to call the LLM.
    reasons: list[str] = []
    want_llm = False
    if mode in ("eval_llm", "eval_hybrid"):
        want_llm = True
    elif mode == "production" and (llm is not None or llm_cached is not None):
        if cls.confident and cls.post_type != "rental_offer":
            want_llm = False
        else:
            reasons = llm_triggers(spans, count, money_count, cls.confident)
            want_llm = bool(reasons)

    outcome: LlmOutcome | None = None
    llm_status = "not_run"
    if want_llm and (llm is not None or llm_cached is not None):
        kwargs = {"sleep": sleep} if sleep else {}
        outcome = extract(text, llm, max_attempts=llm_max_attempts, cached=llm_cached, **kwargs)
        llm_status = outcome.status
    elif want_llm and mode in ("eval_llm", "eval_hybrid"):
        llm_status = "error"
        outcome = LlmOutcome("error", error_code="llm_not_configured")

    post_type = cls.post_type
    if not cls.confident and outcome is not None and outcome.status == "ok" and outcome.post_type:
        post_type = outcome.post_type
    if mode == "eval_llm" and outcome is not None and outcome.status == "ok" and outcome.post_type:
        post_type = outcome.post_type

    llm_spans = outcome.spans if outcome is not None and outcome.status == "ok" else []
    listings: list[dict] = []
    metas: list[ListingMeta] = []
    if post_type == "rental_offer":
        regex_drafts = build_listings(spans, count, places) if mode != "eval_llm" else []
        llm_drafts = None
        if outcome is not None and outcome.status == "ok":
            llm_drafts = build_listings(llm_spans, _llm_count(llm_spans), places) if llm_spans else []
        if mode == "eval_llm":
            regex_drafts = []
            if not llm_drafts:
                llm_drafts = [empty_draft(0, places)] if outcome and outcome.status == "ok" else None
        if not regex_drafts and not llm_drafts:
            regex_drafts = [empty_draft(0, places)]
        listings, metas = reconcile(regex_drafts, llm_drafts if mode != "eval_regex" else None,
                                    llm_status=llm_status if mode != "eval_regex" else "not_run",
                                    money_count=money_count)
        total = len(listings)
        for listing, meta in zip(listings, metas):
            _apply_context_rules(listing, post_type=post_type, listing_count=total, text=text)
            finalize_status(listing, meta, total)

    return PipelineResult(
        extraction={"post_type": post_type, "listings": listings},
        listing_meta=metas,
        llm_status=llm_status,
        llm=outcome,
        regex_spans=spans,
        llm_spans=llm_spans,
        versions=versions(getattr(llm, "model_id", None)),
        post_type_confident=cls.confident,
        money_count=money_count,
        llm_reasons=reasons,
    )


def _apply_context_rules(listing: dict, *, post_type: str, listing_count: int, text: str) -> None:
    rent = listing["rent"]
    applied = [n.ctx_period_month(rent, post_type=post_type),
               n.ctx_basis_unit_single(rent, property_type=listing["room"]["property_type"],
                                       listing_count=listing_count, text=text)]
    applied = [a for a in applied if a]
    if applied and rent.get("evidence"):
        # Record context rules on the evidence so reviewers see what was inferred (§6).
        first = rent["evidence"][0]
        first["rule_id"] = ";".join([first.get("rule_id") or first["method"], *applied])
