from __future__ import annotations

import os
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field


Role = Literal["student", "mentor"]


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    role: Role
    name: str
    faculty: str = "SoC"
    interests: list[str] = Field(default_factory=list)
    goals: list[str] = Field(default_factory=list)


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
    interests: list[str]
    goals: list[str]


class AuthResponse(BaseModel):
    token: str
    user: UserPublic


class LogoutRequest(BaseModel):
    token: str


class Mentor(BaseModel):
    id: str
    name: str
    year: str
    programme: str
    faculty: str
    role: str
    rating: float
    reviews: int
    mentees: int
    answers: int
    match_score: int
    interests: list[str]
    experience_tags: list[str]
    bio: str
    experience: list[str]


class RecommendationRequest(BaseModel):
    interests: list[str] = Field(default_factory=list)
    goals: list[str] = Field(default_factory=list)
    faculty: str | None = None
    minimum_score: int = 0


class StoredUser(UserPublic):
    password: str


app = FastAPI(title="NUSphere API", version="0.1.0")

frontend_origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
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


users: dict[str, StoredUser] = {
    "studentid@u.nus.edu": StoredUser(
        id="u_demo_student",
        email="studentid@u.nus.edu",
        password="password123",
        role="student",
        name="User Name",
        faculty="SoC",
        interests=["AI/M4", "Interest 2", "NOC", "UROPS"],
        goals=["Find seniors for module planning", "Explore research pathways"],
    ),
    "mentor@u.nus.edu": StoredUser(
        id="u_demo_mentor",
        email="mentor@u.nus.edu",
        password="password123",
        role="mentor",
        name="Mentor Name",
        faculty="SoC",
        interests=["AI/M4", "Interest 3", "NOC"],
        goals=["Guide juniors on modules and research"],
    ),
}

sessions: dict[str, str] = {}


mentors = [
    Mentor(
        id="m1",
        name="Mentor Name",
        year="Year 4",
        programme="Computer Science",
        faculty="SoC",
        role="Senior Student",
        rating=4.9,
        reviews=23,
        mentees=12,
        answers=47,
        match_score=96,
        interests=["AI/M4", "Interest 3", "Interest 2", "Experience tag"],
        experience_tags=["NOC", "UROPS", "Teaching Assistant"],
        bio="Senior student focused on AI modules, research projects, and choosing a coherent computing pathway at NUS.",
        experience=[
            "AI research assistant, School of Computing",
            "NOC preparation and startup internship",
            "Peer mentor for first-year module planning",
        ],
    ),
    Mentor(
        id="m2",
        name="Mentor Name 2",
        year="Year 3",
        programme="Business Analytics",
        faculty="SoC",
        role="Senior Student",
        rating=4.8,
        reviews=18,
        mentees=9,
        answers=31,
        match_score=88,
        interests=["Interest 1", "Interest 2", "Interest 6", "UROPS"],
        experience_tags=["Exchange", "Analytics", "Case competitions"],
        bio="Business analytics senior who helps students compare internships, exchange destinations, and project-based learning routes.",
        experience=[
            "Exchange preparation for Europe universities",
            "Analytics internship in product operations",
            "Case competition mentor",
        ],
    ),
    Mentor(
        id="m3",
        name="Mentor Name 3",
        year="Professor",
        programme="Computer Engineering",
        faculty="Engineering",
        role="Professor",
        rating=4.7,
        reviews=14,
        mentees=7,
        answers=54,
        match_score=84,
        interests=["Systems Interest 2", "Interest 2", "Hardware", "Research"],
        experience_tags=["Hardware accelerators", "Undergraduate research"],
        bio="Faculty mentor advising students who want to explore systems, hardware acceleration, and research opportunities.",
        experience=[
            "Principal investigator for systems research",
            "Supervisor for undergraduate research projects",
            "Advisor for engineering pathway planning",
        ],
    ),
]


def public_user(user: StoredUser) -> UserPublic:
    return UserPublic(**user.model_dump(exclude={"password"}))


def create_session(user: StoredUser) -> AuthResponse:
    token = f"demo_{uuid4().hex}"
    sessions[token] = user.email
    return AuthResponse(token=token, user=public_user(user))


def get_user_from_token(authorization: str | None) -> StoredUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")

    token = authorization.removeprefix("Bearer ").strip()
    email = sessions.get(token)
    user = users.get(email or "")
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired auth token")

    return user


def score_mentor(mentor: Mentor, request: RecommendationRequest) -> int:
    query_terms = {term.lower() for term in request.interests + request.goals}
    mentor_terms = {
        term.lower()
        for term in mentor.interests
        + mentor.experience_tags
        + [mentor.faculty, mentor.programme, mentor.role, mentor.bio]
    }
    overlap = sum(
        1
        for term in query_terms
        if any(term in value or value in term for value in mentor_terms)
    )
    faculty_boost = 6 if request.faculty and request.faculty == mentor.faculty else 0
    return min(99, mentor.match_score + overlap * 3 + faculty_boost)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/auth/register", response_model=AuthResponse)
def register(payload: UserCreate) -> AuthResponse:
    if payload.email in users:
        raise HTTPException(status_code=409, detail="Account already exists")

    user = StoredUser(id=f"u_{uuid4().hex[:10]}", **payload.model_dump())
    users[payload.email] = user
    return create_session(user)


@app.post("/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest) -> AuthResponse:
    user = users.get(payload.email)
    if user is None or user.password != payload.password or user.role != payload.role:
        raise HTTPException(status_code=401, detail="Invalid email, password, or role")

    return create_session(user)


@app.get("/auth/me", response_model=UserPublic)
def me(authorization: str | None = Header(default=None)) -> UserPublic:
    return public_user(get_user_from_token(authorization))


@app.post("/auth/logout")
def logout(payload: LogoutRequest) -> dict[str, str]:
    sessions.pop(payload.token, None)
    return {"status": "logged_out"}


@app.get("/mentors", response_model=list[Mentor])
def list_mentors() -> list[Mentor]:
    return mentors


@app.post("/recommendations", response_model=list[Mentor])
def recommendations(payload: RecommendationRequest) -> list[Mentor]:
    ranked = [
        mentor.model_copy(update={"match_score": score_mentor(mentor, payload)})
        for mentor in mentors
    ]
    return [
        mentor
        for mentor in sorted(ranked, key=lambda item: item.match_score, reverse=True)
        if mentor.match_score >= payload.minimum_score
    ]
