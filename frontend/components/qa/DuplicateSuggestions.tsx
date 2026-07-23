import { AlertCircle, ExternalLink, LoaderCircle } from "lucide-react";

import type { DuplicateQuestionSuggestion, Question } from "@/types/api";

export function DuplicateSuggestions({
  suggestions,
  questions,
  checking,
  error,
  checked,
  onOpenQuestion,
  onEditDraft,
  onPostAnyway,
  posting,
}: {
  suggestions: DuplicateQuestionSuggestion[];
  questions: Question[];
  checking: boolean;
  error: string;
  checked: boolean;
  onOpenQuestion: (questionId: string) => void;
  onEditDraft: () => void;
  onPostAnyway: () => void;
  posting: boolean;
}) {
  if (checking) {
    return (
      <div className="rounded-xl border border-[#d4dae8] bg-[#f8faff] p-4">
        <div className="flex items-center gap-3 font-bold text-[#596173]">
          <LoaderCircle className="animate-spin text-nusPurple" size={20} />
          Checking the archive for similar questions...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[#f2c7be] bg-[#fff7f4] p-4">
        <div className="flex gap-3">
          <AlertCircle className="mt-0.5 shrink-0 text-[#c02b18]" size={20} />
          <div>
            <p className="font-black text-[#9d2a1d]">Could not check for duplicates</p>
            <p className="mt-1 text-sm font-semibold text-[#9d2a1d]">{error}</p>
            <button className="mt-3 text-sm font-black text-nusPurple" onClick={onPostAnyway} disabled={posting}>
              {posting ? "Posting..." : "Post without duplicate check"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!checked) return null;

  if (!suggestions.length) {
    return (
      <div className="rounded-xl border border-[#cfe3d5] bg-[#f6fff8] p-4">
        <p className="font-black text-[#2f6d45]">No close duplicates found</p>
        <p className="mt-1 text-sm font-semibold text-[#4f7d60]">This looks safe to post as a new query.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-[#d9d0f6] bg-[#fbf9ff] p-4">
      <div>
        <p className="font-black text-nusPurple">Similar archive posts found</p>
        <p className="mt-1 text-sm font-semibold text-[#737b8f]">
          Review these before posting. You can still post if your question needs a fresh answer.
        </p>
      </div>
      <div className="space-y-3">
        {suggestions.map((suggestion) => {
          const question = questions.find((item) => item.id === suggestion.question_id);
          return (
            <article key={suggestion.question_id} className="rounded-xl border border-[#d4dae8] bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black uppercase text-[#9aa1b3]">{suggestion.topic_cluster}</p>
                  <h4 className="mt-1 text-lg font-black">{suggestion.title}</h4>
                  <p className="mt-1 text-sm font-semibold text-[#737b8f]">
                    {suggestion.topic} - {suggestion.answer_count} archived {suggestion.answer_count === 1 ? "answer" : "answers"}
                  </p>
                </div>
                <span className="chip bg-[#f3f0ff] text-nusPurple">{suggestion.similarity_score}% similar</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestion.evidence.map((item) => (
                  <span key={item} className="chip bg-[#eef4ff] text-[#31508f]">{item}</span>
                ))}
              </div>
              {suggestion.latest_summary && (
                <p className="mt-3 rounded-lg bg-[#f7f8fb] px-3 py-2 text-sm font-bold text-[#596173]">
                  Latest archive summary: {suggestion.latest_summary}
                </p>
              )}
              <button
                className="mt-3 inline-flex items-center gap-2 text-sm font-black text-nusPurple"
                onClick={() => onOpenQuestion(question?.id ?? suggestion.question_id)}
              >
                Read existing question
                <ExternalLink size={16} />
              </button>
            </article>
          );
        })}
      </div>
      <div className="flex gap-3 max-sm:flex-col">
        <button className="h-11 rounded-xl border border-[#a7bdf5] bg-white px-5 font-bold text-nusPurple" onClick={onEditDraft}>
          Edit draft
        </button>
        <button className="h-11 rounded-xl bg-nusPurple px-5 font-bold text-white disabled:opacity-60" onClick={onPostAnyway} disabled={posting}>
          {posting ? "Posting..." : "Post anyway"}
        </button>
      </div>
    </div>
  );
}
