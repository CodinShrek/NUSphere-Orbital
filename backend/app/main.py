from __future__ import annotations

import os
import hashlib
import hmac
import secrets
from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from .database import Base, engine, get_db
from .ai_matching import cosine_similarity, embed_text, goal_search_text, match_explanation, profile_completeness, structured_overlap, user_profile_text
from .models import AnswerRecord, ConnectionRecord, ConversationRecord, MessageRecord, ProfileEmbeddingRecord, QuestionRecord, SessionRecord, UserRecord


Role = Literal["student", "mentor"]
MentorType = Literal["senior", "alumni", "professor", "nus_staff", "other"]


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
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


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    role: Role


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


class AuthResponse(BaseModel):
    token: str
    user: UserPublic


class LogoutRequest(BaseModel):
    token: str


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
    interests: list[str]
    experience_tags: list[str]
    bio: str
    experience: list[str]
    match_reasons: list[str] = Field(default_factory=list)


class RecommendationRequest(BaseModel):
    interests: list[str] = Field(default_factory=list)
    goals: list[str] = Field(default_factory=list)
    faculty: str | None = None
    minimum_score: int = 0


class GoalSearchRequest(BaseModel):
    query: str = Field(min_length=20)
    minimum_score: int = 0


class StoredUser(UserPublic):
    password: str


class QuestionCreate(BaseModel):
    title: str = Field(min_length=5)
    topic: str = Field(min_length=2)
    body: str = Field(min_length=10)
    tags: list[str] = Field(default_factory=list)
    attachments: list[str] = Field(default_factory=list)


class AnswerCreate(BaseModel):
    body: str = Field(min_length=10)


class AnswerPublic(BaseModel):
    id: str
    mentor_id: str
    mentor_name: str
    body: str
    summary: str
    created_at: str


class QuestionPublic(BaseModel):
    id: str
    student_id: str
    student_name: str
    title: str
    topic: str
    body: str
    tags: list[str]
    attachments: list[str] = Field(default_factory=list)
    key_terms: list[str] = Field(default_factory=list)
    created_at: str
    answers: list[AnswerPublic] = Field(default_factory=list)


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
    messages: list[MessagePublic] = Field(default_factory=list)


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


Base.metadata.create_all(bind=engine)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000).hex()
    return f"pbkdf2_sha256${salt}${digest}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, salt, digest = stored_hash.split("$", 2)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    candidate = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000).hex()
    return hmac.compare_digest(candidate, digest)


def user_from_record(record: UserRecord) -> StoredUser:
    return StoredUser(
        id=record.id,
        email=record.email,
        password=record.password_hash,
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
    )


def public_user(user: StoredUser | UserRecord) -> UserPublic:
    if isinstance(user, UserRecord):
        user = user_from_record(user)
    return UserPublic(**user.model_dump(exclude={"password"}))


def answer_from_record(record: AnswerRecord) -> AnswerPublic:
    return AnswerPublic(
        id=record.id,
        mentor_id=record.mentor_id,
        mentor_name=record.mentor_name,
        body=record.body,
        summary=record.summary,
        created_at=record.created_at.isoformat(),
    )


def question_from_record(record: QuestionRecord) -> QuestionPublic:
    return QuestionPublic(
        id=record.id,
        student_id=record.student_id,
        student_name=record.student_name,
        title=record.title,
        topic=record.topic,
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


def conversation_from_record(record: ConversationRecord) -> ConversationPublic:
    return ConversationPublic(
        id=record.id,
        student_id=record.student_id,
        student_name=record.student_name,
        mentor_id=record.mentor_id,
        mentor_name=record.mentor_name,
        mentor_programme=record.mentor_programme,
        last_message=record.last_message,
        updated_at=record.updated_at.isoformat(),
        messages=[message_from_record(message) for message in record.messages],
    )


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


def create_session(user: UserRecord, db: Session) -> AuthResponse:
    token = f"demo_{uuid4().hex}"
    db.add(SessionRecord(token=token, user_id=user.id))
    db.commit()
    return AuthResponse(token=token, user=public_user(user))


def get_user_from_token(authorization: str | None, db: Session) -> UserRecord:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")

    token = authorization.removeprefix("Bearer ").strip()
    session = db.get(SessionRecord, token)
    if session is None:
        raise HTTPException(status_code=401, detail="Invalid or expired auth token")
    user = db.get(UserRecord, session.user_id)
    if user is None:
        db.delete(session)
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid or expired auth token")

    return user


def normalise_keyword(value: str) -> str:
    return " ".join("".join(character.lower() if character.isalnum() else " " for character in value).split())


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
        meaningful_parts = [singular_keyword(part) for part in term_parts if len(part) > 2]
        return normalised_term in normalised_candidate or (
            bool(meaningful_parts) and all(part in candidate_tokens for part in meaningful_parts)
        )

    return singular_keyword(normalised_term) in candidate_tokens


def score_mentor(mentor: Mentor, request: RecommendationRequest) -> int:
    query_terms = [term for term in request.interests + request.goals if term]
    mentor_terms = [
        *mentor.interests,
        *mentor.experience_tags,
        mentor.faculty,
        mentor.programme,
        mentor.role,
        mentor.bio,
        *mentor.experience,
    ]
    matched_terms = {
        normalise_keyword(term)
        for term in query_terms
        if any(keyword_term_matches(term, value) for value in mentor_terms)
    }
    score = 35 + min(45, len(matched_terms) * 7)
    if request.faculty and request.faculty == mentor.faculty:
        score += 10
    if matched_terms and any(keyword_term_matches(request.faculty or "", value) for value in [mentor.faculty, mentor.programme]):
        score += 4
    return min(99, score)


def match_reasons(mentor: Mentor, request: RecommendationRequest) -> list[str]:
    profile_terms = [term for term in request.interests + request.goals if term]
    mentor_terms = mentor.interests + mentor.experience_tags + [mentor.programme, mentor.faculty, mentor.bio, *mentor.experience]
    reasons = []
    seen_terms = set()
    for term in profile_terms:
        normalised = normalise_keyword(term)
        if normalised in seen_terms:
            continue
        if any(keyword_term_matches(term, value) for value in mentor_terms):
            reasons.append(f"Matches your profile term: {term}")
            seen_terms.add(normalised)
    if request.faculty and request.faculty == mentor.faculty:
        reasons.append(f"Same faculty: {mentor.faculty}")
    if not reasons:
        reasons.append("Limited direct keyword overlap; compare profile details before connecting")
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
        faculty=user.faculty,
        minimum_score=0,
    )


def summarise_answer(body: str) -> str:
    words = body.strip().split()
    if len(words) <= 18:
        return body.strip()
    return " ".join(words[:18]).rstrip(".,") + "."


def extract_key_terms(*parts: str, existing: list[str] | None = None) -> list[str]:
    stop_words = {
        "about",
        "after",
        "also",
        "and",
        "are",
        "can",
        "for",
        "from",
        "have",
        "help",
        "how",
        "into",
        "nus",
        "should",
        "that",
        "the",
        "this",
        "what",
        "when",
        "where",
        "with",
        "would",
    }
    terms: list[str] = []
    for item in existing or []:
        cleaned = item.strip()
        if cleaned and cleaned.lower() not in {term.lower() for term in terms}:
            terms.append(cleaned)

    for part in parts:
        words = "".join(ch if ch.isalnum() or ch.isspace() else " " for ch in part).split()
        for word in words:
            cleaned = word.strip()
            if len(cleaned) < 3 or cleaned.lower() in stop_words:
                continue
            if cleaned.lower() not in {term.lower() for term in terms}:
                terms.append(cleaned)
            if len(terms) >= 8:
                return terms
    return terms[:8]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def mentor_from_user(user: StoredUser | UserRecord, answers_count: int = 0) -> Mentor:
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
            f"Modules taught: {', '.join(user.modules_taught)}" if user.modules_taught else "",
            f"Consultation hours: {user.consultation_hours}" if user.consultation_hours else "",
            f"Office / cubicle: {user.office_location}" if user.office_location else "",
            f"Office: {user.office}" if user.office else "",
            f"Areas of expertise: {', '.join(user.areas_of_expertise)}" if user.areas_of_expertise else "",
            f"NUS opportunities: {', '.join(user.nus_opportunities)}" if user.nus_opportunities else "",
            f"CCAs: {', '.join(user.ccas)}" if user.ccas else "",
            f"Exchange interests: {', '.join(user.exchange_universities)}" if user.exchange_universities else "",
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
        programme=user.department or user.major or user.current_role or user.office or mentor_type_label,
        faculty=user.faculty,
        department=user.department,
        role=mentor_type_label,
        rating=0,
        reviews=0,
        mentees=0,
        answers=answers_count,
        match_score=72,
        keyword_match_score=72,
        interests=user.areas_of_expertise or user.interests or user.goals,
        experience_tags=experience_tags,
        bio=user.bio or user.mentorship_goals or "This mentor has not added a description yet.",
        experience=experience or ["Mentor profile created during sign up"],
    )


def available_mentors(db: Session) -> list[Mentor]:
    answer_counts = dict(
        db.execute(
            select(AnswerRecord.mentor_id, func.count(AnswerRecord.id))
            .group_by(AnswerRecord.mentor_id)
        ).all()
    )
    registered_mentors = [
        mentor_from_user(user, int(answer_counts.get(user.id, 0)))
        for user in db.scalars(select(UserRecord).where(UserRecord.role == "mentor")).all()
    ]
    return [*registered_mentors, *static_mentors]


def find_mentor_by_id(mentor_id: str, db: Session) -> Mentor:
    for mentor in available_mentors(db):
        if mentor.id == mentor_id:
            return mentor
    raise HTTPException(status_code=404, detail="Mentor not found")


def ensure_conversation_for_connection(connection: ConnectionRecord, db: Session) -> ConversationRecord:
    existing = db.get(ConversationRecord, connection.id)
    if existing:
        return existing
    greeting = MessageRecord(
        id=f"m_{uuid4().hex[:10]}",
        conversation_id=connection.id,
        sender_id=connection.mentor_id,
        sender_name=connection.mentor_name,
        body=f"Connection accepted. Hi {connection.student_name}, happy to continue the conversation here.",
    )
    conversation = ConversationRecord(
        id=connection.id,
        student_id=connection.student_id,
        student_name=connection.student_name,
        mentor_id=connection.mentor_id,
        mentor_name=connection.mentor_name,
        mentor_programme=connection.mentor_programme,
        last_message=greeting.body,
    )
    db.add(conversation)
    db.add(greeting)
    db.flush()
    return conversation


def upsert_profile_embedding(user: UserRecord, db: Session) -> ProfileEmbeddingRecord:
    source_text = user_profile_text(user, perspective="mentor guidance" if user.role == "mentor" else "student goals")
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
    if record is None:
        return upsert_profile_embedding(user, db)
    return record


def ai_ranked_mentors(student: UserRecord, query_embedding: list[float], db: Session, mode: str, minimum_score: int = 0) -> list[Mentor]:
    mentors = db.scalars(select(UserRecord).where(UserRecord.role == "mentor")).all()
    keyword_request = recommendation_request_from_user(student)
    student_profile_embedding = ensure_profile_embedding(student, db)
    answer_counts = dict(
        db.execute(
            select(AnswerRecord.mentor_id, func.count(AnswerRecord.id))
            .group_by(AnswerRecord.mentor_id)
        ).all()
    )
    ranked: list[Mentor] = []
    for mentor_user in mentors:
        embedding_record = ensure_profile_embedding(mentor_user, db)
        semantic = max(0.0, cosine_similarity(query_embedding, embedding_record.embedding))
        profile_semantic = max(0.0, cosine_similarity(student_profile_embedding.embedding, embedding_record.embedding))
        overlap = structured_overlap(student, mentor_user)
        completeness = profile_completeness(mentor_user)
        faculty_boost = 1.0 if student.faculty == mentor_user.faculty else 0.0
        final_score = round((semantic * 0.7 + overlap * 0.15 + faculty_boost * 0.1 + completeness * 0.05) * 100)
        bounded_score = max(0, min(99, final_score))
        profile_score = max(0, min(99, round((profile_semantic * 0.7 + overlap * 0.15 + faculty_boost * 0.1 + completeness * 0.05) * 100)))
        base_mentor = mentor_from_user(mentor_user, int(answer_counts.get(mentor_user.id, 0)))
        keyword_score = score_mentor(base_mentor, keyword_request)
        score_update = {
            "match_score": bounded_score,
            "keyword_match_score": keyword_score,
            "profile_match_score": profile_score,
            "match_label": "Complete profile match" if mode == "profile" else "Goal match",
            "match_reasons": match_explanation(student, mentor_user, mode, semantic, overlap),
        }
        if mode == "profile":
            score_update["profile_match_score"] = bounded_score
        else:
            score_update["goal_match_score"] = bounded_score
        mentor = base_mentor.model_copy(
            update=score_update
        )
        if mentor.match_score >= minimum_score:
            ranked.append(mentor)
    db.commit()
    return sorted(ranked, key=lambda item: item.match_score, reverse=True)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/auth/register", response_model=AuthResponse)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> AuthResponse:
    if db.scalar(select(UserRecord).where(UserRecord.email == str(payload.email))) is not None:
        raise HTTPException(status_code=409, detail="Account already exists")

    values = payload.model_dump(exclude={"email", "password"})
    user = UserRecord(
        id=f"u_{uuid4().hex[:10]}",
        email=str(payload.email),
        password_hash=hash_password(payload.password),
        **values,
    )
    db.add(user)
    db.flush()
    upsert_profile_embedding(user, db)
    db.commit()
    db.refresh(user)
    return create_session(user, db)


@app.post("/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    user = db.scalar(select(UserRecord).where(UserRecord.email == str(payload.email)))
    if user is None or not verify_password(payload.password, user.password_hash) or user.role != payload.role:
        raise HTTPException(status_code=401, detail="Invalid email, password, or role")

    return create_session(user, db)


@app.get("/auth/me", response_model=UserPublic)
def me(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> UserPublic:
    return public_user(get_user_from_token(authorization, db))


@app.patch("/auth/me", response_model=UserPublic)
def update_me(payload: UserUpdate, authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> UserPublic:
    user = get_user_from_token(authorization, db)
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(user, field, value)
    upsert_profile_embedding(user, db)
    db.commit()
    db.refresh(user)
    return public_user(user)


@app.post("/auth/logout")
def logout(payload: LogoutRequest, db: Session = Depends(get_db)) -> dict[str, str]:
    session = db.get(SessionRecord, payload.token)
    if session:
        db.delete(session)
        db.commit()
    return {"status": "logged_out"}


@app.get("/mentors", response_model=list[Mentor])
def list_mentors(db: Session = Depends(get_db)) -> list[Mentor]:
    return available_mentors(db)


@app.post("/recommendations", response_model=list[Mentor])
def recommendations(payload: RecommendationRequest, db: Session = Depends(get_db)) -> list[Mentor]:
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
def ai_profile_match(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> list[Mentor]:
    student = get_user_from_token(authorization, db)
    if student.role != "student":
        raise HTTPException(status_code=403, detail="Only students can request mentor matches")
    student_embedding = ensure_profile_embedding(student, db)
    return ai_ranked_mentors(student, student_embedding.embedding, db, mode="profile")


@app.post("/ai/goal-search", response_model=list[Mentor])
def ai_goal_search(payload: GoalSearchRequest, authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> list[Mentor]:
    student = get_user_from_token(authorization, db)
    if student.role != "student":
        raise HTTPException(status_code=403, detail="Only students can search for mentors")
    embedding, _model = embed_text(goal_search_text(student, payload.query))
    return ai_ranked_mentors(student, embedding, db, mode="goal", minimum_score=payload.minimum_score)


@app.get("/connections", response_model=list[ConnectionPublic])
def list_connections(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> list[ConnectionPublic]:
    user = get_user_from_token(authorization, db)
    records = db.scalars(
        select(ConnectionRecord)
        .where((ConnectionRecord.student_id == user.id) | (ConnectionRecord.mentor_id == user.id))
        .order_by(ConnectionRecord.updated_at.desc())
    ).all()
    return [connection_from_record(record) for record in records]


@app.post("/connections/{mentor_id}", response_model=ConnectionPublic)
def request_connection(mentor_id: str, authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> ConnectionPublic:
    user = get_user_from_token(authorization, db)
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can request mentor connections")
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
def accept_connection(connection_id: str, authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> ConversationPublic:
    user = get_user_from_token(authorization, db)
    connection = db.get(ConnectionRecord, connection_id)
    if connection is None:
        raise HTTPException(status_code=404, detail="Connection request not found")
    if user.id != connection.mentor_id:
        raise HTTPException(status_code=403, detail="Only the receiving mentor can accept this connection")
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
    return conversation_from_record(refreshed)


@app.get("/qa/questions", response_model=list[QuestionPublic])
def list_questions(db: Session = Depends(get_db)) -> list[QuestionPublic]:
    records = db.scalars(
        select(QuestionRecord)
        .options(joinedload(QuestionRecord.answers))
        .order_by(QuestionRecord.created_at.desc())
    ).unique().all()
    return [question_from_record(record) for record in records]


@app.post("/qa/questions", response_model=QuestionPublic)
def create_question(payload: QuestionCreate, authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> QuestionPublic:
    user = get_user_from_token(authorization, db)
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can ask questions")

    question = QuestionRecord(
        id=f"q_{uuid4().hex[:10]}",
        student_id=user.id,
        student_name=user.name,
        title=payload.title,
        topic=payload.topic,
        body=payload.body,
        tags=payload.tags,
        attachments=payload.attachments,
        key_terms=extract_key_terms(payload.topic, payload.title, payload.body, existing=payload.tags),
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return question_from_record(question)


@app.post("/qa/questions/{question_id}/answers", response_model=QuestionPublic)
def answer_question(question_id: str, payload: AnswerCreate, authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> QuestionPublic:
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
    )
    db.add(answer)
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


@app.get("/conversations", response_model=list[ConversationPublic])
def list_conversations(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> list[ConversationPublic]:
    user = get_user_from_token(authorization, db)
    records = db.scalars(
        select(ConversationRecord)
        .options(joinedload(ConversationRecord.messages))
        .where((ConversationRecord.student_id == user.id) | (ConversationRecord.mentor_id == user.id))
        .order_by(ConversationRecord.updated_at.desc())
    ).unique().all()
    return [conversation_from_record(record) for record in records]


@app.post("/conversations/{mentor_id}", response_model=ConversationPublic)
def start_conversation(mentor_id: str, authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> ConversationPublic:
    user = get_user_from_token(authorization, db)
    mentor = find_mentor_by_id(mentor_id, db)
    conversation_id = f"{user.id}_{mentor.id}"
    connection = db.get(ConnectionRecord, conversation_id)
    if connection is None:
        raise HTTPException(status_code=403, detail="Connect with this mentor before messaging")
    if connection.status != "accepted":
        raise HTTPException(status_code=403, detail="Connection request is waiting for mentor approval")
    existing = db.scalar(
        select(ConversationRecord)
        .options(joinedload(ConversationRecord.messages))
        .where(ConversationRecord.id == conversation_id)
    )
    if existing:
        return conversation_from_record(existing)
    conversation = ensure_conversation_for_connection(connection, db)
    db.commit()
    refreshed = db.scalar(
        select(ConversationRecord)
        .options(joinedload(ConversationRecord.messages))
        .where(ConversationRecord.id == conversation_id)
    )
    if refreshed is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation_from_record(refreshed)


@app.post("/conversations/{conversation_id}/messages", response_model=ConversationPublic)
def send_message(conversation_id: str, payload: MessageCreate, authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> ConversationPublic:
    user = get_user_from_token(authorization, db)
    conversation = db.scalar(
        select(ConversationRecord)
        .options(joinedload(ConversationRecord.messages))
        .where(ConversationRecord.id == conversation_id)
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if user.id not in {conversation.student_id, conversation.mentor_id}:
        raise HTTPException(status_code=403, detail="You are not part of this conversation")

    message = MessageRecord(
        id=f"m_{uuid4().hex[:10]}",
        conversation_id=conversation.id,
        sender_id=user.id,
        sender_name=user.name,
        body=payload.body,
    )
    db.add(message)
    conversation.last_message = message.body
    conversation.updated_at = datetime.now(timezone.utc)
    db.commit()
    refreshed = db.scalar(
        select(ConversationRecord)
        .options(joinedload(ConversationRecord.messages))
        .where(ConversationRecord.id == conversation_id)
    )
    if refreshed is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation_from_record(refreshed)
