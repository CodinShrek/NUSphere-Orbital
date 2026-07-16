from __future__ import annotations

import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import SupabaseClaims
from app.database import Base, get_db
from app.main import app
from app.models import UserRecord


class ProfileSyncTests(unittest.TestCase):
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
        self.claims = SupabaseClaims(
            user_id="00000000-0000-0000-0000-000000000456",
            email="student@example.com",
        )

    def tearDown(self) -> None:
        app.dependency_overrides.clear()
        self.engine.dispose()

    @patch("app.main.claims_from_authorization")
    def test_profile_sync_is_idempotent(self, get_claims) -> None:
        get_claims.return_value = self.claims

        created = self.client.put(
            "/auth/profile",
            headers={"Authorization": "Bearer valid-token"},
            json={"role": "student", "name": "First Name"},
        )
        updated = self.client.put(
            "/auth/profile",
            headers={"Authorization": "Bearer valid-token"},
            json={
                "role": "student",
                "name": "Updated Name",
                "goals": ["Find a mentor"],
            },
        )

        self.assertEqual(created.status_code, 200)
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(created.json()["id"], updated.json()["id"])
        self.assertEqual(updated.json()["name"], "Updated Name")
        with Session(self.engine) as db:
            self.assertEqual(db.scalar(select(func.count()).select_from(UserRecord)), 1)
            user = db.scalar(select(UserRecord))
            self.assertEqual(user.supabase_user_id, self.claims.user_id)
            self.assertIsNone(user.password_hash)

    @patch("app.main.claims_from_authorization")
    def test_verified_email_links_existing_legacy_profile(self, get_claims) -> None:
        get_claims.return_value = self.claims
        with Session(self.engine) as db:
            db.add(
                UserRecord(
                    id="u_legacy",
                    email=self.claims.email,
                    password_hash="old-local-hash",
                    role="student",
                    name="Legacy Name",
                )
            )
            db.commit()

        response = self.client.put(
            "/auth/profile",
            headers={"Authorization": "Bearer valid-token"},
            json={"role": "student", "name": "Synced Name"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], "u_legacy")
        with Session(self.engine) as db:
            user = db.get(UserRecord, "u_legacy")
            self.assertEqual(user.supabase_user_id, self.claims.user_id)
            self.assertIsNone(user.password_hash)

    @patch("app.main.claims_from_authorization")
    def test_existing_profile_role_cannot_be_changed(self, get_claims) -> None:
        get_claims.return_value = self.claims
        self.client.put(
            "/auth/profile",
            headers={"Authorization": "Bearer valid-token"},
            json={"role": "student", "name": "Student"},
        )

        response = self.client.put(
            "/auth/profile",
            headers={"Authorization": "Bearer valid-token"},
            json={"role": "mentor", "name": "Student"},
        )

        self.assertEqual(response.status_code, 409)
        self.assertIn("role cannot be changed", response.json()["detail"])


if __name__ == "__main__":
    unittest.main()
