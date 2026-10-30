"""Accounts, roles, sessions and extension tokens (api-contract §1)."""
from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import security
from app.core.config import Settings
from app.core.errors import ApiError, not_found
from app.core.ids import iso, utcnow
from app.models import ExtensionToken, User

ROLES = ("renter", "collector", "reviewer", "researcher", "admin")


def register(session: Session, username: str, password: str, email: str | None = None) -> User:
    def taken():
        return ApiError(409, code="username_taken", message="Tên tài khoản đã được sử dụng",
                        field_errors={"username": "Hãy chọn tên tài khoản khác"})
    if session.scalar(select(User).where(User.username == username)) is not None:
        raise taken()
    def email_taken():
        return ApiError(409, code="email_taken", message="Email này đã có tài khoản. Bạn có thể đăng nhập.",
                        field_errors={"email": "Email này đã có tài khoản"})
    if email is not None:
        email = security.normalize_email(email)
        if session.scalar(select(User).where(User.email == email)) is not None:
            raise email_taken()
    user = User(username=username, email=email, password_hash=security.hash_password(password), roles=["renter"])
    session.add(user)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        # The unique constraint also protects concurrent registrations of the same name.
        if session.scalar(select(User).where(User.username == username)) is not None:
            raise taken() from None
        if email is not None and session.scalar(select(User).where(User.email == email)) is not None:
            raise email_taken() from None
        raise
    return user


def create_user(session: Session, username: str, password: str, roles: list[str]) -> User:
    bad = [r for r in roles if r not in ROLES]
    if bad:
        raise ValueError(f"unknown roles: {bad}")
    user = session.scalar(select(User).where(User.username == username))
    if user is None:
        user = User(username=username, password_hash=security.hash_password(password), roles=list(roles))
        session.add(user)
    else:
        user.password_hash = security.hash_password(password)
        user.roles = list(roles)
    session.flush()
    return user


def authenticate(session: Session, username: str, password: str) -> User | None:
    user = session.scalar(select(User).where(User.username == username))
    if user is None or not security.verify_password(password, user.password_hash):
        return None
    return user


def has_role(user: User, *roles: str) -> bool:
    return "admin" in user.roles or any(r in user.roles for r in roles)


def user_from_token(session: Session, token: str) -> User | None:
    row = session.scalar(select(ExtensionToken).where(ExtensionToken.token_hash == security.token_hash(token)))
    now = utcnow()
    if row is None or row.revoked_at is not None or row.expires_at < now:
        return None
    row.last_used_at = now
    session.commit()
    return session.get(User, row.user_id)


def me(user: User) -> dict:
    return {"user_id": user.id, "username": user.username, "roles": user.roles}


def create_token(session: Session, user: User, name: str | None, settings: Settings) -> dict:
    token = security.new_token()
    row = ExtensionToken(user_id=user.id, name=name, token_hash=security.token_hash(token),
                         expires_at=utcnow() + timedelta(days=settings.extension_token_days))
    session.add(row)
    session.commit()
    # The plain token is shown once; only its hash is stored.
    return {**_token_dict(row), "token": token}


def list_tokens(session: Session, user: User) -> list[dict]:
    rows = session.scalars(select(ExtensionToken).where(ExtensionToken.user_id == user.id)
                           .order_by(ExtensionToken.created_at.desc()))
    return [_token_dict(r) for r in rows]


def revoke_token(session: Session, user: User, token_id: str) -> None:
    row = session.get(ExtensionToken, token_id)
    if row is None or (row.user_id != user.id and not has_role(user, "admin")):
        raise not_found()
    if row.revoked_at is None:
        row.revoked_at = utcnow()
    session.commit()


def _token_dict(row: ExtensionToken) -> dict:
    return {"id": row.id, "name": row.name, "created_at": iso(row.created_at), "expires_at": iso(row.expires_at),
            "revoked_at": iso(row.revoked_at), "last_used_at": iso(row.last_used_at)}


def require(user: User, *roles: str) -> None:
    if not has_role(user, *roles):
        raise ApiError(403, message="Tài khoản không có quyền thực hiện thao tác này")
