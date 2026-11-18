"""Durable job queue in the DB (docs/03-system/04-co-so-du-lieu.md §jobs).

A worker takes a job with one conditional UPDATE (queued and due, or running with an expired
lock), so two workers never take the same job. Results and `succeeded` are written in one
transaction; a crash rolls everything back and the lock expiry hands the job to another worker.
"""
from __future__ import annotations

from datetime import timedelta
from threading import Event

from sqlalchemy import and_, event, func, or_, select, text, update
from sqlalchemy.orm import Session

from app.core.ids import utcnow, vn_day_start
from app.models import BotReview, ExtractionRun, Job, LlmDailyUsage, Post, PostVersion
from app.pipeline.llm_extractor import LlmBudgetExceeded

# SQLite retains the same-process hint and exponential polling fallback.
queue_changed = Event()
QUEUE_CHANNEL = "trocheck_jobs"


@event.listens_for(Session, "after_flush")
def _track_enqueued_jobs(session, _context) -> None:
    if any(isinstance(row, Job) and row.status == "queued" for row in session.new):
        session.info["jobs_enqueued"] = True
        if session.get_bind().dialect.name == "postgresql":
            session.execute(text("SELECT pg_notify(:channel, '')"), {"channel": QUEUE_CHANNEL})
    # Replace pending reservations with recorded calls in the same transaction.
    pending = session.info.get("llm_reservations", {})
    for row in session.new:
        review = isinstance(row, BotReview)
        if not isinstance(row, (ExtractionRun, BotReview)) or not row.llm_calls:
            continue
        key = (vn_day_start(row.created_at).date().isoformat(), review)
        count = min(row.llm_calls, pending.get(key, 0))
        if count:
            session.execute(update(LlmDailyUsage).where(LlmDailyUsage.day == key[0]).values(
                calls=LlmDailyUsage.calls - count,
                review_calls=LlmDailyUsage.review_calls - (count if review else 0)))
            pending[key] -= count


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
                    attempt=Job.attempt + 1, updated_at=now, started_at=now, finished_at=None,
                    stage="reading")
            .execution_options(synchronize_session=False)
        )
        session.commit()
        if result.rowcount == 1:
            return session.get(Job, candidate, populate_existing=True)
    return None


def mark_succeeded(job: Job) -> None:
    job.status = "succeeded"
    job.finished_at = utcnow()
    job.stage = None
    job.locked_until = None
    job.error_code = job.error_message = None


def defer(session: Session, job_id: str, *, until, code: str) -> Job:
    """Back to queued until `until`. The job did not fail, so the attempt it just used is given back."""
    job = session.get(Job, job_id, populate_existing=True)
    job.status = "queued"
    job.stage = None
    job.started_at = job.finished_at = None
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
        job.finished_at = utcnow()
    return job


def reserve_llm_call(engine, settings, *, review: bool = False) -> None:
    """Let one conditional UPDATE grant a call against history plus pending calls.

    Commit pending calls independently: a crash cannot refund a provider request. Recording
    a result replaces its reservations in that result's transaction. Both kinds share a cap.
    """
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from sqlalchemy.dialects.sqlite import insert as sqlite_insert

    day = vn_day_start()
    with engine.begin() as conn:
        insert = pg_insert if engine.dialect.name == "postgresql" else sqlite_insert
        total = sum((select(func.coalesce(func.sum(model.llm_calls), 0)).where(
            model.created_at >= day, model.created_at < day + timedelta(days=1)).scalar_subquery()
                     for model in (ExtractionRun, BotReview)), start=0)
        reviews = select(func.coalesce(func.sum(BotReview.llm_calls), 0)).where(
            BotReview.created_at >= day, BotReview.created_at < day + timedelta(days=1)).scalar_subquery()
        # This also locks an existing row. The next statement gets a fresh READ COMMITTED
        # snapshot after a competing result writer commits its history and releases calls.
        conn.execute(insert(LlmDailyUsage).values(day=day.date().isoformat(), calls=0,
                     review_calls=0).on_conflict_do_update(index_elements=["day"],
                     set_={"calls": LlmDailyUsage.calls}))
        conditions = [LlmDailyUsage.day == day.date().isoformat()]
        if settings.llm_daily_call_limit:
            conditions.append(LlmDailyUsage.calls + total < settings.llm_daily_call_limit)
        if review and settings.review_bot_daily_call_limit:
            conditions.append(LlmDailyUsage.review_calls + reviews < settings.review_bot_daily_call_limit)
        granted = conn.execute(update(LlmDailyUsage).where(*conditions).values(
            calls=LlmDailyUsage.calls + 1, review_calls=LlmDailyUsage.review_calls + int(review))
            .returning(LlmDailyUsage.calls)).scalar_one_or_none()
        if granted is None:
            raise LlmBudgetExceeded()


class BudgetedClient:
    def __init__(self, client, session, settings, job, *, review=False):
        self.client, self.session, self.settings = client, session, settings
        self.engine = session.get_bind()
        self.job_id, self.owner, self.attempt = job.id, job.locked_by, job.attempt
        self.review = review
        self.model_id = client.model_id
        self.temperature = getattr(client, "temperature", 0)

    def generate(self, prompt):
        # Both callers are still in their read-only preparation phase. Release that
        # connection before the independent reservation and the provider wait.
        self.session.rollback()
        reserve_llm_call(self.engine, self.settings, review=self.review)
        pending = self.session.info.setdefault("llm_reservations", {})
        key = (vn_day_start().date().isoformat(), self.review)
        pending[key] = pending.get(key, 0) + 1
        with self.engine.begin() as conn:
            conn.execute(update(Job).where(Job.id == self.job_id, Job.status == "running",
                         Job.locked_by == self.owner, Job.attempt == self.attempt).values(stage="asking_ai"))
        return self.client.generate(prompt)
