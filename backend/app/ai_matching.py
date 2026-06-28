from __future__ import annotations

import hashlib
import json
import math
import os
import re
import urllib.error
import urllib.request
from collections import Counter

from .models import UserRecord


EMBEDDING_DIMENSIONS = 256
OPENAI_EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")


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
    return "\n".join(
        [
            "Student goal-based mentor search",
            f"Student faculty: {student.faculty}",
            f"Student department: {student.department or ''}",
            f"Student programme: {student.major}",
            f"Student current interests: {', '.join(student.interests or [])}",
            f"Student current goals: {', '.join(student.goals or [])}",
            f"Student background: {student.bio or ''}",
            f"Specific mentor request: {query}",
        ]
    )


def local_embedding(text: str) -> list[float]:
    tokens = re.findall(r"[a-zA-Z0-9]+", text.lower())
    counts: Counter[int] = Counter()
    for token in tokens:
        if len(token) < 3:
            continue
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "big") % EMBEDDING_DIMENSIONS
        sign = 1 if digest[4] % 2 == 0 else -1
        counts[index] += sign

    vector = [0.0] * EMBEDDING_DIMENSIONS
    for index, count in counts.items():
        vector[index] = float(count)
    return normalise(vector)


def openai_embedding(text: str) -> list[float] | None:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    payload = json.dumps({"model": OPENAI_EMBEDDING_MODEL, "input": text}).encode("utf-8")
    request = urllib.request.Request(
        "https://api.openai.com/v1/embeddings",
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            data = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, KeyError, json.JSONDecodeError):
        return None
    return normalise([float(value) for value in data["data"][0]["embedding"]])


def embed_text(text: str) -> tuple[list[float], str]:
    remote = openai_embedding(text)
    if remote is not None:
        return remote, OPENAI_EMBEDDING_MODEL
    return local_embedding(text), "local-hashing-v1"


def normalise(vector: list[float]) -> list[float]:
    magnitude = math.sqrt(sum(value * value for value in vector))
    if magnitude == 0:
        return vector
    return [value / magnitude for value in vector]


def cosine_similarity(first: list[float], second: list[float]) -> float:
    if not first or not second:
        return 0.0
    length = min(len(first), len(second))
    return sum(first[index] * second[index] for index in range(length))


def structured_overlap(student: UserRecord, mentor: UserRecord) -> float:
    score = 0.0
    total = 0.0

    checks = [
        (student.faculty, mentor.faculty, 0.12),
        (student.major, mentor.major, 0.08),
        (student.department or "", mentor.department or "", 0.08),
    ]
    for left, right, weight in checks:
        total += weight
        if left and right and left.lower() == right.lower():
            score += weight

    list_checks = [
        (student.interests or [], (mentor.interests or []) + (mentor.areas_of_expertise or []), 0.22),
        (student.goals or [], (mentor.mentorship_goals or "").split() + (mentor.goals or []), 0.18),
        (student.modules_taken or [], (mentor.modules_taken or []) + (mentor.modules_taught or []), 0.10),
        (student.ccas or [], mentor.ccas or [], 0.08),
        (student.nus_opportunities or [], mentor.nus_opportunities or [], 0.08),
        (student.exchange_universities or [], mentor.exchange_universities or [], 0.06),
    ]
    for left_items, right_items, weight in list_checks:
        total += weight
        left = {item.lower() for item in left_items if item}
        right = {item.lower() for item in right_items if item}
        if left and right:
            score += weight * (len(left & right) / len(left | right))

    return score / total if total else 0.0


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


def match_explanation(student: UserRecord, mentor: UserRecord, mode: str, semantic: float, overlap: float) -> list[str]:
    reasons: list[str] = []
    shared_interests = sorted({item for item in student.interests if item.lower() in {value.lower() for value in (mentor.interests or []) + (mentor.areas_of_expertise or [])}})
    shared_opportunities = sorted({item for item in student.nus_opportunities if item.lower() in {value.lower() for value in mentor.nus_opportunities or []}})
    if shared_interests:
        reasons.append(f"Shared interest: {shared_interests[0]}")
    if shared_opportunities:
        reasons.append(f"Shared NUS opportunity: {shared_opportunities[0]}")
    if student.faculty == mentor.faculty:
        reasons.append(f"Same faculty: {mentor.faculty}")
    if mentor.areas_of_expertise:
        reasons.append(f"Mentor expertise includes {mentor.areas_of_expertise[0]}")
    if mentor.mentorship_goals:
        reasons.append("Mentorship goals align with the guidance requested")
    if not reasons:
        if mode == "profile":
            reasons.append("Overall profile pathway is semantically close to yours")
        else:
            reasons.append("Mentor profile semantically matches your search description")
    reasons.append(f"Semantic fit {round(max(0.0, semantic) * 100)}%, pathway overlap {round(max(0.0, overlap) * 100)}%")
    return reasons[:4]
