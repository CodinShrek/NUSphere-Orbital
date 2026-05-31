export type Role = "student" | "mentor";

export type User = {
  id: string;
  email: string;
  role: Role;
  name: string;
  faculty: string;
  interests: string[];
  goals: string[];
};

export type Mentor = {
  id: string;
  name: string;
  year: string;
  programme: string;
  faculty: string;
  role: string;
  rating: number;
  reviews: number;
  mentees: number;
  answers: number;
  match_score: number;
  interests: string[];
  experience_tags: string[];
  bio: string;
  experience: string[];
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
  interests: string[];
  goals: string[];
};

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

export function logout(token: string) {
  return request<{ status: string }>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function fetchRecommendations(user: User, minimumScore = 70) {
  return request<Mentor[]>("/recommendations", {
    method: "POST",
    body: JSON.stringify({
      interests: user.interests,
      goals: user.goals,
      faculty: user.faculty,
      minimum_score: minimumScore,
    }),
  });
}
