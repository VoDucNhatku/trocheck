"""Recompute the old districts named in each post with the precise matcher (SQLite and PostgreSQL).

The matcher now ignores districts named as neighbours ("gần Q1"), accent look-alikes ("Bình Thành"),
reads D10 / quan10 forms, and flags posts naming three or more districts as multi-area ads. Rows written
by 0008 or by earlier extractions carry the old, looser result, so this migration rebuilds them from the
stored post text. Idempotent: it adds the flag column only when missing and replaces all rows each run.
It also clears listings.area_m2 values below 6 m2 (a room dimension such as 2.7 read as an area); the
extraction field keeps what was read. No LLM call; demo posts and outside_hcm_province listings are skipped.
"""
from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if "multi_area" not in {c["name"] for c in sa.inspect(bind).get_columns("listings")}:
        with op.batch_alter_table("listings") as batch:
            batch.add_column(sa.Column("multi_area", sa.Boolean(), nullable=False, server_default=sa.false()))
    from app.pipeline.old_districts import district_scan

    districts = sa.table("listing_districts", sa.column("listing_id"), sa.column("district_key"))
    listings = sa.table("listings", sa.column("id"), sa.column("run_id"), sa.column("review_reasons", sa.JSON),
                        sa.column("multi_area", sa.Boolean), sa.column("area_m2", sa.Float))
    runs = sa.table("extraction_runs", sa.column("id"), sa.column("post_version_id"))
    versions = sa.table("post_versions", sa.column("id"), sa.column("post_id"), sa.column("text"))
    posts = sa.table("posts", sa.column("id"), sa.column("is_demo"))
    rows = bind.execute(
        sa.select(listings.c.id, listings.c.review_reasons, versions.c.text)
        .join(runs, runs.c.id == listings.c.run_id).join(versions, versions.c.id == runs.c.post_version_id)
        .join(posts, posts.c.id == versions.c.post_id).where(posts.c.is_demo.is_(False))).all()
    bind.execute(districts.delete())
    bind.execute(listings.update().values(multi_area=False))
    cache = {}
    values, multi = [], []
    for listing_id, reasons, text in rows:
        if "outside_hcm_province" in (reasons or []):
            continue
        scan = cache.get(text)
        if scan is None:
            scan = cache[text] = district_scan(text or "")
        values.extend({"listing_id": listing_id, "district_key": key} for key in scan.keys)
        if scan.keys and scan.multi_area:
            multi.append(listing_id)
    for start in range(0, len(values), 500):
        bind.execute(districts.insert(), values[start:start + 500])
    for start in range(0, len(multi), 500):
        bind.execute(listings.update().where(listings.c.id.in_(multi[start:start + 500])).values(multi_area=True))
    bind.execute(listings.update().where(listings.c.area_m2 < 6).values(area_m2=None))


def downgrade() -> None:
    with op.batch_alter_table("listings") as batch:
        batch.drop_column("multi_area")
