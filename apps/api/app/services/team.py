"""Team pages: data store (Kho dữ liệu), reprocess, export."""
from __future__ import annotations

import csv
import io
import json

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import not_found
from app.core.ids import iso, parse_iso
from app.models import ExtractionRun, Job, Listing, Post, PostVersion, User
from app.services import jobs, serialize


def list_posts(session: Session, *, status=None, group=None, collector=None, date_from=None, date_to=None,
               post_type=None, page=1, page_size=50) -> dict:
    query = select(Post, PostVersion, User.username).join(PostVersion, PostVersion.id == Post.current_version_id) \
        .join(User, User.id == Post.collector_id)
    if status:
        query = query.where(Post.status == status)
    if group:
        query = query.where((Post.source_group_id == group) | (Post.source_group_name == group))
    if collector:
        query = query.where(User.username == collector)
    if post_type:
        query = query.where(Post.post_type == post_type)
    if date_from:
        query = query.where(Post.first_seen_at >= parse_iso(date_from))
    if date_to:
        query = query.where(Post.first_seen_at <= parse_iso(date_to))
    total = session.scalar(select(func.count()).select_from(query.subquery()))
    rows = session.execute(query.order_by(Post.first_seen_at.desc()).offset((page - 1) * page_size).limit(page_size))
    items = []
    for post, version, username in rows:
        job = session.scalar(select(Job).where(Job.post_version_id == version.id).order_by(Job.created_at.desc()).limit(1))
        n_listings = session.scalar(select(func.count()).select_from(Listing)
                                    .where(Listing.post_id == post.id, Listing.is_current.is_(True)))
        items.append({
            "post_id": post.id, "status": post.status, "post_type": post.post_type, "mode": post.mode,
            "source_type": post.source_type, "source_group_name": post.source_group_name,
            "collector": username, "contributed": post.contributed, "is_demo": post.is_demo,
            "first_seen_at": iso(post.first_seen_at), "last_seen_at": iso(post.last_seen_at),
            "posted_at": iso(post.posted_at), "excerpt": version.text[:160], "text_complete": version.text_complete,
            "job": {"status": job.status, "attempt": job.attempt, "error_code": job.error_code} if job else None,
            "listing_count": n_listings,
        })
    by_status = dict(session.execute(select(Post.status, func.count()).group_by(Post.status)).all())
    return {"items": items, "total": total, "page": page, "page_size": page_size, "by_status": by_status}


def reprocess(session: Session, user: User, post_id: str) -> dict:
    post = session.get(Post, post_id)
    if post is None or post.current_version_id is None:
        raise not_found()
    job = jobs.enqueue(session, kind="reprocess", post_version_id=post.current_version_id, requested_by=user.id)
    post.status = "received"
    session.commit()
    return {"post_id": post.id, "job_id": job.id, "status": job.status}


EXPORT_COLUMNS = ["listing_id", "post_id", "listing_index", "cluster_id", "review_status", "review_reasons",
                  "is_demo", "contributed", "post_type", "observed_at", "property_type", "ward_code", "ward_name",
                  "rent_visibility", "rent_form", "rent_amount_vnd", "rent_min_vnd", "rent_max_vnd", "rent_basis",
                  "rent_period", "rent_agreement", "area_form", "area_m2", "area_min_m2", "area_max_m2",
                  "landmark", "street", "location_resolution", "fees_json", "pipeline_version", "regex_version",
                  "prompt_version", "model_id", "normalizer_version", "llm_status"]


def export(session: Session, *, fmt: str, include_demo: bool) -> tuple[str, str]:
    """Normalised listings, no post text (no personal data). Returns (content, media type)."""
    query = (select(Listing, Post, ExtractionRun).join(Post, Post.id == Listing.post_id)
             .join(ExtractionRun, ExtractionRun.id == Listing.run_id).where(Listing.is_current.is_(True)))
    if not include_demo:
        query = query.where(Post.is_demo.is_(False))
    records = []
    for listing, post, run in session.execute(query.order_by(Listing.observed_at)):
        data = serialize.listing_dict(listing)
        rent, area, loc = data["rent"], data["area"], data["location"]
        records.append({
            "listing_id": listing.id, "post_id": post.id, "listing_index": listing.listing_index,
            "cluster_id": listing.cluster_id, "review_status": listing.review_status,
            "review_reasons": listing.review_reasons or [], "is_demo": post.is_demo, "contributed": post.contributed,
            "post_type": post.post_type, "observed_at": iso(listing.observed_at),
            "property_type": listing.property_type, "ward_code": listing.ward_code, "ward_name": listing.ward_name,
            "rent_visibility": rent.get("visibility"), "rent_form": rent.get("amount_form"),
            "rent_amount_vnd": rent.get("amount_vnd"), "rent_min_vnd": rent.get("min_vnd"),
            "rent_max_vnd": rent.get("max_vnd"), "rent_basis": rent.get("basis"), "rent_period": rent.get("period"),
            "rent_agreement": rent.get("agreement"), "area_form": area.get("amount_form"),
            "area_m2": area.get("value_m2"), "area_min_m2": area.get("min_m2"), "area_max_m2": area.get("max_m2"),
            "landmark": loc.get("landmark"), "street": loc.get("street"), "location_resolution": loc.get("resolution"),
            "fees": [{k: v for k, v in f.items() if k != "evidence"} for f in data["fees"]],
            "pipeline_version": run.pipeline_version, "regex_version": run.regex_version,
            "prompt_version": run.prompt_version, "model_id": run.model_id,
            "normalizer_version": run.normalizer_version, "llm_status": run.llm_status,
        })
    if fmt == "json":
        return json.dumps({"items": records}, ensure_ascii=False, indent=1), "application/json"
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=EXPORT_COLUMNS)
    writer.writeheader()
    for r in records:
        row = {k: r.get(k) for k in EXPORT_COLUMNS}
        row["fees_json"] = json.dumps(r["fees"], ensure_ascii=False)
        row["review_reasons"] = ";".join(r["review_reasons"])
        writer.writerow(row)
    return buf.getvalue(), "text/csv; charset=utf-8"
