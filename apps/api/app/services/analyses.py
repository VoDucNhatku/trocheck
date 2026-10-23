"""Assess mode (J1): POST /analyses, GET /analyses/{id}, POST /analyses/{id}/contribute.

`analysis_id` is the post id. Posts analysed without contributing stay out of the market
(contributed = false) until the user presses Đóng góp.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import ApiError, not_found
from app.models import ExtractionRun, IdempotencyKey, Job, Listing, Post, User
from app.schemas import IngestPost
from app.services import ingest, serialize
from app.services.users import has_role


def create(session: Session, user: User, post_in: IngestPost, settings: Settings) -> dict:
    if session.get(IdempotencyKey, (post_in.idempotency_key, user.id)) is None:
        if ingest.running_analyses(session, user) >= settings.max_running_analyses_per_user:
            raise ApiError(429, message="Đang có một bài đang phân tích, chờ xong rồi gửi tiếp",
                           headers={"Retry-After": "5"})
    # A user-facing, explicitly labelled fixture must never enter real-market data.
    result = ingest.ingest_post(session, user, post_in, mode="assess", contributed=False,
                                is_demo=post_in.source_type == "fixture")
    session.commit()
    return {"analysis_id": result.post_id, "status": _job_status(session, result.post_id)}


def _latest_job(session: Session, post: Post) -> Job | None:
    return session.scalar(select(Job).where(Job.post_version_id == post.current_version_id)
                          .order_by(Job.created_at.desc()).limit(1))


def _job_status(session: Session, post_id: str) -> str:
    post = session.get(Post, post_id)
    job = _latest_job(session, post)
    return job.status if job else "succeeded"


def can_view(session: Session, user: User, post: Post) -> bool:
    if post.collector_id == user.id or has_role(user, "reviewer", "researcher"):
        return True
    return session.scalar(select(IdempotencyKey.key).where(IdempotencyKey.user_id == user.id,
                                                           IdempotencyKey.result_ref == post.id).limit(1)) is not None


def get(session: Session, user: User, analysis_id: str) -> dict:
    post = session.get(Post, analysis_id)
    if post is None or not can_view(session, user, post):
        raise not_found("Không tìm thấy phân tích")
    job = _latest_job(session, post)
    status = job.status if job else "succeeded"
    run = session.scalar(select(ExtractionRun).where(ExtractionRun.post_version_id == post.current_version_id)
                         .order_by(ExtractionRun.created_at.desc()).limit(1))
    listings = []
    if run is not None:
        rows = session.scalars(select(Listing).where(Listing.run_id == run.id).order_by(Listing.listing_index))
        listings = [serialize.listing_dict(lst) for lst in rows]
    if run is not None and status in ("queued", "running") and job and job.kind == "reprocess":
        status = job.status
    error = None
    if job is not None and job.status == "failed":
        error = {"code": job.error_code, "message": "Xử lý thất bại, nhóm sẽ xử lý lại"}
    return {
        "analysis_id": post.id,
        "status": status,
        "post_type": run.post_type if run else None,
        "partial": bool(run and run.llm_status == "error"),
        "llm_status": run.llm_status if run else None,
        "contributed": post.contributed,
        "is_demo": post.is_demo,
        "text_complete": post.current_version.text_complete if post.current_version else False,
        "text": post.current_version.text if post.current_version else None,
        "listings": listings if status == "succeeded" or run is not None else [],
        "error": error,
    }


def contribute(session: Session, user: User, analysis_id: str) -> dict:
    post = session.get(Post, analysis_id)
    if post is None or not can_view(session, user, post):
        raise not_found("Không tìm thấy phân tích")
    post.contributed = True
    session.commit()
    return {"contributed": True}
