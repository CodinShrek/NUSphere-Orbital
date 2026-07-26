from __future__ import annotations

import unittest

from app.main import Mentor, RecommendationRequest, score_mentor


def mentor() -> Mentor:
    return Mentor(
        id="mentor_ai",
        email="mentor.ai@u.nus.edu",
        name="AI Mentor",
        mentor_type="senior",
        mentor_type_label="Senior Student",
        year="Senior Student",
        programme="Computer Science",
        faculty="Computing",
        role="Senior Student",
        rating=0,
        reviews=0,
        mentees=0,
        answers=0,
        match_score=72,
        keyword_match_score=72,
        interests=["AI/Machine Learning", "Research"],
        experience_tags=["UROP", "CS3244"],
        bio="I guide students on machine learning research and UROP applications.",
        experience=["Areas of expertise: Machine learning, research methods"],
    )


class RecommendationScoringTests(unittest.TestCase):
    def test_about_text_contributes_to_keyword_match(self) -> None:
        baseline = score_mentor(
            mentor(),
            RecommendationRequest(interests=[], goals=[], faculty="Computing"),
        )
        with_about = score_mentor(
            mentor(),
            RecommendationRequest(
                interests=[],
                goals=[],
                bio="I want to explore machine learning research.",
                faculty="Computing",
            ),
        )

        self.assertGreater(with_about, baseline)

    def test_mentor_matching_ignores_stop_words(self) -> None:
        empty = score_mentor(
            mentor(),
            RecommendationRequest(interests=[], goals=[], bio="", faculty=""),
        )
        filler_only = score_mentor(
            mentor(),
            RecommendationRequest(
                interests=[],
                goals=[],
                bio="and the for with this profile opportunity",
                faculty="",
            ),
        )
        meaningful = score_mentor(
            mentor(),
            RecommendationRequest(
                interests=[],
                goals=[],
                bio="I want UROP machine learning applications.",
                faculty="",
            ),
        )

        self.assertEqual(filler_only, empty)
        self.assertGreater(meaningful, filler_only)


if __name__ == "__main__":
    unittest.main()
