"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Search, ShieldCheck, Sparkles } from "lucide-react";

import {
  createOpportunity,
  fetchOpportunityGoalMatches,
  fetchOpportunityProfileMatches,
  fetchOpportunityRecommendations,
  updateOpportunity,
} from "@/lib/api";
import type {
  MatchScoreBreakdown,
  Opportunity,
  OpportunityCategory,
  OpportunityCreatePayload,
  User,
} from "@/types/api";

const categories: { value: OpportunityCategory; label: string }[] = [
  { value: "event", label: "Events" },
  { value: "cca", label: "CCAs" },
  { value: "project", label: "Projects" },
  { value: "research", label: "Research" },
  { value: "other", label: "Others" },
];

const categoryCopy: Record<
  OpportunityCategory,
  {
    summary: string;
    detailLabel: string;
    detailPlaceholder: string;
    skillPlaceholder: string;
    commitmentPlaceholder: string;
  }
> = {
  event: {
    summary: "Talks, workshops, networking sessions, hackathons, and campus programmes.",
    detailLabel: "Programme highlights",
    detailPlaceholder: "Speaker lineup, workshop agenda, expected takeaways",
    skillPlaceholder: "Networking, pitching, Python, design thinking",
    commitmentPlaceholder: "One evening, weekend sprint, weekly workshop",
  },
  cca: {
    summary: "CCA recruitment, interest groups, student organisations, and leadership openings.",
    detailLabel: "CCA experience",
    detailPlaceholder: "Training structure, teams, selection process, leadership roles",
    skillPlaceholder: "Event planning, web development, debating, product design",
    commitmentPlaceholder: "2 sessions per week, ad hoc events, EXCO role",
  },
  project: {
    summary: "Student projects, product teams, open-source builds, and innovation work.",
    detailLabel: "Project scope",
    detailPlaceholder: "Problem statement, deliverables, team roles, tech stack",
    skillPlaceholder: "React, machine learning, UI design, user research",
    commitmentPlaceholder: "4 hours per week, semester-long, summer build",
  },
  research: {
    summary: "Lab roles, UROP-style work, RA openings, and professor-led research.",
    detailLabel: "Research scope",
    detailPlaceholder: "Research question, methods, supervisor, expected output",
    skillPlaceholder: "Literature review, PyTorch, statistics, interviews",
    commitmentPlaceholder: "6 hours per week, semester project, summer RA",
  },
  other: {
    summary: "Scholarships, volunteering, competitions, internships, and unusual opportunities.",
    detailLabel: "Opportunity details",
    detailPlaceholder: "Selection process, deliverables, support available, outcomes",
    skillPlaceholder: "Communication, analysis, leadership, writing",
    commitmentPlaceholder: "Flexible, one-off, monthly, semester-long",
  },
};

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function categoryLabel(category: OpportunityCategory) {
  return categories.find((item) => item.value === category)?.label ?? "Opportunity";
}

function defaultDraft(user: User): Record<string, string> {
  return {
    category: "project",
    title: "",
    organisation: user.role === "mentor" ? user.organisation || "NUS" : "NUS",
    summary: "",
    description: "",
    faculty: user.faculty,
    location: "",
    commitment: "",
    start_date: "",
    end_date: "",
    deadline: "",
    application_url: "",
    contact_email: user.email,
    target_years: "",
    relevant_majors: user.major,
    tags: user.interests.join(", "),
    skills: "",
    details: "",
  };
}

function draftFromOpportunity(opportunity: Opportunity): Record<string, string> {
  return {
    category: opportunity.category,
    title: opportunity.title,
    organisation: opportunity.organisation,
    summary: opportunity.summary,
    description: opportunity.description,
    faculty: opportunity.faculty || "",
    location: opportunity.location || "",
    commitment: opportunity.commitment || "",
    start_date: opportunity.start_date || "",
    end_date: opportunity.end_date || "",
    deadline: opportunity.deadline || "",
    application_url: opportunity.application_url || "",
    contact_email: opportunity.contact_email || "",
    target_years: opportunity.target_years.join(", "),
    relevant_majors: opportunity.relevant_majors.join(", "),
    tags: opportunity.tags.join(", "),
    skills: opportunity.skills.join(", "),
    details: opportunity.details.join(", "),
  };
}

function buildPayload(draft: Record<string, string>): OpportunityCreatePayload {
  return {
    category: draft.category as OpportunityCategory,
    title: draft.title,
    organisation: draft.organisation,
    summary: draft.summary,
    description: draft.description,
    faculty: draft.faculty || undefined,
    location: draft.location || undefined,
    commitment: draft.commitment || undefined,
    start_date: draft.start_date || undefined,
    end_date: draft.end_date || undefined,
    deadline: draft.deadline || undefined,
    application_url: draft.application_url || undefined,
    contact_email: draft.contact_email || undefined,
    target_years: splitList(draft.target_years),
    relevant_majors: splitList(draft.relevant_majors),
    tags: splitList(draft.tags),
    skills: splitList(draft.skills),
    details: splitList(draft.details),
  };
}

function Score({ score, label, compact = false }: { score: number; label: string; compact?: boolean }) {
  return (
    <div className={compact ? "rounded-xl bg-[#f7f8fb] px-3 py-2" : "rounded-xl bg-[#f3f0ff] px-4 py-3"}>
      <p className={compact ? "text-lg font-black text-nusPurple" : "text-2xl font-black text-nusPurple"}>{score}%</p>
      <p className="text-xs font-black uppercase text-[#737b8f]">{label}</p>
    </div>
  );
}

function MatchBreakdown({
  breakdown,
  mode,
}: {
  breakdown?: MatchScoreBreakdown;
  mode: "standard" | "profile" | "goal";
}) {
  if (!breakdown) return null;
  const rows =
    mode === "goal"
      ? ([["Goal relevance", breakdown.semantic]] as const)
      : ([
          ["Semantic", breakdown.semantic],
          ["Structured", breakdown.structured],
          ["Faculty", breakdown.faculty],
          ["Completeness", breakdown.completeness],
        ] as const);
  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      {rows.map(([label, item]) => (
        <div key={label} className="rounded-xl border border-[#e1e6f2] bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-black uppercase text-[#8b91a5]">{label}</span>
            <span className="text-sm font-black text-[#1f2333]">{item.score}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-[#eef1f7]">
            <div className="h-full rounded-full bg-nusOrange" style={{ width: `${item.score}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function OpportunityCard({
  opportunity,
  mode,
}: {
  opportunity: Opportunity;
  mode: "standard" | "profile" | "goal";
}) {
  return (
    <article className="rounded-lg border border-[#d4dae8] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip bg-[#f3f0ff] text-nusPurple">{categoryLabel(opportunity.category)}</span>
            <span className={opportunity.is_verified ? "chip bg-[#eef9f0] text-emerald-700" : "chip bg-[#fff7e8] text-[#9a5a00]"}>
              {opportunity.is_verified ? "Verified" : "Unverified"}
            </span>
          </div>
          <h3 className="mt-3 text-xl font-black text-[#1f2333]">{opportunity.title}</h3>
          <p className="mt-1 font-bold text-[#596173]">{opportunity.organisation}</p>
          <p className="mt-3 max-w-3xl font-medium text-[#596173]">{opportunity.summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Score score={opportunity.match_score} label={opportunity.match_label} />
          {mode !== "standard" && mode !== "goal" && opportunity.keyword_match_score != null && <Score score={opportunity.keyword_match_score} label="Keyword" compact />}
          {mode !== "profile" && mode !== "goal" && opportunity.profile_match_score != null && <Score score={opportunity.profile_match_score} label="Profile" compact />}
          {mode !== "goal" && opportunity.goal_match_score != null && <Score score={opportunity.goal_match_score} label="Goal" compact />}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-sm max-lg:grid-cols-1">
        <Info label="Faculty" value={opportunity.faculty || "Open to all"} />
        <Info label="Commitment" value={opportunity.commitment || "Not specified"} />
        <Info label="Deadline" value={opportunity.deadline || "Rolling"} />
      </div>
      <p className="mt-4 text-sm font-medium text-[#737b8f]">{opportunity.description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {[...opportunity.tags, ...opportunity.skills].slice(0, 8).map((tag) => (
          <span key={tag} className="chip bg-[#f1f4f9] text-[#596173]">{tag}</span>
        ))}
      </div>
      <div className="mt-4 rounded-xl bg-[#f8faff] p-4">
        <p className="text-sm font-black uppercase text-[#596173]">Why this match</p>
        <div className="mt-3 grid gap-2">
          {opportunity.match_reasons.length ? (
            opportunity.match_reasons.map((reason) => (
              <div key={reason} className="flex gap-2 text-sm font-semibold text-[#596173]">
                <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={16} />
                <span>{reason}</span>
              </div>
            ))
          ) : (
            <p className="text-sm font-semibold text-[#8b91a5]">No matching evidence is available yet.</p>
          )}
        </div>
        <MatchBreakdown breakdown={opportunity.match_score_breakdown} mode={mode} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-[#737b8f]">
        <span>Posted by {opportunity.poster_name} ({opportunity.poster_role})</span>
        <div className="flex flex-wrap gap-3">
          {opportunity.contact_email && <a className="text-nusPurple" href={`mailto:${opportunity.contact_email}`}>Email contact</a>}
          {opportunity.application_url && <a className="text-nusPurple" href={opportunity.application_url} target="_blank" rel="noreferrer">Apply or learn more</a>}
        </div>
      </div>
    </article>
  );
}

function MyPostCard({
  opportunity,
  onEdit,
}: {
  opportunity: Opportunity;
  onEdit: () => void;
}) {
  return (
    <div className="rounded-xl border border-[#d4dae8] bg-[#fbfcff] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="chip bg-[#f3f0ff] text-nusPurple">{categoryLabel(opportunity.category)}</span>
            <span className={opportunity.is_verified ? "chip bg-[#eef9f0] text-emerald-700" : "chip bg-[#fff7e8] text-[#9a5a00]"}>
              {opportunity.is_verified ? "Verified" : "Unverified"}
            </span>
          </div>
          <p className="mt-3 font-black text-[#1f2333]">{opportunity.title}</p>
          <p className="mt-1 text-sm font-semibold text-[#737b8f]">{opportunity.organisation}</p>
        </div>
        <button className="h-10 rounded-xl border border-[#a7bdf5] px-4 font-bold text-nusPurple" onClick={onEdit} type="button">
          Edit
        </button>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#e1e6f2] bg-[#fbfcff] p-3">
      <p className="text-xs font-black uppercase text-[#9aa1b3]">{label}</p>
      <p className="mt-1 font-bold text-[#3f4659]">{value}</p>
    </div>
  );
}

export function ForYou({
  user,
  token,
  initialOpportunities,
  onOpportunitiesChange,
}: {
  user: User;
  token: string;
  initialOpportunities: Opportunity[];
  onOpportunitiesChange: (opportunities: Opportunity[]) => void;
}) {
  const [mode, setMode] = useState<"standard" | "profile" | "goal">("standard");
  const [query, setQuery] = useState("");
  const [goalQuery, setGoalQuery] = useState("I want opportunities that fit my academic interests, NUS experiences, and near-term goals.");
  const [selectedCategories, setSelectedCategories] = useState<OpportunityCategory[]>([]);
  const [minimumScore, setMinimumScore] = useState(0);
  const [matches, setMatches] = useState<Opportunity[]>(initialOpportunities);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(defaultDraft(user));
  const [formOpen, setFormOpen] = useState(false);
  const [editingOpportunityId, setEditingOpportunityId] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [postMessage, setPostMessage] = useState("");
  const selectedCopy = categoryCopy[draft.category as OpportunityCategory];
  const myPosts = useMemo(
    () => initialOpportunities.filter((item) => item.poster_id === user.id),
    [initialOpportunities, user.id],
  );

  useEffect(() => {
    if (mode === "standard" && !query && !selectedCategories.length) {
      setMatches(initialOpportunities);
    }
  }, [initialOpportunities, mode, query, selectedCategories.length]);

  const visibleMatches = useMemo(
    () => matches.filter((item) => item.match_score >= minimumScore),
    [matches, minimumScore],
  );

  async function runStandardSearch() {
    setMode("standard");
    setLoading(true);
    setError("");
    try {
      setMatches(await fetchOpportunityRecommendations(token, query, selectedCategories, minimumScore));
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Unable to load opportunities");
    } finally {
      setLoading(false);
    }
  }

  async function runProfileSearch() {
    setMode("profile");
    setLoading(true);
    setError("");
    try {
      setMatches(await fetchOpportunityProfileMatches(token));
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Unable to run profile matching");
    } finally {
      setLoading(false);
    }
  }

  async function selectSearchMode(nextMode: "standard" | "profile" | "goal") {
    if (nextMode === "profile") {
      await runProfileSearch();
      return;
    }
    setMode(nextMode);
  }

  async function runGoalSearch() {
    setMode("goal");
    setLoading(true);
    setError("");
    try {
      setMatches(await fetchOpportunityGoalMatches(token, goalQuery, minimumScore));
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Unable to run goal matching");
    } finally {
      setLoading(false);
    }
  }

  function toggleCategory(category: OpportunityCategory) {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  }

  function updateDraft(key: string, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function openCreateForm() {
    setDraft(defaultDraft(user));
    setEditingOpportunityId(null);
    setPostMessage("");
    setFormOpen(true);
  }

  function openEditForm(opportunity: Opportunity) {
    setDraft(draftFromOpportunity(opportunity));
    setEditingOpportunityId(opportunity.id);
    setPostMessage("");
    setFormOpen(true);
  }

  function closeForm() {
    setDraft(defaultDraft(user));
    setEditingOpportunityId(null);
    setFormOpen(false);
  }

  async function submitOpportunity() {
    setPosting(true);
    setPostMessage("");
    setError("");
    try {
      const saved = editingOpportunityId
        ? await updateOpportunity(token, editingOpportunityId, buildPayload(draft))
        : await createOpportunity(token, buildPayload(draft));
      const next = [saved, ...initialOpportunities.filter((item) => item.id !== saved.id)];
      onOpportunitiesChange(next);
      setMatches([saved, ...matches.filter((item) => item.id !== saved.id)]);
      setDraft(defaultDraft(user));
      setEditingOpportunityId(null);
      setFormOpen(false);
      setPostMessage(
        editingOpportunityId
          ? "Opportunity updated."
          : saved.is_verified
            ? "Opportunity posted as verified."
            : "Opportunity posted as unverified.",
      );
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : "Unable to post opportunity");
    } finally {
      setPosting(false);
    }
  }

  return (
    <section className="grid grid-cols-[360px_1fr] gap-7 p-8 max-xl:grid-cols-1">
      <aside className="space-y-6">
        <div className="card p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="text-nusOrange" size={20} />
            <h2 className="text-xl font-black">For You</h2>
          </div>
          <p className="mt-2 text-sm font-medium text-[#737b8f]">Find events, CCAs, projects, research and other university opportunities matched to your profile.</p>
          <div className="mt-5 grid grid-cols-3 rounded-xl bg-[#f4f6fb] p-1 text-sm font-bold">
            {(["standard", "profile", "goal"] as const).map((item) => (
              <button
                key={item}
                className={`rounded-lg px-2 py-2 ${mode === item ? "bg-nusPurple text-white" : "text-[#687086]"}`}
                onClick={() => void selectSearchMode(item)}
                type="button"
              >
                {item === "standard" ? "Standard" : item === "profile" ? "AI Profile" : "AI Goal"}
              </button>
            ))}
          </div>
          {mode === "standard" && (
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-bold text-[#3f4659]">
                Search text
                <input className="field mt-2" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="startup, research, design, exchange" />
              </label>
              <div>
                <p className="text-sm font-bold text-[#3f4659]">Categories</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <button
                      key={category.value}
                      className={`chip ${selectedCategories.includes(category.value) ? "bg-nusPurple text-white" : "bg-[#f1f4f9] text-[#596173]"}`}
                      onClick={() => toggleCategory(category.value)}
                      type="button"
                    >
                      {category.label}
                    </button>
                  ))}
                </div>
              </div>
              <button className="h-11 w-full rounded-xl bg-nusPurple font-bold text-white disabled:opacity-60" onClick={runStandardSearch} disabled={loading || user.role !== "student"} type="button">
                {loading ? "Searching..." : "Search opportunities"}
              </button>
            </div>
          )}
          {mode === "profile" && (
            <div className="mt-4 rounded-xl border border-[#d4dae8] bg-[#f8faff] p-4">
              <p className="font-black">Complete profile match</p>
              <p className="mt-1 text-sm font-medium text-[#737b8f]">Ranks opportunities by semantic fit between your full profile and each post.</p>
              <p className="mt-3 text-sm font-bold text-[#596173]">{loading ? "Matching your profile..." : "AI profile ranking loaded."}</p>
            </div>
          )}
          {mode === "goal" && (
            <div className="mt-4">
              <label className="block text-sm font-bold text-[#3f4659]">
                Describe your current goal
                <textarea className="field mt-2 min-h-32 resize-y py-3" value={goalQuery} onChange={(event) => setGoalQuery(event.target.value)} />
              </label>
              <button className="mt-3 h-11 w-full rounded-xl bg-nusPurple font-bold text-white disabled:opacity-60" onClick={runGoalSearch} disabled={loading || user.role !== "student" || goalQuery.trim().length < 20} type="button">
                {loading ? "Matching..." : "Find goal matches"}
              </button>
            </div>
          )}
          <label className="mt-5 block text-sm font-bold text-[#3f4659]">
            Minimum match: {minimumScore}%
            <input className="mt-2 w-full accent-nusPurple" type="range" min="0" max="90" step="5" value={minimumScore} onChange={(event) => setMinimumScore(Number(event.target.value))} />
          </label>
          {user.role !== "student" && <p className="mt-4 rounded-xl bg-[#fff7e8] p-3 text-sm font-bold text-[#9a5a00]">Matching is only available from student accounts. You can still post opportunities.</p>}
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-emerald-600" size={20} />
            <h3 className="text-lg font-black">My opportunity posts</h3>
          </div>
          <p className="mt-2 text-sm font-medium text-[#737b8f]">{user.role === "mentor" ? "Your posts are automatically verified." : "Your posts are visible as unverified."}</p>
          <button className="mt-4 h-11 w-full rounded-xl bg-nusOrange font-bold text-white" onClick={openCreateForm} type="button">
            Post an opportunity
          </button>
          {postMessage && <p className="mt-3 text-sm font-bold text-emerald-700">{postMessage}</p>}
          <div className="mt-5 space-y-3">
            {myPosts.length ? (
              myPosts.map((opportunity) => (
                <MyPostCard key={opportunity.id} opportunity={opportunity} onEdit={() => openEditForm(opportunity)} />
              ))
            ) : (
              <p className="rounded-xl bg-[#f8faff] p-4 text-sm font-semibold text-[#737b8f]">You have not posted any opportunities yet.</p>
            )}
          </div>
          {formOpen && (
            <div className="mt-6 rounded-xl border border-[#d4dae8] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-black">{editingOpportunityId ? "Edit opportunity" : "Post an opportunity"}</h4>
                <button className="text-sm font-black text-[#737b8f]" onClick={closeForm} type="button">Close</button>
              </div>
              <label className="mt-4 block text-sm font-bold text-[#3f4659]">
                Category
                <select className="field mt-2" value={draft.category} onChange={(event) => updateDraft("category", event.target.value)}>
                  {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                </select>
              </label>
              <p className="mt-2 text-sm font-medium text-[#737b8f]">{selectedCopy.summary}</p>
              <div className="mt-4 space-y-3">
                <TextField label="Title" value={draft.title} onChange={(value) => updateDraft("title", value)} placeholder="NUS AI Product Sprint" />
                <TextField label="Organisation" value={draft.organisation} onChange={(value) => updateDraft("organisation", value)} placeholder="NUS Hackers, SoC Lab, Residential College" />
                <TextField label="Short summary" value={draft.summary} onChange={(value) => updateDraft("summary", value)} placeholder="One-sentence student-facing summary" />
                <label className="block text-sm font-bold text-[#3f4659]">
                  Description
                  <textarea className="field mt-2 min-h-28 resize-y py-3" value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} placeholder="Explain what students will do, who should apply, and what they can gain." />
                </label>
                <TextField label="Faculty or school" value={draft.faculty} onChange={(value) => updateDraft("faculty", value)} placeholder="Computing, Business, Open to all" />
                <TextField label="Relevant majors" value={draft.relevant_majors} onChange={(value) => updateDraft("relevant_majors", value)} placeholder="Computer Science, Data Science, Business Analytics" />
                <TextField label="Target years" value={draft.target_years} onChange={(value) => updateDraft("target_years", value)} placeholder="Year 1, Year 2, Masters" />
                <TextField label="Commitment" value={draft.commitment} onChange={(value) => updateDraft("commitment", value)} placeholder={selectedCopy.commitmentPlaceholder} />
                <TextField label="Location or mode" value={draft.location} onChange={(value) => updateDraft("location", value)} placeholder="SoC, Utown, hybrid, online" />
                <TextField label="Deadline" value={draft.deadline} onChange={(value) => updateDraft("deadline", value)} placeholder="2026-08-30 or rolling" />
                <TextField label="Tags" value={draft.tags} onChange={(value) => updateDraft("tags", value)} placeholder="AI, NOC, startup, leadership" />
                <TextField label="Skills students can build" value={draft.skills} onChange={(value) => updateDraft("skills", value)} placeholder={selectedCopy.skillPlaceholder} />
                <TextField label={selectedCopy.detailLabel} value={draft.details} onChange={(value) => updateDraft("details", value)} placeholder={selectedCopy.detailPlaceholder} />
                <TextField label="Application URL" value={draft.application_url} onChange={(value) => updateDraft("application_url", value)} placeholder="https://..." />
                <TextField label="Contact email" value={draft.contact_email} onChange={(value) => updateDraft("contact_email", value)} placeholder="person@nus.edu.sg" />
              </div>
              <button className="mt-5 h-11 w-full rounded-xl bg-nusOrange font-bold text-white disabled:opacity-60" onClick={submitOpportunity} disabled={posting} type="button">
                {posting ? "Saving..." : editingOpportunityId ? "Save changes" : "Post opportunity"}
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#d4dae8] bg-white p-5">
          <div>
            <h2 className="text-2xl font-black text-[#1f2333]">Personalised opportunities</h2>
            <p className="mt-1 font-medium text-[#737b8f]">{visibleMatches.length} matched posts sorted by fit.</p>
          </div>
          <div className="flex items-center gap-2 text-sm font-bold text-[#596173]">
            {loading ? <Loader2 className="animate-spin text-nusPurple" size={18} /> : <Search size={18} />}
            {mode === "standard" ? "Standard search" : mode === "profile" ? "AI profile search" : "AI goal search"}
          </div>
        </div>
        {error && <p className="rounded-xl bg-[#fff7f4] px-4 py-3 font-bold text-[#9d2a1d]">{error}</p>}
        {loading ? (
          <div className="card grid min-h-64 place-items-center p-8 text-center">
            <Loader2 className="mx-auto animate-spin text-nusPurple" size={30} />
            <p className="mt-4 font-black text-[#596173]">Matching opportunities...</p>
          </div>
        ) : visibleMatches.length ? (
          visibleMatches.map((opportunity) => <OpportunityCard key={opportunity.id} opportunity={opportunity} mode={mode} />)
        ) : (
          <div className="card p-8 text-center">
            <p className="text-xl font-black">No opportunities match yet.</p>
            <p className="mt-2 font-medium text-[#737b8f]">Try a broader query, clear categories, or lower the minimum match.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block text-sm font-bold text-[#3f4659]">
      {label}
      <input className="field mt-2" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}
