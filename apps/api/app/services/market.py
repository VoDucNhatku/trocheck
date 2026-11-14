"""M9 against the DB: load listing rows, delegate the rules to app.pipeline.market."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.ids import iso, utcnow
from app.models import Listing, ListingDistrict, Post, PostVersion
from app.pipeline import market as m
from app.pipeline.dedup import TfIdf


def config(settings: Settings) -> m.MarketConfig:
    return m.MarketConfig(min_n=settings.market_min_n, window_days=settings.market_window_days,
                          near_percent=settings.market_near_median_percent,
                          similar_count=settings.market_similar_count)


def to_row(listing: Listing, post: Post, text: str = "", districts: tuple[str, ...] = ()) -> m.MarketRow:
    return m.MarketRow(
        listing_id=listing.id, cluster_id=listing.cluster_id or listing.id, is_demo=post.is_demo,
        contributed=post.contributed, review_status=listing.review_status, rent_form=listing.rent_form,
        rent_vnd=listing.rent_amount_vnd, rent_period=listing.rent_period, rent_basis=listing.rent_basis,
        ward_code=listing.ward_code, ward_name=listing.ward_name, property_type=listing.property_type,
        area_m2=listing.area_m2, area_from_dimensions=listing.area_from_dimensions,
        observed_at=listing.observed_at, text=text, districts=districts, multi_area=bool(listing.multi_area),
        review_reasons=tuple(listing.review_reasons or ()), post_status=post.status or "")


def load_districts(session: Session, *, demo: bool) -> dict[str, tuple[str, ...]]:
    """listing id -> old-district keys the post names as its own place (current listings of this dataset)."""
    found: dict[str, list[str]] = {}
    query = (select(ListingDistrict.listing_id, ListingDistrict.district_key)
             .join(Listing, Listing.id == ListingDistrict.listing_id)
             .join(Post, Post.id == Listing.post_id)
             .where(Listing.is_current.is_(True), Post.is_demo.is_(demo))
             .order_by(ListingDistrict.listing_id, ListingDistrict.district_key))
    for listing_id, key in session.execute(query):
        found.setdefault(listing_id, []).append(key)
    return {k: tuple(v) for k, v in found.items()}


def load_rows(session: Session, *, demo: bool, with_text: bool = False) -> list[m.MarketRow]:
    query = (select(Listing, Post, PostVersion.text if with_text else Post.id)
             .join(Post, Post.id == Listing.post_id)
             .join(PostVersion, PostVersion.id == Post.current_version_id)
             .where(Listing.is_current.is_(True), Post.is_demo.is_(demo)))
    districts = load_districts(session, demo=demo)
    return [to_row(lst, post, text if with_text else "", districts.get(lst.id, ()))
            for lst, post, text in session.execute(query)]


def pool(session: Session, settings: Settings, *, demo: bool, with_text: bool = False):
    rows = load_rows(session, demo=demo, with_text=with_text)
    return m.eligible_pool(rows, now=utcnow(), cfg=config(settings), demo=demo)


def comparison(session: Session, listing: Listing, settings: Settings) -> dict:
    post = listing.post
    own = tuple(session.scalars(select(ListingDistrict.district_key)
                                .where(ListingDistrict.listing_id == listing.id)
                                .order_by(ListingDistrict.district_key)))
    target = to_row(listing, post, post.current_version.text if post.current_version else "", own)
    rows = load_rows(session, demo=post.is_demo, with_text=True)
    cfg = config(settings)
    c = m.compare_tiered(target, rows, now=utcnow(), cfg=cfg, demo=post.is_demo)
    similar = []
    # Only accepted (public) listings are ever named; the auto_checked pool contributes numbers only.
    shown = [r for r in c.group if r.review_status in m.ACCEPTED_STATUSES]
    if shown:
        tfidf = TfIdf([r.text for r in shown] + [target.text])
        ranked = sorted(shown, key=lambda r: tfidf.cosine(target.text, r.text), reverse=True)
        similar = [{"listing_id": r.listing_id, "rent_vnd": r.rent_vnd, "area_m2": r.area_m2}
                   for r in ranked[:cfg.similar_count]]
    return {
        "status": c.status,
        "reason_codes": c.reason_codes,
        "criteria": c.criteria,
        "scope": c.scope, "scope_label": c.scope_label, "pool": c.pool,
        "n": c.stats.n,
        "mean_vnd": c.stats.mean, "mean_per_m2": c.stats.mean_per_m2,
        "median": c.stats.median, "p25": c.stats.p25, "p75": c.stats.p75,
        "n_per_m2": c.stats.n_per_m2, "median_per_m2": c.stats.median_per_m2,
        "delta_percent": c.delta_percent, "verdict": c.verdict,
        "data_from": c.stats.data_from, "data_to": c.stats.data_to,
        "similar": similar,
        "message": m.verdict_sentence(c, listing.rent_form, min_n=cfg.min_n),
        "disclaimer": m.disclaimer(c) if c.stats.data_from else None,
        "is_demo": post.is_demo,
    }


def store_pool(session: Session, settings: Settings, *, demo: bool, pool_name: str = m.POOL_AUTO_CHECKED):
    """The shared store grouped by old district (ADR-0010): rows usable for tier-2 comparison, latest per
    cluster, plus why the others are left out."""
    rows = load_rows(session, demo=demo)
    now, cfg = utcnow(), config(settings)
    excluded: dict[str, int] = {}
    for row in rows:
        for reason in m.district_pool_reasons(row, now=now, cfg=cfg, demo=demo, pool=pool_name):
            excluded[reason] = excluded.get(reason, 0) + 1
    return m.district_pool(rows, now=now, cfg=cfg, demo=demo, pool=pool_name), excluded


def _district_summary(session: Session, settings: Settings, *, areas: list[str] | None, types: list[str] | None,
                      basis: str, demo: bool, pool_name: str) -> dict:
    eligible, excluded = store_pool(session, settings, demo=demo, pool_name=pool_name)
    cfg = config(settings)
    cells: dict[tuple, list[m.MarketRow]] = {}
    for row in eligible:
        key = m.old_district_of(row)
        if row.rent_basis != basis or key is None:
            continue
        if areas and key not in areas:
            continue
        if types and row.property_type not in types:
            continue
        cells.setdefault((key, row.property_type), []).append(row)
    # Districts with the most listings first: the table opens on the areas the store knows best.
    totals: dict[str, int] = {}
    for (key, _), rows in cells.items():
        totals[key] = totals.get(key, 0) + len(rows)
    out = []
    for (key, ptype), rows in sorted(cells.items(), key=lambda kv: (-totals[kv[0][0]], m.district_label(kv[0][0]),
                                                                    kv[0][1])):
        stats = m.group_stats(rows, cfg)
        out.append({"ward_code": None, "ward_name": None, "district_key": key, "district_name": m.district_label(key),
                    "property_type": ptype, "basis": basis,
                    "mean_vnd": stats.mean, "mean_per_m2": stats.mean_per_m2,
                    "n": stats.n, "median": stats.median, "p25": stats.p25, "p75": stats.p75,
                    "median_per_m2": stats.median_per_m2, "n_per_m2": stats.n_per_m2,
                    "data_from": stats.data_from, "data_to": stats.data_to})
    dates = sorted(r.observed_at for r in eligible)
    return {"cells": out, "excluded_counts": excluded, "min_n": cfg.min_n, "window_days": cfg.window_days,
            "data_from": dates[0].date().isoformat() if dates else None,
            "data_to": dates[-1].date().isoformat() if dates else None,
            "is_demo": demo, "group_by": "old_district", "pool": pool_name}


def summary(session: Session, settings: Settings, *, wards: list[str] | None, types: list[str] | None,
            basis: str, demo: bool, group_by: str = "ward", areas: list[str] | None = None,
            pool_name: str | None = None) -> dict:
    """group_by=ward keeps the original rules (accepted listings, same ward). group_by=old_district uses the
    shared store; pool defaults to auto_checked there (accepted + auto-checked), accepted on request."""
    if group_by == "old_district":
        return _district_summary(session, settings, areas=areas, types=types, basis=basis, demo=demo,
                                 pool_name=pool_name or m.POOL_AUTO_CHECKED)
    eligible, excluded = pool(session, settings, demo=demo)
    cfg = config(settings)
    cells: dict[tuple, list[m.MarketRow]] = {}
    for row in eligible:
        if row.rent_basis != basis:
            continue
        if wards and row.ward_code not in wards and (row.ward_name or "") not in wards:
            continue
        if types and row.property_type not in types:
            continue
        cells.setdefault((row.ward_code, row.ward_name, row.property_type), []).append(row)
    out = []
    for (ward_code, ward_name, ptype), rows in sorted(cells.items(), key=lambda kv: (kv[0][1] or "", kv[0][2])):
        stats = m.group_stats(rows, cfg)
        out.append({"ward_code": ward_code, "ward_name": ward_name, "property_type": ptype, "basis": basis,
                    "mean_vnd": stats.mean, "mean_per_m2": stats.mean_per_m2,
                    "n": stats.n, "median": stats.median, "p25": stats.p25, "p75": stats.p75,
                    "median_per_m2": stats.median_per_m2, "n_per_m2": stats.n_per_m2,
                    "data_from": stats.data_from, "data_to": stats.data_to})
    dates = sorted(r.observed_at for r in eligible)
    return {
        "cells": out,
        "excluded_counts": excluded,
        "min_n": cfg.min_n,
        "window_days": cfg.window_days,
        "data_from": dates[0].date().isoformat() if dates else None,
        "data_to": dates[-1].date().isoformat() if dates else None,
        "is_demo": demo,
    }


def overview(session: Session, settings: Settings, *, demo: bool) -> dict:
    total = session.scalar(select(func.count()).select_from(Listing).join(Post, Post.id == Listing.post_id)
                           .where(Listing.is_current.is_(True), Post.is_demo.is_(demo)))
    eligible, excluded = pool(session, settings, demo=demo)
    store, _ = store_pool(session, settings, demo=demo)
    accepted, _ = store_pool(session, settings, demo=demo, pool_name=m.POOL_ACCEPTED)
    updated = session.scalar(select(func.max(Listing.created_at)).join(Post, Post.id == Listing.post_id)
                             .where(Post.is_demo.is_(demo)))
    return {"total_listings": total, "eligible_listings": len(eligible), "excluded_counts": excluded,
            "store_listings": len(store), "accepted_listings": len(accepted),
            "store_districts": len({m.old_district_of(r) for r in store}),
            "updated_at": iso(updated), "is_demo": demo}
