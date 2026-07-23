import assert from "node:assert/strict";
import test from "node:test";

import { ALL_CLUSTERS, filterQuestions, frequentQuestionTerms, questionClusters } from "../lib/qa-utils";
import type { Question } from "../types/api";

function question(overrides: Partial<Question>): Question {
  return {
    id: "q_1",
    student_id: "u_1",
    student_name: "Student",
    title: "How do I prepare for NOC interviews?",
    topic: "NOC",
    topic_cluster: "NOC & Entrepreneurship",
    body: "I want preparation advice for startup interviews.",
    tags: ["NOC", "startup"],
    attachments: [],
    key_terms: ["interview"],
    created_at: "2026-07-23T00:00:00Z",
    answers: [],
    ...overrides,
  };
}

test("questionClusters returns an All clusters option and sorted unique clusters", () => {
  assert.deepEqual(
    questionClusters([
      question({ id: "q_1", topic_cluster: "Research" }),
      question({ id: "q_2", topic_cluster: "NOC & Entrepreneurship" }),
      question({ id: "q_3", topic_cluster: "Research" }),
    ]),
    [ALL_CLUSTERS, "NOC & Entrepreneurship", "Research"],
  );
});

test("filterQuestions combines search text with cluster filtering", () => {
  const questions = [
    question({ id: "q_1", title: "NOC interviews", topic_cluster: "NOC & Entrepreneurship" }),
    question({
      id: "q_2",
      title: "Research assistant applications",
      topic: "Research",
      topic_cluster: "Research",
      body: "How should I write to a professor?",
      tags: ["RA"],
      key_terms: ["professor"],
    }),
  ];

  assert.deepEqual(
    filterQuestions(questions, "professor", "Research").map((item) => item.id),
    ["q_2"],
  );
  assert.deepEqual(
    filterQuestions(questions, "professor", "NOC & Entrepreneurship").map((item) => item.id),
    [],
  );
});

test("frequentQuestionTerms includes cluster labels and ranks repeated terms", () => {
  const terms = frequentQuestionTerms([
    question({ id: "q_1", tags: ["NOC"], key_terms: ["interview"] }),
    question({ id: "q_2", tags: ["NOC"], key_terms: ["startup"] }),
  ]);

  assert.equal(terms[0], "NOC");
  assert.ok(terms.includes("NOC & Entrepreneurship"));
});
