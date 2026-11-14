"""ADR-0010: price comparison against the old district when the ward group is missing or too small.
Invented rows only; the rules are pure functions, the end-to-end tests go through the real pipeline."""
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.models import Listing, Post
from app.pipeline.market import (BLOCKING_REASONS, MarketConfig, MarketRow, compare, compare_tiered, district_label,
                                 old_district_of, verdict_sentence)
from app.pipeline.old_districts import districts_of_ward
from tests.conftest import batch, post_payload

NOW = datetime(2026, 11, 14, tzinfo=UTC)
CFG = MarketConfig()
D = "binh-thanh"


def row(i, price_tr=3.0, *, ward=None, district=D, cluster=None, area=25.0, **kw):
    base = dict(listing_id=f"L{i}", cluster_id=cluster or f"C{i}", is_demo=False, contributed=True,
                review_status="auto_accepted", rent_form="exact", rent_vnd=int(round(price_tr * 1_000_000)),
                rent_period="month", rent_basis="per_unit", ward_code=ward, ward_name=None,
                property_type="phong_tro", area_m2=area, area_from_dimensions=False,
                observed_at=NOW - timedelta(days=i % 20), districts=(district,) if district else ())
    base.update(kw)
    return MarketRow(**base)


def run(target, rows, cfg=CFG, demo=False):
    return compare_tiered(target, rows, now=NOW, cfg=cfg, demo=demo)


def prices(n, start=0, **kw):
    return [row(start + i, 2.5 + 0.1 * i, **kw) for i in range(n)]


# --- which tier ----------------------------------------------------------------------------------

def test_tier1_still_wins_when_the_ward_group_has_ten():
    ward_rows = [row(i, 3.0, ward="W1", district=None, ward_name="Phường A") for i in range(10)]
    district_rows = [row(100 + i, 9.0) for i in range(12)]
    target = row(500, 3.3, ward="W1", ward_name="Phường A", district=None)
    c = run(target, ward_rows + district_rows)
    assert c.status == "ok" and c.scope == "ward" and c.pool == "accepted"
    assert c.scope_label == "Phường A" and c.stats.n == 10 and c.stats.mean == 3_000_000
    assert c.criteria["old_district_key"] is None
    assert verdict_sentence(c).endswith("cùng phường.")
    assert c == compare_tiered(target, ward_rows + district_rows, now=NOW, cfg=CFG, demo=False)


def test_tier2_is_used_when_the_ward_is_missing():
    rows = prices(12)
    c = run(row(500, 3.9, cluster="T"), rows)
    assert c.status == "ok" and c.scope == "old_district" and c.pool == "accepted"
    assert c.scope_label == "Bình Thạnh (cũ)" and c.stats.n == 12
    assert c.criteria["old_district_key"] == D and c.verdict == "higher"
    assert "ward_unresolved" in c.reason_codes and "too_few_samples" not in c.reason_codes
    message = verdict_sentence(c)
    assert "ở Bình Thạnh (cũ)" in message and "không cùng phường" in message and "chỉ gồm tin đã duyệt" in message


def test_tier2_is_used_when_the_ward_group_has_fewer_than_ten():
    rows = [row(i, 3.0, ward="W1", ward_name="Phường A") for i in range(4)]
    rows += [row(10 + i, 3.0, ward=f"W{2 + i % 3}") for i in range(12)]
    target = row(500, 3.0, ward="W1", ward_name="Phường A", cluster="T")
    assert compare(target, [r for r in rows if r.ward_code == "W1"], CFG).status == "insufficient_data"
    c = run(target, rows)
    assert c.status == "ok" and c.scope == "old_district" and c.stats.n == 16
    assert "too_few_samples" not in c.reason_codes


def test_tier2_failing_too_keeps_the_ward_result_when_the_ward_is_known():
    rows = [row(i, 3.0, ward="W1", ward_name="Phường A") for i in range(4)] + prices(3, 20)
    c = run(row(500, 3.0, ward="W1", ward_name="Phường A", cluster="T"), rows)
    assert c.status == "insufficient_data" and c.scope == "ward" and c.stats.n == 4
    assert c.stats.median is None and c.delta_percent is None


def test_tier2_failing_without_a_ward_reports_the_district_count():
    c = run(row(500, 3.0, cluster="T"), prices(6))
    assert c.status == "insufficient_data" and c.scope == "old_district" and c.stats.n == 6
    assert c.stats.mean is None and c.delta_percent is None and c.verdict is None
    assert "ward_unresolved" in c.reason_codes and "too_few_samples" in c.reason_codes
    message = verdict_sentence(c)
    assert "mới có 6 tin tương tự ở Bình Thạnh (cũ)" in message and "không cùng phường" in message


def test_no_old_district_means_no_tier2():
    c = run(row(500, 3.0, district=None, cluster="T"), prices(12))
    assert c.scope == "ward" and c.status == "not_comparable" and c.reason_codes == ["ward_unresolved"]
    two = row(501, 3.0, district=None, districts=(D, "go-vap"), cluster="T2")
    assert run(two, prices(12)).status == "not_comparable"


@pytest.mark.parametrize("change", [dict(rent_form="range"), dict(rent_basis="unknown"), dict(rent_period="day"),
                                    dict(property_type="unknown"), dict(rent_vnd=None)])
def test_tier2_never_rescues_a_target_that_is_not_comparable_for_another_reason(change):
    c = run(row(500, 3.0, cluster="T", **change), prices(12))
    assert c.status == "not_comparable" and c.scope == "ward"


# --- who is in the group -------------------------------------------------------------------------

def test_multi_area_ads_and_multi_district_mentions_never_count():
    good = prices(9)
    bad = [row(50 + i, 3.0, multi_area=True, districts=(D, "quan-3", "quan-10")) for i in range(5)]
    bad += [row(60 + i, 3.0, districts=(D, "go-vap")) for i in range(3)]
    bad += [row(70 + i, 3.0, ward="26929", multi_area=True) for i in range(3)]  # ward match, still a multi-area ad
    c = run(row(500, 3.0, cluster="T"), good + bad)
    assert c.status == "insufficient_data" and c.stats.n == 9
    c = run(row(500, 3.0, cluster="T"), good + bad + [row(80, 3.2)])
    assert c.status == "ok" and c.stats.n == 10
    assert not any(r.multi_area for r in c.group)


def test_a_multi_area_target_gets_no_tier2():
    target = row(500, 3.0, multi_area=True, districts=(D, "quan-3", "quan-10"), cluster="T")
    assert run(target, prices(12)).status == "not_comparable"


def test_ward_match_and_mention_match_land_in_the_same_district():
    ward = next(w for w, keys in districts_of_ward().items() if keys == (D,))
    rows = [row(i, 3.0, ward=ward, district=None) for i in range(5)] + prices(5, 10)
    c = run(row(500, 3.0, cluster="T"), rows)
    assert c.status == "ok" and c.stats.n == 10 and c.scope_label == "Bình Thạnh (cũ)"


def test_a_ward_shared_by_two_districts_needs_the_post_to_name_one():
    ward, keys = next((w, k) for w, k in districts_of_ward().items() if len(k) > 1)
    assert old_district_of(row(1, ward=ward, district=None)) is None
    assert old_district_of(row(2, ward=ward, district=keys[0])) == keys[0]
    assert old_district_of(row(3, ward=ward, districts=keys)) is None
    assert old_district_of(row(4, ward=None, districts=(keys[0],))) == keys[0]
    assert old_district_of(row(5, ward=ward, district=keys[1], multi_area=True)) is None


def test_other_districts_do_not_count():
    rows = prices(9) + [row(50 + i, 3.0, district="go-vap") for i in range(8)]
    assert run(row(500, 3.0, cluster="T"), rows).stats.n == 9


def test_price_basis_room_type_and_area_band_are_not_relaxed():
    rows = prices(9)
    rows += [row(30, 3.0, rent_basis="per_person"), row(31, 3.0, property_type="ccmn"), row(32, 3.0, area=45.0)]
    c = run(row(500, 3.0, cluster="T"), rows)
    assert c.status == "insufficient_data" and c.stats.n == 9
    assert c.criteria["area_band"] == "[20,30)" and c.criteria["broad_group"] is False
    # Without an area the group is broad, as in tier 1, and the reason is recorded.
    broad = run(row(500, 3.0, cluster="T", area=None), rows)
    assert broad.status == "ok" and broad.stats.n == 10 and broad.criteria["broad_group"] is True
    assert "area_missing_broad_group" in broad.reason_codes


def test_n_counts_clusters_not_listings_and_the_target_cluster_is_excluded():
    reposts = [row(i, 3.0, cluster=f"C{i // 2}") for i in range(20)]       # 20 listings, 10 clusters
    assert run(row(500, 3.0, cluster="T"), reposts).stats.n == 10
    assert run(row(500, 3.0, cluster="C3"), reposts).stats.n == 9           # its own repost never counts
    twelve_listings_six_clusters = [row(i, 3.0, cluster=f"C{i % 6}") for i in range(12)]
    c = run(row(500, 3.0, cluster="T"), twelve_listings_six_clusters)
    assert c.status == "insufficient_data" and c.stats.n == 6


def test_the_window_is_respected_and_configurable():
    old = [row(i, 3.0, observed_at=NOW - timedelta(days=40 + i)) for i in range(10)]
    assert run(row(500, 3.0, cluster="T"), old).stats.n == 0
    assert run(row(500, 3.0, cluster="T"), old, cfg=MarketConfig(window_days=60)).stats.n == 10
    future = [row(i, 3.0, observed_at=NOW + timedelta(days=5)) for i in range(10)]
    assert run(row(500, 3.0, cluster="T"), future).stats.n == 0


def test_demo_listings_are_never_in_a_real_baseline_and_demo_gets_no_tier2():
    demo = [row(i, 3.0, is_demo=True) for i in range(12)]
    assert run(row(500, 3.0, cluster="T"), demo).stats.n == 0
    mixed = prices(9) + demo
    assert run(row(500, 3.0, cluster="T"), mixed).stats.n == 9
    assert run(row(500, 3.0, is_demo=True, cluster="T"), demo, demo=True).status == "not_comparable"


# --- which pool ----------------------------------------------------------------------------------

def unaccepted(n, start, **kw):
    return [row(start + i, 3.0 + 0.1 * i, review_status="needs_review", **kw) for i in range(n)]


def test_accepted_pool_is_used_first_and_unaccepted_listings_are_not_mixed_in():
    rows = prices(10) + unaccepted(8, 50)
    c = run(row(500, 3.0, cluster="T"), rows)
    assert c.status == "ok" and c.pool == "accepted" and c.stats.n == 10
    assert all(r.review_status == "auto_accepted" for r in c.group)
    assert "chỉ gồm tin đã duyệt" in verdict_sentence(c)


def test_auto_checked_pool_is_the_fallback_and_is_labelled():
    rows = prices(6) + unaccepted(6, 50)
    c = run(row(500, 3.0, cluster="T"), rows)
    assert c.status == "ok" and c.pool == "auto_checked" and c.stats.n == 12
    message = verdict_sentence(c)
    assert "gồm tin chưa duyệt" in message and "không cùng phường" in message and "Bình Thạnh (cũ)" in message


def test_both_pools_too_small_reports_the_larger_pool_count():
    c = run(row(500, 3.0, cluster="T"), prices(3) + unaccepted(4, 50))
    assert c.status == "insufficient_data" and c.pool == "auto_checked" and c.stats.n == 7
    assert "gồm tin chưa duyệt" in verdict_sentence(c)


@pytest.mark.parametrize("code", sorted(BLOCKING_REASONS))
def test_blocking_reason_codes_keep_a_listing_out_of_the_auto_checked_pool(code):
    rows = prices(4) + unaccepted(5, 50) + unaccepted(3, 60, review_reasons=(code,))
    c = run(row(500, 3.0, cluster="T"), rows)
    assert c.status == "insufficient_data" and c.stats.n == 9, code


@pytest.mark.parametrize("code", ["former_ward_unverified", "former_ward_split", "former_district_unverified",
                                  "possible_old_ward", "field_needs_review"])
def test_location_unresolved_codes_are_allowed_in_tier2(code):
    rows = prices(4) + unaccepted(6, 50, review_reasons=(code,))
    c = run(row(500, 3.0, cluster="T"), rows)
    assert c.status == "ok" and c.pool == "auto_checked" and c.stats.n == 10, code


def test_rejected_duplicate_not_rental_failed_and_uncontributed_are_never_used():
    bad = [row(50, review_status="rejected", review_reasons=()), row(51, review_status="duplicate"),
           row(52, review_status="needs_review", post_status="rejected_type"),
           row(53, review_status="needs_review", post_status="failed"),
           row(54, review_status="needs_review", contributed=False),
           row(55, review_status="needs_review", rent_form="range"),
           row(56, review_status="needs_review", rent_basis="unknown"),
           row(57, review_status="needs_review", rent_period="day"),
           row(58, review_status="needs_review", property_type="unknown")]
    c = run(row(500, 3.0, cluster="T"), prices(5) + bad)
    assert c.stats.n == 5 and c.status == "insufficient_data"


def test_ward_unresolved_listings_with_a_district_are_usable_in_tier2_only():
    rows = prices(10)  # no ward at all
    # Tier 1 needs a ward: none of these rows can form a ward group.
    assert compare(row(500, 3.0, ward="W1", cluster="T"), [], CFG).status == "insufficient_data"
    assert run(row(500, 3.0, cluster="T"), rows).status == "ok"


# --- end to end through the pipeline -------------------------------------------------------------

WARD_POSTS = {  # former ward numbers of Quận Bình Thạnh -> the new ward they resolve to
    "Phường Gia Định": [1, 2, 7, 17, 1],
    "Phường Bình Lợi Trung": [5, 11, 13, 5],
    "Phường Bình Thạnh": [12, 14, 26, 12, 14],
    "Phường Thạnh Mỹ Tây": [19, 22, 25, 19],
}
EXTRAS = ["ban công", "cửa sổ thoáng", "máy giặt riêng", "giờ giấc tự do", "khóa vân tay", "để xe miễn phí",
          "bếp riêng", "gần siêu thị", "an ninh tốt", "điều hòa", "nóng lạnh", "thang máy"]


def invented_text(i, place, landmark=None):
    area = 20 + (i * 7) % 10
    price_k = 2800 + (i * 370) % 1900
    tr, rest = divmod(price_k // 100 * 100, 1000)
    price = f"{tr}tr{rest // 100}" if rest else f"{tr}tr"
    pool = [e for e in EXTRAS if "siêu thị" not in e] if landmark is False else EXTRAS
    extras = ", ".join(pool[(i + k * 5) % len(pool)] for k in range(3))
    return (f"Cho thuê phòng trọ {area}m2 {place}, {extras}. Giá {price}/tháng, điện 3k5/số. "
            f"Mã tin #{i:03d}.")


def corpus_texts():
    """30 invented posts: 18 name a former ward of Bình Thạnh (four new wards, 4-5 each), 8 name only the
    district, 4 name a former ward the data cannot resolve."""
    out, i = {}, 0
    for ward, numbers in WARD_POSTS.items():
        for number in numbers:
            i += 1
            out[f"w{i:02d}"] = (invented_text(i, f"phường {number}, Bình Thạnh"), ward)
    for k in range(8):  # the first four also name a landmark (the pipeline then accepts them), the rest do not
        i += 1
        place = "Bình Thạnh, gần siêu thị" if k < 4 else "Bình Thạnh"
        out[f"m{i:02d}"] = (invented_text(i, place, landmark=None if k < 4 else False), None)
    for number in (3, 6, 15, 21):
        i += 1
        out[f"u{i:02d}"] = (invented_text(i, f"phường {number}, Bình Thạnh"), None)
    assert len(out) == 30
    return out


@pytest.fixture
def corpus(api):
    client = api.client("collector")
    ids = {}
    for key, (text, ward) in corpus_texts().items():
        response = client.post("/api/v1/ingest/batch", json=batch(post_payload("n-" + key, text)))
        assert response.status_code == 200, response.text
        assert response.json()["summary"]["created"] == 1, (key, response.text)
        ids[key] = response.json()["results"][0]["post_id"]
    api.drain()
    with api.session() as session:
        for post in session.scalars(select(Post)):
            post.contributed = True
        session.commit()
        listing_of = {key: session.scalars(select(Listing).where(Listing.post_id == pid,
                                                                  Listing.is_current.is_(True))).one().id
                      for key, pid in ids.items()}
    return api, listing_of


def comparison_of(api, listing_id):
    from app.services import market

    with api.session() as session:
        return market.comparison(session, session.get(Listing, listing_id), api.settings)


def test_end_to_end_corpus_resolves_as_designed(corpus):
    api, listing_of = corpus
    with api.session() as session:
        rows = {key: session.get(Listing, lid) for key, lid in listing_of.items()}
        ward_names = {r.ward_name for k, r in rows.items() if k.startswith("w")}
        assert ward_names == set(WARD_POSTS)
        assert all(r.ward_code is None for k, r in rows.items() if k[0] in "mu")
        assert all(r.rent_basis == "per_unit" for r in rows.values())
        assert all(r.review_status == "auto_accepted" for k, r in rows.items() if k[0] == "w" or int(k[1:]) < 23)
        assert all(r.review_status == "needs_review" for k, r in rows.items() if k[0] == "m" and int(k[1:]) >= 23)
        assert all(r.review_status == "needs_review" and r.review_reasons == ["former_ward_unverified"]
                   for k, r in rows.items() if k[0] == "u")
        assert {r.property_type for r in rows.values()} == {"phong_tro"}


def test_end_to_end_listing_without_ward_becomes_comparable_through_its_old_district(corpus):
    api, listing_of = corpus
    body = comparison_of(api, listing_of["m23"])
    assert body["status"] == "ok" and body["scope"] == "old_district" and body["scope_label"] == "Bình Thạnh (cũ)"
    assert body["pool"] == "accepted" and body["n"] == 22  # 18 ward + 4 district-only accepted (itself is not accepted)
    assert body["criteria"]["old_district_key"] == "binh-thanh" and "ward_unresolved" in body["reason_codes"]
    assert body["mean_vnd"] and body["delta_percent"] is not None and body["verdict"] in ("lower", "near", "higher")
    assert "không cùng phường" in body["message"] and "chỉ gồm tin đã duyệt" in body["message"]
    assert body["is_demo"] is False


def test_end_to_end_ward_listing_with_a_small_ward_group_falls_back_to_the_district(corpus):
    api, listing_of = corpus
    body = comparison_of(api, listing_of["w06"])  # Bình Lợi Trung has only 4 listings
    assert body["scope"] == "old_district" and body["status"] == "ok" and body["n"] == 21  # 22 accepted, minus itself
    assert body["pool"] == "accepted" and body["scope_label"] == "Bình Thạnh (cũ)"
    # Gia Định/Bình Lợi Trung/Bình Thạnh/Thạnh Mỹ Tây: no ward reaches ten, so tier 1 never answers here.
    for key in ("w01", "w10", "w15"):
        assert comparison_of(api, listing_of[key])["scope"] == "old_district"


def test_end_to_end_public_response_validates_and_names_only_accepted_listings(corpus):
    from tests.test_public_contract import validate_openapi

    api, listing_of = corpus
    # Unaccepted listings feed numbers only: push the accepted pool under ten so auto_checked is used.
    with api.session() as session:
        for key in listing_of:
            if key[0] == "m" or (key[0] == "w" and int(key[1:]) <= 10):
                session.get(Listing, listing_of[key]).review_status = "needs_review"
        session.commit()
    body = comparison_of(api, listing_of["w11"])
    assert body["scope"] == "old_district" and body["pool"] == "auto_checked" and body["n"] == 29
    assert "gồm tin chưa duyệt" in body["message"]
    accepted = {lid for key, lid in listing_of.items() if key.startswith("w") and int(key[1:]) > 10}
    assert body["similar"] and {s["listing_id"] for s in body["similar"]} <= accepted
    # The same through HTTP for a public (accepted) listing.
    api_client = api.client()
    response = api_client.get(f"/api/v1/listings/{listing_of['w11']}/comparison")
    assert response.status_code == 200, response.text
    assert response.json() == body
    validate_openapi(api_client, "/api/v1/listings/{listing_id}/comparison", response.json())
    text = response.text
    assert "Mã tin" not in text and "điện 3k5" not in text  # aggregate numbers only, never another post's text


def test_end_to_end_proximity_mentions_do_not_enter_the_district_group(corpus):
    api, listing_of = corpus
    before = comparison_of(api, listing_of["m23"])
    assert before["n"] == 22
    client = api.client("collector")
    near = invented_text(900, "Gò Vấp, gần Bình Thạnh")
    pid = client.post("/api/v1/ingest/batch", json=batch(post_payload("n-near", near))).json()["results"][0]["post_id"]
    api.drain()
    with api.session() as session:
        session.get(Post, pid).contributed = True
        session.commit()
        from app.models import ListingDistrict

        listing = session.scalars(select(Listing).where(Listing.post_id == pid)).one()
        keys = set(session.scalars(select(ListingDistrict.district_key).where(ListingDistrict.listing_id == listing.id)))
    assert keys == {"go-vap"}
    after = comparison_of(api, listing_of["m23"])  # unchanged: the Gò Vấp post is not a Bình Thạnh sample
    assert after["n"] == 22 and after["mean_vnd"] == before["mean_vnd"]


def test_district_label_formats():
    assert district_label("binh-thanh") == "Bình Thạnh (cũ)"
    assert district_label("quan-12") == "Quận 12 (cũ)"
    assert district_label("thu-duc") == "Thủ Đức (cũ)"
    assert district_label("cu-chi") == "Củ Chi (cũ)"
