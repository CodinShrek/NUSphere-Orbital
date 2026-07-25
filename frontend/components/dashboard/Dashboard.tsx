import { Bot } from "lucide-react";

import { PendingConnectionRequests } from "@/components/dashboard/PendingConnectionRequests";
import { Panel } from "@/components/ui/Panel";
import { Metric } from "@/components/ui/Metric";
import { profileCompletion, relatedQuestionsForUser } from "@/lib/dashboard-utils";
import type { Connection, Conversation, MentorType, Question, User } from "@/types/api";
import type { View } from "@/types/navigation";
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

export function Dashboard({
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
  const unreadConversations = conversations.filter((conversation) => conversation.unread_count > 0);
  const completion = profileCompletion(user);
  const relatedPosts = relatedQuestionsForUser(user, questions);
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
