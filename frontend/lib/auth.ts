import type { Session } from "@supabase/supabase-js";

import { fetchCurrentUser, syncProfile } from "@/lib/api";
import { getSupabaseClient } from "@/lib/supabase";
import type {
  AuthenticatedSession,
  ProfileSyncPayload,
  RegisterPayload,
  Role,
} from "@/types/api";

const PENDING_PROFILE_KEY = "nusphere_pending_profile";

type PendingProfile = {
  email: string;
  profile: ProfileSyncPayload;
};

export type SignUpResult =
  | { status: "authenticated"; session: AuthenticatedSession }
  | { status: "confirmation-required"; email: string };

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function savePendingProfile(email: string, profile: ProfileSyncPayload): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    PENDING_PROFILE_KEY,
    JSON.stringify({ email: normaliseEmail(email), profile }),
  );
}

function readPendingProfile(email?: string): ProfileSyncPayload | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PENDING_PROFILE_KEY);
  if (!raw) return null;

  try {
    const pending = JSON.parse(raw) as PendingProfile;
    if (
      !pending.profile ||
      (email && pending.email !== normaliseEmail(email))
    ) {
      return null;
    }
    return pending.profile;
  } catch {
    window.localStorage.removeItem(PENDING_PROFILE_KEY);
    return null;
  }
}

function clearPendingProfile(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(PENDING_PROFILE_KEY);
  }
}

export async function authenticateSession(
  session: Session,
): Promise<AuthenticatedSession> {
  const token = session.access_token;
  const pendingProfile = readPendingProfile(session.user.email);

  try {
    const user = await fetchCurrentUser(token);
    if (pendingProfile) clearPendingProfile();
    return { token, user };
  } catch (error) {
    if (!pendingProfile) throw error;
    const user = await syncProfile(token, pendingProfile);
    clearPendingProfile();
    return { token, user };
  }
}

export async function signIn(
  email: string,
  password: string,
  expectedRole: Role,
): Promise<AuthenticatedSession> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normaliseEmail(email),
    password,
  });
  if (error) throw error;
  if (!data.session)
    throw new Error("Supabase did not return a login session.");

  const authenticated = await authenticateSession(data.session);
  if (authenticated.user.role !== expectedRole) {
    await supabase.auth.signOut({ scope: "local" });
    throw new Error(
      `This account is registered as a ${authenticated.user.role}. Select the correct account type and try again.`,
    );
  }
  return authenticated;
}

export async function signUp(payload: RegisterPayload): Promise<SignUpResult> {
  const supabase = getSupabaseClient();
  const { email, password, ...profile } = payload;
  const normalisedEmail = normaliseEmail(email);
  const emailRedirectTo =
    typeof window === "undefined" ? undefined : window.location.origin;

  const { data, error } = await supabase.auth.signUp({
    email: normalisedEmail,
    password,
    options: {
      emailRedirectTo,
      data: {
        nusphere_role: profile.role,
        nusphere_name: profile.name,
      },
    },
  });
  if (error) throw error;

  savePendingProfile(normalisedEmail, profile);
  if (!data.session) {
    return {
      status: "confirmation-required",
      email: normalisedEmail,
    };
  }

  return {
    status: "authenticated",
    session: await authenticateSession(data.session),
  };
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut({ scope: "local" });
  if (error) throw error;
}
