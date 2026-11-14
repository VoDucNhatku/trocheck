"""One test case per row of docs/02-data/04-quy-tac-chuan-hoa.md (M4)."""
import pytest

from app.pipeline import normalize as n
from app.pipeline.engine import run_pipeline

# §1 rent: (span, amount_form, amount|min, max, basis, period, includes)
RENT_ROWS = [
    ("5tr5/th", "exact", 5_500_000, None, "unknown", "month", []),
    ("5tr5/th/phòng", "exact", 5_500_000, None, "per_unit", "month", []),
    ("5.5tr", "exact", 5_500_000, None, "unknown", "unknown", []),
    ("5,5tr", "exact", 5_500_000, None, "unknown", "unknown", []),
    ("5,5 triệu", "exact", 5_500_000, None, "unknown", "unknown", []),
    ("5 triệu 5", "exact", 5_500_000, None, "unknown", "unknown", []),
    ("5tr", "exact", 5_000_000, None, "unknown", "unknown", []),
    ("3tr2", "exact", 3_200_000, None, "unknown", "unknown", []),
    ("3tr25", "exact", 3_250_000, None, "unknown", "unknown", []),
    ("2.800.000đ/tháng", "exact", 2_800_000, None, "unknown", "month", []),
    ("2800k", "exact", 2_800_000, None, "unknown", "unknown", []),
    ("1tr5/người", "exact", 1_500_000, None, "per_person", "unknown", []),
    ("3 - 3,5tr", "range", 3_000_000, 3_500_000, "unknown", "unknown", []),
    ("từ 3tr", "starting_from", 3_000_000, None, "unknown", "unknown", []),
    ("3tr bao điện nước", "exact", 3_000_000, None, "unknown", "unknown", ["electricity", "water"]),
    ("200k/ngày", "exact", 200_000, None, "unknown", "day", []),
    ("5 củ", "exact", 5_000_000, None, "unknown", "unknown", []),
]


@pytest.mark.parametrize("span,form,first,second,basis,period,includes", RENT_ROWS)
def test_rent_rows(span, form, first, second, basis, period, includes):
    rent = n.parse_rent(span)
    assert rent["visibility"] == "disclosed"
    assert rent["amount_form"] == form
    if form == "exact":
        assert rent["amount_vnd"] == first
        assert rent["min_vnd"] is None and rent["max_vnd"] is None
    else:
        assert rent["amount_vnd"] is None
        assert rent["min_vnd"] == first
        assert rent["max_vnd"] == second
    assert rent["basis"] == basis
    assert rent["period"] == period
    assert rent["includes"] == includes


@pytest.mark.parametrize("span", ["ib giá", "inbox", "giá thỏa thuận", "Giá ib"])
def test_hidden_price_is_not_a_number(span):
    rent = n.parse_rent(span)
    assert rent["visibility"] == "hidden_explicit"
    assert rent["amount_form"] == "none"
    assert rent["amount_vnd"] is None


def test_per_person_is_never_multiplied():
    rent = n.parse_rent("1tr5/người/tháng")
    assert rent["amount_vnd"] == 1_500_000
    assert rent["basis"] == "per_person"
    assert rent["period"] == "month"


@pytest.mark.parametrize("span", ["5 lít", "3 chai"])
def test_unsure_slang_needs_review(span):
    rent = n.parse_rent(span)
    assert rent["amount_vnd"] is None
    assert rent["unsupported"] is True


# §2 fees: (span, [(type, amount, unit, extra)])
FEE_ROWS = [
    ("điện 3k5/số", [("electricity", 3_500, "per_kwh", {})]),
    ("điện 4k", [("electricity", 4_000, "unknown", {})]),
    ("điện giá nhà nước", [("electricity", None, "unknown", {"state_rate": True})]),
    ("nước 100k/người", [("water", 100_000, "per_person_month", {})]),
    ("nước 20k/khối", [("water", 20_000, "per_m3", {})]),
    ("cọc 1 tháng", [("deposit", None, "months_of_rent", {"months": 1})]),
    ("cọc 3tr", [("deposit", 3_000_000, "one_time", {})]),
    ("dịch vụ 150k/phòng", [("service", 150_000, "per_unit_month", {})]),
    ("free wifi", [("internet", 0, "unknown", {"free": True})]),
    ("miễn phí internet", [("internet", 0, "unknown", {"free": True})]),
    ("gửi xe 100k", [("parking", 100_000, "unknown", {})]),
    ("điện nước giá nhà nước", [
        ("electricity", None, "unknown", {"state_rate": True}),
        ("water", None, "unknown", {"state_rate": True}),
    ]),
]


@pytest.mark.parametrize("span,expected", FEE_ROWS)
def test_fee_rows(span, expected):
    fees = n.parse_fees(span)
    assert len(fees) == len(expected)
    for fee, (ftype, amount, unit, extra) in zip(fees, expected):
        assert fee["type"] == ftype
        assert fee["amount_vnd"] == amount
        assert fee["unit"] == unit
        for key, value in extra.items():
            assert fee[key] == value


@pytest.mark.parametrize("span,ftype,amount,unit", [
    ("nước 100k/tháng", "water", 100_000, "per_unit_month"),
    ("wifi 100k/tháng", "internet", 100_000, "per_unit_month"),
    ("nước 100k/th", "water", 100_000, "per_unit_month"),
    ("nước 100k/tháng/người", "water", 100_000, "per_person_month"),
    ("nước 100k/người/tháng", "water", 100_000, "per_person_month"),
    ("nước 100k/người", "water", 100_000, "per_person_month"),
    ("gửi xe 100k", "parking", 100_000, "unknown"),
    ("điện 4k", "electricity", 4_000, "unknown"),
])
def test_fee_monthly_units_and_unspecified_periods(span, ftype, amount, unit):
    fees = n.parse_fees(span)
    assert len(fees) == 1
    assert fees[0]["type"] == ftype
    assert fees[0]["amount_vnd"] == amount
    assert fees[0]["unit"] == unit


@pytest.mark.parametrize("span,ftype,amount,unit", [
    ("nước 20k/tháng/khối", "water", 20_000, "per_m3"),
    ("nước 20k/khối/tháng", "water", 20_000, "per_m3"),
    ("điện 4k/tháng/số", "electricity", 4_000, "per_kwh"),
    ("điện 4k/số/tháng", "electricity", 4_000, "per_kwh"),
    ("dịch vụ 150k/phòng/người", "service", 150_000, "per_person_month"),
    ("nước 100k/khối/người", "water", 100_000, "per_person_month"),
])
def test_fee_specific_units_take_priority_over_suffix_order(span, ftype, amount, unit):
    fees = n.parse_fees(span)
    assert len(fees) == 1
    assert fees[0]["type"] == ftype
    assert fees[0]["amount_vnd"] == amount
    assert fees[0]["unit"] == unit


# §3 area
AREA_ROWS = [
    ("30m2", "exact", 30, None, False),
    ("30m²", "exact", 30, None, False),
    ("30 mét vuông", "exact", 30, None, False),
    ("DT 30m", "exact", 30, None, False),
    ("diện tích 30m", "exact", 30, None, False),
    ("25-30m2", "range", 25, 30, False),
    ("4x8m", "exact", 32, None, True),
    ("4 x 8", "exact", 32, None, True),
]


@pytest.mark.parametrize("span,form,first,second,dims", AREA_ROWS)
def test_area_rows(span, form, first, second, dims):
    area = n.parse_area(span)
    assert area["amount_form"] == form
    if form == "exact":
        assert area["value_m2"] == first
    else:
        assert (area["min_m2"], area["max_m2"]) == (first, second)
    assert area["from_dimensions"] is dims


def test_area_without_number_is_none():
    assert n.parse_area("DT rộng")["amount_form"] == "none"


# §4 room
ROOM_ROWS = [
    ("CCMN", {"property_type": "ccmn"}),
    ("chung cư mini", {"property_type": "ccmn"}),
    ("phòng trọ", {"property_type": "phong_tro"}),
    ("phòng khép kín", {"property_type": "phong_tro", "private_bathroom": True}),
    ("căn hộ dịch vụ", {"property_type": "can_ho_dich_vu"}),
    ("CHDV", {"property_type": "can_ho_dich_vu"}),
    ("nhà nguyên căn", {"property_type": "nha_nguyen_can"}),
    ("nhà riêng", {"property_type": "nha_nguyen_can"}),
    ("1PN", {"bedrooms": 1}),
    ("1 phòng ngủ", {"bedrooms": 1}),
    ("2PN1WC", {"bedrooms": 2, "bathrooms": 1}),
    ("studio", {"bedrooms": 0}),
    ("gác lửng", {"mezzanine": True}),
    ("có gác", {"mezzanine": True}),
    ("full nội thất", {"furnishing": "full"}),
    ("đầy đủ nội thất", {"furnishing": "full"}),
]


@pytest.mark.parametrize("span,expected", ROOM_ROWS)
def test_room_rows(span, expected):
    room = n.parse_room(span)
    for key, value in expected.items():
        assert room[key] == value


# §6 context rules
def test_ctx_period_month():
    rent = n.parse_rent("5tr")
    rule = n.ctx_period_month(rent, post_type="rental_offer")
    assert rule == "CTX_PERIOD_MONTH" and rent["period"] == "month"


def test_ctx_period_month_needs_500k():
    rent = n.parse_rent("200k")
    assert n.ctx_period_month(rent, post_type="rental_offer") is None
    assert rent["period"] == "unknown"


@pytest.mark.parametrize("ptype,text,expected", [
    ("ccmn", "Cho thuê CCMN 30m2 5tr", "per_unit"),
    ("can_ho_dich_vu", "CHDV full đồ 6tr", "per_unit"),
    ("phong_tro", "phòng trọ 3tr", "unknown"),  # no rule for phong_tro
    ("ccmn", "CCMN ở ghép 2 người 3tr", "unknown"),  # counter-example
    ("ccmn", "CCMN tìm 1 slot 3tr", "unknown"),
])
def test_ctx_basis_unit_single(ptype, text, expected):
    rent = n.parse_rent("5tr")
    n.ctx_basis_unit_single(rent, property_type=ptype, listing_count=1, text=text)
    assert rent["basis"] == expected


def test_ctx_basis_not_applied_to_multi_listing():
    rent = n.parse_rent("5tr")
    n.ctx_basis_unit_single(rent, property_type="ccmn", listing_count=2, text="CCMN P1 5tr P2 6tr")
    assert rent["basis"] == "unknown"


@pytest.mark.parametrize("span,value", [
    ("2.7x10", 27), ("2,7 x 10", 27), ("2.7m x 10m", 27), ("2.7mx10m", 27), ("4m x 8m", 32), ("3.5 x 12m", 42),
    ("30m2", 30), ("6m2", 6), ("DT 30m", 30),
])
def test_area_from_dimensions_is_the_product_never_the_first_number(span, value):
    area = n.parse_area(span)
    assert area["amount_form"] == "exact" and area["value_m2"] == value


@pytest.mark.parametrize("span", ["2.7m2", "5m2", "DT 2.7m", "diện tích 3m", "2x2", "1.5 x 3m", "3-5m2"])
def test_area_below_six_square_metres_is_not_stored(span):
    area = n.parse_area(span)
    assert area == {"amount_form": "none", "value_m2": None, "min_m2": None, "max_m2": None,
                    "from_dimensions": False}


def test_dimension_area_through_the_regex_rule_and_the_pipeline():
    from app.pipeline.engine import run_pipeline

    def areas(text):
        return [listing["area"] for listing in run_pipeline(text).extraction["listings"]]

    assert [a["value_m2"] for a in areas("Cho thuê nhà nguyên căn Quận 7, ngang 2.7m x 10m, giá 9tr/tháng.")] == [27]
    absent = areas("Cho thuê phòng trọ Quận 7, giá 3tr/tháng.")[0]
    assert absent["value_m2"] is None and absent["amount_form"] == "none"
    tiny = areas("Cho thuê phòng trọ Quận 7, DT 2.7m, giá 3tr/tháng.")[0]
    assert tiny["value_m2"] is None and tiny["amount_form"] == "none"


@pytest.mark.parametrize("span,value", [
    ("2tr8.", 2_800_000), ("giá 3tr2, có gác", 3_200_000), ("2tr8;", 2_800_000), ("5 triệu 5.", 5_500_000),
    ("3tr5", 3_500_000), ("3tr5.000", 3_000_000),
])
def test_last_digit_of_a_price_survives_a_following_full_stop_or_comma(span, value):
    assert n.parse_rent(span)["amount_vnd"] == value


@pytest.mark.parametrize("span", ["1tr/tuần", "12tr/năm", "30k/giờ", "2tr5/tuan"])
def test_prices_per_week_year_or_hour_are_unsupported_not_monthly(span):
    rent = n.parse_rent(span)
    assert rent["unsupported"] is True and rent["amount_form"] == "none" and rent["amount_vnd"] is None
    assert rent["period"] == "unknown"


@pytest.mark.parametrize("span,period", [("250k/ngày", "day"), ("150k/đêm", "day"), ("3tr/tháng", "month")])
def test_daily_and_nightly_prices_are_day_prices(span, period):
    assert n.parse_rent(span)["period"] == period


# --- CTX_BASIS_UNIT_WHOLE (task N): whole-unit rents without a per-person signal are per unit ------------

WHOLE_UNIT_POSTS = [
    "Cho thuê phòng trọ 25m2 Quận 7 giá 3tr5/tháng.",
    "Phòng trọ mới xây 22m2 Bình Thạnh, 3tr5.",
    "Cho thuê phòng giá phòng 4tr, nước 100k/người",
    "Phòng trọ 3tr5, điện 3k5/số, nước 100k/người, xe 100k/người.",
    "Cho thuê studio full nội thất 6tr/tháng, ở tối đa 2 người.",
    "Cho thuê duplex 30m2 Gò Vấp 7tr5/tháng, phù hợp 2 người ở.",
    "Cho thuê căn hộ 7tr/tháng, gửi xe 100k/người",
    "Nhà nguyên căn 4x12 Tân Phú 9tr/tháng, rác 20k/người.",
    "Cho thuê CCMN 30m2 5tr/tháng, internet 50k/người.",
    "Cho thuê phòng 20m2 Quận 12 giá 2tr8, có gác.",
    "Phòng trọ khép kín 3 triệu/tháng, cọc 1 tháng, điện nước theo giá nhà nước.",
    "Cho thuê phòng 25m2 giá 3tr, vệ sinh 50k/người/tháng.",
]
PER_PERSON_POSTS = [
    "Tìm người ở ghép phòng 1tr5/tháng Quận 7.",
    "Cho thuê phòng 2tr5 ở ghép nữ.",
    "Cho thuê giường tầng KTX 800k/tháng.",
    "Phòng share 1tr2/tháng gần chợ.",
    "Còn 2 slot phòng trọ 1tr8/tháng.",
    "Phòng trọ 1 người 2tr5, 2 người 3tr.",
    "Phòng 3tr/2 người ở.",
    "Phòng trọ 2tr5 mỗi người/tháng.",
    "Cho thuê phòng 1tr2 theo đầu người.",
    "Cho thuê 3 giường trống trong phòng 1tr/giường.",
    "Ký túc xá sinh viên 700k/tháng phòng 6 bạn.",
    "Cho thuê phòng 1tr8 một người, điện nước chia đều.",
]


@pytest.mark.parametrize("text", WHOLE_UNIT_POSTS)
def test_whole_unit_rent_without_a_person_signal_is_per_unit(text):
    result = run_pipeline(text, mode="production")
    rent = result.extraction["listings"][0]["rent"]
    assert rent["basis"] == "per_unit", text
    assert "basis_unknown" not in result.listing_meta[0].review_reasons
    assert "CTX_BASIS_UNIT_WHOLE" in rent["evidence"][0]["rule_id"]


@pytest.mark.parametrize("text", PER_PERSON_POSTS)
def test_person_or_bed_signal_never_becomes_per_unit(text):
    result = run_pipeline(text, mode="production")
    listings = result.extraction["listings"]
    for listing in listings:
        assert listing["rent"]["basis"] != "per_unit", text


def test_inferred_basis_is_not_applied_to_multi_listing_or_without_a_price():
    rent = n.parse_rent("inbox")
    assert n.ctx_basis_unit_whole(rent, property_type="phong_tro", listing_count=1, text="phòng trọ inbox") is None
    rent = n.parse_rent("5tr")
    assert n.ctx_basis_unit_whole(rent, property_type="phong_tro", listing_count=2, text="P1 5tr P2 6tr") is None
    assert rent["basis"] == "unknown"


def test_explicit_suffix_is_never_overridden_by_the_inference():
    rent = n.parse_rent("2tr5/người")
    assert n.ctx_basis_unit_whole(rent, property_type="phong_tro", listing_count=1, text="phòng 2tr5/người") is None
    assert rent["basis"] == "per_person"
