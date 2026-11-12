"""Append-only shadow bot reviews on SQLite and PostgreSQL."""
from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bot_reviews",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("listing_id", sa.String(26), sa.ForeignKey("listings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("listing_version", sa.Integer(), nullable=False),
        sa.Column("model_id", sa.String(100), nullable=False),
        sa.Column("prompt_version", sa.String(40), nullable=False),
        sa.Column("status", sa.String(10), nullable=False),
        sa.Column("verdict", sa.String(10), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("checks", sa.JSON(), nullable=False),
        sa.Column("reason", sa.String(500), nullable=False),
        sa.Column("error_code", sa.String(50), nullable=True),
        sa.Column("llm_calls", sa.Integer(), nullable=False),
        sa.Column("tokens_in", sa.Integer(), nullable=False),
        sa.Column("tokens_out", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_bot_reviews_listing_id", "bot_reviews", ["listing_id"])
    op.create_index("ix_bot_reviews_created_at", "bot_reviews", ["created_at"])
    op.create_index("uq_bot_reviews_ok", "bot_reviews", ["listing_id", "prompt_version"], unique=True,
                    sqlite_where=sa.text("status = 'ok'"), postgresql_where=sa.text("status = 'ok'"))


def downgrade() -> None:
    op.drop_table("bot_reviews")
