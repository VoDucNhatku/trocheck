"""M9 against the DB: load listing rows, delegate the rules to app.pipeline.market."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.ids import iso, utcnow
from app.models import Listing, Post, PostVersion
from app.pipeline import market as m
from app.pipeline.dedup import TfIdf


def config(settings: Settings) -> m.MarketConfig:
    return m.MarketConfig(min_n=settings.market_min_n, window_days=settings.market_window_days,
                          near_percent=settings.market_near_median_percent,
                          similar_count=settings.market_similar_count)


def to_row(listing: Listing, post: Post, text: str = "") -> m.MarketRow:
    return m.MarketRow(
        listing_id=listing.id, cluster_id=listing.cluster_id or listing.id, is_demo=post.is_demo,
        contributed=post.contributed, review_status=listing.review_status, rent_form=listing.rent_form,
        rent_vnd=listing.rent_amount_vnd, rent_period=listing.rent_period, rent_basis=listing.rent_basis,
        ward_code=listing.ward_code, ward_name=listing.ward_name, property_type=listing.property_type,
        area_m2=listing.area_m2, area_from_dimensions=listing.area_from_dimensions,
        observed_at=listing.observed_at, text=text)


def load_rows(session: Session, *, demo: bool, with_text: bool = False) -> list[m.MarketRow]:
    query = (select(Listing, Post, PostVersion.text if with_text else Post.id)
             .join(Post, Post.id == Listing.post_id)
             .join(PostVersion, PostVersion.id == Post.current_version_id)
             .where(Listing.is_current.is_(True), Post.is_demo.is_(demo)))
    return [to_row(lst, post, text if with_text else "") for lst, post, text in session.execute(query)]


def pool(session: Session, settings: Settings, *, demo: bool, with_text: bool = False):
    rows = load_rows(session, demo=demo, with_text=with_text)
    return m.eligible_pool(rows, now=utcnow(), cfg=config(settings), demo=demo)


def comparison(session: Session, listing: Listing, settings: Settings) -> dict:
    post = listing.post
    target = to_row(listing, post, post.current_version.text if post.current_version else "")
    eligible, _ = pool(session, settings, demo=post.is_demo, with_text=True)
    cfg = config(settings)
    c = m.compare(target, eligible, cfg)
    similar = []
    if c.group:
        tfidf = TfIdf([r.text for r in c.group] + [target.text])
        ranked = sorted(c.group, key=lambda r: tfidf.cosine(target.text, r.text), reverse=True)
        similar = [{"listing_id": r.listing_id, "rent_vnd": r.rent_vnd, "area_m2": r.area_m2}
                   for r in ranked[:cfg.similar_count]]
    return {
        "status": c.status,
        "reason_codes": c.reason_codes,
        "criteria": c.criteria,
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


def summary(session: Session, settings: Settings, *, wards: list[str] | None, types: list[str] | None,
            basis: str, demo: bool) -> dict:
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
    updated = session.scalar(select(func.max(Listing.created_at)).join(Post, Post.id == Listing.post_id)
                             .where(Post.is_demo.is_(demo)))
    return {"total_listings": total, "eligible_listings": len(eligible), "excluded_counts": excluded,
            "updated_at": iso(updated), "is_demo": demo}
