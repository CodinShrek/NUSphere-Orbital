import { LoaderCircle } from "lucide-react";

import { pastel } from "@/data/profile-options";
import type { Question, User } from "@/types/api";

export function QuestionCard({
  question,
  user,
  answerDraft,
  answering,
  onAnswerDraftChange,
  onSubmitAnswer,
}: {
  question: Question;
  user: User;
  answerDraft: string;
  answering: boolean;
  onAnswerDraftChange: (value: string) => void;
  onSubmitAnswer: () => void;
}) {
  const tags = [...question.tags, ...(question.key_terms ?? [])]
    .filter(Boolean)
    .filter((tag, index, all) => all.findIndex((item) => item.toLowerCase() === tag.toLowerCase()) === index)
    .slice(0, 10);

  return (
    <article className="card scroll-mt-8 p-6" id={`question-${question.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="chip bg-[#f3f0ff] text-nusPurple">{question.topic_cluster}</span>
            <span className="chip bg-[#eef4ff] text-[#31508f]">{question.topic || "General concern"}</span>
          </div>
          <h2 className="mt-3 text-2xl font-black">{question.title}</h2>
          <p className="mt-2 font-medium text-[#737b8f]">Asked by {question.student_name}</p>
        </div>
        <span className="chip bg-[#f8f1e8] text-[#7b5227]">{question.answers.length} archived answers</span>
      </div>
      <p className="mt-4 rounded-xl border border-dashed border-[#cfd6e6] bg-[#f8faff] p-4 font-medium text-[#596173]">{question.body}</p>
      {tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag, index) => <span key={tag} className={`chip ${pastel[index % pastel.length]}`}>{tag}</span>)}
        </div>
      )}
      {question.attachments?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {question.attachments.map((file) => <span key={file} className="chip bg-[#f1f4f9] text-[#596173]">{file}</span>)}
        </div>
      )}
      <div className="mt-5 space-y-3">
        {question.answers.map((answer) => (
          <div key={answer.id} className="rounded-xl border border-[#d4dae8] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-black">{answer.mentor_name}</p>
              <span className="text-xs font-black uppercase text-[#9aa1b3]">
                {answer.summary_version === "legacy-v1" ? "Legacy archive summary" : "Archive summary"}
              </span>
            </div>
            <p className="mt-2 font-medium text-[#596173]">{answer.body}</p>
            <p className="mt-3 rounded-lg bg-[#f3f0ff] px-3 py-2 text-sm font-bold text-nusPurple">
              Summary: {answer.summary || "Summary will appear after the answer is archived."}
            </p>
          </div>
        ))}
        {!question.answers.length && <p className="rounded-xl border border-dashed border-[#cfd6e6] bg-[#f8faff] p-4 font-medium text-[#737b8f]">No mentor response yet.</p>}
      </div>
      {user.role === "mentor" && (
        <div className="mt-5 flex gap-3 max-md:flex-col">
          <input
            className="field"
            value={answerDraft}
            onChange={(event) => onAnswerDraftChange(event.target.value)}
            placeholder="Write a mentor answer"
          />
          <button className="flex h-14 items-center justify-center gap-2 rounded-xl bg-nusPurple px-6 font-bold text-white disabled:opacity-60" onClick={onSubmitAnswer} disabled={answering || !answerDraft.trim()}>
            {answering && <LoaderCircle className="animate-spin" size={18} />}
            {answering ? "Answering..." : "Answer"}
          </button>
        </div>
      )}
      {user.role !== "mentor" && <p className="mt-4 text-sm font-bold text-[#9aa1b3]">Only mentors can respond to posted queries.</p>}
    </article>
  );
}
