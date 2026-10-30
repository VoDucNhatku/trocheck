"""Request bodies. Field names and limits mirror spec/schemas/*.json (tests check they agree)."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import AnyUrl, BaseModel, ConfigDict, Field, field_validator, ValidationInfo
from app.core.security import normalize_email, validate_password

SourceType = Literal["facebook_group", "manual_paste", "import_file", "fixture"]


class IngestPost(BaseModel):
    model_config = ConfigDict(extra="forbid")
    idempotency_key: str = Field(min_length=3, max_length=200)
    source_type: SourceType
    source_group_id: str | None = Field(default=None, max_length=100)
    source_group_name: str | None = Field(default=None, max_length=300)
    permalink: AnyUrl | None = Field(default=None)
    external_post_id: str | None = Field(default=None, max_length=100)
    posted_at: datetime | None = None
    posted_at_raw: str | None = Field(default=None, max_length=100)
    text: str = Field(min_length=1, max_length=20000)
    text_complete: bool
    phone_masked: Literal[True]


class IngestClient(BaseModel):
    model_config = ConfigDict(extra="forbid")
    extension_version: str = Field(max_length=30)
    session_id: str = Field(max_length=100)


class IngestBatch(BaseModel):
    """Envelope of POST /ingest/batch. Each post is validated on its own so one bad post is
    reported as `rejected` instead of failing the batch."""
    model_config = ConfigDict(extra="forbid")
    client: IngestClient
    posts: list[dict[str, Any]] = Field(min_length=1, max_length=20)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=200)


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str = Field(min_length=3, max_length=30, pattern=r"^[A-Za-z0-9_]+$")
    email: str | None = Field(default=None, max_length=254)
    password: str = Field(min_length=8, max_length=200, repr=False)
    confirm_password: str = Field(min_length=1, max_length=200, repr=False)
    accept_terms: bool = Field(strict=True)

    @field_validator("password")
    @classmethod
    def strong_password(cls, value: str) -> str:
        return validate_password(value)

    @field_validator("email")
    @classmethod
    def valid_email(cls, value: str | None) -> str | None:
        return normalize_email(value) if value is not None else None

    @field_validator("confirm_password")
    @classmethod
    def matching_password(cls, value: str, info: ValidationInfo) -> str:
        if "password" in info.data and value != info.data["password"]:
            raise ValueError("Mật khẩu nhập lại chưa khớp")
        return value

    @field_validator("accept_terms")
    @classmethod
    def consent_required(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Cần đồng ý điều khoản sử dụng")
        return value


class TokenCreate(BaseModel):
    name: str | None = Field(default=None, max_length=100)


class ReviewDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["approve", "reject", "split", "merge"]
    expected_version: int
    fields: dict[str, Any] | None = None
    reason: str | None = Field(default=None, max_length=500)
    merge_into_cluster: str | None = None


class LabRunRequest(BaseModel):
    text: str | None = Field(default=None, max_length=20000)
    post_id: str | None = None
