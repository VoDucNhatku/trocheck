"""Which old districts a post gives as its own place: invented, paraphrased texts only."""
import pytest

from app.pipeline.old_districts import MULTI_AREA_MIN, district_mentions, district_scan


@pytest.mark.parametrize("text,expected", [
    ("Phòng mới Nguyễn Cửu Vân, Bình Thạnh (gần Q1)", ["binh-thanh"]),
    ("Nhà nguyên căn Vườn Lài, phường An Phú Đông, Quận 12, gần Gò Vấp, Bình Thạnh", ["quan-12"]),
    ("Phòng 47/... BÌNH THÀNH (CHỢ BÌNH THÀNH), tiện đi Aeon mall Tân Phú", []),
    ("1PN Tô Hiến Thành, D10 (gần CMT8) #1pnquan10", ["quan-10"]),
    ("Cư xá Đô Thành, Q.3 — giao giữa quận 3, quận 1, quận 10", ["quan-3"]),
])
def test_examples_from_a_real_renter_test(text, expected):
    assert district_mentions(text) == expected


@pytest.mark.parametrize("text", [
    "Phòng Bình Thạnh, giáp Quận 1", "Phòng Bình Thạnh, sát Q1", "Phòng Bình Thạnh, cách Q1 5 phút",
    "Phòng Bình Thạnh, kế Quận 1", "Phòng Bình Thạnh, cạnh Q.1", "Phòng Bình Thạnh, tiện đi Quận 1",
    "Phòng Bình Thạnh, thuận tiện di chuyển Quận 1", "Phòng Bình Thạnh, thuận tiện đi Quận 1",
    "Phòng Bình Thạnh, qua Quận 1 chỉ 5 phút", "Phòng Bình Thạnh, sang Q1", "Phòng Bình Thạnh, ra Q1 rất gần",
    "Phòng Bình Thạnh, về Q1 dễ", "Phòng Bình Thạnh, xuống Q1", "Phòng Bình Thạnh, lên Q1",
    "Phòng Bình Thạnh, giáp ranh Quận 1", "Phòng Bình Thạnh, 5 phút tới Q1", "Phòng Bình Thạnh, 5p đến Q1",
    "Phòng Bình Thạnh, 10 phút ra Quận 1", "Phòng Bình Thạnh, GAN Q1", "Phòng Bình Thạnh, gần trung tâm Quận 1",
    "Phòng Bình Thạnh (giáp Q1, Q3)", "Phòng Bình Thạnh, giáp quận 1 và quận 3", "Phòng Bình Thạnh, giáp Q1/Q3",
])
def test_proximity_words_before_a_district_do_not_make_it_the_listings_district(text):
    assert district_mentions(text) == ["binh-thanh"]


def test_proximity_stops_at_the_clause_boundary_and_keeps_explicit_districts():
    # A comma-separated own district after the proximity clause ended is still an own district.
    assert district_mentions("Phòng gần chợ, Quận 7") == ["quan-7"]
    assert district_mentions("Phòng gần đầm sen quận 11") == ["quan-11"]  # a landmark, then an explicit quận
    assert district_mentions("Phòng Quận 7. Gần Q1") == ["quan-7"]
    assert district_mentions("Phòng Quận 7; giáp Q4; Quận 5 cho thuê") == ["quan-7", "quan-5"]
    assert district_mentions("Tân Phú, tiện đi Aeon mall Bình Tân") == ["tan-phu"]


def test_accent_look_alikes_do_not_match_but_plain_text_does():
    assert district_mentions("Phòng Bình Thành giá rẻ") == []
    assert district_mentions("PHÒNG BÌNH THÀNH") == []
    assert district_mentions("Phòng Bình Thạnh") == ["binh-thanh"]
    assert district_mentions("phong binh thanh gia re") == ["binh-thanh"]
    assert district_mentions("PHONG BINH THANH") == ["binh-thanh"]
    assert district_mentions("Phòng Bình Thanh") == ["binh-thanh"]  # partly unaccented is still the district
    assert district_mentions("Phòng Gò Vắp") == []
    assert district_mentions("Phòng Gò Vấp") == ["go-vap"]
    assert district_mentions("Phòng Thủ Đức, Tp. Thủ Đức") == ["thu-duc"]
    assert district_mentions("Phòng Thu Duc") == ["thu-duc"]


@pytest.mark.parametrize("text,key", [
    ("phòng D10 giá 4tr", "quan-10"), ("phòng D.10 giá 4tr", "quan-10"), ("phòng D 10 giá 4tr", "quan-10"),
    ("phòng d10", "quan-10"), ("phòng Q10 giá 4tr", "quan-10"), ("phòng Q.10 giá 4tr", "quan-10"),
    ("phòng quan10 giá rẻ", "quan-10"), ("#phongtroquan10 #chothue", "quan-10"), ("phòng D1 mới", "quan-1"),
    ("phòng Q1 2tr", "quan-1"), ("phòng Q12 giá rẻ", "quan-12"), ("phòng D12", "quan-12"),
    ("phòng Quận 5", "quan-5"), ("tro quan 9", "quan-9"),
])
def test_short_forms_of_numbered_districts(text, key):
    assert district_mentions(text) == [key]


@pytest.mark.parametrize("text", [
    "Liên hệ 0909123456 phòng 20m2", "phòng 10 người ở, 3tr", "phòng D13 mới", "phòng Q13", "phòng d 10m2 giá 3tr",
    "Quận 100", "phòng 2 người 4tr", "dt 25m2 giá 3tr",
])
def test_short_forms_do_not_invent_districts(text):
    assert district_mentions(text) == []


def test_agency_ad_naming_three_districts_is_multi_area():
    ad = "Cho thuê phòng nhiều quận: Quận 3, Quận 10, Tân Bình, Phú Nhuận giá từ 3tr"
    scan = district_scan(ad)
    assert set(scan.keys) == {"quan-3", "quan-10", "phu-nhuan", "tan-binh"}
    assert scan.multi_area and len(scan.keys) >= MULTI_AREA_MIN
    two = district_scan("Phòng Quận 3, Quận 10 giá rẻ")
    assert not two.multi_area and two.keys == ("quan-3", "quan-10")


def test_districts_named_only_as_neighbours_do_not_count_towards_multi_area():
    scan = district_scan("Phòng Phú Nhuận, giáp Quận 1, Quận 3, Bình Thạnh, Gò Vấp")
    assert scan.keys == ("phu-nhuan",) and not scan.multi_area


def test_no_district_and_empty_text():
    assert district_scan("") == district_scan("phòng trọ có gác lửng") and district_mentions(None) == []
