"""Source integrity, historical resolution and realistic HCMC prefix safety."""
import json
from pathlib import Path

import pytest
import yaml

from app.pipeline.engine import run_pipeline
from app.pipeline.normalize import location_key
from app.pipeline.places import LEXICON, real_places, demo_places
from tests.conftest import extraction_validator


CASES = json.loads((Path(__file__).parent / "fixtures/ward_forms_hcm.json").read_text(encoding="utf-8"))


def test_former_table_has_valid_codes_unique_keys_and_sources():
    doc = yaml.safe_load((LEXICON / "former_wards.yaml").read_text(encoding="utf-8"))
    wards = yaml.safe_load((LEXICON / "wards.yaml").read_text(encoding="utf-8"))["wards"]
    codes = {str(w["code"]) for w in wards}
    keys = set()
    for row in doc["former_wards"]:
        key = (location_key(row["old_district_name"]), location_key(row["old_ward_name"]))
        assert key not in keys
        keys.add(key)
        assert row["nso_source"]["as_of"] == "2025-06-30"
        assert row["nso_source"]["province"] in ("79", "74", "77")
        relations = row["relations"]
        assert relations
        assert len({r["new_ward_code"] for r in relations}) == len(relations)
        for relation in relations:
            assert str(relation["new_ward_code"]) in codes
            assert relation["article"] == 1 and 1 <= relation["clause"] <= 164
            assert relation["portion"] in ("full", "part", "remainder")
        assert (len(relations) == 1 and relations[0]["portion"] == "full") or all(
            r["portion"] != "full" for r in relations)
    assert len(keys) == doc["counts"]["included"] == 440
    assert len(keys) + len(doc["omitted"]) == doc["counts"]["nso_units"] == 441
    assert len(real_places().former_wards) == 440
    assert not demo_places().former_wards


def test_lexicon_version_fits_storage_column():
    from app.models import ExtractionRun

    assert len(real_places().version) <= ExtractionRun.__table__.c.lexicon_version.type.length


@pytest.mark.parametrize("case", CASES, ids=lambda c: f"hcm-{c['id']:02d}")
def test_sixty_hcm_forms(case):
    result = run_pipeline(case["text"])
    assert list(extraction_validator().iter_errors(result.extraction)) == []
    locations = [listing["location"] for listing in result.extraction["listings"]]
    assert len(locations) == 1
    assert locations[0]["ward_code"] == case["expected_ward_code"]
    if case["trap"]:
        assert locations[0]["ward_code"] is None or result.listing_meta[0].review_status == "needs_review"


def test_former_whole_unit_preserves_provenance():
    result = run_pipeline("Cho thuê CCMN 30m2 giá 3tr/tháng, P25 Q.Bình Thạnh.")
    loc = result.extraction["listings"][0]["location"]
    assert loc["ward_code"] == "26956"
    assert loc["resolution"] == "from_former_unit"
    assert loc["old_ward_name"] == "Phường 25"
    assert loc["old_district_name"] == "Quận Bình Thạnh"
    assert result.listing_meta[0].review_status == "auto_accepted"


@pytest.mark.parametrize("prefix", ["phường", "phuong", "P.", "P ", "F."])
@pytest.mark.parametrize("district", ["Thủ Đức", "Thu Duc", "TP Thủ Đức", "Thành phố Thủ Đức"])
def test_named_former_ward_with_bare_or_prefixed_district(prefix, district):
    result = run_pipeline(f"Cho thuê CCMN 30m2 giá 3tr/tháng, {prefix} Hiệp Bình Chánh, {district}.")
    loc = result.extraction["listings"][0]["location"]
    assert loc["ward_code"] == "26809"
    assert loc["resolution"] == "from_former_unit"
    assert loc["old_ward_name"] == "Phường Hiệp Bình Chánh"
    assert loc["old_district_name"] == "Thành phố Thủ Đức"
    assert loc["decision"] == "answered"
    assert result.listing_meta[0].review_status == "auto_accepted"


@pytest.mark.parametrize("address", [
    "phường Hiệp Bình Chánh",  # Still requires a district.
    "phường Hiệp Bình Chánh, Bình Chánh",  # Wrong district.
    "phường Hiệp Bình Chánh, Thủ Đức, Bình Chánh",  # Multiple contexts.
    "phường Hiệp Bình Chánh, Quận 7",  # Wrong explicit district.
    "phường Linh Đông, Thủ Đức",  # Split former ward.
    "Hiệp Bình Chánh, Thủ Đức",  # No ward prefix.
])
def test_named_former_ward_district_guards_remain(address):
    result = run_pipeline(f"Cho thuê CCMN 30m2 giá 3tr/tháng, {address}.")
    assert result.extraction["listings"][0]["location"]["ward_code"] is None


def test_named_former_ward_district_context_ignores_only_the_verified_ward_name():
    places = real_places()
    assert places.unconfirmed_districts("", "phường Hiệp Bình Chánh, Thủ Đức") == ["thanh pho thu duc"]
    assert set(places.unconfirmed_districts("", "phường Hiệp Bình Chánh, Thủ Đức, Bình Chánh")) == {
        "thanh pho thu duc", "huyen binh chanh"}
    assert "huyen binh chanh" in places.unconfirmed_districts("", "phường Không Có, Bình Chánh")


def test_split_former_ward_never_resolves():
    result = run_pipeline("Cho thuê CCMN 30m2 giá 3tr/tháng, P.Đa Kao Q1.")
    assert result.extraction["listings"][0]["location"]["ward_code"] is None
    assert "former_ward_split" in result.listing_meta[0].review_reasons


def test_numbered_former_ward_requires_district():
    result = run_pipeline("Cho thuê CCMN 30m2 giá 3tr/tháng, P25.")
    assert result.extraction["listings"][0]["location"]["ward_code"] is None
    assert "former_ward_district_required" in result.listing_meta[0].review_reasons


@pytest.mark.parametrize("address,expected", [
    ("phường An Phú, TP. Thuận An", "25975"),
    ("phường An Phú, Thủ Đức", None),
    ("phường Tân Đông Hiệp, Dĩ An", "25945"),
    ("phường Thanh Xuan, Q12", None),
    ("phường Thanh Xuân, Q12", None),
    ("xa thanh an", None),
    ("xã Thanh An", "25807"),
    ("xã Thạnh An", "27676"),
    ("P.Đa Kao Q.BT", None),
    ("P25, Bình Thạnh, Q10", None),
    ("xã 25, Bình Thạnh", None),
])
def test_current_names_accents_and_unsupported_context(address, expected):
    result = run_pipeline(f"Cho thuê CCMN 30m2 giá 3tr/tháng, {address}.")
    loc = result.extraction["listings"][0]["location"]
    assert loc["ward_code"] == expected
    if expected:
        assert loc["resolution"] == "exact"


def test_split_reason_survives_street_and_reconciliation():
    text = "Cho thuê CCMN 30m2 giá 3tr/tháng, P.Đa Kao Q1, đường Trần Quang Khải."
    result = run_pipeline(text)
    assert result.extraction["listings"][0]["location"]["ward_code"] is None
    assert result.extraction["listings"][0]["location"]["decision"] == "needs_review"
    assert "former_ward_split" in result.listing_meta[0].review_reasons


@pytest.mark.parametrize("address,expected,reason", [
    ("P25 Q.Bình Thạnh", "26956", None),
    ("P.Đa Kao Q1", None, "former_ward_split"),
    ("P25", None, "former_ward_district_required"),
])
def test_llm_spans_obey_the_same_former_rules(address, expected, reason):
    from tests.test_llm import FakeLLM, spans

    text = f"Cho thuê CCMN 30m2 giá 3tr/tháng, {address}."
    # Use just the ward quote: district context must come from the original text.
    quote = address.split(" Q", 1)[0]
    response = {"post_type": "rental_offer", "spans": spans(
        (0, "ROOM", "CCMN"), (0, "PRICE", "3tr/tháng"), (0, "LOC", quote))}
    result = run_pipeline(text, mode="eval_llm", llm=FakeLLM(response))
    assert result.llm_status == "ok"
    assert result.extraction["listings"][0]["location"]["ward_code"] == expected
    assert list(extraction_validator().iter_errors(result.extraction)) == []
    if reason:
        assert reason in result.listing_meta[0].review_reasons
