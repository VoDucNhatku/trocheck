"""Run M1-M5 (Regex only) on spec/fixtures and compare normalized values with `expected`."""
import json

import pytest

from app.pipeline.engine import run_pipeline
from tests.conftest import FIXTURES, extraction_validator

FIXTURE_FILES = sorted(FIXTURES.glob("F*.json"))

RENT_KEYS = ["visibility", "amount_form", "amount_vnd", "min_vnd", "max_vnd", "basis", "period", "includes"]
AREA_KEYS = ["amount_form", "value_m2", "min_m2", "max_m2", "from_dimensions"]
LOC_KEYS = ["landmark", "street", "ward_code", "resolution"]
FEE_KEYS = ["type", "amount_vnd", "unit", "months", "free", "state_rate"]


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def fee_key(fee):
    return tuple(fee.get(k) for k in FEE_KEYS)


def same_decision(got, gold):
    """Gold says whether the post states a value; the system may still route it to review."""
    return got == "abstained" if gold == "abstained" else got in ("answered", "needs_review")


def quotes(field):
    return [e["quote"] for e in field.get("evidence", [])]


@pytest.mark.parametrize("path", FIXTURE_FILES, ids=lambda p: p.stem)
def test_fixture(path):
    doc = load(path)
    text = doc["input"]["text"]
    expected = doc["expected"]
    result = run_pipeline(text)
    got = result.extraction

    assert list(extraction_validator().iter_errors(got)) == []
    assert got["post_type"] == expected["post_type"]
    assert len(got["listings"]) == len(expected["listings"])

    for g, e in zip(got["listings"], expected["listings"]):
        assert g["listing_index"] == e["listing_index"]
        for key in RENT_KEYS:
            assert g["rent"].get(key) == e["rent"].get(key, None if key != "includes" else []), key
        assert same_decision(g["rent"]["decision"], e["rent"]["decision"])
        assert g["rent"].get("abstain_reason") == e["rent"].get("abstain_reason")
        if e["rent"].get("evidence"):
            assert quotes(g["rent"]) == quotes(e["rent"])

        for key in AREA_KEYS:
            assert g["area"].get(key) == e["area"].get(key), key
        if e["area"].get("evidence"):
            assert quotes(g["area"]) == quotes(e["area"])

        assert g["room"]["property_type"] == e["room"]["property_type"]
        for key in ["bedrooms", "bathrooms", "mezzanine", "private_bathroom", "furnishing"]:
            if key in e["room"]:
                assert g["room"].get(key) == e["room"][key], key

        for key in LOC_KEYS:
            assert g["location"].get(key) == e["location"].get(key), key
        assert same_decision(g["location"]["decision"], e["location"]["decision"])

        assert sorted(map(fee_key, g["fees"]), key=str) == sorted(map(fee_key, e["fees"]), key=str)


@pytest.mark.parametrize("path", FIXTURE_FILES, ids=lambda p: p.stem)
def test_evidence_offsets_are_code_points(path):
    text = load(path)["input"]["text"]
    for listing in run_pipeline(text).extraction["listings"]:
        fields = [listing[k] for k in ("rent", "area", "room", "location")] + listing["fees"]
        for field in fields:
            for ev in field.get("evidence", []):
                assert text[ev["start"]:ev["end"]] == ev["quote"]


def test_offsets_with_emoji_and_decomposed_accents():
    # AT06: emoji (outside the BMP) and NFD accents before the price must not shift offsets.
    import unicodedata

    text = "🏠🔥 " + unicodedata.normalize("NFD", "Cho thuê phòng trọ khép kín 20m2") + " giá 3tr2/tháng. LH [SĐT]"
    listing = run_pipeline(text).extraction["listings"][0]
    ev = listing["rent"]["evidence"][0]
    assert text[ev["start"]:ev["end"]] == ev["quote"]
    assert listing["rent"]["amount_vnd"] == 3_200_000
    assert listing["area"]["value_m2"] == 20


def test_fee_is_not_taken_as_rent():
    # E-FEE: deposit and utility amounts must never become the rent.
    result = run_pipeline("Cho thuê phòng trọ 25m2, cọc 2tr, điện 3k5/số. Giá 3tr/tháng. LH [SĐT]")
    rent = result.extraction["listings"][0]["rent"]
    assert rent["amount_vnd"] == 3_000_000
    types = {f["type"] for f in result.extraction["listings"][0]["fees"]}
    assert types == {"deposit", "electricity"}


def test_unaccented_teencode():
    result = run_pipeline("cho thue phong tro 25m 3tr2 gan dh, dien 4k/so")
    listing = result.extraction["listings"][0]
    assert listing["rent"]["amount_vnd"] == 3_200_000
    assert listing["room"]["property_type"] == "phong_tro"


@pytest.mark.parametrize("text,post_type", [
    ("Mình cần tìm phòng trọ dưới 3tr gần ĐH FPT", "seeking"),
    ("Cần tìm người ở ghép phòng 30m2, 1tr5/người", "roommate"),
    ("Sang nhượng quán cafe giá 50tr", "sale"),
])
def test_non_rental_posts_have_no_listings(text, post_type):
    result = run_pipeline(text)
    assert result.extraction["post_type"] == post_type
    assert result.extraction["listings"] == []


def test_review_status_rules():
    # Multi-listing post always goes to review (M5).
    multi = run_pipeline(load(FIXTURES / "F04-multi-listing.json")["input"]["text"])
    assert all(m.review_status == "needs_review" for m in multi.listing_meta)
    assert all("multi_listing" in m.review_reasons for m in multi.listing_meta)
