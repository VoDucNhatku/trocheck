"""Database URLs on every engine; migrations and simultaneous claims on PostgreSQL."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import event, inspect, select

from app.core.db import Base, make_engine, normalize_url, redact_url
from app.models import Job
from app.services import jobs
from tests.conftest import reset_postgres_schema, test_database_url as database_url


@pytest.mark.parametrize("prefix", ["postgres://", "postgresql://", "postgresql+psycopg://"])
def test_normalize_postgres_url(prefix):
    suffix = "user:encoded%25password@localhost/test?sslmode=require"
    assert normalize_url(prefix + suffix) == "postgresql+psycopg://" + suffix


def test_sqlite_url_and_pragmas_unchanged(tmp_path):
    url = f"sqlite:///{(tmp_path / 'nested' / 'test.sqlite').as_posix()}"
    assert normalize_url(url) == url
    engine = make_engine(url)
    try:
        with engine.connect() as connection:
            assert connection.exec_driver_sql("PRAGMA journal_mode").scalar() == "wal"
            assert connection.exec_driver_sql("PRAGMA foreign_keys").scalar() == 1
            assert connection.exec_driver_sql("PRAGMA busy_timeout").scalar() == 30000
    finally:
        engine.dispose()


def test_postgres_engine_options_and_redaction(monkeypatch):
    import app.core.db as db

    captured = {}
    def capture(url, **kwargs):
        captured.update(url=url, **kwargs)
    monkeypatch.setattr(db, "create_engine", capture)
    url = "postgres://test:encoded%25password@localhost/test?sslmode=require"
    make_engine(url)
    assert captured == {
        "url": normalize_url(url), "pool_pre_ping": True, "pool_recycle": 300,
        "pool_size": 5, "max_overflow": 5,
        "connect_args": {"connect_timeout": 15, "prepare_threshold": None},
    }
    assert redact_url(url) == "postgresql+psycopg://test:***@localhost/test?sslmode=require"


POSTGRES_ONLY = pytest.mark.skipif(
    not (database_url() or "").startswith(("postgres://", "postgresql://", "postgresql+psycopg://")),
    reason="Cần TEST_DATABASE_URL PostgreSQL để kiểm migration và tranh chấp giữa hai phiên",
)


@POSTGRES_ONLY
def test_postgres_migrations_match_models_and_downgrade():
    url = database_url()
    reset_postgres_schema(url)
    cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    engine = make_engine(url)
    try:
        command.upgrade(cfg, "head")
        assert "bot_reviews" in inspect(engine).get_table_names()
        assert any(index["name"] == "uq_bot_reviews_ok" and index["unique"]
                   for index in inspect(engine).get_indexes("bot_reviews"))
        with engine.connect() as connection:
            context = MigrationContext.configure(connection, opts={"compare_server_default": True})
            assert compare_metadata(context, Base.metadata) == []
        command.downgrade(cfg, "base")
        assert set(inspect(engine).get_table_names()) <= {"alembic_version"}
        command.upgrade(cfg, "head")
        with engine.connect() as connection:
            assert compare_metadata(MigrationContext.configure(connection), Base.metadata) == []
    finally:
        engine.dispose()


@POSTGRES_ONLY
def test_postgres_two_sessions_claim_one_due_job(api):
    with api.session() as session:
        job = Job(kind="recompute_market")
        session.add(job)
        session.commit()
        job_id = job.id

    # Both workers must select the same due candidate before either conditional UPDATE.
    barrier = Barrier(2)
    def claim(worker):
        with api.session() as session:
            synchronized = False
            def after_select(conn, cursor, statement, parameters, context, executemany):
                nonlocal synchronized
                if not synchronized and statement.lstrip().startswith("SELECT jobs.id"):
                    synchronized = True
                    barrier.wait(timeout=10)
            with session.bind.connect() as connection:
                event.listen(connection, "after_cursor_execute", after_select)
                session.bind = connection
                claimed = jobs.claim(session, worker, 60)
                return claimed.id if claimed else None

    with ThreadPoolExecutor(max_workers=2) as pool:
        claimed = list(pool.map(claim, ["worker-a", "worker-b"]))
    assert claimed.count(job_id) == 1
    assert claimed.count(None) == 1
    with api.session() as session:
        row = session.scalar(select(Job).where(Job.id == job_id))
        assert row.attempt == 1 and row.status == "running"
