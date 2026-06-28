export type Role = "student" | "mentor";
export type MentorType = "senior" | "alumni" | "professor" | "nus_staff" | "other";

export type User = {
  id: string;
  email: string;
  role: Role;
  name: string;
  faculty: string;
  major: string;
  modules_taken: string[];
  ccas: string[];
  nus_opportunities: string[];
  exchange_universities: string[];
  accommodation: string;
  interests: string[];
  goals: string[];
  bio: string;
  mentor_type?: MentorType;
  mentorship_goals?: string;
  mentor_type_other?: string;
  graduation_year?: string;
  current_role?: string;
  organisation?: string;
  department?: string;
  consultation_hours?: string;
  modules_taught: string[];
  areas_of_expertise: string[];
  office_location?: string;
  office?: string;
  profile_picture?: string;
};

export type Mentor = {
  id: string;
  email: string;
  name: string;
  mentor_type?: MentorType;
  mentor_type_label: string;
  year: string;
  programme: string;
  faculty: string;
  role: string;
  rating: number;
  reviews: number;
  mentees: number;
  answers: number;
  match_score: number;
  keyword_match_score?: number;
  profile_match_score?: number;
  goal_match_score?: number;
  match_label: string;
  interests: string[];
  experience_tags: string[];
  bio: string;
  experience: string[];
  match_reasons: string[];
};

export type Answer = {
  id: string;
  mentor_id: string;
  mentor_name: string;
  body: string;
  summary: string;
  created_at: string;
};

export type Question = {
  id: string;
  student_id: string;
  student_name: string;
  title: string;
  topic: string;
  body: string;
  tags: string[];
  attachments: string[];
  key_terms: string[];
  created_at: string;
  answers: Answer[];
};

export type ConversationMessage = {
  id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
};

export type Conversation = {
  id: string;
  student_id: string;
  student_name: string;
  mentor_id: string;
  mentor_name: string;
  mentor_programme: string;
  last_message: string;
  updated_at: string;
  messages: ConversationMessage[];
};

export type Connection = {
  id: string;
  student_id: string;
  student_name: string;
  mentor_id: string;
  mentor_name: string;
  mentor_programme: string;
  status: "pending" | "accepted";
  created_at: string;
  updated_at: string;
};

type AuthResponse = {
  token: string;
  user: User;
};

export type RegisterPayload = {
  email: string;
  password: string;
  role: Role;
  name: string;
  faculty: string;
  major: string;
  modules_taken: string[];
  ccas: string[];
  nus_opportunities: string[];
  exchange_universities: string[];
  accommodation: string;
  interests: string[];
  goals: string[];
  bio: string;
  mentor_type?: MentorType;
  mentorship_goals?: string;
  mentor_type_other?: string;
  graduation_year?: string;
  current_role?: string;
  organisation?: string;
  department?: string;
  consultation_hours?: string;
  modules_taught: string[];
  areas_of_expertise: string[];
  office_location?: string;
  office?: string;
  profile_picture?: string;
};

export type UpdateProfilePayload = Partial<Omit<RegisterPayload, "email" | "password" | "role">>;

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
    const error = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(error?.detail ?? "Request failed");
  }

  return response.json() as Promise<T>;
}

export function login(email: string, password: string, role: Role) {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, role }),
  });
}

export function register(payload: RegisterPayload) {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchCurrentUser(token: string) {
  return request<User>("/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
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

export function logout(token: string) {
  return request<{ status: string }>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({ token }),
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

export function fetchAiGoalMatches(token: string, query: string, minimumScore = 0) {
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

export function createQuestion(token: string, payload: { title: string; topic: string; body: string; tags: string[]; attachments: string[] }) {
  return request<Question>("/qa/questions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function answerQuestion(token: string, questionId: string, body: string) {
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

export function sendConversationMessage(token: string, conversationId: string, body: string) {
  return request<Conversation>(`/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ body }),
  });
}
