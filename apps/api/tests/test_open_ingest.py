"""Any signed-in account may send posts and photos; daily caps and the daily Gemini budget."""
import json
from datetime import timedelta

from sqlalchemy import select

from app.core.ids import seconds_to_vn_midnight, utcnow, vn_day_start
from app.models import ExtractionRun, Job, Post, PostImage
from app.pipeline.llm_extractor import LlmResponse
from app.services import images
from tests.conftest import batch, post_payload

V1 = "/api/v1"
FULL = "Cho thuê CCMN 1PN 30m2 phường Cầu Giấy, giá 5tr/th/phòng, cọc 1 tháng. LH [SĐT]"
JPEG = b"\xff\xd8\xff\xe0" + b"0" * 200


def posts(prefix, n):
    return [post_payload(f"{prefix}-{i}", f"Cho thuê phòng trọ số {i} rộng 2{i}m2 giá 3tr/tháng") for i in range(n)]


def send(client, *items):
    return client.post(f"{V1}/ingest/batch", json=batch(*items))


class NeedyLLM:
    """Answers every call with the price quoted from the test posts."""
    model_id = "fake-model"

    def __init__(self):
        self.calls = 0

    def generate(self, prompt):
        self.calls += 1
        return LlmResponse(text=json.dumps({"post_type": "rental_offer", "spans": [
            {"listing_index": 0, "label": "PRICE", "quote": "3tr/tháng"}]}), tokens_in=1, tokens_out=1)


def test_day_starts_at_midnight_in_vietnam():
    now = utcnow().replace(hour=18, minute=30, second=0)  # 01:30 the next day in Vietnam
    assert vn_day_start(now) == now.replace(hour=17, minute=0)
    assert seconds_to_vn_midnight(now) == 22 * 3600 + 30 * 60 + 1
    assert vn_day_start(now.replace(hour=16)) == (now - timedelta(days=1)).replace(hour=17, minute=0)


def test_ordinary_account_sends_posts_but_the_team_store_stays_closed(api):
    c = api.client("renter")
    answer = send(c, post_payload("open-1", FULL, source_group_id="1", external_post_id="1"))
    assert answer.status_code == 200 and answer.json()["summary"] == {"created": 1, "duplicate": 0, "rejected": 0}
    assert c.get(f"{V1}/team/posts").status_code == 403
    assert api.client().post(f"{V1}/ingest/batch", json=batch(post_payload("open-2", FULL))).status_code == 401
    assert api.drain() == 1
    with api.session() as s:
        post = s.scalars(select(Post)).one()
        assert post.contributed and post.mode == "collect" and post.status == "extracted"


def test_daily_cap_stops_inside_a_batch_and_keeps_the_rest_unanswered(api, monkeypatch):
    monkeypatch.setattr(api.settings, "ingest_daily_limit", 3)
    c = api.client("renter")
    first = send(c, *posts("cap", 5))
    body = first.json()
    assert first.status_code == 200 and body["summary"] == {"created": 3, "duplicate": 0, "rejected": 0, "deferred": 2}
    assert [r["idempotency_key"] for r in body["results"]] == ["cap-0", "cap-1", "cap-2"]
    again = send(c, *posts("cap", 5)[3:])
    assert again.status_code == 429 and again.json()["error"]["code"] == "daily_limit"
    assert "3 bài" in again.json()["error"]["message"]
    assert 0 < int(again.headers["Retry-After"]) <= 86401
    with api.session() as s:
        assert len(s.scalars(select(Post)).all()) == 3


def test_cap_counts_new_posts_of_today_only(api, monkeypatch):
    monkeypatch.setattr(api.settings, "ingest_daily_limit", 2)
    c = api.client("renter")
    assert send(c, *posts("day", 2)).json()["summary"]["created"] == 2
    assert send(c, post_payload("day-x", FULL)).status_code == 429
    with api.session() as s:
        for post in s.scalars(select(Post)).all():
            post.first_seen_at = vn_day_start() - timedelta(minutes=1)
        s.commit()
    # Posts already in the store are answered as duplicates and use none of the new day's allowance.
    assert send(c, *posts("day", 2)).json()["summary"] == {"created": 0, "duplicate": 2, "rejected": 0}
    assert send(c, post_payload("day-x", FULL)).json()["summary"]["created"] == 1


def test_collectors_and_analyses_are_outside_the_cap(api, monkeypatch):
    monkeypatch.setattr(api.settings, "ingest_daily_limit", 1)
    assert send(api.client("collector"), *posts("team", 4)).json()["summary"]["created"] == 4
    assert send(api.client("admin"), *posts("boss", 2)).json()["summary"]["created"] == 2
    c = api.client("renter")
    assert c.post(f"{V1}/analyses", json=post_payload("assess-1", FULL)).status_code == 202
    assert send(c, post_payload("mine-1", FULL + " 2")).json()["summary"]["created"] == 1
    monkeypatch.setattr(api.settings, "ingest_daily_limit", 0)
    assert send(c, *posts("free", 3)).json()["summary"]["created"] == 3


def test_ordinary_account_sends_photos_up_to_its_daily_cap(api, monkeypatch):
    for key, value in {"CLOUDINARY_CLOUD_NAME": "demo", "CLOUDINARY_API_KEY": "1", "CLOUDINARY_API_SECRET": "s"}.items():
        monkeypatch.setenv(key, value)
    monkeypatch.setenv("INGEST_IMAGE_DAILY_LIMIT", "1")
    from app.core import config
    config.get_settings.cache_clear()
    monkeypatch.setattr(images, "upload_to_cloudinary", lambda data, public_id, settings: {
        "secure_url": f"https://res.cloudinary.com/demo/image/upload/v1/{public_id}.jpg", "public_id": public_id})
    c = api.client("renter")
    send(c, post_payload("pic-1", FULL))
    put = lambda client, data: client.put(f"{V1}/ingest/images", params={"idempotency_key": "pic-1"}, content=data)
    assert put(c, JPEG).json()["status"] == "created"
    assert put(c, JPEG).json()["status"] == "duplicate"
    second = put(c, JPEG + b"1")
    assert second.status_code == 429 and second.json()["error"]["code"] == "daily_limit"
    assert 0 < int(second.headers["Retry-After"]) <= 86401
    team = api.client("collector")
    send(team, post_payload("pic-1", FULL))
    assert put(team, JPEG + b"2").json()["status"] == "created"
    assert put(team, JPEG + b"3").json()["status"] == "created"
    with api.session() as s:
        assert len(s.scalars(select(PostImage)).all()) == 3


def test_spent_llm_budget_makes_collected_posts_wait_until_tomorrow(api, monkeypatch):
    monkeypatch.setattr(api.settings, "llm_daily_call_limit", 1)
    c = api.client("renter")
    send(c, post_payload("llm-a", "Cho thuê phòng trọ giá 3tr/tháng gần chợ"),
         post_payload("llm-b", "Cho thuê phòng trọ giá 3tr/tháng gần trường"), post_payload("regex-only", FULL))
    llm = NeedyLLM()
    assert api.drain(llm) == 3
    assert llm.calls == 1
    with api.session() as s:
        waiting = s.scalars(select(Job).where(Job.status == "queued")).all()
        assert len(waiting) == 1 and len(s.scalars(select(Job).where(Job.status == "succeeded")).all()) == 2
        job = waiting[0]
        assert job.error_code == "llm_daily_limit" and job.attempt == 0
        assert job.run_after == vn_day_start() + timedelta(days=1)
        assert sorted(p.status for p in s.scalars(select(Post)).all()) == ["extracted", "extracted", "received"]
    assert api.drain(llm) == 0 and llm.calls == 1
    # The next day: yesterday's calls no longer count and the job is due.
    with api.session() as s:
        for run in s.scalars(select(ExtractionRun)).all():
            run.created_at = vn_day_start() - timedelta(minutes=1)
        s.scalars(select(Job).where(Job.status == "queued")).one().run_after = utcnow() - timedelta(seconds=1)
        s.commit()
    assert api.drain(llm) == 1 and llm.calls == 2
    with api.session() as s:
        assert {job.status for job in s.scalars(select(Job)).all()} == {"succeeded"}


def test_spent_llm_budget_still_answers_an_analysis_with_regex_only(api, monkeypatch):
    monkeypatch.setattr(api.settings, "llm_daily_call_limit", 1)
    send(api.client("collector"), post_payload("llm-a", "Cho thuê phòng trọ giá 3tr/tháng gần chợ"))
    llm = NeedyLLM()
    assert api.drain(llm) == 1 and llm.calls == 1
    c = api.client("renter")
    aid = c.post(f"{V1}/analyses", json=post_payload("assess-1", "Cho thuê phòng trọ giá 3tr/tháng gần ga")).json()["analysis_id"]
    assert api.drain(llm) == 1 and llm.calls == 1
    assert c.get(f"{V1}/analyses/{aid}").json()["status"] == "succeeded"
    with api.session() as s:
        runs = s.scalars(select(ExtractionRun).order_by(ExtractionRun.created_at, ExtractionRun.id)).all()
        assert sorted(run.llm_status for run in runs) == ["not_run", "ok"]


def test_no_budget_set_means_no_waiting(api, monkeypatch):
    monkeypatch.setattr(api.settings, "llm_daily_call_limit", 0)
    send(api.client("renter"), post_payload("llm-a", "Cho thuê phòng trọ giá 3tr/tháng gần chợ"),
         post_payload("llm-b", "Cho thuê phòng trọ giá 3tr/tháng gần trường"))
    llm = NeedyLLM()
    assert api.drain(llm) == 2 and llm.calls == 2
