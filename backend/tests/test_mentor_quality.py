from __future__ import annotations

import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import SupabaseClaims
from app.database import Base, get_db
from app.main import app
from app.models import ConnectionRecord, UserRecord


class MentorQualityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.session_factory = sessionmaker(
            bind=self.engine, autoflush=False, autocommit=False
        )

        def override_get_db():
            db = self.session_factory()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)
        self.claims = {
            "student-token": SupabaseClaims(
                user_id="00000000-0000-0000-0000-000000000101",
                email="student@example.com",
            ),
            "other-student-token": SupabaseClaims(
                user_id="00000000-0000-0000-0000-000000000102",
                email="other@example.com",
            ),
            "mentor-token": SupabaseClaims(
                user_id="00000000-0000-0000-0000-000000000201",
                email="mentor@example.com",
            ),
        }
        self.auth_patcher = patch(
            "app.main.claims_from_authorization",
            side_effect=self._claims_from_header,
        )
        self.auth_patcher.start()

        with Session(self.engine) as db:
            db.add_all(
                [
                    UserRecord(
                        id="u_student",
                        email="student@example.com",
                        supabase_user_id=self.claims["student-token"].user_id,
                        role="student",
                        name="Student One",
                    ),
                    UserRecord(
                        id="u_other",
                        email="other@example.com",
                        supabase_user_id=self.claims["other-student-token"].user_id,
                        role="student",
                        name="Student Two",
                    ),
                    UserRecord(
                        id="u_mentor",
                        email="mentor@example.com",
                        supabase_user_id=self.claims["mentor-token"].user_id,
                        role="mentor",
                        name="Mentor One",
                        verification_status="unverified",
                    ),
                ]
            )
            db.commit()

    def tearDown(self) -> None:
        self.auth_patcher.stop()
        app.dependency_overrides.clear()
        self.engine.dispose()

    def _claims_from_header(self, authorization: str | None) -> SupabaseClaims:
        if authorization is None:
            raise AssertionError("Expected an Authorization header")
        token = authorization.removeprefix("Bearer ")
        return self.claims[token]

    @staticmethod
    def _headers(token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {token}"}

    def _add_connection(self, student_id: str, status: str) -> None:
        with Session(self.engine) as db:
            student = db.get(UserRecord, student_id)
            if student is None:
                raise AssertionError("Test student was not created")
            db.add(
                ConnectionRecord(
                    id=f"{student_id}_u_mentor",
                    student_id=student_id,
                    student_name=student.name,
                    mentor_id="u_mentor",
                    mentor_name="Mentor One",
                    mentor_programme="Computer Science",
                    status=status,
                )
            )
            db.commit()

    def test_mentor_can_replace_structured_availability(self) -> None:
        response = self.client.put(
            "/mentors/me/availability",
            headers=self._headers("mentor-token"),
            json={
                "slots": [
                    {
                        "day_of_week": "monday",
                        "start_time": "09:00",
                        "end_time": "10:30",
                        "mode": "hybrid",
                        "location": "COM3-01-01",
                    },
                    {
                        "day_of_week": "wednesday",
                        "start_time": "14:00",
                        "end_time": "15:00",
                        "mode": "online",
                    },
                ]
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 2)
        replaced = self.client.put(
            "/mentors/me/availability",
            headers=self._headers("mentor-token"),
            json={"slots": [response.json()[0]]},
        )
        self.assertEqual(replaced.status_code, 200)
        self.assertEqual(len(replaced.json()), 1)
        mentors = self.client.get("/mentors").json()
        mentor = next(item for item in mentors if item["id"] == "u_mentor")
        self.assertEqual(len(mentor["availability"]), 1)
        self.assertEqual(mentor["availability"][0]["day_of_week"], "monday")

    def test_availability_rejects_overlapping_slots_and_student_updates(self) -> None:
        payload = {
            "slots": [
                {
                    "day_of_week": "monday",
                    "start_time": "09:00",
                    "end_time": "11:00",
                },
                {
                    "day_of_week": "monday",
                    "start_time": "10:00",
                    "end_time": "12:00",
                },
            ]
        }
        overlap = self.client.put(
            "/mentors/me/availability",
            headers=self._headers("mentor-token"),
            json=payload,
        )
        student_update = self.client.put(
            "/mentors/me/availability",
            headers=self._headers("student-token"),
            json={"slots": []},
        )

        self.assertEqual(overlap.status_code, 422)
        self.assertEqual(student_update.status_code, 403)

    def test_mentor_can_request_verification(self) -> None:
        response = self.client.post(
            "/mentors/me/verification",
            headers=self._headers("mentor-token"),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "pending")
        public_status = self.client.get("/mentors/u_mentor/verification")
        self.assertEqual(public_status.json()["status"], "pending")

    def test_review_requires_an_accepted_connection(self) -> None:
        eligibility = self.client.get(
            "/mentors/u_mentor/reviews/eligibility",
            headers=self._headers("student-token"),
        )
        review = self.client.post(
            "/mentors/u_mentor/reviews",
            headers=self._headers("student-token"),
            json={"rating": 5, "comment": "Very helpful"},
        )

        self.assertEqual(eligibility.status_code, 200)
        self.assertFalse(eligibility.json()["can_review"])
        self.assertEqual(review.status_code, 403)

    def test_review_is_unique_editable_by_author_and_aggregated(self) -> None:
        self._add_connection("u_student", "accepted")
        created = self.client.post(
            "/mentors/u_mentor/reviews",
            headers=self._headers("student-token"),
            json={"rating": 4, "comment": "Clear and practical guidance"},
        )
        duplicate = self.client.post(
            "/mentors/u_mentor/reviews",
            headers=self._headers("student-token"),
            json={"rating": 5, "comment": "Second review"},
        )
        forbidden_edit = self.client.patch(
            f"/reviews/{created.json()['id']}",
            headers=self._headers("other-student-token"),
            json={"rating": 1, "comment": "Not my review"},
        )
        edited = self.client.patch(
            f"/reviews/{created.json()['id']}",
            headers=self._headers("student-token"),
            json={"rating": 5, "comment": "Updated after another session"},
        )

        self.assertEqual(created.status_code, 201)
        self.assertEqual(duplicate.status_code, 409)
        self.assertEqual(forbidden_edit.status_code, 403)
        self.assertEqual(edited.status_code, 200)
        self.assertEqual(edited.json()["rating"], 5)

        reviews = self.client.get("/mentors/u_mentor/reviews")
        mentor = next(
            item
            for item in self.client.get("/mentors").json()
            if item["id"] == "u_mentor"
        )
        self.assertEqual(len(reviews.json()), 1)
        self.assertEqual(mentor["rating"], 5.0)
        self.assertEqual(mentor["reviews"], 1)
        self.assertEqual(mentor["mentees"], 1)

    def test_rating_aggregation_averages_multiple_authorized_reviews(self) -> None:
        self._add_connection("u_student", "accepted")
        self._add_connection("u_other", "accepted")
        self.client.post(
            "/mentors/u_mentor/reviews",
            headers=self._headers("student-token"),
            json={"rating": 5, "comment": "Excellent"},
        )
        self.client.post(
            "/mentors/u_mentor/reviews",
            headers=self._headers("other-student-token"),
            json={"rating": 3, "comment": "Useful"},
        )

        mentor = next(
            item
            for item in self.client.get("/mentors").json()
            if item["id"] == "u_mentor"
        )
        self.assertEqual(mentor["rating"], 4.0)
        self.assertEqual(mentor["reviews"], 2)


if __name__ == "__main__":
    unittest.main()
