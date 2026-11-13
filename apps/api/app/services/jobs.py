"""Durable job queue in the DB (docs/03-system/04-co-so-du-lieu.md §jobs).

A worker takes a job with one conditional UPDATE (queued and due, or running with an expired
lock), so two workers never take the same job. Results and `succeeded` are written in one
transaction; a crash rolls everything back and the lock expiry hands the job to another worker.
"""
from __future__ import annotations

from datetime import timedelta
from threading import Event

from sqlalchemy import and_, event, or_, select, update
from sqlalchemy.orm import Session

from app.core.ids import utcnow
from app.models import Job, Post, PostVersion

# Same-process wake-up only. Separate worker processes discover work at the next poll.
queue_changed = Event()


@event.listens_for(Session, "after_flush")
def _track_enqueued_jobs(session, _context) -> None:
    if any(isinstance(row, Job) and row.status == "queued" for row in session.new):
        session.info["jobs_enqueued"] = True


@event.listens_for(Session, "after_commit")
def _wake_after_commit(session) -> None:
    if session.info.pop("jobs_enqueued", False):
        queue_changed.set()


@event.listens_for(Session, "after_rollback")
def _discard_wakeup(session) -> None:
    session.info.pop("jobs_enqueued", None)


def enqueue(session: Session, *, kind: str, post_version_id: str, requested_by: str | None = None) -> Job:
    job = Job(kind=kind, post_version_id=post_version_id, requested_by=requested_by, status="queued",
              run_after=utcnow())
    session.add(job)
    return job


def _due(now):
    return or_(and_(Job.status == "queued", Job.run_after <= now),
               and_(Job.status == "running", Job.locked_until < now))


def claim(session: Session, worker_id: str, lock_seconds: int, *, demo_only: bool = False) -> Job | None:
    query_base = select(Job.id)
    if demo_only:
        query_base = query_base.where(Job.kind == "extract", Job.post_version_id.in_(
            select(PostVersion.id).join(Post, PostVersion.post_id == Post.id).where(Post.is_demo.is_(True))))
    # Two workers can pick the same candidate; the loser must look at the next due job instead of
    # reporting an empty queue. Each lost round means another worker took a job, so this ends.
    for _ in range(20):
        now = utcnow()
        candidate = session.scalar(query_base.where(_due(now))
                                   .order_by(Job.kind == "bot_review", Job.created_at, Job.id).limit(1))
        if candidate is None:
            return None
        result = session.execute(
            update(Job)
            .where(Job.id == candidate, _due(now))
            .values(status="running", locked_by=worker_id, locked_until=now + timedelta(seconds=lock_seconds),
                    attempt=Job.attempt + 1, updated_at=now)
            .execution_options(synchronize_session=False)
        )
        session.commit()
        if result.rowcount == 1:
            return session.get(Job, candidate, populate_existing=True)
    return None


def mark_succeeded(job: Job) -> None:
    job.status = "succeeded"
    job.locked_until = None
    job.error_code = job.error_message = None


def defer(session: Session, job_id: str, *, until, code: str) -> Job:
    """Back to queued until `until`. The job did not fail, so the attempt it just used is given back."""
    job = session.get(Job, job_id, populate_existing=True)
    job.status = "queued"
    job.run_after = until
    job.locked_until = None
    job.attempt = max(0, job.attempt - 1)
    job.error_code, job.error_message = code[:50], None
    return job


def mark_failed(session: Session, job_id: str, *, code: str, message: str, max_attempts: int) -> Job:
    """Temporary failure -> back to queued with backoff; out of attempts -> failed."""
    job = session.get(Job, job_id, populate_existing=True)
    job.error_code = code[:50]
    job.error_message = message[:500]
    job.locked_until = None
    if job.attempt < max_attempts:
        job.status = "queued"
        job.run_after = utcnow() + timedelta(seconds=min(300, 5 * 2 ** job.attempt))
    else:
        job.status = "failed"
    return job
