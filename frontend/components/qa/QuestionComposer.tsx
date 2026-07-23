import { useMemo, useState } from "react";

import { splitList } from "@/lib/profile-utils";
import type { DuplicateQuestionSuggestion, Question, User } from "@/types/api";

import { DuplicateSuggestions } from "./DuplicateSuggestions";

export type QuestionDraft = {
  title: string;
  topic: string;
  body: string;
  tags: string[];
  attachments: string[];
};

const initialDraft = {
  title: "How should I choose between NOC and exchange?",
  topic: "NOC / Exchange",
  body: "I want to understand which option is better if I care about startups, internships, and keeping my module plan manageable.",
  tags: "NUS Overseas Colleges, Exchange, Internship planning",
};

export function QuestionComposer({
  user,
  questions,
  recentTerms,
  suggestions,
  checkingSuggestions,
  suggestionError,
  suggestionsChecked,
  posting,
  onCheckSuggestions,
  onPostQuestion,
  onOpenQuestion,
  onUseTerm,
}: {
  user: User;
  questions: Question[];
  recentTerms: string[];
  suggestions: DuplicateQuestionSuggestion[];
  checkingSuggestions: boolean;
  suggestionError: string;
  suggestionsChecked: boolean;
  posting: boolean;
  onCheckSuggestions: (draft: QuestionDraft) => Promise<void>;
  onPostQuestion: (draft: QuestionDraft) => Promise<void>;
  onOpenQuestion: (questionId: string) => void;
  onUseTerm: (term: string) => void;
}) {
  const [title, setTitle] = useState(initialDraft.title);
  const [topic, setTopic] = useState(initialDraft.topic);
  const [body, setBody] = useState(initialDraft.body);
  const [tags, setTags] = useState(initialDraft.tags);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [validationError, setValidationError] = useState("");

  const draft = useMemo(
    () => ({ title, topic, body, tags: splitList(tags), attachments }),
    [attachments, body, tags, title, topic],
  );

  function validateDraft() {
    if (title.trim().length < 8) return "Add a clearer subject before checking the archive.";
    if (topic.trim().length < 2) return "Add an area of concern so mentors can route the query.";
    if (body.trim().length < 20) return "Add a little more context before posting.";
    return "";
  }

  async function checkDraft() {
    const error = validateDraft();
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError("");
    await onCheckSuggestions(draft);
  }

  async function postDraft() {
    const error = validateDraft();
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError("");
    await onPostQuestion(draft);
    setTitle("");
    setTopic("");
    setBody("");
    setTags("");
    setAttachments([]);
  }

  if (user.role !== "student") {
    return (
      <p className="font-medium text-[#737b8f]">
        Only mentor accounts can respond to queries. Your responses are summarised and stored in the knowledge archive for future students.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm font-bold text-[#3f4659]">
        Query subject
        <input className="field mt-2" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Short title for your query" />
      </label>
      <label className="block text-sm font-bold text-[#3f4659]">
        Area of concern
        <input
          className="field mt-2"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="NOC, exchange, internships, research..."
          list="recent-query-terms"
        />
      </label>
      <label className="block text-sm font-bold text-[#3f4659]">
        Query description
        <textarea
          className="field mt-2 min-h-32 resize-y py-3"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Describe the context, what you have tried, and what guidance you need."
        />
      </label>
      <label className="block text-sm font-bold text-[#3f4659]">
        Key terms
        <input
          className="field mt-2"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          placeholder="Comma separated, e.g. NOC, exchange, internship planning"
          list="recent-query-terms"
        />
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
      {validationError && <p className="rounded-xl bg-[#fff7f4] px-4 py-3 text-sm font-bold text-[#9d2a1d]">{validationError}</p>}
      <DuplicateSuggestions
        suggestions={suggestions}
        questions={questions}
        checking={checkingSuggestions}
        error={suggestionError}
        checked={suggestionsChecked}
        onOpenQuestion={onOpenQuestion}
        onEditDraft={() => setValidationError("")}
        onPostAnyway={postDraft}
        posting={posting}
      />
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <button className="h-12 rounded-xl border border-[#a7bdf5] bg-white font-bold text-nusPurple disabled:opacity-60" onClick={checkDraft} disabled={checkingSuggestions || posting}>
          {checkingSuggestions ? "Checking..." : "Check archive"}
        </button>
        <button className="h-12 rounded-xl bg-nusPurple font-bold text-white disabled:opacity-60" onClick={postDraft} disabled={checkingSuggestions || posting}>
          {posting ? "Posting..." : "Post query"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {recentTerms.slice(0, 5).map((term) => (
          <button key={term} className="chip bg-[#f1f4f9] text-[#596173]" onClick={() => onUseTerm(term)}>
            Use {term}
          </button>
        ))}
      </div>
    </div>
  );
}
