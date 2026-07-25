import assert from "node:assert/strict";
import test from "node:test";

import { profileCompletion, relatedQuestionsForUser } from "../lib/dashboard-utils";
import type { Question, User } from "../types/api";

function user(overrides: Partial<User> = {}): User {
  return {
    id: "u_1",
    email: "student@example.com",
    role: "student",
    name: "Student",
    faculty: "Computing",
    major: "Computer Science",
    modules_taken: ["CS1010"],
    ccas: ["NUS Hackers"],
    nus_opportunities: ["NOC"],
    exchange_universities: [],
    accommodation: "On campus",
    interests: ["AI"],
    goals: ["Find research guidance"],
    bio: "Exploring AI research.",
    modules_taught: [],
    areas_of_expertise: [],
    verification_status: "unverified",
    ...overrides,
  };
}

function question(overrides: Partial<Question>): Question {
  return {
    id: "q_1",
    student_id: "u_2",
    student_name: "Peer",
    title: "AI research pathways",
    topic: "Research",
    topic_cluster: "Research",
    body: "How should I prepare for Computer Science research?",
    tags: ["AI"],
    attachments: [],
    key_terms: ["research"],
    created_at: "2026-07-23T00:00:00Z",
    answers: [],
    ...overrides,
  };
}

test("profileCompletion scores completed profile signals", () => {
  assert.equal(profileCompletion(user()), 100);
  assert.equal(
    profileCompletion(user({ bio: "", interests: [], goals: [], modules_taken: [] })),
    60,
  );
});

test("relatedQuestionsForUser matches faculty, major, and interests and caps results", () => {
  const questions = [
    question({ id: "q_1", title: "Computer Science research" }),
    question({
      id: "q_2",
      title: "Business case competition",
      topic: "Business",
      body: "How should I prepare for a finance presentation?",
      tags: [],
      key_terms: ["finance"],
    }),
    question({ id: "q_3", body: "Any advice for Computing students?", tags: [] }),
    question({ id: "q_4", key_terms: ["AI"] }),
    question({ id: "q_5", title: "AI internships" }),
    question({ id: "q_6", title: "AI clubs" }),
  ];

  assert.deepEqual(
    relatedQuestionsForUser(user(), questions).map((item) => item.id),
    ["q_1", "q_3", "q_4", "q_5"],
  );
});
