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
    assert query["scope"] == ["openid email profile"]
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
        return "google-subject-123", "renter@example.com", "Nguyễn An"
    monkeypatch.setattr(auth_google, "identity", profile)
    client, cookie, query = begin(google)
    response = finish(client, cookie, query["state"][0])
    assert response.status_code == 200 and response.json() == {"next": "/tai-khoan"}
    assert "HttpOnly" in response.headers["set-cookie"]
    me = client.get("/api/v1/auth/me").json()
    assert me["roles"] == ["renter"]
    assert me["email"] == "renter@example.com" and me["display_name"] == "Nguyễn An"
    assert me["google_connected"] is True and me["local_login_enabled"] is False
    assert "google_subject" not in me and "password_hash" not in me
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
        return "different-google-subject", "admin@example.com", None
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
        return httpx.Response(200, json={"sub": "verified-sub", "email": "Example@Example.com",
                                        "name": " Nguyễn An ", "email_verified": kind != "unverified"})
    monkeypatch.setattr(auth_google.httpx, "AsyncClient", lambda **kwargs: factory(transport=httpx.MockTransport(provider), **kwargs))
    import asyncio
    if kind == "ok":
        assert asyncio.run(auth_google.identity("code", "verifier", google.settings)) == ("verified-sub", "example@example.com", "Nguyễn An")
    else:
        with pytest.raises(ApiError) as error:
            asyncio.run(auth_google.identity("code", "verifier", google.settings))
        assert error.value.status in (401, 503)
        assert "private-access-token" not in str(error.value)


def test_google_migration_preserves_existing_password_user(database_url):
    from pathlib import Path
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import MetaData, Table, inspect
    from app.core.db import make_engine
    from app.core.ids import utcnow
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    url = database_url
    config.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    command.upgrade(config, "0002")
    engine = make_engine(url)
    users = Table("users", MetaData(), autoload_with=engine)
    with engine.begin() as connection:
        connection.execute(users.insert().values(id="existing", username="existing", password_hash="preserved-hash",
                                                  roles=["admin"], auth_version=3, created_at=utcnow()))
    command.upgrade(config, "head")
    upgraded = Table("users", MetaData(), autoload_with=engine)
    reset_tokens = Table("password_reset_tokens", MetaData(), autoload_with=engine)
    with engine.begin() as connection:
        connection.execute(reset_tokens.insert().values(id="preserved-token", user_id="existing", token_hash="synthetic-hash",
                                                        created_at=utcnow(), expires_at=utcnow()))
    with engine.connect() as connection:
        row = connection.execute(select(upgraded)).mappings().one()
        assert row["password_hash"] == "preserved-hash" and row["roles"] == ["admin"]
        assert row["auth_version"] == 3 and row["google_subject"] is None
        assert row["display_name"] is None
    command.downgrade(config, "0002")
    assert "google_subject" not in {c["name"] for c in inspect(engine).get_columns("users")}
    assert "display_name" not in {c["name"] for c in inspect(engine).get_columns("users")}
    with engine.connect() as connection:
        assert connection.execute(select(reset_tokens.c.id)).scalars().all() == ["preserved-token"]
    engine.dispose()


def test_existing_google_profile_is_refreshed_without_changing_roles(google):
    with google.session() as session:
        user = auth_google.resolve_user(session, "legacy-sub", "old@example.com")
        user.roles = ["reviewer"]
        session.commit()
        original_id = user.id
        refreshed = auth_google.resolve_user(session, "legacy-sub", "new@example.com", "Nguyễn Bình")
        assert refreshed.id == original_id and refreshed.roles == ["reviewer"]
        assert refreshed.email == "new@example.com" and refreshed.display_name == "Nguyễn Bình"
        assert refreshed.password_hash == ""
        # A missing optional name on a later login must not erase the stored name.
        assert auth_google.resolve_user(session, "legacy-sub", "new@example.com").display_name == "Nguyễn Bình"


def test_google_profile_email_conflict_does_not_take_over_local_identity(google):
    with google.session() as session:
        local = session.scalar(select(User).where(User.username == "admin"))
        local.email = "local@example.com"
        session.commit()
        google_user = auth_google.resolve_user(session, "separate-sub", "google@example.com")
        refreshed = auth_google.resolve_user(session, "separate-sub", "local@example.com", "Tên mới")
        assert refreshed.id == google_user.id and refreshed.email == "google@example.com"
        assert refreshed.roles == ["renter"] and local.google_subject is None


def test_local_session_exposes_only_public_account_fields(api):
    me = api.client("admin").get("/api/v1/auth/me").json()
    assert me["google_connected"] is False and me["local_login_enabled"] is True
    assert me["display_name"] is None and me["email"] is None
    assert set(me) == {"user_id", "username", "roles", "email", "display_name", "google_connected", "local_login_enabled"}


def test_google_only_account_cannot_request_password_reset(google, caplog):
    from app.models import PasswordResetToken
    from app.services import auth_password
    google.settings.password_reset_dev_log = True
    with google.session() as session:
        auth_google.resolve_user(session, "passwordless", "google@example.com")
        auth_password.forgot(session, "google@example.com", google.settings)
        assert session.scalar(select(PasswordResetToken)) is None
    assert "password reset link" not in caplog.text


def test_google_callback_is_limited_before_contacting_provider(google, monkeypatch):
    async def unexpected(*args):
        pytest.fail("Invalid state or blocked callback must not contact Google")
    monkeypatch.setattr(auth_google, "identity", unexpected)
    google.settings.register_rate_limit = 1000
    client = google.client()
    for _ in range(30):
        assert finish(client, "", "wrong").status_code == 400
    response = finish(client, "", "wrong")
    assert response.status_code == 429 and int(response.headers["Retry-After"]) > 0


def test_google_callback_limits_verified_subject(google, monkeypatch):
    async def profile(*args):
        return "same-subject", "same@example.com", "Tên thử"
    monkeypatch.setattr(auth_google, "identity", profile)
    client, cookie, query = begin(google)
    for _ in range(5):
        assert finish(client, cookie, query["state"][0]).status_code == 200
    assert finish(client, cookie, query["state"][0]).status_code == 429
