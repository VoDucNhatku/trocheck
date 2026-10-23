"""Renter-facing reads: GET /listings, /listings/{id} (luong-web §3).

Shown in the list: current listings with review_status auto_accepted/approved from contributed
posts, demo posts only in demo mode. This is looser than the statistics rules: "từ 3 triệu"
is listed but never enters a median.
"""
from __future__ import annotations

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import Settings
from app.core.errors import not_found
from app.core.ids import iso
from app.models import FieldValue, Listing, Post, PostVersion
from app.services import serialize

VISIBLE = ("auto_accepted", "approved")


def _visible(demo: bool):
    return and_(Listing.is_current.is_(True), Listing.review_status.in_(VISIBLE),
                Post.contributed.is_(True), Post.is_demo.is_(demo))


def search(session: Session, settings: Settings, *, wards=None, types=None, price_min=None, price_max=None,
           area_min=None, area_max=None, has_price=None, sort="newest", page=1, page_size=20,
           demo: bool = False) -> dict:
    cond = [_visible(demo)]
    if wards:
        cond.append(or_(Listing.ward_code.in_(wards), Listing.ward_name.in_(wards)))
    if types:
        cond.append(Listing.property_type.in_(types))
    if area_min is not None:
        cond.append(Listing.area_m2 >= area_min)
    if area_max is not None:
        cond.append(Listing.area_m2 <= area_max)
    base = select(Listing).join(Post, Post.id == Listing.post_id).where(*cond)

    price_filter = price_min is not None or price_max is not None or bool(has_price)
    hidden_no_price = 0
    if price_filter:
        exact = and_(Listing.rent_form == "exact", Listing.rent_amount_vnd.is_not(None))
        hidden_no_price = session.scalar(select(func.count()).select_from(base.where(~exact).subquery()))
        base = base.where(exact)
        if price_min is not None:
            base = base.where(Listing.rent_amount_vnd >= price_min)
        if price_max is not None:
            base = base.where(Listing.rent_amount_vnd <= price_max)

    total = session.scalar(select(func.count()).select_from(base.subquery()))
    if sort == "price_asc":
        order = (Listing.rent_amount_vnd.is_(None), Listing.rent_amount_vnd.asc())
    elif sort == "price_desc":
        order = (Listing.rent_amount_vnd.is_(None), Listing.rent_amount_vnd.desc())
    else:
        order = (Listing.observed_at.desc(), Listing.id.desc())
    rows = session.scalars(base.order_by(*order).offset((page - 1) * page_size).limit(page_size)
                           .options(selectinload(Listing.fields).selectinload(FieldValue.evidence),
                                    selectinload(Listing.post).selectinload(Post.current_version)))
    as_of = session.scalar(select(func.max(Listing.created_at)).join(Post, Post.id == Listing.post_id)
                           .where(_visible(demo)))
    return {"items": [serialize.card(lst, lst.post) for lst in rows], "total": total,
            "hidden_no_price": hidden_no_price, "data_as_of": iso(as_of), "page": page, "page_size": page_size,
            "is_demo": demo}


def get_visible(session: Session, listing_id: str, *, demo: bool) -> Listing:
    listing = session.scalar(select(Listing).join(Post, Post.id == Listing.post_id)
                             .where(Listing.id == listing_id, _visible(demo)))
    if listing is None:
        raise not_found("Không tìm thấy tin")
    return listing


def detail(session: Session, listing: Listing) -> dict:
    post = listing.post
    version: PostVersion = session.get(PostVersion, listing.run.post_version_id)
    siblings = session.scalar(select(func.count()).select_from(Listing)
                              .where(Listing.run_id == listing.run_id)) - 1
    history = []
    if listing.cluster_id:
        rows = session.execute(select(Listing, Post).join(Post, Post.id == Listing.post_id)
                               .where(Listing.cluster_id == listing.cluster_id, Listing.is_current.is_(True))
                               .order_by(Listing.observed_at))
        history = [{"listing_id": lst.id, "observed_at": iso(lst.observed_at), "rent_form": lst.rent_form,
                    "rent_vnd": lst.rent_amount_vnd, "review_status": lst.review_status}
                   for lst, _ in rows]
    return {
        "listing": serialize.listing_dict(listing),
        "post": {"post_id": post.id, "text": version.text, "permalink": post.permalink,
                 "source_group_name": post.source_group_name, "posted_at": iso(post.posted_at),
                 "text_complete": bool(version.text_complete), "post_type": post.post_type},
        "sibling_count": max(siblings, 0),
        "cluster_id": listing.cluster_id,
        "price_history": history,
        "is_demo": post.is_demo,
    }


def get_for_comparison(session: Session, listing_id: str, *, user, demo: bool) -> Listing:
    """Public for visible listings; the extension panel may also compare the user's own
    (not contributed) analysis listings (luong-web §2)."""
    from app.services.analyses import can_view

    listing = session.get(Listing, listing_id)
    if listing is None or not listing.is_current:
        raise not_found("Không tìm thấy tin")
    post = listing.post
    visible = (listing.review_status in VISIBLE and post.contributed and post.is_demo == demo)
    if visible or (user is not None and can_view(session, user, post)):
        return listing
    raise not_found("Không tìm thấy tin")
