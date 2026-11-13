"""Private reads, with SQL status grouping shared by pagination and summary."""
from sqlalchemy import case, exists, func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import Settings
from app.core.ids import iso
from app.models import ExtractionRun, Job, Listing, Post, PostImage, PostSubmission, User
from app.services import ingest, listings, market, users


def _current_listings():
    return (select(Listing).join(ExtractionRun, ExtractionRun.id == Listing.run_id)
            .where(Listing.post_id == Post.id, Listing.is_current.is_(True),
                   ExtractionRun.post_version_id == Post.current_version_id).correlate(Post))


def _status():
    latest_job = (select(Job.status).where(Job.post_version_id == Post.current_version_id,
                                         Job.kind.in_(("extract", "reprocess")))
                  .order_by(Job.created_at.desc(), Job.id.desc()).limit(1).correlate(Post).scalar_subquery())
    return case(
        (latest_job.in_(("queued", "running")), "received"),
        (latest_job == "failed", "failed"),
        (Post.status == "failed", "failed"),
        (Post.status == "rejected_type", "not_rental"),
        (exists(_current_listings().where(Listing.review_status.in_(listings.VISIBLE)))
         & Post.contributed.is_(True), "published"),
        (exists(_current_listings().where(Listing.review_status == "needs_review")), "needs_review"),
        (exists(_current_listings().where(Listing.review_status.in_(("rejected", "duplicate")))), "rejected"),
        else_="received",
    )


def _owned(user: User):
    return (select(Post.id.label("post_id"), PostSubmission.first_sent_at.label("sent_at"),
                   _status().label("status"))
            .join(PostSubmission, PostSubmission.post_id == Post.id)
            .where(PostSubmission.user_id == user.id, Post.is_demo.is_(False),
                   (Post.mode == "collect") | Post.contributed.is_(True)).subquery())


GROUPS = {"published": ("published",), "waiting": ("received", "needs_review"),
          "other": ("rejected", "not_rental", "failed")}


def search(session: Session, user: User, settings: Settings, *, group: str, page: int, limit: int) -> dict:
    owned = _owned(user)
    query = select(owned)
    if group != "all":
        query = query.where(owned.c.status.in_(GROUPS[group]))
    total = session.scalar(select(func.count()).select_from(query.subquery()))
    rows = session.execute(query.order_by(owned.c.sent_at.desc(), owned.c.post_id.desc())
                           .offset((page - 1) * limit).limit(limit)).all()
    ids = [r.post_id for r in rows]
    posts = {p.id: p for p in session.scalars(select(Post).where(Post.id.in_(ids))
                                             .options(selectinload(Post.current_version)))}
    extracted: dict[str, list] = {pid: [] for pid in ids}
    for lst in session.scalars(select(Listing).join(ExtractionRun, ExtractionRun.id == Listing.run_id)
                              .join(Post, Post.id == Listing.post_id)
                              .where(Listing.post_id.in_(ids), Listing.is_current.is_(True),
                                     ExtractionRun.post_version_id == Post.current_version_id)
                              .options(selectinload(Listing.fields))
                              .order_by(Listing.listing_index)):
        location = next((f.value_json for f in lst.fields if f.field == "location"), {})
        extracted[lst.post_id].append({
            "listing_id": lst.id, "review_status": lst.review_status, "reason_codes": lst.review_reasons,
            "public_url": f"/tin/{lst.id}?demo=false" if lst.review_status in listings.VISIBLE
                          and posts[lst.post_id].contributed else None,
            "price_vnd": lst.rent_amount_vnd, "price_min_vnd": lst.rent_min_vnd,
            "price_form": lst.rent_form, "price_basis": lst.rent_basis, "price_period": lst.rent_period,
            "area_m2": lst.area_m2, "room_type": lst.property_type,
            "ward_code": lst.ward_code, "ward_name": lst.ward_name, "resolution": location.get("resolution"),
            # market.comparison chooses the target's dataset. Owned posts are always non-demo.
            "comparison": market.comparison(session, lst, settings),
        })
    photos = dict(session.execute(select(PostImage.post_id, func.count()).where(PostImage.post_id.in_(ids))
                                  .group_by(PostImage.post_id)).all())
    items = []
    for row in rows:
        post = posts[row.post_id]
        reasons = sorted({reason for lst in extracted[post.id] for reason in lst["reason_codes"]})
        items.append({"post_id": post.id, "received_at": iso(row.sent_at),
                      "source_group_name": post.source_group_name, "permalink": post.permalink,
                      "excerpt": post.current_version.text[:200] if post.current_version else "",
                      "status": row.status, "reason_codes": reasons, "photo_count": photos.get(post.id, 0),
                      "listings": extracted[post.id]})
    return {"items": items, "total": total, "page": page, "limit": limit, "comparison_baseline": "real_accepted"}


def summary(session: Session, user: User, settings: Settings) -> dict:
    owned = _owned(user)
    statuses = dict(session.execute(select(owned.c.status, func.count()).group_by(owned.c.status)).all())
    counts = {group: sum(statuses.get(status, 0) for status in values) for group, values in GROUPS.items()}
    counts["all"] = sum(statuses.values())
    # Deliberately the existing ingest counter: new collected posts, not duplicate submissions.
    used = ingest.daily_used(session, user)
    capped = bool(settings.ingest_daily_limit) and not users.has_role(user, "collector")
    return {"counts": counts, "quota": {"used": used, "limit": settings.ingest_daily_limit if capped else None,
                                       "remaining": ingest.daily_left(session, user, settings)}}
