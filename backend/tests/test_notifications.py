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


class NotificationTests(unittest.TestCase):
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
            "other-token": SupabaseClaims(
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
                        supabase_user_id=self.claims["other-token"].user_id,
                        role="student",
                        name="Other Student",
                    ),
                    UserRecord(
                        id="u_mentor",
                        email="mentor@example.com",
                        supabase_user_id=self.claims["mentor-token"].user_id,
                        role="mentor",
                        name="Mentor One",
                        mentor_type="senior",
                    ),
                    ConnectionRecord(
                        id="u_student_u_mentor",
                        student_id="u_student",
                        student_name="Student One",
                        mentor_id="u_mentor",
                        mentor_name="Mentor One",
                        mentor_programme="Computer Science",
                        status="accepted",
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

    def _start_conversation(self) -> None:
        response = self.client.post(
            "/conversations/u_mentor", headers=self._headers("student-token")
        )
        self.assertEqual(response.status_code, 200)

    def _create_question(self) -> dict:
        response = self.client.post(
            "/qa/questions",
            headers=self._headers("student-token"),
            json={
                "title": "How should I choose modules for NOC?",
                "topic": "NOC planning",
                "body": "I want advice on module planning before applying for NOC next year.",
                "tags": ["NOC", "modules"],
                "attachments": [],
            },
        )
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_message_notifications_can_be_read_and_counted(self) -> None:
        self._start_conversation()
        sent = self.client.post(
            "/conversations/u_student_u_mentor/messages",
            headers=self._headers("mentor-token"),
            json={"body": "Here is a practical next step for your module plan."},
        )
        self.assertEqual(sent.status_code, 200)

        count = self.client.get(
            "/notifications/unread-count", headers=self._headers("student-token")
        )
        notifications = self.client.get(
            "/notifications", headers=self._headers("student-token")
        )

        self.assertEqual(count.status_code, 200)
        self.assertEqual(count.json()["unread_count"], 1)
        self.assertEqual(notifications.status_code, 200)
        self.assertEqual(notifications.json()[0]["type"], "message")
        self.assertEqual(notifications.json()[0]["target_type"], "conversation")
        self.assertEqual(notifications.json()[0]["target_id"], "u_student_u_mentor")

        marked = self.client.post(
            f"/notifications/{notifications.json()[0]['id']}/read",
            headers=self._headers("student-token"),
        )
        self.assertEqual(marked.status_code, 200)
        self.assertTrue(marked.json()["is_read"])
        self.assertIsNotNone(marked.json()["read_at"])

        empty_count = self.client.get(
            "/notifications/unread-count", headers=self._headers("student-token")
        )
        self.assertEqual(empty_count.json()["unread_count"], 0)

    def test_qa_notifications_flow_to_mentors_and_question_owner(self) -> None:
        question = self._create_question()
        mentor_notifications = self.client.get(
            "/notifications", headers=self._headers("mentor-token")
        )
        self.assertEqual(mentor_notifications.status_code, 200)
        self.assertEqual(mentor_notifications.json()[0]["type"], "question_created")
        self.assertEqual(mentor_notifications.json()[0]["target_id"], question["id"])

        answer = self.client.post(
            f"/qa/questions/{question['id']}/answers",
            headers=self._headers("mentor-token"),
            json={
                "body": "Choose modules that keep your workload balanced while still showing startup curiosity."
            },
        )
        self.assertEqual(answer.status_code, 200)
        student_notifications = self.client.get(
            "/notifications", headers=self._headers("student-token")
        )
        self.assertEqual(student_notifications.json()[0]["type"], "answer_created")
        self.assertEqual(student_notifications.json()[0]["target_id"], question["id"])

    def test_mark_all_read_is_scoped_to_current_user(self) -> None:
        self._create_question()
        self._start_conversation()
        self.client.post(
            "/conversations/u_student_u_mentor/messages",
            headers=self._headers("mentor-token"),
            json={"body": "A student notification."},
        )

        mentor_before = self.client.get(
            "/notifications/unread-count", headers=self._headers("mentor-token")
        )
        student_before = self.client.get(
            "/notifications/unread-count", headers=self._headers("student-token")
        )
        self.assertEqual(mentor_before.json()["unread_count"], 1)
        self.assertEqual(student_before.json()["unread_count"], 1)

        response = self.client.post(
            "/notifications/read-all", headers=self._headers("student-token")
        )
        mentor_after = self.client.get(
            "/notifications/unread-count", headers=self._headers("mentor-token")
        )
        student_after = self.client.get(
            "/notifications/unread-count", headers=self._headers("student-token")
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["unread_count"], 0)
        self.assertEqual(student_after.json()["unread_count"], 0)
        self.assertEqual(mentor_after.json()["unread_count"], 1)

    def test_notification_ownership_and_muted_conversations_are_enforced(self) -> None:
        self._start_conversation()
        self.client.post(
            "/conversations/u_student_u_mentor/messages",
            headers=self._headers("mentor-token"),
            json={"body": "First message creates a notification."},
        )
        notification = self.client.get(
            "/notifications", headers=self._headers("student-token")
        ).json()[0]

        forbidden = self.client.post(
            f"/notifications/{notification['id']}/read",
            headers=self._headers("other-token"),
        )
        self.assertEqual(forbidden.status_code, 403)

        self.client.patch(
            "/conversations/u_student_u_mentor/state",
            headers=self._headers("student-token"),
            json={"is_muted": True},
        )
        self.client.post(
            "/notifications/read-all", headers=self._headers("student-token")
        )
        self.client.post(
            "/conversations/u_student_u_mentor/messages",
            headers=self._headers("mentor-token"),
            json={"body": "Muted follow-up should not notify."},
        )
        muted_count = self.client.get(
            "/notifications/unread-count", headers=self._headers("student-token")
        )

        self.assertEqual(muted_count.json()["unread_count"], 0)


if __name__ == "__main__":
    unittest.main()
