"""M9 market statistics and price verdict (gop-trung-va-thong-ke §2-§5). Pure functions.

Only exact monthly rents with a known basis, a ward and a property type, inside the window,
one (latest) listing per cluster. The target's whole cluster is excluded. N < min_n -> no
mean or median, `insufficient_data`. P25-P75 describe spread; they are not a confidence interval.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from app.core.formatting import format_number_vi

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


PROPERTY_LABELS = {"phong_tro": "phòng trọ", "ccmn": "chung cư mini", "can_ho_dich_vu": "căn hộ dịch vụ",
                   "nha_nguyen_can": "nhà nguyên căn"}
FORM_LABELS = {"starting_from": "từ…", "range": "khoảng…", "none": "không công khai"}


def verdict_sentence(c: Comparison, rent_form: str | None = None, *, min_n: int = 10) -> str:
    """Sentences from §5. The disclaimer line is always shown with them."""
    if c.status == "not_comparable" and "price_not_exact" in c.reason_codes and rent_form in FORM_LABELS:
        return f"Bài ghi giá dạng {FORM_LABELS[rent_form]}, chưa so sánh được."
    if c.status == "insufficient_data":
        return (f"Chưa đủ dữ liệu để nhận định: mới có {c.stats.n} tin tương tự "
                f"(cần ít nhất {min_n}).")
    if c.status != "ok":
        return "Chưa so sánh được."
    kind = PROPERTY_LABELS.get(c.criteria["property_type"], "")
    band = "" if c.criteria["broad_group"] else f" {c.criteria['area_band']} m²"
    delta = format_number_vi(c.delta_percent, decimals=1, signed=True)
    relation = {"lower": "Thấp hơn", "higher": "Cao hơn"}.get(c.verdict, "Gần")
    return f"{relation} mức trung bình ({delta}%) của {c.stats.n} tin {kind}{band} cùng phường."


def disclaimer(c: Comparison) -> str:
    return (f"Dữ liệu từ {c.stats.data_from} đến {c.stats.data_to}. Đây là giá chào thuê trong bài "
            "đăng đã thu, không phải giá giao dịch.")
