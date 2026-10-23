"""OAuth trust boundaries and compatibility with existing password sessions."""
import base64
import hashlib
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
from sqlalchemy import select

from app.core import security
from app.core.errors import ApiError
from app.models import User
from app.services import auth_google

START = "/api/v1/auth/google/start"
CALLBACK = "/api/v1/auth/google/callback"


@pytest.fixture
def google(api, monkeypatch):
    api.settings.google_client_id = "test-client.apps.googleusercontent.com"
    api.settings.google_client_secret = "test-google-secret"
    api.settings.google_redirect_uri = "https://trocheck.vercel.app/api/auth/google/callback"
    return api


def begin(api, next="/tai-khoan"):
    client = api.client()
    response = client.get(START, params={"next": next})
    assert response.status_code == 200
    # In production the browser sends this path-scoped cookie to the Next callback;
    # the BFF explicitly forwards it to the API's differently named path.
    cookie = client.cookies.get(auth_google.COOKIE)
    query = parse_qs(urlsplit(response.json()["authorization_url"]).query)
    return client, cookie, query


def finish(client, cookie, state, code="test-code"):
    return client.post(CALLBACK, headers={"Cookie": auth_google.COOKIE + "=" + cookie},
                       json={"code": code, "state": state})


def test_disabled_until_configured(api):
    api.settings.google_client_id = ""
    response = api.client().get(START)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "google_not_configured"


def test_start_uses_pkce_and_signed_expiring_cookie(google):
    client, cookie, query = begin(google)
    response = client.get(START)
    header = response.headers["set-cookie"]
    assert "HttpOnly" in header and "SameSite=lax" in header and "Max-Age=600" in header
    assert "Path=/api/auth/google" in header
    transaction = auth_google.read_transaction(cookie, query["state"][0], google.settings)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(transaction["verifier"].encode()).digest()).rstrip(b"=").decode()
    assert query["code_challenge"] == [challenge]
    assert query["code_challenge_method"] == ["S256"]
    assert query["scope"] == ["openid email"]
    assert google.settings.google_client_secret not in response.text
    assert query["state"] != parse_qs(urlsplit(response.json()["authorization_url"]).query)["state"]


@pytest.mark.parametrize("kind", ["missing", "tampered", "wrong-state", "expired", "unicode"])
def test_invalid_transaction_never_contacts_google(google, monkeypatch, kind):
    async def unexpected(*args):
        pytest.fail("Invalid transactions must not contact Google")
    monkeypatch.setattr(auth_google, "identity", unexpected)
    client, cookie, query = begin(google)
    state = query["state"][0]
    if kind == "missing":
        cookie = ""
    elif kind == "tampered":
        cookie = "x" + cookie
    elif kind == "wrong-state":
        state = "another-browser-state"
    elif kind == "unicode":
        state = "é"
    else:
        now = auth_google.time.time()
        monkeypatch.setattr(auth_google.time, "time", lambda: now + 601)
    response = finish(client, cookie, state)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "google_state_invalid"
    assert google.settings.session_cookie_name not in response.cookies


def test_google_creates_renter_and_reuses_subject(google, monkeypatch):
    async def profile(*args):
        return "google-subject-123", "renter@example.com"
    monkeypatch.setattr(auth_google, "identity", profile)
    client, cookie, query = begin(google)
    response = finish(client, cookie, query["state"][0])
    assert response.status_code == 200 and response.json() == {"next": "/tai-khoan"}
    assert "HttpOnly" in response.headers["set-cookie"]
    me = client.get("/api/v1/auth/me").json()
    assert me["roles"] == ["renter"]
    with google.session() as session:
        user = session.get(User, me["user_id"])
        assert user.google_subject == "google-subject-123" and user.email == "renter@example.com"
        assert not security.verify_password("", user.password_hash)
    assert client.get("/api/v1/team/users").status_code == 403
    client.post("/api/v1/auth/logout")
    assert client.get("/api/v1/auth/me").status_code == 401
    again, cookie, query = begin(google)
    assert finish(again, cookie, query["state"][0]).status_code == 200
    assert again.get("/api/v1/auth/me").json()["user_id"] == me["user_id"]


def test_email_match_does_not_link_or_elevate_existing_user(google, monkeypatch):
    with google.session() as session:
        admin = session.scalar(select(User).where(User.username == "admin"))
        admin.email = "admin@example.com"
        session.commit()
    async def profile(*args):
        return "different-google-subject", "admin@example.com"
    monkeypatch.setattr(auth_google, "identity", profile)
    client, cookie, query = begin(google)
    response = finish(client, cookie, query["state"][0])
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "google_account_conflict"
    assert client.get("/api/v1/auth/me").status_code == 401
    with google.session() as session:
        assert session.scalar(select(User).where(User.username == "admin")).google_subject is None
    assert google.client("admin").get("/api/v1/auth/me").json()["roles"] == ["admin"]


@pytest.mark.parametrize("kind", ["ok", "unverified", "invalid-json", "denied", "timeout", "redirect"])
def test_identity_only_trusts_google_userinfo(google, monkeypatch, kind):
    factory = httpx.AsyncClient
    def provider(request):
        if kind == "timeout":
            raise httpx.ReadTimeout("synthetic timeout", request=request)
        if str(request.url) == auth_google.TOKEN_URL:
            form = parse_qs(request.content.decode())
            assert form["client_secret"] == [google.settings.google_client_secret]
            assert form["code_verifier"] == ["verifier"]
            if kind == "denied":
                return httpx.Response(400, json={"error": "invalid_grant"})
            if kind == "redirect":
                return httpx.Response(302, headers={"Location": "https://untrusted.invalid"})
            return httpx.Response(200, json={"access_token": "private-access-token", "token_type": "Bearer"})
        assert str(request.url) == auth_google.USERINFO_URL
        assert request.headers["Authorization"] == "Bearer private-access-token"
        if kind == "invalid-json":
            return httpx.Response(200, text="not-json")
        return httpx.Response(200, json={"sub": "verified-sub", "email": "Example@Example.com", "email_verified": kind != "unverified"})
    monkeypatch.setattr(auth_google.httpx, "AsyncClient", lambda **kwargs: factory(transport=httpx.MockTransport(provider), **kwargs))
    import asyncio
    if kind == "ok":
        assert asyncio.run(auth_google.identity("code", "verifier", google.settings)) == ("verified-sub", "example@example.com")
    else:
        with pytest.raises(ApiError) as error:
            asyncio.run(auth_google.identity("code", "verifier", google.settings))
        assert error.value.status in (401, 503)
        assert "private-access-token" not in str(error.value)


def test_google_migration_preserves_existing_password_user(tmp_path):
    from pathlib import Path
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import MetaData, Table, inspect
    from app.core.db import make_engine
    from app.core.ids import utcnow
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    url = f"sqlite:///{(tmp_path / 'google-migration.sqlite').as_posix()}"
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "0002")
    engine = make_engine(url)
    users = Table("users", MetaData(), autoload_with=engine)
    with engine.begin() as connection:
        connection.execute(users.insert().values(id="existing", username="existing", password_hash="preserved-hash",
                                                  roles=["admin"], auth_version=3, created_at=utcnow()))
    command.upgrade(config, "head")
    upgraded = Table("users", MetaData(), autoload_with=engine)
    with engine.connect() as connection:
        row = connection.execute(select(upgraded)).mappings().one()
        assert row["password_hash"] == "preserved-hash" and row["roles"] == ["admin"]
        assert row["auth_version"] == 3 and row["google_subject"] is None
    command.downgrade(config, "0002")
    assert "google_subject" not in {c["name"] for c in inspect(engine).get_columns("users")}
    engine.dispose()
