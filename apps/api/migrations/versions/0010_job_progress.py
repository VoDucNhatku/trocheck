"""Job timing, visible stages and durable daily AI reservations."""
from alembic import op
import sqlalchemy as sa

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("jobs") as batch:
        batch.add_column(sa.Column("stage", sa.String(20), nullable=True))
        batch.add_column(sa.Column("started_at", sa.DateTime(), nullable=True))
        batch.add_column(sa.Column("finished_at", sa.DateTime(), nullable=True))
    op.create_table("llm_daily_usage", sa.Column("day", sa.String(10), primary_key=True),
                    sa.Column("calls", sa.Integer(), nullable=False),
                    sa.Column("review_calls", sa.Integer(), nullable=False))


def downgrade():
    op.drop_table("llm_daily_usage")
    with op.batch_alter_table("jobs") as batch:
        batch.drop_column("finished_at")
        batch.drop_column("started_at")
        batch.drop_column("stage")
