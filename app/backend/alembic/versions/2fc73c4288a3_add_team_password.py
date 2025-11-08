"""add team password

Revision ID: 2fc73c4288a3
Revises: 6fc793797c30
Create Date: 2025-11-04 10:41:40.474674

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2fc73c4288a3"
down_revision: str | Sequence[str] | None = "6fc793797c30"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade():
    with op.batch_alter_table("teams", schema=None) as batch_op:
        batch_op.add_column(sa.Column("password", sa.String(), nullable=True))
        batch_op.create_unique_constraint("uq_teams_password", ["password"])


def downgrade():
    with op.batch_alter_table("teams", schema=None) as batch_op:
        batch_op.drop_constraint("uq_teams_password", type_="unique")
        batch_op.drop_column("password")
