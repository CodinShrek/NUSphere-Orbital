import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { pastel } from "@/data/profile-options";
import { ALL_CLUSTERS, filterQuestions, frequentQuestionTerms, questionClusters } from "@/lib/qa-utils";
import type { DuplicateQuestionSuggestion, Question, User } from "@/types/api";
import { Panel } from "@/components/ui/Panel";

import { QuestionCard } from "./QuestionCard";
import { QuestionComposer, type QuestionDraft } from "./QuestionComposer";

const fallbackTerms = ["NOC", "Exchange", "Internships", "Research"];

export function QAArchive({
  user,
  questions,
  onCreateQuestion,
  onAnswerQuestion,
  onSuggestDuplicates,
}: {
  user: User;
  questions: Question[];
  onCreateQuestion: (payload: QuestionDraft) => Promise<void>;
  onAnswerQuestion: (questionId: string, body: string) => Promise<void>;
  onSuggestDuplicates: (payload: Omit<QuestionDraft, "attachments">) => Promise<DuplicateQuestionSuggestion[]>;
}) {
  const [archiveSearch, setArchiveSearch] = useState("");
  const [selectedCluster, setSelectedCluster] = useState(ALL_CLUSTERS);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [suggestions, setSuggestions] = useState<DuplicateQuestionSuggestion[]>([]);
  const [checkingSuggestions, setCheckingSuggestions] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");
  const [suggestionsChecked, setSuggestionsChecked] = useState(false);
  const [postingQuestion, setPostingQuestion] = useState(false);
  const [answeringQuestionId, setAnsweringQuestionId] = useState("");
  const [postError, setPostError] = useState("");
  const [answerError, setAnswerError] = useState("");

  const recentTerms = useMemo(() => frequentQuestionTerms(questions), [questions]);
  const clusters = useMemo(() => questionClusters(questions), [questions]);
  const filteredQuestions = useMemo(() => filterQuestions(questions, archiveSearch, selectedCluster), [archiveSearch, questions, selectedCluster]);

  async function checkSuggestions(draft: QuestionDraft) {
    setCheckingSuggestions(true);
    setSuggestionError("");
    setSuggestionsChecked(false);
    try {
      const result = await onSuggestDuplicates({
        title: draft.title,
        topic: draft.topic,
        body: draft.body,
        tags: draft.tags,
      });
      setSuggestions(result);
      setSuggestionsChecked(true);
    } catch (err) {
      setSuggestionError(err instanceof Error ? err.message : "Duplicate check failed");
      setSuggestions([]);
      setSuggestionsChecked(true);
    } finally {
      setCheckingSuggestions(false);
    }
  }

  async function postQuestion(draft: QuestionDraft) {
    setPostingQuestion(true);
    setPostError("");
    try {
      await onCreateQuestion(draft);
      setSuggestions([]);
      setSuggestionsChecked(false);
      setSuggestionError("");
    } catch (err) {
      setPostError(err instanceof Error ? err.message : "Question could not be posted");
    } finally {
      setPostingQuestion(false);
    }
  }

  async function submitAnswer(questionId: string) {
    const answer = answerDrafts[questionId] ?? "";
    if (!answer.trim()) return;
    setAnsweringQuestionId(questionId);
    setAnswerError("");
    try {
      await onAnswerQuestion(questionId, answer);
      setAnswerDrafts((current) => ({ ...current, [questionId]: "" }));
    } catch (err) {
      setAnswerError(err instanceof Error ? err.message : "Answer could not be posted");
    } finally {
      setAnsweringQuestionId("");
    }
  }

  function openQuestion(questionId: string) {
    const target = document.getElementById(`question-${questionId}`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    const question = questions.find((item) => item.id === questionId);
    if (question) {
      setArchiveSearch(question.title);
      setSelectedCluster(question.topic_cluster || ALL_CLUSTERS);
    }
  }

  function handleUseTerm(term: string) {
    setArchiveSearch(term);
    const cluster = clusters.find((item) => item.toLowerCase() === term.toLowerCase());
    if (cluster) setSelectedCluster(cluster);
  }

  return (
    <section className="grid grid-cols-[390px_1fr] gap-7 p-8 max-xl:grid-cols-1">
      <aside className="space-y-6">
        <Panel title="Knowledge Archive">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9aa1b3]" size={18} />
            <input className="field pl-11" value={archiveSearch} onChange={(event) => setArchiveSearch(event.target.value)} placeholder="Search previous answers by keyword" />
          </div>
          <label className="mt-4 block text-sm font-bold text-[#3f4659]">
            Topic cluster
            <select className="field mt-2" value={selectedCluster} onChange={(event) => setSelectedCluster(event.target.value)}>
              {clusters.map((cluster) => <option key={cluster} value={cluster}>{cluster}</option>)}
            </select>
          </label>
          <p className="mt-3 text-sm font-medium text-[#737b8f]">
            {filteredQuestions.length} matching archived {filteredQuestions.length === 1 ? "query" : "queries"}
          </p>
        </Panel>
        <Panel title="Frequently Asked Recently">
          <div className="flex flex-wrap gap-2">
            {(recentTerms.length ? recentTerms : fallbackTerms).map((term, index) => (
              <button
                key={term}
                className={`chip ${archiveSearch.toLowerCase() === term.toLowerCase() ? "bg-nusPurple text-white" : pastel[index % pastel.length]}`}
                onClick={() => handleUseTerm(term)}
              >
                {term}
              </button>
            ))}
          </div>
        </Panel>
        <Panel title={user.role === "mentor" ? "Mentor Access" : "Post a Query"}>
          <QuestionComposer
            user={user}
            questions={questions}
            recentTerms={recentTerms}
            suggestions={suggestions}
            checkingSuggestions={checkingSuggestions}
            suggestionError={suggestionError}
            suggestionsChecked={suggestionsChecked}
            posting={postingQuestion}
            onCheckSuggestions={checkSuggestions}
            onPostQuestion={postQuestion}
            onOpenQuestion={openQuestion}
            onUseTerm={handleUseTerm}
          />
          {postError && <p className="mt-4 rounded-xl bg-[#fff7f4] px-4 py-3 text-sm font-bold text-[#9d2a1d]">{postError}</p>}
        </Panel>
      </aside>

      <div className="space-y-5">
        {answerError && <p className="rounded-xl bg-[#fff7f4] px-4 py-3 text-sm font-bold text-[#9d2a1d]">{answerError}</p>}
        {filteredQuestions.map((question) => (
          <QuestionCard
            key={question.id}
            question={question}
            user={user}
            answerDraft={answerDrafts[question.id] ?? ""}
            answering={answeringQuestionId === question.id}
            onAnswerDraftChange={(value) => setAnswerDrafts((current) => ({ ...current, [question.id]: value }))}
            onSubmitAnswer={() => submitAnswer(question.id)}
          />
        ))}
        {!filteredQuestions.length && (
          <Panel title={questions.length ? "No archived match" : "No questions yet"}>
            <p className="font-medium text-[#737b8f]">
              {questions.length
                ? "Try another keyword or cluster, or post a new query so mentors can add an answer to the archive."
                : "The archive is empty. Student questions will appear here once they are posted."}
            </p>
          </Panel>
        )}
      </div>
    </section>
  );
}
