"""Room photos sent by the extension, stored on Cloudinary."""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "post_images",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("post_id", sa.String(26), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("public_id", sa.String(300), nullable=False),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("uploaded_by", sa.String(26), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("post_id", "content_hash", name="uq_post_images_hash"),
    )
    op.create_index("ix_post_images_post_id", "post_images", ["post_id"])
    op.create_index("ix_post_images_created_at", "post_images", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_post_images_created_at", table_name="post_images")
    op.drop_index("ix_post_images_post_id", table_name="post_images")
    op.drop_table("post_images")
