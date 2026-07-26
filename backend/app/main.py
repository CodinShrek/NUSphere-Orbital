from __future__ import annotations

import os
from datetime import datetime, time, timezone
from pathlib import Path
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel, EmailStr, Field, StringConstraints, model_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from .auth import claims_from_authorization
from .database import get_db
from .ai_matching import (
    cosine_similarity,
    embed_text,
    expected_embedding_model,
    goal_search_text,
    match_explanation,
    matching_weights,
    STOP_WORDS,
    profile_completeness,
    structured_overlap,
    user_profile_text,
    weighted_match_score,
)
from .models import (
    AnswerRecord,
    ConnectionRecord,
    ConversationRecord,
    MentorAvailabilityRecord,
    MessageRecord,
    NotificationRecord,
    OpportunityRecord,
    ProfileEmbeddingRecord,
    QuestionRecord,
    ReviewRecord,
    UserRecord,
)
from .qa_archive import (
    MIN_DUPLICATE_SCORE,
    SUMMARY_VERSION,
    duplicate_score,
    extract_key_terms,
    summarise_answer,
    topic_cluster,
)
from .readiness import readiness_report


Role = Literal["student", "mentor"]
NotificationType = Literal[
    "message",
    "question_created",
    "answer_created",
]
MentorType = Literal["senior", "alumni", "professor", "nus_staff", "other"]
VerificationStatus = Literal[
    "not_applicable", "unverified", "pending", "verified", "rejected"
]
Weekday = Literal[
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
]
AvailabilityMode = Literal["online", "in_person", "hybrid"]
OpportunityCategory = Literal["event", "cca", "project", "research", "other"]
QuestionTitle = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=5, max_length=500)
]
QuestionTopic = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=2, max_length=255)
]
QuestionBody = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=10, max_length=5000)
]
QuestionTag = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)
]
AttachmentName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)
]


class ProfileSyncRequest(BaseModel):
    role: Role
    name: str
    faculty: str = "Computing"
    major: str = "Computer Science"
    modules_taken: list[str] = Field(default_factory=list)
    ccas: list[str] = Field(default_factory=list)
    nus_opportunities: list[str] = Field(default_factory=list)
    exchange_universities: list[str] = Field(default_factory=list)
    accommodation: str = "Off-campus accommodation"
    interests: list[str] = Field(default_factory=list)
    goals: list[str] = Field(default_factory=list)
    bio: str = ""
    mentor_type: MentorType | None = None
    mentorship_goals: str | None = None
    mentor_type_other: str | None = None
    graduation_year: str | None = None
    current_role: str | None = None
    organisation: str | None = None
    department: str | None = None
    consultation_hours: str | None = None
    modules_taught: list[str] = Field(default_factory=list)
    areas_of_expertise: list[str] = Field(default_factory=list)
    office_location: str | None = None
    office: str | None = None
    profile_picture: str | None = None


class UserUpdate(BaseModel):
    name: str | None = None
    faculty: str | None = None
    major: str | None = None
    modules_taken: list[str] | None = None
    ccas: list[str] | None = None
    nus_opportunities: list[str] | None = None
    exchange_universities: list[str] | None = None
    accommodation: str | None = None
    interests: list[str] | None = None
    goals: list[str] | None = None
    bio: str | None = None
    mentor_type: MentorType | None = None
    mentorship_goals: str | None = None
    mentor_type_other: str | None = None
    graduation_year: str | None = None
    current_role: str | None = None
    organisation: str | None = None
    department: str | None = None
    consultation_hours: str | None = None
    modules_taught: list[str] | None = None
    areas_of_expertise: list[str] | None = None
    office_location: str | None = None
    office: str | None = None
    profile_picture: str | None = None


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    role: Role
    name: str
    faculty: str
    major: str
    modules_taken: list[str]
    ccas: list[str]
    nus_opportunities: list[str]
    exchange_universities: list[str]
    accommodation: str
    interests: list[str]
    goals: list[str]
    bio: str
    mentor_type: MentorType | None = None
    mentorship_goals: str | None = None
    mentor_type_other: str | None = None
    graduation_year: str | None = None
    current_role: str | None = None
    organisation: str | None = None
    department: str | None = None
    consultation_hours: str | None = None
    modules_taught: list[str] = Field(default_factory=list)
    areas_of_expertise: list[str] = Field(default_factory=list)
    office_location: str | None = None
    office: str | None = None
    profile_picture: str | None = None
    verification_status: VerificationStatus = "not_applicable"


class AvailabilitySlotInput(BaseModel):
    day_of_week: Weekday
    start_time: time
    end_time: time
    timezone: str = Field(default="Asia/Singapore", min_length=1, max_length=64)
    mode: AvailabilityMode = "online"
    location: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def validate_time_range(self) -> AvailabilitySlotInput:
        if self.end_time <= self.start_time:
            raise ValueError("Availability end time must be after start time")
        return self


class AvailabilityUpdate(BaseModel):
    slots: list[AvailabilitySlotInput] = Field(default_factory=list, max_length=30)

    @model_validator(mode="after")
    def validate_no_overlaps(self) -> AvailabilityUpdate:
        for day in {slot.day_of_week for slot in self.slots}:
            day_slots = sorted(
                (slot for slot in self.slots if slot.day_of_week == day),
                key=lambda slot: slot.start_time,
            )
            for previous, current in zip(day_slots, day_slots[1:]):
                if current.start_time < previous.end_time:
                    raise ValueError(f"Availability slots overlap on {day}")
        return self


class AvailabilitySlotPublic(AvailabilitySlotInput):
    id: str
    mentor_id: str
    is_active: bool
    created_at: str
    updated_at: str


class VerificationStatusPublic(BaseModel):
    mentor_id: str
    status: VerificationStatus


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=2000)


class ReviewPublic(BaseModel):
    id: str
    connection_id: str
    student_id: str
    student_name: str
    mentor_id: str
    rating: int
    comment: str
    created_at: str
    updated_at: str


class ReviewEligibility(BaseModel):
    mentor_id: str
    can_review: bool
    reason: str
    connection_id: str | None = None
    existing_review: ReviewPublic | None = None


class MatchScoreComponent(BaseModel):
    score: int
    weight: int
    weighted_points: float


class MatchScoreBreakdown(BaseModel):
    semantic: MatchScoreComponent
    structured: MatchScoreComponent
    faculty: MatchScoreComponent
    completeness: MatchScoreComponent
    total: int


class Mentor(BaseModel):
    id: str
    email: EmailStr
    name: str
    mentor_type: MentorType | None = None
    mentor_type_label: str
    year: str
    programme: str
    faculty: str
    department: str | None = None
    role: str
    rating: float
    reviews: int
    mentees: int
    answers: int
    match_score: int
    keyword_match_score: int | None = None
    profile_match_score: int | None = None
    goal_match_score: int | None = None
    match_label: str = "Keyword match"
    match_score_breakdown: MatchScoreBreakdown | None = None
    embedding_model: str | None = None
    embedding_provider: Literal["openai", "local"] | None = None
    embedding_fallback: bool | None = None
    interests: list[str]
    experience_tags: list[str]
    bio: str
    experience: list[str]
    match_reasons: list[str] = Field(default_factory=list)
    verification_status: VerificationStatus = "unverified"
    availability: list[AvailabilitySlotPublic] = Field(default_factory=list)


class RecommendationRequest(BaseModel):
    interests: list[str] = Field(default_factory=list)
    goals: list[str] = Field(default_factory=list)
    bio: str = ""
    faculty: str | None = None
    minimum_score: int = 0


class GoalSearchRequest(BaseModel):
    query: str = Field(min_length=20)
    minimum_score: int = 0


class OpportunityCreate(BaseModel):
    category: OpportunityCategory
    title: str = Field(min_length=5, max_length=255)
    organisation: str = Field(default="NUS", min_length=2, max_length=255)
    summary: str = Field(min_length=10, max_length=500)
    description: str = Field(min_length=30, max_length=5000)
    faculty: str | None = Field(default=None, max_length=255)
    location: str | None = Field(default=None, max_length=255)
    commitment: str | None = Field(default=None, max_length=255)
    start_date: str | None = Field(default=None, max_length=40)
    end_date: str | None = Field(default=None, max_length=40)
    deadline: str | None = Field(default=None, max_length=40)
    application_url: str | None = Field(default=None, max_length=1000)
    contact_email: str | None = Field(default=None, max_length=255)
    target_years: list[str] = Field(default_factory=list, max_length=8)
    relevant_majors: list[str] = Field(default_factory=list, max_length=12)
    tags: list[str] = Field(default_factory=list, max_length=16)
    skills: list[str] = Field(default_factory=list, max_length=16)
    details: list[str] = Field(default_factory=list, max_length=16)


class OpportunitySearchRequest(BaseModel):
    query: str = ""
    categories: list[OpportunityCategory] = Field(default_factory=list)
    minimum_score: int = 0


class OpportunityPublic(BaseModel):
    id: str
    poster_id: str
    poster_name: str
    poster_role: Role
    category: OpportunityCategory
    title: str
    organisation: str
    summary: str
    description: str
    faculty: str | None = None
    location: str | None = None
    commitment: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    deadline: str | None = None
    application_url: str | None = None
    contact_email: str | None = None
    target_years: list[str] = Field(default_factory=list)
    relevant_majors: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    details: list[str] = Field(default_factory=list)
    is_verified: bool
    created_at: str
    match_score: int = 0
    keyword_match_score: int | None = None
    profile_match_score: int | None = None
    goal_match_score: int | None = None
    match_label: str = "Keyword match"
    match_reasons: list[str] = Field(default_factory=list)
    match_score_breakdown: MatchScoreBreakdown | None = None
    embedding_model: str | None = None
    embedding_provider: Literal["openai", "local"] | None = None
    embedding_fallback: bool | None = None


class QuestionSuggestionRequest(BaseModel):
    title: QuestionTitle
    topic: QuestionTopic
    body: QuestionBody
    tags: list[QuestionTag] = Field(default_factory=list, max_length=12)


class QuestionCreate(QuestionSuggestionRequest):
    attachments: list[AttachmentName] = Field(default_factory=list, max_length=10)


class AnswerCreate(BaseModel):
    body: QuestionBody


class AnswerPublic(BaseModel):
    id: str
    mentor_id: str
    mentor_name: str
    body: str
    summary: str
    summary_version: str
    created_at: str


class QuestionPublic(BaseModel):
    id: str
    student_id: str
    student_name: str
    title: str
    topic: str
    topic_cluster: str
    body: str
    tags: list[str]
    attachments: list[str] = Field(default_factory=list)
    key_terms: list[str] = Field(default_factory=list)
    created_at: str
    answers: list[AnswerPublic] = Field(default_factory=list)


class DuplicateQuestionSuggestion(BaseModel):
    question_id: str
    title: str
    topic: str
    topic_cluster: str
    similarity_score: int
    evidence: list[str] = Field(default_factory=list)
    answer_count: int
    latest_summary: str | None = None


class MessageCreate(BaseModel):
    body: str = Field(min_length=1)


class MessagePublic(BaseModel):
    id: str
    sender_id: str
    sender_name: str
    body: str
    created_at: str


class ConversationPublic(BaseModel):
    id: str
    student_id: str
    student_name: str
    mentor_id: str
    mentor_name: str
    mentor_programme: str
    last_message: str
    updated_at: str
    unread_count: int = 0
    last_read_at: str | None = None
    is_pinned: bool = False
    is_archived: bool = False
    is_muted: bool = False
    messages: list[MessagePublic] = Field(default_factory=list)


class ConversationStateUpdate(BaseModel):
    is_pinned: bool | None = None
    is_archived: bool | None = None
    is_muted: bool | None = None


class NotificationPublic(BaseModel):
    id: str
    user_id: str
    actor_id: str | None = None
    actor_name: str
    type: NotificationType
    title: str
    body: str
    target_type: str
    target_id: str
    is_read: bool
    read_at: str | None = None
    created_at: str


class NotificationUnreadCount(BaseModel):
    unread_count: int


class ConnectionPublic(BaseModel):
    id: str
    student_id: str
    student_name: str
    mentor_id: str
    mentor_name: str
    mentor_programme: str
    status: str
    created_at: str
    updated_at: str


app = FastAPI(title="NUSphere API", version="0.1.0")

frontend_origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


static_mentors: list[Mentor] = []


def public_user(record: UserRecord) -> UserPublic:
    return UserPublic(
        id=record.id,
        email=record.email,
        role=record.role,  # type: ignore[arg-type]
        name=record.name,
        faculty=record.faculty,
        major=record.major,
        modules_taken=record.modules_taken or [],
        ccas=record.ccas or [],
        nus_opportunities=record.nus_opportunities or [],
        exchange_universities=record.exchange_universities or [],
        accommodation=record.accommodation,
        interests=record.interests or [],
        goals=record.goals or [],
        bio=record.bio or "",
        mentor_type=record.mentor_type,  # type: ignore[arg-type]
        mentorship_goals=record.mentorship_goals,
        mentor_type_other=record.mentor_type_other,
        graduation_year=record.graduation_year,
        current_role=record.current_role,
        organisation=record.organisation,
        department=record.department,
        consultation_hours=record.consultation_hours,
        modules_taught=record.modules_taught or [],
        areas_of_expertise=record.areas_of_expertise or [],
        office_location=record.office_location,
        office=record.office,
        profile_picture=record.profile_picture,
        verification_status=record.verification_status,  # type: ignore[arg-type]
    )


def answer_from_record(record: AnswerRecord) -> AnswerPublic:
    return AnswerPublic(
        id=record.id,
        mentor_id=record.mentor_id,
        mentor_name=record.mentor_name,
        body=record.body,
        summary=record.summary,
        summary_version=record.summary_version,
        created_at=record.created_at.isoformat(),
    )


def question_from_record(record: QuestionRecord) -> QuestionPublic:
    return QuestionPublic(
        id=record.id,
        student_id=record.student_id,
        student_name=record.student_name,
        title=record.title,
        topic=record.topic,
        topic_cluster=record.topic_cluster,
        body=record.body,
        tags=record.tags or [],
        attachments=record.attachments or [],
        key_terms=record.key_terms or [],
        created_at=record.created_at.isoformat(),
        answers=[answer_from_record(answer) for answer in record.answers],
    )


def message_from_record(record: MessageRecord) -> MessagePublic:
    return MessagePublic(
        id=record.id,
        sender_id=record.sender_id,
        sender_name=record.sender_name,
        body=record.body,
        created_at=record.created_at.isoformat(),
    )


def conversation_role(record: ConversationRecord, user: UserRecord) -> Literal["student", "mentor"]:
    if user.id == record.student_id:
        return "student"
    if user.id == record.mentor_id:
        return "mentor"
    raise HTTPException(status_code=403, detail="You are not part of this conversation")


def conversation_last_read_at(
    record: ConversationRecord, role: Literal["student", "mentor"]
) -> datetime | None:
    return record.student_last_read_at if role == "student" else record.mentor_last_read_at


def set_conversation_last_read_at(
    record: ConversationRecord, role: Literal["student", "mentor"], value: datetime
) -> None:
    if role == "student":
        record.student_last_read_at = value
    else:
        record.mentor_last_read_at = value


def conversation_flag(
    record: ConversationRecord, role: Literal["student", "mentor"], field: str
) -> bool:
    return bool(getattr(record, f"{role}_{field}"))


def set_conversation_flag(
    record: ConversationRecord,
    role: Literal["student", "mentor"],
    field: str,
    value: bool,
) -> None:
    setattr(record, f"{role}_{field}", value)


def unread_messages_for_user(
    record: ConversationRecord, role: Literal["student", "mentor"]
) -> int:
    user_id = record.student_id if role == "student" else record.mentor_id
    last_read_at = conversation_last_read_at(record, role)
    return sum(
        1
        for message in record.messages
        if message.sender_id != user_id
        and (last_read_at is None or message.created_at > last_read_at)
    )


def conversation_from_record(
    record: ConversationRecord, user: UserRecord | None = None
) -> ConversationPublic:
    role = conversation_role(record, user) if user is not None else None
    last_read_at = conversation_last_read_at(record, role) if role else None
    return ConversationPublic(
        id=record.id,
        student_id=record.student_id,
        student_name=record.student_name,
        mentor_id=record.mentor_id,
        mentor_name=record.mentor_name,
        mentor_programme=record.mentor_programme,
        last_message=record.last_message,
        updated_at=record.updated_at.isoformat(),
        unread_count=unread_messages_for_user(record, role) if role else 0,
        last_read_at=last_read_at.isoformat() if last_read_at else None,
        is_pinned=conversation_flag(record, role, "pinned") if role else False,
        is_archived=conversation_flag(record, role, "archived") if role else False,
        is_muted=conversation_flag(record, role, "muted") if role else False,
        messages=[message_from_record(message) for message in record.messages],
    )


def notification_from_record(record: NotificationRecord) -> NotificationPublic:
    return NotificationPublic(
        id=record.id,
        user_id=record.user_id,
        actor_id=record.actor_id,
        actor_name=record.actor_name,
        type=record.type,  # type: ignore[arg-type]
        title=record.title,
        body=record.body,
        target_type=record.target_type,
        target_id=record.target_id,
        is_read=record.is_read,
        read_at=record.read_at.isoformat() if record.read_at else None,
        created_at=record.created_at.isoformat(),
    )


def create_notification(
    db: Session,
    *,
    user_id: str,
    actor: UserRecord,
    notification_type: NotificationType,
    title: str,
    body: str,
    target_type: str,
    target_id: str,
) -> NotificationRecord | None:
    if user_id == actor.id:
        return None
    notification = NotificationRecord(
        id=f"n_{uuid4().hex[:10]}",
        user_id=user_id,
        actor_id=actor.id,
        actor_name=actor.name,
        type=notification_type,
        title=title[:255],
        body=body,
        target_type=target_type,
        target_id=target_id,
    )
    db.add(notification)
    return notification


def truncate_notification_body(value: str, limit: int = 180) -> str:
    collapsed = " ".join(value.split())
    if len(collapsed) <= limit:
        return collapsed
    return f"{collapsed[: limit - 3].rstrip()}..."


def connection_from_record(record: ConnectionRecord) -> ConnectionPublic:
    return ConnectionPublic(
        id=record.id,
        student_id=record.student_id,
        student_name=record.student_name,
        mentor_id=record.mentor_id,
        mentor_name=record.mentor_name,
        mentor_programme=record.mentor_programme,
        status=record.status,
        created_at=record.created_at.isoformat(),
        updated_at=record.updated_at.isoformat(),
    )


def availability_from_record(
    record: MentorAvailabilityRecord,
) -> AvailabilitySlotPublic:
    return AvailabilitySlotPublic(
        id=record.id,
        mentor_id=record.mentor_id,
        day_of_week=record.day_of_week,  # type: ignore[arg-type]
        start_time=record.start_time,
        end_time=record.end_time,
        timezone=record.timezone,
        mode=record.mode,  # type: ignore[arg-type]
        location=record.location,
        is_active=record.is_active,
        created_at=record.created_at.isoformat(),
        updated_at=record.updated_at.isoformat(),
    )


def review_from_record(record: ReviewRecord, student_name: str) -> ReviewPublic:
    return ReviewPublic(
        id=record.id,
        connection_id=record.connection_id,
        student_id=record.student_id,
        student_name=student_name,
        mentor_id=record.mentor_id,
        rating=record.rating,
        comment=record.comment,
        created_at=record.created_at.isoformat(),
        updated_at=record.updated_at.isoformat(),
    )


def get_user_from_token(authorization: str | None, db: Session) -> UserRecord:
    claims = claims_from_authorization(authorization)
    user = db.scalar(
        select(UserRecord).where(UserRecord.supabase_user_id == claims.user_id)
    )
    if user is None:
        raise HTTPException(
            status_code=404, detail="NUSphere profile not found; complete profile setup"
        )

    return user


def normalise_keyword(value: str) -> str:
    return " ".join(
        "".join(
            character.lower() if character.isalnum() else " " for character in value
        ).split()
    )


def singular_keyword(token: str) -> str:
    if len(token) > 3 and token.endswith("s"):
        return token[:-1]
    return token


def keyword_term_matches(term: str, candidate: str) -> bool:
    normalised_term = normalise_keyword(term)
    normalised_candidate = normalise_keyword(candidate)
    if not normalised_term or not normalised_candidate:
        return False

    if normalised_term == normalised_candidate:
        return True

    term_parts = normalised_term.split()
    candidate_parts = normalised_candidate.split()
    candidate_tokens = {singular_keyword(part) for part in candidate_parts}

    if len(normalised_term) <= 2:
        return normalised_term in candidate_parts

    if len(term_parts) > 1:
        meaningful_parts = [
            singular_keyword(part) for part in term_parts if len(part) > 2
        ]
        return normalised_term in normalised_candidate or (
            bool(meaningful_parts)
            and all(part in candidate_tokens for part in meaningful_parts)
        )

    return singular_keyword(normalised_term) in candidate_tokens


MENTOR_STOP_WORDS = STOP_WORDS | {
    "area",
    "areas",
    "available",
    "based",
    "build",
    "connect",
    "experience",
    "experiences",
    "explore",
    "find",
    "goal",
    "goals",
    "guide",
    "looking",
    "major",
    "minor",
    "nus",
    "programme",
    "role",
    "senior",
    "year",
    "years",
}
SHORT_MEANINGFUL_MENTOR_TOKENS = {"ai", "ml", "ui", "ux"}


def meaningful_mentor_tokens(*values: str) -> set[str]:
    tokens: set[str] = set()
    for value in values:
        for token in normalise_keyword(value).split():
            normalised = singular_keyword(token)
            if (
                (len(normalised) >= 3 or normalised in SHORT_MEANINGFUL_MENTOR_TOKENS)
                and not normalised.isdigit()
                and normalised not in MENTOR_STOP_WORDS
            ):
                tokens.add(normalised)
    return tokens


def mentor_search_terms(mentor: Mentor) -> set[str]:
    return meaningful_mentor_tokens(
        mentor.name,
        mentor.mentor_type_label,
        mentor.programme,
        mentor.faculty,
        mentor.role,
        mentor.bio,
        *(mentor.interests or []),
        *(mentor.experience_tags or []),
        *(mentor.experience or []),
    )


def profile_search_terms(request: RecommendationRequest) -> set[str]:
    return meaningful_mentor_tokens(
        request.faculty or "",
        request.bio or "",
        *(request.interests or []),
        *(request.goals or []),
    )


GOAL_STOP_WORDS = STOP_WORDS | {
    "field",
    "fields",
    "find",
    "goal",
    "goals",
    "help",
    "looking",
    "opportunity",
    "opportunities",
    "project",
    "projects",
}


def meaningful_goal_tokens(*values: str) -> set[str]:
    tokens: set[str] = set()
    for value in values:
        for token in normalise_keyword(value).split():
            normalised = singular_keyword(token)
            if (
                (len(normalised) >= 3 or normalised in SHORT_MEANINGFUL_MENTOR_TOKENS)
                and not normalised.isdigit()
                and token not in GOAL_STOP_WORDS
                and normalised not in GOAL_STOP_WORDS
            ):
                tokens.add(normalised)
    return tokens


def mentor_goal_target_terms(mentor: UserRecord) -> set[str]:
    return meaningful_goal_tokens(
        mentor.faculty,
        mentor.department or "",
        mentor.major,
        mentor.bio or "",
        mentor.mentorship_goals or "",
        mentor.current_role or "",
        mentor.organisation or "",
        *(mentor.interests or []),
        *(mentor.goals or []),
        *(mentor.modules_taken or []),
        *(mentor.modules_taught or []),
        *(mentor.ccas or []),
        *(mentor.nus_opportunities or []),
        *(mentor.exchange_universities or []),
        *(mentor.areas_of_expertise or []),
    )


def goal_text_relevance(query: str, target_terms: set[str]) -> float:
    query_terms = meaningful_goal_tokens(query)
    if not query_terms or not target_terms:
        return 0.0
    overlap = query_terms & target_terms
    return min(1.0, len(overlap) / max(3, min(len(query_terms), len(target_terms))))


def recommendation_query_terms(request: RecommendationRequest) -> list[str]:
    return sorted(profile_search_terms(request))


def score_mentor(mentor: Mentor, request: RecommendationRequest) -> int:
    query_terms = profile_search_terms(request)
    mentor_terms = mentor_search_terms(mentor)
    score = round(token_overlap_score(query_terms, mentor_terms) * 48)

    for phrases, weight in [
        (request.interests or [], 16),
        (request.goals or [], 14),
        ([request.bio or ""], 10),
    ]:
        if any(
            meaningful_mentor_tokens(phrase) & mentor_terms
            for phrase in phrases
            if phrase
        ):
            score += weight

    if request.faculty and request.faculty.lower() == mentor.faculty.lower():
        score += 10
    if meaningful_mentor_tokens(request.faculty or "") & meaningful_mentor_tokens(
        mentor.programme, mentor.faculty
    ):
        score += 4
    return max(0, min(99, score))


def match_reasons(mentor: Mentor, request: RecommendationRequest) -> list[str]:
    profile_terms = profile_search_terms(request)
    mentor_terms = mentor_search_terms(mentor)
    shared_terms = sorted(profile_terms & mentor_terms)
    reasons: list[str] = []
    for label, values in [
        ("Interest", request.interests or []),
        ("Goal", request.goals or []),
    ]:
        match = next(
            (
                value
                for value in values
                if meaningful_mentor_tokens(value) & mentor_terms
            ),
            None,
        )
        if match:
            reasons.append(f"{label} appears relevant: {match}")
    if request.bio and meaningful_mentor_tokens(request.bio) & mentor_terms:
        reasons.append("About section overlaps with this mentor's experience")
    if request.faculty and request.faculty.lower() == mentor.faculty.lower():
        reasons.append(f"Same faculty: {mentor.faculty}")
    if shared_terms and len(reasons) < 3:
        pretty_terms = [
            term.upper() if term in {"ai", "ml", "ux", "ui"} else term
            for term in shared_terms[:4]
        ]
        reasons.append("Shared meaningful terms: " + ", ".join(pretty_terms))
    if not reasons:
        reasons.append(
            "Limited direct profile overlap; compare profile details before connecting"
        )
    return reasons[:3]


def recommendation_request_from_user(user: UserRecord) -> RecommendationRequest:
    return RecommendationRequest(
        interests=user.interests or [],
        goals=[
            *(user.goals or []),
            user.major,
            *(user.modules_taken or []),
            *(user.ccas or []),
            *(user.nus_opportunities or []),
            *(user.exchange_universities or []),
        ],
        bio=user.bio or "",
        faculty=user.faculty,
        minimum_score=0,
    )


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def mentor_from_user(
    user: UserRecord,
    answers_count: int = 0,
    rating: float = 0,
    reviews_count: int = 0,
    mentees_count: int = 0,
    availability: list[AvailabilitySlotPublic] | None = None,
) -> Mentor:
    mentor_type_labels = {
        "senior": "Senior Student",
        "alumni": "Alumni",
        "professor": "Professor",
        "nus_staff": "NUS Staff",
        "other": user.mentor_type_other or "Other Mentor",
    }
    mentor_type_label = mentor_type_labels.get(user.mentor_type or "senior", "Mentor")
    experience_tags = [
        *user.modules_taken,
        *user.ccas,
        *user.nus_opportunities,
        *user.exchange_universities,
        *user.modules_taught,
        *user.areas_of_expertise,
        user.accommodation,
        user.department or "",
        user.office or "",
        user.organisation or "",
        user.current_role or "",
    ]
    experience = [
        item
        for item in [
            f"Mentor type: {mentor_type_label}",
            f"Major / programme: {user.major}" if user.major else "",
            f"Faculty: {user.faculty}" if user.faculty else "",
            f"Department: {user.department}" if user.department else "",
            f"Current role: {user.current_role}" if user.current_role else "",
            f"Organisation: {user.organisation}" if user.organisation else "",
            (
                f"Modules taught: {', '.join(user.modules_taught)}"
                if user.modules_taught
                else ""
            ),
            (
                f"Consultation hours: {user.consultation_hours}"
                if user.consultation_hours
                else ""
            ),
            f"Office / cubicle: {user.office_location}" if user.office_location else "",
            f"Office: {user.office}" if user.office else "",
            (
                f"Areas of expertise: {', '.join(user.areas_of_expertise)}"
                if user.areas_of_expertise
                else ""
            ),
            (
                f"NUS opportunities: {', '.join(user.nus_opportunities)}"
                if user.nus_opportunities
                else ""
            ),
            f"CCAs: {', '.join(user.ccas)}" if user.ccas else "",
            (
                f"Exchange interests: {', '.join(user.exchange_universities)}"
                if user.exchange_universities
                else ""
            ),
            user.mentorship_goals or "",
        ]
        if item
    ]
    return Mentor(
        id=user.id,
        email=str(user.email),
        name=user.name,
        mentor_type=user.mentor_type,
        mentor_type_label=mentor_type_label,
        year=mentor_type_label,
        programme=user.department
        or user.major
        or user.current_role
        or user.office
        or mentor_type_label,
        faculty=user.faculty,
        department=user.department,
        role=mentor_type_label,
        rating=rating,
        reviews=reviews_count,
        mentees=mentees_count,
        answers=answers_count,
        match_score=72,
        keyword_match_score=72,
        interests=user.areas_of_expertise or user.interests or user.goals,
        experience_tags=experience_tags,
        bio=user.bio
        or user.mentorship_goals
        or "This mentor has not added a description yet.",
        experience=experience or ["Mentor profile created during sign up"],
        verification_status=user.verification_status,  # type: ignore[arg-type]
        availability=availability or [],
    )


def available_mentors(db: Session) -> list[Mentor]:
    answer_counts = dict(
        db.execute(
            select(AnswerRecord.mentor_id, func.count(AnswerRecord.id)).group_by(
                AnswerRecord.mentor_id
            )
        ).all()
    )
    review_stats = {
        mentor_id: (round(float(average or 0), 1), int(count))
        for mentor_id, average, count in db.execute(
            select(
                ReviewRecord.mentor_id,
                func.avg(ReviewRecord.rating),
                func.count(ReviewRecord.id),
            ).group_by(ReviewRecord.mentor_id)
        ).all()
    }
    mentee_counts = dict(
        db.execute(
            select(ConnectionRecord.mentor_id, func.count(ConnectionRecord.id))
            .where(ConnectionRecord.status == "accepted")
            .group_by(ConnectionRecord.mentor_id)
        ).all()
    )
    weekday_order = {
        day: index
        for index, day in enumerate(
            [
                "monday",
                "tuesday",
                "wednesday",
                "thursday",
                "friday",
                "saturday",
                "sunday",
            ]
        )
    }
    availability_by_mentor: dict[str, list[AvailabilitySlotPublic]] = {}
    for slot in db.scalars(
        select(MentorAvailabilityRecord).where(
            MentorAvailabilityRecord.is_active.is_(True)
        )
    ).all():
        availability_by_mentor.setdefault(slot.mentor_id, []).append(
            availability_from_record(slot)
        )
    for slots in availability_by_mentor.values():
        slots.sort(key=lambda slot: (weekday_order[slot.day_of_week], slot.start_time))

    registered_mentors = [
        mentor_from_user(
            user,
            answers_count=int(answer_counts.get(user.id, 0)),
            rating=review_stats.get(user.id, (0, 0))[0],
            reviews_count=review_stats.get(user.id, (0, 0))[1],
            mentees_count=int(mentee_counts.get(user.id, 0)),
            availability=availability_by_mentor.get(user.id, []),
        )
        for user in db.scalars(
            select(UserRecord).where(UserRecord.role == "mentor")
        ).all()
    ]
    return [*registered_mentors, *static_mentors]


def find_mentor_by_id(mentor_id: str, db: Session) -> Mentor:
    for mentor in available_mentors(db):
        if mentor.id == mentor_id:
            return mentor
    raise HTTPException(status_code=404, detail="Mentor not found")


def accepted_connection_for_review(
    student_id: str, mentor_id: str, db: Session
) -> ConnectionRecord | None:
    return db.scalar(
        select(ConnectionRecord).where(
            ConnectionRecord.student_id == student_id,
            ConnectionRecord.mentor_id == mentor_id,
            ConnectionRecord.status == "accepted",
        )
    )


def review_eligibility_for(
    student: UserRecord, mentor_id: str, db: Session
) -> ReviewEligibility:
    mentor = db.scalar(
        select(UserRecord).where(
            UserRecord.id == mentor_id, UserRecord.role == "mentor"
        )
    )
    if mentor is None:
        raise HTTPException(status_code=404, detail="Mentor not found")
    if student.role != "student":
        return ReviewEligibility(
            mentor_id=mentor_id,
            can_review=False,
            reason="Only students can review mentors",
        )

    connection = accepted_connection_for_review(student.id, mentor_id, db)
    if connection is None:
        return ReviewEligibility(
            mentor_id=mentor_id,
            can_review=False,
            reason="An accepted mentor connection is required before reviewing",
        )

    existing = db.scalar(
        select(ReviewRecord).where(ReviewRecord.connection_id == connection.id)
    )
    if existing is not None:
        return ReviewEligibility(
            mentor_id=mentor_id,
            can_review=False,
            reason="A review has already been submitted for this connection",
            connection_id=connection.id,
            existing_review=review_from_record(existing, student.name),
        )
    return ReviewEligibility(
        mentor_id=mentor_id,
        can_review=True,
        reason="Accepted mentor connection found",
        connection_id=connection.id,
    )


def ensure_conversation_for_connection(
    connection: ConnectionRecord, db: Session
) -> ConversationRecord:
    existing = db.get(ConversationRecord, connection.id)
    if existing:
        return existing
    created_at = datetime.now(timezone.utc)
    greeting = MessageRecord(
        id=f"m_{uuid4().hex[:10]}",
        conversation_id=connection.id,
        sender_id=connection.mentor_id,
        sender_name=connection.mentor_name,
        body=f"Connection accepted. Hi {connection.student_name}, happy to continue the conversation here.",
        created_at=created_at,
    )
    conversation = ConversationRecord(
        id=connection.id,
        student_id=connection.student_id,
        student_name=connection.student_name,
        mentor_id=connection.mentor_id,
        mentor_name=connection.mentor_name,
        mentor_programme=connection.mentor_programme,
        last_message=greeting.body,
        mentor_last_read_at=created_at,
        updated_at=created_at,
    )
    db.add(conversation)
    db.add(greeting)
    db.flush()
    return conversation


def upsert_profile_embedding(user: UserRecord, db: Session) -> ProfileEmbeddingRecord:
    source_text = user_profile_text(
        user,
        perspective="mentor guidance" if user.role == "mentor" else "student goals",
    )
    embedding, model = embed_text(source_text)
    embedding_id = f"{user.id}_profile"
    record = db.get(ProfileEmbeddingRecord, embedding_id)
    if record is None:
        record = ProfileEmbeddingRecord(
            id=embedding_id,
            user_id=user.id,
            role=user.role,
            embedding_type="profile",
            model=model,
            source_text=source_text,
            embedding=embedding,
        )
        db.add(record)
    else:
        record.role = user.role
        record.model = model
        record.source_text = source_text
        record.embedding = embedding
    db.flush()
    return record


def ensure_profile_embedding(user: UserRecord, db: Session) -> ProfileEmbeddingRecord:
    record = db.get(ProfileEmbeddingRecord, f"{user.id}_profile")
    source_text = user_profile_text(
        user,
        perspective="mentor guidance" if user.role == "mentor" else "student goals",
    )
    if (
        record is None
        or record.source_text != source_text
        or record.model != expected_embedding_model()
    ):
        return upsert_profile_embedding(user, db)
    return record


def ai_ranked_mentors(
    student: UserRecord,
    query_embedding: list[float],
    db: Session,
    mode: str,
    minimum_score: int = 0,
    *,
    query_model: str | None = None,
    query_text: str | None = None,
) -> list[Mentor]:
    mentors = db.scalars(select(UserRecord).where(UserRecord.role == "mentor")).all()
    mentor_profiles = {mentor.id: mentor for mentor in available_mentors(db)}
    keyword_request = recommendation_request_from_user(student)
    student_profile_embedding = ensure_profile_embedding(student, db)
    active_query_model = query_model or student_profile_embedding.model
    weights = matching_weights()

    def score_component(score: float, weight: float) -> MatchScoreComponent:
        bounded = max(0.0, min(1.0, score))
        return MatchScoreComponent(
            score=round(bounded * 100),
            weight=round(weight * 100),
            weighted_points=round(bounded * weight * 100, 1),
        )

    ranked: list[Mentor] = []
    for mentor_user in mentors:
        embedding_record = ensure_profile_embedding(mentor_user, db)
        semantic = (
            max(0.0, cosine_similarity(query_embedding, embedding_record.embedding))
            if active_query_model == embedding_record.model
            else 0.0
        )
        goal_relevance = (
            goal_text_relevance(query_text or "", mentor_goal_target_terms(mentor_user))
            if mode == "goal"
            else 0.0
        )
        goal_signal = (
            max(semantic, (semantic * 0.35) + (goal_relevance * 0.65))
            if mode == "goal"
            else semantic
        )
        profile_semantic = (
            max(
                0.0,
                cosine_similarity(
                    student_profile_embedding.embedding,
                    embedding_record.embedding,
                ),
            )
            if student_profile_embedding.model == embedding_record.model
            else 0.0
        )
        overlap = structured_overlap(student, mentor_user)
        completeness = profile_completeness(mentor_user)
        faculty_boost = 1.0 if student.faculty == mentor_user.faculty else 0.0
        final_score = (
            round(goal_signal * 100)
            if mode == "goal"
            else round(
                weighted_match_score(
                    semantic=semantic,
                    structured=overlap,
                    faculty=faculty_boost,
                    completeness=completeness,
                    weights=weights,
                )
                * 100
            )
        )
        bounded_score = max(0, min(99, final_score))
        profile_score = max(
            0,
            min(
                99,
                round(
                    weighted_match_score(
                        semantic=profile_semantic,
                        structured=overlap,
                        faculty=faculty_boost,
                        completeness=completeness,
                        weights=weights,
                    )
                    * 100
                ),
            ),
        )
        base_mentor = mentor_profiles[mentor_user.id]
        keyword_score = score_mentor(base_mentor, keyword_request)
        score_update = {
            "match_score": bounded_score,
            "keyword_match_score": keyword_score,
            "profile_match_score": profile_score,
            "match_label": (
                "Complete profile match" if mode == "profile" else "Goal match"
            ),
            "match_reasons": match_explanation(
                student,
                mentor_user,
                mode,
                goal_signal,
                overlap,
                query=query_text,
            ),
            "match_score_breakdown": MatchScoreBreakdown(
                semantic=score_component(
                    goal_signal, 1.0 if mode == "goal" else weights.semantic
                ),
                structured=score_component(
                    0.0 if mode == "goal" else overlap,
                    0.0 if mode == "goal" else weights.structured,
                ),
                faculty=score_component(
                    0.0 if mode == "goal" else faculty_boost,
                    0.0 if mode == "goal" else weights.faculty,
                ),
                completeness=score_component(
                    0.0 if mode == "goal" else completeness,
                    0.0 if mode == "goal" else weights.completeness,
                ),
                total=bounded_score,
            ),
            "embedding_model": active_query_model,
            "embedding_provider": (
                "local" if active_query_model.startswith("local-hashing") else "openai"
            ),
            "embedding_fallback": active_query_model.startswith("local-hashing"),
        }
        if mode == "profile":
            score_update["profile_match_score"] = bounded_score
        else:
            score_update["goal_match_score"] = bounded_score
        mentor = base_mentor.model_copy(update=score_update)
        if mentor.match_score >= minimum_score:
            ranked.append(mentor)
    db.commit()
    return sorted(ranked, key=lambda item: item.match_score, reverse=True)


def clean_string_list(values: list[str]) -> list[str]:
    seen: set[str] = set()
    cleaned: list[str] = []
    for value in values:
        item = value.strip()
        key = item.lower()
        if item and key not in seen:
            seen.add(key)
            cleaned.append(item)
    return cleaned


OPPORTUNITY_STOP_WORDS = STOP_WORDS | {
    "based",
    "brief",
    "campus",
    "check",
    "detail",
    "details",
    "experience",
    "experiences",
    "explore",
    "field",
    "fields",
    "find",
    "goal",
    "goals",
    "intro",
    "join",
    "learn",
    "learning",
    "make",
    "minor",
    "module",
    "modules",
    "needed",
    "nus",
    "open",
    "opportunity",
    "opportunities",
    "page",
    "post",
    "posts",
    "profile",
    "quick",
    "section",
    "suited",
    "university",
    "use",
    "user",
    "users",
    "all",
}
SHORT_MEANINGFUL_OPPORTUNITY_TOKENS = {"ai", "ml", "ui", "ux"}


def meaningful_opportunity_tokens(*values: str) -> set[str]:
    tokens: set[str] = set()
    for value in values:
        for token in normalise_keyword(value).split():
            normalised = singular_keyword(token)
            if (
                (len(normalised) >= 3 or normalised in SHORT_MEANINGFUL_OPPORTUNITY_TOKENS)
                and not normalised.isdigit()
                and normalised not in OPPORTUNITY_STOP_WORDS
            ):
                tokens.add(normalised)
    return tokens


def meaningful_profile_terms(student: UserRecord, *, query: str = "") -> set[str]:
    return meaningful_opportunity_tokens(
        student.faculty,
        student.major,
        student.bio or "",
        *(student.interests or []),
        *(student.goals or []),
        *(student.modules_taken or []),
        *(student.ccas or []),
        *(student.nus_opportunities or []),
        *(student.exchange_universities or []),
        query,
    )


def meaningful_opportunity_terms(opportunity: OpportunityRecord) -> set[str]:
    return meaningful_opportunity_tokens(
        opportunity.category,
        opportunity.title,
        opportunity.organisation,
        opportunity.summary,
        opportunity.description,
        opportunity.faculty or "",
        opportunity.commitment or "",
        opportunity.location or "",
        *(opportunity.target_years or []),
        *(opportunity.relevant_majors or []),
        *(opportunity.tags or []),
        *(opportunity.skills or []),
        *(opportunity.details or []),
    )


def opportunity_goal_target_terms(opportunity: OpportunityRecord) -> set[str]:
    return meaningful_goal_tokens(
        opportunity.category,
        opportunity.title,
        opportunity.organisation,
        opportunity.summary,
        opportunity.description,
        opportunity.faculty or "",
        opportunity.commitment or "",
        opportunity.location or "",
        *(opportunity.target_years or []),
        *(opportunity.relevant_majors or []),
        *(opportunity.tags or []),
        *(opportunity.skills or []),
        *(opportunity.details or []),
    )


def token_overlap_score(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0
    overlap = left & right
    # Reward meaningful overlap without letting long generic profiles dominate.
    return min(1.0, len(overlap) / max(3, min(len(left), len(right))))


def phrase_in_opportunity(phrase: str, opportunity: OpportunityRecord) -> bool:
    normalised = normalise_keyword(phrase)
    if not normalised or normalised in OPPORTUNITY_STOP_WORDS:
        return False
    phrase_tokens = meaningful_opportunity_tokens(phrase)
    if not phrase_tokens:
        return False
    if len(phrase_tokens) == 1:
        return next(iter(phrase_tokens)) in meaningful_opportunity_terms(opportunity)
    searchable = normalise_keyword(opportunity_text(opportunity))
    return normalised in searchable


def opportunity_from_record(record: OpportunityRecord) -> OpportunityPublic:
    return OpportunityPublic(
        id=record.id,
        poster_id=record.poster_id,
        poster_name=record.poster_name,
        poster_role=record.poster_role,  # type: ignore[arg-type]
        category=record.category,  # type: ignore[arg-type]
        title=record.title,
        organisation=record.organisation,
        summary=record.summary,
        description=record.description,
        faculty=record.faculty,
        location=record.location,
        commitment=record.commitment,
        start_date=record.start_date,
        end_date=record.end_date,
        deadline=record.deadline,
        application_url=record.application_url,
        contact_email=record.contact_email,
        target_years=record.target_years or [],
        relevant_majors=record.relevant_majors or [],
        tags=record.tags or [],
        skills=record.skills or [],
        details=record.details or [],
        is_verified=record.is_verified,
        created_at=record.created_at.isoformat(),
    )


def opportunity_text(record: OpportunityRecord) -> str:
    return "\n".join(
        [
            f"Opportunity category: {record.category}",
            f"Title: {record.title}",
            f"Organisation: {record.organisation}",
            f"Faculty: {record.faculty or ''}",
            f"Summary: {record.summary}",
            f"Description: {record.description}",
            f"Commitment: {record.commitment or ''}",
            f"Location: {record.location or ''}",
            f"Target years: {', '.join(record.target_years or [])}",
            f"Relevant majors: {', '.join(record.relevant_majors or [])}",
            f"Tags: {', '.join(record.tags or [])}",
            f"Skills: {', '.join(record.skills or [])}",
            f"Details: {', '.join(record.details or [])}",
        ]
    )


def upsert_opportunity_embedding(
    opportunity: OpportunityRecord, db: Session
) -> ProfileEmbeddingRecord:
    source_text = opportunity_text(opportunity)
    embedding, model = embed_text(source_text)
    embedding_id = f"{opportunity.id}_opportunity"
    record = db.get(ProfileEmbeddingRecord, embedding_id)
    if record is None:
        record = ProfileEmbeddingRecord(
            id=embedding_id,
            user_id=opportunity.poster_id,
            role="opportunity",
            embedding_type="opportunity",
            model=model,
            source_text=source_text,
            embedding=embedding,
        )
        db.add(record)
    else:
        record.user_id = opportunity.poster_id
        record.role = "opportunity"
        record.model = model
        record.source_text = source_text
        record.embedding = embedding
    db.flush()
    return record


def ensure_opportunity_embedding(
    opportunity: OpportunityRecord, db: Session
) -> ProfileEmbeddingRecord:
    record = db.get(ProfileEmbeddingRecord, f"{opportunity.id}_opportunity")
    source_text = opportunity_text(opportunity)
    if (
        record is None
        or record.source_text != source_text
        or record.model != expected_embedding_model()
    ):
        return upsert_opportunity_embedding(opportunity, db)
    return record


def opportunity_structured_overlap(
    student: UserRecord, opportunity: OpportunityRecord
) -> float:
    score = 0.0
    available_weight = 0.0

    if opportunity.faculty:
        available_weight += 0.15
        if opportunity.faculty.lower() == student.faculty.lower():
            score += 0.15
    if opportunity.relevant_majors:
        available_weight += 0.15
        major_tokens = meaningful_opportunity_tokens(*opportunity.relevant_majors)
        if meaningful_opportunity_tokens(student.major) & major_tokens:
            score += 0.15

    list_checks = [
        (
            student.interests or [],
            (opportunity.tags or []) + (opportunity.skills or []),
            0.24,
        ),
        (
            student.modules_taken or [],
            (opportunity.tags or []) + (opportunity.details or []),
            0.12,
        ),
        (
            student.ccas or [],
            (opportunity.tags or []) + [opportunity.organisation],
            0.10,
        ),
        (
            student.nus_opportunities or [],
            (opportunity.tags or []) + [opportunity.title, opportunity.summary],
            0.12,
        ),
        (
            [student.bio or "", *(student.goals or [])],
            (opportunity.skills or [])
            + (opportunity.tags or [])
            + [opportunity.summary, opportunity.description],
            0.22,
        ),
    ]
    for left_items, right_items, weight in list_checks:
        left = meaningful_opportunity_tokens(*left_items)
        right = meaningful_opportunity_tokens(*right_items)
        if left and right:
            available_weight += weight
            score += weight * token_overlap_score(left, right)

    return max(0.0, min(1.0, score / available_weight)) if available_weight else 0.0


def opportunity_completeness(opportunity: OpportunityRecord) -> float:
    fields = [
        opportunity.title,
        opportunity.organisation,
        opportunity.summary,
        opportunity.description,
        opportunity.faculty,
        opportunity.commitment,
        opportunity.deadline,
        opportunity.target_years,
        opportunity.relevant_majors,
        opportunity.tags,
        opportunity.skills,
    ]
    return sum(1 for field in fields if field) / len(fields)


def opportunity_profile_match_score(
    student: UserRecord, opportunity: OpportunityRecord, db: Session
) -> int:
    student_embedding = ensure_profile_embedding(student, db)
    opportunity_embedding = ensure_opportunity_embedding(opportunity, db)
    semantic = (
        max(0.0, cosine_similarity(student_embedding.embedding, opportunity_embedding.embedding))
        if student_embedding.model == opportunity_embedding.model
        else 0.0
    )
    overlap = opportunity_structured_overlap(student, opportunity)
    faculty_boost = (
        1.0
        if opportunity.faculty and opportunity.faculty.lower() == student.faculty.lower()
        else 0.0
    )
    score = weighted_match_score(
        semantic=semantic,
        structured=overlap,
        faculty=faculty_boost,
        completeness=opportunity_completeness(opportunity),
        weights=matching_weights(),
    )
    return max(0, min(99, round(score * 100)))


def standard_opportunity_score(
    opportunity: OpportunityRecord, student: UserRecord, query: str = ""
) -> int:
    profile_tokens = meaningful_profile_terms(student, query=query)
    opportunity_tokens = meaningful_opportunity_terms(opportunity)
    overlap = profile_tokens & opportunity_tokens

    score = round(token_overlap_score(profile_tokens, opportunity_tokens) * 48)
    phrase_groups = [
        (student.interests or [], 16),
        (student.goals or [], 14),
        (student.nus_opportunities or [], 14),
        (student.ccas or [], 8),
        (student.modules_taken or [], 6),
    ]
    for phrases, weight in phrase_groups:
        if any(phrase_in_opportunity(phrase, opportunity) for phrase in phrases):
            score += weight

    if opportunity.faculty and opportunity.faculty.lower() == student.faculty.lower():
        score += 10
    if opportunity.relevant_majors:
        major_tokens = meaningful_opportunity_tokens(student.major)
        opportunity_major_tokens = meaningful_opportunity_tokens(
            *(opportunity.relevant_majors or [])
        )
        if major_tokens & opportunity_major_tokens:
            score += 12
    query_overlap = meaningful_opportunity_tokens(query) & opportunity_tokens
    if query_overlap:
        score += min(10, len(query_overlap) * 3)
    return max(0, min(99, score))


def opportunity_match_reasons(
    opportunity: OpportunityRecord,
    student: UserRecord,
    semantic: float | None = None,
    overlap: float | None = None,
    *,
    query: str = "",
    mode: str = "standard",
) -> list[str]:
    reasons: list[str] = []
    opportunity_tokens = meaningful_opportunity_terms(opportunity)
    if mode == "goal":
        if query:
            query_hits = sorted(meaningful_opportunity_tokens(query) & opportunity_tokens)
            if query_hits:
                reasons.append("Goal terms found: " + ", ".join(query_hits[:3]))
        if semantic is not None:
            reasons.append(
                f"Measured typed-goal fit: {round(max(0, min(1, semantic)) * 100)}% goal relevance"
            )
        return reasons or ["No direct goal terms found; ranked by semantic similarity"]

    profile_tokens = meaningful_profile_terms(student, query=query)
    shared_tokens = sorted(profile_tokens & opportunity_tokens)
    for label, values in [
        ("Interest", student.interests or []),
        ("Goal", student.goals or []),
        ("NUS opportunity", student.nus_opportunities or []),
        ("CCA or activity", student.ccas or []),
        ("Module", student.modules_taken or []),
    ]:
        match = next((value for value in values if phrase_in_opportunity(value, opportunity)), None)
        if match:
            reasons.append(f"{label} appears relevant: {match}")
    if opportunity.faculty and opportunity.faculty.lower() == student.faculty.lower():
        reasons.append(f"Faculty fit: {opportunity.faculty}")
    if opportunity.relevant_majors:
        major_tokens = meaningful_opportunity_tokens(student.major)
        opportunity_major_tokens = meaningful_opportunity_tokens(
            *(opportunity.relevant_majors or [])
        )
        if major_tokens & opportunity_major_tokens:
            reasons.append(f"Major fit: {student.major}")
    if shared_tokens and len(reasons) < 3:
        pretty_tokens = [token.upper() if token in {"ai", "noc", "urop"} else token for token in shared_tokens[:4]]
        reasons.append("Shared meaningful terms: " + ", ".join(pretty_tokens))
    if query:
        query_hits = sorted(meaningful_opportunity_tokens(query) & opportunity_tokens)
        if query_hits:
            reasons.append("Goal terms found: " + ", ".join(query_hits[:3]))
    if semantic is not None and overlap is not None:
        label = "goal description" if mode == "goal" else "complete profile"
        measured_reason = (
            f"Measured {label} fit: {round(max(0, min(1, semantic)) * 100)}% "
            f"semantic similarity and {round(max(0, min(1, overlap)) * 100)}% structured overlap"
        )
        return [*reasons[:3], measured_reason]
    reasons.append("Verified post from a mentor" if opportunity.is_verified else "Unverified student-submitted opportunity")
    return reasons[:4]


def opportunity_score_component(score: float, weight: float) -> MatchScoreComponent:
    bounded = max(0.0, min(1.0, score))
    return MatchScoreComponent(
        score=round(bounded * 100),
        weight=round(weight * 100),
        weighted_points=round(bounded * weight * 100, 1),
    )


def ai_ranked_opportunities(
    student: UserRecord,
    query_embedding: list[float],
    db: Session,
    mode: str,
    minimum_score: int = 0,
    *,
    query_model: str,
    query_text: str = "",
) -> list[OpportunityPublic]:
    opportunities = db.scalars(
        select(OpportunityRecord).order_by(OpportunityRecord.created_at.desc())
    ).all()
    student_profile_embedding = ensure_profile_embedding(student, db)
    weights = matching_weights()
    ranked: list[OpportunityPublic] = []
    for opportunity in opportunities:
        embedding_record = ensure_opportunity_embedding(opportunity, db)
        semantic = (
            max(0.0, cosine_similarity(query_embedding, embedding_record.embedding))
            if query_model == embedding_record.model
            else 0.0
        )
        goal_relevance = (
            goal_text_relevance(query_text, opportunity_goal_target_terms(opportunity))
            if mode == "goal"
            else 0.0
        )
        goal_signal = (
            max(semantic, (semantic * 0.35) + (goal_relevance * 0.65))
            if mode == "goal"
            else semantic
        )
        profile_semantic = (
            max(0.0, cosine_similarity(student_profile_embedding.embedding, embedding_record.embedding))
            if student_profile_embedding.model == embedding_record.model
            else 0.0
        )
        overlap = opportunity_structured_overlap(student, opportunity)
        faculty_boost = (
            1.0
            if opportunity.faculty and opportunity.faculty.lower() == student.faculty.lower()
            else 0.0
        )
        completeness = opportunity_completeness(opportunity)
        score = (
            round(goal_signal * 100)
            if mode == "goal"
            else round(
                weighted_match_score(
                    semantic=semantic,
                    structured=overlap,
                    faculty=faculty_boost,
                    completeness=completeness,
                    weights=weights,
                )
                * 100
            )
        )
        bounded_score = max(0, min(99, score))
        profile_score = max(
            0,
            min(
                99,
                round(
                    weighted_match_score(
                        semantic=profile_semantic,
                        structured=overlap,
                        faculty=faculty_boost,
                        completeness=completeness,
                        weights=weights,
                    )
                    * 100
                ),
            ),
        )
        keyword_score = standard_opportunity_score(opportunity, student, query_text)
        item = opportunity_from_record(opportunity).model_copy(
            update={
                "match_score": bounded_score,
                "keyword_match_score": keyword_score,
                "profile_match_score": (
                    bounded_score
                    if mode == "profile"
                    else None
                    if mode == "goal"
                    else profile_score
                ),
                "goal_match_score": bounded_score if mode == "goal" else None,
                "match_label": "Complete profile match" if mode == "profile" else "Goal match",
                "match_reasons": opportunity_match_reasons(
                    opportunity,
                    student,
                    goal_signal,
                    overlap,
                    query=query_text,
                    mode=mode,
                ),
                "match_score_breakdown": MatchScoreBreakdown(
                    semantic=opportunity_score_component(
                        goal_signal, 1.0 if mode == "goal" else weights.semantic
                    ),
                    structured=opportunity_score_component(
                        0.0 if mode == "goal" else overlap,
                        0.0 if mode == "goal" else weights.structured,
                    ),
                    faculty=opportunity_score_component(
                        0.0 if mode == "goal" else faculty_boost,
                        0.0 if mode == "goal" else weights.faculty,
                    ),
                    completeness=opportunity_score_component(
                        0.0 if mode == "goal" else completeness,
                        0.0 if mode == "goal" else weights.completeness,
                    ),
                    total=bounded_score,
                ),
                "embedding_model": query_model,
                "embedding_provider": "local" if query_model.startswith("local-hashing") else "openai",
                "embedding_fallback": query_model.startswith("local-hashing"),
            }
        )
        if item.match_score >= minimum_score:
            ranked.append(item)
    db.commit()
    return sorted(ranked, key=lambda item: item.match_score, reverse=True)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/readiness")
def readiness(db: Session = Depends(get_db)) -> dict[str, object]:
    return readiness_report(db)


@app.put("/auth/profile", response_model=UserPublic)
def sync_profile(
    payload: ProfileSyncRequest,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> UserPublic:
    claims = claims_from_authorization(authorization)
    user = db.scalar(
        select(UserRecord).where(UserRecord.supabase_user_id == claims.user_id)
    )
    email_owner = db.scalar(select(UserRecord).where(UserRecord.email == claims.email))

    if user is None and email_owner is not None:
        if email_owner.supabase_user_id not in (None, claims.user_id):
            raise HTTPException(
                status_code=409,
                detail="Email is already linked to another Supabase account",
            )
        user = email_owner

    if user is not None and email_owner is not None and user.id != email_owner.id:
        raise HTTPException(
            status_code=409, detail="Email is already used by another NUSphere profile"
        )

    if user is not None and user.role != payload.role:
        raise HTTPException(
            status_code=409,
            detail="Account role cannot be changed after profile creation",
        )

    values = payload.model_dump()
    if user is None:
        user = UserRecord(
            id=f"u_{uuid4().hex[:10]}",
            email=claims.email,
            supabase_user_id=claims.user_id,
            password_hash=None,
            verification_status=(
                "unverified" if payload.role == "mentor" else "not_applicable"
            ),
            **values,
        )
        db.add(user)
    else:
        user.email = claims.email
        user.supabase_user_id = claims.user_id
        user.password_hash = None
        if user.role == "mentor" and user.verification_status == "not_applicable":
            user.verification_status = "unverified"
        for field, value in values.items():
            setattr(user, field, value)

    try:
        db.flush()
        upsert_profile_embedding(user, db)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Supabase account is already linked to another profile",
        ) from exc

    db.refresh(user)
    return public_user(user)


@app.post("/auth/register", status_code=410)
def legacy_register() -> None:
    raise HTTPException(
        status_code=410, detail="Registration is now managed by Supabase Auth"
    )


@app.post("/auth/login", status_code=410)
def legacy_login() -> None:
    raise HTTPException(status_code=410, detail="Login is now managed by Supabase Auth")


@app.get("/auth/me", response_model=UserPublic)
def me(
    authorization: str | None = Header(default=None), db: Session = Depends(get_db)
) -> UserPublic:
    return public_user(get_user_from_token(authorization, db))


@app.patch("/auth/me", response_model=UserPublic)
def update_me(
    payload: UserUpdate,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> UserPublic:
    user = get_user_from_token(authorization, db)
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(user, field, value)
    upsert_profile_embedding(user, db)
    db.commit()
    db.refresh(user)
    return public_user(user)


@app.post("/auth/logout", status_code=410)
def legacy_logout() -> None:
    raise HTTPException(
        status_code=410, detail="Logout is now managed by Supabase Auth"
    )


@app.get("/mentors", response_model=list[Mentor])
def list_mentors(db: Session = Depends(get_db)) -> list[Mentor]:
    return available_mentors(db)


@app.put("/mentors/me/availability", response_model=list[AvailabilitySlotPublic])
def replace_my_availability(
    payload: AvailabilityUpdate,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> list[AvailabilitySlotPublic]:
    mentor = get_user_from_token(authorization, db)
    if mentor.role != "mentor":
        raise HTTPException(
            status_code=403, detail="Only mentors can update availability"
        )

    existing_slots = db.scalars(
        select(MentorAvailabilityRecord).where(
            MentorAvailabilityRecord.mentor_id == mentor.id
        )
    ).all()
    for slot in existing_slots:
        db.delete(slot)
    db.flush()

    created_slots = [
        MentorAvailabilityRecord(
            id=f"av_{uuid4().hex[:10]}",
            mentor_id=mentor.id,
            day_of_week=slot.day_of_week,
            start_time=slot.start_time,
            end_time=slot.end_time,
            timezone=slot.timezone,
            mode=slot.mode,
            location=slot.location,
            is_active=True,
        )
        for slot in payload.slots
    ]
    db.add_all(created_slots)
    db.commit()
    for slot in created_slots:
        db.refresh(slot)
    return [availability_from_record(slot) for slot in created_slots]


@app.post(
    "/mentors/me/verification",
    response_model=VerificationStatusPublic,
)
def request_mentor_verification(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> VerificationStatusPublic:
    mentor = get_user_from_token(authorization, db)
    if mentor.role != "mentor":
        raise HTTPException(
            status_code=403, detail="Only mentors can request verification"
        )
    if mentor.verification_status != "verified":
        mentor.verification_status = "pending"
        db.commit()
        db.refresh(mentor)
    return VerificationStatusPublic(
        mentor_id=mentor.id,
        status=mentor.verification_status,  # type: ignore[arg-type]
    )


@app.get(
    "/mentors/{mentor_id}/availability",
    response_model=list[AvailabilitySlotPublic],
)
def get_mentor_availability(
    mentor_id: str, db: Session = Depends(get_db)
) -> list[AvailabilitySlotPublic]:
    find_mentor_by_id(mentor_id, db)
    records = db.scalars(
        select(MentorAvailabilityRecord)
        .where(
            MentorAvailabilityRecord.mentor_id == mentor_id,
            MentorAvailabilityRecord.is_active.is_(True),
        )
        .order_by(
            MentorAvailabilityRecord.day_of_week,
            MentorAvailabilityRecord.start_time,
        )
    ).all()
    return [availability_from_record(record) for record in records]


@app.get(
    "/mentors/{mentor_id}/verification",
    response_model=VerificationStatusPublic,
)
def get_mentor_verification(
    mentor_id: str, db: Session = Depends(get_db)
) -> VerificationStatusPublic:
    mentor = db.scalar(
        select(UserRecord).where(
            UserRecord.id == mentor_id, UserRecord.role == "mentor"
        )
    )
    if mentor is None:
        raise HTTPException(status_code=404, detail="Mentor not found")
    return VerificationStatusPublic(
        mentor_id=mentor.id,
        status=mentor.verification_status,  # type: ignore[arg-type]
    )


@app.get(
    "/mentors/{mentor_id}/reviews/eligibility",
    response_model=ReviewEligibility,
)
def get_review_eligibility(
    mentor_id: str,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> ReviewEligibility:
    user = get_user_from_token(authorization, db)
    return review_eligibility_for(user, mentor_id, db)


@app.get("/mentors/{mentor_id}/reviews", response_model=list[ReviewPublic])
def list_mentor_reviews(
    mentor_id: str, db: Session = Depends(get_db)
) -> list[ReviewPublic]:
    mentor = db.scalar(
        select(UserRecord.id).where(
            UserRecord.id == mentor_id, UserRecord.role == "mentor"
        )
    )
    if mentor is None:
        raise HTTPException(status_code=404, detail="Mentor not found")
    rows = db.execute(
        select(ReviewRecord, UserRecord.name)
        .join(UserRecord, UserRecord.id == ReviewRecord.student_id)
        .where(ReviewRecord.mentor_id == mentor_id)
        .order_by(ReviewRecord.created_at.desc())
    ).all()
    return [review_from_record(record, student_name) for record, student_name in rows]


@app.post(
    "/mentors/{mentor_id}/reviews",
    response_model=ReviewPublic,
    status_code=status.HTTP_201_CREATED,
)
def create_mentor_review(
    mentor_id: str,
    payload: ReviewCreate,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> ReviewPublic:
    student = get_user_from_token(authorization, db)
    eligibility = review_eligibility_for(student, mentor_id, db)
    if not eligibility.can_review:
        error_status = 409 if eligibility.existing_review else 403
        raise HTTPException(status_code=error_status, detail=eligibility.reason)
    if eligibility.connection_id is None:
        raise HTTPException(status_code=403, detail="Review is not authorized")

    review = ReviewRecord(
        id=f"r_{uuid4().hex[:10]}",
        connection_id=eligibility.connection_id,
        student_id=student.id,
        mentor_id=mentor_id,
        rating=payload.rating,
        comment=payload.comment.strip(),
    )
    db.add(review)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="A review has already been submitted for this connection",
        ) from exc
    db.refresh(review)
    return review_from_record(review, student.name)


@app.patch("/reviews/{review_id}", response_model=ReviewPublic)
def update_mentor_review(
    review_id: str,
    payload: ReviewCreate,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> ReviewPublic:
    student = get_user_from_token(authorization, db)
    review = db.get(ReviewRecord, review_id)
    if review is None:
        raise HTTPException(status_code=404, detail="Review not found")
    if student.role != "student" or review.student_id != student.id:
        raise HTTPException(
            status_code=403, detail="Only the student who wrote this review can edit it"
        )
    review.rating = payload.rating
    review.comment = payload.comment.strip()
    review.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(review)
    return review_from_record(review, student.name)


@app.post("/recommendations", response_model=list[Mentor])
def recommendations(
    payload: RecommendationRequest, db: Session = Depends(get_db)
) -> list[Mentor]:
    ranked = []
    for mentor in available_mentors(db):
        keyword_score = score_mentor(mentor, payload)
        ranked.append(
            mentor.model_copy(
                update={
                    "match_score": keyword_score,
                    "keyword_match_score": keyword_score,
                    "match_label": "Keyword match",
                    "match_reasons": match_reasons(mentor, payload),
                }
            )
        )
    return [
        mentor
        for mentor in sorted(ranked, key=lambda item: item.match_score, reverse=True)
        if mentor.match_score >= payload.minimum_score
    ]


@app.post("/ai/profile-match", response_model=list[Mentor])
def ai_profile_match(
    authorization: str | None = Header(default=None), db: Session = Depends(get_db)
) -> list[Mentor]:
    student = get_user_from_token(authorization, db)
    if student.role != "student":
        raise HTTPException(
            status_code=403, detail="Only students can request mentor matches"
        )
    student_embedding = ensure_profile_embedding(student, db)
    return ai_ranked_mentors(
        student,
        student_embedding.embedding,
        db,
        mode="profile",
        query_model=student_embedding.model,
    )


@app.post("/ai/goal-search", response_model=list[Mentor])
def ai_goal_search(
    payload: GoalSearchRequest,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> list[Mentor]:
    student = get_user_from_token(authorization, db)
    if student.role != "student":
        raise HTTPException(
            status_code=403, detail="Only students can search for mentors"
        )
    embedding, model = embed_text(goal_search_text(student, payload.query))
    return ai_ranked_mentors(
        student,
        embedding,
        db,
        mode="goal",
        minimum_score=payload.minimum_score,
        query_model=model,
        query_text=payload.query,
    )


@app.get("/opportunities", response_model=list[OpportunityPublic])
def list_opportunities(db: Session = Depends(get_db)) -> list[OpportunityPublic]:
    records = db.scalars(
        select(OpportunityRecord).order_by(OpportunityRecord.created_at.desc())
    ).all()
    return [opportunity_from_record(record) for record in records]


@app.post("/opportunities", response_model=OpportunityPublic)
def create_opportunity(
    payload: OpportunityCreate,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> OpportunityPublic:
    user = get_user_from_token(authorization, db)
    values = payload.model_dump()
    opportunity = OpportunityRecord(
        id=f"op_{uuid4().hex[:10]}",
        poster_id=user.id,
        poster_name=user.name,
        poster_role=user.role,
        is_verified=user.role == "mentor",
        target_years=clean_string_list(values.pop("target_years")),
        relevant_majors=clean_string_list(values.pop("relevant_majors")),
        tags=clean_string_list(values.pop("tags")),
        skills=clean_string_list(values.pop("skills")),
        details=clean_string_list(values.pop("details")),
        **values,
    )
    db.add(opportunity)
    db.flush()
    upsert_opportunity_embedding(opportunity, db)
    db.commit()
    db.refresh(opportunity)
    return opportunity_from_record(opportunity)


@app.patch("/opportunities/{opportunity_id}", response_model=OpportunityPublic)
def update_opportunity(
    opportunity_id: str,
    payload: OpportunityCreate,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> OpportunityPublic:
    user = get_user_from_token(authorization, db)
    opportunity = db.get(OpportunityRecord, opportunity_id)
    if opportunity is None:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    if opportunity.poster_id != user.id:
        raise HTTPException(
            status_code=403, detail="Only the original poster can edit this opportunity"
        )
    values = payload.model_dump()
    opportunity.target_years = clean_string_list(values.pop("target_years"))
    opportunity.relevant_majors = clean_string_list(values.pop("relevant_majors"))
    opportunity.tags = clean_string_list(values.pop("tags"))
    opportunity.skills = clean_string_list(values.pop("skills"))
    opportunity.details = clean_string_list(values.pop("details"))
    for key, value in values.items():
        setattr(opportunity, key, value)
    opportunity.is_verified = user.role == "mentor"
    opportunity.updated_at = datetime.now(timezone.utc)
    db.flush()
    upsert_opportunity_embedding(opportunity, db)
    db.commit()
    db.refresh(opportunity)
    return opportunity_from_record(opportunity)


@app.post("/opportunities/recommendations", response_model=list[OpportunityPublic])
def opportunity_recommendations(
    payload: OpportunitySearchRequest,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> list[OpportunityPublic]:
    student = get_user_from_token(authorization, db)
    if student.role != "student":
        raise HTTPException(
            status_code=403, detail="Only students can request opportunity matches"
        )
    query = select(OpportunityRecord).order_by(OpportunityRecord.created_at.desc())
    records = db.scalars(query).all()
    ranked: list[OpportunityPublic] = []
    selected_categories = set(payload.categories)
    for opportunity in records:
        if selected_categories and opportunity.category not in selected_categories:
            continue
        score = standard_opportunity_score(opportunity, student, payload.query)
        profile_score = opportunity_profile_match_score(student, opportunity, db)
        item = opportunity_from_record(opportunity).model_copy(
            update={
                "match_score": score,
                "keyword_match_score": score,
                "profile_match_score": profile_score,
                "match_label": "Keyword match",
                "match_reasons": opportunity_match_reasons(
                    opportunity, student, query=payload.query
                ),
            }
        )
        if item.match_score >= payload.minimum_score:
            ranked.append(item)
    db.commit()
    return sorted(ranked, key=lambda item: item.match_score, reverse=True)


@app.post("/opportunities/ai/profile-match", response_model=list[OpportunityPublic])
def opportunity_ai_profile_match(
    authorization: str | None = Header(default=None), db: Session = Depends(get_db)
) -> list[OpportunityPublic]:
    student = get_user_from_token(authorization, db)
    if student.role != "student":
        raise HTTPException(
            status_code=403, detail="Only students can request opportunity matches"
        )
    student_embedding = ensure_profile_embedding(student, db)
    return ai_ranked_opportunities(
        student,
        student_embedding.embedding,
        db,
        mode="profile",
        query_model=student_embedding.model,
    )


@app.post("/opportunities/ai/goal-search", response_model=list[OpportunityPublic])
def opportunity_ai_goal_search(
    payload: GoalSearchRequest,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> list[OpportunityPublic]:
    student = get_user_from_token(authorization, db)
    if student.role != "student":
        raise HTTPException(
            status_code=403, detail="Only students can search for opportunities"
        )
    embedding, model = embed_text(goal_search_text(student, payload.query))
    return ai_ranked_opportunities(
        student,
        embedding,
        db,
        mode="goal",
        minimum_score=payload.minimum_score,
        query_model=model,
        query_text=payload.query,
    )


@app.get("/connections", response_model=list[ConnectionPublic])
def list_connections(
    authorization: str | None = Header(default=None), db: Session = Depends(get_db)
) -> list[ConnectionPublic]:
    user = get_user_from_token(authorization, db)
    records = db.scalars(
        select(ConnectionRecord)
        .where(
            (ConnectionRecord.student_id == user.id)
            | (ConnectionRecord.mentor_id == user.id)
        )
        .order_by(ConnectionRecord.updated_at.desc())
    ).all()
    return [connection_from_record(record) for record in records]


@app.post("/connections/{mentor_id}", response_model=ConnectionPublic)
def request_connection(
    mentor_id: str,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> ConnectionPublic:
    user = get_user_from_token(authorization, db)
    if user.role != "student":
        raise HTTPException(
            status_code=403, detail="Only students can request mentor connections"
        )
    mentor = find_mentor_by_id(mentor_id, db)
    connection_id = f"{user.id}_{mentor.id}"
    existing = db.get(ConnectionRecord, connection_id)
    if existing:
        return connection_from_record(existing)
    connection = ConnectionRecord(
        id=connection_id,
        student_id=user.id,
        student_name=user.name,
        mentor_id=mentor.id,
        mentor_name=mentor.name,
        mentor_programme=mentor.programme,
        status="pending",
    )
    db.add(connection)
    db.commit()
    db.refresh(connection)
    return connection_from_record(connection)


@app.post("/connections/{connection_id}/accept", response_model=ConversationPublic)
def accept_connection(
    connection_id: str,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> ConversationPublic:
    user = get_user_from_token(authorization, db)
    connection = db.get(ConnectionRecord, connection_id)
    if connection is None:
        raise HTTPException(status_code=404, detail="Connection request not found")
    if user.id != connection.mentor_id:
        raise HTTPException(
            status_code=403,
            detail="Only the receiving mentor can accept this connection",
        )
    connection.status = "accepted"
    conversation = ensure_conversation_for_connection(connection, db)
    db.commit()
    refreshed = db.scalar(
        select(ConversationRecord)
        .options(joinedload(ConversationRecord.messages))
        .where(ConversationRecord.id == conversation.id)
    )
    if refreshed is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation_from_record(refreshed, user)


@app.get("/qa/questions", response_model=list[QuestionPublic])
def list_questions(db: Session = Depends(get_db)) -> list[QuestionPublic]:
    records = (
        db.scalars(
            select(QuestionRecord)
            .options(joinedload(QuestionRecord.answers))
            .order_by(QuestionRecord.created_at.desc())
        )
        .unique()
        .all()
    )
    return [question_from_record(record) for record in records]


@app.post(
    "/qa/questions/suggestions",
    response_model=list[DuplicateQuestionSuggestion],
)
def suggest_duplicate_questions(
    payload: QuestionSuggestionRequest,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> list[DuplicateQuestionSuggestion]:
    user = get_user_from_token(authorization, db)
    if user.role != "student":
        raise HTTPException(
            status_code=403,
            detail="Only students can check or post questions",
        )

    records = (
        db.scalars(
            select(QuestionRecord)
            .options(joinedload(QuestionRecord.answers))
            .order_by(QuestionRecord.created_at.desc())
            .limit(100)
        )
        .unique()
        .all()
    )
    suggestions: list[DuplicateQuestionSuggestion] = []
    for record in records:
        similarity = duplicate_score(
            draft_title=payload.title,
            draft_topic=payload.topic,
            draft_body=payload.body,
            draft_tags=payload.tags,
            candidate_title=record.title,
            candidate_topic=record.topic,
            candidate_body=record.body,
            candidate_terms=[*(record.tags or []), *(record.key_terms or [])],
            candidate_cluster=record.topic_cluster,
        )
        if similarity.score < MIN_DUPLICATE_SCORE:
            continue
        suggestions.append(
            DuplicateQuestionSuggestion(
                question_id=record.id,
                title=record.title,
                topic=record.topic,
                topic_cluster=record.topic_cluster,
                similarity_score=similarity.score,
                evidence=similarity.evidence,
                answer_count=len(record.answers),
                latest_summary=(record.answers[-1].summary if record.answers else None),
            )
        )
    return sorted(
        suggestions,
        key=lambda item: (-item.similarity_score, -item.answer_count, item.title),
    )[:5]


@app.post("/qa/questions", response_model=QuestionPublic)
def create_question(
    payload: QuestionCreate,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> QuestionPublic:
    user = get_user_from_token(authorization, db)
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can ask questions")

    question = QuestionRecord(
        id=f"q_{uuid4().hex[:10]}",
        student_id=user.id,
        student_name=user.name,
        title=payload.title,
        topic=payload.topic,
        topic_cluster=topic_cluster(
            payload.topic, payload.title, payload.body, *payload.tags
        ),
        body=payload.body,
        tags=payload.tags,
        attachments=payload.attachments,
        key_terms=extract_key_terms(
            payload.topic, payload.title, payload.body, existing=payload.tags
        ),
    )
    db.add(question)
    mentors = db.scalars(select(UserRecord).where(UserRecord.role == "mentor")).all()
    for mentor in mentors:
        create_notification(
            db,
            user_id=mentor.id,
            actor=user,
            notification_type="question_created",
            title=f"New Q&A question: {question.title}",
            body=truncate_notification_body(question.body),
            target_type="question",
            target_id=question.id,
        )
    db.commit()
    db.refresh(question)
    return question_from_record(question)


@app.post("/qa/questions/{question_id}/answers", response_model=QuestionPublic)
def answer_question(
    question_id: str,
    payload: AnswerCreate,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> QuestionPublic:
    user = get_user_from_token(authorization, db)
    if user.role != "mentor":
        raise HTTPException(status_code=403, detail="Only mentors can answer questions")

    question = db.scalar(
        select(QuestionRecord)
        .options(joinedload(QuestionRecord.answers))
        .where(QuestionRecord.id == question_id)
    )
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found")

    answer = AnswerRecord(
        id=f"a_{uuid4().hex[:10]}",
        question_id=question.id,
        mentor_id=user.id,
        mentor_name=user.name,
        body=payload.body,
        summary=summarise_answer(payload.body),
        summary_version=SUMMARY_VERSION,
    )
    db.add(answer)
    create_notification(
        db,
        user_id=question.student_id,
        actor=user,
        notification_type="answer_created",
        title=f"{user.name} answered your question",
        body=truncate_notification_body(answer.summary),
        target_type="question",
        target_id=question.id,
    )
    db.flush()
    question.key_terms = extract_key_terms(
        question.topic,
        question.title,
        question.body,
        *(item.body for item in [*question.answers, answer]),
        existing=[*question.tags, *question.key_terms],
    )
    db.commit()
    refreshed = db.scalar(
        select(QuestionRecord)
        .options(joinedload(QuestionRecord.answers))
        .where(QuestionRecord.id == question_id)
    )
    if refreshed is None:
        raise HTTPException(status_code=404, detail="Question not found")
    return question_from_record(refreshed)


@app.get("/notifications", response_model=list[NotificationPublic])
def list_notifications(
    unread_only: bool = False,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> list[NotificationPublic]:
    user = get_user_from_token(authorization, db)
    statement = select(NotificationRecord).where(NotificationRecord.user_id == user.id)
    if unread_only:
        statement = statement.where(NotificationRecord.is_read.is_(False))
    statement = statement.order_by(NotificationRecord.created_at.desc()).limit(100)
    records = db.scalars(statement).all()
    return [notification_from_record(record) for record in records]


@app.get("/notifications/unread-count", response_model=NotificationUnreadCount)
def notification_unread_count(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> NotificationUnreadCount:
    user = get_user_from_token(authorization, db)
    count = db.scalar(
        select(func.count(NotificationRecord.id)).where(
            NotificationRecord.user_id == user.id,
            NotificationRecord.is_read.is_(False),
        )
    )
    return NotificationUnreadCount(unread_count=int(count or 0))


@app.post("/notifications/{notification_id}/read", response_model=NotificationPublic)
def mark_notification_read(
    notification_id: str,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> NotificationPublic:
    user = get_user_from_token(authorization, db)
    notification = db.get(NotificationRecord, notification_id)
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notification.user_id != user.id:
        raise HTTPException(
            status_code=403, detail="You cannot update this notification"
        )
    notification.is_read = True
    notification.read_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(notification)
    return notification_from_record(notification)


@app.post("/notifications/read-all", response_model=NotificationUnreadCount)
def mark_all_notifications_read(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> NotificationUnreadCount:
    user = get_user_from_token(authorization, db)
    now = datetime.now(timezone.utc)
    records = db.scalars(
        select(NotificationRecord).where(
            NotificationRecord.user_id == user.id,
            NotificationRecord.is_read.is_(False),
        )
    ).all()
    for notification in records:
        notification.is_read = True
        notification.read_at = now
    db.commit()
    return NotificationUnreadCount(unread_count=0)


@app.get("/conversations", response_model=list[ConversationPublic])
def list_conversations(
    authorization: str | None = Header(default=None), db: Session = Depends(get_db)
) -> list[ConversationPublic]:
    user = get_user_from_token(authorization, db)
    records = (
        db.scalars(
            select(ConversationRecord)
            .options(joinedload(ConversationRecord.messages))
            .where(
                (ConversationRecord.student_id == user.id)
                | (ConversationRecord.mentor_id == user.id)
            )
            .order_by(ConversationRecord.updated_at.desc())
        )
        .unique()
        .all()
    )
    conversations = [conversation_from_record(record, user) for record in records]
    return sorted(
        conversations,
        key=lambda conversation: (not conversation.is_pinned, conversation.is_archived),
    )


@app.post("/conversations/{mentor_id}", response_model=ConversationPublic)
def start_conversation(
    mentor_id: str,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> ConversationPublic:
    user = get_user_from_token(authorization, db)
    mentor = find_mentor_by_id(mentor_id, db)
    conversation_id = f"{user.id}_{mentor.id}"
    connection = db.get(ConnectionRecord, conversation_id)
    if connection is None:
        raise HTTPException(
            status_code=403, detail="Connect with this mentor before messaging"
        )
    if connection.status != "accepted":
        raise HTTPException(
            status_code=403, detail="Connection request is waiting for mentor approval"
        )
    existing = db.scalar(
        select(ConversationRecord)
        .options(joinedload(ConversationRecord.messages))
        .where(ConversationRecord.id == conversation_id)
    )
    if existing:
        return conversation_from_record(existing, user)
    ensure_conversation_for_connection(connection, db)
    db.commit()
    refreshed = db.scalar(
        select(ConversationRecord)
        .options(joinedload(ConversationRecord.messages))
        .where(ConversationRecord.id == conversation_id)
    )
    if refreshed is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation_from_record(refreshed, user)


@app.post("/conversations/{conversation_id}/read", response_model=ConversationPublic)
def mark_conversation_read(
    conversation_id: str,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> ConversationPublic:
    user = get_user_from_token(authorization, db)
    conversation = db.scalar(
        select(ConversationRecord)
        .options(joinedload(ConversationRecord.messages))
        .where(ConversationRecord.id == conversation_id)
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    role = conversation_role(conversation, user)
    latest_message_at = max(
        (message.created_at for message in conversation.messages),
        default=datetime.now(timezone.utc),
    )
    set_conversation_last_read_at(conversation, role, latest_message_at)
    db.commit()
    db.refresh(conversation)
    return conversation_from_record(conversation, user)


@app.patch("/conversations/{conversation_id}/state", response_model=ConversationPublic)
def update_conversation_state(
    conversation_id: str,
    payload: ConversationStateUpdate,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> ConversationPublic:
    user = get_user_from_token(authorization, db)
    conversation = db.scalar(
        select(ConversationRecord)
        .options(joinedload(ConversationRecord.messages))
        .where(ConversationRecord.id == conversation_id)
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    role = conversation_role(conversation, user)
    if payload.is_pinned is not None:
        set_conversation_flag(conversation, role, "pinned", payload.is_pinned)
    if payload.is_archived is not None:
        set_conversation_flag(conversation, role, "archived", payload.is_archived)
    if payload.is_muted is not None:
        set_conversation_flag(conversation, role, "muted", payload.is_muted)
    db.commit()
    db.refresh(conversation)
    return conversation_from_record(conversation, user)


@app.post(
    "/conversations/{conversation_id}/messages", response_model=ConversationPublic
)
def send_message(
    conversation_id: str,
    payload: MessageCreate,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> ConversationPublic:
    user = get_user_from_token(authorization, db)
    conversation = db.scalar(
        select(ConversationRecord)
        .options(joinedload(ConversationRecord.messages))
        .where(ConversationRecord.id == conversation_id)
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if user.id not in {conversation.student_id, conversation.mentor_id}:
        raise HTTPException(
            status_code=403, detail="You are not part of this conversation"
        )

    now = datetime.now(timezone.utc)
    message = MessageRecord(
        id=f"m_{uuid4().hex[:10]}",
        conversation_id=conversation.id,
        sender_id=user.id,
        sender_name=user.name,
        body=payload.body,
        created_at=now,
    )
    db.add(message)
    role = conversation_role(conversation, user)
    recipient_role: Literal["student", "mentor"] = (
        "mentor" if role == "student" else "student"
    )
    conversation.last_message = message.body
    conversation.updated_at = now
    set_conversation_last_read_at(conversation, role, now)
    set_conversation_flag(conversation, role, "archived", False)
    set_conversation_flag(conversation, recipient_role, "archived", False)
    recipient_id = (
        conversation.mentor_id if recipient_role == "mentor" else conversation.student_id
    )
    if not conversation_flag(conversation, recipient_role, "muted"):
        create_notification(
            db,
            user_id=recipient_id,
            actor=user,
            notification_type="message",
            title=f"New message from {user.name}",
            body=truncate_notification_body(message.body),
            target_type="conversation",
            target_id=conversation.id,
        )
    db.commit()
    refreshed = db.scalar(
        select(ConversationRecord)
        .options(joinedload(ConversationRecord.messages))
        .where(ConversationRecord.id == conversation_id)
    )
    if refreshed is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation_from_record(refreshed, user)
