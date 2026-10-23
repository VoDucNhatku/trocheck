"""ORM tables (docs/03-system/04-co-so-du-lieu.md). Names match the data dictionary."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import (JSON, Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text,
                        UniqueConstraint)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.core.ids import new_id, utcnow


def _id() -> Mapped[str]:
    return mapped_column(String(26), primary_key=True, default=new_id)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = _id()
    username: Mapped[str] = mapped_column(String(80), unique=True)
    email: Mapped[str | None] = mapped_column(String(254), unique=True)
    google_subject: Mapped[str | None] = mapped_column(String(255), unique=True)
    auth_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    password_hash: Mapped[str] = mapped_column(String(200))
    roles: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    id: Mapped[str] = _id()
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used_at: Mapped[datetime | None] = mapped_column(DateTime)


class ExtensionToken(Base):
    __tablename__ = "extension_tokens"
    id: Mapped[str] = _id()
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str | None] = mapped_column(String(100))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime)


class Post(Base):
    __tablename__ = "posts"
    __table_args__ = (UniqueConstraint("source_type", "external_post_id", name="uq_posts_external"),)
    id: Mapped[str] = _id()
    source_type: Mapped[str] = mapped_column(String(20))
    source_group_id: Mapped[str | None] = mapped_column(String(100), index=True)
    source_group_name: Mapped[str | None] = mapped_column(String(300))
    permalink: Mapped[str | None] = mapped_column(String(2000))
    external_post_id: Mapped[str | None] = mapped_column(String(100))
    collector_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    mode: Mapped[str] = mapped_column(String(10))
    contributed: Mapped[bool] = mapped_column(Boolean, default=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    post_type: Mapped[str | None] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="received", index=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    posted_at: Mapped[datetime | None] = mapped_column(DateTime)
    posted_at_raw: Mapped[str | None] = mapped_column(String(100))
    current_version_id: Mapped[str | None] = mapped_column(
        ForeignKey("post_versions.id", use_alter=True, name="fk_posts_current_version"))

    versions: Mapped[list["PostVersion"]] = relationship(
        back_populates="post", foreign_keys="PostVersion.post_id", cascade="all, delete-orphan",
        passive_deletes=True)
    current_version: Mapped["PostVersion | None"] = relationship(foreign_keys=[current_version_id],
                                                                 post_update=True)


class PostVersion(Base):
    __tablename__ = "post_versions"
    id: Mapped[str] = _id()
    post_id: Mapped[str] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), index=True)
    text: Mapped[str] = mapped_column(Text)
    text_hash: Mapped[str] = mapped_column(String(64), index=True)
    text_complete: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    post: Mapped[Post] = relationship(back_populates="versions", foreign_keys=[post_id])


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"
    key: Mapped[str] = mapped_column(String(200), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    request_hash: Mapped[str] = mapped_column(String(64))
    result_ref: Mapped[str | None] = mapped_column(String(26))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (Index("ix_jobs_pick", "status", "run_after"),)
    id: Mapped[str] = _id()
    kind: Mapped[str] = mapped_column(String(20))  # extract | reprocess | recompute_market
    post_version_id: Mapped[str | None] = mapped_column(ForeignKey("post_versions.id", ondelete="CASCADE"),
                                                        index=True)
    requested_by: Mapped[str | None] = mapped_column(String(26))
    status: Mapped[str] = mapped_column(String(20), default="queued")
    attempt: Mapped[int] = mapped_column(Integer, default=0)
    run_after: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    locked_by: Mapped[str | None] = mapped_column(String(100))
    locked_until: Mapped[datetime | None] = mapped_column(DateTime)
    error_code: Mapped[str | None] = mapped_column(String(50))
    error_message: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class ExtractionRun(Base):
    __tablename__ = "extraction_runs"
    id: Mapped[str] = _id()
    post_version_id: Mapped[str] = mapped_column(ForeignKey("post_versions.id", ondelete="CASCADE"), index=True)
    job_id: Mapped[str | None] = mapped_column(String(26), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    mode: Mapped[str] = mapped_column(String(20))
    pipeline_version: Mapped[str] = mapped_column(String(20))
    regex_version: Mapped[str] = mapped_column(String(20))
    prompt_version: Mapped[str] = mapped_column(String(40))
    model_id: Mapped[str | None] = mapped_column(String(100))
    normalizer_version: Mapped[str] = mapped_column(String(20))
    lexicon_version: Mapped[str | None] = mapped_column(String(60))
    post_type: Mapped[str | None] = mapped_column(String(20))
    llm_status: Mapped[str] = mapped_column(String(10))  # ok | not_run | error
    llm_error_code: Mapped[str | None] = mapped_column(String(50))
    llm_calls: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    tokens_in: Mapped[int] = mapped_column(Integer, default=0)
    tokens_out: Mapped[int] = mapped_column(Integer, default=0)
    dropped_quotes: Mapped[int] = mapped_column(Integer, default=0)
    regex_spans: Mapped[list] = mapped_column(JSON, default=list)
    llm_spans: Mapped[list] = mapped_column(JSON, default=list)


class LlmCache(Base):
    """M3b cache keyed by text_hash + prompt_version + model_id (pipeline-xu-ly §M3b)."""
    __tablename__ = "llm_cache"
    key: Mapped[str] = mapped_column(String(200), primary_key=True)
    output_json: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Cluster(Base):
    __tablename__ = "clusters"
    id: Mapped[str] = _id()
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    merge_reason: Mapped[str | None] = mapped_column(String(300))
    latest_listing_id: Mapped[str | None] = mapped_column(String(26))


class Listing(Base):
    __tablename__ = "listings"
    __table_args__ = (
        Index("ix_listings_market", "ward_code", "property_type", "rent_basis", "observed_at"),
        UniqueConstraint("run_id", "listing_index", name="uq_listing_run_index"),
    )
    id: Mapped[str] = _id()
    run_id: Mapped[str] = mapped_column(ForeignKey("extraction_runs.id", ondelete="CASCADE"), index=True)
    post_id: Mapped[str] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), index=True)
    listing_index: Mapped[int] = mapped_column(Integer)
    cluster_id: Mapped[str | None] = mapped_column(ForeignKey("clusters.id", ondelete="SET NULL"), index=True)
    review_status: Mapped[str] = mapped_column(String(20), index=True)
    review_reasons: Mapped[list] = mapped_column(JSON, default=list)
    version: Mapped[int] = mapped_column(Integer, default=1)
    # Only listings from the latest run of the current post version are "current".
    is_current: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    # Lookup copies of field_values for filtering (DB doc §listings).
    rent_amount_vnd: Mapped[int | None] = mapped_column(Integer)
    rent_min_vnd: Mapped[int | None] = mapped_column(Integer)
    rent_form: Mapped[str | None] = mapped_column(String(20))
    rent_basis: Mapped[str | None] = mapped_column(String(20))
    rent_period: Mapped[str | None] = mapped_column(String(10))
    area_m2: Mapped[float | None] = mapped_column(Float)
    area_from_dimensions: Mapped[bool] = mapped_column(Boolean, default=False)
    property_type: Mapped[str | None] = mapped_column(String(20))
    ward_code: Mapped[str | None] = mapped_column(String(40))
    ward_name: Mapped[str | None] = mapped_column(String(100))
    observed_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    fields: Mapped[list["FieldValue"]] = relationship(back_populates="listing", cascade="all, delete-orphan",
                                                      passive_deletes=True, order_by="FieldValue.position")
    post: Mapped[Post] = relationship()
    run: Mapped[ExtractionRun] = relationship()


class FieldValue(Base):
    __tablename__ = "field_values"
    id: Mapped[str] = _id()
    listing_id: Mapped[str] = mapped_column(ForeignKey("listings.id", ondelete="CASCADE"), index=True)
    field: Mapped[str] = mapped_column(String(10))  # rent | area | room | location | fee
    position: Mapped[int] = mapped_column(Integer, default=0)
    value_json: Mapped[dict] = mapped_column(JSON)
    decision: Mapped[str | None] = mapped_column(String(20))
    abstain_reason: Mapped[str | None] = mapped_column(String(30))
    agreement: Mapped[str | None] = mapped_column(String(20))
    source: Mapped[str] = mapped_column(String(10))  # regex | llm | human

    listing: Mapped[Listing] = relationship(back_populates="fields")
    evidence: Mapped[list["Evidence"]] = relationship(back_populates="field_value", cascade="all, delete-orphan",
                                                      passive_deletes=True, order_by="Evidence.position")


class Evidence(Base):
    __tablename__ = "evidence"
    id: Mapped[str] = _id()
    field_value_id: Mapped[str] = mapped_column(ForeignKey("field_values.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    start: Mapped[int] = mapped_column(Integer)
    end: Mapped[int] = mapped_column(Integer)
    quote: Mapped[str] = mapped_column(Text)
    label: Mapped[str] = mapped_column(String(10))
    method: Mapped[str] = mapped_column(String(10))
    rule_id: Mapped[str | None] = mapped_column(String(100))

    field_value: Mapped[FieldValue] = relationship(back_populates="evidence")


class ReviewEvent(Base):
    """Append-only review log."""
    __tablename__ = "review_events"
    id: Mapped[str] = _id()
    listing_id: Mapped[str] = mapped_column(ForeignKey("listings.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(20))
    before_json: Mapped[dict | None] = mapped_column(JSON)
    after_json: Mapped[dict | None] = mapped_column(JSON)
    reason: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class GoldAnnotation(Base):
    __tablename__ = "gold_annotations"
    id: Mapped[str] = _id()
    post_version_id: Mapped[str] = mapped_column(ForeignKey("post_versions.id", ondelete="CASCADE"), index=True)
    gold_post_id: Mapped[str] = mapped_column(String(100), unique=True)
    split: Mapped[str] = mapped_column(String(10))  # pilot | dev | test
    cluster_key: Mapped[str | None] = mapped_column(String(100))
    annotator: Mapped[str | None] = mapped_column(String(100))
    spans_json: Mapped[list] = mapped_column(JSON, default=list)
    listings_json: Mapped[dict | None] = mapped_column(JSON)
    adjudicated: Mapped[bool] = mapped_column(Boolean, default=False)


class EvalRun(Base):
    __tablename__ = "eval_runs"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    split: Mapped[str] = mapped_column(String(10))
    methods: Mapped[list] = mapped_column(JSON)
    versions: Mapped[dict] = mapped_column(JSON)
    frozen: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class EvalResult(Base):
    __tablename__ = "eval_results"
    id: Mapped[str] = _id()
    eval_run_id: Mapped[str] = mapped_column(ForeignKey("eval_runs.id", ondelete="CASCADE"), index=True)
    method: Mapped[str] = mapped_column(String(20))
    field: Mapped[str] = mapped_column(String(20))
    metric: Mapped[str] = mapped_column(String(40))
    value: Mapped[float | None] = mapped_column(Float)
    support: Mapped[int | None] = mapped_column(Integer)
