"""Former-unit resolutions survive HTTP reads and human review, not just extraction."""
import csv
import io

import pytest
from sqlalchemy import select

from app.models import Listing, ReviewEvent
from tests.conftest import SPEC, batch, post_payload

V1 = "/api/v1"
TEXT = "Cho thuê phòng 25m2 phường 25, Bình Thạnh, giá 3tr5/tháng/phòng"
# Without "/phòng" the rent is still for the whole room (task N infers per_unit), so a per-person signal is what
# keeps the basis unknown and the listing in the review queue.
BASIS_UNKNOWN_TEXT = TEXT.removesuffix("/phòng") + ", cho ở ghép 2 người"


def request_ok(client, method, url, **kwargs):
    response = client.request(method, url, **kwargs)
    assert response.status_code == 200, response.text
    return response


def test_openapi_location_resolution_matches_extraction_schema(api):
    import json

    schema = json.loads((SPEC / "schemas/listing-extraction.schema.json").read_text(encoding="utf-8"))
    expected = schema["$defs"]["location"]["properties"]["resolution"]["enum"]
    actual = request_ok(api.client(), "GET", "/openapi.json").json()
    assert actual["components"]["schemas"]["Location"]["properties"]["resolution"]["enum"] == expected


def create_former_listing(api, entry, text=TEXT):
    collector = api.client("collector")
    if entry == "analyses":
        response = collector.post(f"{V1}/analyses", json=post_payload("former-analysis", text))
        assert response.status_code == 202, response.text
        post_id = response.json()["analysis_id"]
    else:
        response = collector.post(f"{V1}/ingest/batch", json=batch(post_payload("former-ingest", text)))
        assert response.status_code == 200, response.text
        assert response.json()["summary"] == {"created": 1, "duplicate": 0, "rejected": 0}
        post_id = response.json()["results"][0]["post_id"]
    assert api.drain() == 1
    with api.session() as session:
        listing = session.scalars(select(Listing).where(Listing.post_id == post_id)).one()
        location = next(field for field in listing.fields if field.field == "location").value_json
        assert location["resolution"] == "from_former_unit"
        assert location["ward_code"] == "26956"
        listing_id, version = listing.id, listing.version
    if entry == "analyses":
        assert collector.post(f"{V1}/analyses/{post_id}/contribute").json() == {"contributed": True}
    return collector, post_id, listing_id, version


def assert_former(location):
    assert location["resolution"] == "from_former_unit"
    assert location["ward_code"] == "26956"
    assert location["old_ward_name"] == "Phường 25"
    assert location["old_district_name"] == "Quận Bình Thạnh"


@pytest.mark.parametrize("entry", ["analyses", "ingest"])
@pytest.mark.parametrize("endpoint", [
    "analysis", "public_detail", "public_list", "review_detail", "review_queue",
    "decision", "export_json", "export_csv", "comparison", "team_posts", "lab",
])
def test_former_listing_http_endpoints(api, entry, endpoint):
    text = BASIS_UNKNOWN_TEXT if endpoint == "review_queue" else TEXT
    collector, post_id, listing_id, version = create_former_listing(api, entry, text)
    reviewer = api.client("reviewer")
    if endpoint in ("public_detail", "public_list", "comparison"):
        approved = request_ok(reviewer, "POST", f"{V1}/team/reviews/{listing_id}/decision",
                              json={"action": "approve", "expected_version": version})
        assert approved.json()["review_status"] == "approved"
    if endpoint == "analysis":
        body = request_ok(collector, "GET", f"{V1}/analyses/{post_id}").json()
        assert body["status"] == "succeeded"
        assert_former(body["listings"][0]["location"])
    elif endpoint == "public_detail":
        body = request_ok(api.client(), "GET", f"{V1}/listings/{listing_id}").json()
        assert_former(body["listing"]["location"])
    elif endpoint == "public_list":
        body = request_ok(api.client(), "GET", f"{V1}/listings").json()
        assert body["total"] == 1
        assert body["items"][0]["listing_id"] == listing_id
        assert body["items"][0]["ward_name"] == "Phường Thạnh Mỹ Tây"
    elif endpoint == "review_detail":
        body = request_ok(reviewer, "GET", f"{V1}/team/reviews/{listing_id}").json()
        assert_former(body["listing"]["location"])
    elif endpoint == "review_queue":
        body = request_ok(reviewer, "GET", f"{V1}/team/reviews").json()
        assert body["total"] == 1
        assert [item["listing_id"] for item in body["items"]] == [listing_id]
        assert "basis_unknown" in body["items"][0]["reasons"]
    elif endpoint == "decision":
        body = request_ok(reviewer, "POST", f"{V1}/team/reviews/{listing_id}/decision",
                          json={"action": "approve", "expected_version": version}).json()
        assert body["review_status"] == "approved" and body["version"] == version + 1
        with api.session() as session:
            assert_former(next(field for field in session.get(Listing, listing_id).fields
                               if field.field == "location").value_json)
    elif endpoint.startswith("export_"):
        fmt = endpoint.removeprefix("export_")
        response = request_ok(api.client("researcher"), "GET", f"{V1}/team/export", params={"format": fmt})
        items = response.json()["items"] if fmt == "json" else list(csv.DictReader(io.StringIO(response.text)))
        assert len(items) == 1 and items[0]["listing_id"] == listing_id
        assert items[0]["location_resolution"] == "from_former_unit"
    elif endpoint == "comparison":
        body = request_ok(api.client(), "GET", f"{V1}/listings/{listing_id}/comparison").json()
        assert body["criteria"]["ward_code"] == "26956"
    elif endpoint == "team_posts":
        body = request_ok(reviewer, "GET", f"{V1}/team/posts").json()
        assert body["total"] == 1 and body["items"][0]["post_id"] == post_id
    elif endpoint == "lab":
        body = request_ok(api.client("researcher"), "POST", f"{V1}/lab/run", json={"post_id": post_id}).json()
        assert body["post_id"] == post_id
        assert_former(body["listings"]["regex"][0]["location"])


@pytest.mark.parametrize("entry", ["analyses", "ingest"])
@pytest.mark.parametrize("resolution", ["from_former_unit", "exact", "from_street", "from_landmark", "unresolved"])
def test_reviewer_can_keep_or_change_former_resolution(api, entry, resolution):
    _, _, listing_id, version = create_former_listing(api, entry, BASIS_UNKNOWN_TEXT)
    with api.session() as session:
        assert session.get(Listing, listing_id).review_status == "needs_review"
    reviewer = api.client("reviewer")
    body = request_ok(reviewer, "POST", f"{V1}/team/reviews/{listing_id}/decision", json={
        "action": "approve", "expected_version": version,
        "fields": {"location": {"resolution": resolution}}, "reason": "Đã kiểm tra căn cứ vị trí",
    }).json()
    assert body["review_status"] == "approved" and body["version"] == version + 1
    detail = request_ok(reviewer, "GET", f"{V1}/team/reviews/{listing_id}").json()
    location = detail["listing"]["location"]
    assert location["resolution"] == resolution
    assert location["agreement"] == "human"
    public = request_ok(api.client(), "GET", f"{V1}/listings/{listing_id}").json()
    assert public["listing"]["location"]["resolution"] == resolution
    with api.session() as session:
        event = session.scalars(select(ReviewEvent).where(ReviewEvent.listing_id == listing_id)).one()
        assert event.before_json["listing"]["location"]["resolution"] == "from_former_unit"
        assert event.after_json["listing"]["location"]["resolution"] == resolution


@pytest.mark.parametrize("entry", ["analyses", "ingest"])
def test_whole_room_price_without_the_room_suffix_gets_an_inferred_basis(api, entry):
    """Task N: this text used to stay basis_unknown (needs_review); the rent is for the whole room."""
    _, _, listing_id, _ = create_former_listing(api, entry, TEXT.removesuffix("/phòng"))
    with api.session() as session:
        listing = session.get(Listing, listing_id)
        assert listing.rent_basis == "per_unit" and listing.review_status == "auto_accepted"
        assert "basis_unknown" not in (listing.review_reasons or [])
        rent = next(field for field in listing.fields if field.field == "rent")
        assert rent.value_json["basis"] == "per_unit"
        assert "CTX_BASIS_UNIT_WHOLE" in rent.evidence[0].rule_id
