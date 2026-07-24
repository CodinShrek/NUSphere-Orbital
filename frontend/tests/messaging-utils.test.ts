import assert from "node:assert/strict";
import test from "node:test";

import {
  conversationParticipantName,
  filterConversations,
  totalUnreadMessages,
} from "../lib/messaging-utils";
import type { Conversation, User } from "../types/api";

const student = { id: "u_student", role: "student" } as User;
const mentor = { id: "u_mentor", role: "mentor" } as User;

function conversation(overrides: Partial<Conversation>): Conversation {
  return {
    id: "c_1",
    student_id: "u_student",
    student_name: "Student One",
    mentor_id: "u_mentor",
    mentor_name: "Mentor One",
    mentor_programme: "Computer Science",
    last_message: "Let's plan your modules.",
    updated_at: "2026-07-24T10:00:00Z",
    unread_count: 0,
    last_read_at: null,
    is_pinned: false,
    is_archived: false,
    is_muted: false,
    messages: [
      {
        id: "m_1",
        sender_id: "u_mentor",
        sender_name: "Mentor One",
        body: "Let's plan your modules.",
        created_at: "2026-07-24T10:00:00Z",
      },
    ],
    ...overrides,
  };
}

test("conversationParticipantName shows the other participant", () => {
  const item = conversation({});

  assert.equal(conversationParticipantName(item, student), "Mentor One");
  assert.equal(conversationParticipantName(item, mentor), "Student One");
});

test("totalUnreadMessages sums backend unread counts", () => {
  assert.equal(
    totalUnreadMessages([
      conversation({ id: "c_1", unread_count: 2 }),
      conversation({ id: "c_2", unread_count: 3 }),
    ]),
    5,
  );
});

test("filterConversations filters archived by default and supports modes", () => {
  const items = [
    conversation({ id: "c_1", unread_count: 1, updated_at: "2026-07-24T11:00:00Z" }),
    conversation({ id: "c_2", is_archived: true }),
    conversation({ id: "c_3", is_pinned: true, last_message: "Pinned career chat" }),
  ];

  assert.deepEqual(
    filterConversations(items, "", "all", student).map((item) => item.id),
    ["c_3", "c_1"],
  );
  assert.deepEqual(
    filterConversations(items, "", "archived", student).map((item) => item.id),
    ["c_2"],
  );
  assert.deepEqual(
    filterConversations(items, "career", "all", student).map((item) => item.id),
    ["c_3"],
  );
  assert.deepEqual(
    filterConversations(items, "", "unread", student).map((item) => item.id),
    ["c_1"],
  );
});
