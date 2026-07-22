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
from app.models import UserRecord
from app.qa_archive import (
    DEFAULT_TOPIC_CLUSTER,
    duplicate_score,
    summarise_answer,
    topic_cluster,
)


class QAArchiveServiceTests(unittest.TestCase):
    def test_topic_clustering_uses_stable_nus_categories(self) -> None:
        self.assertEqual(
            topic_cluster(
                "NOC",
                "Preparing for a startup placement",
                "I want entrepreneurship experience overseas.",
            ),
            "NOC & Entrepreneurship",
        )
        self.assertEqual(
            topic_cluster("General", "Need some guidance", "Where should I begin?"),
            DEFAULT_TOPIC_CLUSTER,
        )

    def test_summary_prioritises_actionable_advice(self) -> None:
        body = (
            "NOC applications involve several stages and every cohort is slightly different. "
            "You should compare the available startup roles with your learning goals before ranking companies. "
            "Start preparing concise examples of teamwork, ambiguity, and initiative for your interview. "
            "The programme can be demanding, and speaking with recent participants will give you additional context."
        )

        summary = summarise_answer(body)

        self.assertIn("You should compare", summary)
        self.assertIn("Start preparing", summary)
        self.assertLessEqual(len(summary), 320)

    def test_duplicate_score_exposes_measurable_evidence(self) -> None:
        result = duplicate_score(
            draft_title="How should I prepare for NOC startup interviews?",
            draft_topic="NOC",
            draft_body="I need advice on choosing startups and preparing for interviews.",
            draft_tags=["startup", "interview"],
            candidate_title="How can I prepare for my NOC startup interview?",
            candidate_topic="NOC",
            candidate_body="What preparation is useful when interviewing with NOC startups?",
            candidate_terms=["NOC", "startup", "interview", "preparation"],
            candidate_cluster="NOC & Entrepreneurship",
        )

        self.assertGreaterEqual(result.score, 60)
        self.assertTrue(any("Shared terms" in item for item in result.evidence))
        self.assertIn("Similar question title", result.evidence)


class QAArchiveEndpointTests(unittest.TestCase):
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
                user_id="00000000-0000-0000-0000-000000000301",
                email="qa-student@example.com",
            ),
            "mentor-token": SupabaseClaims(
                user_id="00000000-0000-0000-0000-000000000302",
                email="qa-mentor@example.com",
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
                        id="u_qa_student",
                        email="qa-student@example.com",
                        supabase_user_id=self.claims["student-token"].user_id,
                        role="student",
                        name="Q&A Student",
                    ),
                    UserRecord(
                        id="u_qa_mentor",
                        email="qa-mentor@example.com",
                        supabase_user_id=self.claims["mentor-token"].user_id,
                        role="mentor",
                        name="Q&A Mentor",
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
        return self.claims[authorization.removeprefix("Bearer ")]

    @staticmethod
    def _headers(token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {token}"}

    def _create_noc_question(self) -> dict[str, object]:
        response = self.client.post(
            "/qa/questions",
            headers=self._headers("student-token"),
            json={
                "title": "How should I prepare for NOC startup interviews?",
                "topic": "NOC",
                "body": "I need advice on choosing startup roles and preparing for the interview process.",
                "tags": ["NOC", "startup", "interview"],
                "attachments": [],
            },
        )
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_question_creation_assigns_cluster_and_answer_summary_metadata(
        self,
    ) -> None:
        question = self._create_noc_question()
        self.assertEqual(question["topic_cluster"], "NOC & Entrepreneurship")

        answer = self.client.post(
            f"/qa/questions/{question['id']}/answers",
            headers=self._headers("mentor-token"),
            json={
                "body": (
                    "The selection process varies between cohorts and companies. "
                    "You should compare each startup role with the skills you want to develop. "
                    "Start preparing examples of initiative and teamwork before your interview. "
                    "Speaking with recent participants can also help you understand the workload."
                )
            },
        )

        self.assertEqual(answer.status_code, 200)
        created_answer = answer.json()["answers"][0]
        self.assertEqual(created_answer["summary_version"], "extractive-v2")
        self.assertIn("You should compare", created_answer["summary"])
        self.assertIn("Start preparing", created_answer["summary"])

    def test_student_receives_ranked_duplicate_suggestions_with_evidence(self) -> None:
        question = self._create_noc_question()
        self.client.post(
            f"/qa/questions/{question['id']}/answers",
            headers=self._headers("mentor-token"),
            json={
                "body": "You should research each startup and prepare examples that show initiative before your NOC interview."
            },
        )

        response = self.client.post(
            "/qa/questions/suggestions",
            headers=self._headers("student-token"),
            json={
                "title": "How can I prepare for an NOC startup interview?",
                "topic": "NOC",
                "body": "I want interview advice and help comparing startup opportunities for NOC.",
                "tags": ["startup", "interview"],
            },
        )

        self.assertEqual(response.status_code, 200)
        suggestions = response.json()
        self.assertEqual(suggestions[0]["question_id"], question["id"])
        self.assertGreaterEqual(suggestions[0]["similarity_score"], 35)
        self.assertTrue(suggestions[0]["evidence"])
        self.assertEqual(suggestions[0]["answer_count"], 1)
        self.assertIsNotNone(suggestions[0]["latest_summary"])

    def test_suggestions_and_answering_enforce_roles(self) -> None:
        question = self._create_noc_question()
        payload = {
            "title": "How can I prepare for NOC interviews?",
            "topic": "NOC",
            "body": "I want useful preparation guidance for startup interviews.",
            "tags": ["NOC"],
        }

        mentor_suggestions = self.client.post(
            "/qa/questions/suggestions",
            headers=self._headers("mentor-token"),
            json=payload,
        )
        student_answer = self.client.post(
            f"/qa/questions/{question['id']}/answers",
            headers=self._headers("student-token"),
            json={"body": "A student must not be able to answer this question."},
        )

        self.assertEqual(mentor_suggestions.status_code, 403)
        self.assertEqual(student_answer.status_code, 403)

    def test_question_input_limits_are_enforced(self) -> None:
        response = self.client.post(
            "/qa/questions/suggestions",
            headers=self._headers("student-token"),
            json={
                "title": "A valid question title",
                "topic": "Academic planning",
                "body": "This body is long enough to pass the minimum validation.",
                "tags": [f"tag-{index}" for index in range(13)],
            },
        )

        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
