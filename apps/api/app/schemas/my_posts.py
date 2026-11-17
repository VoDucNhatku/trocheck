"""Private submission transport; contains no other sender's identity."""
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.public import Comparison, PropertyType

PostStatus = Literal["received", "needs_review", "published", "rejected", "not_rental", "failed"]
StatusGroup = Literal["all", "published", "waiting", "other"]
SortKey = Literal["newest", "price_asc", "price_desc", "area_desc"]


class OldDistrictRef(BaseModel):
    key: str
    name: str


AreaMatch = Literal["ward", "mention", "multi_area"]


class ExtractedListing(BaseModel):
    listing_id: str
    review_status: str
    reason_codes: list[str]
    public_url: str | None
    price_vnd: int | None
    price_min_vnd: int | None
    price_form: str | None
    price_basis: str | None
    price_period: str | None
    area_m2: float | None
    room_type: str | None
    ward_code: str | None
    ward_name: str | None
    resolution: str | None
    # Only with an area filter: "ward" the resolved ward is in the district, "mention" the post names it,
    # "multi_area" the post lists many districts (agency ad). None without an area filter.
    area_match: AreaMatch | None
    old_districts: list[OldDistrictRef]
    comparison: Comparison


class PostProgress(BaseModel):
    stage: Literal["queued", "reading", "asking_ai", "needs_review", "published", "not_published", "failed"]
    queue_position: int | None = None
    estimated_wait_seconds: int | None = None
    reason: str | None = None
    started_at: str | None = None
    finished_at: str | None = None


class MyPost(BaseModel):
    post_id: str
    received_at: str
    source_group_name: str | None
    permalink: str | None
    excerpt: str
    status: PostStatus
    progress: PostProgress | None = None
    reason_codes: list[str]
    photo_count: int
    listing_total: int
    listings: list[ExtractedListing]


class MyPosts(BaseModel):
    items: list[MyPost]
    total: int
    page: int
    limit: int
    comparison_baseline: Literal["real_accepted"] = "real_accepted"
    matched_listings: int
    total_sent: int


class StatusCounts(BaseModel):
    all: int
    published: int
    waiting: int
    other: int


class DailyQuota(BaseModel):
    used: int
    limit: int | None
    remaining: int | None
    timezone: Literal["Asia/Ho_Chi_Minh"] = "Asia/Ho_Chi_Minh"


class MyPostsSummary(BaseModel):
    counts: StatusCounts
    quota: DailyQuota
    stage_counts: dict[str, int] = Field(default_factory=dict)
    active: bool = False
    estimated_wait_seconds: int | None = None


class AreaOption(BaseModel):
    key: str
    name: str
    listing_count: int
    post_count: int


class WardOption(BaseModel):
    code: str
    name: str | None
    listing_count: int
    post_count: int


class TypeOption(BaseModel):
    type: str
    listing_count: int


class MyPostsFilters(BaseModel):
    areas: list[AreaOption]
    wards: list[WardOption]
    types: list[TypeOption]
    price_min_vnd: int | None
    price_max_vnd: int | None
    area_min_m2: float | None
    area_max_m2: float | None
    total_listings: int
