from __future__ import annotations

import json
import os
import unittest
import urllib.error
from unittest.mock import Mock, patch

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.ai_matching import (
    EmbeddingProviderError,
    MatchingConfigurationError,
    MatchWeights,
    cosine_similarity,
    embed_text,
    match_explanation,
    matching_weights,
    openai_embedding,
    structured_overlap,
    weighted_match_score,
)
from app.database import Base
from app.main import ai_ranked_mentors, ensure_profile_embedding
from app.models import ProfileEmbeddingRecord, UserRecord


class FakeEmbeddingResponse:
    def __init__(self, vector: list[float]) -> None:
        self.payload = json.dumps(
            {"data": [{"embedding": vector}], "model": "text-embedding-3-small"}
        ).encode("utf-8")

    def __enter__(self) -> FakeEmbeddingResponse:
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def read(self) -> bytes:
        return self.payload


def make_user(user_id: str, role: str, **updates: object) -> UserRecord:
    values: dict[str, object] = {
        "id": user_id,
        "email": f"{user_id}@example.com",
        "role": role,
        "name": user_id.replace("_", " ").title(),
        "faculty": "Computing",
        "major": "Computer Science",
        "modules_taken": [],
        "ccas": [],
        "nus_opportunities": [],
        "exchange_universities": [],
        "accommodation": "Off-campus accommodation",
        "interests": [],
        "goals": [],
        "bio": "",
        "modules_taught": [],
        "areas_of_expertise": [],
    }
    values.update(updates)
    return UserRecord(**values)


class OpenAIEmbeddingTests(unittest.TestCase):
    @patch.dict(
        os.environ,
        {
            "OPENAI_API_KEY": "test-key",
            "OPENAI_EMBEDDING_MODEL": "text-embedding-3-small",
            "OPENAI_EMBEDDING_DIMENSIONS": "4",
        },
        clear=True,
    )
    @patch("app.ai_matching.urllib.request.urlopen")
    def test_openai_embedding_uses_configured_api_contract(self, urlopen: Mock) -> None:
        urlopen.return_value = FakeEmbeddingResponse([1.0, 2.0, 3.0, 4.0])

        vector = openai_embedding("NUS mentoring goals")

        self.assertIsNotNone(vector)
        self.assertEqual(len(vector or []), 4)
        request = urlopen.call_args.args[0]
        payload = json.loads(request.data.decode("utf-8"))
        self.assertEqual(payload["model"], "text-embedding-3-small")
        self.assertEqual(payload["dimensions"], 4)
        self.assertEqual(payload["encoding_format"], "float")
        self.assertEqual(request.headers["Authorization"], "Bearer test-key")

    @patch.dict(
        os.environ,
        {
            "OPENAI_API_KEY": "test-key",
            "OPENAI_EMBEDDING_MODEL": "text-embedding-3-small",
            "OPENAI_EMBEDDING_DIMENSIONS": "8",
            "OPENAI_EMBEDDING_FALLBACK_ON_ERROR": "true",
        },
        clear=True,
    )
    @patch(
        "app.ai_matching.urllib.request.urlopen",
        side_effect=urllib.error.URLError("offline"),
    )
    def test_provider_error_has_explicit_local_fallback(self, _urlopen: Mock) -> None:
        vector, model = embed_text("fallback remains deterministic")

        self.assertEqual(len(vector), 8)
        self.assertEqual(model, "local-hashing-v2:8")

    @patch.dict(
        os.environ,
        {
            "OPENAI_API_KEY": "test-key",
            "OPENAI_EMBEDDING_MODEL": "text-embedding-3-small",
            "OPENAI_EMBEDDING_DIMENSIONS": "8",
            "OPENAI_EMBEDDING_FALLBACK_ON_ERROR": "false",
        },
        clear=True,
    )
    @patch(
        "app.ai_matching.urllib.request.urlopen",
        side_effect=urllib.error.URLError("offline"),
    )
    def test_provider_error_can_be_made_strict(self, _urlopen: Mock) -> None:
        with self.assertRaises(EmbeddingProviderError):
            embed_text("provider must be available")

    @patch.dict(
        os.environ,
        {
            "OPENAI_EMBEDDING_MODEL": "text-embedding-3-small",
            "OPENAI_EMBEDDING_DIMENSIONS": "12",
        },
        clear=True,
    )
    def test_no_api_key_uses_local_embedding(self) -> None:
        first, first_model = embed_text("same profile")
        second, second_model = embed_text("same profile")

        self.assertEqual(first, second)
        self.assertEqual(first_model, "local-hashing-v2:12")
        self.assertEqual(second_model, first_model)


class ConfigurableScoringTests(unittest.TestCase):
    @patch.dict(
        os.environ,
        {
            "MATCH_WEIGHT_SEMANTIC": "0.40",
            "MATCH_WEIGHT_STRUCTURED": "0.30",
            "MATCH_WEIGHT_FACULTY": "0.20",
            "MATCH_WEIGHT_COMPLETENESS": "0.10",
        },
        clear=True,
    )
    def test_configured_weights_are_used(self) -> None:
        weights = matching_weights()
        score = weighted_match_score(
            semantic=0.8,
            structured=0.5,
            faculty=1.0,
            completeness=0.6,
            weights=weights,
        )

        self.assertEqual(weights, MatchWeights(0.4, 0.3, 0.2, 0.1))
        self.assertAlmostEqual(score, 0.73)

    @patch.dict(
        os.environ,
        {
            "MATCH_WEIGHT_SEMANTIC": "0.70",
            "MATCH_WEIGHT_STRUCTURED": "0.40",
            "MATCH_WEIGHT_FACULTY": "0.10",
            "MATCH_WEIGHT_COMPLETENESS": "0.05",
        },
        clear=True,
    )
    def test_weights_must_add_up_to_one(self) -> None:
        with self.assertRaises(MatchingConfigurationError):
            matching_weights()

    def test_cosine_similarity_rejects_mismatched_dimensions(self) -> None:
        self.assertEqual(cosine_similarity([1.0, 0.0], [1.0]), 0.0)

    def test_structured_overlap_rewards_documented_shared_signals(self) -> None:
        student = make_user(
            "u_student",
            "student",
            interests=["Artificial Intelligence"],
            modules_taken=["CS3244"],
            nus_opportunities=["NOC"],
            goals=["Build a machine learning startup"],
        )
        aligned = make_user(
            "u_aligned",
            "mentor",
            interests=["Artificial Intelligence"],
            modules_taught=["CS3244"],
            nus_opportunities=["NOC"],
            areas_of_expertise=["Machine learning"],
            bio="Founded a machine learning startup after NOC.",
        )
        unrelated = make_user(
            "u_unrelated",
            "mentor",
            faculty="Arts and Social Sciences",
            major="History",
            interests=["Museum studies"],
            modules_taught=["HY1101E"],
            bio="Researches cultural heritage.",
        )

        self.assertGreater(
            structured_overlap(student, aligned),
            structured_overlap(student, unrelated),
        )

    def test_explanations_only_claim_observable_evidence(self) -> None:
        student = make_user(
            "u_student",
            "student",
            faculty="Computing",
            interests=["Artificial Intelligence"],
            modules_taken=["CS3244"],
            goals=["Build a startup"],
        )
        mentor = make_user(
            "u_mentor",
            "mentor",
            faculty="Computing",
            interests=["Artificial Intelligence"],
            modules_taught=["CS3244"],
            areas_of_expertise=["Startup strategy"],
            bio="Built an AI startup and mentors new founders.",
        )

        reasons = match_explanation(
            student,
            mentor,
            "goal",
            semantic=0.82,
            overlap=0.64,
            query="I want startup guidance",
        )

        self.assertIn("Shared interest: Artificial Intelligence", reasons)
        self.assertIn("Relevant shared module: CS3244", reasons)
        self.assertTrue(any("startup" in reason.lower() for reason in reasons))
        self.assertTrue(any("82%" in reason and "64%" in reason for reason in reasons))


class EmbeddingCacheTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)

    def tearDown(self) -> None:
        self.engine.dispose()

    @patch("app.main.expected_embedding_model", return_value="text-embedding-3-small:4")
    @patch("app.main.upsert_profile_embedding")
    def test_stale_local_cache_is_refreshed_for_openai(
        self, upsert: Mock, _expected_model: Mock
    ) -> None:
        with Session(self.engine) as db:
            user = make_user("u_student", "student")
            stale = ProfileEmbeddingRecord(
                id="u_student_profile",
                user_id=user.id,
                role=user.role,
                embedding_type="profile",
                model="local-hashing-v1",
                source_text="old source",
                embedding=[1.0, 0.0],
            )
            db.add_all([user, stale])
            db.commit()
            upsert.return_value = stale

            result = ensure_profile_embedding(user, db)

            self.assertIs(result, stale)
            upsert.assert_called_once_with(user, db)


class MatchResponseMetadataTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)

    def tearDown(self) -> None:
        self.engine.dispose()

    @patch.dict(
        os.environ,
        {
            "OPENAI_EMBEDDING_MODEL": "text-embedding-3-small",
            "OPENAI_EMBEDDING_DIMENSIONS": "12",
        },
        clear=True,
    )
    def test_ai_results_expose_breakdown_and_fallback_metadata(self) -> None:
        with Session(self.engine) as db:
            student = make_user(
                "u_student",
                "student",
                interests=["Artificial Intelligence"],
                goals=["Build a startup"],
            )
            mentor = make_user(
                "u_mentor",
                "mentor",
                mentor_type="alumni",
                interests=["Artificial Intelligence"],
                areas_of_expertise=["Startup strategy"],
                bio="Built an AI startup and mentors founders.",
            )
            db.add_all([student, mentor])
            db.commit()
            query_embedding, query_model = embed_text("Find an AI startup mentor")

            result = ai_ranked_mentors(
                student,
                query_embedding,
                db,
                mode="goal",
                query_model=query_model,
                query_text="Find an AI startup mentor",
            )

            self.assertEqual(len(result), 1)
            match = result[0]
            self.assertEqual(match.embedding_provider, "local")
            self.assertTrue(match.embedding_fallback)
            self.assertEqual(match.embedding_model, "local-hashing-v2:12")
            self.assertIsNotNone(match.match_score_breakdown)
            breakdown = match.match_score_breakdown
            assert breakdown is not None
            self.assertEqual(breakdown.total, match.match_score)
            self.assertEqual(breakdown.semantic.weight, 55)
            self.assertEqual(breakdown.structured.weight, 25)
            self.assertEqual(breakdown.faculty.weight, 10)
            self.assertEqual(breakdown.completeness.weight, 10)


if __name__ == "__main__":
    unittest.main()
