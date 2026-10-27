"""Loopback-only integration preview: isolated SQLite, invented seed, Regex-only worker.

No production data, cloud or Gemini calls. Test credentials live only in ignored .tmp.
"""
import asyncio
import json
import os
from pathlib import Path
import secrets
import tempfile
from contextlib import asynccontextmanager

root = Path(__file__).resolve().parents[3]
folder = Path(tempfile.mkdtemp(prefix="rener-interior-", dir=root / ".tmp"))
password = secrets.token_urlsafe(28)
os.environ.update(DATABASE_URL=f"sqlite:///{(folder / 'test.sqlite').as_posix()}",
                  SECRET_KEY=secrets.token_urlsafe(32), DEMO_MODE="true", GEMINI_API_KEY="",
                  GEMINI_MODEL_ID="", RENER_PBKDF2_ROUNDS="1000", EVAL_RUNS_DIR=str(folder / "eval"))

from fastapi import Request
from fastapi.responses import JSONResponse
from app.cli import init_db
from app.core.db import session_scope
from app.main import create_app
from app.services.seed import seed_demo
from app.worker.run import drain

init_db()
with session_scope() as session:
    seed_demo(session, password=password)
drain()
(root / ".tmp" / "interior-test-credentials.json").write_text(json.dumps({"password": password}), encoding="utf-8")
state = {"mode": "ok", "worker_paused": False}

async def worker_loop():
    while True:
        if not state["worker_paused"]:
            await asyncio.to_thread(drain)
        await asyncio.sleep(1.5)

@asynccontextmanager
async def lifespan(app):
    task = asyncio.create_task(worker_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

app = create_app()
app.router.lifespan_context = lifespan

@app.middleware("http")
async def test_controls(request: Request, call_next):
    if request.url.path.startswith("/api/v1/") and state["mode"] == "fail":
        return JSONResponse({"error": {"code": "unavailable", "message": "Máy chủ kiểm thử tạm dừng"}},
                            status_code=503)
    return await call_next(request)

@app.get("/_test/state")
def get_state():
    return {"ready": True, **state}

@app.post("/_test/state")
async def set_state(request: Request):
    value = await request.json()
    state.update({key: value[key] for key in ("mode", "worker_paused") if key in value})
    return state
