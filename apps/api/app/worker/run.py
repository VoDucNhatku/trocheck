"""Worker loop: take a job, run M1-M8, store, mark succeeded — one transaction per job.

    python -m app.worker.run            # loop forever
    python -m app.worker.run --once     # drain the queue and exit

The Gemini key is read here only (worker environment); without it the pipeline runs Regex only
and records llm_status = not_run.
"""
from __future__ import annotations

import argparse
import logging
import os
import socket
import time
from datetime import timedelta

from app.core.config import Settings, get_settings
from app.core.db import session_factory
from app.core.ids import vn_day_start
from app.models import Job, Post, PostVersion
from app.pipeline.llm_extractor import LlmBudgetExceeded, LlmClient
from app.services import bot_reviews, jobs
from app.services.processing import llm_calls_today, process_job

log = logging.getLogger("rener.worker")


def make_llm(settings: Settings) -> LlmClient | None:
    if not settings.gemini_api_key or not settings.gemini_model_id:
        return None
    from app.pipeline.llm_client import GeminiClient
    return GeminiClient(settings.gemini_api_key, settings.gemini_model_id,
                        temperature=settings.llm_temperature, timeout=settings.llm_timeout_seconds)


class SpentBudget:
    """Stands in for the Gemini client once today's call budget is used up. Posts that Regex or the
    cache can finish still go through; the first one that needs a call raises LlmBudgetExceeded."""

    def __init__(self, model_id: str):
        self.model_id = model_id

    def generate(self, prompt: str):
        raise LlmBudgetExceeded()


def client_for(session, job, llm: LlmClient | None, settings: Settings) -> LlmClient | None:
    if llm is None or not settings.llm_daily_call_limit or llm_calls_today(session) < settings.llm_daily_call_limit:
        return llm
    version = session.get(PostVersion, job.post_version_id) if job.post_version_id else None
    # Someone is waiting for an analysis: answer now with Regex only. Collected posts can wait a day.
    if version is not None and version.post.mode == "assess":
        return None
    return SpentBudget(llm.model_id)


def bot_client(settings: Settings, llm: LlmClient | None) -> LlmClient | None:
    if not bot_reviews.enabled(settings):
        return None
    model_id = settings.review_bot_model_id or settings.gemini_model_id
    from app.pipeline.llm_client import GeminiClient

    if llm is not None and not isinstance(llm, GeminiClient) and (not settings.review_bot_model_id or llm.model_id == model_id):
        return llm
    return make_llm(settings.model_copy(update={"gemini_model_id": model_id,
                                                "llm_timeout_seconds": settings.review_bot_timeout_seconds}))


def run_one(settings: Settings, llm: LlmClient | None, worker_id: str, *, demo_only: bool = False) -> bool:
    """Process one due job. Returns False when the queue is empty."""
    factory = session_factory()
    with factory() as session:
        job = jobs.claim(session, worker_id, settings.job_lock_seconds, demo_only=demo_only)
        if job is None:
            return False
        job_id = job.id
        try:
            if job.kind == "bot_review":
                bot_reviews.process_job(session, job, llm=bot_client(settings, llm), settings=settings)
            else:
                process_job(session, job, llm=client_for(session, job, llm, settings), settings=settings)
            session.commit()
            completed = session.get(Job, job_id, populate_existing=True)
            log.info("job %s: %s", job_id, completed.status if completed else "removed")
        except LlmBudgetExceeded:
            session.rollback()
            jobs.defer(session, job_id, until=vn_day_start() + timedelta(days=1), code="llm_daily_limit")
            session.commit()
            log.info("job %s waits for tomorrow: daily LLM budget used up", job_id)
        except Exception as exc:  # noqa: BLE001 - every failure is recorded on the job
            session.rollback()
            # Never log post text or keys: type and short message only.
            log.warning("job %s failed: %s", job_id, type(exc).__name__)
            job = jobs.mark_failed(session, job_id, code=type(exc).__name__, message=str(exc)[:200],
                                   max_attempts=settings.job_max_attempts)
            if job.status == "failed" and job.post_version_id and job.kind != "bot_review":
                version = session.get(PostVersion, job.post_version_id)
                post = session.get(Post, version.post_id) if version else None
                if post is not None:
                    post.status = "failed"
            session.commit()
    return True


def drain(settings: Settings | None = None, llm: LlmClient | None = None, *, limit: int = 10_000,
          demo_only: bool = False) -> int:
    settings = settings or get_settings()
    worker_id = f"{socket.gethostname()}:{os.getpid()}"
    done = 0
    while done < limit and run_one(settings, llm, worker_id, demo_only=demo_only):
        done += 1
    return done


def main() -> None:
    parser = argparse.ArgumentParser(description="ReNER-VN job worker")
    parser.add_argument("--once", action="store_true", help="drain the queue and exit")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    settings = get_settings()
    llm = make_llm(settings)
    log.info("worker started, llm=%s", "on" if llm else "off (regex only)")
    if args.once:
        log.info("processed %d jobs", drain(settings, llm))
        return
    worker_id = f"{socket.gethostname()}:{os.getpid()}"
    while True:
        if not run_one(settings, llm, worker_id):
            time.sleep(settings.worker_poll_seconds)


if __name__ == "__main__":
    main()
