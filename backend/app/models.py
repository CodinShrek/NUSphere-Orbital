from __future__ import annotations

from datetime import datetime, time, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.mutable import MutableList
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from .database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


JsonList = MutableList.as_mutable(JSON().with_variant(JSONB, "postgresql"))


class UserRecord(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    supabase_user_id: Mapped[str | None] = mapped_column(
        String(36), unique=True, nullable=True, index=True
    )
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    faculty: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True, default="Computing"
    )
    major: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True, default="Computer Science"
    )
    modules_taken: Mapped[list[str]] = mapped_column(
        JsonList, default=list, nullable=False
    )
    ccas: Mapped[list[str]] = mapped_column(JsonList, default=list, nullable=False)
    nus_opportunities: Mapped[list[str]] = mapped_column(
        JsonList, default=list, nullable=False
    )
    exchange_universities: Mapped[list[str]] = mapped_column(
        JsonList, default=list, nullable=False
    )
    accommodation: Mapped[str] = mapped_column(
        String(255), nullable=False, default="Off-campus accommodation"
    )
    interests: Mapped[list[str]] = mapped_column(JsonList, default=list, nullable=False)
    goals: Mapped[list[str]] = mapped_column(JsonList, default=list, nullable=False)
    bio: Mapped[str] = mapped_column(Text, default="", nullable=False)
    mentor_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    mentorship_goals: Mapped[str | None] = mapped_column(Text, nullable=True)
    mentor_type_other: Mapped[str | None] = mapped_column(String(255), nullable=True)
    graduation_year: Mapped[str | None] = mapped_column(String(20), nullable=True)
    current_role: Mapped[str | None] = mapped_column(String(255), nullable=True)
    organisation: Mapped[str | None] = mapped_column(String(255), nullable=True)
    department: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )
    consultation_hours: Mapped[str | None] = mapped_column(Text, nullable=True)
    modules_taught: Mapped[list[str]] = mapped_column(
        JsonList, default=list, nullable=False
    )
    areas_of_expertise: Mapped[list[str]] = mapped_column(
        JsonList, default=list, nullable=False
    )
    office_location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    office: Mapped[str | None] = mapped_column(String(255), nullable=True)
    profile_picture: Mapped[str | None] = mapped_column(Text, nullable=True)
    verification_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="not_applicable", index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )


class SessionRecord(Base):
    __tablename__ = "sessions"

    token: Mapped[str] = mapped_column(String(128), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    user: Mapped[UserRecord] = relationship()


class QuestionRecord(Base):
    __tablename__ = "questions"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    student_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_name: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    topic: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    topic_cluster: Mapped[str] = mapped_column(
        String(100), nullable=False, default="General Guidance", index=True
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    tags: Mapped[list[str]] = mapped_column(JsonList, default=list, nullable=False)
    attachments: Mapped[list[str]] = mapped_column(
        JsonList, default=list, nullable=False
    )
    key_terms: Mapped[list[str]] = mapped_column(JsonList, default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False, index=True
    )

    answers: Mapped[list[AnswerRecord]] = relationship(
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="AnswerRecord.created_at",
    )


class AnswerRecord(Base):
    __tablename__ = "answers"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    question_id: Mapped[str] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    mentor_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    mentor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    summary_version: Mapped[str] = mapped_column(
        String(32), nullable=False, default="extractive-v2"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False, index=True
    )

    question: Mapped[QuestionRecord] = relationship(back_populates="answers")


class ConversationRecord(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    student_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mentor_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    mentor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mentor_programme: Mapped[str] = mapped_column(String(255), nullable=False)
    last_message: Mapped[str] = mapped_column(Text, nullable=False)
    student_last_read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    mentor_last_read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    student_pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    mentor_pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    student_archived: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    mentor_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    student_muted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    mentor_muted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False, index=True
    )

    messages: Mapped[list[MessageRecord]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="MessageRecord.created_at",
    )


class ConnectionRecord(Base):
    __tablename__ = "connections"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    student_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mentor_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    mentor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mentor_programme: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, index=True, default="pending"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
        index=True,
    )


class MentorAvailabilityRecord(Base):
    __tablename__ = "mentor_availability"
    __table_args__ = (
        UniqueConstraint(
            "mentor_id",
            "day_of_week",
            "start_time",
            "end_time",
            name="uq_mentor_availability_slot",
        ),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    mentor_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    day_of_week: Mapped[str] = mapped_column(String(9), nullable=False, index=True)
    start_time: Mapped[time] = mapped_column(Time(), nullable=False)
    end_time: Mapped[time] = mapped_column(Time(), nullable=False)
    timezone: Mapped[str] = mapped_column(
        String(64), nullable=False, default="Asia/Singapore"
    )
    mode: Mapped[str] = mapped_column(String(20), nullable=False, default="online")
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    mentor: Mapped[UserRecord] = relationship()


class ReviewRecord(Base):
    __tablename__ = "reviews"
    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="ck_reviews_rating_range"),
        UniqueConstraint("connection_id", name="uq_reviews_connection_id"),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    connection_id: Mapped[str] = mapped_column(
        ForeignKey("connections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    mentor_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    connection: Mapped[ConnectionRecord] = relationship()
    student: Mapped[UserRecord] = relationship(foreign_keys=[student_id])
    mentor: Mapped[UserRecord] = relationship(foreign_keys=[mentor_id])


class MessageRecord(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sender_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sender_name: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False, index=True
    )

    conversation: Mapped[ConversationRecord] = relationship(back_populates="messages")


class NotificationRecord(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    actor_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    actor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    target_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    target_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False, index=True
    )

    user: Mapped[UserRecord] = relationship(foreign_keys=[user_id])
    actor: Mapped[UserRecord | None] = relationship(foreign_keys=[actor_id])


class ProfileEmbeddingRecord(Base):
    __tablename__ = "profile_embeddings"

    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    embedding_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    source_text: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float]] = mapped_column(
        JsonList, default=list, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
        index=True,
    )

    user: Mapped[UserRecord] = relationship()


Index("ix_users_role_faculty", UserRecord.role, UserRecord.faculty)
Index("ix_questions_topic_created", QuestionRecord.topic, QuestionRecord.created_at)
Index(
    "ix_conversations_student_updated",
    ConversationRecord.student_id,
    ConversationRecord.updated_at,
)
Index(
    "ix_conversations_mentor_updated",
    ConversationRecord.mentor_id,
    ConversationRecord.updated_at,
)
Index(
    "ix_connections_student_status",
    ConnectionRecord.student_id,
    ConnectionRecord.status,
)
Index(
    "ix_connections_mentor_status", ConnectionRecord.mentor_id, ConnectionRecord.status
)
Index(
    "ix_mentor_availability_mentor_day",
    MentorAvailabilityRecord.mentor_id,
    MentorAvailabilityRecord.day_of_week,
)
Index("ix_reviews_mentor_created", ReviewRecord.mentor_id, ReviewRecord.created_at)
Index(
    "ix_profile_embeddings_user_type",
    ProfileEmbeddingRecord.user_id,
    ProfileEmbeddingRecord.embedding_type,
)
Index(
    "ix_notifications_user_read_created",
    NotificationRecord.user_id,
    NotificationRecord.is_read,
    NotificationRecord.created_at,
)
