"""Cross-process wake-up, atomic provider limits, timing and owner-only progress."""
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from pathlib import Path
from threading import Barrier

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, select

from app.core.db import make_engine
from app.core.ids import utcnow
from app.models import Job, Listing, LlmDailyUsage, Post, ReviewEvent, User
from app.pipeline.llm_extractor import LlmBudgetExceeded
from app.services import jobs
from tests.conftest import test_database_url as database_url
from tests.test_my_posts import send

POSTGRES = pytest.mark.skipif(not (database_url() or "").startswith("postgres"), reason="PostgreSQL required")


@POSTGRES
def test_postgres_wakes_worker_in_another_process(api):
    script = '''
from app.core.config import get_settings
from app.services import jobs
import app.worker.run as worker
def process(session, job, **kwargs):
    jobs.mark_succeeded(job)
worker.process_job = process
original = worker.run_one
def run(*args):
    worked = original(*args)
    if worked:
        print("CLAIMED", flush=True)
        raise SystemExit(0)
    print("IDLE", flush=True)
    return False
worker.run_one = run
worker.run_loop(get_settings(), None, "cross-process-test")
'''
    child = subprocess.Popen([sys.executable, "-B", "-u", "-c", script], cwd=Path.cwd(),
        env={**os.environ, "DATABASE_URL": api.settings.database_url, "WORKER_POLL_SECONDS": "60"},
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        # Read readiness with a timeout, so a startup failure cannot hang the suite.
        with ThreadPoolExecutor(max_workers=1) as pool:
            ready = pool.submit(child.stdout.readline)
            try:
                assert ready.result(timeout=10).strip() == "IDLE"
            except Exception:
                child.kill()
                raise
        with api.session() as session:
            session.add(Job(kind="recompute_market"))
            session.commit()
        try:
            stdout, stderr = child.communicate(timeout=3)
        except subprocess.TimeoutExpired:
            child.kill()
            stdout, stderr = child.communicate()
            pytest.fail(f"worker did not wake across processes: {stdout!r} {stderr!r}")
        assert child.returncode == 0 and "CLAIMED" in stdout, (stdout, stderr)
    finally:
        if child.poll() is None:
            child.kill()
        child.communicate()


@POSTGRES
def test_postgres_notify_only_at_commit(api):
    from app.worker.wakeup import QueueWakeup
    listener = QueueWakeup(api.settings.database_url)
    listener.clear()
    try:
        with api.session() as session:
            session.add(Job(kind="recompute_market"))
            session.flush()
            assert not listener.wait(0.05)
            session.rollback()
            assert not listener.wait(0.05)
            session.add(Job(kind="recompute_market"))
            session.commit()
        assert listener.wait(1)
    finally:
        listener.close()


@POSTGRES
@pytest.mark.parametrize("global_limit,review_limit", [(3, 0), (0, 2), (3, 2)])
def test_postgres_budget_race(api, global_limit, review_limit):
    settings = api.settings.model_copy(update={"llm_daily_call_limit": global_limit,
        "review_bot_daily_call_limit": review_limit})
    barrier = Barrier(12)
    with api.session() as session:
        engine = session.get_bind()
    def reserve(i):
        review = bool(review_limit) and (not global_limit or i % 2 == 0)
        barrier.wait(timeout=10)
        try:
            jobs.reserve_llm_call(engine, settings, review=review)
            return review
        except LlmBudgetExceeded:
            return None
    with ThreadPoolExecutor(max_workers=12) as pool:
        result = list(pool.map(reserve, range(12)))
    with api.session() as session:
        usage = session.scalars(select(LlmDailyUsage)).one()
        assert usage.calls == sum(r is not None for r in result)
        assert usage.review_calls == sum(r is True for r in result)
        if global_limit:
            assert usage.calls == global_limit
        if review_limit:
            assert usage.review_calls <= review_limit
        if not global_limit:
            assert usage.review_calls == review_limit


def test_progress_is_private_and_uses_position_times_median(api):
    owner = api.client("renter")
    pid = send(owner)
    url = f"/api/v1/me/posts/{pid}/progress"
    assert owner.get(url).json()["queue_position"] == 1
    assert owner.get(url).json()["estimated_wait_seconds"] is None
    assert api.client().get(url).status_code == 401
    other = api.client("collector")
    assert other.get(url).status_code == 404
    assert other.get("/api/v1/me/posts").json()["items"] == []
    assert other.get("/api/v1/me/posts/summary").json()["active"] is False
    assert owner.get("/api/v1/me/posts/wrong-id/progress").status_code == 404
    now = utcnow()
    with api.session() as session:
        for seconds in (5, 10, 20, 40):
            session.add(Job(kind="extract", status="succeeded", started_at=now - timedelta(seconds=seconds), finished_at=now))
        session.commit()
    assert owner.get(url).json()["estimated_wait_seconds"] is None
    with api.session() as session:
        session.add(Job(kind="extract", status="failed", started_at=now - timedelta(seconds=30), finished_at=now))
        session.commit()
    assert owner.get(url).json()["estimated_wait_seconds"] == 20
    assert owner.get("/api/v1/me/posts/summary").json()["stage_counts"]["queued"] == 1
    with api.session() as session:
        claimed = jobs.claim(session, "timing-test", 60)
        assert claimed.started_at is not None and claimed.finished_at is None
        job_id = claimed.id
    assert owner.get(url).json()["stage"] == "reading"
    with api.session() as session:
        session.get(Job, job_id).stage = "asking_ai"
        session.commit()
    assert owner.get(url).json()["stage"] == "asking_ai"
    with api.session() as session:
        job = session.get(Job, job_id)
        jobs.mark_failed(session, job_id, code="TimeoutError", message="secret provider detail", max_attempts=1)
        session.commit()
    progress = owner.get(url).json()
    assert progress["stage"] == "failed" and progress["reason"] == "TimeoutError"
    assert progress["finished_at"] and "secret" not in str(progress)
    assert owner.get("/api/v1/me/posts/summary").json()["active"] is False


def test_migration_0010_upgrade_and_downgrade(database_url):
    config = Config(str(Path("alembic.ini").resolve()))
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    engine = make_engine(database_url)
    try:
        command.upgrade(config, "0009")
        command.upgrade(config, "head")
        assert {"started_at", "finished_at", "stage"} <= {c["name"] for c in inspect(engine).get_columns("jobs")}
        assert "llm_daily_usage" in inspect(engine).get_table_names()
        command.downgrade(config, "0009")
        assert "started_at" not in {c["name"] for c in inspect(engine).get_columns("jobs")}
        assert "llm_daily_usage" not in inspect(engine).get_table_names()
        command.upgrade(config, "head")
    finally:
        engine.dispose()


def test_concurrent_pool_has_only_one_idle_poller(monkeypatch):
    import app.worker.run as worker
    from app.core.config import Settings
    class StopLoop(Exception):
        pass
    polls, waits = [], []
    class Wakeup:
        def clear(self):
            pass
        def wait(self, delay):
            waits.append(delay)
            if len(waits) == 9:
                raise StopLoop()
            return False
    monkeypatch.setattr(jobs, "queue_changed", Wakeup())
    def empty(*args):
        polls.append(1)
        return False
    monkeypatch.setattr(worker, "run_one", empty)
    settings = Settings(database_url="sqlite://", worker_concurrency=2, worker_poll_seconds=1)
    with pytest.raises(StopLoop):
        worker.run_workers(settings, lambda _: None)
    assert waits == [1, 2, 4, 8, 16, 32, 60, 60, 60]
    assert len(polls) == len(waits)


def test_review_bot_stays_live_until_review_finishes_and_preserves_rejection(api):
    owner = api.client("renter")
    pid = send(owner)
    api.drain()
    with api.session() as session:
        listing = session.scalar(select(Listing).where(Listing.post_id == pid))
        listing.review_status = "needs_review"
        listing_id = listing.id
        jobs.enqueue(session, kind="bot_review", post_version_id=session.get(Post, pid).current_version_id)
        session.commit()
    url = f"/api/v1/me/posts/{pid}/progress"
    assert owner.get(url).json()["stage"] == "queued"
    assert owner.get("/api/v1/me/posts/summary").json()["active"] is True
    with api.session() as session:
        job = jobs.claim(session, "bot-test", 60)
        job.stage = "asking_ai"
        job_id = job.id
        session.commit()
    assert owner.get(url).json()["stage"] == "asking_ai"
    with api.session() as session:
        jobs.mark_succeeded(session.get(Job, job_id))
        session.commit()
    assert owner.get(url).json()["stage"] == "needs_review"
    assert owner.get("/api/v1/me/posts/summary").json()["active"] is False
    with api.session() as session:
        session.get(Listing, listing_id).review_status = "rejected"
        session.add(ReviewEvent(listing_id=listing_id, user_id=session.scalar(select(User.id).where(User.username == "admin")),
                                action="reject", reason="Bài đã hết phòng"))
        session.commit()
    assert owner.get(url).json()["reason"] == "Bài đã hết phòng"


def test_estimate_uses_only_the_last_fifty_finished_jobs(api):
    owner = api.client("renter")
    pid = send(owner)
    now = utcnow()
    with api.session() as session:
        for i in range(51):
            end = now - timedelta(seconds=i)
            session.add(Job(kind="extract", status="succeeded", finished_at=end,
                            started_at=end - timedelta(seconds=10 if i < 50 else 9999)))
        session.commit()
    assert owner.get(f"/api/v1/me/posts/{pid}/progress").json()["estimated_wait_seconds"] == 10


def test_each_retry_reserves_and_failed_transaction_cannot_refund_calls(api, monkeypatch):
    from app.pipeline.llm_extractor import LlmTransientError
    from tests.test_llm import FakeLLM
    owner = api.client("renter")
    pid = send(owner, text="Cho thuê phòng trọ 25m2 giá 3tr/tháng, cọc 1 tháng. LH [SĐT]")
    monkeypatch.setattr(api.settings, "llm_daily_call_limit", 2)
    fake = FakeLLM(LlmTransientError("http_429", 0), LlmTransientError("http_429", 0))
    assert api.drain(fake) == 1
    assert fake.calls == 2
    assert owner.get(f"/api/v1/me/posts/{pid}/progress").json()["reason"] == "llm_daily_limit"
    with api.session() as session:
        job = session.scalar(select(Job))
        assert job.status == "queued" and job.error_code == "llm_daily_limit"
        assert session.scalars(select(LlmDailyUsage)).one().calls == 2
        with pytest.raises(LlmBudgetExceeded):
            jobs.reserve_llm_call(session.get_bind(), api.settings)


def test_concurrency_uses_distinct_sessions_and_releases_connections_before_ai(api, monkeypatch):
    from threading import Lock, get_ident
    import app.worker.run as worker
    from app.core import db
    from app.pipeline.llm_extractor import LlmResponse
    owner = api.client("renter")
    for i in range(11):
        send(owner, str(i), text=f"Cho thuê phòng kiểm thử đồng thời {i} giá 3 triệu/tháng.")
    gate, lock = Barrier(10), Lock()
    sessions, threads, calls = [], set(), []
    class Stub:
        model_id = "speed-stub"
        def generate(self, prompt):
            with lock:
                calls.append(1)
                number = len(calls)
                threads.add(get_ident())
            if number > 1:
                gate.wait(timeout=15)
            return LlmResponse(text='{}')
    def process(session, job, *, llm, settings):
        with lock:
            sessions.append(session)
        llm.generate("test")
        assert not session.in_transaction()
        jobs.mark_succeeded(job)
    monkeypatch.setattr(worker, "process_job", process)
    settings = api.settings.model_copy(update={"worker_concurrency": 10, "llm_daily_call_limit": 11})
    assert worker.run_workers(settings, lambda _: Stub(), once=True) == 11
    assert len(calls) == 11 and len(threads) == 10
    assert len({id(session) for session in sessions}) == 11
    assert db.engine().pool.checkedout() == 0
