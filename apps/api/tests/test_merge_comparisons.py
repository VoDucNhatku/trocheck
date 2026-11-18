"""Invented owner pages preserve comparison results and a fixed SQL statement budget."""
from datetime import timedelta

import pytest
from pydantic import ValidationError
from sqlalchemy import event, select

from app.core.ids import utcnow
from app.models import Listing, PostSubmission, User
from app.schemas.public import Comparison, ComparisonTier
from app.services import market, my_posts
from tests.test_predict_comparison import add_listing


def seed_owner_page(api, count=24):
    locations = [("MERGE-W0", "thu-duc"), ("MERGE-W1", "quan-1"),
                 (None, "binh-thanh"), ("MERGE-W2", "quan-3"), (None, None),
                 ("MERGE-W0", "thu-duc")]
    with api.session() as session:
        owner = session.scalar(select(User).where(User.username == "collector"))
        sent_at = utcnow()
        for i in range(count):
            ward, district = locations[i % len(locations)]
            listing = add_listing(session, f"merge-{i:03}", ward=ward, district=district,
                                  text=f"Invented rental fixture group {i % len(locations)}.",
                                  rent_amount_vnd=2_000_000 + i * 20_000,
                                  review_status="needs_review" if i % 7 == 0 else "approved")
            session.add(PostSubmission(post_id=listing.post_id, user_id=owner.id,
                                       first_sent_at=sent_at - timedelta(minutes=i)))
        session.commit()


def test_owner_page_matches_per_listing_comparisons(api, monkeypatch):
    seed_owner_page(api)
    original = market.comparisons
    with api.session() as session:
        owner = session.scalar(select(User).where(User.username == "collector"))
        # Compare the entire page, including all non-comparison fields, to the old call pattern.
        with monkeypatch.context() as patch:
            patch.setattr(market, "comparisons", lambda s, rows, cfg: {
                row.id: original(s, [row], cfg)[row.id] for row in rows})
            expected = my_posts.search(session, owner, api.settings, group="all", page=1, limit=20)
        actual = my_posts.search(session, owner, api.settings, group="all", page=1, limit=20)
        assert actual == expected
        assert len(actual["items"]) == 20
        for item in actual["items"]:
            for listing in item["listings"]:
                target = session.get(Listing, listing["listing_id"])
                assert listing["comparison"] == market.comparison(session, target, api.settings)


def test_owner_page_sql_count_does_not_grow(api):
    seed_owner_page(api)
    counts = {}
    for size in (5, 20):
        # A fresh session for each size prevents the identity map from hiding lazy SQL.
        with api.session() as session:
            owner = session.scalar(select(User).where(User.username == "collector"))
            statements = []

            def record(_conn, _cursor, statement, _parameters, _context, _many):
                statements.append(statement)

            event.listen(session.bind, "before_cursor_execute", record)
            try:
                page = my_posts.search(session, owner, api.settings, group="all", page=1, limit=size)
            finally:
                event.remove(session.bind, "before_cursor_execute", record)
            assert len(page["items"]) == size
            counts[size] = len(statements)
    print("OWNER_PAGE_SQL", counts)
    assert counts[20] == counts[5], counts


def test_api_comparison_tiers_and_vietnamese_messages(api):
    seed_owner_page(api, count=6)
    client = api.client("collector")
    response = client.get("/api/v1/me/posts", params={"limit": 20})
    assert response.status_code == 200, response.text
    comparisons = [row["comparison"] for item in response.json()["items"] for row in item["listings"]]
    # The public listing page and Analysis both use this comparison endpoint.
    public = api.client()
    for item in response.json()["items"]:
        for row in item["listings"]:
            if row["review_status"] == "approved":
                detail = public.get(f"/api/v1/listings/{row['listing_id']}/comparison?demo=false")
                assert detail.status_code == 200, detail.text
                assert detail.json() == row["comparison"]
                comparisons.append(detail.json())
    with api.session() as session:
        target = add_listing(session, "private-analysis", ward=None, district="thu-duc")
        target.post.mode = "assess"
        target.post.contributed = False
        target_id = target.id
        session.commit()
    analysis = client.get(f"/api/v1/listings/{target_id}/comparison?demo=false")
    assert analysis.status_code == 200, analysis.text
    comparisons.append(analysis.json())
    assert any(c["tiers"] for c in comparisons)
    assert any(t["level"] == "old_district_relaxed" for c in comparisons for t in c["tiers"])
    for comparison in comparisons:
        assert isinstance(comparison["tiers"], list)
        for code in ("ward/", "old_district/", "accepted", "auto_checked"):
            assert code not in comparison["message"]
        for tier in comparison["tiers"]:
            assert set(tier) == {"level", "pool", "n"}
    without_tiers = {k: v for k, v in comparisons[0].items() if k != "tiers"}
    assert Comparison.model_validate(without_tiers).tiers == []


@pytest.mark.parametrize("changes", [{"level": "city"}, {"pool": "unchecked"}])
def test_comparison_tier_rejects_unknown_codes(changes):
    with pytest.raises(ValidationError):
        ComparisonTier.model_validate({"level": "ward", "pool": "accepted", "n": 1, **changes})
