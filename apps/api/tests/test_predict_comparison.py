"""Invented listings exercising analysis fallback and bounded comparison loads."""
from datetime import timedelta

import pytest
from sqlalchemy import delete, event, select

from app.core.ids import utcnow
from app.models import Cluster, ExtractionRun, Listing, ListingDistrict, Post, PostVersion, User
from app.pipeline import market as rules
from app.pipeline.old_districts import district_scan
from app.services import market
from tests.conftest import post_payload


def add_listing(session, key, *, district="thu-duc", ward=None, text="Phòng trọ thử nghiệm", **changes):
    owner = session.scalar(select(User.id).where(User.username == "collector"))
    post = Post(id="p-" + key, collector_id=owner, source_type="import_file", mode="collect",
                contributed=True, is_demo=False, status="extracted")
    session.add(post)
    session.flush()
    version = PostVersion(id="v-" + key, post_id=post.id, text=text, text_hash=key, text_complete=True)
    session.add(version)
    session.flush()
    post.current_version_id = version.id
    run = ExtractionRun(id="r-" + key, post_version_id=version.id, mode="production", pipeline_version="test",
                        regex_version="test", prompt_version="test", normalizer_version="test", llm_status="not_run")
    session.add(run)
    session.flush()
    values = dict(id="l-" + key, run_id=run.id, post_id=post.id, listing_index=0, review_status="approved",
                  rent_form="exact", rent_amount_vnd=2_500_000, rent_period="month", rent_basis="per_unit",
                  property_type="phong_tro", area_m2=22, ward_code=ward, observed_at=utcnow())
    values.update(changes)
    listing = Listing(**values)
    session.add(listing)
    session.flush()
    if district:
        session.add(ListingDistrict(listing_id=listing.id, district_key=district))
    session.flush()
    return listing


@pytest.mark.parametrize("place", ["Linh Trung, Thủ Đức", "Hiệp Bình Chánh, Thủ Đức"])
def test_analysis_missing_district_rows_uses_old_district_then_relaxes_area(api, place):
    with api.session() as session:
        for i in range(10):
            add_listing(session, f"peer-{i}", area_m2=35)
        session.commit()
    client = api.client("renter")
    created = client.post("/api/v1/analyses", json=post_payload("assess-fallback", f"Phòng trọ {place}, 2,5tr, 22m2, có gác"))
    assert created.status_code == 202
    api.drain()
    analysis = client.get("/api/v1/analyses/" + created.json()["analysis_id"]).json()
    lid = analysis["listings"][0]["listing_id"]
    with api.session() as session:
        listing = session.get(Listing, lid)
        assert listing.post.contributed is False
        assert listing.ward_code is None
        session.execute(delete(ListingDistrict).where(ListingDistrict.listing_id == lid))
        session.commit()
    response = client.get(f"/api/v1/listings/{lid}/comparison")
    assert response.status_code == 200
    body = response.json()
    assert (body["status"], body["scope"], body["n"]) == ("ok", "old_district", 10)
    assert body["criteria"]["old_district_key"] == "thu-duc"
    assert body["criteria"]["area_band_relaxed"] is True
    with api.session() as session:
        assert session.scalar(select(ListingDistrict.listing_id).where(ListingDistrict.listing_id == lid)) is None


def test_insufficient_response_names_every_attempt_and_count(api):
    with api.session() as session:
        target = add_listing(session, "target", ward="TEST-WARD")
        add_listing(session, "ward", ward="TEST-WARD")
        add_listing(session, "district")
        add_listing(session, "other-area", area_m2=35)
        body = market.comparison(session, target, api.settings)
    assert body["status"] == "insufficient_data"
    for attempt in ("ward/accepted: 1", "old_district/accepted: 2", "old_district_relaxed/accepted: 3",
                    "old_district/auto_checked: 2", "old_district_relaxed/auto_checked: 3"):
        assert attempt in body["message"]


@pytest.mark.parametrize("text,reasons,multi", [
    ("Phòng trọ Thủ Đức gần Quận 1", [], False),
    ("Phòng trọ Quận 1, Quận 3, Thủ Đức", [], True),
    ("Phòng trọ Thủ Đức", ["outside_hcm_province"], False),
])
def test_target_text_fallback_keeps_location_guards(api, text, reasons, multi):
    with api.session() as session:
        target = add_listing(session, "target", district=None, text=text, review_reasons=reasons)
        for i in range(10):
            add_listing(session, str(i))
        body = market.comparison(session, target, api.settings)
    assert (body["status"] == "ok") is (not multi and not reasons)


def test_batch_matches_single_and_loads_only_candidate_pools_without_text(api):
    with api.session() as session:
        targets = [add_listing(session, f"target-{i}", ward="TEST-WARD") for i in range(20)]
        for i in range(30):
            add_listing(session, f"outside-{i}", district="quan-1", ward="OTHER-WARD")
        session.commit()
        ids = [target.id for target in targets]
    with api.session() as session:
        targets = [session.get(Listing, lid) for lid in ids]
        statements = []
        loaded = []
        def record(_conn, _cursor, statement, _parameters, _context, _many):
            statements.append(statement)
        def record_listing(listing, _context):
            loaded.append(listing.id)
        event.listen(session.bind, "before_cursor_execute", record)
        event.listen(Listing, "load", record_listing)
        try:
            bodies = market.comparisons(session, targets, api.settings)
        finally:
            event.remove(session.bind, "before_cursor_execute", record)
            event.remove(Listing, "load", record_listing)
        assert set(bodies) == set(ids)
        assert len(statements) <= 5, statements
        assert not any("post_versions.text" in sql for sql in statements)
        assert set(loaded) <= set(ids)
        for listing in targets:
            assert bodies[listing.id] == market.comparison(session, listing, api.settings)


def test_candidate_filter_preserves_latest_cluster_across_locations(api):
    with api.session() as session:
        target = add_listing(session, "target", ward="TEST-WARD")
        session.add(Cluster(id="moving-cluster"))
        session.flush()
        older = add_listing(session, "older", cluster_id="moving-cluster", ward="TEST-WARD",
                            observed_at=utcnow() - timedelta(hours=1))
        add_listing(session, "newer", cluster_id="moving-cluster", ward="OTHER-WARD", district="quan-1")
        rows = market.load_rows(session, demo=False)
        expected = rules.compare_tiered(market.to_row(target, target.post, districts=("thu-duc",)), rows,
                                       now=utcnow(), cfg=market.config(api.settings), demo=False)
        body = market.comparison(session, target, api.settings)
        assert body["n"] == expected.stats.n == 0
        assert older.id not in {r["listing_id"] for r in body["similar"]}


def test_candidate_filter_excludes_posts_without_a_current_version(api):
    with api.session() as session:
        target = add_listing(session, "target", ward="TEST-WARD")
        peer = add_listing(session, "no-current-version", ward="TEST-WARD")
        peer.post.current_version_id = None
        session.flush()
        assert len(market.load_rows(session, demo=False)) == 1
        assert market.comparison(session, target, api.settings)["n"] == 0


def test_batch_keeps_demo_and_real_pools_separate(api):
    with api.session() as session:
        real = add_listing(session, "real", ward="TEST-WARD")
        demo = add_listing(session, "demo", ward="TEST-WARD")
        demo.post.is_demo = True
        result = market.comparisons(session, [real, demo], api.settings)
        assert result[real.id]["n"] == result[demo.id]["n"] == 0
        assert result[real.id]["is_demo"] is False and result[demo.id]["is_demo"] is True


def test_empty_batch_does_not_query(api):
    with api.session() as session:
        assert market.comparisons(session, [], api.settings) == {}


@pytest.mark.parametrize("text,expected", [
    ("Phòng trọ Linh Trung, Thủ Đức, 2,5tr, 22m2", ("thu-duc",)),
    ("Phòng trọ Hiệp Bình Chánh, Thủ Đức, 2.5tr, 22m2", ("thu-duc",)),
    ("Phòng trọ phường Hiệp Bình Chánh, Thủ Đức, 2,5tr", ("thu-duc",)),
    ("Phòng trọ Bình Chánh, Quận 1", ("quan-1", "binh-chanh")),
    ("Phòng trọ Quận 1, Quận 2", ("quan-1", "quan-2")),
])
def test_decimal_prices_and_embedded_ward_names_are_not_extra_districts(text, expected):
    assert set(district_scan(text).keys) == set(expected)
