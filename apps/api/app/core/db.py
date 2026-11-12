"""Engine and sessions. SQLite in WAL mode for local use (ADR-0001), PostgreSQL (Neon) in
production (ADR-0007); everything goes through the ORM so the engine changes the URL, not the code."""
from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.engine import URL, Engine, make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


def normalize_url(url: str) -> str:
    """Hosts hand out postgres:// or postgresql://; SQLAlchemy needs the psycopg 3 driver spelled out."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url.removeprefix(prefix)
    return url


def redact_url(url: str | URL) -> str:
    """The URL with the password replaced by ***, safe to print in a host log."""
    return make_url(normalize_url(url) if isinstance(url, str) else url).render_as_string(hide_password=True)


def make_engine(url: str) -> Engine:
    url = normalize_url(url)
    if url.startswith("sqlite:///") and ":memory:" not in url:
        Path(url.removeprefix("sqlite:///")).parent.mkdir(parents=True, exist_ok=True)
    if url.startswith("postgresql"):
        # Neon closes idle connections and may sit behind a pooler: ping before use, recycle early,
        # and avoid server-side prepared statements (they break behind transaction poolers).
        return create_engine(url, pool_pre_ping=True, pool_recycle=300, pool_size=5, max_overflow=5,
                             connect_args={"connect_timeout": 15, "prepare_threshold": None})
    engine = create_engine(url, connect_args={"check_same_thread": False, "timeout": 30}
                           if url.startswith("sqlite") else {})
    if url.startswith("sqlite"):
        @event.listens_for(engine, "connect")
        def _pragmas(dbapi_conn, _record):
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA journal_mode=WAL")
            cur.execute("PRAGMA foreign_keys=ON")
            cur.execute("PRAGMA busy_timeout=30000")
            cur.close()
    return engine


_engine: Engine | None = None
_factory: sessionmaker | None = None


def configure(url: str | None = None) -> Engine:
    global _engine, _factory
    _engine = make_engine(url or get_settings().database_url)
    _factory = sessionmaker(bind=_engine, expire_on_commit=False)
    return _engine


def engine() -> Engine:
    if _engine is None:
        configure()
    return _engine


def session_factory() -> sessionmaker:
    if _factory is None:
        configure()
    return _factory


@contextmanager
def session_scope() -> Iterator[Session]:
    """One transaction: commit on success, roll back on any error."""
    session = session_factory()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_session() -> Iterator[Session]:
    """FastAPI dependency: one session per request, committed by the service layer."""
    session = session_factory()()
    try:
        yield session
    finally:
        session.close()
