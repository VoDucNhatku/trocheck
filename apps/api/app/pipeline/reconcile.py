"""M5 reconciliation of Regex and LLM drafts (pipeline-xu-ly §M5).

`agreement` is a process state, not a probability (data dictionary §5).
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.pipeline.assemble import Draft, rent_key
from app.pipeline.normalize import location_key

FIELDS = ("rent", "area", "room", "location")


@dataclass
class ListingMeta:
    review_status: str
    review_reasons: list[str] = field(default_factory=list)


def _area_key(area: dict) -> tuple:
    def r(v):
        return None if v is None else round(float(v) * 2) / 2  # 0.5 m² tolerance
    return (area["amount_form"], r(area.get("value_m2")), r(area.get("min_m2")), r(area.get("max_m2")))


def _loc_equal(a: dict, b: dict) -> bool:
    if a.get("ward_code") and b.get("ward_code"):
        return a["ward_code"] == b["ward_code"]
    for key in ("street", "landmark"):
        ka, kb = location_key(a.get(key)), location_key(b.get(key))
        if ka and kb and (ka in kb or kb in ka):
            return True
    return False


def _equal(name: str, a: dict, b: dict) -> bool:
    if name == "rent":
        if rent_key(a) != rent_key(b):
            return False
        for dim in ("basis", "period"):
            if "unknown" not in (a[dim], b[dim]) and a[dim] != b[dim]:
                return False
        return True
    if name == "area":
        return _area_key(a) == _area_key(b)
    if name == "room":
        return a["property_type"] == b["property_type"]
    return _loc_equal(a, b)


def _merge_equal(name: str, regex: dict, llm: dict) -> dict:
    out = dict(regex)
    out["evidence"] = regex.get("evidence", []) + llm.get("evidence", [])
    if name == "rent":
        for dim in ("basis", "period"):
            if out[dim] == "unknown":
                out[dim] = llm[dim]
        out["includes"] = sorted(set(regex["includes"]) | set(llm["includes"]),
                                 key=["electricity", "water", "internet", "service", "parking"].index)
    if name == "room":
        for key, value in llm.items():
            if key not in out or out[key] in (None, "unknown"):
                out[key] = value
        out["evidence"] = regex.get("evidence", []) + llm.get("evidence", [])
    if name == "location":
        for key, value in llm.items():
            if key not in ("evidence", "decision") and out.get(key) is None and value is not None:
                out[key] = value
    out.update(decision="answered", agreement="both_agree")
    out.pop("abstain_reason", None)
    return out


def reconcile(regex: list[Draft], llm: list[Draft] | None, *, llm_status: str,
              money_count: int) -> tuple[list[dict], list[ListingMeta]]:
    """llm_status: ok | not_run | error. Returns final listing dicts and their review meta."""
    count = max(len(regex), len(llm or []))
    listings, metas = [], []
    for idx in range(count):
        r = regex[idx] if idx < len(regex) else None
        m = llm[idx] if llm is not None and idx < len(llm) else None
        base = r or m
        out = {"listing_index": idx}
        conflict = False
        for name in FIELDS:
            rv = getattr(r, name) if r else None
            mv = getattr(m, name) if m else None
            r_has = bool(r and r.present[name])
            m_has = bool(m and m.present[name])
            if r_has and m_has:
                if _equal(name, rv, mv):
                    value = _merge_equal(name, rv, mv)
                else:
                    value = dict(rv)
                    value["evidence"] = rv.get("evidence", []) + mv.get("evidence", [])
                    value.update(decision="needs_review", agreement="conflict")
                    conflict = True
            elif r_has:
                value = dict(rv, decision="answered", agreement="regex_only")
                if name == "rent" and money_count >= 3:
                    value["decision"] = "needs_review"
            elif m_has:
                value = dict(mv, decision="answered", agreement="llm_only")
                if name == "rent":
                    value["decision"] = "needs_review"
            else:
                value = dict(getattr(base, name))
                if m is not None and name == "rent" and value["visibility"] == "not_stated":
                    value["visibility"] = mv["visibility"]
                if llm_status == "error" and value.get("decision") != "needs_review":
                    value.update(decision="needs_review", abstain_reason="llm_error")
            value.pop("unsupported", None)
            out[name] = value
        fees = list(r.fees) if r else []
        if m:
            types = {f["type"] for f in fees}
            fees += [f for f in m.fees if f["type"] not in types]
        out["fees"] = fees

        reasons: list[str] = []
        if count > 1 or (r and r.multi_price) or (m and m.multi_price):
            reasons.append("multi_listing")
        if conflict:
            reasons.append("conflict")
        if llm_status == "error":
            reasons.append("llm_error")
        listings.append(out)
        metas.append(ListingMeta("needs_review", reasons))
    return listings, metas


def finalize_status(listing: dict, meta: ListingMeta, listing_count: int) -> None:
    """Initial review_status (M5): auto_accepted only when rent and location are both_agree or
    regex_only with no flag and the post has one listing."""
    rent = listing["rent"]
    if (rent["amount_form"] == "exact" and rent["visibility"] == "disclosed"
            and rent["basis"] == "unknown" and "basis_unknown" not in meta.review_reasons):
        meta.review_reasons.append("basis_unknown")
    ok = (listing_count == 1 and not meta.review_reasons
          and all(listing[f].get("agreement") in ("both_agree", "regex_only")
                  and listing[f]["decision"] == "answered" for f in ("rent", "location")))
    meta.review_status = "auto_accepted" if ok else "needs_review"
