"""Baseline the Milestone 2 database schema.

Revision ID: 20260714_0001
Revises:
Create Date: 2026-07-14
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260714_0001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


json_list_type = sa.JSON().with_variant(
    postgresql.JSONB(astext_type=sa.Text()),
    "postgresql",
)


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=40), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("faculty", sa.String(length=255), nullable=False),
        sa.Column("major", sa.String(length=255), nullable=False),
        sa.Column("modules_taken", json_list_type, nullable=False),
        sa.Column("ccas", json_list_type, nullable=False),
        sa.Column("nus_opportunities", json_list_type, nullable=False),
        sa.Column("exchange_universities", json_list_type, nullable=False),
        sa.Column("accommodation", sa.String(length=255), nullable=False),
        sa.Column("interests", json_list_type, nullable=False),
        sa.Column("goals", json_list_type, nullable=False),
        sa.Column("bio", sa.Text(), nullable=False),
        sa.Column("mentor_type", sa.String(length=50), nullable=True),
        sa.Column("mentorship_goals", sa.Text(), nullable=True),
        sa.Column("mentor_type_other", sa.String(length=255), nullable=True),
        sa.Column("graduation_year", sa.String(length=20), nullable=True),
        sa.Column("current_role", sa.String(length=255), nullable=True),
        sa.Column("organisation", sa.String(length=255), nullable=True),
        sa.Column("department", sa.String(length=255), nullable=True),
        sa.Column("consultation_hours", sa.Text(), nullable=True),
        sa.Column("modules_taught", json_list_type, nullable=False),
        sa.Column("areas_of_expertise", json_list_type, nullable=False),
        sa.Column("office_location", sa.String(length=255), nullable=True),
        sa.Column("office", sa.String(length=255), nullable=True),
        sa.Column("profile_picture", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_department"), "users", ["department"], unique=False)
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_faculty"), "users", ["faculty"], unique=False)
    op.create_index(op.f("ix_users_major"), "users", ["major"], unique=False)
    op.create_index(op.f("ix_users_role"), "users", ["role"], unique=False)
    op.create_index("ix_users_role_faculty", "users", ["role", "faculty"], unique=False)

    op.create_table(
        "questions",
        sa.Column("id", sa.String(length=40), nullable=False),
        sa.Column("student_id", sa.String(length=40), nullable=False),
        sa.Column("student_name", sa.String(length=255), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("topic", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("tags", json_list_type, nullable=False),
        sa.Column("attachments", json_list_type, nullable=False),
        sa.Column("key_terms", json_list_type, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_questions_created_at"), "questions", ["created_at"], unique=False
    )
    op.create_index(
        op.f("ix_questions_student_id"), "questions", ["student_id"], unique=False
    )
    op.create_index(op.f("ix_questions_title"), "questions", ["title"], unique=False)
    op.create_index(op.f("ix_questions_topic"), "questions", ["topic"], unique=False)
    op.create_index(
        "ix_questions_topic_created", "questions", ["topic", "created_at"], unique=False
    )

    op.create_table(
        "connections",
        sa.Column("id", sa.String(length=100), nullable=False),
        sa.Column("student_id", sa.String(length=40), nullable=False),
        sa.Column("student_name", sa.String(length=255), nullable=False),
        sa.Column("mentor_id", sa.String(length=40), nullable=False),
        sa.Column("mentor_name", sa.String(length=255), nullable=False),
        sa.Column("mentor_programme", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["mentor_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_connections_created_at"), "connections", ["created_at"], unique=False
    )
    op.create_index(
        op.f("ix_connections_mentor_id"), "connections", ["mentor_id"], unique=False
    )
    op.create_index(
        "ix_connections_mentor_status",
        "connections",
        ["mentor_id", "status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_connections_status"), "connections", ["status"], unique=False
    )
    op.create_index(
        op.f("ix_connections_student_id"), "connections", ["student_id"], unique=False
    )
    op.create_index(
        "ix_connections_student_status",
        "connections",
        ["student_id", "status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_connections_updated_at"), "connections", ["updated_at"], unique=False
    )

    op.create_table(
        "conversations",
        sa.Column("id", sa.String(length=100), nullable=False),
        sa.Column("student_id", sa.String(length=40), nullable=False),
        sa.Column("student_name", sa.String(length=255), nullable=False),
        sa.Column("mentor_id", sa.String(length=40), nullable=False),
        sa.Column("mentor_name", sa.String(length=255), nullable=False),
        sa.Column("mentor_programme", sa.String(length=255), nullable=False),
        sa.Column("last_message", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["mentor_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_conversations_mentor_id"), "conversations", ["mentor_id"], unique=False
    )
    op.create_index(
        "ix_conversations_mentor_updated",
        "conversations",
        ["mentor_id", "updated_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_conversations_student_id"),
        "conversations",
        ["student_id"],
        unique=False,
    )
    op.create_index(
        "ix_conversations_student_updated",
        "conversations",
        ["student_id", "updated_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_conversations_updated_at"),
        "conversations",
        ["updated_at"],
        unique=False,
    )

    op.create_table(
        "sessions",
        sa.Column("token", sa.String(length=128), nullable=False),
        sa.Column("user_id", sa.String(length=40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("token"),
    )
    op.create_index(op.f("ix_sessions_user_id"), "sessions", ["user_id"], unique=False)

    op.create_table(
        "answers",
        sa.Column("id", sa.String(length=40), nullable=False),
        sa.Column("question_id", sa.String(length=40), nullable=False),
        sa.Column("mentor_id", sa.String(length=40), nullable=False),
        sa.Column("mentor_name", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["mentor_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["question_id"], ["questions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_answers_created_at"), "answers", ["created_at"], unique=False
    )
    op.create_index(
        op.f("ix_answers_mentor_id"), "answers", ["mentor_id"], unique=False
    )
    op.create_index(
        op.f("ix_answers_question_id"), "answers", ["question_id"], unique=False
    )

    op.create_table(
        "messages",
        sa.Column("id", sa.String(length=40), nullable=False),
        sa.Column("conversation_id", sa.String(length=100), nullable=False),
        sa.Column("sender_id", sa.String(length=40), nullable=False),
        sa.Column("sender_name", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["conversation_id"], ["conversations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_messages_conversation_id"),
        "messages",
        ["conversation_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_messages_created_at"), "messages", ["created_at"], unique=False
    )
    op.create_index(
        op.f("ix_messages_sender_id"), "messages", ["sender_id"], unique=False
    )

    op.create_table(
        "profile_embeddings",
        sa.Column("id", sa.String(length=60), nullable=False),
        sa.Column("user_id", sa.String(length=40), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("embedding_type", sa.String(length=50), nullable=False),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column("source_text", sa.Text(), nullable=False),
        sa.Column("embedding", json_list_type, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_profile_embeddings_embedding_type"),
        "profile_embeddings",
        ["embedding_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_profile_embeddings_role"), "profile_embeddings", ["role"], unique=False
    )
    op.create_index(
        op.f("ix_profile_embeddings_updated_at"),
        "profile_embeddings",
        ["updated_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_profile_embeddings_user_id"),
        "profile_embeddings",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_profile_embeddings_user_type",
        "profile_embeddings",
        ["user_id", "embedding_type"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_profile_embeddings_user_type", table_name="profile_embeddings")
    op.drop_index(
        op.f("ix_profile_embeddings_user_id"), table_name="profile_embeddings"
    )
    op.drop_index(
        op.f("ix_profile_embeddings_updated_at"), table_name="profile_embeddings"
    )
    op.drop_index(op.f("ix_profile_embeddings_role"), table_name="profile_embeddings")
    op.drop_index(
        op.f("ix_profile_embeddings_embedding_type"), table_name="profile_embeddings"
    )
    op.drop_table("profile_embeddings")

    op.drop_index(op.f("ix_messages_sender_id"), table_name="messages")
    op.drop_index(op.f("ix_messages_created_at"), table_name="messages")
    op.drop_index(op.f("ix_messages_conversation_id"), table_name="messages")
    op.drop_table("messages")

    op.drop_index(op.f("ix_answers_question_id"), table_name="answers")
    op.drop_index(op.f("ix_answers_mentor_id"), table_name="answers")
    op.drop_index(op.f("ix_answers_created_at"), table_name="answers")
    op.drop_table("answers")

    op.drop_index(op.f("ix_sessions_user_id"), table_name="sessions")
    op.drop_table("sessions")

    op.drop_index(op.f("ix_conversations_updated_at"), table_name="conversations")
    op.drop_index("ix_conversations_student_updated", table_name="conversations")
    op.drop_index(op.f("ix_conversations_student_id"), table_name="conversations")
    op.drop_index("ix_conversations_mentor_updated", table_name="conversations")
    op.drop_index(op.f("ix_conversations_mentor_id"), table_name="conversations")
    op.drop_table("conversations")

    op.drop_index(op.f("ix_connections_updated_at"), table_name="connections")
    op.drop_index("ix_connections_student_status", table_name="connections")
    op.drop_index(op.f("ix_connections_student_id"), table_name="connections")
    op.drop_index(op.f("ix_connections_status"), table_name="connections")
    op.drop_index("ix_connections_mentor_status", table_name="connections")
    op.drop_index(op.f("ix_connections_mentor_id"), table_name="connections")
    op.drop_index(op.f("ix_connections_created_at"), table_name="connections")
    op.drop_table("connections")

    op.drop_index("ix_questions_topic_created", table_name="questions")
    op.drop_index(op.f("ix_questions_topic"), table_name="questions")
    op.drop_index(op.f("ix_questions_title"), table_name="questions")
    op.drop_index(op.f("ix_questions_student_id"), table_name="questions")
    op.drop_index(op.f("ix_questions_created_at"), table_name="questions")
    op.drop_table("questions")

    op.drop_index("ix_users_role_faculty", table_name="users")
    op.drop_index(op.f("ix_users_role"), table_name="users")
    op.drop_index(op.f("ix_users_major"), table_name="users")
    op.drop_index(op.f("ix_users_faculty"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_index(op.f("ix_users_department"), table_name="users")
    op.drop_table("users")
