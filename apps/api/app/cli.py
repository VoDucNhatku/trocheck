"""Admin commands.

    python -m app.cli init-db                      # alembic upgrade head
    python -m app.cli ensure-admin                 # first admin from ADMIN_USERNAME / ADMIN_PASSWORD
    python -m app.cli create-user NAME --roles reviewer,collector
    python -m app.cli seed [--no-generated]        # demo accounts + DEMO posts, processed
    python -m app.cli import-gold data/gold/gold-v1.jsonl
    python -m app.cli purge                        # retention (co-so-du-lieu §3)
    python -m app.cli remove-post POST_ID          # removal request
"""
from __future__ import annotations

import argparse
import getpass
import json
import os
import sys
from pathlib import Path

from app.core.config import get_settings
from app.core.db import redact_url, session_scope


def init_db() -> None:
    from alembic import command
    from alembic.config import Config

    cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    # "%" must be doubled: Alembic runs the value through ConfigParser interpolation.
    cfg.set_main_option("sqlalchemy.url", get_settings().database_url.replace("%", "%%"))
    command.upgrade(cfg, "head")
    print("Cơ sở dữ liệu sẵn sàng:", redact_url(get_settings().database_url))


def ensure_admin(_args) -> None:
    """Create the first admin on a fresh database. An existing account is never touched, so the
    command is safe on every start. The password is never printed."""
    from sqlalchemy import select

    from app.core.security import validate_password
    from app.models import User
    from app.services import users

    username = os.environ.get("ADMIN_USERNAME", "").strip()
    password = os.environ.get("ADMIN_PASSWORD", "")
    if not username or not password:
        print("ensure-admin: thiếu ADMIN_USERNAME hoặc ADMIN_PASSWORD, không thay đổi dữ liệu")
        return
    with session_scope() as session:
        if session.scalar(select(User).where(User.username == username)) is not None:
            print(f"ensure-admin: tài khoản {username} đã tồn tại, giữ nguyên")
            return
        try:
            if len(username) > 80:
                raise ValueError("ADMIN_USERNAME dài quá 80 ký tự")
            validate_password(password)
        except ValueError as exc:
            raise SystemExit(f"ensure-admin: {exc}") from None
        users.create_user(session, username, password, ["admin"])
    print(f"ensure-admin: đã tạo tài khoản quản trị {username}")


def create_user(args) -> None:
    from app.services import users

    password = args.password or os.environ.get("RENER_PASSWORD") or getpass.getpass("password: ")
    with session_scope() as session:
        user = users.create_user(session, args.username, password, args.roles.split(","))
        print(f"user {user.username} roles={user.roles}")


def seed(args) -> None:
    from app.services.seed import seed_demo
    from app.worker.run import drain

    password = args.password or os.environ.get("SEED_PASSWORD") or get_settings().seed_password
    if not password:
        raise SystemExit("Set SEED_PASSWORD in the root .env or process environment before seeding.")
    with session_scope() as session:
        result = seed_demo(session, password=password, generated=not args.no_generated)
    processed = drain(get_settings(), llm=None, demo_only=True)
    print(json.dumps({**result, "jobs_processed": processed}, ensure_ascii=False))
    print("Demo data is visible only with DEMO_MODE=true. Demo accounts share the seed password.")


def import_gold(args) -> None:
    """Load gold-v1.jsonl into gold_annotations (posts are stored as import_file, not contributed,
    so gold never enters the market). Test-split labels are stored but locked in the Lab."""
    from sqlalchemy import select

    from app.models import GoldAnnotation, Post, PostVersion, User
    from app.pipeline.preprocess import text_hash
    from app.pipeline.privacy import mask_phones
    from app.services import users

    path = Path(args.file)
    with session_scope() as session:
        owner = session.scalar(select(User).where(User.username == "gold-import"))
        if owner is None:
            owner = users.create_user(session, "gold-import", os.urandom(16).hex(), ["researcher"])
        n = 0
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            if session.scalar(select(GoldAnnotation).where(GoldAnnotation.gold_post_id == row["post_id"])):
                continue
            text = mask_phones(row["text"])
            post = Post(source_type="import_file", external_post_id=f"gold:{row['post_id']}", collector_id=owner.id,
                        mode="collect", contributed=False, is_demo=False, status="received")
            session.add(post)
            session.flush()
            version = PostVersion(post_id=post.id, text=text, text_hash=text_hash(text), text_complete=True)
            session.add(version)
            session.flush()
            post.current_version_id = version.id
            session.add(GoldAnnotation(post_version_id=version.id, gold_post_id=row["post_id"], split=row["split"],
                                       cluster_key=row.get("cluster_key"), spans_json=row.get("spans", []),
                                       listings_json=row.get("expected")))
            n += 1
        print(f"imported {n} gold posts")


def purge(_args) -> None:
    from app.services.maintenance import purge as run

    with session_scope() as session:
        print(json.dumps(run(session, get_settings())))


def remove_post(args) -> None:
    from app.services.maintenance import remove_post as run

    with session_scope() as session:
        print("removed" if run(session, args.post_id) else "not found")


def bot_review_backlog(args) -> None:
    from app.services.bot_reviews import enqueue_backlog

    if args.limit < 1:
        raise SystemExit("--limit phải là số nguyên dương")
    with session_scope() as session:
        count = enqueue_backlog(session, get_settings(), limit=args.limit)
    print(f"Đã đưa {count} công việc duyệt thử vào hàng đợi.")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("init-db")
    sub.add_parser("ensure-admin")
    p = sub.add_parser("create-user")
    p.add_argument("username")
    p.add_argument("--roles", required=True)
    p.add_argument("--password")
    p = sub.add_parser("seed")
    p.add_argument("--password")
    p.add_argument("--no-generated", action="store_true")
    p = sub.add_parser("import-gold")
    p.add_argument("file")
    sub.add_parser("purge")
    p = sub.add_parser("remove-post")
    p.add_argument("post_id")
    p = sub.add_parser("bot-review-backlog")
    p.add_argument("--limit", type=int, default=1000)
    args = parser.parse_args(argv)
    {"init-db": lambda a: init_db(), "ensure-admin": ensure_admin, "create-user": create_user, "seed": seed, "import-gold": import_gold,
     "purge": purge, "remove-post": remove_post, "bot-review-backlog": bot_review_backlog}[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())
