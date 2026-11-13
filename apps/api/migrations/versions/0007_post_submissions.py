"""Preserve every sender when a post is deduplicated, on SQLite and PostgreSQL."""
from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    submissions = op.create_table(
        "post_submissions",
        sa.Column("post_id", sa.String(26), sa.ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", sa.String(26), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("first_sent_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_post_submissions_user_sent", "post_submissions", ["user_id", "first_sent_at"])
    # INSERT SELECT and generic DateTime compile for both supported dialects; no table rebuild.
    posts = sa.table("posts", sa.column("id"), sa.column("collector_id"), sa.column("first_seen_at"))
    op.get_bind().execute(submissions.insert().from_select(
        ["post_id", "user_id", "first_sent_at"], sa.select(posts.c.id, posts.c.collector_id, posts.c.first_seen_at)))


def downgrade() -> None:
    op.drop_index("ix_post_submissions_user_sent", table_name="post_submissions")
    op.drop_table("post_submissions")
