"""Invented submissions exercise private ownership, real statuses and both SQL dialects."""
from datetime import timedelta
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import MetaData, Table, inspect, select

from app.core.db import make_engine
from app.core.ids import utcnow, vn_day_start
from app.models import IdempotencyKey, Job, Listing, Post, PostImage, PostSubmission, User
from tests.conftest import batch, post_payload

V1 = "/api/v1"
TEXT = "Cho thuê phòng trọ 25m2 phường 25, Bình Thạnh, giá 3tr5/tháng/phòng. Bài thử nghiệm."


def send(client, key="mine", text=TEXT, **extra):
    response = client.post(V1 + "/ingest/batch", json=batch(post_payload("test-" + key, text, **extra)))
    assert response.status_code == 200, response.text
    return response.json()["results"][0]["post_id"]


def read(client, **params):
    response = client.get(V1 + "/me/posts", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def test_anonymous_cannot_read_posts_or_summary(api):
    c = api.client()
    assert c.get(V1 + "/me/posts").status_code == 401
    assert c.get(V1 + "/me/posts/summary").status_code == 401


def test_renter_ownership_demo_exclusion_and_private_fields(api):
    c, other = api.client("renter"), api.client("collector")
    mine = send(c, source_group_name="Nhóm thử", permalink="https://www.facebook.com/groups/1/posts/2/")
    send(other, "other", TEXT + " Khác.")
    demo = send(c, "demo", TEXT + " Demo.")
    with api.session() as s:
        s.get(Post, demo).is_demo = True
        s.commit()
    for mode in (False, True):
        api.set_demo(mode)
        body = read(c)
        assert body["total"] == 1
        item = body["items"][0]
        assert item["post_id"] == mine and item["status"] == "received"
        assert item["source_group_name"] == "Nhóm thử" and item["permalink"].endswith("/2/")
        assert item["excerpt"] == TEXT and item["photo_count"] == 0
        assert "collector_id" not in item and "user_id" not in item
        assert read(c, post_id=read(other)["items"][0]["post_id"])["items"] == body["items"]
        assert c.get(V1 + "/team/posts").status_code == 403


@pytest.mark.parametrize("state,expected,group", [
    ("queued", "received", "waiting"), ("running", "received", "waiting"),
    ("failed", "failed", "other"), ("auto_accepted", "published", "published"),
    ("approved", "published", "published"), ("needs_review", "needs_review", "waiting"),
    ("rejected", "rejected", "other"), ("duplicate", "rejected", "other"),
    ("not_rental", "not_rental", "other"),
])
def test_status_mapping_and_filters(api, state, expected, group):
    c = api.client("renter")
    pid = send(c)
    if state in ("queued", "running", "failed"):
        with api.session() as s:
            s.scalar(select(Job)).status = state
            s.commit()
    elif state == "not_rental":
        api.drain()
        with api.session() as s:
            s.get(Post, pid).status = "rejected_type"
            s.commit()
    else:
        api.drain()
        with api.session() as s:
            lst = s.scalar(select(Listing))
            lst.review_status = state
            lst.review_reasons = ["former_ward_split", "outside_hcm_province"]
            s.commit()
    item = read(c)["items"][0]
    assert item["status"] == expected
    assert read(c, group=group)["total"] == 1
    for other in {"published", "waiting", "other"} - {group}:
        assert read(c, group=other)["total"] == 0
    summary = c.get(V1 + "/me/posts/summary").json()["counts"]
    assert summary == {"all": 1, "published": int(group == "published"),
                       "waiting": int(group == "waiting"), "other": int(group == "other")}
    if state in ("auto_accepted", "approved", "needs_review", "rejected", "duplicate"):
        assert item["reason_codes"] == ["former_ward_split", "outside_hcm_province"]
        assert bool(item["listings"][0]["public_url"]) == (expected == "published")


def test_shared_post_is_recorded_once_per_sender_without_replacing_collector(api):
    first, second = api.client("collector"), api.client("renter")
    pid = send(first, "a", external_post_id="shared", source_group_id="test")
    assert send(second, "b", external_post_id="shared", source_group_id="test") == pid
    assert send(second, "b", external_post_id="shared", source_group_id="test") == pid
    assert send(second, "b2", external_post_id="shared", source_group_id="test") == pid
    with api.session() as s:
        owner = s.scalar(select(User).where(User.username == "collector"))
        assert s.get(Post, pid).collector_id == owner.id
        assert len(s.scalars(select(PostSubmission)).all()) == 2
        assert len(s.scalars(select(Post)).all()) == 1
    assert read(first)["items"][0]["post_id"] == read(second)["items"][0]["post_id"] == pid
    assert read(api.client("reviewer2"))["total"] == 0
    quota = second.get(V1 + "/me/posts/summary").json()["quota"]
    assert quota["used"] == 0  # Existing ingest policy: duplicates consume no new-post quota.


def test_pagination_is_stable_and_validated(api):
    c = api.client("renter")
    ids = [send(c, str(i), TEXT + f" Số {i}.") for i in range(5)]
    with api.session() as s:
        for post in s.scalars(select(PostSubmission)):
            post.first_sent_at = utcnow().replace(microsecond=0)
        s.commit()
    pages = [read(c, page=p, limit=2) for p in (1, 2, 3)]
    assert [x["post_id"] for p in pages for x in p["items"]] == sorted(ids, reverse=True)
    assert all(p["total"] == 5 for p in pages)
    assert read(c, page=4, limit=2)["items"] == []
    for params in ({"limit": 51}, {"limit": 0}, {"page": 0}, {"group": "invalid"}):
        assert c.get(V1 + "/me/posts", params=params).status_code == 422


def test_legacy_second_sender_replay_repairs_missing_submission(api):
    first, second = api.client("collector"), api.client("renter")
    pid = send(first, "old-first", external_post_id="legacy-shared")
    send(second, "old-second", external_post_id="legacy-shared")
    with api.session() as s:
        user = s.scalar(select(User).where(User.username == "renter"))
        submission = s.get(PostSubmission, (pid, user.id))
        s.delete(submission)  # Reproduce the pre-0007 second sender: only an idempotency row survives.
        key = s.get(IdempotencyKey, ("test-old-second", user.id))
        key.created_at = utcnow() - timedelta(hours=2)
        original_sent_at = key.created_at
        s.commit()
    assert read(second)["total"] == 0
    assert send(second, "old-second", external_post_id="legacy-shared") == pid
    with api.session() as s:
        assert s.get(PostSubmission, (pid, user.id)).first_sent_at == original_sent_at
        assert len(s.scalars(select(PostSubmission)).all()) == 2
    assert read(second)["total"] == 1


def test_summary_reuses_ingest_vietnam_quota_counter(api, monkeypatch):
    monkeypatch.setattr(api.settings, "ingest_daily_limit", 3)
    c = api.client("renter")
    old = send(c, "old")
    send(c, "today", TEXT + " Hôm nay.")
    with api.session() as s:
        s.get(Post, old).first_seen_at = vn_day_start() - timedelta(seconds=1)
        s.commit()
    summary = c.get(V1 + "/me/posts/summary").json()
    assert summary["counts"] == {"all": 2, "published": 0, "waiting": 2, "other": 0}
    assert summary["quota"] == {"used": 1, "limit": 3, "remaining": 2, "timezone": "Asia/Ho_Chi_Minh"}
    assert api.client("collector").get(V1 + "/me/posts/summary").json()["quota"]["limit"] is None
    monkeypatch.setattr(api.settings, "ingest_daily_limit", 0)
    assert c.get(V1 + "/me/posts/summary").json()["quota"]["remaining"] is None


def test_extraction_photos_and_real_comparison_even_in_demo_mode(api, monkeypatch):
    c = api.client("renter")
    pid = send(c)
    api.drain()
    with api.session() as s:
        listing = s.scalar(select(Listing))
        listing.review_status = "approved"
        user = s.scalar(select(User).where(User.username == "renter"))
        s.add(PostImage(post_id=pid, uploaded_by=user.id, content_hash="invented", url="https://example.com/test.jpg",
                        public_id="test"))
        s.commit()
    for demo in (False, True):
        api.set_demo(demo)
        body = read(c)
        item = body["items"][0]
        assert item["photo_count"] == 1 and item["status"] == "published"
        extracted = item["listings"][0]
        assert extracted["price_vnd"] == 3500000 and extracted["price_basis"] == "per_unit"
        assert extracted["price_period"] == "month" and extracted["area_m2"] == 25
        assert extracted["ward_code"] == "26956" and extracted["resolution"] == "from_former_unit"
        cmp = extracted["comparison"]
        assert cmp["status"] == "insufficient_data" and "too_few_samples" in cmp["reason_codes"]
        assert cmp["delta_percent"] is None and cmp["mean_vnd"] is None and cmp["is_demo"] is False
        assert body["comparison_baseline"] == "real_accepted"
    # A distinct accepted cluster supplies a real baseline; demo rows must never supply one.
    other = send(api.client("collector"), "baseline", TEXT + " Tin đối chiếu.")
    api.drain()
    with api.session() as s:
        lst = s.scalar(select(Listing).where(Listing.post_id == other))
        lst.review_status, lst.cluster_id = "approved", None
        lst.rent_amount_vnd = 3000000
        s.commit()
    monkeypatch.setattr(api.settings, "market_min_n", 1)
    cmp = read(c)["items"][0]["listings"][0]["comparison"]
    assert cmp["status"] == "ok" and cmp["n"] == 1 and cmp["mean_vnd"] == 3000000
    assert cmp["delta_percent"] == 16.7
    with api.session() as s:
        s.get(Post, other).is_demo = True
        s.commit()
    assert read(c)["items"][0]["listings"][0]["comparison"]["status"] == "insufficient_data"


def test_edited_shared_post_waits_for_current_version_not_stale_extraction(api):
    c = api.client("renter")
    pid = send(c, external_post_id="edit")
    api.drain()
    send(c, "edited", TEXT + " Nội dung mới.", external_post_id="edit")
    item = read(c)["items"][0]
    assert item["post_id"] == pid and item["status"] == "received" and item["listings"] == []
    assert item["excerpt"].endswith("Nội dung mới.")


def test_pipeline_missing_ward_and_non_rental_states_without_manual_status_edits(api):
    c = api.client("renter")
    send(c, "missing", "Cho thuê phòng trọ 22m2 giá 3tr/tháng/phòng. Bài thử nghiệm.")
    send(c, "sale", "Sang nhượng quán cafe giá 50tr. Bài thử nghiệm.")
    assert api.drain() == 2
    items = read(c)["items"]
    assert sorted(p["status"] for p in items) == ["needs_review", "not_rental"]
    waiting = next(p for p in items if p["status"] == "needs_review")
    assert waiting["listings"][0]["ward_code"] is None
    cmp = waiting["listings"][0]["comparison"]
    assert cmp["status"] == "not_comparable" and "ward_unresolved" in cmp["reason_codes"]
    assert cmp["delta_percent"] is None


def test_stored_failed_status_and_excerpt_limit_and_private_cache_headers(api):
    c = api.client("renter")
    pid = send(c, text=TEXT + " Nội dung thử nghiệm." * 30)
    with api.session() as s:
        job = s.scalar(select(Job))
        job.status = "succeeded"
        s.get(Post, pid).status = "failed"
        s.commit()
    response = c.get(V1 + "/me/posts")
    item = response.json()["items"][0]
    assert item["status"] == "failed" and len(item["excerpt"]) == 200
    assert response.headers["cache-control"] == "private, no-store"
    assert "Cookie" in response.headers["vary"]
    assert c.get(V1 + "/me/posts/summary").headers["cache-control"] == "private, no-store"


def test_private_analysis_is_not_a_submission_until_contributed_by_ingest(api):
    first, second = api.client("collector"), api.client("renter")
    response = first.post(V1 + "/analyses", json=post_payload("private-analysis", TEXT, external_post_id="assess-shared"))
    assert response.status_code == 202
    pid = response.json()["analysis_id"]
    api.drain()
    assert read(first)["total"] == 0
    assert send(second, "collected-analysis", external_post_id="assess-shared") == pid
    for client in (first, second):
        body = read(client)
        assert body["total"] == 1 and body["items"][0]["post_id"] == pid
        assert body["items"][0]["status"] == "published"


def test_submission_migration_backfills_and_preserves_posts_on_downgrade(database_url):
    cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    command.upgrade(cfg, "0006")
    engine = make_engine(database_url)
    meta = MetaData()
    users = Table("users", meta, autoload_with=engine)
    posts = Table("posts", meta, autoload_with=engine)
    sent = utcnow()
    with engine.begin() as conn:
        conn.execute(users.insert().values(id="u", username="migration", password_hash="test", roles=["renter"],
                                          created_at=sent))
        conn.execute(posts.insert().values(id="p", collector_id="u", source_type="facebook_group", mode="collect",
                                          contributed=True, is_demo=False, status="received", first_seen_at=sent,
                                          last_seen_at=sent))
    command.upgrade(cfg, "head")
    submissions = Table("post_submissions", MetaData(), autoload_with=engine)
    with engine.connect() as conn:
        assert conn.execute(select(submissions)).one() == ("p", "u", sent)
    command.downgrade(cfg, "0006")
    assert "post_submissions" not in inspect(engine).get_table_names()
    with engine.connect() as conn:
        assert conn.execute(select(posts.c.id)).scalars().all() == ["p"]
    command.upgrade(cfg, "head")
    engine.dispose()
