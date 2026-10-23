"""M0 intake: validate, re-mask phones, idempotency, post-level dedup, create job.

Used by POST /ingest/batch (collect), POST /analyses (assess) and the seed/import commands.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, timedelta

from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import ApiError, conflict
from app.core.ids import utcnow
from app.core.security import content_hash
from app.models import IdempotencyKey, Job, Post, PostVersion, User
from app.pipeline.preprocess import text_hash
from app.pipeline.privacy import mask_phones
from app.schemas import IngestPost
from app.services import jobs


@dataclass
class IngestResult:
    idempotency_key: str | None
    status: str  # created | duplicate | rejected
    post_id: str | None = None
    reason: str | None = None
    version_created: bool = False


def _reject(key, reason) -> IngestResult:
    return IngestResult(key, "rejected", reason=reason)


def validate(raw: dict, settings: Settings) -> tuple[IngestPost | None, str | None]:
    """(post, None) or (None, reason) with reason in schema | not_masked | too_long | empty."""
    text = raw.get("text") if isinstance(raw, dict) else None
    if isinstance(text, str):
        if not text.strip():
            return None, "empty"
        if len(text) > settings.max_text_length:
            return None, "too_long"
    if isinstance(raw, dict) and raw.get("phone_masked") is False:
        return None, "not_masked"
    try:
        return IngestPost.model_validate(raw), None
    except ValidationError:
        return None, "schema"


def check_rate(session: Session, user: User, incoming: int, settings: Settings) -> None:
    since = utcnow() - timedelta(minutes=1)
    recent = session.scalar(select(func.count()).select_from(IdempotencyKey)
                            .where(IdempotencyKey.user_id == user.id, IdempotencyKey.created_at >= since))
    if recent + incoming > settings.ingest_rate_per_minute:
        raise ApiError(429, message="Gửi quá nhanh, thử lại sau một phút", headers={"Retry-After": "60"})


def ingest_post(session: Session, user: User, post_in: IngestPost, *, mode: str, contributed: bool,
                is_demo: bool = False) -> IngestResult:
    """One post. Caller commits. Raises 409 when an idempotency key is reused with other content."""
    payload = post_in.model_dump(mode="json")
    request_hash = content_hash(payload)
    seen = session.get(IdempotencyKey, (post_in.idempotency_key, user.id))
    if seen is not None:
        if seen.request_hash != request_hash:
            raise conflict("Idempotency key đã dùng cho nội dung khác")
        return IngestResult(post_in.idempotency_key, "duplicate", seen.result_ref)

    text = mask_phones(post_in.text)  # extension masks first; mask again before storing
    thash = text_hash(text)
    now = utcnow()
    posted_at = post_in.posted_at
    if posted_at is not None and posted_at.tzinfo is not None:
        posted_at = posted_at.astimezone(UTC).replace(tzinfo=None)

    existing = _find_existing(session, post_in, thash)
    result: IngestResult
    if existing is not None:
        existing.last_seen_at = now
        if contributed and not existing.contributed:
            existing.contributed = True
        current = existing.current_version
        if current is not None and current.text_hash != thash and post_in.external_post_id:
            # Same Facebook post, edited text -> new version, old version kept (dedup §1 mức 1).
            version = PostVersion(post_id=existing.id, text=text, text_hash=thash,
                                  text_complete=post_in.text_complete)
            session.add(version)
            session.flush()
            existing.current_version_id = version.id
            jobs.enqueue(session, kind="extract", post_version_id=version.id, requested_by=user.id)
            result = IngestResult(post_in.idempotency_key, "duplicate", existing.id, version_created=True)
        else:
            result = IngestResult(post_in.idempotency_key, "duplicate", existing.id)
    else:
        post = Post(source_type=post_in.source_type, source_group_id=post_in.source_group_id,
                    source_group_name=post_in.source_group_name,
                    permalink=str(post_in.permalink) if post_in.permalink else None,
                    external_post_id=post_in.external_post_id, collector_id=user.id, mode=mode,
                    contributed=contributed, is_demo=is_demo, status="received", first_seen_at=now,
                    last_seen_at=now, posted_at=posted_at, posted_at_raw=post_in.posted_at_raw)
        session.add(post)
        session.flush()
        version = PostVersion(post_id=post.id, text=text, text_hash=thash, text_complete=post_in.text_complete)
        session.add(version)
        session.flush()
        post.current_version_id = version.id
        jobs.enqueue(session, kind="extract", post_version_id=version.id, requested_by=user.id)
        result = IngestResult(post_in.idempotency_key, "created", post.id)

    session.add(IdempotencyKey(key=post_in.idempotency_key, user_id=user.id, request_hash=request_hash,
                               result_ref=result.post_id))
    session.flush()
    return result


def _find_existing(session: Session, post_in: IngestPost, thash: str) -> Post | None:
    if post_in.external_post_id:
        found = session.scalar(select(Post).where(Post.source_type == post_in.source_type,
                                                  Post.external_post_id == post_in.external_post_id))
        if found is not None:
            return found
    if post_in.source_group_id:
        return session.scalar(
            select(Post).join(PostVersion, PostVersion.post_id == Post.id)
            .where(Post.source_group_id == post_in.source_group_id, PostVersion.text_hash == thash)
            .limit(1))
    return None


def ingest_batch(session: Session, user: User, posts: list[dict], settings: Settings) -> dict:
    if len(posts) > settings.ingest_batch_max:
        raise ApiError(422, message=f"Tối đa {settings.ingest_batch_max} bài/lô")
    check_rate(session, user, len(posts), settings)
    results = []
    for raw in posts:
        post_in, reason = validate(raw, settings)
        key = raw.get("idempotency_key") if isinstance(raw, dict) else None
        if post_in is None:
            results.append(_reject(key, reason))
            continue
        try:
            with session.begin_nested():
                results.append(ingest_post(session, user, post_in, mode="collect", contributed=True))
        except ApiError as exc:
            if exc.status != 409:
                raise
            results.append(_reject(key, "conflict"))
    session.commit()
    summary = {"created": 0, "duplicate": 0, "rejected": 0}
    out = []
    for r in results:
        summary[r.status] += 1
        item = {"idempotency_key": r.idempotency_key, "status": r.status}
        if r.post_id:
            item["post_id"] = r.post_id
        if r.reason:
            item["reason"] = r.reason
        out.append(item)
    return {"results": out, "summary": summary}


def running_analyses(session: Session, user: User) -> int:
    return session.scalar(
        select(func.count()).select_from(Job).join(PostVersion, PostVersion.id == Job.post_version_id)
        .join(Post, Post.id == PostVersion.post_id)
        .where(Job.requested_by == user.id, Job.status.in_(("queued", "running")), Post.mode == "assess"))
