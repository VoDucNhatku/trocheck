"""Startup commands preserve existing credentials and roles."""
import pytest
from sqlalchemy import func, select

from app import cli
from app.models import Job, Post, User
from app.services import seed, users


def test_init_db_escapes_percent_and_hides_password(monkeypatch, capsys):
    from types import SimpleNamespace
    from alembic import command

    url = "postgres://test:encoded%25password@localhost/test?sslmode=require"
    monkeypatch.setattr(cli, "get_settings", lambda: SimpleNamespace(database_url=url))
    def upgrade(config, revision):
        assert config.get_main_option("sqlalchemy.url") == url
        assert revision == "head"
    monkeypatch.setattr(command, "upgrade", upgrade)
    cli.main(["init-db"])
    output = capsys.readouterr().out
    assert "encoded" not in output and "***@localhost/test" in output


@pytest.mark.parametrize("username,password", [(None, None), ("first-admin", None), (None, "StrongPass123")])
def test_ensure_admin_missing_variable_is_noop(api, monkeypatch, username, password):
    for key, value in (("ADMIN_USERNAME", username), ("ADMIN_PASSWORD", password)):
        if value is None:
            monkeypatch.delenv(key, raising=False)
        else:
            monkeypatch.setenv(key, value)
    with api.session() as session:
        before = session.scalar(select(func.count()).select_from(User))
    cli.main(["ensure-admin"])
    with api.session() as session:
        assert session.scalar(select(func.count()).select_from(User)) == before


def test_ensure_admin_creates_once_and_never_prints_password(api, monkeypatch, capsys):
    monkeypatch.setenv("ADMIN_USERNAME", "first-admin")
    monkeypatch.setenv("ADMIN_PASSWORD", "StrongPass123")
    cli.main(["ensure-admin"])
    with api.session() as session:
        user = users.authenticate(session, "first-admin", "StrongPass123")
        assert user is not None and user.roles == ["admin"]
        original_hash = user.password_hash
    monkeypatch.setenv("ADMIN_PASSWORD", "ChangedPass123")
    cli.main(["ensure-admin"])
    with api.session() as session:
        user = users.authenticate(session, "first-admin", "StrongPass123")
        assert user is not None and user.password_hash == original_hash and user.roles == ["admin"]
        assert users.authenticate(session, "first-admin", "ChangedPass123") is None
        assert session.scalar(select(func.count()).select_from(User).where(User.username == "first-admin")) == 1
    output = capsys.readouterr().out
    assert "StrongPass123" not in output and "ChangedPass123" not in output


@pytest.mark.parametrize("username", ["renter", "admin"])
def test_ensure_admin_preserves_existing_account(api, monkeypatch, username):
    with api.session() as session:
        user = session.scalar(select(User).where(User.username == username))
        before = (user.id, user.password_hash, user.roles)
    monkeypatch.setenv("ADMIN_USERNAME", username)
    # Even an invalid replacement password must not touch an existing account.
    monkeypatch.setenv("ADMIN_PASSWORD", "weak")
    cli.main(["ensure-admin"])
    with api.session() as session:
        user = session.scalar(select(User).where(User.username == username))
        assert (user.id, user.password_hash, user.roles) == before


@pytest.mark.parametrize("password", ["short", "lowercaseonly", "A" * 201])
def test_ensure_admin_reuses_password_rules(api, monkeypatch, password):
    monkeypatch.setenv("ADMIN_USERNAME", "first-admin")
    monkeypatch.setenv("ADMIN_PASSWORD", password)
    with pytest.raises(SystemExit):
        cli.main(["ensure-admin"])
    with api.session() as session:
        assert session.scalar(select(User).where(User.username == "first-admin")) is None


def test_ensure_admin_rejects_overlong_username(api, monkeypatch):
    monkeypatch.setenv("ADMIN_USERNAME", "a" * 81)
    monkeypatch.setenv("ADMIN_PASSWORD", "StrongPass123")
    with pytest.raises(SystemExit, match="80"):
        cli.main(["ensure-admin"])
    with api.session() as session:
        assert session.scalar(select(User).where(User.username == "a" * 81)) is None


def test_seed_repeated_preserves_users_posts_and_jobs(api):
    with api.session() as session:
        before = [(u.id, u.password_hash, u.roles) for u in session.scalars(select(User).order_by(User.id))]
        seed.seed_demo(session, password="FirstSeed123", generated=False)
        first_posts = session.scalar(select(func.count()).select_from(Post))
        first_jobs = session.scalar(select(func.count()).select_from(Job))
        assert first_posts > 0 and first_jobs > 0
    with api.session() as session:
        result = seed.seed_demo(session, password="ChangedSeed123", generated=False)
        assert result["posts_created"] == 0
        assert session.scalar(select(func.count()).select_from(Post)) == first_posts
        assert session.scalar(select(func.count()).select_from(Job)) == first_jobs
        after = [(u.id, u.password_hash, u.roles) for u in session.scalars(select(User).order_by(User.id))]
        assert before == after


@pytest.mark.parametrize("expired", [False, True])
def test_seed_only_processes_demo_jobs(api, monkeypatch, expired):
    from datetime import timedelta
    from app.core.ids import utcnow
    from app.models import ExtractionRun, Listing, PostVersion
    from tests.conftest import batch, post_payload

    response = api.client("collector").post("/api/v1/ingest/batch", json=batch(
        post_payload("real-before-seed", "Cho thuê phòng 25m2 giá 3tr/tháng gần trường")))
    assert response.status_code == 200
    with api.session() as session:
        real_job = session.scalars(select(Job)).one()
        real_job_id = real_job.id
        version_id = real_job.post_version_id
        if expired:
            real_job.status = "running"
            real_job.locked_until = utcnow() - timedelta(seconds=1)
            session.commit()
        before = (real_job.status, real_job.attempt, real_job.locked_until)
    monkeypatch.setenv("SEED_PASSWORD", "SeedTest123")
    cli.main(["seed", "--no-generated"])
    with api.session() as session:
        real_job = session.get(Job, real_job_id)
        assert (real_job.status, real_job.attempt, real_job.locked_until) == before
        assert session.scalar(select(ExtractionRun).where(ExtractionRun.post_version_id == version_id)) is None
        demo_jobs = session.scalars(select(Job).join(PostVersion, Job.post_version_id == PostVersion.id)
            .join(Post, PostVersion.post_id == Post.id).where(Post.is_demo.is_(True))).all()
        assert demo_jobs and all(job.status == "succeeded" for job in demo_jobs)
        assert session.scalar(select(func.count()).select_from(Listing).join(Post).where(Post.is_demo.is_(True))) > 0


@pytest.mark.parametrize("legacy", [False, True])
def test_seed_purge_seed_keeps_demo_posts_and_listings(api, monkeypatch, legacy):
    from datetime import timedelta
    from sqlalchemy import update
    from app.core.ids import utcnow
    from app.models import IdempotencyKey, Listing

    monkeypatch.setenv("SEED_PASSWORD", "SeedTest123")
    cli.main(["seed"])
    with api.session() as session:
        posts = session.scalar(select(func.count()).select_from(Post).where(Post.is_demo.is_(True)))
        listings = session.scalar(select(func.count()).select_from(Listing))
        assert posts == 94 and listings > 0
        if legacy:
            session.execute(update(Post).where(Post.is_demo.is_(True)).values(external_post_id=None))
        session.execute(update(IdempotencyKey).values(created_at=utcnow() - timedelta(days=8)))
        session.commit()
    cli.main(["purge"])
    with api.session() as session:
        assert session.scalar(select(func.count()).select_from(IdempotencyKey)) == 0
    cli.main(["seed"])
    with api.session() as session:
        assert session.scalar(select(func.count()).select_from(Post).where(Post.is_demo.is_(True))) == posts
        assert session.scalar(select(func.count()).select_from(Listing)) == listings


@pytest.mark.parametrize("password", ["short", "lowercaseonly", "A" * 201])
def test_start_script_continues_after_admin_refusal(api, monkeypatch, capsys, tmp_path, password):
    import os
    import subprocess
    from pathlib import Path

    monkeypatch.setenv("ADMIN_USERNAME", "first-admin")
    monkeypatch.setenv("ADMIN_PASSWORD", password)
    with pytest.raises(SystemExit) as error:
        cli.main(["ensure-admin"])
    assert error.value.code and password not in str(error.value)
    # Execute the real startup script with command stubs; no worker or server is started.
    script = Path(__file__).resolve().parents[1] / "deploy/start.sh"
    server = tmp_path / "uvicorn"
    server.write_text("#!/bin/sh\nprintf 'API_STARTED\\n'\n", encoding="utf-8")
    server.chmod(0o755)
    harness = '''
python() {
    if [ "$3" = "ensure-admin" ]; then return 1; fi
    return 0
}
sleep() { return 1; }
export DEMO_MODE=false
export PATH="$2:$PATH"
. "$1"
'''
    stub_path = tmp_path.as_posix()
    if os.name == "nt":
        stub_path = "/" + stub_path[0].lower() + stub_path[2:]
    result = subprocess.run(["sh", "-c", harness, "test-start", script.as_posix(), stub_path],
                            capture_output=True, text=True, encoding="utf-8", timeout=10, env=os.environ.copy())
    assert result.returncode == 0 and "API_STARTED" in result.stdout
    assert result.stdout.count("ensure-admin:") == 1
    assert "tiếp tục khởi động" in result.stdout
    assert password not in result.stdout + result.stderr + capsys.readouterr().out
