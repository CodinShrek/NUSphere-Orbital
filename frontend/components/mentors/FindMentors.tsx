"use client";

import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, CircleAlert, Database, Search, Sparkles } from "lucide-react";

import { RatingStars, VerificationBadge } from "@/components/mentors/MentorQuality";
import { MatchInsights, MatchLoadingState, Score, formatEmbeddingModel } from "@/components/mentors/MatchTools";
import { Avatar } from "@/components/ui/Avatar";
import { pastel } from "@/data/profile-options";
import { fetchAiGoalMatches, fetchAiProfileMatches } from "@/lib/api";
import type { Connection, Mentor, User } from "@/types/api";
export function FindMentors({
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
  const [aiHasRun, setAiHasRun] = useState(false);
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
    setAiHasRun(true);
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
    setAiHasRun(true);
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
    setAiHasRun(false);
    setAiMentors([]);
    if (mode === "standard") return;
    setMinimumScore(0);
    if (user.role !== "student") {
      setAiError("AI mentor search is currently available for student accounts.");
      return;
    }
    if (mode === "profile") void runAiProfileMatch();
  }

  const resultMetadata = aiMentors[0];
  const retryAiRequest = aiMode === "profile" ? runAiProfileMatch : runAiGoalSearch;

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
            <p className={`mt-2 text-sm font-semibold ${goalQuery.trim().length < 20 ? "text-[#a65b00]" : "text-emerald-700"}`}>
              {goalQuery.trim().length < 20
                ? `${20 - goalQuery.trim().length} more characters needed for a useful match.`
                : "Your goal is detailed enough to search."}
            </p>
            <button className="mt-3 h-11 rounded-xl bg-nusPurple px-5 font-bold text-white disabled:opacity-60" onClick={runAiGoalSearch} disabled={aiLoading || user.role !== "student" || goalQuery.trim().length < 20}>{aiLoading ? "Searching..." : "Find AI matches"}</button>
          </div>
        )}
        {aiError && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-[#fff1f0] px-4 py-3" role="alert">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 shrink-0 text-[#c02b18]" size={20} />
              <div>
                <p className="font-black text-[#8f2115]">We could not load AI matches</p>
                <p className="mt-1 text-sm font-semibold text-[#a13b2e]">{aiError}</p>
              </div>
            </div>
            <button className="rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-black text-[#8f2115]" onClick={() => void retryAiRequest()} disabled={aiLoading}>
              Try again
            </button>
          </div>
        )}
        {aiMode !== "standard" && !aiLoading && !aiError && aiHasRun && resultMetadata && (
          <div className={`mb-5 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${resultMetadata.embedding_fallback ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`} aria-live="polite">
            {resultMetadata.embedding_fallback ? <Database className="text-amber-700" size={20} /> : <Sparkles className="text-emerald-700" size={20} />}
            <div>
              <p className={`text-sm font-black ${resultMetadata.embedding_fallback ? "text-amber-900" : "text-emerald-900"}`}>
                {resultMetadata.embedding_fallback ? "Local fallback matching" : "OpenAI semantic matching"}
              </p>
              <p className={`text-xs font-semibold ${resultMetadata.embedding_fallback ? "text-amber-800" : "text-emerald-800"}`}>
                {resultMetadata.embedding_fallback
                  ? `Model: ${formatEmbeddingModel(resultMetadata.embedding_model)}. OpenAI is not configured or was unavailable.`
                  : `Embedding model: ${formatEmbeddingModel(resultMetadata.embedding_model)}`}
              </p>
            </div>
          </div>
        )}
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
            <p className="font-medium text-[#737b8f]">
              {aiLoading
                ? "Analysing mentor profiles and calculating match evidence..."
                : `Showing ${displayedMentors.length} of ${aiMode === "standard" ? mentors.length : aiMentors.length} mentors - sorted by ${aiMode === "standard" ? "match score" : "AI fit"}`}
            </p>
            {(query || activeFilter !== "All" || selectedFaculties.length || selectedInterests.length || minimumScore !== 0) && (
              <button className="font-bold text-nusPurple" onClick={clearFilters}>Clear filters</button>
            )}
          </div>
          <div className="space-y-5">
            {aiMode !== "standard" && aiLoading && <MatchLoadingState mode={aiMode} />}
            {!aiLoading && displayedMentors.map((mentor) => (
                <MentorCard key={mentor.id} mentor={mentor} mode={aiMode} connection={connectionForMentor(mentor.id)} onProfile={() => onOpenMentorProfile(mentor.id)} onConnect={() => onRequestConnection(mentor.id)} onMessage={() => onStartConversation(mentor.id)} />
            ))}
            {aiMode === "goal" && !aiLoading && !aiError && !aiHasRun && (
              <div className="card p-8 text-center">
                <BrainCircuit className="mx-auto text-nusPurple" size={34} />
                <p className="mt-3 text-xl font-black">Describe the guidance you need</p>
                <p className="mt-2 font-medium text-[#737b8f]">Your results will include a transparent score breakdown and evidence from each mentor&apos;s profile.</p>
              </div>
            )}
            {!aiLoading && !aiError && (aiMode === "standard" || aiHasRun) && !displayedMentors.length && (
              <div className="card p-8 text-center">
                <p className="text-xl font-black">No mentors match these filters yet.</p>
                <p className="mt-2 font-medium text-[#737b8f]">{aiMode === "standard" ? "Try a broader search term, lower the match score, or clear the selected filters." : "Try describing a broader goal or complete more of your profile."}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}


function MentorCard({ mentor, mode, connection, onProfile, onConnect, onMessage }: { mentor: Mentor; mode: "standard" | "profile" | "goal"; connection?: Connection; onProfile: () => void; onConnect: () => void; onMessage: () => void }) {
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
              <div className="mt-2">
                <VerificationBadge status={mentor.verification_status} />
              </div>
            </div>
            <Score score={mentor.match_score} label={mentor.match_label} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {mode !== "goal" && mentor.keyword_match_score !== undefined && <Score score={mentor.keyword_match_score} label="Keyword match" compact />}
            {mode !== "goal" && mentor.profile_match_score !== undefined ? <Score score={mentor.profile_match_score} label="Complete profile match" compact /> : mode !== "goal" && <span className="chip bg-[#f1f4f9] text-[#596173]">Complete profile match calculating</span>}
            {mode !== "goal" && mentor.goal_match_score !== undefined && <Score score={mentor.goal_match_score} label="Goal match" compact />}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <RatingStars rating={mentor.rating} />
            <span className="font-medium text-[#737b8f]">
              {mentor.reviews
                ? `${mentor.rating.toFixed(1)} (${mentor.reviews} ${mentor.reviews === 1 ? "review" : "reviews"})`
                : "No reviews yet"}
            </span>
          </div>
          <div className="dash-placeholder mt-4 p-4 font-medium text-[#737b8f]">{mentor.bio}</div>
          <MatchInsights mentor={mentor} />
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
