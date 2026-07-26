import type {
  AvailabilitySlot,
  AvailabilitySlotInput,
  Connection,
  Conversation,
  DuplicateQuestionSuggestion,
  Mentor,
  Notification,
  Opportunity,
  OpportunityCategory,
  OpportunityCreatePayload,
  ProfileSyncPayload,
  Question,
  Review,
  ReviewEligibility,
  UpdateProfilePayload,
  User,
  VerificationStatus,
} from "@/types/api";

export type {
  Answer,
  AvailabilityMode,
  AvailabilitySlot,
  AvailabilitySlotInput,
  AuthenticatedSession,
  Connection,
  Conversation,
  ConversationMessage,
  DuplicateQuestionSuggestion,
  Mentor,
  MentorType,
  Notification,
  NotificationType,
  Opportunity,
  OpportunityCategory,
  OpportunityCreatePayload,
  ProfileSyncPayload,
  Question,
  RegisterPayload,
  Review,
  ReviewEligibility,
  Role,
  UpdateProfilePayload,
  User,
  VerificationStatus,
  Weekday,
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
      detail?: string | { msg?: string }[];
    } | null;
    const detail = Array.isArray(error?.detail)
      ? error.detail.map((item) => item.msg).filter(Boolean).join("; ")
      : error?.detail;
    throw new Error(detail || "Request failed");
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
      bio: user.bio,
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

export function fetchOpportunities() {
  return request<Opportunity[]>("/opportunities");
}

export function createOpportunity(
  token: string,
  payload: OpportunityCreatePayload,
) {
  return request<Opportunity>("/opportunities", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function updateOpportunity(
  token: string,
  opportunityId: string,
  payload: OpportunityCreatePayload,
) {
  return request<Opportunity>(`/opportunities/${opportunityId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function fetchOpportunityRecommendations(
  token: string,
  query = "",
  categories: OpportunityCategory[] = [],
  minimumScore = 0,
) {
  return request<Opportunity[]>("/opportunities/recommendations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query,
      categories,
      minimum_score: minimumScore,
    }),
  });
}

export function fetchOpportunityProfileMatches(token: string) {
  return request<Opportunity[]>("/opportunities/ai/profile-match", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchOpportunityGoalMatches(
  token: string,
  query: string,
  minimumScore = 0,
) {
  return request<Opportunity[]>("/opportunities/ai/goal-search", {
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

export function suggestDuplicateQuestions(
  token: string,
  payload: {
    title: string;
    topic: string;
    body: string;
    tags: string[];
  },
) {
  return request<DuplicateQuestionSuggestion[]>("/qa/questions/suggestions", {
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

export function markConversationRead(token: string, conversationId: string) {
  return request<Conversation>(`/conversations/${conversationId}/read`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function updateConversationState(
  token: string,
  conversationId: string,
  payload: {
    is_pinned?: boolean;
    is_archived?: boolean;
    is_muted?: boolean;
  },
) {
  return request<Conversation>(`/conversations/${conversationId}/state`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function fetchNotifications(token: string, unreadOnly = false) {
  const query = unreadOnly ? "?unread_only=true" : "";
  return request<Notification[]>(`/notifications${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchNotificationUnreadCount(token: string) {
  return request<{ unread_count: number }>("/notifications/unread-count", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function markNotificationRead(token: string, notificationId: string) {
  return request<Notification>(`/notifications/${notificationId}/read`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function markAllNotificationsRead(token: string) {
  return request<{ unread_count: number }>("/notifications/read-all", {
    method: "POST",
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

export function replaceMentorAvailability(
  token: string,
  slots: AvailabilitySlotInput[],
) {
  return request<AvailabilitySlot[]>("/mentors/me/availability", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ slots }),
  });
}

export function fetchMentorAvailability(mentorId: string) {
  return request<AvailabilitySlot[]>(`/mentors/${mentorId}/availability`);
}

export function requestMentorVerification(token: string) {
  return request<{ mentor_id: string; status: VerificationStatus }>(
    "/mentors/me/verification",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
}

export function fetchMentorReviews(mentorId: string) {
  return request<Review[]>(`/mentors/${mentorId}/reviews`);
}

export function fetchReviewEligibility(token: string, mentorId: string) {
  return request<ReviewEligibility>(
    `/mentors/${mentorId}/reviews/eligibility`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
}

export function createMentorReview(
  token: string,
  mentorId: string,
  rating: number,
  comment: string,
) {
  return request<Review>(`/mentors/${mentorId}/reviews`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ rating, comment }),
  });
}

export function updateMentorReview(
  token: string,
  reviewId: string,
  rating: number,
  comment: string,
) {
  return request<Review>(`/reviews/${reviewId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ rating, comment }),
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
