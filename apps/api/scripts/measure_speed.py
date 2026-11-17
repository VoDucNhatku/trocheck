"""Loopback PostgreSQL benchmark: 30 posts, one 2-second stub call per job.

Run from apps/api: python -B scripts/measure_speed.py
The baseline worker AND queue functions are loaded verbatim from git HEAD in the
child process. Isolated schemas are removed on completion; no real data or LLM.
The processor is a stub in both versions to isolate scheduling and provider wait.
"""
import argparse
import json
import os
import queue
import subprocess
import sys
import threading
import time
from pathlib import Path
from types import ModuleType

API = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API))

from sqlalchemy import select, text

from app.core import db
from app.core.config import Settings
from app.models import Job, Post, PostVersion, User
from app.pipeline.llm_extractor import LlmResponse

URL = "postgresql+psycopg://api_test@127.0.0.1:54329/trocheck_speed"


def baseline_module(path):
    source = subprocess.check_output(["git", "show", "HEAD:" + path], cwd=API, text=True, encoding="utf-8")
    module = ModuleType("speed_baseline_" + Path(path).stem)
    exec(compile(source, path, "exec"), module.__dict__)
    return module


def child(args):
    import app.worker.run as worker
    settings = Settings(database_url=args.url, worker_poll_seconds=60, worker_concurrency=args.concurrency,
                        llm_daily_call_limit=0, review_bot_enabled=False)
    db.configure(args.url)
    if args.baseline:
        old_jobs = baseline_module("apps/api/app/services/jobs.py")
        worker = baseline_module("apps/api/app/worker/run.py")
        worker.jobs = old_jobs
    lock, done = threading.Lock(), threading.Event()
    claimed, completed, calls = 0, 0, 0
    class Stub:
        model_id = "speed-stub"
        temperature = 0
        def generate(self, prompt):
            nonlocal calls
            time.sleep(2)
            with lock:
                calls += 1
            return LlmResponse(text='{"post_type":"rental_offer","spans":[]}')
    def process(session, job, *, llm, settings):
        nonlocal claimed
        with lock:
            claimed += 1
            if claimed == 1:
                print(json.dumps({"first_claim": time.perf_counter()}), flush=True)
        llm.generate("benchmark post")
        worker.jobs.mark_succeeded(job)
    worker.process_job = process
    original = worker.run_one
    def run(*params):
        nonlocal completed
        result = original(*params)
        if result:
            with lock:
                completed += 1
                if completed == 30:
                    print(json.dumps({"finished": time.perf_counter(), "calls": calls}), flush=True)
                    done.set()
        else:
            print(json.dumps({"idle": True}), flush=True)
        return result
    worker.run_one = run
    if args.baseline:
        threading.Thread(target=worker.run_loop, args=(settings, Stub(), "measure-base"), daemon=True).start()
    else:
        threading.Thread(target=worker.run_workers, args=(settings, lambda _: Stub()), daemon=True).start()
    if not done.wait(180):
        raise RuntimeError("benchmark timed out")


def scenario(url, baseline, concurrency):
    schema = f"speed_bench_{time.time_ns()}"
    admin = db.make_engine(url)
    process = None
    with admin.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA "{schema}"'))
    isolated = admin.url.set(query={"options": f"-csearch_path={schema}"}).render_as_string(hide_password=False)
    engine = db.configure(isolated)
    db.Base.metadata.create_all(engine)
    try:
        process = subprocess.Popen([sys.executable, "-B", "-u", str(Path(__file__).resolve()), "--child",
            "--url", isolated, "--concurrency", str(concurrency), *(["--baseline"] if baseline else [])],
            cwd=API, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8")
        lines = queue.Queue()
        def read():
            for line in process.stdout:
                lines.put(line)
        threading.Thread(target=read, daemon=True).start()
        assert json.loads(lines.get(timeout=20))["idle"]
        with db.session_scope() as session:
            user = User(username="speed-benchmark", password_hash="!", roles=[])
            session.add(user)
            session.flush()
            for i in range(30):
                post = Post(source_type="manual_paste", collector_id=user.id, mode="collect", contributed=True)
                session.add(post)
                session.flush()
                version = PostVersion(post_id=post.id, text=f"Benchmark rental post {i}", text_hash=str(i))
                session.add(version)
                session.flush()
                post.current_version_id = version.id
                session.add(Job(kind="extract", post_version_id=version.id))
            # NOTIFY is delivered by this commit, after the timer starts.
            enqueued = time.perf_counter()
        first = None
        while True:
            message = json.loads(lines.get(timeout=180))
            if "first_claim" in message:
                first = message["first_claim"]
            if "finished" in message:
                break
        process.wait(timeout=5)
        assert process.returncode == 0, process.stderr.read()
        with db.session_scope() as session:
            assert len(session.scalars(select(Job).where(Job.status == "succeeded")).all()) == 30
        assert first is not None and message["calls"] == 30
        return {"version": "HEAD baseline" if baseline else "working tree", "concurrency": concurrency,
                "posts": 30, "stub_calls": message["calls"], "stub_seconds": 2,
                "enqueue_to_first_claim_seconds": round(first - enqueued, 4),
                "queue_drain_seconds": round(message["finished"] - enqueued, 4)}
    finally:
        if process is not None and process.poll() is None:
            process.kill()
            process.communicate()
        engine.dispose()
        with admin.begin() as conn:
            conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--child", action="store_true")
    parser.add_argument("--baseline", action="store_true")
    parser.add_argument("--concurrency", type=int, default=1)
    parser.add_argument("--url", default=os.environ.get("TEST_DATABASE_URL", URL))
    args = parser.parse_args()
    if args.child:
        child(args)
    else:
        import app
        assert Path(app.__file__).resolve() == API / "app/__init__.py", app.__file__
        print(f"app_origin={app.__file__}", flush=True)
        if not args.url.startswith("postgresql+psycopg://api_test@127.0.0.1:54329/trocheck_speed"):
            raise SystemExit("Use only the dedicated loopback benchmark database")
        for baseline, concurrency in ((True, 1), (False, 1), (False, 2)):
            print(f"starting baseline={baseline} worker_concurrency={concurrency}", flush=True)
            print(json.dumps(scenario(args.url, baseline, concurrency)), flush=True)
