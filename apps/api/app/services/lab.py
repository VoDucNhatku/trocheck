"""Lab page (researcher): Regex vs LLM vs gold on one post, with BIO tokens.

No LLM call inside an HTTP request (kien-truc §1): the LLM column comes from the stored run of
the post or from the LLM cache; otherwise it is reported as not available.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import ApiError, forbidden, not_found
from app.models import ExtractionRun, GoldAnnotation, LlmCache, Post
from app.pipeline.engine import run_pipeline
from app.pipeline.llm_extractor import LlmOutput, ground, prompt_version
from app.pipeline.places import places_for
from app.pipeline.preprocess import text_hash, tokenize
from app.pipeline.privacy import mask_phones


def bio_tags(text: str, spans: list[dict]) -> list[str]:
    """BIO tag per token of the shared tokenizer; a token inside a span gets B- then I-."""
    tags, begun = [], set()
    for start, end, _ in tokenize(text):
        tag = "O"
        for i, sp in enumerate(spans):
            if sp["start"] <= start and end <= sp["end"]:
                tag = ("I-" if i in begun else "B-") + sp["label"]
                begun.add(i)
                break
        tags.append(tag)
    return tags


def _fmt(listings: list[dict], field: str) -> str:
    vals = []
    for lst in listings:
        v = lst.get(field) if field != "fees" else lst.get("fees")
        if field == "rent":
            vals.append(f"{v['amount_form']}:{v.get('amount_vnd') or v.get('min_vnd') or '-'}"
                        f"/{v['basis']}/{v['period']}" if v else "-")
        elif field == "area":
            vals.append(f"{v.get('value_m2') or (v.get('min_m2'), v.get('max_m2'))}" if v else "-")
        elif field == "room":
            vals.append(v.get("property_type", "-") if v else "-")
        elif field == "location":
            vals.append(v.get("ward_code") or v.get("street") or v.get("landmark") or "-" if v else "-")
        elif field == "fees":
            vals.append(",".join(f"{f['type']}:{f.get('amount_vnd')}" for f in v or []) or "-")
    return " | ".join(vals) or "-"


def run(session: Session, settings: Settings, *, text: str | None, post_id: str | None) -> dict:
    if not text and not post_id:
        raise ApiError(422, message="Cần text hoặc post_id", field_errors={"text": "required"})
    llm_payload = None
    is_demo = False
    gold = None
    if post_id:
        post = session.get(Post, post_id)
        if post is None or post.current_version is None:
            raise not_found()
        text = post.current_version.text
        is_demo = post.is_demo
        stored = session.scalar(select(ExtractionRun).where(ExtractionRun.post_version_id == post.current_version_id,
                                                            ExtractionRun.llm_status == "ok")
                                .order_by(ExtractionRun.created_at.desc()).limit(1))
        if stored is not None:
            cached = session.get(LlmCache, f"{post.current_version.text_hash}:{stored.prompt_version}:{stored.model_id}")
            llm_payload = cached.output_json if cached else None
        gold = session.scalar(select(GoldAnnotation).where(GoldAnnotation.post_version_id == post.current_version_id))
    else:
        text = mask_phones(text)
    if llm_payload is None and settings.gemini_model_id:
        hit = session.get(LlmCache, f"{text_hash(text)}:{prompt_version()}:{settings.gemini_model_id}")
        llm_payload = hit.output_json if hit else None

    places = places_for(is_demo)
    regex = run_pipeline(text, mode="eval_regex", places=places)
    regex_spans = [vars(sp) for sp in regex.regex_spans]
    llm_spans: list[dict] = []
    llm_listings: list[dict] = []
    if llm_payload is not None:
        spans, _ = ground(text, LlmOutput.model_validate(llm_payload))
        llm_spans = [vars(sp) for sp in spans]
        llm_listings = run_pipeline(text, mode="eval_llm", places=places, llm_cached=llm_payload).extraction["listings"]

    gold_spans = []
    gold_listings = None
    split = None
    if gold is not None:
        split = gold.split
        if gold.split == "test":
            gold = None  # test labels stay locked until the frozen run (AT18)
        else:
            gold_spans = gold.spans_json
            gold_listings = (gold.listings_json or {}).get("listings")

    tokens = tokenize(text)
    regex_tags, llm_tags = bio_tags(text, regex_spans), bio_tags(text, llm_spans)
    gold_tags = bio_tags(text, gold_spans) if gold_listings is not None else None
    normalized = [{"field": f, "regex": _fmt(regex.extraction["listings"], f),
                   "llm": _fmt(llm_listings, f) if llm_payload is not None else "chưa có (LLM chưa chạy cho bài này)",
                   "gold": _fmt(gold_listings, f) if gold_listings is not None else None}
                  for f in ("rent", "area", "room", "location", "fees")]
    return {
        "post_id": post_id,
        "text": text,
        "split": split,
        "post_type": regex.extraction["post_type"],
        "rows": [{"method": "regex", "evidence": regex_spans},
                 {"method": "llm", "evidence": llm_spans, "available": llm_payload is not None}],
        "tokens": [{"token": tok, "regex": regex_tags[i], "llm": llm_tags[i],
                    "gold": gold_tags[i] if gold_tags else None} for i, (_, _, tok) in enumerate(tokens)],
        "normalized": normalized,
        "listings": {"regex": regex.extraction["listings"], "llm": llm_listings},
    }


def gold_for(session: Session, post_id: str) -> dict:
    post = session.get(Post, post_id)
    gold = session.scalar(select(GoldAnnotation).where(GoldAnnotation.post_version_id == post.current_version_id)) \
        if post else None
    if gold is None:
        raise not_found("Bài này không có nhãn chuẩn")
    if gold.split == "test":
        raise forbidden("Nhãn tập test bị khóa cho tới lần chạy đóng băng")
    return {"post_id": post_id, "split": gold.split, "cluster_key": gold.cluster_key, "spans": gold.spans_json,
            "expected": gold.listings_json, "adjudicated": gold.adjudicated}
