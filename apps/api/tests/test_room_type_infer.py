"""Task P2: room type inferred from the whole text when the room field names no type (invented posts)."""
import pytest

from app.pipeline.engine import run_pipeline
from app.pipeline.places import real_places


def _room(text: str) -> tuple[str, dict]:
    result = run_pipeline(text, mode="production", llm=None, places=real_places())
    listings = result.extraction["listings"]
    assert result.extraction["post_type"] == "rental_offer", text
    assert len(listings) == 1, text
    return listings[0]["room"]["property_type"], listings[0]


INFERRED = [
    ("Cho thuê phòng đường Võ Văn Ngân, Thủ Đức, giá 3tr5/tháng, có gác lửng", "phong_tro"),
    ("Còn trống 1 phòng sạch sẽ gần chợ Thủ Đức, giá 2.800.000đ/tháng, giờ giấc tự do", "phong_tro"),
    ("Nhà trọ Linh Trung còn phòng, giá 2tr5 một tháng, wc riêng", "phong_tro"),
    ("Dãy trọ mới xây gần làng đại học, giá 2tr2/tháng, có chỗ để xe", "phong_tro"),
    ("Pass phòng sinh viên Tăng Nhơn Phú, giá 3tr/tháng, ban công lớn", "phong_tro"),
    ("Cho thuê studio full nội thất Bình Thạnh 5tr5/tháng, cửa sổ lớn", "can_ho_dich_vu"),
    ("DUPLEX gác cao Nguyễn Xí, Bình Thạnh, chỉ 4tr9/tháng, máy giặt riêng", "can_ho_dich_vu"),
    ("Căn hộ mini 1 phòng ngủ Gò Vấp giá 5tr/tháng, có thang máy", "ccmn"),
    ("Cho thuê căn hộ đầy đủ nội thất Quận 7, 6tr/tháng, bảo vệ 24/7", "can_ho_dich_vu"),
    ("Cho thuê nguyên căn 1 trệt 1 lầu hẻm Lê Văn Việt, 8tr/tháng", "nha_nguyen_can"),
    ("Cho thuê nhà hẻm xe hơi Tân Phú, 2 phòng ngủ, giá 9tr/tháng", "nha_nguyen_can"),
    ("Studio ban công Phú Nhuận 6tr/tháng, có máy giặt", "can_ho_dich_vu"),
]


@pytest.mark.parametrize("text,expected", INFERRED)
def test_room_type_is_inferred(text, expected):
    ptype, listing = _room(text)
    assert ptype == expected
    if listing["room"].get("evidence"):
        assert any("CTX_ROOM_TYPE" in (ev.get("rule_id") or "") or ev.get("rule_id") == "ROOM_TYPE"
                   for ev in listing["room"]["evidence"])


KEPT_UNKNOWN = [
    "Cần 1 bạn nữ ở ghép phòng Linh Xuân, 1tr5/người/tháng",
    "Còn 2 giường trống KTX mini gần SPKT, 900k/tháng",
    "Share phòng 2 người ở Bình Thọ, 1tr8 mỗi người",
    "Cho thuê văn phòng 30m2 Quận 1, giá 12tr/tháng",
    "Cho thuê mặt bằng kinh doanh mặt tiền Thủ Đức 15tr/tháng",
    "Sleepbox gần ĐH Quốc gia 1tr2/tháng, máy lạnh",
    "Cho thuê căn hộ chung cư 2 phòng ngủ Thủ Đức 9tr/tháng",
]


@pytest.mark.parametrize("text", KEPT_UNKNOWN)
def test_shared_or_non_housing_posts_keep_unknown(text):
    result = run_pipeline(text, mode="production", llm=None, places=real_places())
    for listing in result.extraction["listings"]:
        if "CTX_ROOM_TYPE" in ";".join(ev.get("rule_id") or "" for ev in listing["room"].get("evidence") or []):
            pytest.fail(f"inferred a type for: {text}")


def test_explicit_type_is_never_overwritten():
    ptype, _ = _room("Cho thuê CCMN có phòng trống Gò Vấp giá 4tr/tháng")
    assert ptype == "ccmn"


def test_multi_listing_posts_are_not_inferred():
    result = run_pipeline("Phòng 1 giá 3tr/tháng 20m2. Phòng 2 giá 4tr/tháng 25m2. Gần chợ Gò Vấp",
                          mode="production", llm=None, places=real_places())
    if len(result.extraction["listings"]) > 1:
        for listing in result.extraction["listings"]:
            assert "CTX_ROOM_TYPE" not in ";".join(ev.get("rule_id") or ""
                                                    for ev in listing["room"].get("evidence") or [])
