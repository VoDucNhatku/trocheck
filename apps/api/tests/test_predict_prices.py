"""Invented money forms, including full evidence and explicit monthly suffixes."""
import pytest

from app.pipeline.engine import run_pipeline
from app.pipeline.normalize import money_value, parse_rent
from app.pipeline.preprocess import TextView
from app.pipeline.regex_extractor import find_spans


@pytest.mark.parametrize("token,amount", [
    ("2tr590k", 2_590_000), ("3tr590k", 3_590_000),
    ("2.400.000dd/thang", 2_400_000), ("2.400.000đ/tháng", 2_400_000),
    ("2.400.000 đồng/tháng", 2_400_000),
])
def test_price_forms_keep_all_digits_and_month(token, amount):
    text = f"Cho thuê phòng trọ Linh Trung, Thủ Đức, 22m2, có gác. Giá {token}"
    spans = [s for s in find_spans(TextView.build(text)) if s.label == "PRICE"]
    assert len(spans) == 1 and spans[0].quote == token
    rent = parse_rent(spans[0].quote)
    assert rent["amount_vnd"] == amount
    if "/" in token:
        assert rent["period"] == "month"
    result = run_pipeline(text, mode="eval_regex")
    rent = result.extraction["listings"][0]["rent"]
    assert rent["amount_vnd"] == amount and rent["period"] == "month"


@pytest.mark.parametrize("token,amount", [("2tr5", 2_500_000), ("2tr59", 2_590_000),
                                        ("2tr05k", 2_005_000), ("2tr5k", 2_005_000),
                                        ("2tr999k", 2_999_000), ("3k5", 3_500)])
def test_compound_thousands_and_decimal_shorthand(token, amount):
    assert money_value(token) == amount


def test_compound_price_fee_and_area_remain_separate():
    spans = find_spans(TextView.build("Phòng trọ 22m2, giá 2tr590k/tháng; điện 3k5/số"))
    assert [(s.label, s.quote) for s in spans if s.label in {"PRICE", "FEE", "AREA"}] == [
        ("AREA", "22m2"), ("PRICE", "2tr590k/tháng"), ("FEE", "điện 3k5/số")]
