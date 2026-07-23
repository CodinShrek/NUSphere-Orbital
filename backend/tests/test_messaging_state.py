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


class MessagingStateTests(unittest.TestCase):
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
        token = authorization.removeprefix("Bearer ")
        return self.claims[token]

    @staticmethod
    def _headers(token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {token}"}

    def _start_conversation(self) -> dict:
        response = self.client.post(
            "/conversations/u_mentor", headers=self._headers("student-token")
        )
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_unread_counts_are_viewer_specific_and_mark_read(self) -> None:
        started = self._start_conversation()
        self.assertEqual(started["id"], "u_student_u_mentor")
        self.assertEqual(started["unread_count"], 1)
        self.assertIsNone(started["last_read_at"])

        mentor_list = self.client.get(
            "/conversations", headers=self._headers("mentor-token")
        )
        self.assertEqual(mentor_list.status_code, 200)
        self.assertEqual(mentor_list.json()[0]["unread_count"], 0)

        marked_read = self.client.post(
            "/conversations/u_student_u_mentor/read",
            headers=self._headers("student-token"),
        )
        self.assertEqual(marked_read.status_code, 200)
        self.assertEqual(marked_read.json()["unread_count"], 0)
        self.assertIsNotNone(marked_read.json()["last_read_at"])

        mentor_reply = self.client.post(
            "/conversations/u_student_u_mentor/messages",
            headers=self._headers("mentor-token"),
            json={"body": "Happy to help with your module planning."},
        )
        self.assertEqual(mentor_reply.status_code, 200)
        self.assertEqual(mentor_reply.json()["unread_count"], 0)

        student_list = self.client.get(
            "/conversations", headers=self._headers("student-token")
        )
        self.assertEqual(student_list.status_code, 200)
        self.assertEqual(student_list.json()[0]["unread_count"], 1)
        self.assertEqual(
            student_list.json()[0]["last_message"],
            "Happy to help with your module planning.",
        )

    def test_pin_archive_and_mute_are_per_user_controls(self) -> None:
        self._start_conversation()

        updated = self.client.patch(
            "/conversations/u_student_u_mentor/state",
            headers=self._headers("student-token"),
            json={"is_pinned": True, "is_archived": True, "is_muted": True},
        )
        self.assertEqual(updated.status_code, 200)
        self.assertTrue(updated.json()["is_pinned"])
        self.assertTrue(updated.json()["is_archived"])
        self.assertTrue(updated.json()["is_muted"])

        mentor_view = self.client.get(
            "/conversations", headers=self._headers("mentor-token")
        )
        self.assertEqual(mentor_view.status_code, 200)
        self.assertFalse(mentor_view.json()[0]["is_pinned"])
        self.assertFalse(mentor_view.json()[0]["is_archived"])
        self.assertFalse(mentor_view.json()[0]["is_muted"])

        mentor_reply = self.client.post(
            "/conversations/u_student_u_mentor/messages",
            headers=self._headers("mentor-token"),
            json={"body": "Bringing this back to your inbox."},
        )
        self.assertEqual(mentor_reply.status_code, 200)
        student_view = self.client.get(
            "/conversations", headers=self._headers("student-token")
        )
        self.assertFalse(student_view.json()[0]["is_archived"])

    def test_outsider_cannot_read_update_or_send_to_conversation(self) -> None:
        self._start_conversation()

        mark_read = self.client.post(
            "/conversations/u_student_u_mentor/read",
            headers=self._headers("other-token"),
        )
        update_state = self.client.patch(
            "/conversations/u_student_u_mentor/state",
            headers=self._headers("other-token"),
            json={"is_pinned": True},
        )
        send = self.client.post(
            "/conversations/u_student_u_mentor/messages",
            headers=self._headers("other-token"),
            json={"body": "I should not be here."},
        )

        self.assertEqual(mark_read.status_code, 403)
        self.assertEqual(update_state.status_code, 403)
        self.assertEqual(send.status_code, 403)


if __name__ == "__main__":
    unittest.main()
