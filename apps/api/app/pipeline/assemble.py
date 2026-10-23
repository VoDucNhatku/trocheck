"""Turn the spans of one method (Regex or LLM) into normalised listings with M4.

Both methods go through this same code, so they differ only in span finding (ADR-0003).
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.pipeline import normalize as n
from app.pipeline.places import Places
from app.pipeline.regex_extractor import Span


@dataclass
class Draft:
    """One listing as seen by one method, before reconciliation."""
    listing_index: int
    rent: dict
    area: dict
    room: dict
    location: dict
    fees: list[dict]
    multi_price: bool = False
    rent_unsupported: bool = False
    present: dict = field(default_factory=dict)  # field -> has a value


def evidence(sp: Span) -> dict:
    ev = {"start": sp.start, "end": sp.end, "quote": sp.quote, "label": sp.label, "method": sp.method}
    if sp.rule_id:
        ev["rule_id"] = sp.rule_id
    return ev


def _abstain(field_value: dict, reason: str = "not_in_text") -> dict:
    field_value.update(decision="abstained", abstain_reason=reason)
    return field_value


def rent_key(rent: dict) -> tuple:
    return (rent["amount_form"], rent.get("amount_vnd"), rent.get("min_vnd"), rent.get("max_vnd"))


def _build_rent(spans: list[Span]) -> tuple[dict, bool, bool]:
    parsed = [(sp, n.parse_rent(sp.quote)) for sp in spans]
    disclosed = [(sp, r) for sp, r in parsed if r["amount_form"] != "none"]
    if disclosed:
        sp0, rent = disclosed[0]
        keys = {rent_key(r) for _, r in disclosed}
        rent.pop("unsupported", None)
        rent.update(decision="answered",
                    evidence=[evidence(sp) for sp, r in disclosed if rent_key(r) == rent_key(rent)]
                    + [evidence(sp) for sp, r in disclosed if rent_key(r) != rent_key(rent)])
        return rent, len(keys) > 1, False
    hidden = [(sp, r) for sp, r in parsed if r["visibility"] == "hidden_explicit"]
    unsupported = [(sp, r) for sp, r in parsed if r["unsupported"]]
    base = {"visibility": "not_stated", "amount_form": "none", "amount_vnd": None, "min_vnd": None,
            "max_vnd": None, "basis": "unknown", "period": "unknown", "includes": []}
    if unsupported:
        base.update(visibility="disclosed", decision="needs_review", abstain_reason="unsupported_format",
                    evidence=[evidence(sp) for sp, _ in unsupported])
        return base, False, True
    if hidden:
        base["visibility"] = "hidden_explicit"
        base["evidence"] = [evidence(sp) for sp, _ in hidden]
    return _abstain(base), False, False


def _build_area(spans: list[Span]) -> dict:
    for sp in spans:
        area = n.parse_area(sp.quote)
        if area["amount_form"] != "none":
            area.update(decision="answered", evidence=[evidence(sp)])
            return area
    return _abstain({"amount_form": "none", "value_m2": None, "min_m2": None, "max_m2": None,
                     "from_dimensions": False})


def _build_room(spans: list[Span]) -> dict:
    room: dict = {"property_type": "unknown", "furnishing": "unknown"}
    for sp in spans:
        if sp.rule_id == "LISTING_MARKER":
            continue
        for key, value in n.parse_room(sp.quote).items():
            if key in ("property_type", "furnishing"):
                if room[key] == "unknown":
                    room[key] = value
            else:
                room.setdefault(key, value)
    if spans:
        room.update(decision="answered", evidence=[evidence(sp) for sp in spans])
        return room
    return _abstain(room)


def _build_location(spans: list[Span], places: Places) -> dict:
    loc = {"landmark": None, "street": None, "ward_code": None, "ward_name": None,
           "old_ward_name": None, "old_district_name": None, "resolution": "unresolved"}
    if not spans:
        return _abstain(loc)
    for sp in spans:
        kind = n.location_kind(sp.quote)
        if kind == "ward" and loc["ward_code"] is None:
            ward = places.ward(n.strip_location_prefix(sp.quote))
            if ward:
                loc.update(ward_code=ward.code, ward_name=ward.name, resolution="exact")
        elif kind == "district" and loc["old_district_name"] is None:
            loc["old_district_name"] = n.strip_location_prefix(sp.quote)
        elif kind == "street" and loc["street"] is None:
            loc["street"] = sp.quote.strip(" ,.")
        elif kind == "landmark" and loc["landmark"] is None:
            loc["landmark"] = sp.quote.strip(" ,.")
    if loc["ward_code"] is None:
        for kind, value, resolution in (("street", loc["street"], "from_street"),
                                        ("landmark", loc["landmark"], "from_landmark")):
            ward = places.lookup(kind, value)
            if ward:
                loc.update(ward_code=ward.code, ward_name=ward.name, resolution=resolution)
                break
    # A place is written but nothing usable came out of it (e.g. a ward missing from wards.yaml):
    # it is in the text, so not "abstained", but a person has to resolve it.
    resolved = any(loc[k] for k in ("ward_code", "street", "landmark"))
    loc.update(decision="answered" if resolved else "needs_review", evidence=[evidence(sp) for sp in spans])
    return loc


def _build_fees(spans: list[Span]) -> list[dict]:
    fees = []
    for sp in spans:
        for fee in n.parse_fees(sp.quote):
            fee["evidence"] = [evidence(sp)]
            fees.append(fee)
    return fees


def build_listings(spans: list[Span], count: int, places: Places) -> list[Draft]:
    drafts = []
    for idx in range(count):
        own = [sp for sp in spans if sp.listing_index in (None, idx)]
        # A listing's own span wins over a shared one for single-valued fields.
        own.sort(key=lambda sp: (sp.listing_index is None, sp.start))
        by = {label: [sp for sp in own if sp.label == label] for label in ("PRICE", "AREA", "ROOM", "LOC", "FEE")}
        rent, multi_price, unsupported = _build_rent(by["PRICE"])
        draft = Draft(
            listing_index=idx,
            rent=rent,
            area=_build_area(by["AREA"]),
            room=_build_room(sorted(by["ROOM"], key=lambda sp: sp.start)),
            location=_build_location(sorted(by["LOC"], key=lambda sp: sp.start), places),
            fees=_build_fees(sorted(by["FEE"], key=lambda sp: sp.start)),
            multi_price=multi_price,
            rent_unsupported=unsupported,
        )
        draft.present = {
            "rent": draft.rent["amount_form"] != "none",
            "area": draft.area["amount_form"] != "none",
            "room": draft.room["property_type"] != "unknown",
            "location": any(draft.location.get(k) for k in ("ward_code", "street", "landmark")),
        }
        drafts.append(draft)
    return drafts


def empty_draft(idx: int, places: Places) -> Draft:
    """A listing with every field abstained (the other method found this listing, this one did not)."""
    draft = build_listings([], 1, places)[0]
    draft.listing_index = idx
    return draft
