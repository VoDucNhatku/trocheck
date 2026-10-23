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

from app.core.config import Settings, get_settings
from app.core.db import session_factory
from app.models import Post, PostVersion
from app.pipeline.llm_extractor import LlmClient
from app.services import jobs
from app.services.processing import process_job

log = logging.getLogger("rener.worker")


def make_llm(settings: Settings) -> LlmClient | None:
    if not settings.gemini_api_key or not settings.gemini_model_id:
        return None
    from app.pipeline.llm_client import GeminiClient
    return GeminiClient(settings.gemini_api_key, settings.gemini_model_id,
                        temperature=settings.llm_temperature, timeout=settings.llm_timeout_seconds)


def run_one(settings: Settings, llm: LlmClient | None, worker_id: str) -> bool:
    """Process one due job. Returns False when the queue is empty."""
    factory = session_factory()
    with factory() as session:
        job = jobs.claim(session, worker_id, settings.job_lock_seconds)
        if job is None:
            return False
        job_id = job.id
        try:
            process_job(session, job, llm=llm, settings=settings)
            session.commit()
            log.info("job %s succeeded", job_id)
        except Exception as exc:  # noqa: BLE001 - every failure is recorded on the job
            session.rollback()
            # Never log post text or keys: type and short message only.
            log.warning("job %s failed: %s", job_id, type(exc).__name__)
            job = jobs.mark_failed(session, job_id, code=type(exc).__name__, message=str(exc)[:200],
                                   max_attempts=settings.job_max_attempts)
            if job.status == "failed" and job.post_version_id:
                version = session.get(PostVersion, job.post_version_id)
                post = session.get(Post, version.post_id) if version else None
                if post is not None:
                    post.status = "failed"
            session.commit()
    return True


def drain(settings: Settings | None = None, llm: LlmClient | None = None, *, limit: int = 10_000) -> int:
    settings = settings or get_settings()
    worker_id = f"{socket.gethostname()}:{os.getpid()}"
    done = 0
    while done < limit and run_one(settings, llm, worker_id):
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
