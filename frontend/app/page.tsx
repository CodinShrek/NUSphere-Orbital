"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { AuthScreen } from "@/components/auth/AuthScreen";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { PendingConnectionRequests } from "@/components/dashboard/PendingConnectionRequests";
import { AppShell } from "@/components/layout/AppShell";
import { MessagingCenter } from "@/components/messaging/MessagingCenter";
import { FindMentors } from "@/components/mentors/FindMentors";
import { MentorProfile } from "@/components/mentors/MentorProfile";
import { UserProfile } from "@/components/profile/UserProfile";
import { QAArchive } from "@/components/qa/QAArchive";
import {
  acceptConnection,
  answerQuestion,
  createQuestion,
  fetchConversations,
  fetchConnections,
  fetchNotificationUnreadCount,
  fetchNotifications,
  fetchQuestions,
  fetchRecommendations,
  markAllNotificationsRead,
  markConversationRead,
  markNotificationRead,
  requestConnection,
  sendConversationMessage,
  startConversation,
  suggestDuplicateQuestions,
  updateConversationState,
  updateProfile,
} from "@/lib/api";
import { authenticateSession, signOut } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import type {
  AuthenticatedSession,
  AvailabilitySlot,
  Connection,
  Conversation,
  DuplicateQuestionSuggestion,
  Mentor,
  Notification,
  Question,
  User,
  VerificationStatus,
} from "@/types/api";
import type { View } from "@/types/navigation";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState("");
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [activeConversationId, setActiveConversationId] = useState("");
  const [activeView, setActiveView] = useState<View>("home");
  const [selectedMentorId, setSelectedMentorId] = useState("");
  const [error, setError] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const authAttempt = useRef(0);
  const selectedMentor = mentors.find((mentor) => mentor.id === selectedMentorId) ?? mentors[0];

  useEffect(() => {
    let active = true;
    let supabase: ReturnType<typeof getSupabaseClient>;
    try {
      supabase = getSupabaseClient();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Supabase is not configured",
      );
      setAuthLoading(false);
      return;
    }

    function clearAuthenticatedState() {
      setToken("");
      setUser(null);
      setMentors([]);
      setQuestions([]);
      setConnections([]);
      setConversations([]);
      setNotifications([]);
      setNotificationUnreadCount(0);
      setActiveConversationId("");
      setActiveView("home");
    }

    async function restoreSession(session: Session | null) {
      const attempt = ++authAttempt.current;
      if (!session) {
        if (active) {
          clearAuthenticatedState();
          setAuthLoading(false);
        }
        return;
      }

      try {
        const authenticated = await authenticateSession(session);
        if (!active || attempt !== authAttempt.current) return;
        setToken(authenticated.token);
        setUser(authenticated.user);
        setError("");
      } catch (err) {
        if (!active || attempt !== authAttempt.current) return;
        clearAuthenticatedState();
        setError(
          err instanceof Error ? err.message : "Unable to restore your session",
        );
      } finally {
        if (active && attempt === authAttempt.current) setAuthLoading(false);
      }
    }

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "INITIAL_SESSION") return;
        if (event === "SIGNED_OUT" || !session) {
          ++authAttempt.current;
          clearAuthenticatedState();
          setAuthLoading(false);
          return;
        }
        if (event === "TOKEN_REFRESHED") {
          setToken(session.access_token);
          return;
        }
        window.setTimeout(() => void restoreSession(session), 0);
      },
    );

    void supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (sessionError) throw sessionError;
        return restoreSession(data.session);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Unable to restore your session",
        );
        setAuthLoading(false);
      });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchRecommendations(user)
      .then(setMentors)
      .catch((err: Error) => setError(err.message));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchQuestions()
      .then(setQuestions)
      .catch((err: Error) => setError(err.message));
  }, [user]);

  useEffect(() => {
    if (!token) return;
    fetchConnections(token)
      .then(setConnections)
      .catch((err: Error) => setError(err.message));
    fetchConversations(token)
      .then((items) => {
        setConversations(items);
        setActiveConversationId((current) => current || items[0]?.id || "");
      })
      .catch((err: Error) => setError(err.message));
    setNotificationsLoading(true);
    setNotificationError("");
    Promise.all([fetchNotifications(token), fetchNotificationUnreadCount(token)])
      .then(([items, unread]) => {
        setNotifications(items);
        setNotificationUnreadCount(unread.unread_count);
      })
      .catch((err: Error) => setNotificationError(err.message))
      .finally(() => setNotificationsLoading(false));
  }, [token]);

  function handleAuthenticated(response: AuthenticatedSession) {
    setToken(response.token);
    setUser(response.user);
    setError("");
    setActiveView("home");
  }

  async function handleLogout() {
    try {
      await signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign out");
    } finally {
      setToken("");
      setUser(null);
      setMentors([]);
      setQuestions([]);
      setConnections([]);
      setConversations([]);
      setNotifications([]);
      setNotificationUnreadCount(0);
      setActiveConversationId("");
      setActiveView("home");
    }
  }

  async function handleCreateQuestion(payload: { title: string; topic: string; body: string; tags: string[]; attachments: string[] }) {
    if (!token) return;
    const created = await createQuestion(token, payload);
    setQuestions((current) => [created, ...current]);
    await refreshNotifications();
  }

  async function handleSuggestDuplicateQuestions(payload: { title: string; topic: string; body: string; tags: string[] }): Promise<DuplicateQuestionSuggestion[]> {
    if (!token) return [];
    return suggestDuplicateQuestions(token, payload);
  }

  async function handleAnswerQuestion(questionId: string, body: string) {
    if (!token) return;
    const updated = await answerQuestion(token, questionId, body);
    setQuestions((current) => current.map((question) => (question.id === updated.id ? updated : question)));
    await refreshNotifications();
  }

  async function handleRequestConnection(mentorId: string) {
    if (!token) return;
    setError("");
    try {
      const connection = await requestConnection(token, mentorId);
      setConnections((current) => [connection, ...current.filter((item) => item.id !== connection.id)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to request connection");
    }
  }

  async function handleStartConversation(mentorId: string) {
    if (!token) return;
    setError("");
    try {
      const conversation = await startConversation(token, mentorId);
      setConversations((current) => {
        const withoutDuplicate = current.filter((item) => item.id !== conversation.id);
        return [conversation, ...withoutDuplicate];
      });
      setActiveConversationId(conversation.id);
      setActiveView("messages");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection must be accepted before messaging");
    }
  }

  async function handleAcceptConnection(connectionId: string) {
    if (!token) return;
    const conversation = await acceptConnection(token, connectionId);
    setConnections((current) => current.map((item) => (item.id === connectionId ? { ...item, status: "accepted" } : item)));
    setConversations((current) => [conversation, ...current.filter((item) => item.id !== conversation.id)]);
    setActiveConversationId(conversation.id);
    setActiveView("messages");
  }

  async function handleSendMessage(conversationId: string, body: string) {
    if (!token) return;
    const updated = await sendConversationMessage(token, conversationId, body);
    setConversations((current) => current.map((conversation) => (conversation.id === updated.id ? updated : conversation)));
    await refreshNotifications();
  }

  async function refreshNotifications() {
    if (!token) return;
    setNotificationsLoading(true);
    setNotificationError("");
    try {
      const [items, unread] = await Promise.all([
        fetchNotifications(token),
        fetchNotificationUnreadCount(token),
      ]);
      setNotifications(items);
      setNotificationUnreadCount(unread.unread_count);
    } catch (err) {
      setNotificationError(err instanceof Error ? err.message : "Unable to load notifications");
    } finally {
      setNotificationsLoading(false);
    }
  }

  async function handleMarkNotificationRead(notificationId: string) {
    if (!token) return;
    const wasUnread = notifications.some((item) => item.id === notificationId && !item.is_read);
    const updated = await markNotificationRead(token, notificationId);
    setNotifications((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    if (wasUnread) setNotificationUnreadCount((current) => Math.max(0, current - 1));
  }

  async function handleMarkAllNotificationsRead() {
    if (!token) return;
    await markAllNotificationsRead(token);
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((item) => ({ ...item, is_read: true, read_at: item.read_at ?? readAt })));
    setNotificationUnreadCount(0);
  }

  async function handleMarkConversationRead(conversationId: string) {
    if (!token) return;
    const updated = await markConversationRead(token, conversationId);
    setConversations((current) => current.map((conversation) => (conversation.id === updated.id ? updated : conversation)));
  }

  async function handleUpdateConversationState(
    conversationId: string,
    payload: { is_pinned?: boolean; is_archived?: boolean; is_muted?: boolean },
  ) {
    if (!token) return;
    const updated = await updateConversationState(token, conversationId, payload);
    setConversations((current) => current.map((conversation) => (conversation.id === updated.id ? updated : conversation)));
  }

  async function handleSaveProfile(payload: Parameters<typeof updateProfile>[1]) {
    if (!token) return;
    setError("");
    try {
      const updated = await updateProfile(token, payload);
      setUser(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update profile");
      throw err;
    }
  }

  function handleAvailabilityChange(
    mentorId: string,
    availability: AvailabilitySlot[],
  ) {
    setMentors((current) =>
      current.map((mentor) =>
        mentor.id === mentorId ? { ...mentor, availability } : mentor,
      ),
    );
  }

  function handleVerificationChange(status: VerificationStatus) {
    setUser((current) => (current ? { ...current, verification_status: status } : current));
    setMentors((current) =>
      current.map((mentor) =>
        mentor.id === user?.id
          ? { ...mentor, verification_status: status }
          : mentor,
      ),
    );
  }

  async function refreshMentorData() {
    if (!user) return;
    try {
      setMentors(await fetchRecommendations(user));
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Unable to refresh mentor information",
      );
    }
  }

  function handleOpenMentorProfile(mentorId: string) {
    setSelectedMentorId(mentorId);
    setActiveView("mentor-profile");
  }

  if (authLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[linear-gradient(120deg,#f2f5ff,#ffffff)] px-5">
        <div className="card px-8 py-7 text-center shadow-soft">
          <p className="font-black text-nusPurple">NUSphere</p>
          <p className="mt-2 text-sm font-semibold text-[#737b8f]">
            Restoring your session...
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return <AuthScreen error={error} onError={setError} onAuthenticated={handleAuthenticated} />;
  }

  return (
    <AppShell
      activeView={activeView}
      setActiveView={setActiveView}
      user={user}
      notifications={notifications}
      notificationUnreadCount={notificationUnreadCount}
      notificationsLoading={notificationsLoading}
      notificationError={notificationError}
      setActiveConversationId={setActiveConversationId}
      onRefreshNotifications={refreshNotifications}
      onMarkNotificationRead={handleMarkNotificationRead}
      onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
      onLogout={handleLogout}
    >
      {activeView === "home" && <Dashboard user={user} questions={questions} connections={connections} conversations={conversations} setActiveView={setActiveView} onAcceptConnection={handleAcceptConnection} />}
      {activeView === "find" && <FindMentors mentors={mentors} connections={connections} token={token} user={user} onOpenMentorProfile={handleOpenMentorProfile} onRequestConnection={handleRequestConnection} onStartConversation={handleStartConversation} />}
      {activeView === "qa" && <QAArchive user={user} questions={questions} onCreateQuestion={handleCreateQuestion} onAnswerQuestion={handleAnswerQuestion} onSuggestDuplicates={handleSuggestDuplicateQuestions} />}
      {activeView === "messages" && (
        <MessagingCenter
          user={user}
          conversations={conversations}
          activeConversationId={activeConversationId}
          setActiveConversationId={setActiveConversationId}
          pendingRequests={<PendingConnectionRequests user={user} connections={user.role === "mentor" ? connections.filter((connection) => connection.status === "pending" && connection.mentor_id === user.id) : connections.filter((connection) => connection.status === "pending" && connection.student_id === user.id)} onAcceptConnection={handleAcceptConnection} />}
          onSendMessage={handleSendMessage}
          onMarkRead={handleMarkConversationRead}
          onUpdateState={handleUpdateConversationState}
          setActiveView={setActiveView}
        />
      )}
      {activeView === "mentor-profile" && <MentorProfile mentor={selectedMentor} connection={connections.find((item) => item.mentor_id === selectedMentor?.id || item.student_id === selectedMentor?.id)} token={token} user={user} setActiveView={setActiveView} onRequestConnection={handleRequestConnection} onStartConversation={handleStartConversation} onReviewsChange={refreshMentorData} />}
      {activeView === "my-profile" && <UserProfile user={user} token={token} setActiveView={setActiveView} onSaveProfile={handleSaveProfile} onAvailabilityChange={handleAvailabilityChange} onVerificationChange={handleVerificationChange} />}
    </AppShell>
  );
}
