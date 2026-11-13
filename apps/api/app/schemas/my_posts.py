"""Private submission transport; contains no other sender's identity."""
from typing import Literal

from pydantic import BaseModel

from app.schemas.public import Comparison

PostStatus = Literal["received", "needs_review", "published", "rejected", "not_rental", "failed"]
StatusGroup = Literal["all", "published", "waiting", "other"]


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
    comparison: Comparison


class MyPost(BaseModel):
    post_id: str
    received_at: str
    source_group_name: str | None
    permalink: str | None
    excerpt: str
    status: PostStatus
    reason_codes: list[str]
    photo_count: int
    listings: list[ExtractedListing]


class MyPosts(BaseModel):
    items: list[MyPost]
    total: int
    page: int
    limit: int
    comparison_baseline: Literal["real_accepted"] = "real_accepted"


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
