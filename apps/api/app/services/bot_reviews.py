"""Queue and persist shadow reviews; never change listings or human review events."""
from __future__ import annotations

from collections import Counter
from datetime import timedelta

from sqlalchemy import exists, func, select, update
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.ids import iso, utcnow, vn_day_start
from app.models import BotReview, ExtractionRun, Job, Listing, Post, PostVersion, ReviewEvent
from app.pipeline import review_bot
from app.pipeline.llm_extractor import LlmClient
from app.services import jobs, serialize


def enabled(settings: Settings) -> bool:
    return bool(settings.review_bot_enabled and settings.gemini_api_key
                and (settings.review_bot_model_id or settings.gemini_model_id))


def calls_today(session: Session) -> int:
    return session.scalar(select(func.coalesce(func.sum(BotReview.llm_calls), 0))
                          .where(BotReview.created_at >= vn_day_start()))


def _pending():
    return (select(Listing).join(ExtractionRun, Listing.run_id == ExtractionRun.id)
            .join(Post, Listing.post_id == Post.id)
            .where(Listing.is_current.is_(True), Listing.review_status == "needs_review",
                   Post.is_demo.is_(False),
                   ExtractionRun.post_version_id == Post.current_version_id,
                   ~exists().where(BotReview.listing_id == Listing.id, BotReview.status == "ok",
                                   BotReview.prompt_version == review_bot.prompt_version())))


def enqueue_backlog(session: Session, settings: Settings, *, limit: int = 1000,
                    post_version_id: str | None = None) -> int:
    """Limit counts listings; a version containing several listings needs only one job."""
    if not enabled(settings):
        return 0
    query = _pending().where(~exists().where(
        Job.kind == "bot_review", Job.post_version_id == ExtractionRun.post_version_id,
        Job.status.in_(("queued", "running"))))
    if post_version_id is not None:
        query = query.where(ExtractionRun.post_version_id == post_version_id)
    listings = session.scalars(query.order_by(Listing.created_at, Listing.id).limit(limit)).all()
    count = 0
    for version_id in dict.fromkeys(listing.run.post_version_id for listing in listings):
        active = session.scalar(select(Job.id).where(
            Job.kind == "bot_review", Job.post_version_id == version_id,
            Job.status.in_(("queued", "running"))).limit(1))
        if active is None:
            jobs.enqueue(session, kind="bot_review", post_version_id=version_id)
            session.flush()
            count += 1
    return count


def _job_pending(job: Job):
    # Terminal errors finish this listing for this job; a new backlog job may retry it.
    return _pending().where(ExtractionRun.post_version_id == job.post_version_id,
                            ~exists().where(BotReview.listing_id == Listing.id,
                                            BotReview.prompt_version == review_bot.prompt_version(),
                                            BotReview.checks["job_id"].as_string() == job.id,
                                            BotReview.status == "error",
                                            BotReview.checks["retryable"].as_boolean().is_(False)))


def _budget_code(session: Session, settings: Settings) -> str | None:
    from app.services.processing import llm_calls_today

    if settings.llm_daily_call_limit and llm_calls_today(session) >= settings.llm_daily_call_limit:
        return "llm_daily_limit"
    if settings.review_bot_daily_call_limit and calls_today(session) >= settings.review_bot_daily_call_limit:
        return "review_bot_daily_limit"
    return None


def process_job(session: Session, job: Job, *, llm: LlmClient | None, settings: Settings) -> None:
    if not enabled(settings) or llm is None or not job.post_version_id:
        jobs.mark_succeeded(job)
        return
    version = session.get(PostVersion, job.post_version_id)
    if version is None or version.post.current_version_id != version.id:
        jobs.mark_succeeded(job)
        return
    listing = session.scalar(_job_pending(job).order_by(Listing.listing_index).limit(1))
    if listing is None:
        jobs.mark_succeeded(job)
        return
    code = _budget_code(session, settings)
    if code:
        jobs.defer(session, job.id, until=vn_day_start() + timedelta(days=1), code=code)
        return
    job_id, version_id = job.id, version.id
    owner, attempt = job.locked_by, job.attempt
    listing_id, listing_version = listing.id, listing.version
    fields, reasons, text = serialize.listing_dict(listing), list(listing.review_reasons), version.text
    prompt = review_bot.prompt_version()
    # End even the read transaction before waiting for the model. No ORM access in this gap.
    session.rollback()
    started_at = utcnow()
    outcome = review_bot.review(text, fields, reasons, llm)

    # Fence an expired/reclaimed job, then serialize result writers for this version only.
    claimed = session.execute(update(Job).where(
        Job.id == job_id, Job.status == "running", Job.locked_by == owner, Job.attempt == attempt)
        .values(updated_at=utcnow()).execution_options(synchronize_session=False))
    if claimed.rowcount != 1:
        return
    session.execute(update(PostVersion).where(PostVersion.id == version_id)
                    .values(text_complete=PostVersion.text_complete))
    session.expire_all()
    job = session.get(Job, job_id)
    current = session.scalar(_pending().where(Listing.id == listing_id))
    stored = session.get(Listing, listing_id)
    if stored is not None and not stored.post.is_demo:
        if current is None or current.version != listing_version:
            outcome.status, outcome.verdict, outcome.confidence = "error", None, None
            outcome.error_code, outcome.retryable = "review_superseded", False
            outcome.reason = "Kết quả không còn áp dụng cho phiên bản hiện hành hoặc đã có kết quả thành công."
        session.add(BotReview(
            listing_id=listing_id, listing_version=listing_version, model_id=llm.model_id,
            prompt_version=prompt, status=outcome.status, verdict=outcome.verdict,
            confidence=outcome.confidence,
            checks=outcome.checks if outcome.status == "ok" else {"retryable": outcome.retryable, "job_id": job_id},
            reason=outcome.reason,
            error_code=outcome.error_code, llm_calls=outcome.calls,
            tokens_in=outcome.tokens_in, tokens_out=outcome.tokens_out, created_at=started_at))
        session.flush()
        if outcome.retryable:
            jobs.mark_failed(session, job.id, code=outcome.error_code or "llm_error",
                             message=outcome.reason, max_attempts=settings.job_max_attempts)
            return
    if session.scalar(_job_pending(job).limit(1)) is not None:
        code = _budget_code(session, settings)
        jobs.defer(session, job_id, until=vn_day_start() + timedelta(days=1) if code else utcnow(),
                   code=code or "review_bot_more")
        return
    jobs.mark_succeeded(job)


def _human_decisions(session: Session, rows: list[BotReview]) -> dict[str, str | None]:
    """Match the first decision made against the exact snapshot the bot reviewed."""
    if not rows:
        return {}
    events: dict[str, list[ReviewEvent]] = {}
    for event in session.scalars(select(ReviewEvent).where(
        ReviewEvent.listing_id.in_({row.listing_id for row in rows}))
        .order_by(ReviewEvent.created_at, ReviewEvent.id)):
        events.setdefault(event.listing_id, []).append(event)
    result = {}
    for row in rows:
        decision = None
        if row.status != "ok":
            result[row.id] = None
            continue
        for index, event in enumerate(events.get(row.listing_id, []), start=1):
            version = (event.before_json or {}).get("version", index)
            if version == row.listing_version and event.created_at >= row.created_at:
                if event.action in ("approve", "reject"):
                    decision = event.action
                break
        result[row.id] = decision
    return result


def summary(session: Session, settings: Settings) -> dict:
    rows = session.scalars(select(BotReview).join(Listing).join(Post, Listing.post_id == Post.id)
                           .where(Post.is_demo.is_(False)).order_by(BotReview.created_at, BotReview.id)).all()
    by_status = dict.fromkeys(("ok", "error"), 0)
    by_status.update(Counter(row.status for row in rows))
    by_verdict = dict.fromkeys(("approve", "reject", "unsure"), 0)
    by_verdict.update(Counter(row.verdict for row in rows if row.status == "ok"))
    latest = {}
    for row in rows:
        if row.status == "ok":
            latest[row.listing_id] = row
    decisions = _human_decisions(session, list(latest.values()))
    paired = [(row.verdict, decisions[row.id]) for row in latest.values() if decisions[row.id] is not None]
    agree = sum(bot == human for bot, human in paired)
    return {
        "enabled": settings.review_bot_enabled, "by_status": by_status, "by_verdict": by_verdict,
        "compared": len(paired), "agreed": agree,
        "agreement_rate": agree / len(paired) if paired else None,
        "bot_approve_human_reject": paired.count(("approve", "reject")),
        "bot_reject_human_approve": paired.count(("reject", "approve")),
        "unsure_share": by_verdict["unsure"] / by_status["ok"] if by_status["ok"] else None,
    }


def page(session: Session, *, page: int = 1, page_size: int = 50) -> dict:
    rows = session.scalars(select(BotReview).order_by(BotReview.created_at.desc(), BotReview.id.desc())
                           .offset((page - 1) * page_size).limit(page_size)).all()
    decisions = _human_decisions(session, rows)
    return {"items": [{"id": row.id, "listing_id": row.listing_id, "listing_version": row.listing_version,
                       "model_id": row.model_id, "prompt_version": row.prompt_version, "status": row.status,
                       "verdict": row.verdict, "confidence": row.confidence, "reason": row.reason,
                       "error_code": row.error_code, "created_at": iso(row.created_at),
                       "human_decision": decisions[row.id]} for row in rows],
            "total": session.scalar(select(func.count()).select_from(BotReview)),
            "page": page, "page_size": page_size}
