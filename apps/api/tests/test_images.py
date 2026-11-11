"""Room photos sent by the extension: signing, checks, storage and the public list."""
from app.services import images
from tests.conftest import batch, post_payload

V1 = "/api/v1"
JPEG = b"\xff\xd8\xff\xe0" + b"0" * 200
CCMN = "Cho thuê CCMN 1PN 30m2 phường Cầu Giấy, giá 5tr/th/phòng, cọc 1 tháng. LH [SĐT]"


def fake_store(calls):
    def upload(data, public_id, settings):
        calls.append(public_id)
        return {"secure_url": f"https://res.cloudinary.com/demo/image/upload/v1/{public_id}.jpg",
                "public_id": public_id, "width": 600, "height": 400}
    return upload


def enable(api, monkeypatch, calls):
    for key, value in {"CLOUDINARY_CLOUD_NAME": "demo", "CLOUDINARY_API_KEY": "1", "CLOUDINARY_API_SECRET": "s"}.items():
        monkeypatch.setenv(key, value)
    from app.core import config
    config.get_settings.cache_clear()
    monkeypatch.setattr(images, "upload_to_cloudinary", fake_store(calls))


def test_signature_matches_the_cloudinary_docs_example():
    # cloudinary.com/documentation/authentication_signatures: timestamp=1315060510 + secret "abcd"
    assert images.sign({"timestamp": 1315060510}, "abcd") == "a21ad0f63beb4de2e5575204b79ab90bffb02c10"
    assert images.sign({"timestamp": 1, "folder": "a", "public_id": "b"}, "x") == images.sign({"public_id": "b", "timestamp": 1, "folder": "a"}, "x")


def test_file_type_comes_from_the_bytes():
    assert images.sniff(JPEG) == "image/jpeg"
    assert images.sniff(b"\x89PNG\r\n\x1a\n....") == "image/png"
    assert images.sniff(b"RIFF\x00\x00\x00\x00WEBPVP8 ") == "image/webp"
    assert images.sniff(b"<svg onload=alert(1)>") is None


def test_upload_is_off_until_cloudinary_is_configured(api):
    c = api.client("collector")
    c.post(f"{V1}/ingest/batch", json=batch(post_payload("img-0", CCMN)))
    r = c.put(f"{V1}/ingest/images", params={"idempotency_key": "img-0"}, content=JPEG)
    assert r.status_code == 503 and r.json()["error"]["code"] == "images_unavailable"


def test_photo_is_stored_once_and_listed_for_contributed_posts(api, monkeypatch):
    calls = []
    enable(api, monkeypatch, calls)
    c = api.client("collector")
    assert c.put(f"{V1}/ingest/images", params={"idempotency_key": "img-1"}, content=JPEG).status_code == 404
    c.post(f"{V1}/ingest/batch", json=batch(post_payload("img-1", CCMN)))
    first = c.put(f"{V1}/ingest/images", params={"idempotency_key": "img-1"}, content=JPEG)
    again = c.put(f"{V1}/ingest/images", params={"idempotency_key": "img-1"}, content=JPEG)
    assert first.status_code == 200 and first.json()["status"] == "created"
    assert again.json()["status"] == "duplicate" and len(calls) == 1
    items = api.client().get(f"{V1}/images/recent").json()["items"]
    assert len(items) == 1 and "/image/upload/c_fill,w_720,h_480,q_auto,f_auto/" in items[0]["url"]


def test_bad_files_and_other_people_are_refused(api, monkeypatch):
    calls = []
    enable(api, monkeypatch, calls)
    c = api.client("collector")
    c.post(f"{V1}/ingest/batch", json=batch(post_payload("img-2", CCMN)))
    assert c.put(f"{V1}/ingest/images", params={"idempotency_key": "img-2"}, content=b"not an image").status_code == 415
    assert c.put(f"{V1}/ingest/images", params={"idempotency_key": "img-2"}, content=b"").status_code == 413
    # Another collector cannot attach photos to this post; renters cannot upload at all.
    assert api.client("reviewer").put(f"{V1}/ingest/images", params={"idempotency_key": "img-2"}, content=JPEG).status_code == 404
    assert api.client("renter").put(f"{V1}/ingest/images", params={"idempotency_key": "img-2"}, content=JPEG).status_code == 403
    monkeypatch.setenv("POST_IMAGE_MAX_BYTES", "100")
    from app.core import config
    config.get_settings.cache_clear()
    assert c.put(f"{V1}/ingest/images", params={"idempotency_key": "img-2"}, content=JPEG).status_code == 413
    assert calls == []


def test_photo_limit_per_post(api, monkeypatch):
    calls = []
    enable(api, monkeypatch, calls)
    monkeypatch.setenv("POST_IMAGE_MAX_PER_POST", "2")
    from app.core import config
    config.get_settings.cache_clear()
    c = api.client("collector")
    c.post(f"{V1}/ingest/batch", json=batch(post_payload("img-3", CCMN)))
    codes = [c.put(f"{V1}/ingest/images", params={"idempotency_key": "img-3"}, content=JPEG + bytes([i])).status_code for i in range(3)]
    assert codes == [200, 200, 409]
