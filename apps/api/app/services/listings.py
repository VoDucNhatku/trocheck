"""Renter-facing reads: GET /listings, /listings/{id} (luong-web §3).

Shown in the list: current listings with review_status auto_accepted/approved from contributed
posts, demo posts only in demo mode. This is looser than the statistics rules: "từ 3 triệu"
is listed but never enters a median.

Shared store (task P, ADR-0010): with pool="all" (the web default) the list also holds real listings still waiting for
review that passed the automatic checks (not rejected, post usable, a stated price, none of the blocking codes);
cards carry review_status so the page labels them "Chưa duyệt". pool="accepted" (API default) is the original list.
"""
from __future__ import annotations

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import Settings
from app.core.errors import not_found
from app.core.ids import iso
from app.models import FieldValue, Listing, ListingDistrict, Post, PostVersion
from app.pipeline import market as m
from app.services import serialize

VISIBLE = ("auto_accepted", "approved")
POOLS = ("all", "accepted")


def store_extra_ids(session: Session, *, demo: bool) -> list[str]:
    """Waiting listings that passed the automatic checks: shown in the shared store with a label."""
    rows = session.execute(
        select(Listing.id, Listing.review_reasons)
        .join(Post, Post.id == Listing.post_id)
        .where(Listing.is_current.is_(True), Listing.review_status == "needs_review", Post.contributed.is_(True),
               Post.is_demo.is_(demo), Post.status.not_in(m.UNUSABLE_POST_STATUSES),
               Listing.rent_form.in_(("exact", "range", "starting_from"))))
    return [lid for lid, reasons in rows if not m.BLOCKING_REASONS.intersection(reasons or ())]


def _visible(demo: bool, extra: list[str] | None = None):
    shown = Listing.review_status.in_(VISIBLE)
    if extra:
        shown = or_(shown, Listing.id.in_(extra))
    return and_(Listing.is_current.is_(True), shown, Post.contributed.is_(True), Post.is_demo.is_(demo))


def _districts_of(session: Session, listings: list[Listing]) -> dict[str, tuple[str, ...]]:
    ids = [lst.id for lst in listings]
    found: dict[str, list[str]] = {}
    if ids:
        for lid, key in session.execute(select(ListingDistrict.listing_id, ListingDistrict.district_key)
                                        .where(ListingDistrict.listing_id.in_(ids))
                                        .order_by(ListingDistrict.district_key)):
            found.setdefault(lid, []).append(key)
    return {k: tuple(v) for k, v in found.items()}


def old_district_label(listing: Listing, districts: tuple[str, ...]) -> str | None:
    row = m.MarketRow(listing_id=listing.id, cluster_id=listing.id, is_demo=False, contributed=True,
                      review_status=listing.review_status, rent_form=listing.rent_form, rent_vnd=None,
                      rent_period=None, rent_basis=None, ward_code=listing.ward_code, ward_name=listing.ward_name,
                      property_type=listing.property_type, area_m2=None, area_from_dimensions=False,
                      observed_at=listing.observed_at, districts=districts, multi_area=bool(listing.multi_area))
    key = m.old_district_of(row)
    return m.district_label(key) if key else None


def search(session: Session, settings: Settings, *, wards=None, types=None, price_min=None, price_max=None,
           area_min=None, area_max=None, has_price=None, sort="newest", page=1, page_size=20,
           demo: bool = False, pool: str = "accepted", areas=None) -> dict:
    extra = store_extra_ids(session, demo=demo) if pool == "all" else []
    cond = [_visible(demo, extra)]
    if areas:
        from app.services.my_posts import _area_condition
        cond.append(_area_condition(areas))
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
                           .where(_visible(demo, extra)))
    rows = list(rows)
    districts = _districts_of(session, rows)
    items = []
    for lst in rows:
        card = serialize.card(lst, lst.post)
        card["old_district"] = old_district_label(lst, districts.get(lst.id, ()))
        items.append(card)
    return {"items": items, "total": total,
            "hidden_no_price": hidden_no_price, "data_as_of": iso(as_of), "page": page, "page_size": page_size,
            "is_demo": demo}


def get_visible(session: Session, listing_id: str, *, demo: bool) -> Listing:
    listing = session.scalar(select(Listing).join(Post, Post.id == Listing.post_id)
                             .where(Listing.id == listing_id, _visible(demo, store_extra_ids(session, demo=demo))))
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
    visible = ((listing.review_status in VISIBLE or listing.id in store_extra_ids(session, demo=demo))
               and post.contributed and post.is_demo == demo)
    if visible or (user is not None and can_view(session, user, post)):
        return listing
    raise not_found("Không tìm thấy tin")
