"""Task P: one shared store for Thị trường (by old district), Tìm trọ and the home counts. Invented posts."""
from tests.test_my_posts import send

V1 = "/api/v1"
TAIL = " Bài thử nghiệm."
# Thủ Đức: 12 single-district rooms named only by district (no ward) -> waiting for review, auto-checked.
STREETS = ["Võ Văn Ngân", "Lê Văn Việt", "Đặng Văn Bi", "Kha Vạn Cân", "Hoàng Diệu 2", "Tô Ngọc Vân",
           "Phạm Văn Đồng", "Lê Văn Chí", "Đường số 8", "Quốc lộ 1K", "Lã Xuân Oai", "Man Thiện"]
EXTRAS = ["có gác lửng", "cửa sổ thoáng", "wc riêng", "giờ giấc tự do", "có máy lạnh", "ban công nhỏ",
          "gần chợ", "chỗ để xe rộng", "mới sơn lại", "có kệ bếp", "camera an ninh", "không chung chủ"]
THU_DUC = [f"Phòng trọ {20 + i % 9}m2 đường {STREETS[i]}, Thủ Đức, {EXTRAS[i]}, giá {2 + i / 10:.1f} triệu/tháng."
           for i in range(12)]
# A blocked one (price conflict is simulated by a multi-area ad, which never enters the store).
MULTI = "Cho thuê phòng 20m2 Quận 3, Quận 10, Tân Bình, Phú Nhuận giá 3tr/tháng."
SHARED = "Cần 1 bạn nữ ở ghép phòng Thủ Đức 1tr5/người/tháng."


def _load(api):
    c = api.client("renter")
    for i, text in enumerate(THU_DUC):
        send(c, f"td{i}", text + TAIL)
    send(c, "multi", MULTI + TAIL)
    send(c, "shared", SHARED + TAIL)
    api.drain()
    return api.client()


def test_market_by_old_district_uses_the_shared_store(api):
    anon = _load(api)
    body = anon.get(V1 + "/market/summary", params={"group_by": "old_district"}).json()
    assert body["group_by"] == "old_district" and body["pool"] == "auto_checked"
    cells = {(c["district_key"], c["property_type"]): c for c in body["cells"]}
    cell = cells[("thu-duc", "phong_tro")]
    assert cell["district_name"] == "Thủ Đức (cũ)"
    assert cell["n"] >= 10 and cell["median"] is not None
    assert cell["ward_code"] is None
    # The multi-area ad is never placed under a district.
    assert not any(k[0] in ("quan-3", "quan-10", "tan-binh", "phu-nhuan") for k in cells)


def test_market_old_district_accepted_only_and_area_filter(api):
    anon = _load(api)
    accepted = anon.get(V1 + "/market/summary", params={"group_by": "old_district", "pool": "accepted"}).json()
    assert accepted["pool"] == "accepted"
    store = anon.get(V1 + "/market/summary", params={"group_by": "old_district"}).json()
    assert sum(c["n"] for c in accepted["cells"]) <= sum(c["n"] for c in store["cells"])
    only = anon.get(V1 + "/market/summary", params={"group_by": "old_district", "area": "quan-7"}).json()
    assert only["cells"] == []
    assert anon.get(V1 + "/market/summary", params={"group_by": "old_district", "area": "khong-co"}).status_code == 422


def test_market_by_ward_is_unchanged_and_rejects_auto_checked(api):
    anon = _load(api)
    body = anon.get(V1 + "/market/summary").json()
    assert body["group_by"] == "ward" and body["pool"] == "accepted"
    assert anon.get(V1 + "/market/summary", params={"pool": "auto_checked"}).status_code == 422


def test_search_all_includes_auto_checked_with_label_and_district(api):
    anon = _load(api)
    accepted = anon.get(V1 + "/listings").json()
    store = anon.get(V1 + "/listings", params={"pool": "all", "area": "thu-duc", "page_size": 50}).json()
    assert store["total"] >= 10 and store["total"] >= accepted["total"]
    assert {i["old_district"] for i in store["items"] if i["property_type"] != "unknown"} == {"Thủ Đức (cũ)"}
    assert any(i["review_status"] == "needs_review" for i in store["items"])
    cheap = anon.get(V1 + "/listings", params={"pool": "all", "area": "thu-duc", "price_max": 2_400_000,
                                                "sort": "price_asc"}).json()
    prices = [i["rent"]["amount_vnd"] for i in cheap["items"]]
    assert prices == sorted(prices) and prices and max(prices) <= 2_400_000
    assert anon.get(V1 + "/listings", params={"area": "khong-co"}).status_code == 422


def test_auto_checked_listing_opens_and_compares_but_identity_stays_private(api):
    anon = _load(api)
    items = anon.get(V1 + "/listings", params={"pool": "all", "area": "thu-duc", "type": "phong_tro"}).json()["items"]
    item = items[0]
    detail = anon.get(V1 + f"/listings/{item['listing_id']}")
    assert detail.status_code == 200
    assert "renter" not in detail.text
    comparison = anon.get(V1 + f"/listings/{item['listing_id']}/comparison").json()
    assert comparison["scope"] == "old_district" and comparison["status"] == "ok"
    assert comparison["pool"] in ("accepted", "auto_checked")


def test_shared_posts_never_enter_the_store(api):
    anon = _load(api)
    store = anon.get(V1 + "/listings", params={"pool": "all", "page_size": 100}).json()
    for item in store["items"]:
        assert item["rent"]["basis"] != "per_person" or item["property_type"] == "unknown"
    body = anon.get(V1 + "/market/summary", params={"group_by": "old_district"}).json()
    assert all(c["basis"] == "per_unit" for c in body["cells"])


def test_overview_counts_the_shared_store(api):
    anon = _load(api)
    o = anon.get(V1 + "/stats/overview").json()
    assert o["store_listings"] >= 10
    assert o["store_districts"] >= 1
    assert o["accepted_listings"] <= o["store_listings"]
