"""Old districts named in a post, for filtering listings that have no ward (SQLite and PostgreSQL).

Creates listing_districts and backfills it from the stored post text with the same matcher the
pipeline uses (app.pipeline.old_districts.district_mentions). The backfill is part of this
migration: it runs once on `init-db`, reads only existing rows, never calls an LLM, and skips
demo posts and listings flagged outside_hcm_province.
"""
from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    districts = op.create_table(
        "listing_districts",
        sa.Column("listing_id", sa.String(26), sa.ForeignKey("listings.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("district_key", sa.String(40), primary_key=True),
    )
    op.create_index("ix_listing_districts_key", "listing_districts", ["district_key"])
    from app.pipeline.old_districts import district_mentions

    listings = sa.table("listings", sa.column("id"), sa.column("run_id"), sa.column("review_reasons", sa.JSON))
    runs = sa.table("extraction_runs", sa.column("id"), sa.column("post_version_id"))
    versions = sa.table("post_versions", sa.column("id"), sa.column("post_id"), sa.column("text"))
    posts = sa.table("posts", sa.column("id"), sa.column("is_demo"))
    bind = op.get_bind()
    rows = bind.execute(
        sa.select(listings.c.id, listings.c.review_reasons, versions.c.text)
        .join(runs, runs.c.id == listings.c.run_id).join(versions, versions.c.id == runs.c.post_version_id)
        .join(posts, posts.c.id == versions.c.post_id).where(posts.c.is_demo.is_(False))).all()
    cache: dict[str, list[str]] = {}
    values = []
    for listing_id, reasons, text in rows:
        if "outside_hcm_province" in (reasons or []):
            continue
        keys = cache.get(text)
        if keys is None:
            keys = cache[text] = district_mentions(text or "")
        values.extend({"listing_id": listing_id, "district_key": key} for key in keys)
    if values:
        bind.execute(districts.insert(), values)


def downgrade() -> None:
    op.drop_index("ix_listing_districts_key", table_name="listing_districts")
    op.drop_table("listing_districts")
