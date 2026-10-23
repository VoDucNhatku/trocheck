"""Public read DTOs. Extraction fields follow spec/schemas/listing-extraction.schema.json.

Optional extraction keys stay optional (exclude_unset on routes); explicit nulls are preserved.
No pipeline or statistics rules live in these transport models.
"""
from typing import Literal

from pydantic import BaseModel

PropertyType = Literal["phong_tro", "ccmn", "can_ho_dich_vu", "nha_nguyen_can", "unknown"]
Basis = Literal["per_unit", "per_person", "unknown"]
Period = Literal["month", "day", "unknown"]
ReviewStatus = Literal["auto_accepted", "needs_review", "approved", "rejected", "duplicate"]
Verdict = Literal["higher", "near", "lower"]
FeeType = Literal["deposit", "electricity", "water", "service", "internet", "parking", "other"]
PostType = Literal["rental_offer", "seeking", "roommate", "sale", "spam", "other"]


class Evidence(BaseModel):
    start: int
    end: int
    quote: str
    label: Literal["PRICE", "AREA", "LOC", "ROOM", "FEE"]
    method: Literal["regex", "llm", "human"]
    rule_id: str | None = None


class FieldMeta(BaseModel):
    decision: Literal["answered", "abstained", "needs_review"]
    abstain_reason: Literal["not_in_text", "ambiguous_source", "conflict", "llm_error", "unsupported_format"] | None = None
    agreement: Literal["both_agree", "regex_only", "llm_only", "conflict", "human"] | None = None
    evidence: list[Evidence]


class CardRent(BaseModel):
    visibility: Literal["disclosed", "hidden_explicit", "not_stated", "ambiguous"]
    amount_form: Literal["exact", "range", "starting_from", "none"]
    amount_vnd: int | None = None
    min_vnd: int | None = None
    max_vnd: int | None = None
    basis: Basis
    period: Period


class Rent(CardRent, FieldMeta):
    includes: list[FeeType]


class Area(FieldMeta):
    amount_form: Literal["exact", "range", "none"]
    value_m2: float | None = None
    min_m2: float | None = None
    max_m2: float | None = None
    from_dimensions: bool = False


class Room(FieldMeta):
    property_type: PropertyType
    bedrooms: int | None = None
    bathrooms: int | None = None
    mezzanine: bool | None = None
    private_bathroom: bool | None = None
    furnishing: Literal["full", "basic", "none", "unknown"]


class Location(FieldMeta):
    landmark: str | None = None
    street: str | None = None
    ward_code: str | None = None
    ward_name: str | None = None
    old_ward_name: str | None = None
    old_district_name: str | None = None
    resolution: Literal["exact", "from_street", "from_landmark", "unresolved"]


class Fee(BaseModel):
    type: FeeType
    unit: Literal["per_kwh", "per_m3", "per_person_month", "per_unit_month", "months_of_rent", "one_time", "unknown"]
    amount_vnd: int | None = None
    months: float | None = None
    free: bool = False
    state_rate: bool = False
    evidence: list[Evidence] | None = None


class Listing(BaseModel):
    listing_id: str
    listing_index: int
    rent: Rent
    area: Area
    room: Room
    location: Location
    fees: list[Fee]
    review_status: ReviewStatus


class ListingCard(BaseModel):
    listing_id: str
    property_type: PropertyType
    ward_name: str | None
    landmark: str | None
    rent: CardRent
    area_m2: float | None
    fees: list[Fee]
    posted_at: str | None
    verdict: Verdict | None
    delta_percent: float | None
    review_status: ReviewStatus
    is_demo: bool
    text_complete: bool


class ListingsResponse(BaseModel):
    items: list[ListingCard]
    total: int
    hidden_no_price: int
    data_as_of: str | None
    page: int
    page_size: int
    is_demo: bool


class PublicPost(BaseModel):
    post_id: str
    text: str
    permalink: str | None
    source_group_name: str | None
    posted_at: str | None
    text_complete: bool
    post_type: PostType | None


class PriceHistory(BaseModel):
    listing_id: str
    observed_at: str | None
    rent_form: Literal["exact", "range", "starting_from", "none"] | None
    rent_vnd: int | None
    review_status: ReviewStatus


class ListingDetail(BaseModel):
    listing: Listing
    post: PublicPost
    sibling_count: int
    cluster_id: str | None
    price_history: list[PriceHistory]
    is_demo: bool


class ComparisonCriteria(BaseModel):
    ward_code: str | None
    ward_name: str | None
    property_type: PropertyType | None
    basis: Basis | None
    area_band: str | None
    window_days: int
    broad_group: bool


class SimilarListing(BaseModel):
    listing_id: str
    rent_vnd: int
    area_m2: float | None


class Comparison(BaseModel):
    status: Literal["ok", "insufficient_data", "not_comparable"]
    reason_codes: list[Literal["too_few_samples", "price_not_exact", "basis_unknown", "ward_unresolved", "area_missing_broad_group"]]
    criteria: ComparisonCriteria
    n: int
    mean_vnd: int | None = None
    mean_per_m2: int | None = None
    median: float | None
    p25: float | None
    p75: float | None
    n_per_m2: int
    median_per_m2: float | None
    delta_percent: float | None
    verdict: Verdict | None
    data_from: str | None
    data_to: str | None
    similar: list[SimilarListing]
    message: str
    disclaimer: str | None
    is_demo: bool


class StatsOverview(BaseModel):
    total_listings: int
    eligible_listings: int
    excluded_counts: dict[str, int]
    updated_at: str | None
    is_demo: bool


class ErrorInfo(BaseModel):
    code: str
    message: str
    field_errors: dict[str, str] | None = None
    request_id: str


class ErrorResponse(BaseModel):
    error: ErrorInfo
