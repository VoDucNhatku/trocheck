"""Filters on /me/posts: invented posts, listing columns set directly, both SQL dialects."""
from pathlib import Path

import pytest
import yaml
from sqlalchemy import select

from app.models import Listing, Post
from app.pipeline.old_districts import district_key, districts_of_ward, old_districts
from app.pipeline.places import LEXICON
from app.services import my_posts
from app.core.ids import new_id
from tests.test_my_posts import TEXT, V1, read, send

NEUTRAL = "Cho thuê phòng trọ 25m2 giá 3tr5/tháng/phòng. Bài thử nghiệm."
QUAN1, QUAN1_TAN_DINH, QUAN3, BINH_THANH = "26740", "26737", "27139", "26956"
QUAN6_QUAN8 = "27364"  # one new ward that received parts of two old districts


def seed(api, client, specs):
    """specs: key -> list of listing overrides. Returns key -> post id."""
    ids = {key: send(client, key, NEUTRAL + f" Mẫu thử {key}.") for key in specs}
    api.drain()
    with api.session() as s:
        for key, listing_specs in specs.items():
            first = s.scalar(select(Listing).where(Listing.post_id == ids[key]))
            rows = [first]
            for index in range(1, len(listing_specs)):
                extra = Listing(id=new_id(), run_id=first.run_id, post_id=first.post_id, listing_index=index,
                                review_status=first.review_status, review_reasons=[], observed_at=first.observed_at,
                                is_current=True)
                s.add(extra)
                rows.append(extra)
            for row, spec in zip(rows, listing_specs):
                row.ward_code, row.ward_name = spec.get("ward"), spec.get("ward") and "Phường thử"
                row.rent_amount_vnd, row.rent_min_vnd = spec.get("price"), spec.get("price_min")
                row.rent_form = spec.get("form", "exact" if spec.get("price") else "range")
                row.rent_period = spec.get("period", "month")
                row.area_m2, row.property_type = spec.get("area"), spec.get("type", "phong_tro")
            if listing_specs[0].get("not_rental"):
                s.get(Post, ids[key]).status = "rejected_type"
        s.commit()
    return ids


SPECS = {
    "a": [dict(ward=QUAN1, price=4_000_000, area=25)],
    "b": [dict(ward=QUAN1_TAN_DINH, price=6_000_000, area=40, type="ccmn")],
    "c": [dict(ward=QUAN3, price=3_000_000, area=18)],
    "d": [dict(ward=BINH_THANH, price=4_500_000, area=30)],
    "e": [dict(ward=None, price=2_000_000, area=12)],
    "f": [dict(ward=QUAN6_QUAN8, price=None, price_min=2_500_000, form="range", area=21)],
    "g": [dict(ward=QUAN1, price=200_000, period="day", area=10)],
    "m": [dict(ward=QUAN1, price=9_000_000, area=15), dict(ward=QUAN3, price=3_500_000, area=22)],
    "h": [dict(ward=QUAN1, price=4_000_000, area=25, not_rental=True)],
}


@pytest.fixture
def seeded(api):
    c = api.client("renter")
    ids = seed(api, c, SPECS)
    return api, c, {pid: key for key, pid in ids.items()}


def keys(body, names):
    return [names[item["post_id"]] for item in body["items"]]


def test_default_hides_not_rental_and_keeps_posts_without_place_or_listing(seeded):
    api, c, names = seeded
    body = read(c)
    assert sorted(keys(body, names)) == sorted(set(SPECS) - {"h"})
    assert body["total"] == 8 and body["total_sent"] == 9 and body["matched_listings"] == 9
    assert sorted(keys(read(c, rental_only="false"), names)) == sorted(SPECS)
    assert "e" in keys(read(c, price_max=3_000_000), names)  # no ward, still shown with no place filter


def test_area_filter_uses_old_district_and_posts_without_ward_never_match(seeded):
    api, c, names = seeded
    assert sorted(keys(read(c, area="quan-1"), names)) == ["a", "b", "g", "m"]
    assert sorted(keys(read(c, area=["quan-1", "quan-3"]), names)) == ["a", "b", "c", "g", "m"]
    assert keys(read(c, area="binh-thanh"), names) == ["d"]
    assert "e" not in keys(read(c, area=["quan-1", "quan-3", "binh-thanh"]), names)
    assert sorted(keys(read(c, ward=QUAN3), names)) == ["c", "m"]
    assert read(c, ward="99999")["total"] == 0
    # Area AND ward must hold for the same listing: post m has a Quận 1 and a Quận 3 listing, not one of both.
    assert read(c, area="quan-1", ward=QUAN3)["total"] == 0
    assert keys(read(c, area="quan-1", ward=QUAN1_TAN_DINH), names) == ["b"]


def test_ward_shared_by_two_old_districts_matches_both(seeded):
    api, c, names = seeded
    for key in ("quan-6", "quan-8"):
        assert keys(read(c, area=key), names) == ["f"]
    assert keys(read(c, area="quan-7"), names) == []


def test_multi_listing_post_returns_only_matching_listings_and_total(seeded):
    api, c, names = seeded
    item = next(i for i in read(c, area="quan-3")["items"] if names[i["post_id"]] == "m")
    assert item["listing_total"] == 2 and [x["ward_code"] for x in item["listings"]] == [QUAN3]
    item = next(i for i in read(c)["items"] if names[i["post_id"]] == "m")
    assert item["listing_total"] == 2 and len(item["listings"]) == 2
    assert read(c, area="quan-3")["matched_listings"] == 2
    cheap = read(c, price_max=4_000_000, area="quan-1", sort="price_asc")
    assert sorted(keys(cheap, names)) == ["a"]


def test_price_filters_use_monthly_low_end(seeded):
    api, c, names = seeded
    assert sorted(keys(read(c, price_max=3_000_000), names)) == ["c", "e", "f"]  # range low end counts, daily never
    assert sorted(keys(read(c, price_min=4_500_000), names)) == ["b", "d", "m"]
    assert sorted(keys(read(c, price_min=3_000_000, price_max=4_000_000), names)) == ["a", "c", "m"]
    assert "g" not in keys(read(c, price_max=1_000_000), names)


def test_area_and_type_filters(seeded):
    api, c, names = seeded
    assert sorted(keys(read(c, area_min=25), names)) == ["a", "b", "d"]
    assert sorted(keys(read(c, area_max=15), names)) == ["e", "g", "m"]
    assert keys(read(c, type="ccmn"), names) == ["b"]
    assert sorted(keys(read(c, type=["ccmn", "can_ho_dich_vu"]), names)) == ["b"]


def test_combined_filters_and_sort_orders(seeded):
    api, c, names = seeded
    body = read(c, area=["quan-1", "quan-3"], price_max=5_000_000, area_min=20, type="phong_tro", sort="price_asc")
    assert keys(body, names) == ["m", "a"] and body["matched_listings"] == 2
    assert keys(read(c, sort="price_asc"), names) == ["e", "f", "c", "m", "a", "d", "b", "g"]
    assert keys(read(c, sort="price_desc"), names) == ["m", "b", "d", "a", "c", "f", "e", "g"]
    assert keys(read(c, sort="area_desc"), names) == ["b", "d", "a", "m", "f", "c", "e", "g"]
    two = next(i for i in read(c, area="quan-1", sort="price_asc")["items"] if names[i["post_id"]] == "m")
    assert [x["price_vnd"] for x in two["listings"]] == [9_000_000]


def test_pagination_total_stays_correct_after_filtering(seeded):
    api, c, names = seeded
    pages = [read(c, area=["quan-1", "quan-3"], sort="price_desc", page=p, limit=2) for p in (1, 2, 3)]
    assert [keys(p, names) for p in pages] == [["m", "b"], ["a", "c"], ["g"]]
    assert all(p["total"] == 5 for p in pages)
    assert read(c, area="quan-1", limit=50)["limit"] == 50
    assert read(c, area="quan-1", page=9)["items"] == []


def test_status_group_works_together_with_filters(seeded):
    api, c, names = seeded
    groups = [read(c, group=g, area="quan-1")["total"] for g in ("published", "waiting", "other")]
    assert sum(groups) == read(c, area="quan-1")["total"] == 4


def test_other_users_data_never_changes_results_or_options(seeded):
    api, c, names = seeded
    before, options = read(c, area="quan-1"), c.get(V1 + "/me/posts/filters").json()
    other = api.client("collector")
    seed(api, other, {"z": [dict(ward=QUAN1, price=1_000_000, area=99, type="nha_nguyen_can")],
                      "y": [dict(ward="26929", price=1_500_000, area=60)]})
    assert read(c, area="quan-1") == before
    assert c.get(V1 + "/me/posts/filters").json() == options
    assert read(c, price_max=1_500_000)["total"] == 0
    mine = other.get(V1 + "/me/posts/filters").json()
    assert mine["price_min_vnd"] == 1_000_000 and mine["area_max_m2"] == 99


def test_filter_options_counts_ranges_and_mapping(seeded):
    api, c, names = seeded
    body = c.get(V1 + "/me/posts/filters").json()
    areas = {a["key"]: a for a in body["areas"]}
    assert areas["quan-1"] == {"key": "quan-1", "name": "Quận 1", "listing_count": 4, "post_count": 4}
    assert areas["quan-3"]["listing_count"] == 2 and areas["quan-3"]["post_count"] == 2
    assert areas["quan-6"]["post_count"] == areas["quan-8"]["post_count"] == 1
    assert "quan-7" not in areas
    wards = {w["code"]: w for w in body["wards"]}
    assert wards[QUAN1]["listing_count"] == 3 and wards[QUAN1]["post_count"] == 3
    assert body["price_min_vnd"] == 2_000_000 and body["price_max_vnd"] == 9_000_000
    assert body["area_min_m2"] == 10 and body["area_max_m2"] == 40 and body["total_listings"] == 9
    assert {t["type"]: t["listing_count"] for t in body["types"]} == {"phong_tro": 8, "ccmn": 1}
    assert body["areas"][0]["key"] == "quan-1"  # most posts first
    assert api.client().get(V1 + "/me/posts/filters").status_code == 401


def test_pipeline_extracted_ward_matches_its_old_district(api):
    c = api.client("renter")
    send(c)  # "phường 25, Bình Thạnh" resolves to the new ward through the lexicon
    api.drain()
    assert read(c, area="binh-thanh")["total"] == 1 and read(c, area="quan-1")["total"] == 0
    assert read(c, ward=BINH_THANH)["items"][0]["listings"][0]["ward_code"] == BINH_THANH


@pytest.mark.parametrize("params", [
    {"area": "khong-co"}, {"ward": "abc"}, {"ward": "123456"}, {"price_min": -1}, {"price_max": "x"},
    {"price_min": 5, "price_max": 4}, {"area_min": 30, "area_max": 20}, {"area_min": -2}, {"sort": "bad"},
    {"type": "villa"}, {"rental_only": "maybe"}, {"limit": 51},
])
def test_invalid_parameters_return_422(api, params):
    assert api.client("renter").get(V1 + "/me/posts", params=params).status_code == 422


def test_old_district_keys_and_mapping_against_the_lexicon():
    districts = old_districts()
    assert {"quan-1", "quan-3", "quan-7", "binh-thanh", "thu-duc", "quan-10", "cu-chi"} <= set(districts)
    assert district_key("Quận 1") == "quan-1" and district_key("Thành phố Thủ Đức") == "thu-duc"
    doc = yaml.safe_load(Path(LEXICON / "former_wards.yaml").read_text(encoding="utf-8"))
    rows = {(r["old_district_name"], r["old_ward_name"]): r for r in doc["former_wards"]}
    # Former Quận 1 wards: Bến Nghé went wholly to Phường Sài Gòn, Đa Kao to Sài Gòn and Tân Định.
    assert {r["new_ward_code"] for r in rows[("Quận 1", "Phường Bến Nghé")]["relations"]} == {QUAN1}
    assert {r["new_ward_code"] for r in rows[("Quận 1", "Phường Đa Kao")]["relations"]} == {QUAN1, QUAN1_TAN_DINH}
    assert {QUAN1, QUAN1_TAN_DINH} <= districts["quan-1"].ward_codes
    # Former Bình Thạnh numbered ward 25 -> Phường Thạnh Mỹ Tây.
    assert {r["new_ward_code"] for r in rows[("Quận Bình Thạnh", "Phường 25")]["relations"]} == {BINH_THANH}
    assert BINH_THANH in districts["binh-thanh"].ward_codes and BINH_THANH not in districts["quan-1"].ward_codes
    assert QUAN3 in districts["quan-3"].ward_codes and QUAN3 not in districts["quan-1"].ward_codes
    # Built from the lexicon, not by hand: every relation of every former ward is reachable.
    for row in doc["former_wards"]:
        for rel in row["relations"]:
            assert str(rel["new_ward_code"]) in districts[district_key(row["old_district_name"])].ward_codes
    assert set(districts_of_ward()[QUAN6_QUAN8]) == {"quan-6", "quan-8"}
    assert my_posts.area_ward_codes(["quan-1"]) == sorted(districts["quan-1"].ward_codes)


DISTRICT_ONLY = {
    "q10": "Cho thuê phòng Q10 giá 4tr/tháng/phòng. Bài thử nghiệm.",
    "q9": "Cho thuê nhà nguyên căn quận 9 cũ, 40m2, giá 12tr/tháng. Bài thử nghiệm.",
    "inbox": "Cho thuê phòng Q10, giá inbox. Bài thử nghiệm.",
    "abroad": "Cho thuê phòng trọ Quận 1 Hà Nội giá 3tr/tháng. Bài thử nghiệm.",
}


def test_posts_naming_only_an_old_district_match_the_area_filter(api):
    c = api.client("renter")
    ids = {key: send(c, key, text) for key, text in DISTRICT_ONLY.items()}
    api.drain()
    names = {pid: key for key, pid in ids.items()}
    assert sorted(keys(read(c, area="quan-10"), names)) == ["inbox", "q10"]
    assert keys(read(c, area="quan-9"), names) == ["q9"]
    assert sorted(keys(read(c, area=["quan-9", "quan-10"]), names)) == ["inbox", "q10", "q9"]
    # A listing flagged outside HCMC is never offered under an HCMC district.
    assert read(c, area="quan-1")["total"] == 0
    # Posts whose price is not public never pass a price filter, and still show without one.
    assert keys(read(c, area="quan-10", price_max=5_000_000), names) == ["q10"]
    assert keys(read(c, area="quan-10", price_min=1), names) == ["q10"]
    assert "inbox" in keys(read(c, area="quan-10"), names)
    card = next(i for i in read(c, area="quan-10")["items"] if names[i["post_id"]] == "q10")["listings"][0]
    assert card["ward_code"] is None and card["old_districts"] == [{"key": "quan-10", "name": "Quận 10"}]
    options = {a["key"]: a for a in c.get(V1 + "/me/posts/filters").json()["areas"]}
    assert options["quan-10"]["listing_count"] == 2 and options["quan-10"]["post_count"] == 2
    assert options["quan-9"] == {"key": "quan-9", "name": "Quận 9", "listing_count": 1, "post_count": 1}
    assert "quan-1" not in options
    assert api.client("collector").get(V1 + "/me/posts/filters").json()["areas"] == []


def test_district_and_ward_routes_count_a_listing_once(api):
    c = api.client("renter")
    send(c, "both", "Cho thuê phòng trọ 25m2 phường 25, Bình Thạnh, giá 3tr5/tháng/phòng. Bài thử nghiệm.")
    api.drain()
    areas = {a["key"]: a for a in c.get(V1 + "/me/posts/filters").json()["areas"]}
    assert areas["binh-thanh"]["listing_count"] == 1 and read(c, area="binh-thanh")["total"] == 1


def test_district_mentions_use_the_existing_matcher_and_abbreviations():
    from app.pipeline.old_districts import area_catalog, district_mentions
    assert district_mentions("Cho thuê phòng Q10 giá 4tr") == ["quan-10"]
    assert district_mentions("tro q.1, quan 3 gia re") == ["quan-1", "quan-3"]
    assert district_mentions("phong o go vap gan cho") == ["go-vap"]
    assert district_mentions("nhà quận 9 cũ") == ["quan-9"] and "quan-9" in area_catalog()
    assert district_mentions("phòng trọ có gác lửng") == []


def test_listing_districts_migration_backfills_existing_listings(database_url):
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import MetaData, Table, inspect

    from app.core.db import make_engine
    from app.core.ids import utcnow

    cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    command.upgrade(cfg, "0007")
    engine = make_engine(database_url)
    meta, now = MetaData(), utcnow()
    t = {name: Table(name, meta, autoload_with=engine) for name in
         ("users", "posts", "post_versions", "extraction_runs", "listings")}
    with engine.begin() as conn:
        conn.execute(t["users"].insert().values(id="u", username="m", password_hash="x", roles=["renter"], created_at=now))
        for pid, text, demo, reasons in (("p1", "Phòng Q10 giá 4tr", False, []), ("p2", "Phòng Q10 giá 4tr", False, ["outside_hcm_province"]),
                                         ("p3", "Phòng Q10 giá 4tr", True, []), ("p4", "Phòng trọ có gác", False, [])):
            conn.execute(t["posts"].insert().values(id=pid, collector_id="u", source_type="facebook_group", mode="collect",
                                                   contributed=True, is_demo=demo, status="extracted", first_seen_at=now,
                                                   last_seen_at=now))
            conn.execute(t["post_versions"].insert().values(id="v" + pid, post_id=pid, text=text, text_hash=pid,
                                                           text_complete=True, created_at=now))
            conn.execute(t["extraction_runs"].insert().values(
                id="r" + pid, post_version_id="v" + pid, created_at=now, mode="production", pipeline_version="t",
                regex_version="t", prompt_version="t", normalizer_version="t", llm_status="not_run", llm_calls=0,
                latency_ms=0, tokens_in=0, tokens_out=0, dropped_quotes=0, regex_spans=[], llm_spans=[]))
            conn.execute(t["listings"].insert().values(
                id="l" + pid, run_id="r" + pid, post_id=pid, listing_index=0, review_status="needs_review",
                review_reasons=reasons, version=1, is_current=True, area_from_dimensions=False, observed_at=now,
                created_at=now))
    command.upgrade(cfg, "head")
    districts = Table("listing_districts", MetaData(), autoload_with=engine)
    with engine.connect() as conn:
        assert conn.execute(select(districts)).all() == [("lp1", "quan-10")]
    command.downgrade(cfg, "0007")
    assert "listing_districts" not in inspect(engine).get_table_names()
    command.upgrade(cfg, "head")
    engine.dispose()
