"""Real ward ambiguity and conservative former-district publication checks."""
import unicodedata

import pytest
import yaml

from app.pipeline.engine import run_pipeline
from app.pipeline.places import LEXICON, _load, demo_places, real_places


@pytest.mark.parametrize("reverse", [False, True])
def test_accented_names_and_folded_collision(tmp_path, reverse):
    rows = [{"code": "25807", "name": "Xã Thanh An"},
            {"code": "27676", "name": "Xã Thạnh An"}]
    if reverse:
        rows.reverse()
    path = tmp_path / "wards.yaml"
    path.write_text(yaml.safe_dump({"wards": rows}, allow_unicode=True), encoding="utf-8")
    places = _load(path, LEXICON / "places.yaml")
    assert places.ward("xã Thanh An").code == "25807"
    assert places.ward("xã Thạnh An").code == "27676"
    assert places.ward(unicodedata.normalize("NFD", "XÃ THẠNH AN")).code == "27676"
    assert places.ward("Thạnh An").code == "27676"
    assert places.ward("xa thanh an") is None
    assert places.ward("thanh an") is None
    assert places.ambiguous_keys == {"xa thanh an", "thanh an"}


@pytest.mark.parametrize("reverse", [False, True])
def test_alias_collision_never_overwrites(tmp_path, reverse):
    rows = [{"code": "1", "name": "Phường Một", "aliases": ["Bến Mới", "Chung"]},
            {"code": "2", "name": "Phường Hai", "aliases": ["Bền Mới", "Chung"]},
            {"code": "3", "name": "Phường Ba", "aliases": ["Chung"]}]
    if reverse:
        rows.reverse()
    path = tmp_path / "wards.yaml"
    path.write_text(yaml.safe_dump({"wards": rows}, allow_unicode=True), encoding="utf-8")
    places = _load(path, LEXICON / "places.yaml")
    assert places.ward("Bến Mới").code == "1"
    assert places.ward("Bền Mới").code == "2"
    assert places.ward("ben moi") is None
    assert places.ward("Chung") is None
    assert places.ambiguous_keys == {"ben moi", "chung"}


def test_real_directory_and_pipeline_preserve_accents():
    places = real_places()
    assert places.ambiguous_keys == {"xa thanh an", "thanh an"}
    for name, code in [("xã Thanh An", "25807"), ("xã Thạnh An", "27676")]:
        result = run_pipeline(f"Cho thuê CCMN 30m2 giá 3tr/tháng, {name}.", places=places)
        assert result.extraction["listings"][0]["location"]["ward_code"] == code


def test_pipeline_does_not_bypass_ambiguous_prefixed_alias(tmp_path):
    rows = [{"code": "1", "name": "Phường Một", "aliases": ["P.Một"]},
            {"code": "2", "name": "Phường Hai", "aliases": ["P.Một"]}]
    path = tmp_path / "wards.yaml"
    path.write_text(yaml.safe_dump({"wards": rows}, allow_unicode=True), encoding="utf-8")
    places = _load(path, LEXICON / "places.yaml")
    assert places.ward("P.Một") is None
    result = run_pipeline("Cho thuê CCMN 30m2 giá 3tr/tháng, P.Một.", places=places)
    assert result.extraction["listings"][0]["location"]["ward_code"] is None


@pytest.mark.parametrize("district", ["TP Thủ Đức", "TP. Thủ Đức", "thành phố Thủ Đức",
                                    "TP.Thủ Đức", "Q. Bình Thạnh", "huyện Củ Chi",
                                    "thị xã Chưa Biết", "quận Thuận An"])
def test_unverified_former_district_drops_ward(district):
    result = run_pipeline(f"Cho thuê CCMN 30m2 giá 3tr/tháng, phường An Phú, {district}.")
    assert result.extraction["listings"][0]["location"]["ward_code"] is None
    assert result.listing_meta[0].review_status == "needs_review"
    assert "former_district_unverified" in result.listing_meta[0].review_reasons


def test_sourced_former_district_keeps_ward():
    # Resolution 1685, article 1 clause 82: An Phu, former Thuan An city.
    result = run_pipeline("Cho thuê CCMN 30m2 giá 3tr/tháng, phường An Phú, TP Thuận An.")
    assert result.extraction["listings"][0]["location"]["ward_code"] == "25975"
    assert result.listing_meta[0].review_status == "auto_accepted"
    assert not result.listing_meta[0].review_reasons


def test_current_municipality_is_not_former_district():
    result = run_pipeline("Cho thuê CCMN 30m2 giá 3tr/tháng, phường An Phú, TP Hồ Chí Minh.")
    assert result.extraction["listings"][0]["location"]["ward_code"] == "25975"
    assert result.listing_meta[0].review_status == "auto_accepted"


def test_demo_has_no_new_district_guard():
    assert demo_places().former_districts is None
    assert demo_places().unconfirmed_districts("DEMO-01", "TP Thủ Đức") == []


@pytest.mark.parametrize("name", ["phường Thanh Xuân", "phường Phú Lãm", "phường Thanh Xuan"])
def test_accented_unknown_name_never_falls_back(name):
    assert real_places().ward(name) is None
    result = run_pipeline(f"Cho thuê CCMN 30m2 giá 3tr/tháng, {name}.")
    assert result.extraction["listings"][0]["location"]["ward_code"] is None
    assert result.listing_meta[0].review_status == "needs_review"


def test_unique_unaccented_ward_still_resolves():
    assert real_places().ward("phuong ben thanh").code == "26743"


@pytest.mark.parametrize("district", ["Q7", "Q 7", "Q.7", "q7", "quan 7", "Quận 7"])
@pytest.mark.parametrize("ward", ["Phú Mỹ", "Tân Phú"])
def test_common_numbered_district_spellings_block_wrong_ward(ward, district):
    result = run_pipeline(f"Cho thuê CCMN 30m2 giá 3tr/tháng, phường {ward}, {district}.")
    assert result.extraction["listings"][0]["location"]["ward_code"] is None
    assert result.listing_meta[0].review_status == "needs_review"
    assert "former_district_unverified" in result.listing_meta[0].review_reasons


@pytest.mark.parametrize("district", ["Q2", "Thủ Đức", "thu duc", "Bình Thạnh", "Gò Vấp"])
def test_bare_former_district_blocks_wrong_an_phu(district):
    result = run_pipeline(f"Cho thuê CCMN 30m2 giá 3tr/tháng, phường An Phú, {district}.")
    assert result.extraction["listings"][0]["location"]["ward_code"] is None
    assert result.listing_meta[0].review_status == "needs_review"


def test_every_sourced_district_and_numbered_district_is_detected():
    from app.pipeline.normalize import location_key

    places = real_places()
    doc = yaml.safe_load((LEXICON / "districts.yaml").read_text(encoding="utf-8"))
    for row in doc["districts"]:
        name = row["name"]
        prefix = next(p for p in ("Quận ", "Huyện ", "Thị xã ", "Thành phố ") if name.startswith(p))
        bare = name[len(prefix):]
        for spelling in (name, bare, location_key(name), location_key(bare)):
            assert places.unconfirmed_districts("not-a-ward", f"phường An Phú, {spelling}"), spelling
    for number in range(1, 13):
        for spelling in (f"Q{number}", f"Q {number}", f"Q.{number}", f"q{number}",
                         f"quan {number}", f"Quận {number}"):
            assert places.unconfirmed_districts("not-a-ward", f"phường An Phú, {spelling}"), spelling


@pytest.mark.parametrize("ward,code", [("Tân Bình", "27004"), ("Bình Thạnh", "26929")])
def test_ward_own_words_are_not_a_former_district(ward, code):
    places = real_places()
    assert places.ward(f"phường {ward}").code == code
    assert places.unconfirmed_districts(code, f"phường {ward}") == []
    result = run_pipeline(f"Cho thuê CCMN 30m2 giá 3tr/tháng, phường {ward}.")
    assert result.extraction["listings"][0]["location"]["ward_code"] == code
    assert result.listing_meta[0].review_status == "auto_accepted"


@pytest.mark.parametrize("district", ["Thuận An", "thuan an", "thanh pho thuan an"])
def test_bare_sourced_district_keeps_ward(district):
    result = run_pipeline(f"Cho thuê CCMN 30m2 giá 3tr/tháng, phường An Phú, {district}.")
    assert result.extraction["listings"][0]["location"]["ward_code"] == "25975"
    assert result.listing_meta[0].review_status == "auto_accepted"


@pytest.mark.parametrize("province", ["Hà Nội", "Ha Noi", "tỉnh Nghệ An", "Đà Nẵng"])
def test_other_province_drops_hcm_ward(province):
    result = run_pipeline(f"Cho thuê CCMN 30m2 giá 3tr/tháng, phường An Phú, {province}.")
    assert result.extraction["listings"][0]["location"]["ward_code"] is None
    assert result.listing_meta[0].review_status == "needs_review"
    assert "outside_hcm_province" in result.listing_meta[0].review_reasons


@pytest.mark.parametrize("province", ["Hồ Chí Minh", "Bình Dương", "Bà Rịa - Vũng Tàu"])
def test_city_and_merged_provinces_keep_ward(province):
    result = run_pipeline(f"Cho thuê CCMN 30m2 giá 3tr/tháng, phường An Phú, {province}.")
    assert result.extraction["listings"][0]["location"]["ward_code"] == "25975"
    assert result.listing_meta[0].review_status == "auto_accepted"


def test_official_province_directory_is_complete_and_guarded():
    places = real_places()
    doc = yaml.safe_load((LEXICON / "provinces.yaml").read_text(encoding="utf-8"))
    assert doc["source"] == "https://danhmuchanhchinh.nso.gov.vn/DMDVHC.asmx"
    assert doc["method"] == "DanhMucTinh" and doc["as_of"] == "2026-11-13"
    assert len(doc["provinces"]) == len({row["code"] for row in doc["provinces"]}) == 34
    for row in doc["provinces"]:
        text = f"phường An Phú, {row['name']}"
        assert bool(places.outside_provinces(text)) == (row["code"] != "79")


def test_province_guard_ignores_ward_own_words_and_demo():
    assert real_places().outside_provinces("phường Phú Thọ") == []
    assert demo_places().outside_provinces("phường Cầu Giấy, Hà Nội") == []
