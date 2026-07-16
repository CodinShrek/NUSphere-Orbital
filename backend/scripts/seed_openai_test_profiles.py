from __future__ import annotations

import argparse
import os
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select

from backend.app.ai_matching import embed_text
from backend.app.database import SessionLocal
from backend.app.main import upsert_profile_embedding
from backend.app.models import (
    AnswerRecord,
    ConnectionRecord,
    ConversationRecord,
    MessageRecord,
    ProfileEmbeddingRecord,
    QuestionRecord,
    SessionRecord,
    UserRecord,
)


OLD_SEED_EMAILS = {
    "mentor.noc.startup@u.nus.edu",
    "mentor.ai.research@u.nus.edu",
    "mentor.exchange.biz@u.nus.edu",
    "mentor.cde.robotics@u.nus.edu",
    "mentor.prof.swe@u.nus.edu",
    "mentor.law.moot@u.nus.edu",
    "student.noc@u.nus.edu",
    "student.research@u.nus.edu",
    "student.robotics@u.nus.edu",
}


TEST_PROFILES = [
    {
        "email": "openai.student.startup@u.nus.edu",
        "role": "student",
        "name": "Arjun Startup",
        "faculty": "Computing",
        "major": "Computer Science",
        "modules_taken": ["CS2103T", "CS3244", "IS3106"],
        "ccas": ["NUS Hackers", "NUS Entrepreneurship Society"],
        "nus_opportunities": ["NUS Overseas Colleges", "BLOCK71"],
        "exchange_universities": ["University of California (System-Wide)"],
        "accommodation": "Tembusu College",
        "interests": ["Startups", "AI products", "NOC"],
        "goals": ["Build a startup while managing CS modules", "Prepare for NOC applications"],
        "bio": "CS student exploring NOC, product engineering, and how to balance startup work with technical modules.",
    },
    {
        "email": "openai.student.research@u.nus.edu",
        "role": "student",
        "name": "Mei Research",
        "faculty": "Computing",
        "major": "Computer Science",
        "modules_taken": ["CS2040S", "CS3244", "CS4248"],
        "ccas": ["NUS Hackers"],
        "nus_opportunities": ["Undergraduate Research Opportunities Programme (UROP)"],
        "exchange_universities": [],
        "accommodation": "College of Alice and Peter Tan",
        "interests": ["Machine learning", "Research", "Teaching assistantship"],
        "goals": ["Find a UROP supervisor", "Plan AI modules without overloading"],
        "bio": "Student interested in ML research, UROP, and eventually becoming a teaching assistant.",
    },
    {
        "email": "openai.student.exchange@u.nus.edu",
        "role": "student",
        "name": "Nadia Exchange",
        "faculty": "Business",
        "major": "Business Administration",
        "modules_taken": ["DAO1704", "MKT1705X"],
        "ccas": ["NUS Students' Business Club"],
        "nus_opportunities": ["Case competitions"],
        "exchange_universities": ["University of British Columbia", "University of Toronto"],
        "accommodation": "Off-campus accommodation",
        "interests": ["Exchange planning", "Case competitions", "Consulting"],
        "goals": ["Choose an exchange partner", "Connect business school experience to consulting internships"],
        "bio": "Business student comparing Canada exchange options and preparing for case competitions.",
    },
    {
        "email": "openai.mentor.startup@u.nus.edu",
        "role": "mentor",
        "name": "Alicia OpenAI",
        "faculty": "Computing",
        "major": "Computer Science",
        "mentor_type": "senior",
        "modules_taken": ["CS2103T", "CS3216", "CS3244"],
        "ccas": ["NUS Hackers", "NUS Entrepreneurship Society"],
        "nus_opportunities": ["NUS Overseas Colleges", "BLOCK71", "NUS Start-up Runway"],
        "exchange_universities": ["University of California (System-Wide)"],
        "accommodation": "Tembusu College",
        "interests": ["NOC planning", "Startup internships", "AI product projects"],
        "goals": ["Guide students on startup pathways"],
        "areas_of_expertise": ["NOC planning", "Startup internships", "CS module planning", "AI product projects"],
        "consultation_hours": "Tue 14:00, Thu 16:00",
        "bio": "Year 4 CS student who completed NOC and worked with an early-stage startup while planning software engineering modules.",
        "mentorship_goals": "Help students decide whether NOC fits their goals and prepare startup applications.",
    },
    {
        "email": "openai.mentor.research@u.nus.edu",
        "role": "mentor",
        "name": "Daniel OpenAI",
        "faculty": "Computing",
        "major": "Computer Science",
        "mentor_type": "senior",
        "modules_taken": ["CS3244", "CS4248", "CS3263"],
        "ccas": ["NUS Hackers", "Computing for Voluntary Welfare Organisations"],
        "nus_opportunities": ["Undergraduate Research Opportunities Programme (UROP)", "Teaching assistantship"],
        "exchange_universities": [],
        "accommodation": "College of Alice and Peter Tan",
        "interests": ["Machine learning", "UROP", "Research planning", "Teaching assistantship"],
        "goals": ["Guide students into undergraduate research"],
        "areas_of_expertise": ["Machine learning", "UROP", "Research planning", "Teaching assistantship"],
        "consultation_hours": "Mon 10:00, Wed 15:00",
        "bio": "Senior student with UROP experience in machine learning and teaching assistant experience for programming modules.",
        "mentorship_goals": "Guide students on finding research supervisors, preparing for UROP, and choosing AI/ML modules.",
    },
    {
        "email": "openai.mentor.exchange@u.nus.edu",
        "role": "mentor",
        "name": "Mira OpenAI",
        "faculty": "Business",
        "major": "Business Administration",
        "mentor_type": "alumni",
        "graduation_year": "2024",
        "current_role": "Strategy Analyst",
        "organisation": "Regional consumer tech company",
        "modules_taken": ["DAO1704", "MKT1705X"],
        "ccas": ["NUS Students' Business Club", "Case competitions"],
        "nus_opportunities": ["Case competitions", "NUS Enterprise Summer Programme in Entrepreneurship"],
        "exchange_universities": ["University of British Columbia", "University of Toronto"],
        "accommodation": "Off-campus accommodation",
        "interests": ["Exchange planning", "Case competitions", "Consulting preparation"],
        "goals": ["Support students planning exchange and consulting internships"],
        "areas_of_expertise": ["Exchange planning", "Case competitions", "Consulting preparation", "Career exploration"],
        "bio": "Business alumni who went on exchange in Canada, joined case competitions, and moved into strategy work after graduation.",
        "mentorship_goals": "Help students choose exchange partners and connect business school experiences to career goals.",
    },
    {
        "email": "openai.mentor.robotics@u.nus.edu",
        "role": "mentor",
        "name": "Ravi OpenAI",
        "faculty": "Design and Engineering",
        "major": "Electrical Engineering",
        "mentor_type": "senior",
        "modules_taken": ["EE2026", "EE3305", "ME3243"],
        "ccas": ["Engineers Without Borders (EWB) Singapore - NUS Student Chapter", "NUS Students' Engineering Club"],
        "nus_opportunities": ["Innovation and Design Programme (iDP)", "Undergraduate Research Opportunities Programme (UROP)"],
        "exchange_universities": [],
        "accommodation": "Off-campus accommodation",
        "interests": ["Robotics", "Embedded systems", "iDP", "CDE project planning"],
        "goals": ["Guide students through CDE projects"],
        "areas_of_expertise": ["Robotics", "Embedded systems", "iDP", "CDE project planning"],
        "consultation_hours": "Fri 13:00, Fri 14:00",
        "bio": "CDE student focused on robotics, embedded systems, and design projects through iDP and UROP.",
        "mentorship_goals": "Help students choose engineering modules, join project teams, and plan robotics opportunities.",
    },
    {
        "email": "openai.mentor.professor@u.nus.edu",
        "role": "mentor",
        "name": "Prof. Elaine OpenAI",
        "faculty": "Computing",
        "major": "Department of Computer Science",
        "department": "Department of Computer Science",
        "mentor_type": "professor",
        "modules_taught": ["CS2103T", "CS3219"],
        "areas_of_expertise": ["Software engineering", "Team projects", "Technical communication", "CS2103T"],
        "office_location": "COM2-03-12",
        "consultation_hours": "Mon 11:00, Thu 10:00",
        "interests": ["Software engineering", "Team projects", "Technical communication"],
        "goals": ["Advise students on software engineering pathways"],
        "bio": "Professor teaching software engineering and project-based modules, with experience advising students on team projects.",
        "mentorship_goals": "Guide students who want to become stronger software engineers and prepare for technical teamwork.",
    },
]


def require_openai_embeddings() -> None:
    if not os.getenv("OPENAI_API_KEY"):
        raise SystemExit("OPENAI_API_KEY is not set in this PowerShell session.")
    _vector, model = embed_text("OpenAI embedding readiness check for NUSphere test profile seeding.")
    if model == "local-hashing-v1":
        raise SystemExit("OpenAI embeddings were not used. Check your OPENAI_API_KEY and network access.")
    print(f"Embedding provider ready: {model}")


def delete_user(db, user: UserRecord) -> None:
    db.execute(MessageRecord.__table__.delete().where(MessageRecord.sender_id == user.id))
    db.execute(ConversationRecord.__table__.delete().where((ConversationRecord.student_id == user.id) | (ConversationRecord.mentor_id == user.id)))
    db.execute(ConnectionRecord.__table__.delete().where((ConnectionRecord.student_id == user.id) | (ConnectionRecord.mentor_id == user.id)))
    db.execute(AnswerRecord.__table__.delete().where(AnswerRecord.mentor_id == user.id))
    db.execute(QuestionRecord.__table__.delete().where(QuestionRecord.student_id == user.id))
    db.execute(SessionRecord.__table__.delete().where(SessionRecord.user_id == user.id))
    db.execute(ProfileEmbeddingRecord.__table__.delete().where(ProfileEmbeddingRecord.user_id == user.id))
    db.delete(user)


def cleanup_profiles(db, delete_all_local_users: bool) -> list[str]:
    target_emails = set(OLD_SEED_EMAILS) | {profile["email"] for profile in TEST_PROFILES}
    users = db.scalars(select(UserRecord).where(UserRecord.email.in_(target_emails))).all()
    if delete_all_local_users:
        local_users = db.scalars(
            select(UserRecord)
            .join(ProfileEmbeddingRecord, ProfileEmbeddingRecord.user_id == UserRecord.id)
            .where(ProfileEmbeddingRecord.model == "local-hashing-v1")
        ).all()
        users = list({user.id: user for user in [*users, *local_users]}.values())

    removed = []
    for user in users:
        removed.append(user.email)
        delete_user(db, user)
    db.flush()
    return sorted(removed)


def create_profile(db, profile: dict[str, object]) -> str:
    defaults = {
        "modules_taken": [],
        "ccas": [],
        "nus_opportunities": [],
        "exchange_universities": [],
        "accommodation": "Off-campus accommodation",
        "interests": [],
        "goals": [],
        "bio": "",
        "mentor_type": None,
        "mentorship_goals": None,
        "mentor_type_other": None,
        "graduation_year": None,
        "current_role": None,
        "organisation": None,
        "department": None,
        "consultation_hours": None,
        "modules_taught": [],
        "areas_of_expertise": [],
        "office_location": None,
        "office": None,
        "profile_picture": None,
    }
    values = {**defaults, **profile}
    user = UserRecord(
        id=f"u_{uuid4().hex[:10]}",
        email=str(values.pop("email")),
        password_hash=None,
        **values,
    )
    db.add(user)
    db.flush()
    embedding = upsert_profile_embedding(user, db)
    return f"{user.email} -> {embedding.model}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed OpenAI-backed NUSphere test profiles.")
    parser.add_argument(
        "--delete-all-local-users",
        action="store_true",
        help="Also remove every user whose cached profile embedding uses local-hashing-v1.",
    )
    args = parser.parse_args()

    os.environ.setdefault(
        "DATABASE_URL",
        f"sqlite:///{(Path(__file__).resolve().parents[1] / 'nusphere.db').as_posix()}",
    )
    require_openai_embeddings()

    with SessionLocal() as db:
        removed = cleanup_profiles(db, args.delete_all_local_users)
        created = [create_profile(db, profile) for profile in TEST_PROFILES]
        db.commit()

    print("Removed profiles:")
    for email in removed:
        print(f"  - {email}")
    print("Created profiles:")
    for line in created:
        print(f"  - {line}")
    print("Password for all new test profiles: Password1")


if __name__ == "__main__":
    main()
