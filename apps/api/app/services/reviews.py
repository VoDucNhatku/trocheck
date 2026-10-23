"""Review queue and decisions (J4, luong-web §4).

A decision is one transaction: check version -> store edited values + reason + reviewer ->
update review_status -> append a review_event. A stale `expected_version` returns 409 so a
second reviewer never silently overwrites the first (AT14). Statistics are computed on read,
so nothing else needs to be invalidated.
"""
from __future__ import annotations

import copy

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import ApiError, conflict, not_found
from app.core.ids import iso
from app.pipeline.dedup import TfIdf
from app.models import Cluster, ExtractionRun, Listing, Post, PostVersion, ReviewEvent, User
from app.services import serialize
from app.services.processing import _touch_cluster
from app.services.spec import listing_validator

REASONS = ("conflict", "multi_listing", "basis_unknown", "possible_duplicate", "llm_error")


def queue(session: Session, *, reason: str | None = None, page: int = 1, page_size: int = 50) -> dict:
    query = (select(Listing, Post, PostVersion.text)
             .join(Post, Post.id == Listing.post_id)
             .join(PostVersion, PostVersion.id == Post.current_version_id)
             .where(Listing.is_current.is_(True), Listing.review_status == "needs_review"))
    rows = session.execute(query.order_by(Listing.created_at)).all()
    if reason:
        rows = [r for r in rows if reason in (r[0].review_reasons or [])]
    total = len(rows)
    items = []
    for listing, post, text in rows[(page - 1) * page_size: page * page_size]:
        items.append({
            "listing_id": listing.id,
            "reasons": listing.review_reasons or [],
            "reason": (listing.review_reasons or ["field_needs_review"])[0],
            "excerpt": text[:200],
            "property_type": listing.property_type or "unknown",
            "ward_name": listing.ward_name,
            "created_at": iso(listing.created_at),
            "version": listing.version,
            "is_demo": post.is_demo,
        })
    counts: dict[str, int] = {}
    for listing, _, _ in session.execute(query).all():
        for r in listing.review_reasons or ["field_needs_review"]:
            counts[r] = counts.get(r, 0) + 1
    return {"items": items, "total": total, "counts": counts}


def detail(session: Session, listing_id: str, settings: Settings) -> dict:
    listing = session.get(Listing, listing_id)
    if listing is None:
        raise not_found()
    run: ExtractionRun = listing.run
    version = session.get(PostVersion, run.post_version_id)
    suspects = []
    if listing.property_type and listing.property_type != "unknown":
        rows = session.execute(
            select(Listing).join(Post, Post.id == Listing.post_id)
            .where(Listing.is_current.is_(True), Listing.id != listing.id,
                   Listing.property_type == listing.property_type, Listing.post_id != listing.post_id,
                   Post.is_demo.is_(listing.post.is_demo),
                   (Listing.ward_code == listing.ward_code) if listing.ward_code else Listing.ward_code.is_(None))
            .limit(200)).scalars().all()
        texts = {lst.id: lst.post.current_version.text for lst in rows}
        if rows:
            tfidf = TfIdf(list(texts.values()) + [version.text])
            for lst in rows:
                score = tfidf.cosine(version.text, texts[lst.id])
                if score >= settings.dedup_suggest_cosine:
                    suspects.append({"listing_id": lst.id, "cluster_id": lst.cluster_id, "cosine": round(score, 3),
                                     "rent_vnd": lst.rent_amount_vnd, "area_m2": lst.area_m2})
    events = session.scalars(select(ReviewEvent).where(ReviewEvent.listing_id == listing.id)
                             .order_by(ReviewEvent.created_at))
    return {
        "listing": serialize.listing_dict(listing),
        "version": listing.version,
        "review_status": listing.review_status,
        "reasons": listing.review_reasons or [],
        "cluster_id": listing.cluster_id,
        "post": {"post_id": listing.post_id, "text": version.text, "permalink": listing.post.permalink},
        "run": {"run_id": run.id, "llm_status": run.llm_status, "model_id": run.model_id,
                "regex_spans": [s for s in run.regex_spans if s.get("listing_index") in (None, listing.listing_index)],
                "llm_spans": [s for s in run.llm_spans if s.get("listing_index") in (None, listing.listing_index)]},
        "suspected_duplicates": sorted(suspects, key=lambda s: -s["cosine"])[:5],
        "history": [{"action": e.action, "user_id": e.user_id, "reason": e.reason, "created_at": iso(e.created_at)}
                    for e in events],
    }


EDITABLE = ("rent", "area", "room", "location", "fees")


def _apply_fields(listing: Listing, fields: dict) -> None:
    current = serialize.listing_dict(listing)
    edited = copy.deepcopy(current)
    for name, value in fields.items():
        if name not in EDITABLE:
            raise ApiError(422, message=f"Không sửa được trường {name}", field_errors={name: "not editable"})
        if name == "fees":
            edited["fees"] = [dict(f, evidence=f.get("evidence", [])) for f in value]
        else:
            merged = {k: v for k, v in edited[name].items() if k not in ("abstain_reason",)}
            merged.update(value)
            merged.update(decision="answered", agreement="human")
            edited[name] = merged
    candidate = {k: edited[k] for k in ("listing_index", "rent", "area", "room", "location", "fees")}
    errors = sorted(listing_validator().iter_errors(candidate), key=lambda e: e.path)
    if errors:
        raise ApiError(422, message="Giá trị sửa không đúng lược đồ",
                       field_errors={".".join(str(p) for p in e.path) or "listing": e.message for e in errors[:10]})
    for name in fields:
        listing.fields = [f for f in listing.fields if not (f.field == name or (name == "fees" and f.field == "fee"))]
    new_rows = [r for r in serialize.field_rows(candidate)
                if r.field in fields or (r.field == "fee" and "fees" in fields)]
    listing.fields.extend(new_rows)
    for key, value in serialize.lookup_columns(candidate).items():
        setattr(listing, key, value)


def decide(session: Session, user: User, listing_id: str, body, settings: Settings) -> dict:
    if session.get(Listing, listing_id) is None:
        raise not_found()
    # Optimistic lock: only the reviewer holding the current version may write (AT14).
    bumped = session.execute(update(Listing).where(Listing.id == listing_id, Listing.version == body.expected_version)
                             .values(version=Listing.version + 1).execution_options(synchronize_session=False))
    listing = session.get(Listing, listing_id, populate_existing=True)
    if bumped.rowcount != 1:
        session.rollback()
        raise conflict(f"Tin đã được sửa (phiên bản {listing.version}), tải lại trước khi duyệt")
    before = {"review_status": listing.review_status, "cluster_id": listing.cluster_id,
              "listing": serialize.listing_dict(listing)}
    old_cluster = listing.cluster_id
    if body.action == "approve":
        if body.fields:
            _apply_fields(listing, body.fields)
        listing.review_status = "approved"
    elif body.action == "reject":
        if not body.reason:
            raise ApiError(422, message="Loại tin cần lý do", field_errors={"reason": "required"})
        listing.review_status = "rejected"
    elif body.action == "merge":
        target = session.get(Cluster, body.merge_into_cluster) if body.merge_into_cluster else None
        if target is None:
            raise ApiError(422, message="Cần cluster đích", field_errors={"merge_into_cluster": "required"})
        listing.cluster_id = target.id
        listing.review_status = "duplicate"
        target.merge_reason = f"review: {user.username}"
    elif body.action == "split":
        cluster = Cluster(merge_reason=f"split by {user.username}")
        session.add(cluster)
        session.flush()
        listing.cluster_id = cluster.id
        listing.review_reasons = [r for r in (listing.review_reasons or []) if r != "possible_duplicate"]
    session.flush()
    for cid in {old_cluster, listing.cluster_id} - {None}:
        _touch_cluster(session, cid)
    after = {"review_status": listing.review_status, "cluster_id": listing.cluster_id,
             "listing": serialize.listing_dict(listing)}
    session.add(ReviewEvent(listing_id=listing.id, user_id=user.id, action=body.action, before_json=before,
                            after_json=after, reason=body.reason))
    session.commit()
    return {"listing_id": listing.id, "review_status": listing.review_status, "version": listing.version,
            "cluster_id": listing.cluster_id}


def pending_count(session: Session) -> int:
    return session.scalar(select(func.count()).select_from(Listing).where(
        Listing.is_current.is_(True), Listing.review_status == "needs_review"))

