"""Add personalised opportunity posts.

Revision ID: 20260725_0007
Revises: 20260724_0006
Create Date: 2026-07-25
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260725_0007"
down_revision: str | Sequence[str] | None = "20260724_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "opportunities",
        sa.Column("id", sa.String(length=40), nullable=False),
        sa.Column("poster_id", sa.String(length=40), nullable=False),
        sa.Column("poster_name", sa.String(length=255), nullable=False),
        sa.Column("poster_role", sa.String(length=20), nullable=False),
        sa.Column("category", sa.String(length=30), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("organisation", sa.String(length=255), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("faculty", sa.String(length=255), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("commitment", sa.String(length=255), nullable=True),
        sa.Column("start_date", sa.String(length=40), nullable=True),
        sa.Column("end_date", sa.String(length=40), nullable=True),
        sa.Column("deadline", sa.String(length=40), nullable=True),
        sa.Column("application_url", sa.Text(), nullable=True),
        sa.Column("contact_email", sa.String(length=255), nullable=True),
        sa.Column("target_years", sa.JSON(), nullable=False),
        sa.Column("relevant_majors", sa.JSON(), nullable=False),
        sa.Column("tags", sa.JSON(), nullable=False),
        sa.Column("skills", sa.JSON(), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("is_verified", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["poster_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_opportunities_poster_id", "opportunities", ["poster_id"], unique=False)
    op.create_index("ix_opportunities_poster_role", "opportunities", ["poster_role"], unique=False)
    op.create_index("ix_opportunities_category", "opportunities", ["category"], unique=False)
    op.create_index("ix_opportunities_title", "opportunities", ["title"], unique=False)
    op.create_index("ix_opportunities_faculty", "opportunities", ["faculty"], unique=False)
    op.create_index("ix_opportunities_is_verified", "opportunities", ["is_verified"], unique=False)
    op.create_index("ix_opportunities_created_at", "opportunities", ["created_at"], unique=False)
    op.create_index(
        "ix_opportunities_category_created",
        "opportunities",
        ["category", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_opportunities_verified_created",
        "opportunities",
        ["is_verified", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_opportunities_verified_created", table_name="opportunities")
    op.drop_index("ix_opportunities_category_created", table_name="opportunities")
    op.drop_index("ix_opportunities_created_at", table_name="opportunities")
    op.drop_index("ix_opportunities_is_verified", table_name="opportunities")
    op.drop_index("ix_opportunities_faculty", table_name="opportunities")
    op.drop_index("ix_opportunities_title", table_name="opportunities")
    op.drop_index("ix_opportunities_category", table_name="opportunities")
    op.drop_index("ix_opportunities_poster_role", table_name="opportunities")
    op.drop_index("ix_opportunities_poster_id", table_name="opportunities")
    op.drop_table("opportunities")
