import { BrainCircuit, Database, LoaderCircle, Sparkles, Zap } from "lucide-react";

import type { Mentor } from "@/types/api";

export function formatEmbeddingModel(model?: string) {
  if (!model) return "Unknown model";
  const [name, dimensions] = model.split(":");
  return dimensions ? `${name} (${dimensions} dimensions)` : name;
}

export function Score({
  score,
  label = "Match",
  compact = false,
}: {
  score: number;
  label?: string;
  compact?: boolean;
}) {
  return (
    <span className={`chip bg-[#fff8ef] text-nusOrange ${compact ? "text-xs" : ""}`}>
      <Zap size={14} fill="currentColor" />
      {score}% {label}
    </span>
  );
}

export function MatchLoadingState({ mode }: { mode: "profile" | "goal" }) {
  return (
    <div className="card overflow-hidden" role="status" aria-live="polite">
      <div className="flex items-center gap-3 border-b border-[#e1e5ef] bg-[#f8faff] px-6 py-4">
        <LoaderCircle className="animate-spin text-nusPurple" size={22} />
        <div>
          <p className="font-black">
            {mode === "profile" ? "Comparing complete profiles" : "Finding mentors for your goal"}
          </p>
          <p className="text-sm font-medium text-[#737b8f]">
            Generating embeddings, scoring mentor evidence, and preparing explanations.
          </p>
        </div>
      </div>
      <div className="space-y-4 p-6">
        {[0, 1].map((item) => (
          <div key={item} className="animate-pulse rounded-2xl border border-[#e1e5ef] p-5">
            <div className="flex gap-4">
              <div className="h-14 w-14 rounded-2xl bg-[#e8ebf4]" />
              <div className="flex-1 space-y-3">
                <div className="h-5 w-1/3 rounded bg-[#e8ebf4]" />
                <div className="h-4 w-1/2 rounded bg-[#eef0f6]" />
                <div className="h-16 rounded-xl bg-[#f1f3f8]" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading mentor matches</span>
    </div>
  );
}

export function MatchInsights({ mentor }: { mentor: Mentor }) {
  const breakdown = mentor.match_score_breakdown;
  const components = breakdown
    ? ([
        ["Semantic similarity", breakdown.semantic, "Meaning and intent across the profiles"],
        ["Structured overlap", breakdown.structured, "Shared interests, modules and experiences"],
        ["Faculty alignment", breakdown.faculty, "Whether both profiles share a faculty"],
        ["Profile completeness", breakdown.completeness, "Strength of the mentor profile evidence"],
      ] as const)
    : [];

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-[#d4dae8] bg-[#f8faff]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dfe4ef] px-4 py-3">
        <div className="flex items-center gap-2">
          <BrainCircuit className="text-nusPurple" size={19} />
          <p className="text-sm font-black uppercase tracking-wide text-[#596173]">Why this match</p>
        </div>
        {mentor.embedding_provider && (
          <span
            className={`chip text-xs ${mentor.embedding_fallback ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800"}`}
            title={formatEmbeddingModel(mentor.embedding_model)}
          >
            {mentor.embedding_fallback ? <Database size={13} /> : <Sparkles size={13} />}
            {mentor.embedding_fallback ? "Local fallback" : "OpenAI embeddings"}
          </span>
        )}
      </div>

      {breakdown && (
        <div className="border-b border-[#dfe4ef] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-black">Score breakdown</p>
              <p className="text-xs font-semibold text-[#737b8f]">
                Each signal is multiplied by its configured weight.
              </p>
            </div>
            <Score score={breakdown.total} label="Total AI fit" compact />
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {components.map(([label, component, description]) => (
              <div key={label} className="rounded-xl border border-[#dfe4ef] bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black">{label}</p>
                  <p className="text-sm font-black text-nusPurple">{component.score}%</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e9ecf4]">
                  <div
                    className="h-full rounded-full bg-nusPurple"
                    style={{ width: `${component.score}%` }}
                  />
                </div>
                <div className="mt-2 flex items-start justify-between gap-3 text-xs font-semibold text-[#737b8f]">
                  <span>{description}</span>
                  <span className="shrink-0">
                    {component.weight}% weight - {component.weighted_points.toFixed(1)} pts
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 p-4 md:grid-cols-2">
        {mentor.match_reasons.length ? (
          mentor.match_reasons.map((reason, index) => (
            <div
              key={`${reason}-${index}`}
              className="flex items-start gap-3 rounded-xl border border-[#dfe4ef] bg-white p-3"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#fff8ef] text-nusOrange">
                <Zap size={14} fill="currentColor" />
              </span>
              <p className="text-sm font-semibold leading-5 text-[#4f5668]">{reason}</p>
            </div>
          ))
        ) : (
          <p className="text-sm font-semibold text-[#737b8f]">
            No specific matching evidence is available yet.
          </p>
        )}
      </div>
    </section>
  );
}
