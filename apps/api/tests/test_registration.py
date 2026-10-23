"""Registration behavior through the public HTTP boundary."""
import pytest

URL = "/api/v1/auth/register"


def payload(**changes):
    return {"username": "new_renter", "password": "ExamplePass7", "confirm_password": "ExamplePass7",
            "accept_terms": True, **changes}


def test_registration_creates_renter_session_and_can_login_again(api):
    client = api.client()
    response = client.post(URL, json=payload())
    assert response.status_code == 201
    assert response.json()["roles"] == ["renter"]
    assert "password" not in response.text
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie
    assert client.get("/api/v1/auth/me").json()["username"] == "new_renter"
    client.post("/api/v1/auth/logout")
    assert client.post("/api/v1/auth/login", json={"username": "new_renter", "password": "ExamplePass7"}).status_code == 200
    assert client.get("/api/v1/team/posts").status_code == 403


def test_duplicate_never_overwrites_existing_password_or_roles(api):
    client = api.client()
    response = client.post(URL, json=payload(username="admin"))
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "username_taken"
    assert "username" in response.json()["error"]["field_errors"]
    assert client.post("/api/v1/auth/login", json={"username": "admin", "password": "ExamplePass7"}).status_code == 401
    assert api.client("admin").get("/api/v1/auth/me").json()["roles"] == ["admin"]


@pytest.mark.parametrize("changes,field", [
    ({"username": "ab"}, "username"), ({"username": "space name"}, "username"),
    ({"username": "a" * 31}, "username"), ({"username": "tên"}, "username"),
    ({"password": "weak"}, "password"), ({"password": "lowercase7"}, "password"),
    ({"password": "Abcdefg"}, "password"), ({"confirm_password": "OtherPass7"}, "confirm_password"),
    ({"accept_terms": False}, "accept_terms"), ({"accept_terms": "true"}, "accept_terms"),
    ({"roles": ["admin"]}, "roles"),
])
def test_invalid_registration_is_field_scoped_and_does_not_echo_secrets(api, changes, field):
    response = api.client().post(URL, json=payload(**changes))
    assert response.status_code == 422
    assert field in response.json()["error"]["field_errors"]
    assert "ExamplePass7" not in response.text and "OtherPass7" not in response.text


def test_terms_must_be_present(api):
    body = payload()
    del body["accept_terms"]
    assert api.client().post(URL, json=body).status_code == 422


@pytest.mark.parametrize("password", ["NoDigitsHere", "Abcdefgh", "Đabcdefgh"])
def test_registration_accepts_uppercase_without_digits(api, password):
    client = api.client()
    response = client.post(URL, json=payload(password=password, confirm_password=password))
    assert response.status_code == 201
    assert password not in response.text
    assert client.get("/api/v1/auth/me").status_code == 200
    client.post("/api/v1/auth/logout")
    assert client.post("/api/v1/auth/login", json={"username": "new_renter", "password": password}).status_code == 200


def test_rate_limit_counts_invalid_attempts_and_ignores_forwarded_ip(api, monkeypatch):
    monkeypatch.setattr(api.settings, "register_rate_limit", 2, raising=False)
    monkeypatch.setattr(api.settings, "register_window_seconds", 600, raising=False)
    client = api.client()
    assert client.post(URL, json=payload(username="a")).status_code == 422
    assert client.post(URL, json=payload()).status_code == 201
    blocked = client.post(URL, json=payload(username="other_renter"), headers={"X-Forwarded-For": "192.0.2.9"})
    assert blocked.status_code == 429
    assert int(blocked.headers["retry-after"]) > 0
    assert client.post("/api/v1/auth/login", json={"username": "new_renter", "password": "ExamplePass7"}).status_code == 200


def test_secure_cookie_when_configured(api, monkeypatch):
    monkeypatch.setattr(api.settings, "cookie_secure", True)
    response = api.client().post(URL, json=payload())
    assert "secure" in response.headers["set-cookie"].lower()
