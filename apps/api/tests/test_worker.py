"""Job queue: retries with backoff, final failure, lock expiry, no duplicate listings."""
from datetime import timedelta

from sqlalchemy import select

from app.core.ids import utcnow
from app.models import Job, Listing, Post
from app.services import jobs
from tests.conftest import batch, post_payload

TEXT = "Cho thuê phòng trọ 20m2 giá 3tr/tháng. LH [SĐT]"


def _ingest(api, key="job-1"):
    api.client("collector").post("/api/v1/ingest/batch", json=batch(post_payload(key, TEXT)))


def test_failure_is_retried_then_failed(api, monkeypatch):
    _ingest(api)
    import app.worker.run as worker

    def boom(*a, **k):
        raise RuntimeError("disk full")
    monkeypatch.setattr(worker, "process_job", boom)
    monkeypatch.setattr(api.settings, "job_max_attempts", 2)
    api.drain()
    with api.session() as s:
        job = s.scalars(select(Job)).one()
        assert job.status == "queued" and job.attempt == 1 and job.run_after > utcnow()
        job.run_after = utcnow() - timedelta(seconds=1)
        s.commit()
    api.drain()
    with api.session() as s:
        job = s.scalars(select(Job)).one()
        assert job.status == "failed" and job.error_code == "RuntimeError"
        assert s.scalars(select(Post)).one().status == "failed"


def test_expired_lock_is_taken_over(api):
    _ingest(api)
    with api.session() as s:
        claimed = jobs.claim(s, "dead-worker", lock_seconds=60)
        assert claimed is not None
        assert jobs.claim(s, "other", lock_seconds=60) is None  # still locked
        job = s.get(Job, claimed.id)
        job.locked_until = utcnow() - timedelta(seconds=1)
        s.commit()
    assert api.drain() == 1
    with api.session() as s:
        job = s.scalars(select(Job)).one()
        assert job.status == "succeeded" and job.attempt == 2
        assert len(s.scalars(select(Listing)).all()) == 1


def test_two_workers_never_take_the_same_job(api):
    _ingest(api)
    with api.session() as a, api.session() as b:
        first = jobs.claim(a, "w1", 60)
        second = jobs.claim(b, "w2", 60)
    assert first is not None and second is None


def test_idle_worker_backs_off_caps_and_resets_after_work(monkeypatch):
    import pytest
    import app.worker.run as worker
    from types import SimpleNamespace

    class StopLoop(Exception):
        pass

    waits = []
    outcomes = iter([False] * 9 + [True, False])
    def run(*args):
        try:
            return next(outcomes)
        except StopIteration:
            raise StopLoop
    class Wakeup:
        def clear(self):
            pass
        def wait(self, timeout):
            waits.append(timeout)
            return False
    monkeypatch.setattr(worker, "run_one", run)
    monkeypatch.setattr(jobs, "queue_changed", Wakeup())
    with pytest.raises(StopLoop):
        worker.run_loop(SimpleNamespace(worker_poll_seconds=1), None, "test")
    assert waits == [1, 2, 4, 8, 16, 32, 60, 60, 60, 1]


def test_committed_enqueue_wakes_idle_worker_and_rollback_does_not(api):
    from threading import Thread
    _ingest(api)
    with api.session() as session:
        version_id = session.scalar(select(Job.post_version_id))
    jobs.queue_changed.clear()
    observed = []
    waiter = Thread(target=lambda: observed.append(jobs.queue_changed.wait(2)))
    waiter.start()
    with api.session() as session:
        jobs.enqueue(session, kind="extract", post_version_id=version_id)
        session.flush()
        assert not jobs.queue_changed.is_set()
        session.commit()
    waiter.join(3)
    assert observed == [True]
    jobs.queue_changed.clear()
    with api.session() as session:
        jobs.enqueue(session, kind="extract", post_version_id=version_id)
        session.flush()
        session.rollback()
        session.commit()
    assert not jobs.queue_changed.is_set()


def test_enqueue_notification_resets_backoff(monkeypatch):
    import pytest
    import app.worker.run as worker
    from types import SimpleNamespace
    waits = []
    class StopLoop(Exception):
        pass
    class Wakeup:
        def clear(self):
            pass
        def wait(self, timeout):
            waits.append(timeout)
            if len(waits) == 4:
                raise StopLoop
            return len(waits) == 3
    monkeypatch.setattr(worker, "run_one", lambda *args: False)
    monkeypatch.setattr(jobs, "queue_changed", Wakeup())
    with pytest.raises(StopLoop):
        worker.run_loop(SimpleNamespace(worker_poll_seconds=1), None, "test")
    assert waits == [1, 2, 4, 1]
