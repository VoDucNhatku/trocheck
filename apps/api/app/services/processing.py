"""Run the pipeline for a post version and store the result as a new extraction run (M6),
then M8 dedup. Re-processing never overwrites history: older listings become non-current.
"""
from __future__ import annotations

from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app.core.config import Settings
from app.models import Cluster, ExtractionRun, Job, Listing, LlmCache, Post, PostVersion
from app.pipeline import dedup
from app.pipeline.engine import PipelineResult, run_pipeline
from app.pipeline.llm_extractor import LlmClient, prompt_version
from app.pipeline.normalize import location_key
from app.pipeline.places import places_for
from app.services import jobs
from app.services.serialize import field_rows, lookup_columns


def cache_key(text_hash: str, model_id: str) -> str:
    return f"{text_hash}:{prompt_version()}:{model_id}"


def run_for_version(session: Session, version: PostVersion, *, llm: LlmClient | None, settings: Settings,
                    mode: str = "production") -> PipelineResult:
    cached = None
    if llm is not None:
        hit = session.get(LlmCache, cache_key(version.text_hash, llm.model_id))
        cached = hit.output_json if hit else None
    result = run_pipeline(version.text, mode=mode, llm=llm, places=places_for(version.post.is_demo),
                          llm_max_attempts=settings.llm_max_attempts, llm_cached=cached)
    if (llm is not None and cached is None and result.llm is not None and result.llm.status == "ok"
            and result.llm.raw is not None):
        session.merge(LlmCache(key=cache_key(version.text_hash, llm.model_id), output_json=result.llm.raw))
    return result


def store_run(session: Session, post: Post, version: PostVersion, result: PipelineResult, *,
              job_id: str | None, mode: str, settings: Settings) -> ExtractionRun:
    llm = result.llm
    places = places_for(post.is_demo)
    run = ExtractionRun(
        post_version_id=version.id, job_id=job_id, mode=mode,
        pipeline_version=result.versions["pipeline_version"], regex_version=result.versions["regex_version"],
        prompt_version=result.versions["prompt_version"], model_id=result.versions["model_id"],
        normalizer_version=result.versions["normalizer_version"], lexicon_version=places.version,
        post_type=result.extraction["post_type"], llm_status=result.llm_status,
        llm_error_code=llm.error_code if llm else None, llm_calls=llm.calls if llm else 0,
        latency_ms=llm.latency_ms if llm else 0, tokens_in=llm.tokens_in if llm else 0,
        tokens_out=llm.tokens_out if llm else 0, dropped_quotes=llm.dropped_quotes if llm else 0,
        regex_spans=[_span(sp) for sp in result.regex_spans],
        llm_spans=[_span(sp) for sp in result.llm_spans],
    )
    session.add(run)
    session.flush()

    previous = {
        lst.listing_index: lst for lst in session.scalars(
            select(Listing).where(Listing.post_id == post.id, Listing.is_current.is_(True)))
    }
    session.execute(update(Listing).where(Listing.post_id == post.id, Listing.is_current.is_(True))
                    .values(is_current=False).execution_options(synchronize_session="fetch"))

    post.post_type = result.extraction["post_type"]
    post.status = "extracted" if post.post_type == "rental_offer" else "rejected_type"
    observed = post.posted_at or post.first_seen_at

    new_listings = []
    for data, meta in zip(result.extraction["listings"], result.listing_meta):
        listing = Listing(run_id=run.id, post_id=post.id, listing_index=data["listing_index"],
                          review_status=meta.review_status, review_reasons=list(meta.review_reasons),
                          is_current=True, observed_at=observed, **lookup_columns(data))
        listing.fields = field_rows(data)
        old = previous.get(data["listing_index"])
        if old is not None and old.cluster_id:
            listing.cluster_id = old.cluster_id
        session.add(listing)
        new_listings.append(listing)
    session.flush()
    for listing in new_listings:
        if listing.cluster_id is None:
            assign_cluster(session, listing, post, version, settings)
        else:
            _touch_cluster(session, listing.cluster_id)
    return run


def _span(sp) -> dict:
    return {"start": sp.start, "end": sp.end, "quote": sp.quote, "label": sp.label, "method": sp.method,
            "rule_id": sp.rule_id, "listing_index": sp.listing_index}


def _item(listing: Listing, text: str) -> dedup.DedupItem:
    landmark = None
    for row in listing.fields:
        if row.field == "location":
            landmark = location_key(row.value_json.get("landmark") or row.value_json.get("street"))
    return dedup.DedupItem(
        listing_id=listing.id, cluster_id=listing.cluster_id, post_id=listing.post_id,
        property_type=listing.property_type or "unknown", ward_code=listing.ward_code, landmark_key=landmark,
        area_m2=listing.area_m2, rent_vnd=listing.rent_amount_vnd if listing.rent_form == "exact" else None,
        text=text)


def assign_cluster(session: Session, listing: Listing, post: Post, version: PostVersion, settings: Settings) -> None:
    """M8: merge into a cluster, suggest a merge for review, or open a new cluster."""
    cfg = dedup.DedupConfig(settings.dedup_area_tolerance_m2, settings.dedup_price_tolerance_percent,
                            settings.dedup_suggest_cosine, settings.dedup_auto_cosine)
    decision = dedup.DedupDecision("separate", None, 0.0, None)
    if listing.property_type and listing.property_type != "unknown":
        rows = session.execute(
            select(Listing, PostVersion.text)
            .join(Post, Post.id == Listing.post_id)
            .join(PostVersion, PostVersion.id == Post.current_version_id)
            .where(Listing.is_current.is_(True), Listing.id != listing.id, Listing.post_id != post.id,
                   Listing.property_type == listing.property_type, Post.is_demo.is_(post.is_demo),
                   Listing.review_status != "rejected")
            .options(selectinload(Listing.fields))
        ).all()
        candidates = [_item(lst, text) for lst, text in rows]
        if candidates:
            tfidf = dedup.TfIdf([c.text for c in candidates] + [version.text])
            decision = dedup.decide(_item(listing, version.text), candidates, tfidf, cfg)
    if decision.action == "merge" and decision.cluster_id:
        listing.cluster_id = decision.cluster_id
        cluster = session.get(Cluster, decision.cluster_id)
        cluster.merge_reason = f"auto: cosine {decision.cosine} with {decision.other_listing_id}"
    else:
        cluster = Cluster(merge_reason=None)
        session.add(cluster)
        session.flush()
        listing.cluster_id = cluster.id
        if decision.action == "suggest":
            listing.review_reasons = [*listing.review_reasons, "possible_duplicate"]
            listing.review_status = "needs_review"
    session.flush()
    _touch_cluster(session, listing.cluster_id)


def _touch_cluster(session: Session, cluster_id: str) -> None:
    latest = session.scalar(
        select(Listing.id).where(Listing.cluster_id == cluster_id, Listing.is_current.is_(True),
                                 Listing.review_status.not_in(("rejected",)))
        .order_by(Listing.observed_at.desc(), Listing.id.desc()).limit(1))
    cluster = session.get(Cluster, cluster_id)
    if cluster is not None:
        cluster.latest_listing_id = latest


def process_job(session: Session, job: Job, *, llm: LlmClient | None, settings: Settings) -> ExtractionRun | None:
    """Everything in the caller's transaction, including job -> succeeded."""
    version = session.get(PostVersion, job.post_version_id)
    if version is None:  # post removed meanwhile
        jobs.mark_succeeded(job)
        return None
    post = version.post
    result = run_for_version(session, version, llm=llm, settings=settings)
    run = store_run(session, post, version, result, job_id=job.id, mode="production", settings=settings)
    jobs.mark_succeeded(job)
    return run
