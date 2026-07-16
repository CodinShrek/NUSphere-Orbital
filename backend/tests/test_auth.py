from __future__ import annotations

import os
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import Mock, patch

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException

from app.auth import extract_bearer_token, verify_supabase_token


class SupabaseTokenTests(unittest.TestCase):
    def setUp(self) -> None:
        self.private_key = rsa.generate_private_key(
            public_exponent=65537, key_size=2048
        )
        self.issuer = "https://example.supabase.co/auth/v1"

    def make_token(self, *, expires_in: timedelta = timedelta(minutes=5)) -> str:
        now = datetime.now(timezone.utc)
        return jwt.encode(
            {
                "sub": "00000000-0000-0000-0000-000000000123",
                "email": "Student@Example.com",
                "aud": "authenticated",
                "iss": self.issuer,
                "iat": now,
                "exp": now + expires_in,
            },
            self.private_key,
            algorithm="RS256",
            headers={"kid": "test-key"},
        )

    @patch.dict(
        os.environ,
        {
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_JWT_AUDIENCE": "authenticated",
        },
    )
    @patch("app.auth.get_jwks_client")
    def test_valid_token_returns_normalised_claims(self, get_client: Mock) -> None:
        get_client.return_value.get_signing_key_from_jwt.return_value = SimpleNamespace(
            key=self.private_key.public_key()
        )

        claims = verify_supabase_token(self.make_token())

        self.assertEqual(claims.user_id, "00000000-0000-0000-0000-000000000123")
        self.assertEqual(claims.email, "student@example.com")
        get_client.assert_called_once_with(f"{self.issuer}/.well-known/jwks.json")

    @patch.dict(os.environ, {"SUPABASE_URL": "https://example.supabase.co"})
    @patch("app.auth.get_jwks_client")
    def test_expired_token_is_rejected(self, get_client: Mock) -> None:
        get_client.return_value.get_signing_key_from_jwt.return_value = SimpleNamespace(
            key=self.private_key.public_key()
        )

        with self.assertRaises(HTTPException) as raised:
            verify_supabase_token(self.make_token(expires_in=timedelta(minutes=-1)))

        self.assertEqual(raised.exception.status_code, 401)
        self.assertEqual(raised.exception.detail, "Auth token has expired")

    def test_bearer_header_is_required(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            extract_bearer_token("Basic abc")
        self.assertEqual(raised.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()
