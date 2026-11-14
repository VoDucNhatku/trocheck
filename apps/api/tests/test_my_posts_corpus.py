"""An invented corpus of 40 posts through the real pipeline and /me/posts: prices, periods, districts,
rental_only, pagination and filter options must agree with each other. No real post text."""
import pytest

from app.pipeline.old_districts import area_catalog
from tests.test_my_posts import V1, read, send

TAIL = " Bài thử nghiệm."
# key: (text, monthly low-end price the filters must use or None, period kept on the listing, districts)
CORPUS = {
    "p01": ("Cho thuê phòng trọ 25m2 Quận 7 giá 3tr5/tháng.", 3_500_000, "month", ["quan-7"]),
    "p02": ("Cho thuê phòng trọ 25m2 Quận 7 giá 3,5tr.", 3_500_000, "month", ["quan-7"]),
    "p03": ("Cho thuê phòng trọ 25m2 Quận 7 giá 3.5 triệu/tháng.", 3_500_000, "month", ["quan-7"]),
    "p04": ("Cho thuê phòng trọ 25m2 Quận 7 giá 3 triệu 500/tháng.", 3_500_000, "month", ["quan-7"]),
    "p05": ("Cho thuê phòng trọ 25m2 Quận 7 giá 3500k/tháng.", 3_500_000, "month", ["quan-7"]),
    "p06": ("Cho thuê phòng trọ 25m2 Quận 7 giá 3.500.000đ/tháng.", 3_500_000, "month", ["quan-7"]),
    "p07": ("Cho thuê phòng trọ 25m2 Quận 7 giá 3tr-4tr/tháng.", 3_000_000, "month", ["quan-7"]),
    "p08": ("Cho thuê phòng trọ 25m2 Quận 7 giá từ 3tr đến 4tr/tháng.", 3_000_000, "month", ["quan-7"]),
    "p09": ("Cho thuê phòng trọ 25m2 Quận 7 giá 3-4 triệu/tháng.", 3_000_000, "month", ["quan-7"]),
    "p10": ("Cho thuê phòng trọ 25m2 Quận 7 giá từ 3tr.", 3_000_000, "month", ["quan-7"]),
    # "2tr8." and "3tr2," used to lose the last digit when a full stop or comma followed the price.
    "p11": ("Cho thuê phòng trọ 25m2 Quận 7 giá 2tr8.", 2_800_000, "month", ["quan-7"]),
    "p12": ("Cho thuê phòng trọ 25m2 Quận 7, giá 3tr2, có gác lửng.", 3_200_000, "month", ["quan-7"]),
    "p13": ("Cho thuê phòng trọ 25m2 Quận 7 giá 250k/ngày.", None, "day", ["quan-7"]),
    "p14": ("Cho thuê phòng trọ 25m2 Quận 7 giá 150k/đêm.", None, "day", ["quan-7"]),
    # Not per month and not per day: no amount is kept, so no price filter can match it.
    "p15": ("Cho thuê phòng trọ 25m2 Quận 7 giá 1tr/tuần.", None, "unknown", ["quan-7"]),
    "p16": ("Cho thuê phòng trọ 25m2 Quận 7 giá 12tr/năm.", None, "unknown", ["quan-7"]),
    "p17": ("Cho thuê phòng trọ 25m2 Quận 7 giá inbox.", None, "unknown", ["quan-7"]),
    "p18": ("Cho thuê phòng trọ 25m2 Quận 7 giá 2.5 củ.", 2_500_000, "month", ["quan-7"]),
    "p19": ("Cho thuê phòng trọ 25m2 Quận 7 giá 2tr5 cọc 1 tháng.", 2_500_000, "month", ["quan-7"]),
    "p20": ("Cho thuê phòng trọ 25m2 Quận 7 giá 4 triệu/tháng, điện 3k, nước 20k.", 4_000_000, "month", ["quan-7"]),
    "p21": ("Cho thuê phòng 20m2 Q10 giá 3tr/tháng, cọc 6tr.", 3_000_000, "month", ["quan-10"]),
    "p22": ("Cho thuê phòng 20m2 D10 giá 3tr/tháng.", 3_000_000, "month", ["quan-10"]),
    "p23": ("Cho thuê phòng 20m2 #phongtroquan10 giá 2tr7.", 2_700_000, "month", ["quan-10"]),
    "p24": ("Cho thuê phòng trọ 18m2 Bình Thạnh, gần Q1, giá 4tr/tháng.", 4_000_000, "month", ["binh-thanh"]),
    "p25": ("Cho thuê phòng trọ 18m2 Gò Vấp giáp Bình Thạnh giá 3tr8/tháng.", 3_800_000, "month", ["go-vap"]),
    "p26": ("Cho thuê phòng trọ 18m2 Quận 3, Quận 10, Tân Bình, Phú Nhuận giá 2tr5/tháng.", 2_500_000, "month",
            ["quan-3", "quan-10", "phu-nhuan", "tan-binh"]),
    "p27": ("Cho thuê nhà nguyên căn Quận 12 ngang 2.7m x 10m giá 9tr/tháng.", 9_000_000, "month", ["quan-12"]),
    "p28": ("Cho thuê CCMN 30m2 Quận 7 giá 5tr/tháng/phòng.", 5_000_000, "month", ["quan-7"]),
    "p29": ("Cho thuê phòng trọ 12m2 Quận 7 giá 1tr8/tháng.", 1_800_000, "month", ["quan-7"]),
    "p30": ("Cho thuê phòng trọ 40m2 Quận 7 giá 6tr/tháng.", 6_000_000, "month", ["quan-7"]),
    "p31": ("Cho thuê phòng trọ 22m2 Bình Thành giá 3tr/tháng.", 3_000_000, "month", []),
    "p32": ("Cho thuê phòng trọ 22m2 Thủ Đức giá 3tr/tháng.", 3_000_000, "month", ["thu-duc"]),
    "p33": ("Cho thuê phòng trọ 22m2 Quận 7 giá 7tr/tháng.", 7_000_000, "month", ["quan-7"]),
    "p34": ("Cho thuê phòng trọ 22m2 Quận 7, tiện đi Quận 1, Quận 3, giá 3tr/tháng.", 3_000_000, "month", ["quan-7"]),
}
NOT_RENTAL = {
    "n01": "Cần tìm phòng trọ Quận 7 giá dưới 3tr, ai có inbox mình.",
    "n02": "Bán nhà 4x15m Quận 7 giá 5 tỷ, chính chủ.",
    "n03": "Sang nhượng quán cà phê Quận 7 giá 100tr.",
    "n04": "Tuyển nhân viên phục vụ Quận 7 lương 7tr/tháng.",
    "n05": "Cần tìm người ở ghép Quận 7 giá 1tr5/tháng.",
    "n06": "Chào mừng thành viên mới tham gia nhóm.",
}


@pytest.fixture
def corpus(api):
    c = api.client("renter")
    ids = {key: send(c, key, spec[0] + TAIL) for key, spec in CORPUS.items()}
    ids.update({key: send(c, key, text + TAIL) for key, text in NOT_RENTAL.items()})
    api.drain()
    return c, {pid: key for key, pid in ids.items()}


def listing_of(body, names):
    return {names[i["post_id"]]: i for i in body["items"]}


def test_every_corpus_post_has_the_expected_price_period_and_districts(corpus):
    c, names = corpus
    items = listing_of(read(c, rental_only="false", limit=50), names)
    assert len(items) == len(CORPUS) + len(NOT_RENTAL) == 40
    for key, (text, low, period, districts) in CORPUS.items():
        listing = items[key]["listings"][0]
        assert listing["price_period"] == period, (key, text)
        got = listing["price_vnd"] or listing["price_min_vnd"]
        assert (got if period != "day" else None) == low, (key, text)
        assert sorted(d["key"] for d in listing["old_districts"]) == sorted(districts), (key, text)


def test_none_of_the_not_monthly_or_hidden_prices_pass_any_price_filter(corpus):
    c, names = corpus
    wide = read(c, price_min=1, price_max=1_000_000_000, limit=50)
    kept = {names[i["post_id"]] for i in wide["items"]}
    assert not kept & {"p13", "p14", "p15", "p16", "p17"}
    assert kept == {key for key, spec in CORPUS.items() if spec[1] is not None}
    # Both bounds are inclusive; a range or "từ" price is compared by its low end.
    got = {names[i["post_id"]] for i in read(c, price_min=3_000_000, price_max=3_500_000, limit=50)["items"]}
    assert got == {k for k, s in CORPUS.items() if s[1] is not None and 3_000_000 <= s[1] <= 3_500_000}
    assert {"p07", "p10", "p01"} <= got


def test_rental_only_hides_the_posts_that_are_not_rental_offers(corpus):
    c, names = corpus
    default = read(c, limit=50)
    assert default["total"] == len(CORPUS) and default["total_sent"] == 40
    shown = {names[i["post_id"]] for i in default["items"]}
    everything = {names[i["post_id"]] for i in read(c, rental_only="false", limit=50)["items"]}
    assert everything - shown == set(NOT_RENTAL)
    assert not {names[i["post_id"]] for i in read(c, price_min=1, limit=50)["items"]} & set(NOT_RENTAL)


@pytest.mark.parametrize("area", ["quan-7", "quan-10", "binh-thanh", "go-vap", "quan-3", "quan-1", "thu-duc"])
def test_area_results_options_and_pagination_agree(corpus, area):
    c, names = corpus
    expected = {k for k, s in CORPUS.items() if area in s[3]}
    pages = [read(c, area=area, limit=7, page=p) for p in (1, 2, 3, 4, 5)]
    got = [names[i["post_id"]] for p in pages for i in p["items"]]
    assert sorted(got) == sorted(expected) and len(got) == len(set(got))
    assert all(p["total"] == len(expected) for p in pages)
    options = {a["key"]: a for a in c.get(V1 + "/me/posts/filters").json()["areas"]}
    if expected:
        assert options[area]["post_count"] == len(expected) == options[area]["listing_count"]
        assert read(c, area=area, limit=50)["matched_listings"] == len(expected)
    else:
        assert area not in options
    assert all(key in area_catalog() for key in options)


def test_filter_options_ranges_come_from_the_kept_listings_only(corpus):
    c, names = corpus
    options = c.get(V1 + "/me/posts/filters").json()
    prices = [s[1] for s in CORPUS.values() if s[1] is not None]
    assert options["price_min_vnd"] == min(prices) and options["price_max_vnd"] == max(prices)
    assert options["total_listings"] == len(CORPUS)
    # An implausible area (a 2.7 m width, a 3 m dimension) is never offered as the smallest area.
    assert options["area_min_m2"] >= 6
    assert sum(t["listing_count"] for t in options["types"]) <= options["total_listings"]


def test_accent_look_alike_and_proximity_posts_do_not_leak_into_other_districts(corpus):
    c, names = corpus
    assert {names[i["post_id"]] for i in read(c, area="binh-thanh", limit=50)["items"]} == {"p24"}
    assert {names[i["post_id"]] for i in read(c, area="quan-1", limit=50)["items"]} == set()
    ad = read(c, area="quan-3", limit=50)["items"]
    assert [i["listings"][0]["area_match"] for i in ad] == ["multi_area"]


def test_dimension_area_is_the_product_and_other_areas_are_kept(corpus):
    c, names = corpus
    items = listing_of(read(c, limit=50), names)
    assert items["p27"]["listings"][0]["area_m2"] == 27
    assert items["p01"]["listings"][0]["area_m2"] == 25
