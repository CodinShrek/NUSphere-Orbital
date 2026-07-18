"""Add mentor availability, verification, and authorized reviews.

Revision ID: 20260718_0003
Revises: 20260716_0002
Create Date: 2026-07-18
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260718_0003"
down_revision: str | Sequence[str] | None = "20260716_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(
            sa.Column(
                "verification_status",
                sa.String(length=20),
                nullable=False,
                server_default="not_applicable",
            )
        )
        batch_op.create_index(
            "ix_users_verification_status", ["verification_status"], unique=False
        )

    op.execute(
        sa.text(
            "UPDATE users SET verification_status = 'unverified' "
            "WHERE role = 'mentor'"
        )
    )

    op.create_table(
        "mentor_availability",
        sa.Column("id", sa.String(length=40), nullable=False),
        sa.Column("mentor_id", sa.String(length=40), nullable=False),
        sa.Column("day_of_week", sa.String(length=9), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("mode", sa.String(length=20), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["mentor_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "mentor_id",
            "day_of_week",
            "start_time",
            "end_time",
            name="uq_mentor_availability_slot",
        ),
    )
    op.create_index(
        "ix_mentor_availability_mentor_id",
        "mentor_availability",
        ["mentor_id"],
        unique=False,
    )
    op.create_index(
        "ix_mentor_availability_day_of_week",
        "mentor_availability",
        ["day_of_week"],
        unique=False,
    )
    op.create_index(
        "ix_mentor_availability_mentor_day",
        "mentor_availability",
        ["mentor_id", "day_of_week"],
        unique=False,
    )

    op.create_table(
        "reviews",
        sa.Column("id", sa.String(length=40), nullable=False),
        sa.Column("connection_id", sa.String(length=100), nullable=False),
        sa.Column("student_id", sa.String(length=40), nullable=False),
        sa.Column("mentor_id", sa.String(length=40), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "rating >= 1 AND rating <= 5", name="ck_reviews_rating_range"
        ),
        sa.ForeignKeyConstraint(
            ["connection_id"], ["connections.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["mentor_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("connection_id", name="uq_reviews_connection_id"),
    )
    op.create_index(
        "ix_reviews_connection_id", "reviews", ["connection_id"], unique=False
    )
    op.create_index("ix_reviews_student_id", "reviews", ["student_id"], unique=False)
    op.create_index("ix_reviews_mentor_id", "reviews", ["mentor_id"], unique=False)
    op.create_index("ix_reviews_created_at", "reviews", ["created_at"], unique=False)
    op.create_index(
        "ix_reviews_mentor_created",
        "reviews",
        ["mentor_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_reviews_mentor_created", table_name="reviews")
    op.drop_index("ix_reviews_created_at", table_name="reviews")
    op.drop_index("ix_reviews_mentor_id", table_name="reviews")
    op.drop_index("ix_reviews_student_id", table_name="reviews")
    op.drop_index("ix_reviews_connection_id", table_name="reviews")
    op.drop_table("reviews")

    op.drop_index("ix_mentor_availability_mentor_day", table_name="mentor_availability")
    op.drop_index(
        "ix_mentor_availability_day_of_week", table_name="mentor_availability"
    )
    op.drop_index("ix_mentor_availability_mentor_id", table_name="mentor_availability")
    op.drop_table("mentor_availability")

    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_index("ix_users_verification_status")
        batch_op.drop_column("verification_status")
