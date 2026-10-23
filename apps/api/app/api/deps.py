"""Request dependencies: DB session, settings, current user (cookie for web, Bearer for extension)."""
from __future__ import annotations

from collections.abc import Callable

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core import security
from app.core.config import Settings, get_settings
from app.core.db import get_session
from app.core.errors import ApiError
from app.models import User
from app.services import users


def settings_dep() -> Settings:
    return get_settings()


def optional_user(request: Request, session: Session = Depends(get_session),
                  settings: Settings = Depends(settings_dep)) -> User | None:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        user = users.user_from_token(session, auth.split(" ", 1)[1].strip())
        if user is None:
            raise ApiError(401, message="Token hết hạn hoặc đã bị thu hồi, kết nối lại tài khoản")
        return user
    cookie = request.cookies.get(settings.session_cookie_name)
    if cookie:
        user_id = security.read_session(cookie, settings.secret_key)
        if user_id:
            user = session.get(User, user_id)
            if user is not None and security.read_session(cookie, settings.secret_key, user.auth_version):
                return user
    return None


def current_user(user: User | None = Depends(optional_user)) -> User:
    if user is None:
        raise ApiError(401, message="Cần đăng nhập")
    return user


def require_roles(*roles: str) -> Callable[..., User]:
    def dep(user: User = Depends(current_user)) -> User:
        users.require(user, *roles)
        return user
    return dep


def demo_flag(demo: bool | None = None, settings: Settings = Depends(settings_dep)) -> bool:
    """Demo data is visible only when the server runs in demo mode; `?demo=false` hides it again."""
    if not settings.demo_mode:
        return False
    return True if demo is None else demo
