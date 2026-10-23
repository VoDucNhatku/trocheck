"""Retention and removal requests (co-so-du-lieu §3)."""
from __future__ import annotations

from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.ids import utcnow
from app.models import IdempotencyKey, Listing, Post
from app.services.processing import _touch_cluster


def remove_post(session: Session, post_id: str) -> bool:
    """Removal request: delete the post, its versions, runs, listings and evidence (cascade)."""
    post = session.get(Post, post_id)
    if post is None:
        return False
    clusters = {c for c in session.scalars(select(Listing.cluster_id).where(Listing.post_id == post_id)) if c}
    post.current_version_id = None
    session.flush()
    session.delete(post)
    session.flush()
    for cid in clusters:
        _touch_cluster(session, cid)
    session.execute(delete(IdempotencyKey).where(IdempotencyKey.result_ref == post_id))
    return True


def purge(session: Session, settings: Settings) -> dict:
    """Assess posts never contributed are deleted after N days; old idempotency keys too."""
    now = utcnow()
    old_assess = session.scalars(select(Post.id).where(
        Post.mode == "assess", Post.contributed.is_(False),
        Post.first_seen_at < now - timedelta(days=settings.assess_retention_days))).all()
    for post_id in old_assess:
        remove_post(session, post_id)
    keys = session.execute(delete(IdempotencyKey).where(
        IdempotencyKey.created_at < now - timedelta(days=settings.idempotency_retention_days)))
    return {"assess_posts_removed": len(old_assess), "idempotency_keys_removed": keys.rowcount}
