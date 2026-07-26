from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
import logging
import json
from typing import Any

import jwt
from fastapi import HTTPException
from jwt import PyJWKClient
from jwt.exceptions import ExpiredSignatureError, PyJWTError

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SupabaseClaims:
    user_id: str
    email: str


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=401,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise _unauthorized("Missing auth token")

    scheme, separator, token = authorization.partition(" ")
    if not separator or scheme.lower() != "bearer" or not token.strip():
        raise _unauthorized("Invalid Authorization header")
    return token.strip()


@lru_cache(maxsize=4)
def get_jwks_client(jwks_url: str) -> PyJWKClient:
    return PyJWKClient(jwks_url, cache_keys=True)


def local_jwks_path() -> str:
    return os.getenv("SUPABASE_JWKS_FILE", ".supabase-jwks.json").strip()


def signing_key_from_local_jwks(token: str) -> Any | None:
    path = local_jwks_path()
    if not path or not os.path.exists(path):
        return None

    header = jwt.get_unverified_header(token)
    key_id = header.get("kid")
    with open(path, encoding="utf-8") as file:
        jwks = json.load(file)
    for key in jwks.get("keys", []):
        if key_id and key.get("kid") != key_id:
            continue
        return jwt.PyJWK.from_dict(key).key
    return None


def verify_supabase_token(token: str) -> SupabaseClaims:
    supabase_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    if not supabase_url:
        raise HTTPException(
            status_code=503, detail="Supabase authentication is not configured"
        )

    issuer = f"{supabase_url}/auth/v1"
    audience = (
        os.getenv("SUPABASE_JWT_AUDIENCE", "authenticated").strip() or "authenticated"
    )

    try:
        signing_key = signing_key_from_local_jwks(token)
        if signing_key is None:
            signing_key = get_jwks_client(
                f"{issuer}/.well-known/jwks.json"
            ).get_signing_key_from_jwt(token).key
        payload: dict[str, Any] = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256", "ES256"],
            audience=audience,
            issuer=issuer,
            options={"require": ["exp", "iat", "sub", "aud"]},
        )
    except ExpiredSignatureError as exc:
        raise _unauthorized("Auth token has expired") from exc
    except PyJWTError as exc:
        logger.warning("Supabase JWT validation failed: %s", exc)
        raise _unauthorized("Invalid auth token") from exc
    except Exception as exc:
        # PyJWKClient raises several non-PyJWT network/key lookup exceptions.
        logger.warning("Supabase JWKS validation failed: %s", exc)
        raise _unauthorized("Unable to validate auth token") from exc

    user_id = payload.get("sub")
    email = payload.get("email")
    if not isinstance(user_id, str) or not user_id.strip():
        raise _unauthorized("Auth token is missing a user identifier")
    if not isinstance(email, str) or not email.strip():
        raise _unauthorized("Auth token is missing a verified email")

    return SupabaseClaims(user_id=user_id, email=email.strip().lower())


def claims_from_authorization(authorization: str | None) -> SupabaseClaims:
    return verify_supabase_token(extract_bearer_token(authorization))
