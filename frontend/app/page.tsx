"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Search, Star, Zap } from "lucide-react";

import { AuthScreen } from "@/components/auth/AuthScreen";
import { AppShell } from "@/components/layout/AppShell";
import { OptionDatalist, TextAreaInput, TextInput } from "@/components/ui/FormControls";
import {
  accommodationOptions,
  ccas,
  departmentsByFaculty,
  exchangeUniversities,
  facultyMajors,
  mentorTypes,
  opportunities,
  pastel,
} from "@/data/profile-options";
import {
  acceptConnection,
  answerQuestion,
  createQuestion,
  fetchAiGoalMatches,
  fetchAiProfileMatches,
  fetchConversations,
  fetchConnections,
  fetchCurrentUser,
  fetchQuestions,
  fetchRecommendations,
  logout,
  requestConnection,
  sendConversationMessage,
  startConversation,
  updateProfile,
} from "@/lib/api";
import { splitList } from "@/lib/profile-utils";
import type { AuthResponse, Connection, Conversation, Mentor, MentorType, Question, User } from "@/types/api";
import type { View } from "@/types/navigation";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState("");
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [activeView, setActiveView] = useState<View>("home");
  const [selectedMentorId, setSelectedMentorId] = useState("");
  const [error, setError] = useState("");
  const selectedMentor = mentors.find((mentor) => mentor.id === selectedMentorId) ?? mentors[0];

  useEffect(() => {
    const savedToken = window.localStorage.getItem("nusphere_token");
    if (!savedToken) return;

    fetchCurrentUser(savedToken)
      .then((currentUser) => {
        setToken(savedToken);
        setUser(currentUser);
      })
      .catch(() => window.localStorage.removeItem("nusphere_token"));
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
  }, [token]);

  function handleAuthenticated(response: AuthResponse) {
    setToken(response.token);
    setUser(response.user);
    setActiveView("home");
    window.localStorage.setItem("nusphere_token", response.token);
  }

  async function handleLogout() {
    if (token) {
      await logout(token).catch(() => undefined);
    }
    setToken("");
    setUser(null);
    setMentors([]);
    setQuestions([]);
    setConnections([]);
    setConversations([]);
    setActiveConversationId("");
    setActiveView("home");
    window.localStorage.removeItem("nusphere_token");
  }

  async function handleCreateQuestion(payload: { title: string; topic: string; body: string; tags: string[]; attachments: string[] }) {
    if (!token) return;
    const created = await createQuestion(token, payload);
    setQuestions((current) => [created, ...current]);
  }

  async function handleAnswerQuestion(questionId: string, body: string) {
    if (!token) return;
    const updated = await answerQuestion(token, questionId, body);
    setQuestions((current) => current.map((question) => (question.id === updated.id ? updated : question)));
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

  function handleOpenMentorProfile(mentorId: string) {
    setSelectedMentorId(mentorId);
    setActiveView("mentor-profile");
  }

  if (!user) {
    return <AuthScreen error={error} onError={setError} onAuthenticated={handleAuthenticated} />;
  }

  return (
    <AppShell activeView={activeView} setActiveView={setActiveView} user={user} onLogout={handleLogout}>
      {activeView === "home" && <Dashboard user={user} questions={questions} connections={connections} conversations={conversations} setActiveView={setActiveView} onAcceptConnection={handleAcceptConnection} />}
      {activeView === "find" && <FindMentors mentors={mentors} connections={connections} token={token} user={user} onOpenMentorProfile={handleOpenMentorProfile} onRequestConnection={handleRequestConnection} onStartConversation={handleStartConversation} />}
      {activeView === "qa" && <QAPlatform user={user} questions={questions} onCreateQuestion={handleCreateQuestion} onAnswerQuestion={handleAnswerQuestion} />}
      {activeView === "messages" && <Messages user={user} connections={connections} conversations={conversations} activeConversationId={activeConversationId} setActiveConversationId={setActiveConversationId} onAcceptConnection={handleAcceptConnection} onSendMessage={handleSendMessage} setActiveView={setActiveView} />}
      {activeView === "mentor-profile" && <MentorProfile mentor={selectedMentor} connection={connections.find((item) => item.mentor_id === selectedMentor?.id || item.student_id === selectedMentor?.id)} setActiveView={setActiveView} onRequestConnection={handleRequestConnection} onStartConversation={handleStartConversation} />}
      {activeView === "my-profile" && <UserProfile user={user} setActiveView={setActiveView} onSaveProfile={handleSaveProfile} />}
    </AppShell>
  );
}

function frequentQuestionTerms(questions: Question[]) {
  const counts = new Map<string, number>();
  questions.slice(0, 12).forEach((question) => {
    [...question.tags, ...(question.key_terms ?? []), question.topic]
      .map((term) => term.trim())
      .filter(Boolean)
      .forEach((term) => {
        const key = term.toLowerCase();
        const existing = Array.from(counts.keys()).find((item) => item.toLowerCase() === key) ?? term;
        counts.set(existing, (counts.get(existing) ?? 0) + 1);
      });
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([term]) => term)
    .slice(0, 10);
}

function profileCompletion(user: User) {
  const checks = [
    user.name,
    user.email,
    user.faculty,
    user.major,
    user.bio,
    user.interests.length,
    user.goals.length,
    user.modules_taken.length,
    user.ccas.length,
    user.nus_opportunities.length,
  ];
  const complete = checks.filter(Boolean).length;
  return Math.round((complete / checks.length) * 100);
}

function PendingConnectionRequests({ user, connections, onAcceptConnection }: { user: User; connections: Connection[]; onAcceptConnection: (connectionId: string) => void }) {
  if (!connections.length) {
    return (
      <Panel title="Pending Connection Requests">
        <p className="font-medium text-[#737b8f]">{user.role === "mentor" ? "No pending connection requests right now." : "No mentor requests are waiting for approval right now."}</p>
      </Panel>
    );
  }

  return (
    <Panel title="Pending Connection Requests">
      <div className="space-y-3">
        {connections.map((connection) => (
          <div key={connection.id} className="rounded-xl border border-[#d4dae8] p-4">
            <p className="font-black">{user.role === "mentor" ? connection.student_name : connection.mentor_name}</p>
            <p className="text-sm font-medium text-[#737b8f]">
              {user.role === "mentor" ? `Wants to connect about ${connection.mentor_programme}` : `Waiting for approval about ${connection.mentor_programme}`}
            </p>
            {user.role === "mentor" ? (
              <button className="mt-3 h-10 rounded-xl bg-nusPurple px-4 font-bold text-white" onClick={() => onAcceptConnection(connection.id)}>Accept connection</button>
            ) : (
              <span className="mt-3 inline-flex h-10 items-center rounded-xl bg-[#fff8ef] px-4 font-bold text-[#c94a12]">Pending mentor approval</span>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function mentorTypeLabel(user: User) {
  const labels: Record<MentorType, string> = {
    senior: "Senior",
    alumni: "Alumni",
    professor: "Professor",
    nus_staff: "NUS Staff",
    other: user.mentor_type_other || "Other",
  };
  return user.mentor_type ? labels[user.mentor_type] : "Mentor";
}

function Dashboard({
  user,
  questions,
  connections,
  conversations,
  setActiveView,
  onAcceptConnection,
}: {
  user: User;
  questions: Question[];
  connections: Connection[];
  conversations: Conversation[];
  setActiveView: (view: View) => void;
  onAcceptConnection: (connectionId: string) => void;
}) {
  const acceptedConnections = connections.filter((connection) => connection.status === "accepted");
  const pendingForMentor = connections.filter((connection) => connection.status === "pending" && connection.mentor_id === user.id);
  const pendingForStudent = connections.filter((connection) => connection.status === "pending" && connection.student_id === user.id);
  const unreadConversations = conversations.filter((conversation) => conversation.messages.at(-1)?.sender_id !== user.id);
  const completion = profileCompletion(user);
  const relatedPosts = questions
    .filter((question) => {
      const searchable = [question.title, question.topic, question.body, ...question.tags, ...question.key_terms].join(" ").toLowerCase();
      return [user.major, user.faculty, ...user.interests].some((term) => term && searchable.includes(term.toLowerCase()));
    })
    .slice(0, 4);
  return (
    <>
      <section className="bg-[linear-gradient(105deg,#5f16ee,#4f00bf_55%,#b213f0)] px-8 py-8 text-white">
        <h2 className="brand-serif text-3xl font-black">Good morning, {user.name}</h2>
        <p className="mt-2 text-lg font-medium text-white/85">Your mentorship workspace is summarised below.</p>
        <div className="mt-6 grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
          <Metric value={acceptedConnections.length} label={user.role === "mentor" ? "Connected students" : "Connected mentors"} />
          <Metric value={unreadConversations.length} label="Unread messages" />
          <Metric value={relatedPosts.length} label="Major-related posts" />
          <Metric value={completion + "%"} label="Profile complete" />
        </div>
      </section>
      <section className="grid grid-cols-[1fr_360px] gap-7 p-8 max-xl:grid-cols-1">
        <div className="space-y-6">
          <Panel title={user.role === "mentor" ? "Connected students" : "Connected mentors"} action="Messages" onAction={() => setActiveView("messages")}>
            <div className="space-y-4">
              {acceptedConnections.slice(0, 4).map((connection) => (
                <div key={connection.id} className="rounded-2xl border border-[#d4dae8] p-4">
                  <p className="font-black">{user.role === "mentor" ? connection.student_name : connection.mentor_name}</p>
                  <p className="mt-1 font-medium text-[#737b8f]">{connection.mentor_programme}</p>
                  <button className="mt-3 h-10 rounded-xl bg-nusPurple px-4 font-bold text-white" onClick={() => setActiveView("messages")}>Open messages</button>
                </div>
              ))}
              {!acceptedConnections.length && <p className="font-medium text-[#737b8f]">No accepted connections yet.</p>}
            </div>
          </Panel>
          <Panel title={`Recent posts related to ${user.major}`}>
            <div className="space-y-3">
              {relatedPosts.map((question) => (
                <div key={question.id} className="rounded-2xl border border-[#d4dae8] p-4">
                  <p className="text-sm font-black uppercase text-[#9aa1b3]">{question.topic}</p>
                  <p className="mt-1 font-black">{question.title}</p>
                  <p className="mt-1 text-sm font-medium text-[#737b8f]">{question.answers.length} mentor answers</p>
                </div>
              ))}
              {!relatedPosts.length && <p className="font-medium text-[#737b8f]">No recent Q&A posts match your major yet.</p>}
            </div>
          </Panel>
        </div>
        <aside className="space-y-6">
          <Panel title="PROFILE COMPLETION">
            <p className="brand-serif text-3xl font-black">{completion}%</p>
            <div className="mt-3 h-2 rounded-full bg-[#eef1f7]">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#5f16ee,#ff6508)]" style={{ width: `${completion}%` }} />
            </div>
            <p className="mt-4 font-medium text-[#737b8f]">Add goals and interests to improve your mentor matches.</p>
            <button className="mt-4 h-11 w-full rounded-xl border border-[#a7bdf5] font-bold text-nusPurple" onClick={() => setActiveView("my-profile")}>Complete profile</button>
          </Panel>
          <Panel title="UNREAD MESSAGES">
            {unreadConversations.slice(0, 3).map((conversation) => (
              <button key={conversation.id} className="block w-full border-b border-[#eef1f7] py-3 text-left last:border-b-0" onClick={() => setActiveView("messages")}>
                <span className="block font-black">{user.role === "mentor" ? conversation.student_name : conversation.mentor_name}</span>
                <span className="mt-1 block truncate text-sm font-medium text-[#737b8f]">{conversation.last_message}</span>
              </button>
            ))}
            {!unreadConversations.length && <p className="font-medium text-[#737b8f]">No unread messages.</p>}
          </Panel>
          <PendingConnectionRequests user={user} connections={user.role === "mentor" ? pendingForMentor : pendingForStudent} onAcceptConnection={onAcceptConnection} />
          <div className="rounded-[18px] bg-[linear-gradient(135deg,#ff6508,#f04405)] p-6 text-white">
            <div className="flex items-center gap-2 font-black">
              <Bot size={20} />
              AI Assistant
            </div>
            <p className="mt-2 text-sm text-white/85">Short NUS context clarifications can live here after Milestone 1.</p>
          </div>
        </aside>
      </section>
    </>
  );
}

function FindMentors({
  mentors,
  connections,
  token,
  user,
  onOpenMentorProfile,
  onRequestConnection,
  onStartConversation,
}: {
  mentors: Mentor[];
  connections: Connection[];
  token: string;
  user: User;
  onOpenMentorProfile: (mentorId: string) => void;
  onRequestConnection: (mentorId: string) => void;
  onStartConversation: (mentorId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [aiMode, setAiMode] = useState<"standard" | "profile" | "goal">("standard");
  const [goalQuery, setGoalQuery] = useState("I want a mentor who understands my academic pathway, NUS opportunities, and goals, and can guide me based on similar experience.");
  const [aiMentors, setAiMentors] = useState<Mentor[]>([]);
  const [profileScoreMap, setProfileScoreMap] = useState<Record<string, number>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedFaculties, setSelectedFaculties] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [minimumScore, setMinimumScore] = useState(0);
  const filters = ["All", "Seniors", "Professors", "Computing", "Business", "Research", "NOC", "CCAs"];
  const facultyOptions = useMemo(() => Array.from(new Set(mentors.map((mentor) => mentor.faculty))).filter(Boolean), [mentors]);
  const interestOptions = useMemo(
    () => Array.from(new Set(mentors.flatMap((mentor) => mentor.interests.concat(mentor.experience_tags)).filter(Boolean))).slice(0, 12),
    [mentors],
  );
  const filteredMentors = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return mentors
      .filter((mentor) => {
        const searchable = [
          mentor.name,
          mentor.year,
          mentor.programme,
          mentor.faculty,
          mentor.role,
          mentor.bio,
          ...mentor.interests,
          ...mentor.experience_tags,
          ...mentor.experience,
          ...mentor.match_reasons,
        ]
          .join(" ")
          .toLowerCase();
        const matchesQuery = !normalizedQuery || normalizedQuery.split(/\s+/).every((term) => searchable.includes(term));
        const matchesQuickFilter =
          activeFilter === "All" ||
          (activeFilter === "Seniors" && searchable.includes("senior")) ||
          (activeFilter === "Professors" && searchable.includes("professor")) ||
          (activeFilter === "CCAs" && mentor.experience_tags.some((tag) => !tag.match(/^[A-Z]{2,}\d/) && tag.length > 3)) ||
          searchable.includes(activeFilter.toLowerCase());
        const matchesFaculty = selectedFaculties.length === 0 || selectedFaculties.includes(mentor.faculty);
        const matchesInterests =
          selectedInterests.length === 0 ||
          selectedInterests.every((interest) => mentor.interests.concat(mentor.experience_tags).some((tag) => tag.toLowerCase().includes(interest.toLowerCase())));
        return matchesQuery && matchesQuickFilter && matchesFaculty && matchesInterests && mentor.match_score >= minimumScore;
      })
      .sort((first, second) => second.match_score - first.match_score);
  }, [activeFilter, mentors, minimumScore, query, selectedFaculties, selectedInterests]);
  useEffect(() => {
    if (!token || user.role !== "student") return;
    fetchAiProfileMatches(token)
      .then((items) => {
        setProfileScoreMap(Object.fromEntries(items.map((mentor) => [mentor.id, mentor.profile_match_score ?? mentor.match_score])));
      })
      .catch(() => undefined);
  }, [token, user.role]);
  const displayedMentors = (aiMode === "standard" ? filteredMentors : aiMentors).map((mentor) => ({
    ...mentor,
    profile_match_score: mentor.profile_match_score ?? profileScoreMap[mentor.id],
  }));

  function toggleValue(value: string, current: string[], setCurrent: (values: string[]) => void) {
    setCurrent(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function clearFilters() {
    setQuery("");
    setActiveFilter("All");
    setSelectedFaculties([]);
    setSelectedInterests([]);
    setMinimumScore(0);
  }

  function connectionForMentor(mentorId: string) {
    return connections.find((connection) => connection.mentor_id === mentorId || connection.student_id === mentorId);
  }

  async function runAiProfileMatch() {
    if (!token || user.role !== "student") return;
    setAiLoading(true);
    setAiError("");
    try {
      setAiMentors(await fetchAiProfileMatches(token));
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Unable to run AI profile match");
    } finally {
      setAiLoading(false);
    }
  }

  async function runAiGoalSearch() {
    if (!token || user.role !== "student") return;
    setAiLoading(true);
    setAiError("");
    try {
      setAiMentors(await fetchAiGoalMatches(token, goalQuery, 0));
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Unable to run AI goal search");
    } finally {
      setAiLoading(false);
    }
  }

  function switchAiMode(mode: "standard" | "profile" | "goal") {
    setAiMode(mode);
    setAiError("");
    if (mode === "standard") return;
    setMinimumScore(0);
    if (user.role !== "student") {
      setAiError("AI mentor search is currently available for student accounts.");
      return;
    }
    if (mode === "profile") void runAiProfileMatch();
  }

  return (
    <section>
      <div className="border-b border-[#cfd6e6] bg-white px-8 py-6">
        <div className="mb-5 grid max-w-3xl grid-cols-3 rounded-xl border border-[#c8cfde] p-1 max-md:grid-cols-1">
          {[
            ["standard", "Standard Search"],
            ["profile", "AI Profile Match"],
            ["goal", "AI Goal Search"],
          ].map(([mode, label]) => (
            <button key={mode} className={`rounded-lg px-4 py-3 font-bold ${aiMode === mode ? "bg-nusPurple text-white" : "text-[#687086]"}`} onClick={() => switchAiMode(mode as "standard" | "profile" | "goal")}>
              {label}
            </button>
          ))}
        </div>
        {aiMode === "profile" && (
          <div className="mb-5 rounded-2xl border border-[#d4dae8] bg-[#f8faff] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-black">Complete profile match</p>
                <p className="mt-1 text-sm font-medium text-[#737b8f]">Ranks mentors by semantic fit between your full profile and each mentor profile.</p>
              </div>
              <button className="h-11 rounded-xl bg-nusPurple px-5 font-bold text-white disabled:opacity-60" onClick={runAiProfileMatch} disabled={aiLoading || user.role !== "student"}>{aiLoading ? "Matching..." : "Refresh AI matches"}</button>
            </div>
          </div>
        )}
        {aiMode === "goal" && (
          <div className="mb-5 rounded-2xl border border-[#d4dae8] bg-[#f8faff] p-4">
            <label className="block text-sm font-bold text-[#3f4659]">
              Describe your goal and ideal mentor
              <textarea className="field mt-2 min-h-28 resize-y py-3" value={goalQuery} onChange={(event) => setGoalQuery(event.target.value)} placeholder="Describe what you want to achieve and what kind of experience you want in a mentor." />
            </label>
            <button className="mt-3 h-11 rounded-xl bg-nusPurple px-5 font-bold text-white disabled:opacity-60" onClick={runAiGoalSearch} disabled={aiLoading || user.role !== "student" || goalQuery.trim().length < 20}>{aiLoading ? "Searching..." : "Find AI matches"}</button>
          </div>
        )}
        {aiError && <p className="mb-5 rounded-xl bg-[#fff1f0] px-4 py-3 text-sm font-bold text-[#c02b18]">{aiError}</p>}
        {aiMode === "standard" && (
          <>
            <div className="flex gap-4">
              <label className="relative flex-1">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[#8991a5]" size={20} />
                <input className="field h-14 pl-14" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, major, interest, CCA, exchange destination..." />
              </label>
              <button className="h-14 rounded-xl bg-nusPurple px-8 font-bold text-white" onClick={() => setQuery(query.trim())}>Search</button>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {filters.map((filter) => (
                <button key={filter} onClick={() => setActiveFilter(filter)} className={`rounded-full border px-5 py-3 font-bold ${activeFilter === filter ? "border-nusPurple bg-nusPurple text-white" : "border-[#c8cfde] bg-white text-[#687086]"}`}>
                  {filter}
                </button>
              ))}
            </div>
            <div className="mt-5 grid gap-5 rounded-2xl border border-[#d4dae8] bg-[#f8faff] p-4 xl:grid-cols-[1.1fr_1.4fr_260px]">
              <div>
                <p className="text-sm font-black uppercase text-[#9aa1b3]">Faculty</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(facultyOptions.length ? facultyOptions : ["Computing", "Business", "Design and Engineering", "Medicine"]).map((faculty) => (
                    <button
                      key={faculty}
                      onClick={() => toggleValue(faculty, selectedFaculties, setSelectedFaculties)}
                      className={`rounded-full border px-4 py-2 text-sm font-bold ${selectedFaculties.includes(faculty) ? "border-nusPurple bg-nusPurple text-white" : "border-[#c8cfde] bg-white text-[#687086]"}`}
                    >
                      {faculty}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-black uppercase text-[#9aa1b3]">Interests</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(interestOptions.length ? interestOptions : ["AI/Machine Learning", "Research", "NUS Overseas Colleges"]).map((tag, index) => (
                    <button key={tag} onClick={() => toggleValue(tag, selectedInterests, setSelectedInterests)} className={`chip border ${selectedInterests.includes(tag) ? "border-nusPurple bg-nusPurple text-white" : `${pastel[index % pastel.length]} border-transparent`}`}>
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black uppercase text-[#9aa1b3]">Min. match</p>
                  <span className="font-black text-nusPurple">{minimumScore}%</span>
                </div>
                <input className="mt-4 w-full accent-nusPurple" type="range" min={0} max={99} value={minimumScore} onChange={(event) => setMinimumScore(Number(event.target.value))} />
              </div>
            </div>
          </>
        )}
      </div>
      <div className="p-8">
        <div className="mx-auto max-w-[1320px]">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="font-medium text-[#737b8f]">Showing {displayedMentors.length} of {aiMode === "standard" ? mentors.length : aiMentors.length} mentors - sorted by {aiMode === "standard" ? "match score" : "AI fit"}</p>
            {(query || activeFilter !== "All" || selectedFaculties.length || selectedInterests.length || minimumScore !== 0) && (
              <button className="font-bold text-nusPurple" onClick={clearFilters}>Clear filters</button>
            )}
          </div>
          <div className="space-y-5">
            {displayedMentors.map((mentor) => (
                <MentorCard key={mentor.id} mentor={mentor} connection={connectionForMentor(mentor.id)} onProfile={() => onOpenMentorProfile(mentor.id)} onConnect={() => onRequestConnection(mentor.id)} onMessage={() => onStartConversation(mentor.id)} />
            ))}
            {!displayedMentors.length && (
              <div className="card p-8 text-center">
                <p className="text-xl font-black">No mentors match these filters yet.</p>
                <p className="mt-2 font-medium text-[#737b8f]">{aiMode === "standard" ? "Try a broader search term, lower the match score, or clear the selected filters." : "Run an AI match or lower the minimum score."}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function UserProfile({ user, setActiveView, onSaveProfile }: { user: User; setActiveView: (view: View) => void; onSaveProfile: (payload: Parameters<typeof updateProfile>[1]) => Promise<void> }) {
  const completion = profileCompletion(user);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    name: user.name,
    faculty: user.faculty,
    major: user.major,
    modules_taken: user.modules_taken.join(", "),
    ccas: user.ccas.join(", "),
    nus_opportunities: user.nus_opportunities.join(", "),
    exchange_universities: user.exchange_universities.join(", "),
    accommodation: user.accommodation,
    interests: user.interests.join(", "),
    goals: user.goals.join(", "),
    bio: user.bio,
    mentorship_goals: user.mentorship_goals ?? "",
    mentor_type: user.mentor_type ?? "senior",
    mentor_type_other: user.mentor_type_other ?? "",
    graduation_year: user.graduation_year ?? "",
    current_role: user.current_role ?? "",
    organisation: user.organisation ?? "",
    department: user.department ?? "",
    consultation_hours: user.consultation_hours ?? "",
    modules_taught: user.modules_taught.join(", "),
    areas_of_expertise: user.areas_of_expertise.join(", "),
    office_location: user.office_location ?? "",
    office: user.office ?? "",
    profile_picture: user.profile_picture ?? "",
  });
  const majorOptions = facultyMajors[draft.faculty] ?? [];
  const departmentOptions = departmentsByFaculty[draft.faculty] ?? [];

  function updateDraft(field: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function handleProfilePhoto(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateDraft("profile_picture", String(reader.result ?? ""));
    reader.readAsDataURL(file);
  }

  async function save() {
    setSaving(true);
    try {
      await onSaveProfile({
        name: draft.name,
        faculty: draft.faculty,
        major: draft.major,
        modules_taken: splitList(draft.modules_taken),
        ccas: splitList(draft.ccas),
        nus_opportunities: splitList(draft.nus_opportunities),
        exchange_universities: splitList(draft.exchange_universities),
        accommodation: draft.accommodation,
        interests: splitList(draft.interests),
        goals: splitList(draft.goals),
        bio: draft.bio,
        mentorship_goals: user.role === "mentor" ? draft.mentorship_goals : undefined,
        mentor_type: user.role === "mentor" ? (draft.mentor_type as MentorType) : undefined,
        mentor_type_other: user.role === "mentor" ? draft.mentor_type_other : undefined,
        graduation_year: user.role === "mentor" ? draft.graduation_year : undefined,
        current_role: user.role === "mentor" ? draft.current_role : undefined,
        organisation: user.role === "mentor" ? draft.organisation : undefined,
        department: user.role === "mentor" ? draft.department : undefined,
        consultation_hours: user.role === "mentor" ? draft.consultation_hours : undefined,
        modules_taught: user.role === "mentor" ? splitList(draft.modules_taught) : [],
        areas_of_expertise: user.role === "mentor" ? splitList(draft.areas_of_expertise) : [],
        office_location: user.role === "mentor" ? draft.office_location : undefined,
        office: user.role === "mentor" ? draft.office : undefined,
        profile_picture: draft.profile_picture,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="bg-[linear-gradient(105deg,#5f16ee,#4f00bf_55%,#b213f0)] px-8 py-9 text-white">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <Avatar initials={user.name.slice(0, 2).toUpperCase()} large src={user.profile_picture} />
            <div>
              <h2 className="brand-serif text-3xl font-black">{user.name}</h2>
              <p className="mt-1 text-white/85">{user.email} - {user.faculty} - {user.major} - {user.role}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="chip bg-white/16 text-white ring-1 ring-white/25">{user.role === "student" ? "Student" : "Mentor"}</span>
                {user.interests.slice(0, 2).map((interest) => (
                  <span key={interest} className="chip bg-white/16 text-white ring-1 ring-white/25">{interest}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="h-12 rounded-xl border border-white/25 bg-white/10 px-6 font-bold" onClick={() => setEditing((current) => !current)}>{editing ? "Cancel edit" : "Edit profile"}</button>
            <button className="h-12 rounded-xl bg-nusOrange px-6 font-bold" onClick={() => setActiveView("find")}>Find mentors</button>
          </div>
        </div>
        <div className="mt-7 grid grid-cols-3 gap-4 max-md:grid-cols-1">
          <Metric value={completion + "%"} label="Profile complete" />
          <Metric value={user.interests.length} label="Interests" />
          <Metric value={user.ccas.length + user.nus_opportunities.length} label="Campus signals" />
        </div>
      </div>
      <div className="grid grid-cols-[1fr_330px] gap-7 p-8 max-xl:grid-cols-1">
        <div className="space-y-6">
          {editing && (
            <Panel title="Edit Profile">
              <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
                <TextInput label="Name" value={draft.name} onChange={(value) => updateDraft("name", value)} placeholder="Your name" />
                <label className="block text-sm font-bold text-[#3f4659]">
                  Profile picture URL
                  <input className="field mt-2" value={draft.profile_picture} onChange={(event) => updateDraft("profile_picture", event.target.value)} placeholder="Paste an image URL, or upload below" />
                  <input className="mt-3 block w-full text-sm font-medium text-[#596173]" type="file" accept="image/*" onChange={(event) => handleProfilePhoto(event.target.files?.[0])} />
                </label>
                <label className="block text-sm font-bold text-[#3f4659]">
                  Faculty
                  <select
                    className="field mt-2"
                    value={draft.faculty}
                    onChange={(event) => {
                      const selectedFaculty = event.target.value;
                      setDraft((current) => ({
                        ...current,
                        faculty: selectedFaculty,
                        major: facultyMajors[selectedFaculty]?.[0] ?? "",
                        department: departmentsByFaculty[selectedFaculty]?.[0] ?? current.department,
                      }));
                    }}
                  >
                    {Object.keys(facultyMajors).map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-bold text-[#3f4659]">
                  Major / Programme
                  <select className="field mt-2" value={draft.major} onChange={(event) => updateDraft("major", event.target.value)}>
                    {(majorOptions.length ? majorOptions : [draft.major]).map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-bold text-[#3f4659]">
                  Accommodation
                  <select className="field mt-2" value={draft.accommodation} onChange={(event) => updateDraft("accommodation", event.target.value)}>
                    {accommodationOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <div className="md:col-span-2">
                  <TextAreaInput label="Modules taken" value={draft.modules_taken} onChange={(value) => updateDraft("modules_taken", value)} placeholder="CS1010, MA1521" />
                </div>
                <div className="md:col-span-2">
                  <TextAreaInput label="CCAs and organisations" value={draft.ccas} onChange={(value) => updateDraft("ccas", value)} placeholder="NUS Hackers, TeamNUS" />
                </div>
                <div className="md:col-span-2">
                  <TextAreaInput label="NUS opportunities" value={draft.nus_opportunities} onChange={(value) => updateDraft("nus_opportunities", value)} placeholder="NOC, UROP" />
                </div>
                <div className="md:col-span-2">
                  <TextAreaInput label="Exchange universities" value={draft.exchange_universities} onChange={(value) => updateDraft("exchange_universities", value)} placeholder="University of Tokyo, Other" />
                </div>
                <TextInput label="Areas of interest" value={draft.interests} onChange={(value) => updateDraft("interests", value)} placeholder="AI/M4, startups, research" />
                <div className="md:col-span-2">
                  <TextAreaInput label="Goals" value={draft.goals} onChange={(value) => updateDraft("goals", value)} placeholder="Find research guidance, plan exchange" />
                </div>
              </div>
              <div className="mt-4">
                <TextAreaInput label="About" value={draft.bio} onChange={(value) => updateDraft("bio", value)} placeholder="Tell others what you are exploring at NUS." rows={5} />
              </div>
              {user.role === "mentor" && (
                <div className="mt-4 grid grid-cols-2 gap-4 max-md:grid-cols-1">
                  <label className="block text-sm font-bold text-[#3f4659]">
                    Mentor type
                    <select className="field mt-2" value={draft.mentor_type} onChange={(event) => updateDraft("mentor_type", event.target.value)}>
                      {mentorTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                  </label>
                  {draft.mentor_type === "other" && <TextInput label="Specify mentor type" value={draft.mentor_type_other} onChange={(value) => updateDraft("mentor_type_other", value)} placeholder="Industry mentor, research mentor..." />}
                  <TextInput label="Graduation year" value={draft.graduation_year} onChange={(value) => updateDraft("graduation_year", value)} placeholder="2024" />
                  <TextInput label="Current role" value={draft.current_role} onChange={(value) => updateDraft("current_role", value)} placeholder="Professor, senior, analyst..." />
                  <TextInput label="Organisation" value={draft.organisation} onChange={(value) => updateDraft("organisation", value)} placeholder="NUS, company, startup..." />
                  <label className="block text-sm font-bold text-[#3f4659]">
                    Department / team
                    {draft.mentor_type === "professor" ? (
                      <select className="field mt-2" value={draft.department || departmentOptions[0] || ""} onChange={(event) => updateDraft("department", event.target.value)}>
                        {(departmentOptions.length ? departmentOptions : [draft.department || "Other"]).map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    ) : (
                      <input className="field mt-2" value={draft.department} onChange={(event) => updateDraft("department", event.target.value)} placeholder="Department or team" />
                    )}
                  </label>
                  <TextInput label="Consultation hours" value={draft.consultation_hours} onChange={(value) => updateDraft("consultation_hours", value)} placeholder="Mon 09:00, Wed 14:00" />
                  <TextInput label="Modules taught" value={draft.modules_taught} onChange={(value) => updateDraft("modules_taught", value)} placeholder="CS1010, CS2103T" />
                  <TextInput label="Areas of expertise" value={draft.areas_of_expertise} onChange={(value) => updateDraft("areas_of_expertise", value)} placeholder="AI, systems, HCI" />
                  <TextInput label="Office / cubicle" value={draft.office_location} onChange={(value) => updateDraft("office_location", value)} placeholder="COM3-02-15" />
                  <TextInput label="Office / unit" value={draft.office} onChange={(value) => updateDraft("office", value)} placeholder="CFG, NUS Enterprise..." />
                  <label className="block text-sm font-bold text-[#3f4659] md:col-span-2">
                    Mentorship goals
                    <textarea className="field mt-2 min-h-24 resize-y py-3" value={draft.mentorship_goals} onChange={(event) => updateDraft("mentorship_goals", event.target.value)} placeholder="Describe the guidance you want to offer." />
                  </label>
                </div>
              )}
              <OptionDatalist id="profile-cca-options" options={ccas} />
              <OptionDatalist id="profile-opportunity-options" options={opportunities} />
              <OptionDatalist id="profile-exchange-options" options={exchangeUniversities} />
              <div className="mt-5 flex flex-wrap gap-3">
                <button className="h-11 rounded-xl bg-nusPurple px-6 font-bold text-white disabled:opacity-60" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save changes"}</button>
                <button className="h-11 rounded-xl border border-[#c8cfde] px-6 font-bold text-nusPurple" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </Panel>
          )}
          {!editing && (
            <>
              <Panel title="Profile Information">
                <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
                  <ProfileField label="Name" value={user.name} />
                  <ProfileField label="NUS Email" value={user.email} />
                  <ProfileField label="Role" value={user.role} />
                  {user.role === "mentor" && <ProfileField label="Mentor type" value={mentorTypeLabel(user)} />}
                  <ProfileField label="Faculty" value={user.faculty} />
                  <ProfileField label="Major / Programme" value={user.major} />
                  <ProfileField label="Accommodation" value={user.accommodation} />
                </div>
              </Panel>
              <Panel title="Academic and NUS Experience">
                <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
                  <ProfileList label="Modules taken" values={user.modules_taken} />
                  <ProfileList label="Exchange" values={user.exchange_universities} />
                  <ProfileList label="CCAs and organisations" values={user.ccas} />
                  <ProfileList label="NUS opportunities" values={user.nus_opportunities} />
                  {user.modules_taught.length > 0 && <ProfileList label="Modules taught" values={user.modules_taught} />}
                  {user.areas_of_expertise.length > 0 && <ProfileList label="Areas of expertise" values={user.areas_of_expertise} />}
                </div>
              </Panel>
              {user.role === "mentor" && (
                <Panel title="Mentor Details">
                  <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
                    {user.graduation_year && <ProfileField label="Graduation year" value={user.graduation_year} />}
                    {user.current_role && <ProfileField label="Current role" value={user.current_role} />}
                    {user.organisation && <ProfileField label="Organisation" value={user.organisation} />}
                    {user.department && <ProfileField label="Department / team" value={user.department} />}
                    {user.consultation_hours && <ProfileField label="Consultation hours" value={user.consultation_hours} />}
                    {user.office_location && <ProfileField label="Office / cubicle" value={user.office_location} />}
                    {user.office && <ProfileField label="Office / unit" value={user.office} />}
                  </div>
                </Panel>
              )}
              <Panel title="About">
                <div className="dash-placeholder p-4 font-medium text-[#596173]">{user.bio || "No description added yet."}</div>
                {user.role === "mentor" && user.mentorship_goals && (
                  <div className="mt-3 dash-placeholder p-4 font-medium text-[#596173]">
                    <span className="font-black text-[#1f2333]">Mentorship goal: </span>
                    {user.mentorship_goals}
                  </div>
                )}
              </Panel>
              <Panel title="Goals">
                <div className="space-y-3">
                  {user.goals.map((goal) => (
                    <div key={goal} className="dash-placeholder p-4 font-medium text-[#596173]">{goal}</div>
                  ))}
                </div>
              </Panel>
            </>
          )}
        </div>
        <aside className="space-y-6">
          <Panel title="INTERESTS">
            <div className="flex flex-wrap gap-2">
              {user.interests.map((interest, index) => (
                <span key={interest} className={`chip ${pastel[index % pastel.length]}`}>{interest}</span>
              ))}
            </div>
          </Panel>
          <Panel title="ACCOUNT">
            <p className="font-medium text-[#737b8f]">This information is loaded from the backend account created during sign up.</p>
            <button className="mt-4 h-11 w-full rounded-xl bg-nusPurple font-bold text-white" onClick={() => setActiveView("home")}>Back home</button>
          </Panel>
        </aside>
      </div>
    </section>
  );
}

function QAPlatform({
  user,
  questions,
  onCreateQuestion,
  onAnswerQuestion,
}: {
  user: User;
  questions: Question[];
  onCreateQuestion: (payload: { title: string; topic: string; body: string; tags: string[]; attachments: string[] }) => Promise<void>;
  onAnswerQuestion: (questionId: string, body: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("How should I choose between NOC and exchange?");
  const [topic, setTopic] = useState("NOC / Exchange");
  const [body, setBody] = useState("I want to understand which option is better if I care about startups, internships, and keeping my module plan manageable.");
  const [tags, setTags] = useState("NUS Overseas Colleges, Exchange, Internship planning");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [archiveSearch, setArchiveSearch] = useState("");
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const recentTerms = useMemo(() => frequentQuestionTerms(questions), [questions]);
  const filteredQuestions = useMemo(() => {
    const query = archiveSearch.trim().toLowerCase();
    if (!query) return questions;
    return questions.filter((question) =>
      [
        question.title,
        question.topic,
        question.body,
        ...question.tags,
        ...(question.key_terms ?? []),
        ...question.answers.flatMap((answer) => [answer.body, answer.summary]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [archiveSearch, questions]);

  async function submitQuestion() {
    await onCreateQuestion({ title, topic, body, tags: splitList(tags), attachments });
    setTitle("");
    setTopic("");
    setBody("");
    setTags("");
    setAttachments([]);
  }

  async function submitAnswer(questionId: string) {
    const answer = answerDrafts[questionId] ?? "";
    if (!answer.trim()) return;
    await onAnswerQuestion(questionId, answer);
    setAnswerDrafts((current) => ({ ...current, [questionId]: "" }));
  }

  return (
    <section className="grid grid-cols-[390px_1fr] gap-7 p-8 max-xl:grid-cols-1">
      <aside className="space-y-6">
        <Panel title="Knowledge Archive">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9aa1b3]" size={18} />
            <input className="field pl-11" value={archiveSearch} onChange={(event) => setArchiveSearch(event.target.value)} placeholder="Search previous answers by keyword" />
          </div>
          <p className="mt-3 text-sm font-medium text-[#737b8f]">{filteredQuestions.length} matching archived queries</p>
        </Panel>
        <Panel title="Frequently Asked Recently">
          <div className="flex flex-wrap gap-2">
            {(recentTerms.length ? recentTerms : ["NOC", "Exchange", "Internships", "Research"]).map((term, index) => (
              <button
                key={term}
                className={`chip ${archiveSearch.toLowerCase() === term.toLowerCase() ? "bg-nusPurple text-white" : pastel[index % pastel.length]}`}
                onClick={() => {
                  setArchiveSearch(term);
                  setTopic(term);
                  setTags((current) => current || term);
                }}
              >
                {term}
              </button>
            ))}
          </div>
        </Panel>
        <Panel title={user.role === "mentor" ? "Mentor Access" : "Post a Query"}>
        {user.role === "student" ? (
          <div className="space-y-4">
            <label className="block text-sm font-bold text-[#3f4659]">
              Query subject
              <input className="field mt-2" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Short title for your query" />
            </label>
            <label className="block text-sm font-bold text-[#3f4659]">
              Area of concern
              <input className="field mt-2" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="NOC, exchange, internships, research..." list="recent-query-terms" />
            </label>
            <label className="block text-sm font-bold text-[#3f4659]">
              Query description
              <textarea className="field mt-2 min-h-32 resize-y py-3" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Describe the context, what you have tried, and what guidance you need." />
            </label>
            <label className="block text-sm font-bold text-[#3f4659]">
              Key terms
              <input className="field mt-2" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Comma separated, e.g. NOC, exchange, internship planning" list="recent-query-terms" />
            </label>
            <label className="block text-sm font-bold text-[#3f4659]">
              Add files
              <input
                className="mt-2 block w-full rounded-xl border border-[#c8cfde] bg-white px-4 py-3 text-sm font-medium text-[#596173]"
                type="file"
                multiple
                onChange={(event) => setAttachments(Array.from(event.target.files ?? []).map((file) => file.name))}
              />
            </label>
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((file) => <span key={file} className="chip bg-[#f1f4f9] text-[#596173]">{file}</span>)}
              </div>
            )}
            <datalist id="recent-query-terms">
              {recentTerms.map((term) => <option key={term} value={term} />)}
            </datalist>
            <button className="h-12 w-full rounded-xl bg-nusPurple font-bold text-white" onClick={submitQuestion}>Post query</button>
          </div>
        ) : (
          <p className="font-medium text-[#737b8f]">Only mentor accounts can respond to queries. Your responses are summarised and stored in the knowledge archive for future students.</p>
        )}
        </Panel>
      </aside>

      <div className="space-y-5">
        {filteredQuestions.map((question) => (
          <article key={question.id} className="card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase text-[#9aa1b3]">{question.topic || "General concern"}</p>
                <h2 className="mt-1 text-2xl font-black">{question.title}</h2>
                <p className="mt-2 font-medium text-[#737b8f]">Asked by {question.student_name}</p>
              </div>
              <span className="chip bg-[#f3f0ff] text-nusPurple">{question.answers.length} archived answers</span>
            </div>
            <p className="mt-4 rounded-xl border border-dashed border-[#cfd6e6] bg-[#f8faff] p-4 font-medium text-[#596173]">{question.body}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[...question.tags, ...(question.key_terms ?? [])].filter((tag, index, all) => all.findIndex((item) => item.toLowerCase() === tag.toLowerCase()) === index).slice(0, 10).map((tag, index) => <span key={tag} className={`chip ${pastel[index % pastel.length]}`}>{tag}</span>)}
            </div>
            {question.attachments?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {question.attachments.map((file) => <span key={file} className="chip bg-[#f1f4f9] text-[#596173]">{file}</span>)}
              </div>
            )}
            <div className="mt-5 space-y-3">
              {question.answers.map((answer) => (
                <div key={answer.id} className="rounded-xl border border-[#d4dae8] bg-white p-4">
                  <p className="font-black">{answer.mentor_name}</p>
                  <p className="mt-2 font-medium text-[#596173]">{answer.body}</p>
                  <p className="mt-3 rounded-lg bg-[#f3f0ff] px-3 py-2 text-sm font-bold text-nusPurple">Archive summary: {answer.summary}</p>
                </div>
              ))}
              {!question.answers.length && <p className="rounded-xl border border-dashed border-[#cfd6e6] bg-[#f8faff] p-4 font-medium text-[#737b8f]">No mentor response yet.</p>}
            </div>
            {user.role === "mentor" && (
              <div className="mt-5 flex gap-3 max-md:flex-col">
                <input
                  className="field"
                  value={answerDrafts[question.id] ?? ""}
                  onChange={(event) => setAnswerDrafts((current) => ({ ...current, [question.id]: event.target.value }))}
                  placeholder="Write a mentor answer"
                />
                <button className="h-14 rounded-xl bg-nusPurple px-6 font-bold text-white" onClick={() => submitAnswer(question.id)}>Answer</button>
              </div>
            )}
            {user.role !== "mentor" && <p className="mt-4 text-sm font-bold text-[#9aa1b3]">Only mentors can respond to posted queries.</p>}
          </article>
        ))}
        {!filteredQuestions.length && (
          <Panel title="No archived match">
            <p className="font-medium text-[#737b8f]">Try another keyword or post a new query so mentors can add an answer to the archive.</p>
          </Panel>
        )}
      </div>
    </section>
  );
}

function Messages({
  user,
  connections,
  conversations,
  activeConversationId,
  setActiveConversationId,
  onAcceptConnection,
  onSendMessage,
  setActiveView,
}: {
  user: User;
  connections: Connection[];
  conversations: Conversation[];
  activeConversationId: string;
  setActiveConversationId: (id: string) => void;
  onAcceptConnection: (connectionId: string) => void;
  onSendMessage: (conversationId: string, body: string) => Promise<void>;
  setActiveView: (view: View) => void;
}) {
  const [message, setMessage] = useState("Thanks, I would like to know more about your experience.");
  const active = conversations.find((conversation) => conversation.id === activeConversationId) ?? conversations[0];
  const pendingForMentor = connections.filter((connection) => connection.status === "pending" && connection.mentor_id === user.id);
  const pendingForStudent = connections.filter((connection) => connection.status === "pending" && connection.student_id === user.id);

  async function submitMessage() {
    if (!active || !message.trim()) return;
    await onSendMessage(active.id, message);
    setMessage("");
  }

  if (!conversations.length) {
    return (
      <section className="space-y-6 p-8">
        <PendingConnectionRequests user={user} connections={user.role === "mentor" ? pendingForMentor : pendingForStudent} onAcceptConnection={onAcceptConnection} />
        <Panel title="Messages">
          <p className="font-medium text-[#737b8f]">No accepted conversations yet. Students must request a connection and mentors must accept before messaging starts.</p>
          <button className="mt-4 h-11 rounded-xl bg-nusPurple px-6 font-bold text-white" onClick={() => setActiveView("find")}>Find mentors</button>
        </Panel>
      </section>
    );
  }

  return (
    <section className="grid grid-cols-[330px_1fr] gap-7 p-8 max-xl:grid-cols-1">
      <div className="space-y-6">
        <PendingConnectionRequests user={user} connections={user.role === "mentor" ? pendingForMentor : pendingForStudent} onAcceptConnection={onAcceptConnection} />
        <Panel title="Conversations">
          <div className="space-y-3">
            {conversations.map((conversation) => (
              <button key={conversation.id} className={`w-full rounded-xl border p-4 text-left ${active?.id === conversation.id ? "border-nusPurple bg-[#f3f0ff]" : "border-[#d4dae8] bg-white"}`} onClick={() => setActiveConversationId(conversation.id)}>
                <p className="font-black">{conversation.mentor_name}</p>
                <p className="text-sm font-medium text-[#737b8f]">{conversation.mentor_programme}</p>
                <p className="mt-2 truncate text-sm text-[#596173]">{conversation.last_message}</p>
              </button>
            ))}
          </div>
        </Panel>
      </div>
      <Panel title={active ? `Chat with ${active.mentor_name}` : "Messages"}>
        <div className="space-y-3">
          {active?.messages.map((item) => (
            <div key={item.id} className={`max-w-[75%] rounded-2xl p-4 ${item.sender_id === user.id ? "ml-auto bg-nusPurple text-white" : "bg-[#f3f5fb] text-[#1f2333]"}`}>
              <p className="text-xs font-black uppercase opacity-75">{item.sender_name}</p>
              <p className="mt-1 font-medium">{item.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex gap-3 max-md:flex-col">
          <input className="field" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a message" />
          <button className="h-14 rounded-xl bg-nusPurple px-6 font-bold text-white" onClick={submitMessage}>Send</button>
        </div>
      </Panel>
    </section>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#d4dae8] bg-[#f8faff] p-4">
      <p className="text-sm font-black uppercase text-[#9aa1b3]">{label}</p>
      <p className="mt-2 font-bold text-[#1f2333]">{value}</p>
    </div>
  );
}

function ProfileList({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="rounded-xl border border-[#d4dae8] bg-[#f8faff] p-4">
      <p className="text-sm font-black uppercase text-[#9aa1b3]">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {values.length ? values.map((value, index) => <span key={value} className={`chip ${pastel[index % pastel.length]}`}>{value}</span>) : <p className="font-medium text-[#737b8f]">Not added yet</p>}
      </div>
    </div>
  );
}

function MentorProfile({ mentor, connection, setActiveView, onRequestConnection, onStartConversation }: { mentor?: Mentor; connection?: Connection; setActiveView: (view: View) => void; onRequestConnection: (mentorId: string) => void; onStartConversation: (mentorId: string) => void }) {
  const selected = mentor ?? null;
  if (!selected) return null;
  return (
    <section>
      <div className="bg-[linear-gradient(105deg,#5f16ee,#4f00bf_55%,#b213f0)] px-8 py-9 text-white">
        <div className="flex justify-between">
          <div className="flex gap-6">
            <Avatar initials="M1" large />
            <div>
              <h2 className="brand-serif text-3xl font-black">{selected.name}</h2>
              <p className="mt-1 text-white/85">{selected.mentor_type_label} - {selected.programme} - {selected.faculty} - NUS</p>
              <p className="mt-1 font-bold text-white">{selected.email}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {[selected.mentor_type_label, ...selected.interests.slice(0, 2)].map((tag) => (
                  <span key={tag} className="chip bg-white/16 text-white ring-1 ring-white/25">{tag}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="h-12 rounded-xl border border-white/25 bg-white/10 px-6 font-bold disabled:opacity-60" disabled={connection?.status !== "accepted"} onClick={() => onStartConversation(selected.id)}>Message</button>
            <button className="h-12 rounded-xl bg-nusOrange px-6 font-bold disabled:opacity-60" disabled={connection?.status === "accepted" || connection?.status === "pending"} onClick={() => onRequestConnection(selected.id)}>{connection?.status === "accepted" ? "Connected" : connection?.status === "pending" ? "Pending" : "Connect"}</button>
          </div>
        </div>
        <div className="mt-7 grid grid-cols-4 gap-4">
          <Metric value={selected.rating} label="Rating" />
          <Metric value={selected.reviews} label="Reviews" />
          <Metric value={selected.answers} label="Q&A answers" />
          <Metric value={selected.mentees} label="Mentees" />
        </div>
      </div>
      <div className="grid grid-cols-[1fr_330px] gap-7 p-8 max-xl:grid-cols-1">
        <div className="space-y-6">
          <Panel title="About">
            <div className="dash-placeholder p-5 font-medium text-[#737b8f]">{selected.bio}</div>
          </Panel>
          <Panel title="Experience">
            <div className="space-y-5">
              {selected.experience.map((item, index) => (
                <div key={item} className="flex gap-4 border-b border-[#eef1f7] pb-5 last:border-b-0">
                  <span className={`mt-2 h-3 w-3 rounded-full ${index === 0 ? "bg-nusOrange" : "bg-[#7166f9]"}`} />
                  <div>
                    <p className="font-black">{item}</p>
                    <p className="text-[#8b91a5]">Organisation - Location</p>
                    <p className="text-[#a0a6b8]">Start date - End date</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
        <aside className="space-y-6">
          <Panel title="CAN MENTOR ON">
            <div className="flex flex-wrap gap-2">
              {selected.interests.concat(selected.experience_tags.slice(0, 3)).map((tag, index) => (
                <span key={tag} className={`chip ${pastel[index % pastel.length]}`}>{tag}</span>
              ))}
            </div>
          </Panel>
          <Panel title="RECENT REVIEWS">
            {[1, 2].map((item) => (
              <div className="border-b border-[#eef1f7] py-3 last:border-b-0" key={item}>
                <div className="flex text-nusOrange">
                  {Array.from({ length: 5 }).map((_, index) => <Star key={index} size={15} fill="currentColor" />)}
                </div>
                <p className="mt-2 font-medium text-[#596173]">Review placeholder text.</p>
                <p className="text-sm text-[#a0a6b8]">Reviewer type</p>
              </div>
            ))}
          </Panel>
          <button className="h-12 w-full rounded-xl border border-[#a7bdf5] bg-white font-bold text-nusPurple" onClick={() => setActiveView("find")}>Back to mentors</button>
        </aside>
      </div>
    </section>
  );
}

function Panel({ title, children, action, onAction }: { title: string; children: React.ReactNode; action?: string; onAction?: () => void }) {
  return (
    <section className="card p-6">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-lg font-black tracking-[0.01em]">{title}</h3>
        {action && (
          <button className="font-bold text-nusPurple" onClick={onAction}>
            {action} {"->"}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-xl border border-white/12 bg-white/10 px-6 py-4">
      <p className="brand-serif text-3xl font-black">{value}</p>
      <p className="text-sm font-semibold text-white/80">{label}</p>
    </div>
  );
}

function CompactMentor({ mentor, onProfile, onConnect }: { mentor: Mentor; onProfile: () => void; onConnect: () => void }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[#d4dae8] p-5">
      <Avatar initials={mentor.id.toUpperCase()} />
      <div className="min-w-0 flex-1">
        <p className="text-xl font-black">{mentor.name}</p>
        <p className="font-medium text-[#737b8f]">{mentor.mentor_type_label} - {mentor.programme} - {mentor.faculty}</p>
        <p className="mt-1 text-sm font-bold text-nusPurple">{mentor.email}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {mentor.interests.slice(0, 3).map((tag, index) => <span key={tag} className={`chip ${pastel[index]}`}>{tag}</span>)}
        </div>
        <p className="mt-3 text-sm font-semibold text-[#737b8f]">{mentor.match_reasons[0] ?? "Strong profile fit"}</p>
      </div>
      <Score score={mentor.match_score} label={mentor.match_label} />
      <div className="flex gap-2">
        <button className="h-11 rounded-xl bg-nusPurple px-6 font-bold text-white" onClick={onConnect}>Connect</button>
        <button className="h-11 px-2 font-bold text-nusPurple" onClick={onProfile}>Profile</button>
      </div>
    </div>
  );
}

function MentorCard({ mentor, connection, onProfile, onConnect, onMessage }: { mentor: Mentor; connection?: Connection; onProfile: () => void; onConnect: () => void; onMessage: () => void }) {
  const stars = useMemo(() => Array.from({ length: 5 }), []);
  return (
    <article className="card p-6">
      <div className="flex items-start gap-5">
        <Avatar initials={mentor.id.toUpperCase()} />
        <div className="min-w-0 flex-1">
          <div className="flex justify-between">
            <div>
              <h3 className="text-2xl font-black">{mentor.name}</h3>
              <p className="font-medium text-[#737b8f]">{mentor.mentor_type_label} - {mentor.programme} - {mentor.faculty}</p>
              <p className="mt-1 text-sm font-bold text-nusPurple">{mentor.email}</p>
            </div>
            <Score score={mentor.match_score} label={mentor.match_label} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {mentor.keyword_match_score !== undefined && <Score score={mentor.keyword_match_score} label="Keyword match" compact />}
            {mentor.profile_match_score !== undefined ? <Score score={mentor.profile_match_score} label="Complete profile match" compact /> : <span className="chip bg-[#f1f4f9] text-[#596173]">Complete profile match calculating</span>}
            {mentor.goal_match_score !== undefined && <Score score={mentor.goal_match_score} label="Goal match" compact />}
          </div>
          <div className="mt-3 flex items-center gap-1 text-nusOrange">
            {stars.map((_, index) => <Star key={index} size={16} fill="currentColor" />)}
            <span className="ml-2 font-medium text-[#737b8f]">( rating / review placeholder )</span>
          </div>
          <div className="dash-placeholder mt-4 p-4 font-medium text-[#737b8f]">{mentor.bio}</div>
          <div className="mt-4 rounded-xl border border-[#d4dae8] bg-[#f8faff] p-4">
            <p className="text-sm font-black uppercase text-[#9aa1b3]">Why this match</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {mentor.match_reasons.map((reason, index) => <span key={reason} className={`chip ${pastel[index % pastel.length]}`}>{reason}</span>)}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {mentor.interests.map((tag, index) => <span key={tag} className={`chip ${pastel[index % pastel.length]}`}>{tag}</span>)}
          </div>
          <div className="mt-5 flex items-center gap-3">
            <button className="h-11 rounded-xl bg-nusPurple px-6 font-bold text-white disabled:opacity-60" disabled={connection?.status === "accepted" || connection?.status === "pending"} onClick={onConnect}>{connection?.status === "accepted" ? "Connected" : connection?.status === "pending" ? "Pending" : "Connect"}</button>
            <button className="h-11 rounded-xl bg-[#fff8ef] px-6 font-bold text-[#c94a12] disabled:opacity-50" disabled={connection?.status !== "accepted"} onClick={onMessage}>Message</button>
            <button className="h-11 px-2 font-bold text-nusPurple" onClick={onProfile}>View profile {"->"}</button>
          </div>
        </div>
      </div>
    </article>
  );
}

function Avatar({ initials, large = false, src }: { initials: string; large?: boolean; src?: string }) {
  return (
    <div className={`grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#e5eaff] font-black text-nusPurple ${large ? "h-20 w-20 border-2 border-white/25 text-2xl" : "h-16 w-16 text-2xl"}`}>
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials}
    </div>
  );
}

function Score({ score, label = "Match", compact = false }: { score: number; label?: string; compact?: boolean }) {
  return (
    <span className={`chip bg-[#fff8ef] text-nusOrange ${compact ? "text-xs" : ""}`}>
      <Zap size={14} fill="currentColor" />
      {score}% {label}
    </span>
  );
}
