"""HTTP routes under /api/v1 (docs/03-system/03-api-contract.md).

Routers only validate input, call a service and return its DTO — no business rules here.
"""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query, Response, Request
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import current_user, demo_flag, optional_user, require_roles, settings_dep
from app.core import security
from app.core.config import Settings
from app.core.db import get_session
from app.core.errors import ApiError
from app.models import User
from app.schemas import IngestBatch, IngestPost, LabRunRequest, LoginRequest, RegisterRequest, ReviewDecision, TokenCreate
from app.schemas.public import Comparison, ErrorResponse, ListingDetail, ListingsResponse, StatsOverview
from app.schemas import workspace as dto
from app.schemas import my_posts as mine
from app.services import my_posts
from app.services import analyses, bot_reviews, evaluation, images, ingest, lab, listings, market, reviews, team, users

router = APIRouter(prefix="/api/v1")


# --- health & auth ------------------------------------------------------------------

@router.get("/health", tags=["ops"])
def health(session: Session = Depends(get_session), settings: Settings = Depends(settings_dep)):
    try:
        session.execute(text("SELECT 1"))
    except Exception:
        raise ApiError(503, message="DB không truy cập được") from None
    return {"status": "ok", "demo_mode": settings.demo_mode}


@router.post("/auth/login", tags=["auth"], response_model=dto.SessionUser)
def login(body: LoginRequest, request: Request, response: Response, session: Session = Depends(get_session),
          settings: Settings = Depends(settings_dep)):
    authentication_limit(request, "password", body.username)
    user = users.authenticate(session, body.username, body.password)
    if user is None:
        raise ApiError(401, message="Sai tên đăng nhập hoặc mật khẩu")
    response.set_cookie(settings.session_cookie_name,
                        security.sign_session(user.id, settings.secret_key, settings.session_max_age_seconds, user.auth_version),
                        max_age=settings.session_max_age_seconds, httponly=True, samesite="lax",
                        secure=settings.cookie_secure)
    return users.me(user)


def authentication_limit(request: Request, provider: str, username: str | None = None) -> None:
    # shortcut: process-local limits suit one API process; use shared storage before scaling out.
    limiter = request.app.state.auth_limit
    message = "Bạn đã thử đăng nhập nhiều lần. Hãy thử lại sau ít phút."
    ip = request.client.host if request.client else "unknown"
    limiter.check(f"{provider}:ip:{ip}", 30, 300, message)
    if username is not None:
        limiter.check(f"{provider}:user:{username.strip().casefold()}", 5, 300, message)


@router.post("/auth/logout", tags=["auth"], response_model=dto.LoggedOut)
def logout(response: Response, settings: Settings = Depends(settings_dep)):
    response.delete_cookie(settings.session_cookie_name)
    return {"logged_out": True}


def registration_limit(request: Request, settings: Settings = Depends(settings_dep)):
    # Use the transport peer only; arbitrary forwarding headers are not an identity.
    request.app.state.registration_limit.check(request.client.host if request.client else "unknown",
                                               settings.register_rate_limit, settings.register_window_seconds)


@router.post("/auth/register", status_code=201, tags=["auth"], response_model=dto.SessionUser,
             dependencies=[Depends(registration_limit)],
             responses={409: {"model": ErrorResponse}, 422: {"model": ErrorResponse}, 429: {"model": ErrorResponse}})
def register(body: RegisterRequest, response: Response, session: Session = Depends(get_session),
             settings: Settings = Depends(settings_dep)):
    user = users.register(session, body.username, body.password, body.email)
    response.set_cookie(settings.session_cookie_name,
                        security.sign_session(user.id, settings.secret_key, settings.session_max_age_seconds, user.auth_version),
                        max_age=settings.session_max_age_seconds, httponly=True, samesite="lax",
                        secure=settings.cookie_secure)
    return users.me(user)


@router.get("/auth/me", tags=["auth"], response_model=dto.SessionUser)
def who_am_i(user: User = Depends(current_user)):
    return users.me(user)


# --- extension -> API ----------------------------------------------------------------

@router.get("/me/posts/summary", tags=["account"], response_model=mine.MyPostsSummary,
            responses={401: {"model": ErrorResponse}})
def my_posts_summary(response: Response, user: User = Depends(current_user), session: Session = Depends(get_session),
                     settings: Settings = Depends(settings_dep)):
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Vary"] = "Cookie, Authorization"
    return my_posts.summary(session, user, settings)


@router.get("/me/posts/filters", tags=["account"], response_model=mine.MyPostsFilters,
            responses={401: {"model": ErrorResponse}})
def my_posts_filters(response: Response, user: User = Depends(current_user), session: Session = Depends(get_session)):
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Vary"] = "Cookie, Authorization"
    return my_posts.filter_options(session, user)


@router.get("/me/posts", tags=["account"], response_model=mine.MyPosts,
            responses={401: {"model": ErrorResponse}, 422: {"model": ErrorResponse}})
def my_submitted_posts(response: Response, group: mine.StatusGroup = "all", page: int = Query(1, ge=1),
                       limit: int = Query(20, ge=1, le=50),
                       area: list[str] = Query(default=[], max_length=40, description="Old-district keys, e.g. quan-1."),
                       ward: list[str] = Query(default=[], max_length=40, description="New ward codes."),
                       type: list[mine.PropertyType] = Query(default=[], max_length=5),
                       price_min: int | None = Query(None, ge=0, le=10_000_000_000),
                       price_max: int | None = Query(None, ge=0, le=10_000_000_000),
                       area_min: float | None = Query(None, ge=0, le=100_000),
                       area_max: float | None = Query(None, ge=0, le=100_000),
                       rental_only: bool = True, sort: mine.SortKey = "newest",
                       user: User = Depends(current_user),
                       session: Session = Depends(get_session), settings: Settings = Depends(settings_dep)):
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Vary"] = "Cookie, Authorization"
    filters = my_posts.Filters(areas=tuple(dict.fromkeys(area)), wards=tuple(dict.fromkeys(ward)),
                               types=tuple(dict.fromkeys(type)), price_min=price_min, price_max=price_max,
                               area_min=area_min, area_max=area_max, rental_only=rental_only, sort=sort)
    my_posts.validate(filters)
    return my_posts.search(session, user, settings, group=group, page=page, limit=limit, filters=filters)


@router.post("/ingest/batch", tags=["extension"])
def ingest_batch(body: IngestBatch, user: User = Depends(current_user),
                 session: Session = Depends(get_session), settings: Settings = Depends(settings_dep)):
    return ingest.ingest_batch(session, user, body.posts, settings)


@router.put("/ingest/images", tags=["extension"])
async def ingest_image(request: Request, idempotency_key: str = Query(min_length=1, max_length=200),
                       user: User = Depends(current_user), session: Session = Depends(get_session),
                       settings: Settings = Depends(settings_dep)):
    """One room photo for a post already sent by this account; the body is the raw image file."""
    length = request.headers.get("content-length")
    if length and length.isdigit() and int(length) > settings.post_image_max_bytes:
        raise ApiError(413, code="image_too_large", message="Ảnh lớn hơn giới hạn cho phép.")
    data = await request.body()
    # Upload is blocking network I/O; keep it off the event loop.
    return await run_in_threadpool(images.add, session, user, idempotency_key, data, settings)


@router.get("/images/recent", tags=["public"])
def recent_images(limit: int = Query(12, ge=1, le=24), session: Session = Depends(get_session)):
    """Newest room photos from contributed, non-demo posts (one per post)."""
    return images.recent(session, limit)


@router.post("/analyses", status_code=202, tags=["extension"], response_model=dto.AnalysisCreated)
def create_analysis(body: IngestPost, user: User = Depends(current_user), session: Session = Depends(get_session),
                    settings: Settings = Depends(settings_dep)):
    return analyses.create(session, user, body, settings)


@router.get("/analyses/{analysis_id}", tags=["extension"], response_model=dto.AnalysisResult, response_model_exclude_unset=True)
def get_analysis(analysis_id: str, user: User = Depends(current_user), session: Session = Depends(get_session)):
    return analyses.get(session, user, analysis_id)


@router.post("/analyses/{analysis_id}/contribute", tags=["extension"], response_model=dto.Contributed)
def contribute(analysis_id: str, user: User = Depends(current_user), session: Session = Depends(get_session)):
    return analyses.contribute(session, user, analysis_id)


# --- renter ------------------------------------------------------------------------

@router.get("/listings", tags=["renter"], response_model=ListingsResponse, response_model_exclude_unset=True,
            responses={422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}})
def list_listings(ward: list[str] = Query(default=[]), type: list[str] = Query(default=[]),
                  price_min: int | None = None, price_max: int | None = None,
                  area_min: float | None = None, area_max: float | None = None, has_price: bool | None = None,
                  sort: Literal["price_asc", "price_desc", "newest"] = "newest",
                  page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                  area: list[str] = Query(default=[], max_length=40, description="Old-district keys, e.g. thu-duc."),
                  pool: Literal["all", "accepted"] = Query("accepted", description="all: shared store incl. auto-checked listings"),
                  demo: bool = Depends(demo_flag), session: Session = Depends(get_session),
                  settings: Settings = Depends(settings_dep)):
    areas = tuple(dict.fromkeys(area))
    my_posts.validate(my_posts.Filters(areas=areas))
    return listings.search(session, settings, wards=ward, types=type, price_min=price_min, price_max=price_max,
                           area_min=area_min, area_max=area_max, has_price=has_price, sort=sort, page=page,
                           page_size=page_size, demo=demo, pool=pool, areas=list(areas))


@router.get("/listings/{listing_id}", tags=["renter"], response_model=ListingDetail, response_model_exclude_unset=True,
            responses={404: {"model": ErrorResponse}, 503: {"model": ErrorResponse}})
def get_listing(listing_id: str, demo: bool = Depends(demo_flag), session: Session = Depends(get_session)):
    return listings.detail(session, listings.get_visible(session, listing_id, demo=demo))


@router.get("/listings/{listing_id}/comparison", tags=["renter"], response_model=Comparison,
            responses={404: {"model": ErrorResponse}, 503: {"model": ErrorResponse}})
def get_comparison(listing_id: str, user: User | None = Depends(optional_user), demo: bool = Depends(demo_flag),
                   session: Session = Depends(get_session), settings: Settings = Depends(settings_dep)):
    listing = listings.get_for_comparison(session, listing_id, user=user, demo=demo)
    return market.comparison(session, listing, settings)


@router.get("/market/summary", tags=["renter"], response_model=dto.MarketSummaryDTO)
def market_summary(ward: list[str] = Query(default=[]), type: list[str] = Query(default=[]),
                   basis: Literal["per_unit", "per_person"] = "per_unit",
                   group_by: Literal["ward", "old_district"] = "ward",
                   area: list[str] = Query(default=[], max_length=40, description="Old-district keys (group_by=old_district)."),
                   pool: Literal["accepted", "auto_checked"] | None = Query(
                       None, description="old_district only: auto_checked (default) or accepted"),
                   demo: bool = Depends(demo_flag),
                   session: Session = Depends(get_session), settings: Settings = Depends(settings_dep)):
    areas = tuple(dict.fromkeys(area))
    my_posts.validate(my_posts.Filters(areas=areas))
    if group_by == "ward" and pool == "auto_checked":
        raise ApiError(422, message="Bộ lọc không hợp lệ",
                       field_errors={"pool": "Nguồn tin chưa duyệt chỉ dùng khi xem theo quận cũ"})
    return market.summary(session, settings, wards=ward, types=type, basis=basis, demo=demo, group_by=group_by,
                          areas=list(areas), pool_name=pool)


@router.get("/stats/overview", tags=["renter"], response_model=StatsOverview,
            responses={503: {"model": ErrorResponse}})
def stats_overview(demo: bool = Depends(demo_flag), session: Session = Depends(get_session),
                   settings: Settings = Depends(settings_dep)):
    return market.overview(session, settings, demo=demo)


# --- team --------------------------------------------------------------------------

@router.get("/team/posts", tags=["team"], response_model=dto.TeamPosts)
def team_posts(status: str | None = None, group: str | None = None, collector: str | None = None,
               date_from: str | None = None, date_to: str | None = None, post_type: str | None = None,
               page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
               user: User = Depends(require_roles("collector", "reviewer")), session: Session = Depends(get_session)):
    return team.list_posts(session, status=status, group=group, collector=collector, date_from=date_from,
                           date_to=date_to, post_type=post_type, page=page, page_size=page_size)


@router.post("/team/posts/{post_id}/reprocess", tags=["team"], response_model=dto.Reprocessed)
def reprocess(post_id: str, user: User = Depends(require_roles("reviewer")), session: Session = Depends(get_session)):
    return team.reprocess(session, user, post_id)


@router.get("/team/export", tags=["team"])
def export(format: Literal["csv", "json"] = "csv", include_demo: bool = False,
           user: User = Depends(require_roles("researcher")), session: Session = Depends(get_session)):
    content, media = team.export(session, fmt=format, include_demo=include_demo)
    return Response(content, media_type=media,
                    headers={"Content-Disposition": f'attachment; filename="rener-listings.{format}"'})


@router.get("/team/bot-reviews/summary", tags=["team"])
def bot_review_summary(user: User = Depends(require_roles("reviewer")), session: Session = Depends(get_session),
                       settings: Settings = Depends(settings_dep)):
    return bot_reviews.summary(session, settings, include_auto_approve="admin" in user.roles)


@router.get("/team/bot-reviews", tags=["team"])
def bot_review_page(page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
                    user: User = Depends(require_roles("admin")), session: Session = Depends(get_session)):
    return bot_reviews.page(session, page=page, page_size=page_size)


@router.get("/team/reviews", tags=["team"], response_model=dto.ReviewQueue)
def review_queue(reason: str | None = None, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
                 status: Literal["needs_review", "bot_approved"] = "needs_review",
                 user: User = Depends(require_roles("reviewer")), session: Session = Depends(get_session)):
    return reviews.queue(session, reason=reason, page=page, page_size=page_size, status=status)


@router.get("/team/reviews/{listing_id}", tags=["team"], response_model=dto.ReviewDetail, response_model_exclude_unset=True)
def review_detail(listing_id: str, user: User = Depends(require_roles("reviewer")),
                  session: Session = Depends(get_session), settings: Settings = Depends(settings_dep)):
    return reviews.detail(session, listing_id, settings)


@router.post("/team/reviews/{listing_id}/decision", tags=["team"], response_model=dto.ReviewSaved)
def review_decision(listing_id: str, body: ReviewDecision, user: User = Depends(require_roles("reviewer")),
                    session: Session = Depends(get_session), settings: Settings = Depends(settings_dep)):
    return reviews.decide(session, user, listing_id, body, settings)


@router.post("/team/extension-tokens", status_code=201, tags=["team"], response_model=dto.ExtensionTokenCreated)
def create_token(body: TokenCreate, user: User = Depends(current_user), session: Session = Depends(get_session),
                 settings: Settings = Depends(settings_dep)):
    return users.create_token(session, user, body.name, settings)


@router.get("/team/extension-tokens", tags=["team"], response_model=dto.ExtensionTokens)
def list_tokens(user: User = Depends(current_user), session: Session = Depends(get_session)):
    return {"items": users.list_tokens(session, user)}


@router.delete("/team/extension-tokens/{token_id}", status_code=204, tags=["team"])
def revoke_token(token_id: str, user: User = Depends(current_user), session: Session = Depends(get_session)):
    users.revoke_token(session, user, token_id)
    return Response(status_code=204)


# --- research ------------------------------------------------------------------------

@router.post("/lab/run", tags=["research"], response_model=dto.LabResultDTO, response_model_exclude_unset=True)
def lab_run(body: LabRunRequest, user: User = Depends(require_roles("researcher")),
            session: Session = Depends(get_session), settings: Settings = Depends(settings_dep)):
    return lab.run(session, settings, text=body.text, post_id=body.post_id)


@router.get("/lab/gold/{post_id}", tags=["research"], response_model=dto.GoldResult)
def lab_gold(post_id: str, user: User = Depends(require_roles("researcher")), session: Session = Depends(get_session)):
    return lab.gold_for(session, post_id)


@router.get("/eval/runs", tags=["research"], response_model=dto.EvalRuns)
def eval_runs(user: User = Depends(require_roles("researcher")), settings: Settings = Depends(settings_dep)):
    return evaluation.list_runs(settings)


@router.get("/eval/runs/{run_id}", tags=["research"], response_model=dto.EvalResult)
def eval_run(run_id: str, user: User = Depends(require_roles("researcher")),
             settings: Settings = Depends(settings_dep)):
    return evaluation.get_run(settings, run_id)
