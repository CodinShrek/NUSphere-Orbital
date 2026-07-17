import type {
  Connection,
  Conversation,
  Mentor,
  ProfileSyncPayload,
  Question,
  UpdateProfilePayload,
  User,
} from "@/types/api";

export type {
  Answer,
  AuthenticatedSession,
  Connection,
  Conversation,
  ConversationMessage,
  Mentor,
  MentorType,
  ProfileSyncPayload,
  Question,
  RegisterPayload,
  Role,
  UpdateProfilePayload,
  User,
} from "@/types/api";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(error?.detail ?? "Request failed");
  }

  return response.json() as Promise<T>;
}

export function fetchCurrentUser(token: string) {
  return request<User>("/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function syncProfile(token: string, payload: ProfileSyncPayload) {
  return request<User>("/auth/profile", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function updateProfile(token: string, payload: UpdateProfilePayload) {
  return request<User>("/auth/me", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function fetchRecommendations(user: User, minimumScore = 0) {
  return request<Mentor[]>("/recommendations", {
    method: "POST",
    body: JSON.stringify({
      interests: user.interests,
      goals: [
        ...user.goals,
        user.major,
        ...user.modules_taken,
        ...user.ccas,
        ...user.nus_opportunities,
        ...user.exchange_universities,
      ].filter(Boolean),
      faculty: user.faculty,
      minimum_score: minimumScore,
    }),
  });
}

export function fetchAiProfileMatches(token: string) {
  return request<Mentor[]>("/ai/profile-match", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchAiGoalMatches(
  token: string,
  query: string,
  minimumScore = 0,
) {
  return request<Mentor[]>("/ai/goal-search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, minimum_score: minimumScore }),
  });
}

export function fetchQuestions() {
  return request<Question[]>("/qa/questions");
}

export function createQuestion(
  token: string,
  payload: {
    title: string;
    topic: string;
    body: string;
    tags: string[];
    attachments: string[];
  },
) {
  return request<Question>("/qa/questions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function answerQuestion(
  token: string,
  questionId: string,
  body: string,
) {
  return request<Question>(`/qa/questions/${questionId}/answers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ body }),
  });
}

export function fetchConversations(token: string) {
  return request<Conversation[]>("/conversations", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchConnections(token: string) {
  return request<Connection[]>("/connections", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function requestConnection(token: string, mentorId: string) {
  return request<Connection>(`/connections/${mentorId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function acceptConnection(token: string, connectionId: string) {
  return request<Conversation>(`/connections/${connectionId}/accept`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function startConversation(token: string, mentorId: string) {
  return request<Conversation>(`/conversations/${mentorId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function sendConversationMessage(
  token: string,
  conversationId: string,
  body: string,
) {
  return request<Conversation>(`/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ body }),
  });
}
