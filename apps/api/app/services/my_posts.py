"""Private reads, with SQL status grouping shared by pagination and summary."""
import re
import math
from statistics import median
from dataclasses import dataclass

from sqlalchemy import case, func, literal, or_, select, true
from sqlalchemy.orm import Session, selectinload

from app.core.config import Settings
from app.core.errors import ApiError
from app.core.ids import iso, utcnow
from app.models import ExtractionRun, Job, Listing, ListingDistrict, Post, PostImage, PostSubmission, ReviewEvent, User
from app.pipeline.old_districts import area_catalog, districts_of_ward
from app.services import ingest, listings, market, users


def _owned_posts(user: User):
    return (select(Post.id.label("post_id"), PostSubmission.first_sent_at.label("sent_at"),
                   Post.current_version_id, Post.status.label("post_status"), Post.contributed)
            .join(PostSubmission, PostSubmission.post_id == Post.id)
            .where(PostSubmission.user_id == user.id, Post.is_demo.is_(False),
                   (Post.mode == "collect") | Post.contributed.is_(True)))


def _owned(user: User):
    owned = _owned_posts(user).cte()
    flags = (select(Listing.post_id,
                    func.max(case((Listing.review_status.in_(listings.VISIBLE), 1), else_=0)).label("visible"),
                    func.max(case((Listing.review_status == "needs_review", 1), else_=0)).label("review"),
                    func.max(case((Listing.review_status.in_(("rejected", "duplicate")), 1), else_=0)).label("rejected"))
             .join(ExtractionRun, ExtractionRun.id == Listing.run_id)
             .join(owned, (owned.c.post_id == Listing.post_id)
                   & (owned.c.current_version_id == ExtractionRun.post_version_id))
             .where(Listing.is_current.is_(True)).group_by(Listing.post_id).subquery())
    ranked = (select(Job.post_version_id, Job.status,
                     func.row_number().over(partition_by=Job.post_version_id,
                                            order_by=(Job.created_at.desc(), Job.id.desc())).label("position"))
              .join(owned, owned.c.current_version_id == Job.post_version_id)
              .where(Job.kind.in_(("extract", "reprocess"))).subquery())
    latest = select(ranked).where(ranked.c.position == 1).subquery()
    status = case(
        (latest.c.status.in_(("queued", "running")), "received"),
        (latest.c.status == "failed", "failed"),
        (owned.c.post_status == "failed", "failed"),
        (owned.c.post_status == "rejected_type", "not_rental"),
        ((flags.c.visible == 1) & owned.c.contributed.is_(True), "published"),
        (flags.c.review == 1, "needs_review"),
        (flags.c.rejected == 1, "rejected"), else_="received")
    return (select(owned.c.post_id, owned.c.sent_at, status.label("status"))
            .outerjoin(flags, flags.c.post_id == owned.c.post_id)
            .outerjoin(latest, latest.c.post_version_id == owned.c.current_version_id).subquery())


GROUPS = {"published": ("published",), "waiting": ("received", "needs_review"),
          "other": ("rejected", "not_rental", "failed")}


SORTS = ("newest", "price_asc", "price_desc", "area_desc")
NOT_RENTAL = ("not_rental", "failed")


@dataclass(frozen=True)
class Filters:
    areas: tuple[str, ...] = ()      # old-district keys, e.g. quan-1
    wards: tuple[str, ...] = ()      # new ward codes
    price_min: int | None = None
    price_max: int | None = None
    area_min: float | None = None
    area_max: float | None = None
    types: tuple[str, ...] = ()
    rental_only: bool = True
    sort: str = "newest"

    @property
    def narrows_listings(self) -> bool:
        return bool(self.areas or self.wards or self.types) or any(
            v is not None for v in (self.price_min, self.price_max, self.area_min, self.area_max))


def monthly_price():
    """Low end of the monthly price: the exact amount, else the range / starting-from minimum.

    Daily prices are left out; an unknown period is kept because most posts omit "/tháng".
    """
    return case((or_(Listing.rent_period.is_(None), Listing.rent_period != "day"),
                 func.coalesce(Listing.rent_amount_vnd, Listing.rent_min_vnd)), else_=None)


def area_ward_codes(keys) -> list[str]:
    """New ward codes of the given old districts. A new ward may span two old districts, so it
    is returned for both of them."""
    return sorted(set().union(*(area_catalog()[key].ward_codes for key in keys)))


def _area_condition(keys):
    """A listing is in an old district when its ward is one that district contributed to, or when the
    pipeline found the district named in the post (the many posts that give no ward)."""
    mentioned = select(ListingDistrict.listing_id).where(ListingDistrict.district_key.in_(keys))
    return or_(Listing.ward_code.in_(area_ward_codes(keys)), Listing.id.in_(mentioned))


def _area_tier(keys):
    """Match quality of one listing for an area filter: 0 its resolved ward belongs to the district, 1 the
    post names the district as its own place, 2 the post is a multi-area ad that names it among others."""
    return case((Listing.ward_code.in_(area_ward_codes(keys)), 0), (Listing.multi_area.is_(False), 1), else_=2)


def area_match(listing, keys) -> str:
    """The same tiers as _area_tier, as the API value for one loaded listing."""
    if listing.ward_code in area_ward_codes(keys):
        return "ward"
    return "multi_area" if listing.multi_area else "mention"


def _listing_conditions(f: Filters) -> list:
    """AND across filters; repeated area/ward/type values are OR within their own filter.

    Unknown area keys are rejected at the route.
    """
    cond = []
    if f.areas:
        cond.append(_area_condition(f.areas))
    if f.wards:
        cond.append(Listing.ward_code.in_(f.wards))
    if f.types:
        cond.append(Listing.property_type.in_(f.types))
    price = monthly_price()
    if f.price_min is not None:
        cond.append(price >= f.price_min)
    if f.price_max is not None:
        cond.append(price <= f.price_max)
    if f.area_min is not None:
        cond.append(Listing.area_m2 >= f.area_min)
    if f.area_max is not None:
        cond.append(Listing.area_m2 <= f.area_max)
    return cond


def _current_of(user: User):
    return (select(Listing).join(ExtractionRun, ExtractionRun.id == Listing.run_id)
            .join(Post, Post.id == Listing.post_id)
            .join(PostSubmission, PostSubmission.post_id == Post.id)
            .where(PostSubmission.user_id == user.id, Post.is_demo.is_(False), Listing.is_current.is_(True),
                   ExtractionRun.post_version_id == Post.current_version_id))


def _matching(user: User, cond: list, areas: tuple[str, ...] = ()):
    """Per post: matching current listings, the price/area extremes used for sorting and, with an area
    filter, the best match tier of its listings."""
    price = monthly_price()
    tier = func.min(_area_tier(areas)) if areas else literal(0)
    return (select(Listing.post_id.label("post_id"), func.count(Listing.id).label("matched"),
                   tier.label("tier"),
                   func.min(price).label("min_price"), func.max(price).label("max_price"),
                   func.max(Listing.area_m2).label("max_area"))
            .join(ExtractionRun, ExtractionRun.id == Listing.run_id)
            .join(Post, Post.id == Listing.post_id)
            .join(PostSubmission, PostSubmission.post_id == Post.id)
            .where(PostSubmission.user_id == user.id, Post.is_demo.is_(False), Listing.is_current.is_(True),
                   ExtractionRun.post_version_id == Post.current_version_id, *cond)
            .group_by(Listing.post_id).subquery())


def _filtered(user: User, group: str, f: Filters):
    owned = _owned(user)
    matching = _matching(user, _listing_conditions(f), f.areas)
    # Posts without listings (just received, no ward) stay visible unless a listing filter is set.
    joined = owned.join(matching, matching.c.post_id == owned.c.post_id, isouter=not f.narrows_listings)
    query = select(owned, matching.c.matched, matching.c.min_price, matching.c.max_price,
                   matching.c.max_area, matching.c.tier).select_from(joined)
    if group != "all":
        query = query.where(owned.c.status.in_(GROUPS[group]))
    if f.rental_only:
        query = query.where(owned.c.status.not_in(NOT_RENTAL))
    return query


def _order(query, f: Filters):
    sub = query.subquery()
    newest = (sub.c.sent_at.desc(), sub.c.post_id.desc())
    if f.sort == "price_asc":
        first = (sub.c.min_price.is_(None), sub.c.min_price.asc())
    elif f.sort == "price_desc":
        first = (sub.c.max_price.is_(None), sub.c.max_price.desc())
    elif f.sort == "area_desc":
        first = (sub.c.max_area.is_(None), sub.c.max_area.desc())
    else:
        first = ()
    # With an area filter: resolved-ward matches, then posts naming the district, then multi-area ads; the
    # chosen sort applies inside each tier.
    tier = (sub.c.tier.asc(),) if f.areas else ()
    return sub, (*tier, *first, *newest)


def validate(f: Filters) -> None:
    """Reject filters that can never be answered instead of silently returning an empty list."""
    errors = {}
    unknown = [key for key in f.areas if key not in area_catalog()]
    if unknown:
        errors["area"] = f"Khu vực cũ không có trong danh mục: {', '.join(unknown)}"
    if any(not re.fullmatch(r"\d{5}", code) for code in f.wards):
        errors["ward"] = "Mã phường/xã mới gồm đúng 5 chữ số"
    if f.price_min is not None and f.price_max is not None and f.price_min > f.price_max:
        errors["price_min"] = "Giá từ phải nhỏ hơn hoặc bằng giá đến"
    if f.area_min is not None and f.area_max is not None and f.area_min > f.area_max:
        errors["area_min"] = "Diện tích từ phải nhỏ hơn hoặc bằng diện tích đến"
    if errors:
        raise ApiError(422, message="Bộ lọc không hợp lệ", field_errors=errors)


def search(session: Session, user: User, settings: Settings, *, group: str, page: int, limit: int,
           filters: Filters | None = None) -> dict:
    f = filters or Filters()
    # Multiple references materialize the filtered set once on PostgreSQL and SQLite.
    # The summary's left join preserves counts even when the requested page is empty.
    filtered = _filtered(user, group, f).cte()
    sub, order = _order(select(filtered), f)
    summary = select(func.count().label("total"),
                     func.coalesce(func.sum(filtered.c.matched), 0).label("matched_listings")).subquery()
    page_rows = select(sub).order_by(*order).offset((page - 1) * limit).limit(limit).subquery()
    # Rebind the same ordering to the outer page alias; a subquery's order is not a contract.
    ordered_page, page_order = _order(select(page_rows), f)
    result = session.execute(select(ordered_page, summary.c.total, summary.c.matched_listings)
                             .select_from(summary.outerjoin(ordered_page, true()))
                             .order_by(*page_order)).all()
    total, matched_listings = result[0].total, result[0].matched_listings
    rows = [row for row in result if row.post_id is not None]
    total_sent = session.scalar(select(func.count()).select_from(_owned_posts(user).subquery()))
    ids = [r.post_id for r in rows]
    progress = _progress(session, {r.post_id: r.status for r in rows})
    posts = {p.id: p for p in session.scalars(select(Post).where(Post.id.in_(ids))
                                             .options(selectinload(Post.current_version)))}
    extracted: dict[str, list] = {pid: [] for pid in ids}
    mentions: dict[str, list[str]] = {}
    for listing_id, key in session.execute(select(ListingDistrict.listing_id, ListingDistrict.district_key)
                                           .join(Listing, Listing.id == ListingDistrict.listing_id)
                                           .where(Listing.post_id.in_(ids)).order_by(ListingDistrict.district_key)):
        mentions.setdefault(listing_id, []).append(key)
    listing_totals = dict(session.execute(
        select(Listing.post_id, func.count()).join(ExtractionRun, ExtractionRun.id == Listing.run_id)
        .join(Post, Post.id == Listing.post_id)
        .where(Listing.post_id.in_(ids), Listing.is_current.is_(True),
               ExtractionRun.post_version_id == Post.current_version_id)
        .group_by(Listing.post_id)).all())
    price = monthly_price()
    listing_order = {"price_asc": (price.is_(None), price.asc()), "price_desc": (price.is_(None), price.desc()),
                     "area_desc": (Listing.area_m2.is_(None), Listing.area_m2.desc())}.get(f.sort, ())
    page_listings = list(session.scalars(select(Listing).join(ExtractionRun, ExtractionRun.id == Listing.run_id)
                              .join(Post, Post.id == Listing.post_id)
                              .where(Listing.post_id.in_(ids), Listing.is_current.is_(True),
                                     ExtractionRun.post_version_id == Post.current_version_id,
                                     *_listing_conditions(f))
                              .options(selectinload(Listing.fields))
                              .order_by(*listing_order, Listing.listing_index)))
    comparisons = market.comparisons(session, page_listings, settings)
    for lst in page_listings:
        location = next((fv.value_json for fv in lst.fields if fv.field == "location"), {})
        extracted[lst.post_id].append({
            "listing_id": lst.id, "review_status": lst.review_status, "reason_codes": lst.review_reasons,
            "public_url": f"/tin/{lst.id}?demo=false" if lst.review_status in listings.VISIBLE
                          and posts[lst.post_id].contributed else None,
            "price_vnd": lst.rent_amount_vnd, "price_min_vnd": lst.rent_min_vnd,
            "price_form": lst.rent_form, "price_basis": lst.rent_basis, "price_period": lst.rent_period,
            "area_m2": lst.area_m2, "room_type": lst.property_type,
            "ward_code": lst.ward_code, "ward_name": lst.ward_name, "resolution": location.get("resolution"),
            "area_match": area_match(lst, f.areas) if f.areas else None,
            "old_districts": [{"key": key, "name": area_catalog()[key].name} for key in mentions.get(lst.id, [])
                              if key in area_catalog()],
            # The batch chooses each target's dataset. Owned posts are always non-demo.
            "comparison": comparisons[lst.id],
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
                      "status": row.status, "progress": progress[post.id],
                      "reason_codes": reasons, "photo_count": photos.get(post.id, 0),
                      "listing_total": listing_totals.get(post.id, 0), "listings": extracted[post.id]})
    return {"items": items, "total": total, "page": page, "limit": limit, "comparison_baseline": "real_accepted",
            "matched_listings": int(matched_listings or 0), "total_sent": total_sent}


def filter_options(session: Session, user: User) -> dict:
    """Old districts, new wards, types and price/area ranges that occur in this user's own posts."""
    owned = _owned(user)
    rows = session.execute(
        _current_of(user).with_only_columns(Listing.id, Listing.post_id, Listing.ward_code, Listing.ward_name,
                                            monthly_price().label("price"), Listing.area_m2,
                                            Listing.property_type)
        .join(owned, owned.c.post_id == Listing.post_id).where(owned.c.status.not_in(NOT_RENTAL))).all()
    mentions: dict[str, set[str]] = {}
    own = _current_of(user).with_only_columns(Listing.id)
    for listing_id, key in session.execute(select(ListingDistrict.listing_id, ListingDistrict.district_key)
                                           .where(ListingDistrict.listing_id.in_(own))):
        mentions.setdefault(listing_id, set()).add(key)
    wards: dict[str, dict] = {}
    areas: dict[str, dict] = {}
    types: dict[str, int] = {}
    for row in rows:
        if row.property_type:
            types[row.property_type] = types.get(row.property_type, 0) + 1
        if row.ward_code:
            ward = wards.setdefault(row.ward_code, {"code": row.ward_code, "name": row.ward_name, "listings": 0,
                                                     "posts": set()})
            ward["listings"] += 1
            ward["posts"].add(row.post_id)
        # Ward-derived and mentioned districts count once per listing, like the filter does.
        for key in {*districts_of_ward().get(row.ward_code or "", ()), *mentions.get(row.id, ())}:
            if key not in area_catalog():
                continue
            area = areas.setdefault(key, {"key": key, "name": area_catalog()[key].name, "listings": 0,
                                          "posts": set()})
            area["listings"] += 1
            area["posts"].add(row.post_id)

    def listed(groups: dict[str, dict], sort_key) -> list[dict]:
        return [{**{k: v for k, v in g.items() if k != "posts"}, "post_count": len(g["posts"])}
                for g in sorted(groups.values(), key=sort_key)]

    prices = [r.price for r in rows if r.price is not None]
    sizes = [r.area_m2 for r in rows if r.area_m2 is not None]
    return {"areas": [{"key": a["key"], "name": a["name"], "listing_count": a["listings"],
                       "post_count": a["post_count"]}
                      for a in listed(areas, lambda a: (-len(a["posts"]), a["name"]))],
            "wards": [{"code": w["code"], "name": w["name"], "listing_count": w["listings"],
                       "post_count": w["post_count"]}
                      for w in listed(wards, lambda w: (-len(w["posts"]), w["name"] or ""))],
            "types": [{"type": t, "listing_count": n} for t, n in sorted(types.items(), key=lambda kv: (-kv[1], kv[0]))],
            "price_min_vnd": min(prices) if prices else None, "price_max_vnd": max(prices) if prices else None,
            "area_min_m2": min(sizes) if sizes else None, "area_max_m2": max(sizes) if sizes else None,
            "total_listings": len(rows)}


def summary(session: Session, user: User, settings: Settings) -> dict:
    owned = _owned(user)
    statuses = dict(session.execute(select(owned.c.status, func.count()).group_by(owned.c.status)).all())
    counts = {group: sum(statuses.get(status, 0) for status in values) for group, values in GROUPS.items()}
    counts["all"] = sum(statuses.values())
    # Deliberately the existing ingest counter: new collected posts, not duplicate submissions.
    used = ingest.daily_used(session, user)
    capped = bool(settings.ingest_daily_limit) and not users.has_role(user, "collector")
    progress = _progress(session, dict(session.execute(select(owned.c.post_id, owned.c.status)).all()))
    stages = {stage: sum(p["stage"] == stage for p in progress.values()) for stage in STAGES}
    waits = [p["estimated_wait_seconds"] for p in progress.values() if p["estimated_wait_seconds"] is not None]
    return {"counts": counts, "stage_counts": stages,
            "active": any(stages[s] for s in ("queued", "reading", "asking_ai")),
            "estimated_wait_seconds": max(waits) if waits else None,
            "quota": {"used": used, "limit": settings.ingest_daily_limit if capped else None,
                                       "remaining": ingest.daily_left(session, user, settings)}}


STAGES = ("queued", "reading", "asking_ai", "needs_review", "published", "not_published", "failed")


def _progress(session: Session, statuses: dict[str, str]) -> dict:
    if not statuses:
        return {}
    latest, reviewing = {}, {}
    for post_id, job in session.execute(select(Post.id, Job).join(Job, Job.post_version_id == Post.current_version_id)
            .where(Post.id.in_(statuses), Job.kind.in_(("extract", "reprocess", "bot_review")))
            .order_by(Job.created_at.desc(), Job.id.desc())):
        if job.kind == "bot_review":
            if job.status in ("queued", "running"):
                reviewing.setdefault(post_id, job)
        else:
            latest.setdefault(post_id, job)
    for post_id, job in reviewing.items():
        if statuses[post_id] == "needs_review":
            latest[post_id] = job
    ranked = select(Job.id, func.row_number().over(order_by=(Job.run_after > utcnow(),
                    Job.kind == "bot_review", Job.created_at, Job.id)).label("position")).where(
                    Job.status == "queued").subquery()
    positions = dict(session.execute(select(ranked).where(ranked.c.id.in_(
        [j.id for j in latest.values() if j.status == "queued"]))).all())
    durations = session.execute(select(Job.started_at, Job.finished_at).where(
        Job.status.in_(("succeeded", "failed")), Job.started_at.is_not(None),
        Job.finished_at >= Job.started_at).order_by(Job.finished_at.desc(), Job.id.desc()).limit(50)).all()
    duration = median((end - start).total_seconds() for start, end in durations) if len(durations) >= 5 else None
    result = {}
    rejection_reasons = {}
    for post_id, reason in session.execute(select(Listing.post_id, ReviewEvent.reason)
            .join(ReviewEvent, ReviewEvent.listing_id == Listing.id)
            .join(ExtractionRun, ExtractionRun.id == Listing.run_id).join(Post, Post.id == Listing.post_id)
            .where(Listing.post_id.in_(statuses), Listing.is_current.is_(True),
                   ExtractionRun.post_version_id == Post.current_version_id,
                   ReviewEvent.action.in_(("reject", "duplicate")))
            .order_by(ReviewEvent.created_at.desc(), ReviewEvent.id.desc())):
        if reason:
            rejection_reasons.setdefault(post_id, reason)
    for post_id, status in statuses.items():
        job = latest.get(post_id)
        stage = {"received": "queued", "rejected": "not_published", "not_rental": "not_published"}.get(status, status)
        position = None
        estimate = None
        reason = None
        if job is not None and (status == "received" or (status == "needs_review" and job.kind == "bot_review")):
            if job.status == "running":
                stage = "asking_ai" if job.stage == "asking_ai" else "reading"
            elif job.status == "queued":
                stage = "queued"
                position = positions.get(job.id)
                if job.error_code in ("llm_daily_limit", "review_bot_daily_limit") and job.run_after > utcnow():
                    reason = job.error_code
                if duration is not None and position is not None and job.run_after <= utcnow():
                    estimate = math.ceil(position * duration)
        if stage == "failed":
            # Exception messages may contain private provider details; expose only a short code.
            reason = (job.error_code if job else None) or "processing_failed"
        elif stage == "not_published":
            reason = "not_rental" if status == "not_rental" else rejection_reasons.get(post_id, "rejected")
        result[post_id] = {"stage": stage, "queue_position": position,
                           "estimated_wait_seconds": estimate, "reason": reason,
                           "started_at": iso(job.started_at) if job and job.started_at else None,
                           "finished_at": iso(job.finished_at) if job and job.finished_at else None}
    return result


def progress(session: Session, user: User, post_id: str) -> dict:
    owned = _owned(user)
    row = session.execute(select(owned.c.post_id, owned.c.status).where(owned.c.post_id == post_id)).first()
    if row is None:
        raise ApiError(404, code="post_not_found", message="Không tìm thấy bài đã gửi.")
    return _progress(session, {row.post_id: row.status})[post_id]
