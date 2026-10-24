"""Isolated real FastAPI/SQLite/Regex worker for browser tests. Never used by the app.

Test controls and injected failures only exist on this loopback test server.
"""
import asyncio
import os
import secrets
import tempfile
from pathlib import Path

tmp = tempfile.TemporaryDirectory(prefix='rener-b1-e2e-')
os.environ.update(DATABASE_URL=f"sqlite:///{(Path(tmp.name) / 'test.sqlite').as_posix()}",
                  SECRET_KEY=secrets.token_urlsafe(32), DEMO_MODE='true', GEMINI_API_KEY='',
                  GEMINI_MODEL_ID='', RENER_PBKDF2_ROUNDS='1000')

from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from app.cli import init_db
from app.core.config import get_settings
from app.core.db import session_scope
from app.main import create_app
from app.models import Listing, User
from app.schemas import IngestPost, ReviewDecision
from app.services import ingest, reviews
from app.services.seed import seed_demo
from app.worker.run import drain

init_db()
with session_scope() as session:
    seed_demo(session, password=secrets.token_urlsafe(24))
drain()

def add_edge(key, text, complete=True):
    with session_scope() as session:
        collector = session.scalar(select(User).where(User.username == 'collector'))
        result = ingest.ingest_post(session, collector, IngestPost(
            idempotency_key=key, source_type='manual_paste', text=text,
            text_complete=complete, phone_masked=True), mode='collect', contributed=True, is_demo=True)
        post_id = result.post_id
    drain()
    with session_scope() as session:
        reviewer = session.scalar(select(User).where(User.username == 'reviewer'))
        listing = session.scalar(select(Listing).where(Listing.post_id == post_id, Listing.is_current.is_(True)))
        if listing.review_status == 'needs_review':
            reviews.decide(session, reviewer, listing.id,
                ReviewDecision(action='approve', expected_version=listing.version, reason='B1 isolated demo acceptance'), get_settings())
        return listing.id

edges = {
    'emoji': add_edge('b1:emoji', '🏠 Cho thuê CCMN 1PN 32m2 phường Cầu Giấy. Giá 5tr5/tháng/phòng, điện 3k5/số, cọc 1 tháng.'),
    'range': add_edge('b1:range', 'Cho thuê CCMN 30m2 phường Cầu Giấy. Giá 3-3,5tr/tháng/phòng.'),
    'from': add_edge('b1:from', 'Cho thuê căn hộ dịch vụ 30m2 phường Yên Hòa. Giá từ 3tr/tháng/phòng.'),
    'person': add_edge('b1:person', 'Cho thuê phòng trọ 25m2 phường Cầu Giấy. Giá 1tr5/người/tháng.'),
    'hidden': add_edge('b1:hidden', 'Cho thuê CCMN 28m2 phường Cầu Giấy, ib giá.'),
    'partial': add_edge('b1:partial', 'Cho thuê CCMN 31m2 phường Nghĩa Đô, giá 4tr/tháng/phòng.', False),
}
app = create_app()
state = {'mode': 'ok'}

@app.middleware('http')
async def failures(request: Request, call_next):
    path = request.url.path
    mode = state['mode']
    if path.startswith('/api/v1/'):
        if mode == 'timeout':
            await asyncio.sleep(2)
        if mode == 'comparison_slow' and path.endswith('/comparison'):
            await asyncio.sleep(.5)
        if mode == 'fail' or (mode == 'comparison_error' and path.endswith('/comparison')):
            return JSONResponse({'error': {'code': 'unavailable', 'message': 'API kiểm thử tạm dừng', 'request_id': 'b1-e2e'}}, status_code=503)
        if mode == 'comparison_404' and path.endswith('/comparison'):
            return JSONResponse({'error': {'code': 'not_found', 'message': 'Không tìm thấy so sánh', 'request_id': 'b1-e2e'}}, status_code=404)
    return await call_next(request)

@app.get('/_test/state')
def get_state():
    return {'edges': edges, **state}

@app.post('/_test/state')
async def set_state(request: Request):
    body = await request.json()
    state['mode'] = body.get('mode', 'ok')
    get_settings().demo_mode = body.get('demo_mode', True)
    return state

@app.post('/_test/add')
def add_runtime_post():
    return {'id': add_edge(f'b1:runtime:{secrets.token_hex(6)}', 'Cho thuê CCMN 36m2 phường Yên Hòa, giá 6tr/tháng/phòng.')}
