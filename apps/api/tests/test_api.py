"""API behaviour and acceptance cases AT02, AT10, AT11, AT14-AT17 (demo-va-nghiem-thu §2)."""
from sqlalchemy import select

from app.models import Listing, Post, PostVersion
from tests.conftest import batch, post_payload

V1 = "/api/v1"
CCMN = "Cho thuê CCMN 1PN 30m2 phường Cầu Giấy, giá 5tr/th/phòng, cọc 1 tháng. LH [SĐT]"


def test_health_and_error_shape(api):
    c = api.client()
    assert c.get(f"{V1}/health").json()["status"] == "ok"
    r = c.get(f"{V1}/auth/me")
    assert r.status_code == 401
    body = r.json()["error"]
    assert body["code"] == "unauthenticated" and body["request_id"]
    assert "Traceback" not in r.text


def test_login_and_wrong_password(api):
    c = api.client()
    assert c.post(f"{V1}/auth/login", json={"username": "renter", "password": "x"}).status_code == 401
    assert api.client("renter").get(f"{V1}/auth/me").json()["roles"] == ["renter"]


def test_at15_renter_cannot_review(api):
    c = api.client("renter")
    assert c.get(f"{V1}/team/reviews").status_code == 403
    r = c.post(f"{V1}/team/reviews/XYZ/decision", json={"action": "approve", "expected_version": 1})
    assert r.status_code == 403 and r.json()["error"]["code"] == "forbidden"
    assert c.post(f"{V1}/ingest/batch", json=batch(post_payload("k1", CCMN))).status_code == 403


def test_at10_same_post_twice_is_one_post(api):
    c = api.client("collector")
    payload = post_payload("fb:1:100", CCMN, source_group_id="1", external_post_id="100")
    first = c.post(f"{V1}/ingest/batch", json=batch(payload)).json()
    again = c.post(f"{V1}/ingest/batch", json=batch(payload)).json()
    other_key = c.post(f"{V1}/ingest/batch", json=batch(dict(payload, idempotency_key="fb:1:100b"))).json()
    assert first["summary"] == {"created": 1, "duplicate": 0, "rejected": 0}
    assert again["summary"]["duplicate"] == 1 and other_key["summary"]["duplicate"] == 1
    assert first["results"][0]["post_id"] == again["results"][0]["post_id"] == other_key["results"][0]["post_id"]
    with api.session() as s:
        assert len(s.scalars(select(Post)).all()) == 1


def test_idempotency_key_with_other_content(api):
    c = api.client("collector")
    c.post(f"{V1}/ingest/batch", json=batch(post_payload("k-same", CCMN)))
    r = c.post(f"{V1}/ingest/batch", json=batch(post_payload("k-same", CCMN + " sửa")))
    assert r.json()["results"][0] == {"idempotency_key": "k-same", "status": "rejected", "reason": "conflict"}
    r = c.post(f"{V1}/analyses", json=post_payload("a-same", CCMN))
    assert r.status_code == 202
    api.drain()
    assert c.post(f"{V1}/analyses", json=post_payload("a-same", CCMN + " khác")).status_code == 409


def test_edited_post_gets_new_version(api):
    c = api.client("collector")
    c.post(f"{V1}/ingest/batch", json=batch(post_payload("fb:1:7", CCMN, external_post_id="7")))
    c.post(f"{V1}/ingest/batch", json=batch(post_payload("fb:1:7:v2", CCMN.replace("5tr", "5tr2"),
                                                          external_post_id="7")))
    with api.session() as s:
        assert len(s.scalars(select(PostVersion)).all()) == 2
        assert len(s.scalars(select(Post)).all()) == 1


def test_at11_phone_numbers_are_masked(api):
    c = api.client("collector")
    text = "Cho thuê phòng trọ 20m2 giá 3tr. LH 0912 345 678 hoặc +84 98.765.4321 hoặc 0912-345-679"
    c.post(f"{V1}/ingest/batch", json=batch(post_payload("k-phone", text)))
    with api.session() as s:
        stored = s.scalars(select(PostVersion.text)).one()
    assert "[SĐT]" in stored and "0912" not in stored and "765" not in stored and "84" not in stored


def test_rejected_reasons(api):
    c = api.client("collector")
    posts = [post_payload("e", "   "), post_payload("long", "x" * 20001),
             dict(post_payload("nm", "abc"), phone_masked=False), {"idempotency_key": "bad", "text": "abc"}]
    r = c.post(f"{V1}/ingest/batch", json=batch(*posts)).json()
    assert [x["reason"] for x in r["results"]] == ["empty", "too_long", "not_masked", "schema"]
    assert c.post(f"{V1}/ingest/batch", json=batch(*[post_payload(f"key-{i}", "a") for i in range(21)])).status_code == 422


def test_rate_limit(api, monkeypatch):
    monkeypatch.setattr(api.settings, "ingest_rate_per_minute", 3)
    c = api.client("collector")
    assert c.post(f"{V1}/ingest/batch", json=batch(*[post_payload(f"rate-{i}", f"bài {i}") for i in range(3)])).status_code == 200
    r = c.post(f"{V1}/ingest/batch", json=batch(post_payload("rate-9", "bài 9")))
    assert r.status_code == 429 and r.json()["error"]["code"] == "rate_limited"


def test_analysis_flow_and_contribute(api):
    c = api.client("renter")
    r = c.post(f"{V1}/analyses", json=post_payload("assess:1:1", CCMN))
    assert r.status_code == 202 and r.json()["status"] == "queued"
    aid = r.json()["analysis_id"]
    assert c.get(f"{V1}/analyses/{aid}").json()["status"] == "queued"
    assert api.drain() == 1
    body = c.get(f"{V1}/analyses/{aid}").json()
    assert body["status"] == "succeeded" and body["post_type"] == "rental_offer"
    rent = body["listings"][0]["rent"]
    assert rent["amount_vnd"] == 5_000_000 and rent["basis"] == "per_unit"
    assert body["contributed"] is False
    # Not contributed -> not in the public list.
    assert api.client().get(f"{V1}/listings").json()["total"] == 0
    # But the owner can still see the comparison in the extension panel.
    lid = body["listings"][0]["listing_id"]
    assert c.get(f"{V1}/listings/{lid}/comparison").status_code == 200
    assert api.client().get(f"{V1}/listings/{lid}/comparison").status_code == 404
    assert c.post(f"{V1}/analyses/{aid}/contribute").json() == {"contributed": True}
    # Somebody else cannot read my analysis.
    assert api.client("collector").get(f"{V1}/analyses/{aid}").status_code == 404


def test_one_running_analysis_per_user(api):
    c = api.client("renter")
    assert c.post(f"{V1}/analyses", json=post_payload("ass-1", CCMN)).status_code == 202
    r = c.post(f"{V1}/analyses", json=post_payload("ass-2", CCMN + " 2"))
    assert r.status_code == 429


def test_at07_seeking_post_has_no_listing(api):
    c = api.client("renter")
    aid = c.post(f"{V1}/analyses", json=post_payload("seek-1", "Mình cần tìm phòng trọ dưới 3tr gần ĐH FPT")).json()["analysis_id"]
    api.drain()
    body = c.get(f"{V1}/analyses/{aid}").json()
    assert body["post_type"] == "seeking" and body["listings"] == []
    with api.session() as s:
        assert s.get(Post, aid).status == "rejected_type"


def seed(api):
    from app.core.db import session_scope
    from app.services.seed import seed_demo

    with session_scope() as session:
        seed_demo(session, password="seed-pass")
    api.drain()


def test_at17_demo_data_only_in_demo_mode(api):
    seed(api)
    c = api.client()
    assert c.get(f"{V1}/listings").json()["total"] == 0
    assert c.get(f"{V1}/market/summary").json()["cells"] == []
    api.set_demo(True)
    listing_page = c.get(f"{V1}/listings").json()
    assert listing_page["total"] > 30 and all(i["is_demo"] for i in listing_page["items"])
    assert c.get(f"{V1}/listings", params={"demo": "false"}).json()["total"] == 0


def test_at16_price_filter_reports_hidden(api):
    seed(api)
    api.set_demo(True)
    c = api.client()
    everything = c.get(f"{V1}/listings", params={"page_size": 100}).json()
    filtered = c.get(f"{V1}/listings", params={"price_max": 4_000_000, "page_size": 100}).json()
    no_price = [i for i in everything["items"] if i["rent"]["amount_form"] != "exact"]
    assert no_price, "seed must contain listings without an exact price"
    assert filtered["hidden_no_price"] == len(no_price)
    assert all(i["rent"]["amount_vnd"] <= 4_000_000 for i in filtered["items"])


def test_comparison_and_market_on_demo_data(api):
    seed(api)
    api.set_demo(True)
    c = api.client()
    market = c.get(f"{V1}/market/summary").json()
    assert market["cells"] and market["excluded_counts"]
    assert any(cell["n"] >= 10 and cell["median"] for cell in market["cells"])
    assert all(cell["median"] is None for cell in market["cells"] if cell["n"] < 10)
    items = c.get(f"{V1}/listings", params={"type": "ccmn", "page_size": 100}).json()["items"]
    statuses = {c.get(f"{V1}/listings/{i['listing_id']}/comparison").json()["status"] for i in items}
    assert statuses & {"ok", "insufficient_data"}
    ok = next(i for i in items if c.get(f"{V1}/listings/{i['listing_id']}/comparison").json()["status"] == "ok")
    comp = c.get(f"{V1}/listings/{ok['listing_id']}/comparison").json()
    assert comp["n"] >= 10 and comp["verdict"] in ("higher", "near", "lower") and comp["similar"]
    assert "không phải giá giao dịch" in comp["disclaimer"]
    detail = c.get(f"{V1}/listings/{ok['listing_id']}").json()
    assert detail["post"]["text"] and "[SĐT]" in detail["post"]["text"]
    ev = detail["listing"]["rent"]["evidence"][0]
    assert detail["post"]["text"][ev["start"]:ev["end"]] == ev["quote"]


def _needs_review_listing(api):
    c = api.client("collector")
    text = "Nhà mình còn 2 phòng: P1 20m2 2tr8/tháng, P2 30m2 có gác 3tr5/tháng. Ngõ 12 Trần Phú. LH [SĐT]"
    c.post(f"{V1}/ingest/batch", json=batch(post_payload("multi", text)))
    api.drain()
    queue = api.client("reviewer").get(f"{V1}/team/reviews").json()
    assert queue["total"] == 2 and queue["counts"]["multi_listing"] == 2
    return queue["items"][0]


def test_at14_concurrent_review_gets_conflict(api):
    item = _needs_review_listing(api)
    a, b = api.client("reviewer"), api.client("reviewer2")
    detail = a.get(f"{V1}/team/reviews/{item['listing_id']}").json()
    assert detail["post"]["text"] and detail["run"]["regex_spans"]
    body = {"action": "approve", "expected_version": item["version"],
            "fields": {"rent": {"basis": "per_unit"}}, "reason": "bài ghi rõ giá phòng"}
    first = a.post(f"{V1}/team/reviews/{item['listing_id']}/decision", json=body)
    assert first.status_code == 200 and first.json()["review_status"] == "approved"
    second = b.post(f"{V1}/team/reviews/{item['listing_id']}/decision", json=dict(body, fields={"rent": {"basis": "per_person"}}))
    assert second.status_code == 409 and second.json()["error"]["code"] == "conflict"
    with api.session() as s:
        listing = s.get(Listing, item["listing_id"])
        rent = next(f for f in listing.fields if f.field == "rent")
        assert rent.value_json["basis"] == "per_unit" and rent.agreement == "human"
        assert listing.rent_basis == "per_unit" and listing.version == item["version"] + 1


def test_review_validation(api):
    item = _needs_review_listing(api)
    c = api.client("reviewer")
    url = f"{V1}/team/reviews/{item['listing_id']}/decision"
    bad = c.post(url, json={"action": "approve", "expected_version": item["version"], "fields": {"rent": {"basis": "per_family"}}})
    assert bad.status_code == 422
    assert c.post(url, json={"action": "reject", "expected_version": item["version"]}).status_code == 422
    ok = c.post(url, json={"action": "reject", "expected_version": item["version"], "reason": "không phải phòng"})
    assert ok.json()["review_status"] == "rejected"


def test_reprocess_creates_new_run(api):
    c = api.client("collector")
    c.post(f"{V1}/ingest/batch", json=batch(post_payload("rep-1", CCMN)))
    api.drain()
    with api.session() as s:
        post_id = s.scalars(select(Post.id)).one()
        first = s.scalars(select(Listing.id).where(Listing.is_current.is_(True))).one()
    r = api.client("reviewer").post(f"{V1}/team/posts/{post_id}/reprocess")
    assert r.status_code == 200
    api.drain()
    with api.session() as s:
        current = s.scalars(select(Listing).where(Listing.is_current.is_(True))).all()
        assert len(current) == 1 and current[0].id != first
        assert s.get(Listing, first).is_current is False
        assert current[0].cluster_id == s.get(Listing, first).cluster_id
    posts = api.client("reviewer").get(f"{V1}/team/posts").json()
    assert posts["total"] == 1 and posts["items"][0]["status"] == "extracted"


def test_export_is_researcher_only_and_has_no_text(api):
    c = api.client("collector")
    c.post(f"{V1}/ingest/batch", json=batch(post_payload("exp-1", CCMN)))
    api.drain()
    assert api.client("reviewer").get(f"{V1}/team/export").status_code == 403
    r = api.client("researcher").get(f"{V1}/team/export", params={"format": "csv"})
    assert r.status_code == 200 and "rent_amount_vnd" in r.text and "5000000" in r.text
    assert "Cầu Giấy, giá" not in r.text
    data = api.client("researcher").get(f"{V1}/team/export", params={"format": "json"}).json()
    assert data["items"][0]["rent_amount_vnd"] == 5_000_000


def test_extension_token_lifecycle(api):
    web = api.client("collector")
    created = web.post(f"{V1}/team/extension-tokens", json={"name": "Chrome máy nhà"})
    assert created.status_code == 201
    token = created.json()["token"]
    ext = api.client()
    headers = {"Authorization": f"Bearer {token}"}
    assert ext.post(f"{V1}/ingest/batch", json=batch(post_payload("tok-1", CCMN)), headers=headers).status_code == 200
    assert web.get(f"{V1}/team/extension-tokens").json()["items"][0]["last_used_at"]
    assert web.delete(f"{V1}/team/extension-tokens/{created.json()['id']}").status_code == 204
    r = ext.post(f"{V1}/ingest/batch", json=batch(post_payload("tok-2", CCMN)), headers=headers)
    assert r.status_code == 401


def test_lab_and_gold_lock(api):
    c = api.client("researcher")
    r = c.post(f"{V1}/lab/run", json={"text": "Cho thuê phòng trọ 20m2, cọc 2tr, giá 3tr/tháng. LH 0912345678"})
    body = r.json()
    assert r.status_code == 200 and "0912345678" not in body["text"]
    tags = {t["token"]: t["regex"] for t in body["tokens"]}
    assert tags["3tr"] == "B-PRICE" and tags["cọc"] == "B-FEE" and tags["2tr"] == "I-FEE"
    assert body["rows"][1]["available"] is False
    assert api.client("renter").post(f"{V1}/lab/run", json={"text": "abc"}).status_code == 403


def test_eval_runs_are_read_from_disk(api):
    import json

    run_dir = api.settings.eval_runs_dir / "2026-10-30-dev-v1"
    run_dir.mkdir(parents=True)
    (run_dir / "manifest.json").write_text(json.dumps({"run_id": "2026-10-30-dev-v1", "split": "dev",
                                                       "frozen": False, "methods": ["regex"]}), encoding="utf-8")
    (run_dir / "metrics.json").write_text(json.dumps({"regex": {"PRICE": {"f1": 0.9}}}), encoding="utf-8")
    c = api.client("researcher")
    assert c.get(f"{V1}/eval/runs").json()["items"][0]["run_id"] == "2026-10-30-dev-v1"
    assert c.get(f"{V1}/eval/runs/2026-10-30-dev-v1").json()["metrics"]["regex"]["PRICE"]["f1"] == 0.9
    assert c.get(f"{V1}/eval/runs/..%2F..%2Fetc").status_code == 404


def test_at02_hidden_price_never_in_median(api):
    c = api.client("collector")
    c.post(f"{V1}/ingest/batch", json=batch(post_payload("hid-1", "Cho thuê phòng trọ khép kín 25m2 gần chợ. Giá ib nhé. LH [SĐT]")))
    api.drain()
    with api.session() as s:
        listing = s.scalars(select(Listing)).one()
        assert listing.rent_form == "none" and listing.rent_amount_vnd is None
        rent = next(f for f in listing.fields if f.field == "rent")
        assert rent.value_json["visibility"] == "hidden_explicit"


def test_unparsable_body_is_422(api):
    r = api.client("collector").post(f"{V1}/ingest/batch", content=b"{not json", headers={"content-type": "application/json"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "validation_error"


def test_unknown_ward_goes_to_review(api):
    c = api.client("renter")
    aid = c.post(f"{V1}/analyses", json=post_payload("ward-1", "Cho thuê CCMN 30m2 phường Hòa Bình, giá 5tr/tháng. LH [SĐT]")).json()["analysis_id"]
    api.drain()
    loc = c.get(f"{V1}/analyses/{aid}").json()["listings"][0]["location"]
    assert loc["ward_code"] is None and loc["decision"] == "needs_review" and loc["evidence"]
