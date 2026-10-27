"""HTTP routes under /api/v1 (docs/03-system/03-api-contract.md).

Routers only validate input, call a service and return its DTO — no business rules here.
"""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import current_user, demo_flag, optional_user, require_roles, settings_dep
from app.core import security
from app.core.config import Settings
from app.core.db import get_session
from app.core.errors import ApiError
from app.models import User
from app.schemas import IngestBatch, IngestPost, LabRunRequest, LoginRequest, ReviewDecision, TokenCreate
from app.schemas.public import Comparison, ErrorResponse, ListingDetail, ListingsResponse, StatsOverview
from app.schemas import workspace as dto
from app.services import analyses, evaluation, ingest, lab, listings, market, reviews, team, users

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
def login(body: LoginRequest, response: Response, session: Session = Depends(get_session),
          settings: Settings = Depends(settings_dep)):
    user = users.authenticate(session, body.username, body.password)
    if user is None:
        raise ApiError(401, message="Sai tên đăng nhập hoặc mật khẩu")
    response.set_cookie(settings.session_cookie_name,
                        security.sign_session(user.id, settings.secret_key, settings.session_max_age_seconds),
                        max_age=settings.session_max_age_seconds, httponly=True, samesite="lax",
                        secure=settings.cookie_secure)
    return users.me(user)


@router.post("/auth/logout", tags=["auth"], response_model=dto.LoggedOut)
def logout(response: Response, settings: Settings = Depends(settings_dep)):
    response.delete_cookie(settings.session_cookie_name)
    return {"logged_out": True}


@router.get("/auth/me", tags=["auth"], response_model=dto.SessionUser)
def who_am_i(user: User = Depends(current_user)):
    return users.me(user)


# --- extension -> API ----------------------------------------------------------------

@router.post("/ingest/batch", tags=["extension"])
def ingest_batch(body: IngestBatch, user: User = Depends(require_roles("collector")),
                 session: Session = Depends(get_session), settings: Settings = Depends(settings_dep)):
    return ingest.ingest_batch(session, user, body.posts, settings)


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
                  demo: bool = Depends(demo_flag), session: Session = Depends(get_session),
                  settings: Settings = Depends(settings_dep)):
    return listings.search(session, settings, wards=ward, types=type, price_min=price_min, price_max=price_max,
                           area_min=area_min, area_max=area_max, has_price=has_price, sort=sort, page=page,
                           page_size=page_size, demo=demo)


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
                   basis: Literal["per_unit", "per_person"] = "per_unit", demo: bool = Depends(demo_flag),
                   session: Session = Depends(get_session), settings: Settings = Depends(settings_dep)):
    return market.summary(session, settings, wards=ward, types=type, basis=basis, demo=demo)


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


@router.get("/team/reviews", tags=["team"], response_model=dto.ReviewQueue)
def review_queue(reason: str | None = None, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
                 user: User = Depends(require_roles("reviewer")), session: Session = Depends(get_session)):
    return reviews.queue(session, reason=reason, page=page, page_size=page_size)


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
