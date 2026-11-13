"""Keep Google's display name without changing existing credentials or roles."""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("display_name", sa.String(200), nullable=True))


def downgrade() -> None:
    # Both supported dialects can drop this unconstrained column directly. Rebuilding
    # users on SQLite would risk cascading deletion of rows referencing the table.
    op.drop_column("users", "display_name")
