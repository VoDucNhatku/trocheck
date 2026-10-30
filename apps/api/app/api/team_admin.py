"""Read-only team directory. Explicit response models exclude account credentials."""
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import demo_flag, require_roles
from app.core.db import get_session
from app.models import User
from app.services import team_admin

Role = Literal["renter", "collector", "reviewer", "researcher", "admin"]
router = APIRouter(prefix="/api/v1/team", tags=["team admin"])


class DirectoryUser(BaseModel):
    user_id: str
    username: str
    roles: list[Role]
    email: str | None
    email_redacted: bool
    created_at: str | None


class DirectoryUsers(BaseModel):
    items: list[DirectoryUser]
    total: int
    page: int
    page_size: int
    current_user_id: str


class RecordedSource(BaseModel):
    source_type: str
    source_group_id: str | None
    source_group_name: str | None
    is_demo: bool
    posts_count: int
    last_seen_at: str | None


class RecordedSources(BaseModel):
    items: list[RecordedSource]
    total: int
    page: int
    page_size: int
    configuration_available: Literal[False]


@router.get("/users", response_model=DirectoryUsers)
def users(response: Response, q: str = Query("", max_length=100), role: Role | None = None,
          page: int = Query(1, ge=1, le=100000), page_size: int = Query(20, ge=1, le=100),
          viewer: User = Depends(require_roles("admin", "researcher")),
          session: Session = Depends(get_session)):
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Vary"] = "Cookie, Authorization"
    return team_admin.list_users(session, viewer, q=q.strip(), role=role, page=page, page_size=page_size)


@router.get("/sources", response_model=RecordedSources)
def sources(response: Response, page: int = Query(1, ge=1, le=100000),
            page_size: int = Query(20, ge=1, le=100), include_demo: bool = Depends(demo_flag),
            viewer: User = Depends(require_roles("admin", "researcher")),
            session: Session = Depends(get_session)):
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Vary"] = "Cookie, Authorization"
    return team_admin.list_sources(session, include_demo=include_demo, page=page, page_size=page_size)
