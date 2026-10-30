"""Password recovery endpoints, isolated from the main product router."""
from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.api.deps import settings_dep
from app.core.config import Settings
from app.core.db import get_session
from app.core.errors import ApiError
from app.core.registration_limit import RegistrationLimit
from app.schemas.auth_password import ForgotRequest, ResetRequest
from app.services import auth_password

router = APIRouter(prefix="/api/v1/auth/password", tags=["auth"])
GENERIC = {"message": "Nếu email này có tài khoản TrọCheck, yêu cầu đặt lại mật khẩu sẽ được xử lý."}


def check_limit(request: Request, kind: str) -> None:
    # Called by async routes without awaiting: creation is atomic on the event loop.
    if not hasattr(request.app.state, "password_reset_limit"):
        request.app.state.password_reset_limit = RegistrationLimit()
    peer = request.client.host if request.client else "unknown"
    request.app.state.password_reset_limit.check(kind + ":" + peer, 5 if kind == "forgot" else 20, 600)


@router.post("/forgot", status_code=202)
async def forgot(body: ForgotRequest, request: Request, response: Response,
                 session: Session = Depends(get_session), settings: Settings = Depends(settings_dep)):
    response.headers["Cache-Control"] = "no-store"
    try:
        check_limit(request, "forgot")
    except ApiError as exc:
        response.headers["Retry-After"] = exc.headers["Retry-After"]
        return GENERIC
    auth_password.forgot(session, body.email, settings)
    return GENERIC


@router.post("/reset")
async def reset(body: ResetRequest, request: Request, response: Response,
                session: Session = Depends(get_session), settings: Settings = Depends(settings_dep)):
    check_limit(request, "reset")
    auth_password.reset(session, body.token, body.password)
    response.delete_cookie(settings.session_cookie_name)
    response.headers["Cache-Control"] = "no-store"
    return {"message": "Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới."}
