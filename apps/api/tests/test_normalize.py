"""One test case per row of docs/02-data/04-quy-tac-chuan-hoa.md (M4)."""
import pytest

from app.pipeline import normalize as n

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
