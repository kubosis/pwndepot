"""add mfa backup codes table

Revision ID: 814bdadada63
Revises: 29cdc4e8d424
Create Date: 2025-12-22 05:48:45.334708

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "814bdadada63"
down_revision: str | Sequence[str] | None = "29cdc4e8d424"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
