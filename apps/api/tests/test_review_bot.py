"""Shadow bot behaviour with fake LLMs, on both supported database engines."""
import json
from datetime import timedelta
from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import func, inspect, select
from sqlalchemy.exc import IntegrityError

from app import cli
from app.core.db import Base, make_engine
from app.core.ids import utcnow, vn_day_start
from app.models import BotReview, ExtractionRun, Job, Listing, Post, PostVersion, ReviewEvent, User
from app.pipeline import review_bot
from app.pipeline.llm_extractor import LlmFatalError, LlmResponse, LlmTransientError
from app.services import bot_reviews, jobs, maintenance, processing, serialize
from app.worker import run as worker
from tests.conftest import batch, post_payload

# Without a per-person signal this post would now get basis per_unit (CTX_BASIS_UNIT_WHOLE) and be auto_accepted; the
# bot tests need a listing that waits for review because its basis stays unknown, so the post also mentions shared occupancy (ở ghép).
TEXT = "Cho thuê phòng trọ 20m2 giá 3tr/tháng gần chợ Láng, có chỗ ở ghép. LH [SĐT]"
V1 = "/api/v1"


def answer(verdict="approve"):
    return {"verdict": verdict, "confidence": 0.9, "reason": "Giá và vị trí có bằng chứng trong bài đăng.",
            "checks": {
                "rental_offer": {"passed": True, "quote": "Cho thuê phòng trọ"},
                "single_room": {"passed": True, "quote": "phòng trọ"},
                "rent_supported": {"passed": True, "quote": "3tr/tháng"},
                "location_supported": {"passed": True, "quote": "gần chợ Láng"}}}


class FakeLLM:
    model_id = "fake-bot"

    def __init__(self, output=None, error=None):
        self.output = answer() if output is None else output
        self.error = error
        self.prompts = []

    def generate(self, prompt):
        self.prompts.append(prompt)
        if self.error:
            raise self.error
        raw = self.output if isinstance(self.output, str) else json.dumps(self.output, ensure_ascii=False)
        return LlmResponse(text=raw, tokens_in=12, tokens_out=7)


def enable(api, monkeypatch, **overrides):
    for key, value in {"review_bot_enabled": True, "gemini_api_key": "fake-test-only",
                       "gemini_model_id": "fake-bot", **overrides}.items():
        monkeypatch.setattr(api.settings, key, value)


def waiting(api, n=1):
    """Use normal ingest/extraction with the bot off to produce realistic listing fields."""
    client = api.client("collector")
    for index in range(n):
        response = client.post(f"{V1}/ingest/batch", json=batch(post_payload(f"bot-{index}", TEXT + f" Tin {index}")))
        assert response.status_code == 200
    assert api.drain() == n
    with api.session() as session:
        rows = session.scalars(select(Listing).order_by(Listing.id)).all()
        assert len(rows) == n and all(row.review_status == "needs_review" for row in rows)
        return [row.id for row in rows]


def enqueue(api):
    with api.session() as session:
        count = bot_reviews.enqueue_backlog(session, api.settings)
        session.commit()
        return count


def test_verdict_stored_without_touching_listing_or_public_results(api, monkeypatch):
    listing_id = waiting(api)[0]
    reviewer = api.client("reviewer")
    before_detail = reviewer.get(f"{V1}/team/reviews/{listing_id}").json()
    before_public = api.client().get(f"{V1}/listings").json()
    with api.session() as session:
        listing = session.get(Listing, listing_id)
        before = {column.name: getattr(listing, column.name) for column in Listing.__table__.columns}
        before_fields = serialize.listing_dict(listing)
        before_events = session.scalar(select(func.count()).select_from(ReviewEvent))
    enable(api, monkeypatch)
    assert enqueue(api) == 1
    llm = FakeLLM()
    assert api.drain(llm) == 1
    with api.session() as session:
        listing = session.get(Listing, listing_id)
        row = session.scalars(select(BotReview)).one()
        assert row.status == "ok" and row.verdict == "approve" and row.confidence == 0.9
        assert row.listing_id == listing_id and row.listing_version == before["version"]
        assert row.model_id == "fake-bot" and row.prompt_version == "review_bot_v1"
        assert row.checks == answer()["checks"] and row.reason == answer()["reason"]
        assert (row.llm_calls, row.tokens_in, row.tokens_out) == (1, 12, 7)
        assert {column.name: getattr(listing, column.name) for column in Listing.__table__.columns} == before
        assert serialize.listing_dict(listing) == before_fields
        assert session.scalar(select(func.count()).select_from(ReviewEvent)) == before_events
        assert processing.llm_calls_today(session) == 1
    assert reviewer.get(f"{V1}/team/reviews/{listing_id}").json() == before_detail
    assert api.client().get(f"{V1}/listings").json() == before_public
    assert len(llm.prompts) == 1
    payload = json.loads(llm.prompts[0].split("Untrusted input JSON:\n", 1)[1])
    assert TEXT in payload["post_text"] and "[SĐT]" in payload["post_text"]
    assert payload["listing"] == before_fields
    assert payload["review_reasons"] == before["review_reasons"]


@pytest.mark.parametrize("check", list(answer()["checks"]))
def test_ungrounded_quote_becomes_unsure(check):
    output = answer()
    output["checks"][check]["quote"] = "đoạn trích không có trong bài"
    outcome = review_bot.review(TEXT, {"rent": {"amount_vnd": 3000000}}, [], FakeLLM(output))
    assert outcome.status == "ok" and outcome.verdict == "unsure"
    assert "Không tìm thấy trích dẫn" in outcome.reason


@pytest.mark.parametrize("check,value", [("rent_supported", None), ("location_supported", ""),
                                       ("rent_supported", "   ")])
def test_approve_requires_meaningful_grounded_evidence(check, value):
    output = answer()
    output["checks"][check]["quote"] = value
    assert review_bot.review(TEXT, {}, [], FakeLLM(output)).verdict == "unsure"


@pytest.mark.parametrize("verdict", ["reject", "unsure"])
def test_supported_other_verdicts(verdict):
    assert review_bot.review(TEXT, {}, [], FakeLLM(answer(verdict))).verdict == verdict


@pytest.mark.parametrize("output", ["not json", "[]", '{"verdict":"approve"}',
                                   json.dumps(dict(answer(), confidence=2)),
                                   json.dumps(dict(answer(), confidence=float("nan"))),
                                   json.dumps(dict(answer(), reason="   "))])
def test_malformed_answer_is_stored_as_error(api, monkeypatch, output):
    waiting(api)
    enable(api, monkeypatch)
    enqueue(api)
    assert api.drain(FakeLLM(output)) == 1
    with api.session() as session:
        row = session.scalars(select(BotReview)).one()
        assert row.status == "error" and row.error_code == "invalid_output" and row.verdict is None
        assert (row.llm_calls, row.tokens_in, row.tokens_out) == (1, 12, 7)
        assert session.scalar(select(Job.status).where(Job.kind == "bot_review")) == "succeeded"


@pytest.mark.parametrize("enabled,key", [(False, "fake-test-only"), (True, "")])
def test_disabled_or_no_key_enqueues_nothing_and_calls_nothing(api, monkeypatch, enabled, key):
    enable(api, monkeypatch, review_bot_enabled=enabled, gemini_api_key=key)
    client = api.client("collector")
    assert client.post(f"{V1}/ingest/batch", json=batch(post_payload("off", TEXT))).status_code == 200
    # Extraction is deliberately regex only; no bot client should ever be made.
    assert api.drain() == 1
    assert enqueue(api) == 0
    with api.session() as session:
        assert session.scalar(select(func.count()).select_from(Job).where(Job.kind == "bot_review")) == 0
        version_id = session.scalar(select(Post.current_version_id))
        jobs.enqueue(session, kind="bot_review", post_version_id=version_id)
        session.commit()
    llm = FakeLLM()
    assert api.drain(llm) == 1 and llm.prompts == []
    with api.session() as session:
        assert session.scalar(select(func.count()).select_from(BotReview)) == 0


def test_processing_enqueues_bot_and_repeated_enqueue_never_reviews_twice(api, monkeypatch):
    enable(api, monkeypatch)
    client = api.client("collector")
    assert client.post(f"{V1}/ingest/batch", json=batch(post_payload("auto", TEXT))).status_code == 200
    assert worker.run_one(api.settings, None, "extractor")
    with api.session() as session:
        job = session.scalars(select(Job).where(Job.kind == "bot_review")).one()
        assert job.status == "queued"
        version_id = job.post_version_id
        assert bot_reviews.enqueue_backlog(session, api.settings) == 0
    llm = FakeLLM()
    assert api.drain(llm) == 1
    with api.session() as session:
        jobs.enqueue(session, kind="bot_review", post_version_id=version_id)
        jobs.enqueue(session, kind="bot_review", post_version_id=version_id)
        session.commit()
    assert api.drain(llm) == 2 and len(llm.prompts) == 1
    assert enqueue(api) == 0
    with api.session() as session:
        row = session.scalars(select(BotReview)).one()
        session.add(BotReview(listing_id=row.listing_id, listing_version=1, model_id="other-model",
                              prompt_version=row.prompt_version, status="ok", verdict="reject", reason="Trùng"))
        with pytest.raises(IntegrityError):
            session.flush()


@pytest.mark.parametrize("budget,error_code", [("llm_daily_call_limit", "llm_daily_limit"),
                                               ("review_bot_daily_call_limit", "review_bot_daily_limit")])
def test_budget_defers_to_next_vietnam_day_and_keeps_partial_results(api, monkeypatch, budget, error_code):
    listing_id = waiting(api)[0]
    with api.session() as session:
        original = session.get(Listing, listing_id)
        second = Listing(run_id=original.run_id, post_id=original.post_id, listing_index=1,
                         review_status="needs_review", observed_at=original.observed_at)
        second.fields = serialize.field_rows(serialize.listing_dict(original))
        session.add(second)
        session.commit()
    enable(api, monkeypatch, **{budget: 1})
    assert enqueue(api) == 1
    llm = FakeLLM()
    assert api.drain(llm) == 1 and len(llm.prompts) == 1
    with api.session() as session:
        job = session.scalars(select(Job).where(Job.kind == "bot_review")).one()
        assert job.status == "queued" and job.attempt == 0 and job.error_code == error_code
        assert job.run_after == vn_day_start() + timedelta(days=1)
        assert session.scalar(select(func.count()).select_from(BotReview)) == 1
        assert processing.llm_calls_today(session) == 1
        session.scalars(select(BotReview)).one().created_at = vn_day_start() - timedelta(seconds=1)
        job.run_after = utcnow() - timedelta(seconds=1)
        session.commit()
    assert api.drain(llm) == 1 and len(llm.prompts) == 2
    with api.session() as session:
        assert session.scalar(select(func.count()).select_from(BotReview)) == 2
        assert session.scalar(select(Job.status).where(Job.kind == "bot_review")) == "succeeded"


def test_global_extraction_calls_also_defer_bot(api, monkeypatch):
    waiting(api)
    enable(api, monkeypatch, llm_daily_call_limit=1)
    with api.session() as session:
        session.scalars(select(ExtractionRun)).one().llm_calls = 1
        session.commit()
    enqueue(api)
    llm = FakeLLM()
    assert api.drain(llm) == 1 and llm.prompts == []
    with api.session() as session:
        job = session.scalars(select(Job).where(Job.kind == "bot_review")).one()
        assert job.status == "queued" and job.error_code == "llm_daily_limit"
        assert job.run_after == vn_day_start() + timedelta(days=1)


def test_bot_cap_does_not_throttle_extraction_or_analysis_and_jobs_have_priority(api, monkeypatch):
    waiting(api)
    enable(api, monkeypatch, review_bot_daily_call_limit=1, llm_daily_call_limit=0)
    enqueue(api)
    client = api.client("collector")
    assert client.post(f"{V1}/ingest/batch", json=batch(post_payload("later", TEXT + " Bài mới"))).status_code == 200
    with api.session() as session:
        picked = jobs.claim(session, "priority-test", 120)
        assert picked.kind == "extract"
        processing.process_job(session, picked, llm=None, settings=api.settings)
        session.commit()
    llm = FakeLLM()
    assert api.drain(llm) == 2 and len(llm.prompts) == 1
    # A spent bot allowance must not be passed into client_for for non-bot jobs.
    from tests.test_open_ingest import NeedyLLM
    extraction_llm = NeedyLLM()
    assert client.post(f"{V1}/ingest/batch", json=batch(post_payload("extract-after", "Cho thuê phòng trọ giá 3tr/tháng gần ga"))).status_code == 200
    renter = api.client("renter")
    response = renter.post(f"{V1}/analyses", json=post_payload("assess-after", "Cho thuê phòng trọ giá 3tr/tháng gần trường"))
    assert response.status_code == 202
    assert api.drain(extraction_llm) >= 2 and extraction_llm.calls == 2
    with api.session() as session:
        assert not session.scalars(select(Job).where(Job.kind != "bot_review", Job.status != "succeeded")).all()
        assert all(post.status == "extracted" for post in session.scalars(select(Post)))


@pytest.mark.parametrize("error,retryable", [(LlmTransientError("http_429"), True),
                                             (LlmFatalError("http_400"), False)])
def test_provider_errors_are_recorded_and_temporary_errors_retry(api, monkeypatch, error, retryable):
    waiting(api)
    enable(api, monkeypatch, job_max_attempts=2)
    enqueue(api)
    llm = FakeLLM(error=error)
    assert api.drain(llm) == 1
    with api.session() as session:
        row = session.scalars(select(BotReview)).one()
        assert row.status == "error" and row.error_code == error.code and row.llm_calls == 1
        job = session.scalars(select(Job).where(Job.kind == "bot_review")).one()
        assert job.status == ("queued" if retryable else "succeeded")
        assert session.scalars(select(Post)).one().status == "extracted"
        if retryable:
            assert job.attempt == 1 and job.run_after > utcnow()
            job.run_after = utcnow() - timedelta(seconds=1)
            session.commit()
    if retryable:
        assert api.drain(llm) == 1
        with api.session() as session:
            assert session.scalar(select(func.count()).select_from(BotReview)) == 2
            assert processing.llm_calls_today(session) == 2
            assert session.scalar(select(Job.status).where(Job.kind == "bot_review")) == "failed"
            assert session.scalars(select(Post)).one().status == "extracted"


def test_backlog_cli_limit_and_idempotence(api, monkeypatch, capsys):
    waiting(api, n=3)
    enable(api, monkeypatch)
    cli.main(["bot-review-backlog", "--limit", "1"])
    assert "1 công việc" in capsys.readouterr().out
    with api.session() as session:
        assert session.scalar(select(func.count()).select_from(Job).where(Job.kind == "bot_review")) == 1
    cli.main(["bot-review-backlog", "--limit", "1"])
    assert "1 công việc" in capsys.readouterr().out
    cli.main(["bot-review-backlog"])
    assert "1 công việc" in capsys.readouterr().out
    cli.main(["bot-review-backlog"])
    assert "0 công việc" in capsys.readouterr().out
    llm = FakeLLM()
    assert api.drain(llm) == 3 and len(llm.prompts) == 3
    cli.main(["bot-review-backlog"])
    assert "0 công việc" in capsys.readouterr().out
    with pytest.raises(SystemExit, match="số nguyên dương"):
        cli.main(["bot-review-backlog", "--limit", "0"])


def test_summary_and_pagination_compare_exact_snapshot_and_ignore_merge(api, monkeypatch):
    listing_ids = waiting(api, n=5)
    with api.session() as session:
        reviewer_id = session.scalar(select(User.id).where(User.username == "reviewer"))
        for listing_id, verdict, human in zip(listing_ids, ["approve", "reject", "approve", "unsure", "approve"],
                                               ["approve", "reject", "reject", None, "merge"]):
            session.add(BotReview(listing_id=listing_id, listing_version=1, model_id="fake-bot",
                                  prompt_version="review_bot_v1", status="ok", verdict=verdict,
                                  confidence=0.9, reason="Dữ liệu kiểm thử", created_at=utcnow() - timedelta(seconds=10)))
            if human:
                session.add(ReviewEvent(listing_id=listing_id, user_id=reviewer_id, action=human,
                                        before_json={"version": 1}, after_json={}))
        session.add(BotReview(listing_id=listing_ids[0], listing_version=1, model_id="fake-bot",
                              prompt_version="old_prompt", status="error", reason="Lỗi kiểm thử"))
        session.commit()
    reviewer = api.client("reviewer")
    body = reviewer.get(f"{V1}/team/bot-reviews/summary").json()
    assert body == {"enabled": False, "by_status": {"ok": 5, "error": 1},
                    "by_verdict": {"approve": 3, "reject": 1, "unsure": 1},
                    "compared": 3, "agreed": 2, "agreement_rate": 2 / 3,
                    "bot_approve_human_reject": 1, "bot_reject_human_approve": 0, "unsure_share": 1 / 5}
    admin = api.client("admin")
    rows = admin.get(f"{V1}/team/bot-reviews?page=1&page_size=2").json()
    assert rows["total"] == 6 and len(rows["items"]) == 2 and rows["page"] == 1
    all_rows = admin.get(f"{V1}/team/bot-reviews").json()["items"]
    assert sorted(row["human_decision"] for row in all_rows if row["human_decision"]) == ["approve", "reject", "reject"]
    assert all(row["listing_id"] in listing_ids and row["reason"] and row["created_at"] for row in all_rows)
    assert admin.get(f"{V1}/team/bot-reviews?page=0").status_code == 422
    assert admin.get(f"{V1}/team/bot-reviews?page=5").json()["items"] == []


def test_summary_empty_and_authorization(api):
    for path in ("team/bot-reviews", "team/bot-reviews/summary"):
        assert api.client("renter").get(f"{V1}/{path}").status_code == 403
        assert api.client("collector").get(f"{V1}/{path}").status_code == 403
        assert api.client().get(f"{V1}/{path}").status_code == 401
        assert api.client("admin").get(f"{V1}/{path}").status_code == 200
    summary = api.client("reviewer").get(f"{V1}/team/bot-reviews/summary").json()
    assert summary["compared"] == summary["agreed"] == 0
    assert summary["agreement_rate"] is None and summary["unsure_share"] is None


def test_human_decision_api_pairs_version_and_bot_reject_human_approve(api, monkeypatch):
    listing_id = waiting(api)[0]
    enable(api, monkeypatch)
    enqueue(api)
    assert api.drain(FakeLLM(answer("reject"))) == 1
    response = api.client("reviewer").post(f"{V1}/team/reviews/{listing_id}/decision",
                                          json={"action": "approve", "expected_version": 1})
    assert response.status_code == 200
    with api.session() as session:
        assert session.scalars(select(ReviewEvent)).one().before_json["version"] == 1
        body = bot_reviews.summary(session, api.settings)
        assert body["compared"] == 1 and body["bot_reject_human_approve"] == 1
        assert body["agreed"] == 0


def test_other_version_and_prior_human_decisions_do_not_compare(api):
    listing_id = waiting(api)[0]
    with api.session() as session:
        reviewer_id = session.scalar(select(User.id).where(User.username == "reviewer"))
        now = utcnow()
        session.add(BotReview(listing_id=listing_id, listing_version=2, model_id="fake-bot",
                              prompt_version="review_bot_v1", status="ok", verdict="approve",
                              reason="Kiểm thử phiên bản", created_at=now))
        session.add_all([
            ReviewEvent(listing_id=listing_id, user_id=reviewer_id, action="approve",
                        before_json={"version": 1}, created_at=now + timedelta(seconds=1)),
            ReviewEvent(listing_id=listing_id, user_id=reviewer_id, action="reject",
                        before_json={"version": 2}, created_at=now - timedelta(seconds=1))])
        session.commit()
        body = bot_reviews.summary(session, api.settings)
        assert body["compared"] == 0 and body["agreement_rate"] is None
        assert bot_reviews.page(session)["items"][0]["human_decision"] is None


def test_new_prompt_can_review_again_and_unsure_counts_in_comparison(api, monkeypatch):
    listing_id = waiting(api)[0]
    enable(api, monkeypatch)
    enqueue(api)
    llm = FakeLLM()
    assert api.drain(llm) == 1
    with api.session() as session:
        session.scalars(select(BotReview)).one().created_at = utcnow() - timedelta(seconds=10)
        session.commit()
    monkeypatch.setattr(review_bot, "prompt_version", lambda: "review_bot_v2_test")
    assert enqueue(api) == 1
    llm.output = answer("unsure")
    assert api.drain(llm) == 1 and len(llm.prompts) == 2
    response = api.client("reviewer").post(f"{V1}/team/reviews/{listing_id}/decision",
                                          json={"action": "approve", "expected_version": 1})
    assert response.status_code == 200
    with api.session() as session:
        body = bot_reviews.summary(session, api.settings)
        assert body["by_status"]["ok"] == 2 and body["compared"] == 1 and body["agreed"] == 0
        assert body["agreement_rate"] == 0 and body["unsure_share"] == 0.5


def test_automatically_accepted_listing_has_no_bot_job(api, monkeypatch):
    from tests.test_llm import F01, F01_LLM, FakeLLM as ExtractorLLM

    enable(api, monkeypatch)
    assert api.client("collector").post(f"{V1}/ingest/batch", json=batch(post_payload("accepted", F01))).status_code == 200
    assert api.drain(ExtractorLLM(F01_LLM)) == 1
    with api.session() as session:
        assert session.scalars(select(Listing)).one().review_status == "auto_accepted"
        assert session.scalar(select(func.count()).select_from(Job).where(Job.kind == "bot_review")) == 0


def test_zero_bot_cap_does_not_limit_calls(api, monkeypatch):
    waiting(api, n=2)
    enable(api, monkeypatch, review_bot_daily_call_limit=0, llm_daily_call_limit=0)
    assert enqueue(api) == 2
    llm = FakeLLM()
    assert api.drain(llm) == 2 and len(llm.prompts) == 2


def test_old_version_and_nonpending_listing_are_not_reviewed(api, monkeypatch):
    listing_id = waiting(api)[0]
    enable(api, monkeypatch)
    enqueue(api)
    with api.session() as session:
        listing = session.get(Listing, listing_id)
        listing.review_status = "approved"
        session.commit()
    llm = FakeLLM()
    assert api.drain(llm) == 1 and llm.prompts == []
    with api.session() as session:
        listing = session.get(Listing, listing_id)
        listing.review_status = "needs_review"
        version_id = listing.run.post_version_id
        jobs.enqueue(session, kind="bot_review", post_version_id=version_id)
        post = listing.post
        version = PostVersion(post_id=post.id, text=TEXT + " Đã sửa", text_hash="new-hash")
        session.add(version)
        session.flush()
        post.current_version_id = version.id
        session.commit()
    assert api.drain(llm) == 1 and llm.prompts == []
    assert enqueue(api) == 0


def test_bot_model_override_and_fallback(api, monkeypatch):
    enable(api, monkeypatch)
    fake = FakeLLM()
    assert worker.bot_client(api.settings, fake) is fake
    captured = []
    monkeypatch.setattr(worker, "make_llm", lambda settings: captured.append(settings.gemini_model_id) or fake)
    monkeypatch.setattr(api.settings, "review_bot_model_id", "review-model")
    assert worker.bot_client(api.settings, fake) is fake and captured == ["review-model"]
    assert api.settings.gemini_model_id == "fake-bot"


def test_migration_0005_up_down_matches_models_and_preserves_data(database_url):
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    engine = make_engine(database_url)
    def include_bot_table(obj, name, type_, reflected, compare_to):
        if type_ == "table":
            return name == "bot_reviews"
        return getattr(obj, "table", None) is None or obj.table.name == "bot_reviews"

    # SQLite's historical users unique indexes differ from ORM unique constraints.
    # This migration changes only bot_reviews; PostgreSQL also has a full-schema parity test.
    parity_options = {"compare_server_default": True, "include_object": include_bot_table}
    try:
        command.upgrade(config, "0004")
        with engine.begin() as connection:
            connection.execute(User.__table__.insert().values(id="existing", username="existing",
                               password_hash="test-hash", roles=["renter"], created_at=utcnow(), auth_version=0))
        command.upgrade(config, "0005")
        with engine.connect() as connection:
            assert compare_metadata(MigrationContext.configure(connection, opts=parity_options),
                                    Base.metadata) == []
            assert connection.execute(select(User.username)).scalar_one() == "existing"
        command.downgrade(config, "0004")
        assert "bot_reviews" not in inspect(engine).get_table_names()
        with engine.connect() as connection:
            assert connection.execute(select(User.username)).scalar_one() == "existing"
        command.upgrade(config, "head")
        with engine.connect() as connection:
            assert compare_metadata(MigrationContext.configure(connection, opts=parity_options), Base.metadata) == []
    finally:
        engine.dispose()


def test_removing_post_cascades_bot_reviews(api, monkeypatch):
    listing_id = waiting(api)[0]
    enable(api, monkeypatch)
    enqueue(api)
    api.drain(FakeLLM())
    with api.session() as session:
        post_id = session.get(Listing, listing_id).post_id
        assert maintenance.remove_post(session, post_id)
        session.commit()
        assert session.scalar(select(func.count()).select_from(BotReview)) == 0


def test_slow_bot_releases_transaction_for_other_session_write(api, monkeypatch):
    import threading
    from sqlalchemy import update

    listing_id = waiting(api)[0]
    enable(api, monkeypatch)
    enqueue(api)
    with api.session() as session:
        version_id = session.get(Listing, listing_id).run.post_version_id
    entered, release, written = threading.Event(), threading.Event(), threading.Event()
    errors = []

    class SlowLLM(FakeLLM):
        def generate(self, prompt):
            entered.set()
            assert release.wait(8), "Test did not release the model"
            return super().generate(prompt)

    def run_bot():
        try:
            worker.run_one(api.settings, SlowLLM(), "slow-bot")
        except Exception as error:
            errors.append(error)

    def write():
        try:
            with api.session() as session:
                # The same row was locked by the old bot on PostgreSQL; SQLite locks all writes.
                session.execute(update(PostVersion).where(PostVersion.id == version_id)
                                .values(text_complete=True))
                session.commit()
            written.set()
        except Exception as error:
            errors.append(error)

    bot = threading.Thread(target=run_bot)
    writer = threading.Thread(target=write)
    bot.start()
    try:
        assert entered.wait(5)
        writer.start()
        completed_during_call = written.wait(2)
    finally:
        release.set()
        bot.join(8)
        if writer.ident is not None:
            writer.join(8)
    assert not bot.is_alive() and not writer.is_alive() and not errors
    assert completed_during_call, "The model call held a database write lock"
    with api.session() as session:
        assert session.scalar(select(func.count()).select_from(BotReview).where(BotReview.status == "ok")) == 1


def test_one_bot_claim_handles_one_listing_then_yields_to_extraction(api, monkeypatch):
    listing_id = waiting(api)[0]
    with api.session() as session:
        original = session.get(Listing, listing_id)
        second = Listing(run_id=original.run_id, post_id=original.post_id, listing_index=1,
                         review_status="needs_review", observed_at=original.observed_at)
        second.fields = serialize.field_rows(serialize.listing_dict(original))
        session.add(second)
        session.commit()
    enable(api, monkeypatch, review_bot_daily_call_limit=0, llm_daily_call_limit=0)
    assert enqueue(api) == 1
    llm = FakeLLM()
    assert worker.run_one(api.settings, llm, "one-listing")
    assert len(llm.prompts) == 1
    with api.session() as session:
        assert session.scalar(select(func.count()).select_from(BotReview)) == 1
        job = session.scalars(select(Job).where(Job.kind == "bot_review")).one()
        assert job.status == "queued" and job.attempt == 0
    assert api.client("collector").post(f"{V1}/ingest/batch", json=batch(
        post_payload("priority-between-bot-listings", TEXT))).status_code == 200
    with api.session() as session:
        picked = jobs.claim(session, "interleaved-extractor", 120)
        assert picked.kind == "extract"
        processing.process_job(session, picked, llm=None, settings=api.settings)
        session.commit()
    assert worker.run_one(api.settings, llm, "next-listing")
    assert len(llm.prompts) == 2


def test_bot_ignores_demo_jobs_and_excludes_historical_demo_summary(api, monkeypatch):
    listing_id = waiting(api)[0]
    with api.session() as session:
        listing = session.get(Listing, listing_id)
        listing.post.is_demo = True
        version_id = listing.run.post_version_id
        session.add(BotReview(listing_id=listing_id, listing_version=1, model_id="old-bot",
                              prompt_version="old-prompt", status="ok", verdict="approve", reason="Kiểm thử"))
        jobs.enqueue(session, kind="bot_review", post_version_id=version_id)
        session.commit()
    enable(api, monkeypatch)
    assert enqueue(api) == 0
    llm = FakeLLM()
    assert api.drain(llm) == 1 and llm.prompts == []
    with api.session() as session:
        body = bot_reviews.summary(session, api.settings)
        assert body["by_status"] == {"ok": 0, "error": 0}
        assert body["by_verdict"] == {"approve": 0, "reject": 0, "unsure": 0}
        assert body["compared"] == body["agreed"] == 0 and body["unsure_share"] is None


def test_reviewer_cannot_read_per_listing_bot_verdicts(api):
    assert api.client("reviewer").get(f"{V1}/team/bot-reviews").status_code == 403
    assert api.client("reviewer").get(f"{V1}/team/bot-reviews/summary").status_code == 200
    assert api.client("admin").get(f"{V1}/team/bot-reviews").status_code == 200


@pytest.mark.parametrize("stored,quote,expected", [
    (3000000, "3tr/tháng", "approve"), (4000000, "3tr/tháng", "unsure"),
    (None, "3tr/tháng", "unsure"), (4000000, "3", "approve"),
    (3000000, "Cho thuê phòng trọ", "approve")])
def test_rent_quote_must_match_stored_amount_when_parseable(stored, quote, expected):
    output = answer()
    output["checks"]["rent_supported"]["quote"] = quote
    result = review_bot.review(TEXT, {"rent": {"amount_vnd": stored}}, [], FakeLLM(output))
    assert result.verdict == expected
    if expected == "unsure":
        assert "giá đang lưu" in result.reason


def test_bot_timeout_has_own_setting_and_is_passed_to_real_client(api, monkeypatch):
    from app.core.config import Settings
    from app.pipeline.llm_client import GeminiClient

    assert Settings(_env_file=None).review_bot_timeout_seconds == 20
    enable(api, monkeypatch, review_bot_timeout_seconds=7, llm_timeout_seconds=45)
    captured = []
    monkeypatch.setattr(worker, "make_llm", lambda settings: captured.append(
        (settings.gemini_model_id, settings.llm_timeout_seconds)) or FakeLLM())
    client = GeminiClient("fake-key", "fake-bot", timeout=45)
    try:
        assert worker.bot_client(api.settings, client).model_id == "fake-bot"
        assert captured == [("fake-bot", 7)]
        assert api.settings.llm_timeout_seconds == 45
    finally:
        client._http.close()


def test_concurrent_duplicate_bot_jobs_store_only_one_ok(api, monkeypatch):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    listing_id = waiting(api)[0]
    enable(api, monkeypatch)
    enqueue(api)
    with api.session() as session:
        version_id = session.get(Listing, listing_id).run.post_version_id
        jobs.enqueue(session, kind="bot_review", post_version_id=version_id)
        session.commit()
        first = jobs.claim(session, "duplicate-first", 120).id
        second = jobs.claim(session, "duplicate-second", 120).id
    barrier = Barrier(2)

    class TogetherLLM(FakeLLM):
        def generate(self, prompt):
            barrier.wait(timeout=8)
            return super().generate(prompt)

    def process(job_id):
        with api.session() as session:
            bot_reviews.process_job(session, session.get(Job, job_id), llm=TogetherLLM(), settings=api.settings)
            session.commit()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(process, [first, second]))
    assert results == [None, None]
    with api.session() as session:
        assert session.scalar(select(func.count()).select_from(BotReview).where(BotReview.status == "ok")) == 1
        assert session.scalar(select(func.count()).select_from(BotReview).where(
            BotReview.error_code == "review_superseded")) == 1
        assert processing.llm_calls_today(session) == 2
        assert all(job.status == "succeeded" for job in session.scalars(select(Job)))
    assert api.drain(FakeLLM()) == 0


def test_terminal_errors_advance_to_other_listing_without_looping(api, monkeypatch):
    listing_id = waiting(api)[0]
    with api.session() as session:
        original = session.get(Listing, listing_id)
        second = Listing(run_id=original.run_id, post_id=original.post_id, listing_index=1,
                         review_status="needs_review", observed_at=original.observed_at)
        second.fields = serialize.field_rows(serialize.listing_dict(original))
        session.add(second)
        session.commit()
    enable(api, monkeypatch)
    assert enqueue(api) == 1
    llm = FakeLLM("invalid JSON")
    assert api.drain(llm) == 2 and len(llm.prompts) == 2
    with api.session() as session:
        rows = session.scalars(select(BotReview)).all()
        assert len(rows) == 2 and all(row.error_code == "invalid_output" for row in rows)
        assert session.scalar(select(Job.status).where(Job.kind == "bot_review")) == "succeeded"
    # A later, explicitly enqueued backlog may try terminal errors again, even in the same second.
    assert enqueue(api) == 1
    assert api.drain(FakeLLM()) == 2
