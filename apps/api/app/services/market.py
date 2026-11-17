"""M9 against the DB: load listing rows, delegate the rules to app.pipeline.market."""
from __future__ import annotations

import re
from collections import Counter
from dataclasses import replace
from functools import lru_cache

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, load_only

from app.core.config import Settings
from app.core.ids import iso, utcnow
from app.models import Listing, ListingDistrict, Post, PostVersion
from app.pipeline import market as m
from app.pipeline.old_districts import area_catalog, district_scan
from app.pipeline.places import real_places
from app.pipeline.preprocess import fold


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


def load_districts(session: Session, *, demo: bool,
                   listing_ids: list[str] | None = None) -> dict[str, tuple[str, ...]]:
    """listing id -> old-district keys the post names as its own place (current listings of this dataset)."""
    found: dict[str, list[str]] = {}
    query = (select(ListingDistrict.listing_id, ListingDistrict.district_key)
             .join(Listing, Listing.id == ListingDistrict.listing_id)
             .join(Post, Post.id == Listing.post_id)
             .where(Listing.is_current.is_(True), Post.is_demo.is_(demo))
             .order_by(ListingDistrict.listing_id, ListingDistrict.district_key))
    if listing_ids is not None:
        if not listing_ids:
            return {}
        query = query.where(ListingDistrict.listing_id.in_(listing_ids))
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


def _targets(session: Session, listings: list[Listing]) -> list[m.MarketRow]:
    posts = {post.id: post for post in session.scalars(
        select(Post).where(Post.id.in_({lst.post_id for lst in listings}))
        .options(load_only(Post.id, Post.is_demo, Post.contributed, Post.status, Post.current_version_id)))}
    own: dict[str, list[str]] = {}
    for lid, key in session.execute(select(ListingDistrict.listing_id, ListingDistrict.district_key)
                                    .where(ListingDistrict.listing_id.in_([lst.id for lst in listings]))
                                    .order_by(ListingDistrict.district_key)):
        own.setdefault(lid, []).append(key)
    targets = [to_row(lst, posts[lst.post_id], districts=tuple(own.get(lst.id, ()))) for lst in listings]
    # Older analysis runs can lack listing_districts. Recover only the target's own district,
    # with the same proximity / multi-area guards used at extraction. Never persist on a read.
    missing = {lst.id: posts[lst.post_id].current_version_id for lst, row in zip(listings, targets)
               if not row.is_demo and not row.districts and not row.multi_area
               and "outside_hcm_province" not in row.review_reasons and m.old_district_of(row) is None}
    texts = dict(session.execute(select(PostVersion.id, PostVersion.text)
                                 .where(PostVersion.id.in_(set(missing.values())))).all()) if missing else {}
    for i, row in enumerate(targets):
        if row.listing_id in missing:
            scan = district_scan(texts.get(missing[row.listing_id], ""))
            targets[i] = replace(row, districts=scan.keys, multi_area=scan.multi_area)
    return targets


def _candidate_rows(session: Session, targets: list[m.MarketRow]) -> list[m.MarketRow]:
    locations = []
    for demo in {row.is_demo for row in targets}:
        wards = {row.ward_code for row in targets if row.is_demo == demo and row.ward_code}
        keys = {m.old_district_of(row) for row in targets if row.is_demo == demo and not demo}
        keys.discard(None)
        wards.update(code for key in keys if key in area_catalog() for code in area_catalog()[key].ward_codes)
        mentioned = select(ListingDistrict.listing_id).where(ListingDistrict.district_key.in_(keys))
        locations.append(and_(Post.is_demo.is_(demo),
                              or_(Listing.ward_code.in_(wards), Listing.id.in_(mentioned))))
    location = or_(*locations)
    # A newer eligible cluster member may live outside the target's location. Include those siblings
    # so latest_per_cluster still runs BEFORE grouping, as in the full-store comparison.
    clusters = (select(Listing.cluster_id).join(Post, Post.id == Listing.post_id)
                .where(Listing.is_current.is_(True), Post.current_version_id.is_not(None),
                       Listing.cluster_id.is_not(None), location))
    query = (select(Listing, Post).join(Post, Post.id == Listing.post_id)
             .options(load_only(Post.id, Post.is_demo, Post.contributed, Post.status))
             .where(Listing.is_current.is_(True), Post.current_version_id.is_not(None),
                    Post.is_demo.in_({r.is_demo for r in targets}),
                    or_(location, Listing.cluster_id.in_(clusters))))
    pairs = session.execute(query).all()
    districts = {}
    for demo in {row.is_demo for row in targets}:
        districts.update(load_districts(session, demo=demo,
                                        listing_ids=[lst.id for lst, post in pairs if post.is_demo == demo]))
    return [to_row(lst, post, districts=districts.get(lst.id, ())) for lst, post in pairs]


def comparisons(session: Session, listings: list[Listing], settings: Settings) -> dict[str, dict]:
    """Compare a page with one candidate load. Return listing_id -> the existing response shape.

    No peer text is loaded: similar cards are chosen by area, then rent distance, then id.
    Only an unresolved target without persisted district mentions needs its current text.
    """
    if not listings:
        return {}
    targets = _targets(session, listings)
    rows = _candidate_rows(session, targets)
    cfg, now = config(settings), utcnow()
    return {row.listing_id: _comparison_body(row, m.compare_tiered(row, rows, now=now, cfg=cfg,
                                                                 demo=row.is_demo), cfg) for row in targets}


def comparison(session: Session, listing: Listing, settings: Settings) -> dict:
    return comparisons(session, [listing], settings)[listing.id]


def _comparison_body(target: m.MarketRow, c: m.Comparison, cfg: m.MarketConfig) -> dict:
    # Only accepted (public) listings are ever named; the auto_checked pool contributes numbers only.
    shown = sorted((r for r in c.group if r.review_status in m.ACCEPTED_STATUSES), key=lambda r: (
        abs(r.area_m2 - target.area_m2) if r.area_m2 is not None and target.area_m2 is not None else float("inf"),
        abs(r.rent_vnd - target.rent_vnd), r.listing_id))
    similar = [{"listing_id": r.listing_id, "rent_vnd": r.rent_vnd, "area_m2": r.area_m2}
               for r in shown[:cfg.similar_count]]
    return {
        "status": c.status,
        "reason_codes": c.reason_codes,
        "criteria": c.criteria,
        "scope": c.scope, "scope_label": c.scope_label, "pool": c.pool, "tiers": c.tiers,
        "n": c.stats.n,
        "mean_vnd": c.stats.mean, "mean_per_m2": c.stats.mean_per_m2,
        "median": c.stats.median, "p25": c.stats.p25, "p75": c.stats.p75,
        "n_per_m2": c.stats.n_per_m2, "median_per_m2": c.stats.median_per_m2,
        "delta_percent": c.delta_percent, "verdict": c.verdict,
        "data_from": c.stats.data_from, "data_to": c.stats.data_to,
        "similar": similar,
        "message": m.verdict_sentence(c, target.rent_form, min_n=cfg.min_n),
        "disclaimer": m.disclaimer(c) if c.stats.data_from else None,
        "is_demo": target.is_demo,
    }


@lru_cache
def _report_location_patterns() -> tuple[tuple[re.Pattern, str], ...]:
    """Output vocabulary is exclusively canonical geography, never a substring of a private post."""
    places = real_places()
    names = {ward.name for ward in places.wards.values()}
    names.update(row["old_ward_name"] for row in places.former_wards.values())
    names.update(district.name for district in area_catalog().values())
    patterns = []
    for name in sorted(names):
        if len(name) > 80:
            continue
        bare = re.sub(r"^(?:phuong|xa|thi tran|quan|huyen|thanh pho|thi xa) ", "", fold(name))
        # Numbers need a location prefix: a price, house number or phone is not a ward phrase.
        phrase = fold(name) if bare.isdigit() else bare
        patterns.append((re.compile(rf"(?<!\w){re.escape(phrase)}(?!\w)"), name))
    return tuple(patterns)


def eligibility_report(session: Session, settings: Settings) -> dict:
    """Read-only real-market diagnostic, using exactly the ward baseline's exclusion rules.

    Unknown free-form locations are withheld rather than risking a person's name, contact or URL.
    Each canonical phrase counts once per unresolved listing, even if repeated in its text.
    """
    with session.no_autoflush:
        rows = load_rows(session, demo=False)
        cfg, now = config(settings), utcnow()
        eligible, excluded = m.eligible_pool(rows, now=now, cfg=cfg, demo=False)
        kept = {row.listing_id for row in eligible}
        combinations: Counter = Counter()
        unresolved = []
        for row in rows:
            reasons = m.exclusion_reasons(row, now=now, cfg=cfg, demo=False)
            if not reasons and row.listing_id not in kept:
                reasons = ["older_in_cluster"]
            if reasons:
                combinations[tuple(sorted(reasons))] += 1
            if "ward_unresolved" in reasons:
                unresolved.append(row.listing_id)
        phrases: Counter = Counter()
        # Chunk ids so the report also works on SQLite builds with a small bind-parameter limit.
        for start in range(0, len(unresolved), 500):
            query = (select(PostVersion.text).join(Post, Post.current_version_id == PostVersion.id)
                     .join(Listing, Listing.post_id == Post.id)
                     .where(Listing.id.in_(unresolved[start:start + 500])))
            for text in session.scalars(query):
                # Do not interpret contact links as location evidence.
                cleaned = fold(re.sub(r"(?:https?://|www\.)\S+", " ", text, flags=re.IGNORECASE))
                found = {name for pattern, name in _report_location_patterns() if pattern.search(cleaned)}
                phrases.update(found or {"[unrecognized location withheld]"})
        return {
            "total_listings": len(rows), "eligible_listings": len(eligible),
            "excluded_counts": excluded,
            "reason_combinations": [{"reasons": list(reasons), "n": n}
                                    for reasons, n in sorted(combinations.items(), key=lambda item: (-item[1], item[0]))[:10]],
            "unresolved_location_phrases": [{"phrase": phrase, "n": n}
                                            for phrase, n in sorted(phrases.items(), key=lambda item: (-item[1], item[0]))[:30]],
            "location_phrase_policy": "canonical geography only; unknown phrases withheld; once per listing",
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
