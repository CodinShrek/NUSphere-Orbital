from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass
from difflib import SequenceMatcher


SUMMARY_VERSION = "extractive-v2"
DEFAULT_TOPIC_CLUSTER = "General Guidance"
MAX_SUMMARY_CHARACTERS = 320
MIN_DUPLICATE_SCORE = 35

WORD_PATTERN = re.compile(r"[a-z0-9]+(?:['-][a-z0-9]+)?", re.IGNORECASE)
SENTENCE_PATTERN = re.compile(r"(?<=[.!?])\s+")

STOP_WORDS = {
    "about",
    "after",
    "also",
    "and",
    "are",
    "been",
    "before",
    "being",
    "can",
    "could",
    "for",
    "from",
    "have",
    "help",
    "how",
    "into",
    "just",
    "more",
    "much",
    "need",
    "nus",
    "should",
    "some",
    "that",
    "the",
    "their",
    "there",
    "these",
    "they",
    "this",
    "want",
    "what",
    "when",
    "where",
    "which",
    "with",
    "would",
    "your",
}

TOPIC_CLUSTERS: dict[str, tuple[str, ...]] = {
    "Academic Planning": (
        "academic",
        "course",
        "curriculum",
        "major",
        "minor",
        "module",
        "specialisation",
        "specialization",
        "study plan",
        "workload",
    ),
    "Careers & Internships": (
        "career",
        "cv",
        "employment",
        "internship",
        "interview",
        "job",
        "portfolio",
        "recruitment",
        "resume",
    ),
    "NOC & Entrepreneurship": (
        "entrepreneur",
        "entrepreneurship",
        "founder",
        "noc",
        "nus overseas colleges",
        "startup",
        "venture",
    ),
    "Exchange & Overseas": (
        "exchange",
        "global programme",
        "overseas",
        "sep",
        "semester abroad",
        "study abroad",
    ),
    "Research": (
        "fyp",
        "lab",
        "paper",
        "professor",
        "research",
        "supervisor",
        "urop",
    ),
    "Student Life & CCAs": (
        "campus life",
        "cca",
        "club",
        "competition",
        "society",
        "student life",
        "volunteer",
    ),
    "Accommodation": (
        "accommodation",
        "campus housing",
        "hall",
        "hostel",
        "residence",
        "room",
    ),
    "Wellbeing & Support": (
        "anxiety",
        "burnout",
        "counselling",
        "mental health",
        "stress",
        "support",
        "wellbeing",
    ),
    "Admissions & Administration": (
        "admission",
        "appeal",
        "application",
        "credit transfer",
        "deadline",
        "financial aid",
        "registration",
        "scholarship",
    ),
}

ADVICE_MARKERS = {
    "avoid",
    "because",
    "best",
    "consider",
    "first",
    "important",
    "instead",
    "make sure",
    "recommend",
    "start",
    "suggest",
    "try",
    "you can",
    "you should",
}


@dataclass(frozen=True)
class DuplicateScore:
    score: int
    evidence: list[str]


def normalise_text(value: str) -> str:
    return " ".join(WORD_PATTERN.findall(value.lower()))


def meaningful_tokens(*parts: str) -> set[str]:
    return {
        token
        for part in parts
        for token in WORD_PATTERN.findall(part.lower())
        if len(token) >= 3 and token not in STOP_WORDS
    }


def extract_key_terms(*parts: str, existing: list[str] | None = None) -> list[str]:
    terms: list[str] = []
    seen: set[str] = set()
    for item in existing or []:
        cleaned = item.strip()
        normalised = normalise_text(cleaned)
        if cleaned and normalised and normalised not in seen:
            terms.append(cleaned[:80])
            seen.add(normalised)

    frequency: Counter[str] = Counter()
    first_seen: dict[str, int] = {}
    for part in parts:
        for token in WORD_PATTERN.findall(part.lower()):
            if len(token) < 3 or token in STOP_WORDS:
                continue
            frequency[token] += 1
            first_seen.setdefault(token, len(first_seen))

    ranked = sorted(
        frequency,
        key=lambda token: (-frequency[token], first_seen[token], token),
    )
    for token in ranked:
        if token not in seen:
            terms.append(token)
            seen.add(token)
        if len(terms) >= 10:
            break
    return terms[:10]


def topic_cluster(*parts: str) -> str:
    combined = normalise_text(" ".join(parts))
    tokens = meaningful_tokens(*parts)
    scores: dict[str, int] = {}
    for cluster, aliases in TOPIC_CLUSTERS.items():
        score = 0
        for alias in aliases:
            normalised_alias = normalise_text(alias)
            if " " in normalised_alias and normalised_alias in combined:
                score += 4
            elif normalised_alias in tokens:
                score += 2
        scores[cluster] = score

    best_cluster, best_score = max(scores.items(), key=lambda item: item[1])
    return best_cluster if best_score > 0 else DEFAULT_TOPIC_CLUSTER


def _clean_sentence(value: str) -> str:
    return " ".join(value.strip().split())


def summarise_answer(body: str) -> str:
    cleaned = _clean_sentence(body)
    if not cleaned:
        return ""
    if len(cleaned) <= MAX_SUMMARY_CHARACTERS and len(cleaned.split()) <= 35:
        return cleaned

    sentences = [
        sentence
        for sentence in (
            _clean_sentence(item) for item in SENTENCE_PATTERN.split(cleaned)
        )
        if sentence
    ]
    if len(sentences) <= 1:
        words = cleaned.split()
        shortened = " ".join(words[:45]).rstrip(" ,;:")
        return shortened if shortened.endswith((".", "!", "?")) else shortened + "."

    scored: list[tuple[float, int, str]] = []
    for index, sentence in enumerate(sentences):
        lower_sentence = sentence.lower()
        marker_score = sum(1 for marker in ADVICE_MARKERS if marker in lower_sentence)
        length = len(sentence.split())
        useful_length = 1.0 if 8 <= length <= 38 else 0.0
        position_score = 1.0 if index == 0 else max(0.0, 0.6 - index * 0.1)
        scored.append(
            (marker_score * 2 + useful_length + position_score, index, sentence)
        )

    selected = sorted(scored, key=lambda item: (-item[0], item[1]))[:2]
    summary = " ".join(item[2] for item in sorted(selected, key=lambda item: item[1]))
    if len(summary) <= MAX_SUMMARY_CHARACTERS:
        return summary
    shortened = summary[: MAX_SUMMARY_CHARACTERS + 1].rsplit(" ", 1)[0].rstrip(" ,;:")
    return shortened if shortened.endswith((".", "!", "?")) else shortened + "."


def duplicate_score(
    *,
    draft_title: str,
    draft_topic: str,
    draft_body: str,
    draft_tags: list[str],
    candidate_title: str,
    candidate_topic: str,
    candidate_body: str,
    candidate_terms: list[str],
    candidate_cluster: str,
) -> DuplicateScore:
    draft_cluster = topic_cluster(draft_topic, draft_title, draft_body, *draft_tags)
    draft_tokens = meaningful_tokens(draft_topic, draft_title, draft_body, *draft_tags)
    candidate_tokens = meaningful_tokens(
        candidate_topic, candidate_title, candidate_body, *candidate_terms
    )
    union = draft_tokens | candidate_tokens
    shared = draft_tokens & candidate_tokens
    token_overlap = len(shared) / len(union) if union else 0.0
    title_similarity = SequenceMatcher(
        None, normalise_text(draft_title), normalise_text(candidate_title)
    ).ratio()
    same_topic = bool(
        normalise_text(draft_topic)
        and normalise_text(draft_topic) == normalise_text(candidate_topic)
    )
    same_cluster = draft_cluster == candidate_cluster

    raw_score = (
        token_overlap * 0.50
        + title_similarity * 0.30
        + (0.10 if same_topic else 0.0)
        + (0.10 if same_cluster else 0.0)
    )
    evidence: list[str] = []
    if same_topic:
        evidence.append(f"Same topic: {candidate_topic}")
    elif same_cluster:
        evidence.append(f"Same topic cluster: {candidate_cluster}")
    if shared:
        evidence.append("Shared terms: " + ", ".join(sorted(shared)[:5]))
    if title_similarity >= 0.55:
        evidence.append("Similar question title")

    return DuplicateScore(score=round(min(1.0, raw_score) * 100), evidence=evidence)
