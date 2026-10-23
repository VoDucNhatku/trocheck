import json
import os
from functools import lru_cache
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]
SPEC = REPO / "spec"
FIXTURES = SPEC / "fixtures"

# Tests never read the developer's .env or the real DB.
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ["RENER_PBKDF2_ROUNDS"] = "1000"
os.environ["GEMINI_API_KEY"] = ""


@lru_cache
def extraction_validator():
    from jsonschema import Draft202012Validator
    from referencing import Registry, Resource

    registry = Registry()
    for path in (SPEC / "schemas").glob("*.schema.json"):
        schema = json.loads(path.read_text(encoding="utf-8"))
        resource = Resource.from_contents(schema)
        registry = registry.with_resources([(schema["$id"], resource), (path.name, resource)])
    schema = json.loads((SPEC / "schemas" / "listing-extraction.schema.json").read_text(encoding="utf-8"))
    return Draft202012Validator(schema, registry=registry)


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURES / f"{name}.json").read_text(encoding="utf-8"))


@pytest.fixture
def fixture_doc():
    return load_fixture


# --- API fixtures ---------------------------------------------------------------------

PASSWORD = "test-pass"


@pytest.fixture
def api(tmp_path, monkeypatch):
    """Fresh SQLite DB + TestClient + one user per role. Returns a small helper object."""
    from fastapi.testclient import TestClient

    from app.core import config, db
    from app.core.db import Base
    import app.models  # noqa: F401
    from app.services import users

    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{(tmp_path / 'test.sqlite').as_posix()}")
    monkeypatch.setenv("DEMO_MODE", "false")
    monkeypatch.setenv("EVAL_RUNS_DIR", str(tmp_path / "runs"))
    config.get_settings.cache_clear()
    engine = db.configure()
    Base.metadata.create_all(engine)
    with db.session_scope() as session:
        for name, roles in {"admin": ["admin"], "reviewer": ["reviewer", "collector"], "reviewer2": ["reviewer"],
                            "collector": ["collector"], "researcher": ["researcher"], "renter": ["renter"]}.items():
            users.create_user(session, name, PASSWORD, roles)

    from app.main import create_app

    class Api:
        settings = config.get_settings()

        def client(self, username=None):
            c = TestClient(create_app())
            if username:
                r = c.post("/api/v1/auth/login", json={"username": username, "password": PASSWORD})
                assert r.status_code == 200, r.text
            return c

        def drain(self, llm=None):
            from app.worker.run import drain
            return drain(config.get_settings(), llm)

        def set_demo(self, value: bool):
            monkeypatch.setenv("DEMO_MODE", "true" if value else "false")
            config.get_settings.cache_clear()
            self.settings = config.get_settings()

        def session(self):
            return db.session_factory()()

    yield Api()
    engine.dispose()
    config.get_settings.cache_clear()


def post_payload(key: str, text: str, **extra) -> dict:
    return {"idempotency_key": key, "source_type": "facebook_group", "text": text, "text_complete": True,
            "phone_masked": True, **extra}


def batch(*posts) -> dict:
    return {"client": {"extension_version": "0.1.0", "session_id": "s-test"}, "posts": list(posts)}
