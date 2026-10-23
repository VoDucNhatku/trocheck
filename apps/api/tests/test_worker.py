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
