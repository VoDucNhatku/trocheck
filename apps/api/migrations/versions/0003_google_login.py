"""Stable Google identity without changing existing passwords or roles."""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("google_subject", sa.String(255), nullable=True))
    if op.get_bind().dialect.name == "postgresql":
        op.create_unique_constraint("uq_users_google_subject", "users", ["google_subject"])
    else:
        op.create_index("uq_users_google_subject", "users", ["google_subject"], unique=True)


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.drop_constraint("uq_users_google_subject", "users", type_="unique")
    else:
        op.drop_index("uq_users_google_subject", table_name="users")
    op.drop_column("users", "google_subject")
