from __future__ import annotations

import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.readiness import alembic_head_revision


class ReadinessTests(unittest.TestCase):
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

    def tearDown(self) -> None:
        app.dependency_overrides.clear()
        self.engine.dispose()

    def stamp_database(self) -> None:
        head = alembic_head_revision()
        assert head is not None
        with self.engine.begin() as connection:
            connection.execute(
                text("create table alembic_version (version_num varchar(32) not null)")
            )
            connection.execute(
                text("insert into alembic_version (version_num) values (:head)"),
                {"head": head},
            )

    @patch.dict(
        os.environ,
        {
            "FRONTEND_ORIGINS": "https://nusphere.example",
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_JWT_AUDIENCE": "authenticated",
            "OPENAI_API_KEY": "",
        },
    )
    def test_readiness_reports_ready_when_database_and_config_are_ready(self) -> None:
        self.stamp_database()

        response = self.client.get("/readiness")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "ready")
        self.assertTrue(payload["checks"]["database"]["ok"])
        self.assertTrue(payload["checks"]["migrations"]["ok"])
        self.assertTrue(payload["checks"]["supabase_auth"]["ok"])
        self.assertTrue(payload["checks"]["cors"]["ok"])

    @patch.dict(os.environ, {"FRONTEND_ORIGINS": "", "SUPABASE_URL": ""})
    def test_readiness_reports_missing_deployment_config(self) -> None:
        response = self.client.get("/readiness")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "not_ready")
        self.assertFalse(payload["checks"]["migrations"]["ok"])
        self.assertFalse(payload["checks"]["supabase_auth"]["ok"])
        self.assertFalse(payload["checks"]["cors"]["ok"])


if __name__ == "__main__":
    unittest.main()
