"""Workspace transport DTOs, mirrored from service outputs; no business rules."""
from typing import Any, Literal
from pydantic import BaseModel
from app.schemas.public import Evidence, Listing, PropertyType, ReviewStatus

class SessionUser(BaseModel):
    user_id: str
    username: str
    roles: list[Literal["renter", "collector", "reviewer", "researcher", "admin"]]

class AnalysisCreated(BaseModel):
    analysis_id: str
    status: str

class AnalysisResult(AnalysisCreated):
    post_type: str | None
    partial: bool
    llm_status: str | None
    contributed: bool
    is_demo: bool
    text_complete: bool
    text: str | None
    listings: list[Listing]
    error: dict[str, str | None] | None

class Contributed(BaseModel):
    contributed: bool

class LoggedOut(BaseModel):
    logged_out: bool

class ExtensionTokenInfo(BaseModel):
    id: str
    name: str | None
    created_at: str | None
    expires_at: str | None
    revoked_at: str | None
    last_used_at: str | None

class ExtensionTokenCreated(ExtensionTokenInfo):
    token: str

class ExtensionTokens(BaseModel):
    items: list[ExtensionTokenInfo]

class MarketCellDTO(BaseModel):
    ward_code: str | None
    ward_name: str | None
    property_type: PropertyType
    basis: Literal["per_unit", "per_person"]
    n: int
    mean_vnd: int | None = None
    mean_per_m2: int | None = None
    median: float | None
    p25: float | None
    p75: float | None
    median_per_m2: float | None
    n_per_m2: int
    data_from: str | None
    data_to: str | None

class MarketSummaryDTO(BaseModel):
    cells: list[MarketCellDTO]
    excluded_counts: dict[str, int]
    min_n: int
    window_days: int
    data_from: str | None
    data_to: str | None
    is_demo: bool

class PostJob(BaseModel):
    status: str
    attempt: int
    error_code: str | None

class TeamPost(BaseModel):
    post_id: str
    status: str
    post_type: str | None
    mode: str
    source_type: str
    source_group_name: str | None
    collector: str
    contributed: bool
    is_demo: bool
    first_seen_at: str | None
    last_seen_at: str | None
    posted_at: str | None
    excerpt: str
    text_complete: bool
    job: PostJob | None
    listing_count: int

class TeamPosts(BaseModel):
    items: list[TeamPost]
    total: int
    page: int
    page_size: int
    by_status: dict[str, int]

class Reprocessed(BaseModel):
    post_id: str
    job_id: str
    status: str

class ReviewQueueItem(BaseModel):
    listing_id: str
    reasons: list[str]
    reason: str
    excerpt: str
    property_type: PropertyType
    ward_name: str | None
    created_at: str | None
    version: int
    is_demo: bool

class ReviewQueue(BaseModel):
    items: list[ReviewQueueItem]
    total: int
    counts: dict[str, int]

class ReviewPost(BaseModel):
    post_id: str
    text: str
    permalink: str | None

class ReviewRun(BaseModel):
    run_id: str
    llm_status: str
    model_id: str | None
    regex_spans: list[Evidence]
    llm_spans: list[Evidence]

class DuplicateCandidate(BaseModel):
    listing_id: str
    cluster_id: str | None
    cosine: float
    rent_vnd: int | None
    area_m2: float | None

class ReviewHistory(BaseModel):
    action: str
    user_id: str
    reason: str | None
    created_at: str | None

class ReviewDetail(BaseModel):
    listing: Listing
    version: int
    review_status: ReviewStatus
    reasons: list[str]
    cluster_id: str | None
    post: ReviewPost
    run: ReviewRun
    suspected_duplicates: list[DuplicateCandidate]
    history: list[ReviewHistory]

class ReviewSaved(BaseModel):
    listing_id: str
    review_status: ReviewStatus
    version: int
    cluster_id: str | None

class LabEvidenceRow(BaseModel):
    method: str
    evidence: list[Evidence]
    available: bool | None = None

class LabTokenDTO(BaseModel):
    token: str
    regex: str
    llm: str
    gold: str | None

class LabNormalized(BaseModel):
    field: str
    regex: str
    llm: str
    gold: str | None

class LabResultDTO(BaseModel):
    post_id: str | None
    text: str
    split: str | None
    post_type: str
    rows: list[LabEvidenceRow]
    tokens: list[LabTokenDTO]
    normalized: list[LabNormalized]
    # Extraction objects do not yet carry persisted listing IDs.
    listings: dict[str, list[dict[str, Any]]]

class GoldResult(BaseModel):
    post_id: str
    split: str
    cluster_key: str
    spans: list[dict[str, Any]]
    expected: dict[str, Any] | None
    adjudicated: bool

class EvalManifest(BaseModel):
    run_id: str | None = None
    split: str | None = None
    frozen: bool | None = None
    methods: list[str] | None = None
    versions: dict[str, Any] | None = None
    started_at: str | None = None
    finished_at: str | None = None
    git_commit: str | None = None

class EvalRuns(BaseModel):
    items: list[EvalManifest]

class EvalErrorCount(BaseModel):
    method: str | None
    error_type: str | None
    count: int

class EvalResult(BaseModel):
    # Keep the complete manifest, including runner-specific version metadata.
    manifest: dict[str, Any]
    metrics: dict[str, Any] | None
    error_counts: list[EvalErrorCount]
