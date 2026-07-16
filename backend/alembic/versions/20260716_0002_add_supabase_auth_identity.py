"""Add Supabase Auth identity to user profiles.

Revision ID: 20260716_0002
Revises: 20260714_0001
Create Date: 2026-07-16
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260716_0002"
down_revision: str | Sequence[str] | None = "20260714_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(
            sa.Column("supabase_user_id", sa.String(length=36), nullable=True)
        )
        batch_op.alter_column(
            "password_hash",
            existing_type=sa.String(length=255),
            nullable=True,
        )
        batch_op.create_index(
            "ix_users_supabase_user_id",
            ["supabase_user_id"],
            unique=True,
        )


def downgrade() -> None:
    # Supabase-managed profiles have no local password. A non-matching placeholder
    # keeps the legacy column valid if this migration must be rolled back.
    op.execute(
        sa.text(
            "UPDATE users SET password_hash = 'supabase_managed' "
            "WHERE password_hash IS NULL"
        )
    )
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_index("ix_users_supabase_user_id")
        batch_op.alter_column(
            "password_hash",
            existing_type=sa.String(length=255),
            nullable=False,
        )
        batch_op.drop_column("supabase_user_id")
