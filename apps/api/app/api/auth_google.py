"""OAuth endpoints consumed by the same-origin Next.js backend for frontend."""
from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.orm import Session

from app.api.deps import settings_dep
from app.api.routes import registration_limit
from app.core import security
from app.core.config import Settings
from app.core.db import get_session
from app.schemas.auth_google import GoogleCallback, GoogleComplete, GoogleStart
from app.services import auth_google

router = APIRouter(prefix="/api/v1/auth/google", tags=["auth"])


@router.get("/start", response_model=GoogleStart, dependencies=[Depends(registration_limit)])
def start(response: Response, next: str = Query(default="/phan-tich", max_length=1000),
          settings: Settings = Depends(settings_dep)):
    url, cookie = auth_google.start(settings, next)
    response.set_cookie(auth_google.COOKIE, cookie, max_age=auth_google.MAX_AGE,
                        httponly=True, secure=settings.cookie_secure, samesite="lax", path=auth_google.COOKIE_PATH)
    response.headers["Cache-Control"] = "no-store"
    return {"authorization_url": url}


@router.post("/callback", response_model=GoogleComplete, dependencies=[Depends(registration_limit)])
async def callback(body: GoogleCallback, request: Request, response: Response,
                   session: Session = Depends(get_session), settings: Settings = Depends(settings_dep)):
    auth_google.configured(settings)
    transaction = auth_google.read_transaction(request.cookies.get(auth_google.COOKIE, ""), body.state, settings)
    subject, email = await auth_google.identity(body.code, transaction["verifier"], settings)
    user = auth_google.resolve_user(session, subject, email)
    response.set_cookie(settings.session_cookie_name,
                        security.sign_session(user.id, settings.secret_key, settings.session_max_age_seconds, user.auth_version),
                        max_age=settings.session_max_age_seconds, httponly=True,
                        samesite="lax", secure=settings.cookie_secure)
    response.delete_cookie(auth_google.COOKIE, path=auth_google.COOKIE_PATH)
    response.headers["Cache-Control"] = "no-store"
    return {"next": transaction["next"]}
