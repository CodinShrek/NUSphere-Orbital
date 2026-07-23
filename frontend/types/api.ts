export type Role = "student" | "mentor";
export type MentorType =
  | "senior"
  | "alumni"
  | "professor"
  | "nus_staff"
  | "other";
export type VerificationStatus =
  | "not_applicable"
  | "unverified"
  | "pending"
  | "verified"
  | "rejected";
export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";
export type AvailabilityMode = "online" | "in_person" | "hybrid";

export type AvailabilitySlotInput = {
  day_of_week: Weekday;
  start_time: string;
  end_time: string;
  timezone?: string;
  mode?: AvailabilityMode;
  location?: string;
};

export type AvailabilitySlot = AvailabilitySlotInput & {
  id: string;
  mentor_id: string;
  timezone: string;
  mode: AvailabilityMode;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

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
  verification_status: VerificationStatus;
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
  match_score_breakdown?: MatchScoreBreakdown;
  embedding_model?: string;
  embedding_provider?: "openai" | "local";
  embedding_fallback?: boolean;
  interests: string[];
  experience_tags: string[];
  bio: string;
  experience: string[];
  match_reasons: string[];
  verification_status: VerificationStatus;
  availability: AvailabilitySlot[];
};

export type MatchScoreComponent = {
  score: number;
  weight: number;
  weighted_points: number;
};

export type MatchScoreBreakdown = {
  semantic: MatchScoreComponent;
  structured: MatchScoreComponent;
  faculty: MatchScoreComponent;
  completeness: MatchScoreComponent;
  total: number;
};

export type Review = {
  id: string;
  connection_id: string;
  student_id: string;
  student_name: string;
  mentor_id: string;
  rating: number;
  comment: string;
  created_at: string;
  updated_at: string;
};

export type ReviewEligibility = {
  mentor_id: string;
  can_review: boolean;
  reason: string;
  connection_id?: string;
  existing_review?: Review;
};

export type Answer = {
  id: string;
  mentor_id: string;
  mentor_name: string;
  body: string;
  summary: string;
  summary_version: string;
  created_at: string;
};

export type Question = {
  id: string;
  student_id: string;
  student_name: string;
  title: string;
  topic: string;
  topic_cluster: string;
  body: string;
  tags: string[];
  attachments: string[];
  key_terms: string[];
  created_at: string;
  answers: Answer[];
};

export type DuplicateQuestionSuggestion = {
  question_id: string;
  title: string;
  topic: string;
  topic_cluster: string;
  similarity_score: number;
  evidence: string[];
  answer_count: number;
  latest_summary?: string | null;
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

export type AuthenticatedSession = {
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

export type ProfileSyncPayload = Omit<RegisterPayload, "email" | "password">;

export type UpdateProfilePayload = Partial<Omit<ProfileSyncPayload, "role">>;
