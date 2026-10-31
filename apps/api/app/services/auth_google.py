"""Google authorization code + PKCE; only the API exchanges or sees access tokens."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from urllib.parse import urlencode, urlsplit

import httpx
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import security
from app.core.config import Settings
from app.core.errors import ApiError
from app.models import User

COOKIE = "rener_google_oauth"
COOKIE_PATH = "/api/auth/google"
MAX_AGE = 600
AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


def configured(settings: Settings) -> None:
    uri = urlsplit(settings.google_redirect_uri)
    local = uri.scheme == "http" and uri.hostname in ("localhost", "127.0.0.1")
    if (not settings.google_client_id or not settings.google_client_secret
            or settings.secret_key == "change-me" or not settings.secret_key
            or (uri.scheme != "https" and not local) or not uri.netloc
            or uri.username or uri.password or uri.query or uri.fragment
            or uri.path != "/api/auth/google/callback"):
        raise ApiError(503, code="google_not_configured",
                       message="Đăng nhập Google chưa được cấu hình. Hãy dùng tên tài khoản hoặc thử lại sau.")


def _signature(payload: str, settings: Settings) -> str:
    return hmac.new(settings.secret_key.encode(), ("google-oauth:" + payload).encode(), hashlib.sha256).hexdigest()


def start(settings: Settings, return_path: str) -> tuple[str, str]:
    configured(settings)
    state, verifier = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    payload = base64.urlsafe_b64encode(json.dumps({
        "state": state, "verifier": verifier, "next": return_path,
        "exp": int(time.time()) + MAX_AGE,
    }).encode()).decode()
    cookie = payload + "." + _signature(payload, settings)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    url = AUTHORIZE_URL + "?" + urlencode({
        "client_id": settings.google_client_id, "redirect_uri": settings.google_redirect_uri,
        "response_type": "code", "scope": "openid email", "state": state,
        "code_challenge": challenge, "code_challenge_method": "S256", "prompt": "select_account",
    })
    return url, cookie


def read_transaction(cookie: str, state: str, settings: Settings) -> dict:
    try:
        if len(cookie) > 4096:
            raise ValueError()
        payload, signature = cookie.split(".")
        if not hmac.compare_digest(signature, _signature(payload, settings)):
            raise ValueError()
        data = json.loads(base64.b64decode(payload, altchars=b"-_", validate=True))
        if (not isinstance(data, dict) or not isinstance(data.get("exp"), int)
                or data["exp"] <= time.time()
                or not isinstance(data.get("state"), str)
                or not hmac.compare_digest(data["state"], state)
                or not isinstance(data.get("verifier"), str)
                or not isinstance(data.get("next"), str)):
            raise ValueError()
        return data
    except (ValueError, TypeError, UnicodeError):
        raise ApiError(400, code="google_state_invalid",
                       message="Yêu cầu đăng nhập đã hết hạn hoặc không hợp lệ. Hãy thử lại.") from None


async def identity(code: str, verifier: str, settings: Settings) -> tuple[str, str]:
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=False) as client:
            token_response = await client.post(TOKEN_URL, data={
                "client_id": settings.google_client_id, "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri, "grant_type": "authorization_code",
                "code": code, "code_verifier": verifier,
            })
            if token_response.status_code in (400, 401):
                raise ApiError(401, code="google_denied", message="Không xác minh được đăng nhập Google. Hãy thử lại.")
            token_response.raise_for_status()
            token = token_response.json()
            access = token.get("access_token") if isinstance(token, dict) else None
            if (not isinstance(access, str) or not access or len(access) > 8192
                    or str(token.get("token_type", "")).lower() != "bearer"):
                raise ValueError()
            # Read identity from Google's authenticated endpoint; never trust an unverified JWT or browser email.
            profile_response = await client.get(USERINFO_URL, headers={"Authorization": "Bearer " + access})
            profile_response.raise_for_status()
            profile = profile_response.json()
            if (not isinstance(profile, dict) or profile.get("email_verified") is not True
                    or not isinstance(profile.get("sub"), str) or not 1 <= len(profile["sub"]) <= 255
                    or not isinstance(profile.get("email"), str)):
                raise ApiError(401, code="google_denied", message="Google chưa xác minh email của tài khoản này.")
            return profile["sub"], security.normalize_email(profile["email"])
    except (httpx.HTTPError, ValueError, TypeError):
        raise ApiError(503, code="google_unavailable",
                       message="Chưa kết nối được Google. Hãy thử lại sau.") from None


def resolve_user(session: Session, subject: str, email: str) -> User:
    existing = session.scalar(select(User).where(User.google_subject == subject))
    if existing is not None:
        return existing
    # Local emails are not verified. Never merge identities merely because their emails match.
    if session.scalar(select(User).where(User.email == email)) is not None:
        raise ApiError(409, code="google_account_conflict",
                       message="Email này đã có tài khoản TrọCheck. Hãy đăng nhập bằng tên tài khoản và mật khẩu đã tạo.")
    user = User(username="google_" + secrets.token_hex(10), email=email,
                google_subject=subject, password_hash="", roles=["renter"])
    session.add(user)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        existing = session.scalar(select(User).where(User.google_subject == subject))
        if existing is not None:
            return existing
        raise ApiError(409, code="google_account_conflict",
                       message="Tài khoản đã thay đổi trong lúc đăng nhập. Hãy thử lại hoặc dùng tên tài khoản.") from None
    return user
