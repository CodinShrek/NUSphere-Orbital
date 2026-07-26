from __future__ import annotations

import hashlib
import json
import logging
import math
import os
import re
import urllib.error
import urllib.request
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

from .models import UserRecord


load_dotenv(Path(__file__).resolve().parents[1] / ".env")

logger = logging.getLogger(__name__)

DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small"
DEFAULT_EMBEDDING_DIMENSIONS = 256
SUPPORTED_EMBEDDING_MODELS = {
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
}
MEANINGFUL_TOKEN_PATTERN = re.compile(r"[a-zA-Z0-9+#.]+")
STOP_WORDS = {
    "about",
    "after",
    "also",
    "and",
    "are",
    "for",
    "from",
    "guidance",
    "have",
    "help",
    "into",
    "module",
    "modules",
    "mentor",
    "mentors",
    "mentoring",
    "mentorship",
    "need",
    "needed",
    "opportunity",
    "opportunities",
    "profile",
    "profiles",
    "student",
    "students",
    "that",
    "the",
    "their",
    "this",
    "want",
    "with",
    "would",
}


class EmbeddingConfigurationError(ValueError):
    """Raised when the embedding environment configuration is invalid."""


class EmbeddingProviderError(RuntimeError):
    """Raised when a configured remote embedding provider cannot be used."""


class MatchingConfigurationError(ValueError):
    """Raised when configured scoring weights are invalid."""


@dataclass(frozen=True)
class MatchWeights:
    semantic: float
    structured: float
    faculty: float
    completeness: float


def _environment_float(name: str, default: float) -> float:
    raw_value = os.getenv(name)
    if raw_value is None or not raw_value.strip():
        return default
    try:
        value = float(raw_value)
    except ValueError as exc:
        raise MatchingConfigurationError(f"{name} must be a number") from exc
    if not math.isfinite(value) or value < 0:
        raise MatchingConfigurationError(
            f"{name} must be a finite, non-negative number"
        )
    return value


def matching_weights() -> MatchWeights:
    weights = MatchWeights(
        semantic=_environment_float("MATCH_WEIGHT_SEMANTIC", 0.55),
        structured=_environment_float("MATCH_WEIGHT_STRUCTURED", 0.25),
        faculty=_environment_float("MATCH_WEIGHT_FACULTY", 0.10),
        completeness=_environment_float("MATCH_WEIGHT_COMPLETENESS", 0.10),
    )
    total = sum(
        [
            weights.semantic,
            weights.structured,
            weights.faculty,
            weights.completeness,
        ]
    )
    if not math.isclose(total, 1.0, abs_tol=0.001):
        raise MatchingConfigurationError(
            "MATCH_WEIGHT_* values must add up to 1.0 "
            f"(configured total: {total:.3f})"
        )
    return weights


def _bounded(value: float) -> float:
    return max(0.0, min(1.0, value))


def weighted_match_score(
    *,
    semantic: float,
    structured: float,
    faculty: float,
    completeness: float,
    weights: MatchWeights | None = None,
) -> float:
    selected_weights = weights or matching_weights()
    return _bounded(
        _bounded(semantic) * selected_weights.semantic
        + _bounded(structured) * selected_weights.structured
        + _bounded(faculty) * selected_weights.faculty
        + _bounded(completeness) * selected_weights.completeness
    )


def embedding_model() -> str:
    model = os.getenv("OPENAI_EMBEDDING_MODEL", DEFAULT_EMBEDDING_MODEL).strip()
    if model not in SUPPORTED_EMBEDDING_MODELS:
        supported = ", ".join(sorted(SUPPORTED_EMBEDDING_MODELS))
        raise EmbeddingConfigurationError(
            f"OPENAI_EMBEDDING_MODEL must be one of: {supported}"
        )
    return model


def embedding_dimensions(model: str | None = None) -> int:
    selected_model = model or embedding_model()
    raw_value = os.getenv(
        "OPENAI_EMBEDDING_DIMENSIONS", str(DEFAULT_EMBEDDING_DIMENSIONS)
    )
    try:
        dimensions = int(raw_value)
    except ValueError as exc:
        raise EmbeddingConfigurationError(
            "OPENAI_EMBEDDING_DIMENSIONS must be an integer"
        ) from exc
    maximum = SUPPORTED_EMBEDDING_MODELS[selected_model]
    if dimensions < 1 or dimensions > maximum:
        raise EmbeddingConfigurationError(
            f"OPENAI_EMBEDDING_DIMENSIONS must be between 1 and {maximum} "
            f"for {selected_model}"
        )
    return dimensions


def _environment_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def expected_embedding_model() -> str:
    dimensions = embedding_dimensions()
    if os.getenv("OPENAI_API_KEY", "").strip():
        return f"{embedding_model()}:{dimensions}"
    return f"local-hashing-v2:{dimensions}"


def user_profile_text(user: UserRecord, *, perspective: str) -> str:
    role_label = "mentor" if user.role == "mentor" else "student"
    sections = [
        f"Profile type: {role_label}",
        f"Perspective: {perspective}",
        f"Name: {user.name}",
        f"Faculty: {user.faculty}",
        f"Department: {user.department or ''}",
        f"Major or programme: {user.major}",
        f"Mentor type: {user.mentor_type or ''}",
        f"Modules taken: {', '.join(user.modules_taken or [])}",
        f"Modules taught: {', '.join(user.modules_taught or [])}",
        f"CCAs and organisations: {', '.join(user.ccas or [])}",
        f"NUS opportunities: {', '.join(user.nus_opportunities or [])}",
        f"Exchange universities: {', '.join(user.exchange_universities or [])}",
        f"Accommodation: {user.accommodation}",
        f"Interests: {', '.join(user.interests or [])}",
        f"Goals: {', '.join(user.goals or [])}",
        f"Bio: {user.bio or ''}",
        f"Mentorship goals: {user.mentorship_goals or ''}",
        f"Current role: {user.current_role or ''}",
        f"Organisation: {user.organisation or ''}",
        f"Areas of expertise: {', '.join(user.areas_of_expertise or [])}",
        f"Office or unit: {user.office or ''}",
    ]
    return "\n".join(item for item in sections if item.strip())


def goal_search_text(student: UserRecord, query: str) -> str:
    return query.strip()


def local_embedding(text: str, dimensions: int | None = None) -> list[float]:
    vector_dimensions = dimensions or embedding_dimensions()
    tokens = MEANINGFUL_TOKEN_PATTERN.findall(text.lower())
    counts: Counter[int] = Counter()
    for token in tokens:
        if len(token) < 3:
            continue
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "big") % vector_dimensions
        sign = 1 if digest[4] % 2 == 0 else -1
        counts[index] += sign

    vector = [0.0] * vector_dimensions
    for index, count in counts.items():
        vector[index] = float(count)
    return normalise(vector)


def openai_embedding(text: str) -> list[float] | None:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None

    selected_model = embedding_model()
    dimensions = embedding_dimensions(selected_model)
    cleaned_text = text.replace("\x00", " ").strip()
    if not cleaned_text:
        raise EmbeddingProviderError("Embedding input cannot be empty")
    payload = json.dumps(
        {
            "model": selected_model,
            "input": cleaned_text,
            "encoding_format": "float",
            "dimensions": dimensions,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        "https://api.openai.com/v1/embeddings",
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "NUSphere/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            data = json.loads(response.read().decode("utf-8"))
        vector = data["data"][0]["embedding"]
        if not isinstance(vector, list) or len(vector) != dimensions:
            raise EmbeddingProviderError(
                "OpenAI returned an embedding with an unexpected size"
            )
        return normalise([float(value) for value in vector])
    except urllib.error.HTTPError as exc:
        raise EmbeddingProviderError(
            f"OpenAI embeddings request failed with HTTP {exc.code}"
        ) from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise EmbeddingProviderError(
            "OpenAI embeddings request could not reach the provider"
        ) from exc
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise EmbeddingProviderError(
            "OpenAI returned an invalid embeddings response"
        ) from exc


def embed_text(text: str) -> tuple[list[float], str]:
    try:
        remote = openai_embedding(text)
    except EmbeddingProviderError as exc:
        if not _environment_flag("OPENAI_EMBEDDING_FALLBACK_ON_ERROR", default=True):
            raise
        logger.warning(
            "OpenAI embeddings failed; using configured local fallback: %s", exc
        )
        remote = None
    if remote is not None:
        return remote, expected_embedding_model()
    dimensions = embedding_dimensions()
    return local_embedding(text, dimensions), f"local-hashing-v2:{dimensions}"


def normalise(vector: list[float]) -> list[float]:
    magnitude = math.sqrt(sum(value * value for value in vector))
    if magnitude == 0:
        return vector
    return [value / magnitude for value in vector]


def cosine_similarity(first: list[float], second: list[float]) -> float:
    if not first or not second or len(first) != len(second):
        return 0.0
    return _bounded(sum(left * right for left, right in zip(first, second)))


def _normalised_value(value: str) -> str:
    return " ".join(MEANINGFUL_TOKEN_PATTERN.findall(value.lower()))


def _shared_values(left_items: list[str], right_items: list[str]) -> list[str]:
    right_lookup = {
        _normalised_value(item) for item in right_items if _normalised_value(item)
    }
    return [
        item
        for item in left_items
        if _normalised_value(item) and _normalised_value(item) in right_lookup
    ]


def _meaningful_tokens(*values: str) -> set[str]:
    return {
        token
        for value in values
        for token in MEANINGFUL_TOKEN_PATTERN.findall(value.lower())
        if len(token) >= 3 and token not in STOP_WORDS
    }


def _set_similarity(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0
    return len(left & right) / len(left | right)


def structured_overlap(student: UserRecord, mentor: UserRecord) -> float:
    score = 0.0
    available_weight = 0.0

    scalar_checks = [
        (student.major, mentor.major, 0.15),
        (student.department or "", mentor.department or "", 0.10),
    ]
    for left, right, weight in scalar_checks:
        if left and right:
            available_weight += weight
            if _normalised_value(left) == _normalised_value(right):
                score += weight

    list_checks = [
        (
            student.interests or [],
            (mentor.interests or []) + (mentor.areas_of_expertise or []),
            0.25,
        ),
        (
            student.modules_taken or [],
            (mentor.modules_taken or []) + (mentor.modules_taught or []),
            0.20,
        ),
        (
            student.nus_opportunities or [],
            mentor.nus_opportunities or [],
            0.10,
        ),
        (student.ccas or [], mentor.ccas or [], 0.05),
        (
            student.exchange_universities or [],
            mentor.exchange_universities or [],
            0.05,
        ),
    ]
    for left_items, right_items, weight in list_checks:
        left = {_normalised_value(item) for item in left_items if item}
        right = {_normalised_value(item) for item in right_items if item}
        if left and right:
            available_weight += weight
            score += weight * _set_similarity(left, right)

    student_goal_tokens = _meaningful_tokens(*(student.goals or []), student.bio or "")
    mentor_guidance_tokens = _meaningful_tokens(
        *(mentor.goals or []),
        *(mentor.areas_of_expertise or []),
        mentor.mentorship_goals or "",
        mentor.bio or "",
    )
    if student_goal_tokens and mentor_guidance_tokens:
        goal_weight = 0.15
        available_weight += goal_weight
        score += goal_weight * _set_similarity(
            student_goal_tokens, mentor_guidance_tokens
        )

    return _bounded(score / available_weight) if available_weight else 0.0


def profile_completeness(user: UserRecord) -> float:
    fields = [
        user.faculty,
        user.major,
        user.bio,
        user.interests,
        user.goals,
        user.modules_taken,
        user.ccas,
        user.nus_opportunities,
        user.areas_of_expertise,
        user.mentorship_goals,
    ]
    present = sum(1 for field in fields if field)
    return present / len(fields)


def match_explanation(
    student: UserRecord,
    mentor: UserRecord,
    mode: str,
    semantic: float,
    overlap: float,
    *,
    query: str | None = None,
) -> list[str]:
    reasons: list[str] = []
    if mode == "goal":
        if query:
            query_tokens = _meaningful_tokens(query)
            mentor_tokens = _meaningful_tokens(
                *(mentor.interests or []),
                *(mentor.areas_of_expertise or []),
                *(mentor.modules_taught or []),
                mentor.mentorship_goals or "",
                mentor.bio or "",
            )
            matching_terms = sorted(query_tokens & mentor_tokens)
        if matching_terms:
            reasons.append(
                "Goal terms found in mentor profile: "
                + ", ".join(matching_terms[:3])
            )
        reasons.append(
            f"Measured typed-goal fit: {round(_bounded(semantic) * 100)}% goal relevance"
        )
        return reasons

    shared_interests = _shared_values(
        student.interests or [],
        (mentor.interests or []) + (mentor.areas_of_expertise or []),
    )
    shared_modules = _shared_values(
        student.modules_taken or [],
        (mentor.modules_taken or []) + (mentor.modules_taught or []),
    )
    shared_opportunities = _shared_values(
        student.nus_opportunities or [], mentor.nus_opportunities or []
    )
    shared_ccas = _shared_values(student.ccas or [], mentor.ccas or [])
    shared_exchange = _shared_values(
        student.exchange_universities or [], mentor.exchange_universities or []
    )

    if shared_interests:
        reasons.append(f"Shared interest: {shared_interests[0]}")
    if shared_modules:
        reasons.append(f"Relevant shared module: {shared_modules[0]}")
    if shared_opportunities:
        reasons.append(f"Shared NUS opportunity: {shared_opportunities[0]}")
    if shared_ccas:
        reasons.append(f"Shared CCA or organisation: {shared_ccas[0]}")
    if shared_exchange:
        reasons.append(f"Shared exchange destination: {shared_exchange[0]}")

    if query:
        query_tokens = _meaningful_tokens(query)
        mentor_tokens = _meaningful_tokens(
            *(mentor.interests or []),
            *(mentor.areas_of_expertise or []),
            *(mentor.modules_taught or []),
            mentor.mentorship_goals or "",
            mentor.bio or "",
        )
        matching_terms = sorted(query_tokens & mentor_tokens)
        if matching_terms:
            reasons.append(
                "Goal terms found in mentor profile: " + ", ".join(matching_terms[:3])
            )

    if (
        student.department
        and mentor.department
        and _normalised_value(student.department)
        == _normalised_value(mentor.department)
    ):
        reasons.append(f"Same department: {mentor.department}")
    elif (
        student.major
        and mentor.major
        and _normalised_value(student.major) == _normalised_value(mentor.major)
    ):
        reasons.append(f"Same programme: {mentor.major}")
    elif (
        student.faculty
        and mentor.faculty
        and _normalised_value(student.faculty) == _normalised_value(mentor.faculty)
    ):
        reasons.append(f"Same faculty: {mentor.faculty}")

    evidence_label = "goal description" if mode == "goal" else "complete profile"
    measured_evidence = (
        f"Measured {evidence_label} fit: {round(_bounded(semantic) * 100)}% "
        f"semantic similarity and {round(_bounded(overlap) * 100)}% structured overlap"
    )
    return [*reasons[:3], measured_evidence]
