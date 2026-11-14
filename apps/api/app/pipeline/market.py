"""M9 market statistics and price verdict (gop-trung-va-thong-ke §2-§5). Pure functions.

Only exact monthly rents with a known basis, a ward and a property type, inside the window,
one (latest) listing per cluster. The target's whole cluster is excluded. N < min_n -> no
mean or median, `insufficient_data`. P25-P75 describe spread; they are not a confidence interval.

Tier 2 (ADR-0010, `compare_tiered`): when the ward group is missing or has N < min_n, the same listing may be
compared with the listings of its old district (single-district or ward match only, never a multi-area ad),
first among accepted listings, then among real listings that passed the automatic checks.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field, replace
from datetime import datetime, timedelta

from app.core.formatting import format_number_vi
from app.pipeline.old_districts import area_catalog, districts_of_ward

AREA_BANDS = [(None, 20, "<20"), (20, 30, "[20,30)"), (30, 40, "[30,40)"), (40, 60, "[40,60)"), (60, None, ">=60")]


@dataclass
class MarketRow:
    listing_id: str
    cluster_id: str
    is_demo: bool
    contributed: bool
    review_status: str
    rent_form: str | None
    rent_vnd: int | None
    rent_period: str | None
    rent_basis: str | None
    ward_code: str | None
    ward_name: str | None
    property_type: str | None
    area_m2: float | None
    area_from_dimensions: bool
    observed_at: datetime
    text: str = ""
    # Tier 2 inputs: old-district keys the post names as its own place (listing_districts), the multi-area
    # ad flag, the listing's review reason codes and the post status (rejected_type / failed).
    districts: tuple[str, ...] = ()
    multi_area: bool = False
    review_reasons: tuple[str, ...] = ()
    post_status: str = "extracted"


@dataclass
class MarketConfig:
    min_n: int = 10
    window_days: int = 30
    near_percent: float = 10.0
    similar_count: int = 3


def area_band(area: float | None) -> str | None:
    if area is None:
        return None
    for lo, hi, label in AREA_BANDS:
        if (lo is None or area >= lo) and (hi is None or area < hi):
            return label
    return None


def exclusion_reasons(row: MarketRow, *, now: datetime, cfg: MarketConfig, demo: bool) -> list[str]:
    """Why a listing cannot be used for statistics (empty list = eligible, before cluster dedup)."""
    reasons = []
    if row.is_demo != demo:
        reasons.append("demo_data" if row.is_demo else "real_data")
    if not row.contributed:
        reasons.append("not_contributed")
    if row.review_status not in ("auto_accepted", "approved"):
        reasons.append("not_accepted")
    if row.rent_form != "exact" or row.rent_vnd is None:
        reasons.append("price_not_exact")
    elif row.rent_period != "month":
        reasons.append("period_not_month")
    if row.rent_basis not in ("per_unit", "per_person"):
        reasons.append("basis_unknown")
    if not row.ward_code:
        reasons.append("ward_unresolved")
    if not row.property_type or row.property_type == "unknown":
        reasons.append("property_type_unknown")
    if row.observed_at < now - timedelta(days=cfg.window_days) or row.observed_at > now + timedelta(days=1):
        reasons.append("outside_window")
    return reasons


def latest_per_cluster(rows: list[MarketRow]) -> list[MarketRow]:
    best: dict[str, MarketRow] = {}
    for row in rows:
        cur = best.get(row.cluster_id)
        if cur is None or (row.observed_at, row.listing_id) > (cur.observed_at, cur.listing_id):
            best[row.cluster_id] = row
    return list(best.values())


def eligible_pool(rows: list[MarketRow], *, now: datetime, cfg: MarketConfig, demo: bool) -> tuple[list[MarketRow], dict[str, int]]:
    excluded: dict[str, int] = {}
    ok = []
    for row in rows:
        reasons = exclusion_reasons(row, now=now, cfg=cfg, demo=demo)
        if reasons:
            for r in reasons:
                excluded[r] = excluded.get(r, 0) + 1
        else:
            ok.append(row)
    latest = latest_per_cluster(ok)
    dropped = len(ok) - len(latest)
    if dropped:
        excluded["older_in_cluster"] = dropped
    return latest, excluded


def percentile(values: list[float], q: float) -> float:
    """Linear interpolation between closest ranks (numpy 'linear')."""
    xs = sorted(values)
    if not xs:
        raise ValueError("empty")
    pos = (len(xs) - 1) * q
    lo, hi = math.floor(pos), math.ceil(pos)
    return xs[lo] + (xs[hi] - xs[lo]) * (pos - lo)


@dataclass
class GroupStats:
    n: int
    mean: int | None
    median: int | None
    p25: int | None
    p75: int | None
    n_per_m2: int
    mean_per_m2: int | None
    median_per_m2: int | None
    data_from: str | None
    data_to: str | None


def group_stats(rows: list[MarketRow], cfg: MarketConfig) -> GroupStats:
    n = len(rows)
    prices = [r.rent_vnd for r in rows]
    per_m2 = [r.rent_vnd / r.area_m2 for r in rows
              if r.area_m2 and r.area_m2 > 0 and not r.area_from_dimensions]
    dates = sorted(r.observed_at for r in rows)
    enough = n >= cfg.min_n
    return GroupStats(
        n=n,
        mean=round(sum(prices) / n) if enough else None,
        median=round(percentile(prices, 0.5)) if enough else None,
        p25=round(percentile(prices, 0.25)) if enough else None,
        p75=round(percentile(prices, 0.75)) if enough else None,
        n_per_m2=len(per_m2),
        mean_per_m2=round(sum(per_m2) / len(per_m2)) if len(per_m2) >= cfg.min_n else None,
        median_per_m2=round(percentile(per_m2, 0.5)) if len(per_m2) >= cfg.min_n else None,
        data_from=dates[0].date().isoformat() if dates else None,
        data_to=dates[-1].date().isoformat() if dates else None,
    )


@dataclass
class Comparison:
    status: str
    reason_codes: list[str]
    criteria: dict
    stats: GroupStats
    delta_percent: float | None
    verdict: str | None
    group: list[MarketRow] = field(default_factory=list)
    scope: str = "ward"                 # "ward" (tier 1) | "old_district" (tier 2)
    scope_label: str | None = None      # ward name, or "Bình Thạnh (cũ)"
    pool: str = "accepted"              # "accepted" | "auto_checked" (tier 2 fallback)


def compare(target: MarketRow, pool: list[MarketRow], cfg: MarketConfig) -> Comparison:
    """Compare a target listing with its group of similar listings (§3-§5)."""
    reasons = []
    if target.rent_form != "exact" or target.rent_vnd is None or target.rent_period != "month":
        reasons.append("price_not_exact")
    if target.rent_basis not in ("per_unit", "per_person"):
        reasons.append("basis_unknown")
    if not target.ward_code:
        reasons.append("ward_unresolved")
    band = area_band(target.area_m2)
    broad = band is None
    criteria = {
        "ward_code": target.ward_code, "ward_name": target.ward_name,
        "property_type": target.property_type, "basis": target.rent_basis,
        "area_band": band, "window_days": cfg.window_days, "broad_group": broad,
        "old_district_key": None,
    }
    empty = group_stats([], cfg)
    if reasons or not target.property_type or target.property_type == "unknown":
        return Comparison("not_comparable", reasons, criteria, empty, None, None)
    if broad:
        reasons.append("area_missing_broad_group")
    group = [r for r in pool
             if r.cluster_id != target.cluster_id
             and r.ward_code == target.ward_code
             and r.property_type == target.property_type
             and r.rent_basis == target.rent_basis
             and (broad or area_band(r.area_m2) == band)]
    stats = group_stats(group, cfg)
    if stats.n < cfg.min_n:
        return Comparison("insufficient_data", reasons + ["too_few_samples"], criteria, stats, None, None, group)
    delta = None
    verdict = None
    if stats.mean and stats.mean > 0:
        delta = round((target.rent_vnd - stats.mean) / stats.mean * 100, 1)
        if delta < -cfg.near_percent:
            verdict = "lower"
        elif delta > cfg.near_percent:
            verdict = "higher"
        else:
            verdict = "near"
    return Comparison("ok", reasons, criteria, stats, delta, verdict, group)


# --- tier 2: old district (ADR-0010) ------------------------------------------------------------

ACCEPTED_STATUSES = ("auto_accepted", "approved")
# A listing carrying one of these codes is not part of the "auto_checked" pool: a price conflict, a post
# with several listings that was not split, a listing outside the HCM province, a suspected duplicate, an
# LLM failure, or a rent only the LLM saw. Location-unresolved codes (former_ward_*, former_district_unverified)
# are allowed: tier 2 does not need a ward.
BLOCKING_REASONS = frozenset({"conflict", "multi_listing", "outside_hcm_province", "possible_duplicate",
                              "llm_error", "rent_llm_only"})
UNUSABLE_REVIEW_STATUSES = ("rejected", "duplicate")
UNUSABLE_POST_STATUSES = ("rejected_type", "failed")
POOL_ACCEPTED, POOL_AUTO_CHECKED = "accepted", "auto_checked"


def old_district_of(row: MarketRow) -> str | None:
    """The one old district a listing belongs to, or None. Ward match: its ward belongs to exactly one old
    district (a ward spanning two districts needs the post to name one of them). Mention match: no ward and
    the post names exactly one district as its own place. Multi-area ads never match."""
    if row.multi_area:
        return None
    named = tuple(dict.fromkeys(row.districts))
    if row.ward_code:
        keys = districts_of_ward().get(row.ward_code, ())
        if len(keys) == 1:
            return keys[0]
        if len(keys) > 1:
            hits = [key for key in named if key in keys]
            return hits[0] if len(hits) == 1 else None
    return named[0] if len(named) == 1 else None


def district_label(key: str) -> str:
    """'binh-thanh' -> 'Bình Thạnh (cũ)'; numbered districts keep 'Quận 12 (cũ)'."""
    name = area_catalog()[key].name if key in area_catalog() else key
    if not key.startswith("quan-"):
        for prefix in ("Quận ", "Huyện ", "Thành phố ", "Thị xã "):
            if name.startswith(prefix):
                name = name[len(prefix):]
                break
    return f"{name} (cũ)"


def district_pool_reasons(row: MarketRow, *, now: datetime, cfg: MarketConfig, demo: bool, pool: str) -> list[str]:
    """Why a listing is not in the tier 2 pool (empty = eligible before cluster dedup). No ward needed."""
    reasons = []
    if row.is_demo != demo:
        reasons.append("demo_data" if row.is_demo else "real_data")
    if not row.contributed:
        reasons.append("not_contributed")
    accepted = row.review_status in ACCEPTED_STATUSES
    if pool == POOL_ACCEPTED:
        if not accepted:
            reasons.append("not_accepted")
    elif not accepted:
        if row.review_status in UNUSABLE_REVIEW_STATUSES:
            reasons.append("review_rejected")
        if row.post_status in UNUSABLE_POST_STATUSES:
            reasons.append("post_not_usable")
        if BLOCKING_REASONS.intersection(row.review_reasons):
            reasons.append("blocking_reason")
    if row.rent_form != "exact" or row.rent_vnd is None:
        reasons.append("price_not_exact")
    elif row.rent_period != "month":
        reasons.append("period_not_month")
    if row.rent_basis not in ("per_unit", "per_person"):
        reasons.append("basis_unknown")
    if not row.property_type or row.property_type == "unknown":
        reasons.append("property_type_unknown")
    if row.observed_at < now - timedelta(days=cfg.window_days) or row.observed_at > now + timedelta(days=1):
        reasons.append("outside_window")
    if old_district_of(row) is None:
        reasons.append("old_district_unresolved")
    return reasons


def district_pool(rows: list[MarketRow], *, now: datetime, cfg: MarketConfig, demo: bool, pool: str) -> list[MarketRow]:
    ok = [r for r in rows if not district_pool_reasons(r, now=now, cfg=cfg, demo=demo, pool=pool)]
    return latest_per_cluster(ok)


def _tier2_group(target: MarketRow, key: str, pool_rows: list[MarketRow], band: str | None) -> list[MarketRow]:
    return [r for r in pool_rows
            if r.cluster_id != target.cluster_id
            and old_district_of(r) == key
            and r.property_type == target.property_type
            and r.rent_basis == target.rent_basis
            and (band is None or area_band(r.area_m2) == band)]


def compare_tiered(target: MarketRow, rows: list[MarketRow], *, now: datetime, cfg: MarketConfig,
                   demo: bool) -> Comparison:
    """Tier 1 (ward group, accepted listings) as `compare`; tier 2 only when tier 1 is `insufficient_data`
    or `not_comparable` solely because the ward is missing. Tier 2 never relaxes price, basis, type or area."""
    ward_pool, _ = eligible_pool(rows, now=now, cfg=cfg, demo=demo)
    tier1 = compare(target, ward_pool, cfg)
    tier1 = replace(tier1, scope_label=target.ward_name)
    if tier1.status == "ok" or demo:  # demo data has no old-district mentions and never feeds a real baseline
        return tier1
    if tier1.status == "not_comparable" and set(tier1.reason_codes) != {"ward_unresolved"}:
        return tier1
    if not target.property_type or target.property_type == "unknown":
        return tier1
    key = old_district_of(target)
    if key is None:
        return tier1
    band = area_band(target.area_m2)
    criteria = {**tier1.criteria, "old_district_key": key}
    base_reasons = [r for r in tier1.reason_codes if r != "too_few_samples"]
    if band is None and "area_missing_broad_group" not in base_reasons:
        base_reasons.append("area_missing_broad_group")
    label = district_label(key)
    last = None
    for pool in (POOL_ACCEPTED, POOL_AUTO_CHECKED):
        group = _tier2_group(target, key, district_pool(rows, now=now, cfg=cfg, demo=demo, pool=pool), band)
        stats = group_stats(group, cfg)
        last = (pool, group, stats)
        if stats.n >= cfg.min_n:
            delta = verdict = None
            if stats.mean and stats.mean > 0:
                delta = round((target.rent_vnd - stats.mean) / stats.mean * 100, 1)
                verdict = ("lower" if delta < -cfg.near_percent else "higher" if delta > cfg.near_percent
                           else "near")
            return Comparison("ok", base_reasons, criteria, stats, delta, verdict, group,
                              scope="old_district", scope_label=label, pool=pool)
    if tier1.status == "insufficient_data":
        return tier1  # the ward group result stands; tier 2 had nothing better to say
    pool, group, stats = last
    return Comparison("insufficient_data", base_reasons + ["too_few_samples"], criteria, stats, None, None, group,
                      scope="old_district", scope_label=label, pool=pool)


PROPERTY_LABELS = {"phong_tro": "phòng trọ", "ccmn": "chung cư mini", "can_ho_dich_vu": "căn hộ dịch vụ",
                   "nha_nguyen_can": "nhà nguyên căn"}
FORM_LABELS = {"starting_from": "từ…", "range": "khoảng…", "none": "không công khai"}


POOL_NOTE = {"accepted": "chỉ gồm tin đã duyệt", "auto_checked": "gồm tin chưa duyệt, đã qua kiểm tra tự động"}


def scope_note(c: Comparison) -> str:
    """Where the group comes from when it is not the ward tier. Always shown with a tier 2 sentence."""
    if c.scope != "old_district":
        return ""
    return f"không cùng phường, {POOL_NOTE.get(c.pool, '')}"


def verdict_sentence(c: Comparison, rent_form: str | None = None, *, min_n: int = 10) -> str:
    """Sentences from §5. The disclaimer line is always shown with them."""
    if c.status == "not_comparable" and "price_not_exact" in c.reason_codes and rent_form in FORM_LABELS:
        return f"Bài ghi giá dạng {FORM_LABELS[rent_form]}, chưa so sánh được."
    if c.status == "insufficient_data":
        if c.scope == "old_district":
            return (f"Chưa đủ dữ liệu để nhận định: mới có {c.stats.n} tin tương tự ở {c.scope_label} "
                    f"({scope_note(c)}; cần ít nhất {min_n}).")
        return (f"Chưa đủ dữ liệu để nhận định: mới có {c.stats.n} tin tương tự "
                f"(cần ít nhất {min_n}).")
    if c.status != "ok":
        return "Chưa so sánh được."
    kind = PROPERTY_LABELS.get(c.criteria["property_type"], "")
    band = "" if c.criteria["broad_group"] else f" {c.criteria['area_band']} m²"
    delta = format_number_vi(c.delta_percent, decimals=1, signed=True)
    relation = {"lower": "Thấp hơn", "higher": "Cao hơn"}.get(c.verdict, "Gần")
    if c.scope == "old_district":
        return (f"{relation} mức trung bình ({delta}%) của {c.stats.n} tin {kind}{band} ở {c.scope_label}"
                f" ({scope_note(c)}).")
    return f"{relation} mức trung bình ({delta}%) của {c.stats.n} tin {kind}{band} cùng phường."


def disclaimer(c: Comparison) -> str:
    return (f"Dữ liệu từ {c.stats.data_from} đến {c.stats.data_to}. Đây là giá chào thuê trong bài "
            "đăng đã thu, không phải giá giao dịch.")
