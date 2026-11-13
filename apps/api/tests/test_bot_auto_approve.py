"""Opt-in publication gates, using synthetic text and fake model responses only."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from sqlalchemy import func, select

from app.core.config import Settings
from app.core.ids import vn_day_start
from app.models import BotReview, Job, Listing, ReviewEvent, User
from app.pipeline.engine import run_pipeline
from app.services import bot_reviews, serialize
from app.services.reviews import BOT_USER_ID
from app.worker import run as worker
from tests.test_review_bot import FakeLLM, V1, answer, enable, enqueue, waiting
from tests.test_llm import FakeLLM as ExtractLLM, spans


def ready(api, monkeypatch, n=1, **settings):
    ids = waiting(api, n)
    with api.session() as session:
        for listing_id in ids:
            listing = session.get(Listing, listing_id)
            listing.post.current_version.text += " Phường Thủ Dầu Một"
            fields = serialize.listing_dict(listing)
            fields["rent"].update(agreement="llm_only", decision="needs_review", basis="per_unit", period="month")
            fields["location"].update(ward_code="25747", ward_name="Phường Thủ Dầu Một",
                                      resolution="exact", decision="answered")
            listing.fields = serialize.field_rows(fields)
            for key, value in serialize.lookup_columns(fields).items():
                setattr(listing, key, value)
            listing.review_reasons = ["rent_llm_only"]
            listing.post.contributed = True
        session.commit()
    enable(api, monkeypatch, review_bot_auto_approve=True, **settings)
    return ids


def output():
    result = answer()
    result["confidence"] = 1.0
    result["checks"]["location_supported"]["quote"] = "Phường Thủ Dầu Một"
    return result


def run(api, result=None):
    enqueue(api)
    llm = FakeLLM(output() if result is None else result)
    api.drain(llm)
    return llm


def test_defaults_are_off_and_cap_is_200():
    settings = Settings(_env_file=None)
    assert settings.review_bot_auto_approve is False
    assert settings.review_bot_auto_approve_daily_limit == 200


def test_real_llm_only_price_gets_explicit_queue_reason():
    text = "Cho thuê phòng trọ 20m2. Chi phí: 3tr/tháng/phòng. Phường Thủ Dầu Một"
    result = run_pipeline(text, mode="eval_llm", llm=ExtractLLM({"post_type": "rental_offer", "spans": spans(
        (0, "ROOM", "phòng trọ"), (0, "AREA", "20m2"), (0, "PRICE", "3tr/tháng/phòng"),
        (0, "LOC", "Phường Thủ Dầu Một"))}))
    assert result.listing_meta[0].review_status == "needs_review"
    assert result.listing_meta[0].review_reasons == ["rent_llm_only"]


def test_publishes_with_audit_summary_and_human_undo(api, monkeypatch):
    listing_id = ready(api, monkeypatch)[0]
    with api.session() as session:
        before = serialize.listing_dict(session.get(Listing, listing_id))
    llm = run(api)
    assert len(llm.prompts) == 1
    reviewer = api.client("reviewer")
    detail = reviewer.get(f"{V1}/team/reviews/{listing_id}").json()
    assert detail["review_status"] == "approved" and detail["version"] == 2
    assert detail["listing"] == dict(before, review_status="approved")
    assert detail["history"][0]["source"] == "bot"
    assert detail["history"][0]["user_id"] == BOT_USER_ID
    assert detail["history"][0]["reason"].startswith("Bot đã duyệt")
    assert reviewer.get(f"{V1}/team/reviews").json()["total"] == 0
    queue = reviewer.get(f"{V1}/team/reviews?status=bot_approved").json()
    assert queue["total"] == 1 and queue["items"][0]["bot_approved"] is True
    public = api.client().get(f"{V1}/listings").json()
    assert api.settings.demo_mode is False and public["total"] == 1
    assert public["items"][0]["listing_id"] == listing_id
    summary = api.client("admin").get(f"{V1}/team/bot-reviews/summary").json()
    assert summary["auto_approved_today"] == 1 and summary["auto_approve_daily_limit"] == 200
    assert summary["compared"] == 0  # Bot decisions are not human agreement labels.
    saved = reviewer.post(f"{V1}/team/reviews/{listing_id}/decision", json={"action": "undo", "expected_version": 2})
    assert saved.status_code == 200 and saved.json()["review_status"] == "needs_review"
    assert api.client().get(f"{V1}/listings").json()["total"] == 0
    assert reviewer.get(f"{V1}/team/reviews").json()["total"] == 1
    assert reviewer.get(f"{V1}/team/reviews?status=bot_approved").json()["total"] == 0
    assert reviewer.post(f"{V1}/team/reviews/{listing_id}/decision", json={"action": "undo", "expected_version": 2}).status_code == 409
    with api.session() as session:
        assert bot_reviews.auto_approved_today(session) == 1
        assert session.scalar(select(func.count()).select_from(ReviewEvent)) == 2
        actor = session.get(User, BOT_USER_ID)
        assert actor.roles == [] and actor.password_hash == "!"
    assert enqueue(api) == 0  # Undo cannot start another approval loop.


@pytest.mark.parametrize("gate", [
    "flag_off", "bot_off", "confidence", "reject", "unsure", "invalid_json", "citation", "failed_check",
    "missing_check_quote", "money_mismatch", "unparseable_money", "quote_period", "quote_basis",
    "multiple_units", "price_missing", "price_zero", "price_range", "price_hidden", "period", "basis",
    "room_unknown", "ward_missing", "ward_outside", "ward_unresolved", "province_in_text",
    "former_ward_split", "outside_hcm_province", "multi_listing", "conflict", "unknown_reason",
    "empty_reasons", "missing_ward", "blocked_sender", "sender_roles_removed", "demo", "cap_zero",
    "other_field_unresolved", "wrong_price_source", "stale_during_call", "human_during_call", "identity_collision",
])
def test_each_gate_keeps_listing_in_human_queue(api, monkeypatch, gate):
    listing_id = ready(api, monkeypatch)[0]
    result = output()
    if gate in ("flag_off", "bot_off", "cap_zero"):
        monkeypatch.setattr(api.settings, {"flag_off": "review_bot_auto_approve", "bot_off": "review_bot_enabled",
                                          "cap_zero": "review_bot_auto_approve_daily_limit"}[gate], False if gate != "cap_zero" else 0)
    if gate == "confidence": result["confidence"] = 0.999
    if gate in ("reject", "unsure"): result["verdict"] = gate
    if gate == "invalid_json": result = "invalid"
    if gate == "citation": result["checks"]["rental_offer"]["quote"] = "Invented synthetic quote"
    if gate == "failed_check": result["checks"]["single_room"]["passed"] = False
    if gate == "missing_check_quote": result["checks"]["single_room"]["quote"] = None
    if gate == "unparseable_money": result["checks"]["rent_supported"]["quote"] = "3"
    if gate in ("quote_period", "quote_basis"):
        result["checks"]["rent_supported"]["quote"] = "3tr/ngày" if gate == "quote_period" else "3tr/tháng/người"
    with api.session() as session:
        listing = session.get(Listing, listing_id)
        fields = serialize.listing_dict(listing)
        if gate == "money_mismatch": fields["rent"]["amount_vnd"] = 4000000
        rent_changes = {"price_missing": {"amount_vnd": None}, "price_zero": {"amount_vnd": 0},
                        "price_range": {"amount_form": "range"}, "price_hidden": {"visibility": "hidden_explicit"},
                        "period": {"period": "day"}, "basis": {"basis": "unknown"},
                        "wrong_price_source": {"agreement": "regex_only"}}
        fields["rent"].update(rent_changes.get(gate, {}))
        if gate == "room_unknown": fields["room"]["property_type"] = "unknown"
        if gate == "ward_missing": fields["location"]["ward_code"] = None
        if gate == "ward_outside": fields["location"]["ward_code"] = "00000"
        if gate == "ward_unresolved": fields["location"]["resolution"] = "unresolved"
        if gate == "province_in_text": listing.post.current_version.text += " tỉnh Nghệ An"
        if gate in ("quote_period", "quote_basis"): listing.post.current_version.text += " " + result["checks"]["rent_supported"]["quote"]
        if gate in ("former_ward_split", "outside_hcm_province", "multi_listing", "conflict", "unknown_reason", "missing_ward"):
            listing.review_reasons = ["rent_llm_only", gate]
        if gate == "empty_reasons": listing.review_reasons = []
        if gate == "other_field_unresolved": fields["area"]["decision"] = "needs_review"
        if gate == "demo": listing.post.is_demo = True
        if gate in ("blocked_sender", "sender_roles_removed"):
            sender = session.get(User, listing.post.collector_id)
            sender.roles = ["collector", "blocked"] if gate == "blocked_sender" else []
        listing.fields = serialize.field_rows(fields)
        if gate == "multiple_units":
            second = Listing(run_id=listing.run_id, post_id=listing.post_id, listing_index=1,
                             review_status="needs_review", observed_at=listing.observed_at)
            second.fields = serialize.field_rows(fields)
            session.add(second)
        if gate == "identity_collision":
            session.add(User(username="review-bot", password_hash="registered-test-user", roles=["renter"]))
        session.commit()
        before = serialize.listing_dict(listing)
    if gate in ("stale_during_call", "human_during_call"):
        class ChangedLLM(FakeLLM):
            def generate(self, prompt):
                with api.session() as session:
                    row = session.get(Listing, listing_id)
                    row.version += 1
                    if gate == "human_during_call": row.review_status = "rejected"
                    session.commit()
                return super().generate(prompt)
        enqueue(api)
        api.drain(ChangedLLM(result))
    else:
        run(api, result)
    with api.session() as session:
        listing = session.get(Listing, listing_id)
        assert listing.review_status == ("rejected" if gate == "human_during_call" else "needs_review")
        assert serialize.listing_dict(listing) == dict(before, review_status=listing.review_status)
        assert session.scalar(select(func.count()).select_from(ReviewEvent)) == 0
        assert bot_reviews.auto_approved_today(session) == 0


def test_cap_stops_next_approval_and_identity_is_idempotent(api, monkeypatch):
    ready(api, monkeypatch, n=3, review_bot_auto_approve_daily_limit=2)
    run(api)
    with api.session() as session:
        assert bot_reviews.auto_approved_today(session) == 2
        assert session.scalar(select(func.count()).select_from(User).where(User.id == BOT_USER_ID)) == 1
        assert session.scalar(select(func.count()).select_from(Listing).where(Listing.review_status == "needs_review")) == 1
        assert session.scalar(select(func.count()).select_from(BotReview)) == 3


def test_two_workers_share_one_remaining_slot(api, monkeypatch):
    ready(api, monkeypatch, n=2, review_bot_auto_approve_daily_limit=1)
    enqueue(api)
    barrier = Barrier(2)
    class TogetherLLM(FakeLLM):
        def generate(self, prompt):
            barrier.wait(timeout=10)
            return super().generate(prompt)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda owner: worker.run_one(api.settings, TogetherLLM(output()), owner), ["bot-a", "bot-b"]))
    assert results == [True, True]
    with api.session() as session:
        assert bot_reviews.auto_approved_today(session) == 1
        assert session.scalar(select(func.count()).select_from(BotReview)) == 2


def test_cap_uses_vietnam_day_and_undo_does_not_refund(api, monkeypatch):
    listing_id = ready(api, monkeypatch)[0]
    run(api)
    with api.session() as session:
        event = session.scalars(select(ReviewEvent)).one()
        event.created_at = vn_day_start()
        session.flush()
        assert bot_reviews.auto_approved_today(session) == 1
        from datetime import timedelta
        event.created_at -= timedelta(seconds=1)
        session.flush()
        assert bot_reviews.auto_approved_today(session) == 0


def test_human_decision_cannot_be_undone_as_bot_and_permissions_apply(api, monkeypatch):
    listing_id = ready(api, monkeypatch)[0]
    run(api)
    path = f"{V1}/team/reviews/{listing_id}/decision"
    assert api.client("renter").post(path, json={"action": "undo", "expected_version": 2}).status_code == 403
    reviewer = api.client("reviewer")
    assert reviewer.post(path, json={"action": "approve", "expected_version": 2}).status_code == 200
    assert reviewer.post(path, json={"action": "undo", "expected_version": 3}).status_code == 409
    with api.session() as session:
        assert session.get(Listing, listing_id).version == 3
        assert session.scalar(select(func.count()).select_from(ReviewEvent)) == 2


def test_publication_and_bot_result_roll_back_together_on_decision_failure(api, monkeypatch):
    from app.services import reviews

    listing_id = ready(api, monkeypatch)[0]
    enqueue(api)
    def fail_cluster_update(*args):
        raise RuntimeError("Synthetic cluster update failure")
    monkeypatch.setattr(reviews, "_touch_cluster", fail_cluster_update)
    assert worker.run_one(api.settings, FakeLLM(output()), "failed-decision")
    with api.session() as session:
        listing = session.get(Listing, listing_id)
        assert listing.version == 1 and listing.review_status == "needs_review"
        assert session.scalar(select(func.count()).select_from(ReviewEvent)) == 0
        assert session.scalar(select(func.count()).select_from(BotReview)) == 0
        assert session.scalar(select(Job.status).where(Job.kind == "bot_review")) == "queued"


def test_bot_approved_listing_is_published_in_my_posts(api, monkeypatch):
    ids = ready(api, monkeypatch)
    sender = api.client("collector")
    assert sender.get(f"{V1}/me/posts").json()["items"][0]["status"] == "needs_review"
    run(api)
    with api.session() as session:
        assert session.get(Listing, ids[0]).review_status == "approved"
    body = sender.get(f"{V1}/me/posts", params={"group": "published"}).json()
    assert body["total"] == 1 and body["items"][0]["status"] == "published"
