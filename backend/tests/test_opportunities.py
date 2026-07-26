import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

os.environ.setdefault("OPENAI_API_KEY", "")

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import UserRecord


class OpportunityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        TestingSessionLocal = sessionmaker(
            bind=self.engine, autoflush=False, autocommit=False
        )
        Base.metadata.create_all(self.engine)

        def override_db():
            db = TestingSessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_db
        self.claims_patcher = patch("app.main.claims_from_authorization")
        claims = self.claims_patcher.start()
        claims.side_effect = lambda authorization: SimpleNamespace(
            user_id=(
                "mentor-supa"
                if authorization == "Bearer mentor-token"
                else "student-supa"
            ),
            email=(
                "mentor@u.nus.edu"
                if authorization == "Bearer mentor-token"
                else "student@u.nus.edu"
            ),
        )
        self.client = TestClient(app)
        with TestingSessionLocal() as db:
            student = UserRecord(
                id="u_student",
                email="student@u.nus.edu",
                supabase_user_id="student-supa",
                role="student",
                name="Student One",
                faculty="Computing",
                major="Computer Science",
                interests=["AI", "startups"],
                goals=["Join NOC and build machine learning products"],
                modules_taken=["CS2109S"],
                ccas=["NUS Hackers"],
                nus_opportunities=["NOC"],
                exchange_universities=[],
                accommodation="PGPR",
                bio="I want applied AI product experience.",
            )
            mentor = UserRecord(
                id="u_mentor",
                email="mentor@u.nus.edu",
                supabase_user_id="mentor-supa",
                role="mentor",
                name="Mentor One",
                faculty="Computing",
                major="Computer Science",
                interests=["AI"],
                goals=[],
                modules_taken=[],
                ccas=[],
                nus_opportunities=["NOC"],
                exchange_universities=[],
                accommodation="Off-campus",
                bio="Mentor",
                verification_status="verified",
            )
            db.add_all([student, mentor])
            db.commit()

    def tearDown(self) -> None:
        app.dependency_overrides.clear()
        self.claims_patcher.stop()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def payload(self, title: str = "AI Product Sprint") -> dict:
        return {
            "category": "project",
            "title": title,
            "organisation": "NUS Hackers",
            "summary": "Build applied AI products with a student team.",
            "description": "A semester-long project for students interested in AI, startups, and product engineering.",
            "faculty": "Computing",
            "location": "SoC",
            "commitment": "4 hours per week",
            "deadline": "2026-08-30",
            "target_years": ["Year 2", "Year 3"],
            "relevant_majors": ["Computer Science"],
            "tags": ["AI", "startup", "NOC"],
            "skills": ["machine learning", "product"],
            "details": ["team project", "portfolio-ready demo"],
        }

    def test_mentor_posts_are_verified_students_are_unverified(self) -> None:
        mentor_post = self.client.post(
            "/opportunities",
            headers={"Authorization": "Bearer mentor-token"},
            json=self.payload(),
        )
        student_post = self.client.post(
            "/opportunities",
            headers={"Authorization": "Bearer student-token"},
            json=self.payload("Student Research Jam"),
        )
        self.assertEqual(mentor_post.status_code, 200)
        self.assertEqual(student_post.status_code, 200)
        self.assertTrue(mentor_post.json()["is_verified"])
        self.assertFalse(student_post.json()["is_verified"])

    def test_standard_matching_returns_reasons(self) -> None:
        self.client.post(
            "/opportunities",
            headers={"Authorization": "Bearer mentor-token"},
            json=self.payload(),
        )
        response = self.client.post(
            "/opportunities/recommendations",
            headers={"Authorization": "Bearer student-token"},
            json={"query": "AI startup", "categories": ["project"], "minimum_score": 0},
        )
        self.assertEqual(response.status_code, 200)
        first = response.json()[0]
        self.assertGreater(first["match_score"], 50)
        self.assertTrue(first["match_reasons"])
        self.assertEqual(first["keyword_match_score"], first["match_score"])
        self.assertIsNotNone(first["profile_match_score"])
        self.assertGreater(first["profile_match_score"], 0)
        self.assertFalse(
            any(" and " in f" {reason.lower()} " for reason in first["match_reasons"])
        )

    def test_keyword_matching_ignores_stop_words_and_rewards_meaningful_terms(self) -> None:
        urop_payload = self.payload("NLP Research Reading Group and UROP Prep")
        urop_payload.update(
            {
                "category": "research",
                "summary": "Explore NLP research papers and prepare a UROP-style project proposal.",
                "description": "Students will join a guided reading group on language models, evaluation, responsible AI, and UROP research preparation.",
                "tags": ["Research", "UROP", "NLP", "AI"],
                "skills": ["literature review", "Python", "experiments"],
            }
        )
        unrelated_payload = self.payload("Campus Board Game Evening")
        unrelated_payload.update(
            {
                "category": "event",
                "summary": "A casual evening for board games and snacks.",
                "description": "Meet students over light games, food, and informal conversation.",
                "faculty": None,
                "relevant_majors": ["Open to all"],
                "tags": ["games", "social"],
                "skills": ["communication"],
            }
        )
        self.client.post(
            "/opportunities",
            headers={"Authorization": "Bearer mentor-token"},
            json=urop_payload,
        )
        self.client.post(
            "/opportunities",
            headers={"Authorization": "Bearer mentor-token"},
            json=unrelated_payload,
        )
        response = self.client.post(
            "/opportunities/recommendations",
            headers={"Authorization": "Bearer student-token"},
            json={"query": "and the for", "categories": [], "minimum_score": 0},
        )
        self.assertEqual(response.status_code, 200)
        items = response.json()
        urop = next(item for item in items if item["title"].startswith("NLP Research"))
        unrelated = next(item for item in items if item["title"].startswith("Campus Board"))
        self.assertGreater(urop["match_score"], unrelated["match_score"])
        self.assertGreater(urop["match_score"], 30)
        self.assertLess(unrelated["match_score"], 25)
        all_reasons = " ".join(urop["match_reasons"]).lower()
        self.assertNotIn(" and ", f" {all_reasons} ")
        self.assertTrue("urop" in all_reasons or "ai" in all_reasons)

    def test_ai_profile_match_exposes_breakdown(self) -> None:
        self.client.post(
            "/opportunities",
            headers={"Authorization": "Bearer mentor-token"},
            json=self.payload(),
        )
        response = self.client.post(
            "/opportunities/ai/profile-match",
            headers={"Authorization": "Bearer student-token"},
        )
        self.assertEqual(response.status_code, 200)
        first = response.json()[0]
        self.assertEqual(first["match_label"], "Complete profile match")
        self.assertIsNotNone(first["match_score_breakdown"])
        self.assertTrue(any("Measured" in reason for reason in first["match_reasons"]))

    def test_ai_goal_match_is_based_only_on_typed_goal(self) -> None:
        self.client.post(
            "/opportunities",
            headers={"Authorization": "Bearer mentor-token"},
            json=self.payload(),
        )
        response = self.client.post(
            "/opportunities/ai/goal-search",
            headers={"Authorization": "Bearer student-token"},
            json={"query": "Find applied AI product opportunities", "minimum_score": 0},
        )
        self.assertEqual(response.status_code, 200)
        first = response.json()[0]
        self.assertEqual(first["match_label"], "Goal match")
        self.assertIsNone(first["profile_match_score"])
        breakdown = first["match_score_breakdown"]
        self.assertIsNotNone(breakdown)
        self.assertEqual(breakdown["semantic"]["weight"], 100)
        self.assertEqual(breakdown["structured"]["weight"], 0)
        self.assertEqual(breakdown["faculty"]["weight"], 0)
        self.assertEqual(breakdown["completeness"]["weight"], 0)
        self.assertEqual(first["match_score"], breakdown["semantic"]["score"])

    def test_only_original_poster_can_edit_opportunity(self) -> None:
        created = self.client.post(
            "/opportunities",
            headers={"Authorization": "Bearer mentor-token"},
            json=self.payload(),
        ).json()
        blocked = self.client.patch(
            f"/opportunities/{created['id']}",
            headers={"Authorization": "Bearer student-token"},
            json=self.payload("Student takeover attempt"),
        )
        self.assertEqual(blocked.status_code, 403)

        updated_payload = self.payload("Updated AI Product Sprint")
        updated_payload["summary"] = "Updated intro summary for AI builders."
        updated = self.client.patch(
            f"/opportunities/{created['id']}",
            headers={"Authorization": "Bearer mentor-token"},
            json=updated_payload,
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["title"], "Updated AI Product Sprint")
        self.assertTrue(updated.json()["is_verified"])


if __name__ == "__main__":
    unittest.main()
