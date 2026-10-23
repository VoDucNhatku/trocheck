"""DB rows <-> listing dicts in the shape of spec/schemas/listing-extraction.schema.json."""
from __future__ import annotations

from app.core.ids import iso
from app.models import Evidence, FieldValue, Listing, Post

META_KEYS = ("decision", "abstain_reason", "agreement", "evidence")
SINGLE_FIELDS = ("rent", "area", "room", "location")


def evidence_dict(ev: Evidence) -> dict:
    out = {"start": ev.start, "end": ev.end, "quote": ev.quote, "label": ev.label, "method": ev.method}
    if ev.rule_id:
        out["rule_id"] = ev.rule_id
    return out


def field_rows(listing_dict: dict) -> list[FieldValue]:
    """Listing dict -> FieldValue rows with evidence (rent/area/room/location + one row per fee)."""
    rows = []
    for name in SINGLE_FIELDS:
        value = listing_dict[name]
        rows.append(_row(name, 0, value))
    for i, fee in enumerate(listing_dict.get("fees", [])):
        rows.append(_row("fee", i, fee))
    return rows


def _source(value: dict) -> str:
    agreement = value.get("agreement")
    if agreement == "llm_only":
        return "llm"
    if agreement == "human":
        return "human"
    methods = {e["method"] for e in value.get("evidence", [])}
    return "llm" if methods == {"llm"} else "regex"


def _row(name: str, position: int, value: dict) -> FieldValue:
    body = {k: v for k, v in value.items() if k not in META_KEYS}
    row = FieldValue(field=name, position=position, value_json=body, decision=value.get("decision"),
                     abstain_reason=value.get("abstain_reason"), agreement=value.get("agreement"),
                     source=_source(value))
    row.evidence = [Evidence(position=i, start=e["start"], end=e["end"], quote=e["quote"], label=e["label"],
                             method=e["method"], rule_id=e.get("rule_id"))
                    for i, e in enumerate(value.get("evidence", []))]
    return row


def field_dict(row: FieldValue) -> dict:
    out = dict(row.value_json)
    if row.field != "fee":
        out["decision"] = row.decision
        if row.abstain_reason:
            out["abstain_reason"] = row.abstain_reason
        if row.agreement:
            out["agreement"] = row.agreement
    out["evidence"] = [evidence_dict(e) for e in row.evidence]
    return out


def listing_dict(listing: Listing) -> dict:
    out: dict = {"listing_id": listing.id, "listing_index": listing.listing_index, "fees": []}
    for row in listing.fields:
        if row.field == "fee":
            out["fees"].append(field_dict(row))
        else:
            out[row.field] = field_dict(row)
    out["review_status"] = listing.review_status
    return out


def lookup_columns(listing: dict) -> dict:
    rent, area, room, loc = listing["rent"], listing["area"], listing["room"], listing["location"]
    return {
        "rent_amount_vnd": rent.get("amount_vnd"),
        "rent_min_vnd": rent.get("min_vnd"),
        "rent_form": rent.get("amount_form"),
        "rent_basis": rent.get("basis"),
        "rent_period": rent.get("period"),
        "area_m2": area.get("value_m2"),
        "area_from_dimensions": bool(area.get("from_dimensions")),
        "property_type": room.get("property_type"),
        "ward_code": loc.get("ward_code"),
        "ward_name": loc.get("ward_name"),
    }


def card(listing: Listing, post: Post, *, verdict: str | None = None, delta: float | None = None) -> dict:
    """Item of GET /listings (thẻ tin), matching apps/web/src/lib/api/types.ts ListingCard."""
    data = listing_dict(listing)
    rent = data["rent"]
    version = post.current_version
    return {
        "listing_id": listing.id,
        "property_type": listing.property_type or "unknown",
        "ward_name": listing.ward_name,
        "landmark": data["location"].get("landmark"),
        "rent": {k: rent.get(k) for k in ("visibility", "amount_form", "amount_vnd", "min_vnd", "max_vnd",
                                          "basis", "period")},
        "area_m2": listing.area_m2,
        "fees": [{k: v for k, v in f.items() if k != "evidence"} for f in data["fees"]],
        "posted_at": iso(post.posted_at),
        "verdict": verdict,
        "delta_percent": delta,
        "review_status": listing.review_status,
        "is_demo": post.is_demo,
        "text_complete": bool(version.text_complete) if version else True,
    }
