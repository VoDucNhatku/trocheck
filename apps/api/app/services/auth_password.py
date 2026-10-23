"""Single-use, expiring password reset tokens. Plain tokens only reach the dev log."""
import logging
import secrets
from datetime import timedelta
from urllib.parse import urlsplit

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.core import security
from app.core.config import Settings
from app.core.errors import ApiError
from app.core.ids import utcnow
from app.models import ExtensionToken, PasswordResetToken, User

log = logging.getLogger(__name__)


def forgot(session: Session, email: str, settings: Settings) -> None:
    # No mail provider exists yet. Never create undeliverable links or log by default.
    if not settings.password_reset_dev_log:
        return
    try:
        email = security.normalize_email(email)
    except ValueError:
        return
    user = session.scalar(select(User).where(User.email == email))
    if user is None:
        return
    base = settings.password_reset_base_url.rstrip("/")
    parsed = urlsplit(base)
    if parsed.scheme not in ("http", "https") or not parsed.netloc or parsed.query or parsed.fragment or parsed.username:
        return
    now = utcnow()
    session.execute(delete(PasswordResetToken).where(PasswordResetToken.expires_at <= now))
    session.execute(update(PasswordResetToken).where(PasswordResetToken.user_id == user.id,
                    PasswordResetToken.used_at.is_(None)).values(used_at=now))
    token = secrets.token_urlsafe(32)
    session.add(PasswordResetToken(user_id=user.id, token_hash=security.token_hash(token),
                                   expires_at=now + timedelta(minutes=30)))
    session.commit()
    # Fragment keeps the token out of web server access logs and Referer headers.
    log.warning("DEV ONLY password reset link: %s", base + "/dat-lai-mat-khau#token=" + token)


def reset(session: Session, token: str, password: str) -> None:
    security.validate_password(password)
    now = utcnow()
    # Conditional UPDATE makes consumption atomic even when two requests race.
    user_id = session.execute(update(PasswordResetToken).where(
        PasswordResetToken.token_hash == security.token_hash(token), PasswordResetToken.used_at.is_(None),
        PasswordResetToken.expires_at > now).values(used_at=now).returning(PasswordResetToken.user_id)).scalar_one_or_none()
    if user_id is None:
        session.rollback()
        raise ApiError(400, code="reset_link_invalid", message="Link này đã hết hạn hoặc đã được dùng.")
    session.execute(update(User).where(User.id == user_id).values(
        password_hash=security.hash_password(password), auth_version=User.auth_version + 1))
    session.execute(update(PasswordResetToken).where(PasswordResetToken.user_id == user_id,
                    PasswordResetToken.used_at.is_(None)).values(used_at=now))
    session.execute(update(ExtensionToken).where(ExtensionToken.user_id == user_id,
                    ExtensionToken.revoked_at.is_(None)).values(revoked_at=now))
    session.commit()
