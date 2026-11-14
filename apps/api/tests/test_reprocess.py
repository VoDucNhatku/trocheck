"""Task P1: re-reading real posts stored with older rules keeps every decision and is idempotent."""
from sqlalchemy import select, update

from app.models import ExtractionRun, Listing, Post
from app.services.reprocess import reprocess_real_posts
from tests.test_my_posts import send

TEXTS = {
    "old1": "Cho thuê phòng đường Võ Văn Ngân, Thủ Đức, giá 3tr5/tháng, có gác lửng. Bài thử nghiệm.",
    "old2": "Dãy trọ mới gần làng đại học Thủ Đức, giá 2tr2/tháng. Bài thử nghiệm.",
    "kept": "Cho thuê phòng gần chợ Thủ Đức giá 2tr8/tháng. Bài thử nghiệm.",
}


def _age_runs(session, post_ids, *, property_type="unknown"):
    """Make stored results look like an older rule set produced them."""
    for post_id in post_ids:
        post = session.get(Post, post_id)
        session.execute(update(ExtractionRun).where(ExtractionRun.post_version_id == post.current_version_id)
                        .values(pipeline_version="1.0.0", regex_version="1.1.0"))
        session.execute(update(Listing).where(Listing.post_id == post_id, Listing.is_current.is_(True))
                        .values(property_type=property_type, rent_basis="unknown"))
    session.commit()


def _current(session, post_id):
    return session.scalars(select(Listing).where(Listing.post_id == post_id, Listing.is_current.is_(True))).all()


def test_old_results_are_reread_and_decisions_are_kept(api):
    c = api.client("renter")
    ids = {key: send(c, key, text) for key, text in TEXTS.items()}
    api.drain()
    with api.session() as s:
        _age_runs(s, ids.values())
        kept = _current(s, ids["kept"])[0]
        kept.review_status = "approved"
        kept_id = kept.id
        s.commit()

        counts = reprocess_real_posts(s, api.settings)
        assert counts["reprocessed"] == 2
        assert counts["kept_decided"] == 1
        assert counts["errors"] == 0

        for key in ("old1", "old2"):
            (listing,) = _current(s, ids[key])
            assert listing.property_type == "phong_tro", key
            assert listing.rent_basis == "per_unit", key
        # The approved listing is the very same row, untouched.
        (still,) = _current(s, ids["kept"])
        assert still.id == kept_id and still.review_status == "approved"
        assert still.property_type == "unknown"

        # Idempotent: a second run finds everything up to date.
        again = reprocess_real_posts(s, api.settings)
        assert again["reprocessed"] == 0
        assert again["up_to_date"] == 2 and again["kept_decided"] == 1


def test_posts_are_visible_with_new_values_in_my_posts(api):
    c = api.client("renter")
    post_id = send(c, "mine", TEXTS["old1"])
    api.drain()
    with api.session() as s:
        _age_runs(s, [post_id])
        reprocess_real_posts(s, api.settings)
    body = c.get("/api/v1/me/posts").json()
    (item,) = body["items"]
    assert item["listings"][0]["room_type"] == "phong_tro"


def test_demo_posts_and_llm_runs_are_never_reread(api):
    c = api.client("renter")
    demo_id = send(c, "demo", TEXTS["old1"])
    llm_id = send(c, "llm", TEXTS["old2"])
    api.drain()
    with api.session() as s:
        _age_runs(s, [demo_id, llm_id])
        s.get(Post, demo_id).is_demo = True
        post = s.get(Post, llm_id)
        s.execute(update(ExtractionRun).where(ExtractionRun.post_version_id == post.current_version_id)
                  .values(llm_status="ok"))
        s.commit()
        counts = reprocess_real_posts(s, api.settings)
        assert counts["reprocessed"] == 0
        assert counts["kept_llm"] == 1
        assert counts["checked"] == 1  # the demo post is not even a candidate
        (listing,) = _current(s, llm_id)
        assert listing.property_type == "unknown"


def test_limit_stops_the_batch(api):
    c = api.client("renter")
    ids = [send(c, key, text) for key, text in TEXTS.items()]
    api.drain()
    with api.session() as s:
        _age_runs(s, ids)
        assert reprocess_real_posts(s, api.settings, limit=1)["reprocessed"] == 1
        assert reprocess_real_posts(s, api.settings, limit=10)["reprocessed"] == 2


def test_cli_prints_counts_only(api, capsys):
    from app.cli import main

    c = api.client("renter")
    send(c, "cli", TEXTS["old1"])
    api.drain()
    main(["reprocess-real", "--limit", "5"])
    out = capsys.readouterr().out
    assert out.startswith("reprocess-real: {")
    assert "Thủ Đức" not in out and "Võ Văn Ngân" not in out
