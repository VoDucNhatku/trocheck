"""Re-run the deterministic extraction for real posts whose latest run used older rules (task P1).

Rules improve (price digits, area, room type, price basis, old districts); posts stored before keep their old
listings until something re-reads them. This step re-reads them with the regex pipeline only (no LLM call),
once per rule set: a post is a candidate when the latest run of its current version carries a different
(pipeline, regex, normalizer, lexicon) version than the code now running. It is idempotent.

Never touched: demo posts; posts with a queued/running job; posts whose latest run used the LLM successfully
(re-reading without the LLM could lose information); posts with any current listing decided by a person or the
review bot (approved, rejected, duplicate). Those decisions stay exactly as they are.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models import ExtractionRun, Job, Listing, Post, PostVersion
from app.pipeline.engine import versions
from app.pipeline.places import real_places
from app.services.processing import run_for_version, store_run

DECIDED = ("approved", "rejected", "duplicate")


@dataclass
class Counts:
    checked: int = 0
    reprocessed: int = 0
    up_to_date: int = 0
    kept_decided: int = 0
    kept_llm: int = 0
    kept_busy: int = 0
    no_run: int = 0
    errors: int = 0

    def as_dict(self) -> dict:
        return asdict(self)


def fingerprint() -> tuple:
    v = versions()
    return (v["pipeline_version"], v["regex_version"], v["normalizer_version"], real_places().version)


def _run_fingerprint(run: ExtractionRun) -> tuple:
    return (run.pipeline_version, run.regex_version, run.normalizer_version, run.lexicon_version)


def _latest_run(session: Session, version_id: str) -> ExtractionRun | None:
    return session.scalar(select(ExtractionRun).where(ExtractionRun.post_version_id == version_id)
                          .order_by(ExtractionRun.created_at.desc(), ExtractionRun.id.desc()).limit(1))


def reprocess_real_posts(session: Session, settings: Settings, *, limit: int = 500) -> dict:
    """Commit after each post so one bad post cannot undo the rest; stop after `limit` reprocessed posts."""
    counts = Counts()
    target = fingerprint()
    post_ids = session.scalars(select(Post.id).where(Post.is_demo.is_(False), Post.current_version_id.is_not(None))
                               .order_by(Post.first_seen_at, Post.id)).all()
    for post_id in post_ids:
        if counts.reprocessed >= limit:
            break
        counts.checked += 1
        post = session.get(Post, post_id)
        version = session.get(PostVersion, post.current_version_id) if post else None
        if version is None:
            counts.no_run += 1
            continue
        run = _latest_run(session, version.id)
        if run is None:
            counts.no_run += 1
            continue
        if _run_fingerprint(run) == target:
            counts.up_to_date += 1
            continue
        if run.llm_status == "ok":
            counts.kept_llm += 1
            continue
        busy = session.scalar(select(Job.id).where(Job.post_version_id == version.id,
                                                    Job.status.in_(("queued", "running"))).limit(1))
        if busy is not None:
            counts.kept_busy += 1
            continue
        decided = session.scalar(select(Listing.id).where(Listing.post_id == post.id, Listing.is_current.is_(True),
                                                           Listing.review_status.in_(DECIDED)).limit(1))
        if decided is not None:
            counts.kept_decided += 1
            continue
        try:
            result = run_for_version(session, version, llm=None, settings=settings)
            store_run(session, post, version, result, job_id=None, mode="production", settings=settings)
            session.commit()
            counts.reprocessed += 1
        except Exception:  # noqa: BLE001 - one post must not stop the batch; the post keeps its old listings
            session.rollback()
            counts.errors += 1
    return counts.as_dict()
