"""Password recovery through the HTTP boundary, using an isolated database."""
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from urllib.parse import parse_qs, urlsplit

import pytest
from sqlalchemy import select

from app.core.ids import utcnow

FORGOT = "/api/v1/auth/password/forgot"
RESET = "/api/v1/auth/password/reset"


def account(api):
    client = api.client()
    result = client.post("/api/v1/auth/register", json={
        "username": "recover_renter", "email": "Recover@Example.com", "password": "OriginalPass",
        "confirm_password": "OriginalPass", "accept_terms": True,
    })
    assert result.status_code == 201
    return client


def issue(api, client, caplog):
    api.settings.password_reset_dev_log = True
    with caplog.at_level(logging.WARNING, logger="app.services.auth_password"):
        response = client.post(FORGOT, json={"email": "recover@example.com"})
    assert response.status_code == 202
    link = next(r.args[0] for r in reversed(caplog.records) if r.name == "app.services.auth_password")
    token = parse_qs(urlsplit(link).fragment)["token"][0]
    assert token not in response.text and "dat-lai-mat-khau" not in response.text
    return token


def reset_body(token, password="UpdatedPass"):
    return {"token": token, "password": password, "confirm_password": password}


def test_reset_is_once_and_revokes_sessions_and_extension_tokens(api, caplog):
    client = account(api)
    session_cookie = client.cookies.get("rener_session")
    from app.models import ExtensionToken, User
    from app.core import security
    with api.session() as session:
        user = session.scalar(select(User).where(User.username == "recover_renter"))
        session.add(ExtensionToken(user_id=user.id, token_hash=security.token_hash("synthetic-token"),
                                   expires_at=utcnow() + timedelta(days=1)))
        session.commit()
    token = issue(api, client, caplog)
    result = client.post(RESET, json=reset_body(token))
    assert result.status_code == 200
    assert "UpdatedPass" not in result.text
    assert client.post(RESET, json=reset_body(token)).status_code == 400
    assert client.get("/api/v1/auth/me").status_code == 401
    old = api.client()
    old.cookies.set("rener_session", session_cookie)
    assert old.get("/api/v1/auth/me").status_code == 401
    assert old.get("/api/v1/auth/me", headers={"Authorization": "Bearer synthetic-token"}).status_code == 401
    assert old.post("/api/v1/auth/login", json={"username": "recover_renter", "password": "OriginalPass"}).status_code == 401
    assert old.post("/api/v1/auth/login", json={"username": "recover_renter", "password": "UpdatedPass"}).status_code == 200


def test_expired_token_is_rejected(api, caplog):
    from app.models import PasswordResetToken
    client = account(api)
    token = issue(api, client, caplog)
    with api.session() as session:
        row = session.scalar(select(PasswordResetToken))
        row.expires_at = utcnow() - timedelta(seconds=1)
        session.commit()
    assert client.post(RESET, json=reset_body(token)).status_code == 400


@pytest.mark.parametrize("password", ["ShortA", "lowercaseonly", "A" * 201])
def test_weak_password_does_not_consume_token(api, caplog, password):
    client = account(api)
    token = issue(api, client, caplog)
    response = client.post(RESET, json=reset_body(token, password))
    assert response.status_code == 422
    assert password not in response.text and token not in response.text
    assert client.post(RESET, json=reset_body(token)).status_code == 200


def test_mismatch_and_invalid_token(api, caplog):
    client = account(api)
    token = issue(api, client, caplog)
    assert client.post(RESET, json={**reset_body(token), "confirm_password": "DifferentPass"}).status_code == 422
    assert client.post(RESET, json=reset_body("unrecognized-token")).status_code == 400
    assert client.post(RESET, json=reset_body(token)).status_code == 200


def test_forgot_is_generic_and_rate_limited_with_202(api, caplog):
    client = account(api)
    api.settings.password_reset_dev_log = True
    with caplog.at_level(logging.WARNING):
        known = client.post(FORGOT, json={"email": "recover@example.com"})
        unknown = client.post(FORGOT, json={"email": "absent@example.com"})
        invalid = client.post(FORGOT, json={"email": "bad-address"})
        for _ in range(6):
            limited = client.post(FORGOT, json={"email": "recover@example.com"})
    assert [known.status_code, unknown.status_code, invalid.status_code, limited.status_code] == [202] * 4
    assert known.json() == unknown.json() == invalid.json() == limited.json()
    assert int(limited.headers["retry-after"]) > 0
    assert sum(r.name == "app.services.auth_password" for r in caplog.records) == 3


def test_no_link_logged_by_default_and_only_hash_stored(api, caplog):
    from app.models import PasswordResetToken
    client = account(api)
    with caplog.at_level(logging.WARNING):
        response = client.post(FORGOT, json={"email": "recover@example.com"})
    assert response.status_code == 202
    assert not [r for r in caplog.records if r.name == "app.services.auth_password"]
    with api.session() as session:
        assert session.scalar(select(PasswordResetToken)) is None
    token = issue(api, client, caplog)
    from app.core import security
    with api.session() as session:
        row = session.scalar(select(PasswordResetToken))
        assert row.token_hash == security.token_hash(token)
        assert token not in repr(row.__dict__)


def test_concurrent_redemption_only_one_succeeds(api, caplog):
    client = account(api)
    token = issue(api, client, caplog)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: api.client().post(RESET, json=reset_body(token)).status_code, range(2)))
    assert sorted(results) == [200, 400]


def test_duplicate_email_is_normalized_and_rejected(api):
    client = account(api)
    response = client.post("/api/v1/auth/register", json={
        "username": "another_renter", "email": "recover@example.com", "password": "OriginalPass",
        "confirm_password": "OriginalPass", "accept_terms": True,
    })
    assert response.status_code == 409
    assert "email" in response.json()["error"]["field_errors"]


def test_migration_preserves_existing_accounts_and_foreign_keys(tmp_path):
    from pathlib import Path
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import MetaData, Table, inspect
    from app.core.db import make_engine
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    url = f"sqlite:///{(tmp_path / 'migration.sqlite').as_posix()}"
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "0001")
    engine = make_engine(url)
    metadata = MetaData()
    users = Table("users", metadata, autoload_with=engine)
    extensions = Table("extension_tokens", metadata, autoload_with=engine)
    with engine.begin() as connection:
        connection.execute(users.insert().values(id="existing", username="existing", password_hash="hash",
                                                  roles=["renter"], created_at=utcnow()))
        connection.execute(extensions.insert().values(id="ext", user_id="existing", token_hash="h" * 64,
                                                       created_at=utcnow(), expires_at=utcnow() + timedelta(days=1)))
    command.upgrade(config, "head")
    upgraded = Table("users", MetaData(), autoload_with=engine)
    with engine.connect() as connection:
        row = connection.execute(select(upgraded)).mappings().one()
        assert row["username"] == "existing" and row["email"] is None and row["auth_version"] == 0
        assert connection.execute(select(extensions.c.user_id)).scalar_one() == "existing"
    assert "password_reset_tokens" in inspect(engine).get_table_names()
    command.downgrade(config, "0001")
    assert "password_reset_tokens" not in inspect(engine).get_table_names()
    assert "email" not in {c["name"] for c in inspect(engine).get_columns("users")}
    engine.dispose()
