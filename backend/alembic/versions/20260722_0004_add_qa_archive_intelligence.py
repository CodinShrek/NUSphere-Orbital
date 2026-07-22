"""Add Q&A archive topic clusters and summary metadata.

Revision ID: 20260722_0004
Revises: 20260718_0003
Create Date: 2026-07-22
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260722_0004"
down_revision: str | Sequence[str] | None = "20260718_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("questions") as batch_op:
        batch_op.add_column(
            sa.Column(
                "topic_cluster",
                sa.String(length=100),
                nullable=False,
                server_default="General Guidance",
            )
        )
        batch_op.create_index(
            "ix_questions_topic_cluster", ["topic_cluster"], unique=False
        )

    searchable = "LOWER(COALESCE(topic, '') || ' ' || COALESCE(title, '') || ' ' || COALESCE(body, ''))"
    op.execute(
        sa.text(
            f"""
            UPDATE questions SET topic_cluster = CASE
                WHEN {searchable} LIKE '%noc%'
                    OR {searchable} LIKE '%startup%'
                    OR {searchable} LIKE '%entrepreneur%'
                    THEN 'NOC & Entrepreneurship'
                WHEN {searchable} LIKE '%exchange%'
                    OR {searchable} LIKE '%overseas%'
                    OR {searchable} LIKE '%study abroad%'
                    THEN 'Exchange & Overseas'
                WHEN {searchable} LIKE '%internship%'
                    OR {searchable} LIKE '%career%'
                    OR {searchable} LIKE '%interview%'
                    THEN 'Careers & Internships'
                WHEN {searchable} LIKE '%research%'
                    OR {searchable} LIKE '%urop%'
                    OR {searchable} LIKE '%supervisor%'
                    THEN 'Research'
                WHEN {searchable} LIKE '%module%'
                    OR {searchable} LIKE '%major%'
                    OR {searchable} LIKE '%workload%'
                    THEN 'Academic Planning'
                WHEN {searchable} LIKE '%cca%'
                    OR {searchable} LIKE '%student life%'
                    THEN 'Student Life & CCAs'
                WHEN {searchable} LIKE '%hostel%'
                    OR {searchable} LIKE '%hall%'
                    OR {searchable} LIKE '%accommodation%'
                    THEN 'Accommodation'
                WHEN {searchable} LIKE '%wellbeing%'
                    OR {searchable} LIKE '%stress%'
                    OR {searchable} LIKE '%mental health%'
                    THEN 'Wellbeing & Support'
                WHEN {searchable} LIKE '%admission%'
                    OR {searchable} LIKE '%scholarship%'
                    OR {searchable} LIKE '%registration%'
                    THEN 'Admissions & Administration'
                ELSE 'General Guidance'
            END
            """
        )
    )

    with op.batch_alter_table("answers") as batch_op:
        batch_op.add_column(
            sa.Column(
                "summary_version",
                sa.String(length=32),
                nullable=False,
                server_default="legacy-v1",
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("answers") as batch_op:
        batch_op.drop_column("summary_version")

    with op.batch_alter_table("questions") as batch_op:
        batch_op.drop_index("ix_questions_topic_cluster")
        batch_op.drop_column("topic_cluster")
