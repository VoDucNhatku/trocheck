"""Demo data (make seed): accounts per role, spec/fixtures and generated demo posts.

Everything here is marked is_demo = true: shown only in demo mode, never counted in real
statistics or evaluation (AT17). Generated posts are invented text in DEMO wards.
"""
from __future__ import annotations

import json
import random
from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.config import REPO_ROOT
from app.core.ids import iso, utcnow
from app.models import IdempotencyKey, Post
from app.schemas import IngestPost
from app.services import ingest, users

DEMO_USERS = {
    "admin": ["admin"],
    "reviewer": ["reviewer", "collector"],
    "collector": ["collector"],
    "researcher": ["researcher"],
    "renter": ["renter"],
}

WARDS = ["phường Cầu Giấy", "phường Yên Hòa", "phường Nghĩa Đô"]
OPENERS = ["Cho thuê", "Còn trống", "Cần cho thuê", "Chính chủ cho thuê", "Trống sẵn, cho thuê"]
EXTRAS = ["thang máy", "ban công", "cửa sổ thoáng", "máy giặt riêng", "giờ giấc tự do", "khóa vân tay",
          "để xe miễn phí", "bếp riêng", "gần siêu thị", "an ninh tốt", "điều hòa", "nóng lạnh"]


def create_demo_users(session: Session, password: str) -> list[str]:
    for name, roles in DEMO_USERS.items():
        users.create_user(session, name, password, roles)
    session.commit()
    return list(DEMO_USERS)


def _post(text: str, key: str, posted_at, source_type: str = "fixture") -> IngestPost:
    return IngestPost.model_validate({
        "idempotency_key": key, "source_type": source_type, "text": text, "text_complete": True,
        "phone_masked": True, **({"posted_at": iso(posted_at)} if posted_at else {}),
    })


def generated_posts(n_per_cell: int = 14, seed: int = 7) -> list[tuple[str, str, int]]:
    """(key, text, days_ago) for ward x {ccmn, phong_tro}. Prices vary by type and ward."""
    rng = random.Random(seed)
    out = []
    for w, ward in enumerate(WARDS):
        for ptype in ("ccmn", "phong_tro"):
            for i in range(n_per_cell):
                # One area band per type ([30,40) and [20,30)) so demo groups reach N >= 10.
                area = rng.randint(30, 39) if ptype == "ccmn" else rng.randint(20, 29)
                base = (140_000 if ptype == "ccmn" else 110_000) * area + w * 250_000
                price_k = int(round(base * rng.uniform(0.85, 1.2) / 100_000)) * 100
                tr, rest = divmod(price_k, 1000)
                price = f"{tr}tr{rest // 100}" if rest else f"{tr}tr"
                extras = ", ".join(rng.sample(EXTRAS, 3))
                kind = "CCMN 1PN" if ptype == "ccmn" else "phòng trọ khép kín"
                unit = "/tháng" if ptype == "ccmn" else "/th/phòng"
                # "nước …/người" would (correctly) block CTX_BASIS_UNIT_SINGLE, so CCMN posts avoid it.
                fees = ["điện 3k5/số", "cọc 1 tháng", "điện 4k/số", "nước 20k/khối"]
                fee = rng.choice(fees if ptype == "ccmn" else fees + ["nước 100k/người"])
                text = (f"{rng.choice(OPENERS)} {kind} {area}m2 {ward}, {extras}. "
                        f"Giá {price}{unit}, {fee}. Mã tin #{w}{i:02d}{ptype[:2]}. LH [SĐT]")
                out.append((f"demo:{w}:{ptype}:{i}", text, rng.randint(0, 25)))
    # A few posts that must stay out of statistics, to show the exclusion counts.
    out += [
        ("demo:x:hidden", "Cho thuê phòng trọ khép kín 20m2 phường Cầu Giấy, giá ib. LH [SĐT]", 3),
        ("demo:x:from", "Căn hộ dịch vụ full đồ phường Yên Hòa, giá từ 5tr/tháng, 25-35m2. LH [SĐT]", 4),
        ("demo:x:person", "Cho thuê phòng 30m2 phường Nghĩa Đô ở được 2 người, giá 1tr8/người/tháng. LH [SĐT]", 2),
    ]
    return out


def seed_demo(session: Session, *, password: str, generated: bool = True) -> dict:
    create_demo_users(session, password)
    collector = users.authenticate(session, "collector", password)
    now = utcnow()
    created = 0
    for path in sorted((REPO_ROOT / "spec" / "fixtures").glob("F*.json")):
        doc = json.loads(path.read_text(encoding="utf-8"))
        post_in = IngestPost.model_validate(doc["input"])
        r = ingest.ingest_post(session, collector, post_in, mode="collect", contributed=True, is_demo=True)
        created += r.status == "created"
    if generated:
        for key, text, days in generated_posts():
            # Generated dates depend on now. Re-seeding must not reuse a key with a
            # different timestamp or refresh existing demo posts into the market window.
            seen = session.get(IdempotencyKey, (key, collector.id))
            existing = session.get(Post, seen.result_ref) if seen and seen.result_ref else None
            if existing is not None and existing.is_demo:
                continue
            r = ingest.ingest_post(session, collector, _post(text, key, now - timedelta(days=days)), mode="collect",
                                   contributed=True, is_demo=True)
            created += r.status == "created"
    session.commit()
    return {"users": list(DEMO_USERS), "posts_created": created}
