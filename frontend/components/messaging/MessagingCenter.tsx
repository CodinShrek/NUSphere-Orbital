"use client";

import { Archive, BellOff, CheckCheck, Pin, Search, Send } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { Panel } from "@/components/ui/Panel";
import {
  conversationParticipantName,
  filterConversations,
  totalUnreadMessages,
} from "@/lib/messaging-utils";
import type { Conversation, User } from "@/types/api";
import type { View } from "@/types/navigation";

type ConversationFilter = "all" | "unread" | "pinned" | "archived" | "muted";

type MessagingCenterProps = {
  user: User;
  conversations: Conversation[];
  activeConversationId: string;
  pendingRequests: ReactNode;
  setActiveConversationId: (id: string) => void;
  onSendMessage: (conversationId: string, body: string) => Promise<void>;
  onMarkRead: (conversationId: string) => Promise<void>;
  onUpdateState: (
    conversationId: string,
    payload: {
      is_pinned?: boolean;
      is_archived?: boolean;
      is_muted?: boolean;
    },
  ) => Promise<void>;
  setActiveView: (view: View) => void;
};

export function MessagingCenter({
  user,
  conversations,
  activeConversationId,
  pendingRequests,
  setActiveConversationId,
  onSendMessage,
  onMarkRead,
  onUpdateState,
  setActiveView,
}: MessagingCenterProps) {
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ConversationFilter>("all");
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const visibleConversations = useMemo(
    () => filterConversations(conversations, query, filter, user),
    [conversations, filter, query, user],
  );
  const active =
    conversations.find((conversation) => conversation.id === activeConversationId) ??
    visibleConversations[0] ??
    conversations[0];
  const unreadTotal = totalUnreadMessages(conversations);

  async function openConversation(conversation: Conversation) {
    setActiveConversationId(conversation.id);
    setError("");
    if (conversation.unread_count > 0) {
      setBusyId(conversation.id);
      try {
        await onMarkRead(conversation.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to mark conversation read");
      } finally {
        setBusyId("");
      }
    }
  }

  async function submitMessage() {
    if (!active || !message.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      await onSendMessage(active.id, message.trim());
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send message");
    } finally {
      setSending(false);
    }
  }

  async function updateState(payload: Parameters<MessagingCenterProps["onUpdateState"]>[1]) {
    if (!active || busyId) return;
    setBusyId(active.id);
    setError("");
    try {
      await onUpdateState(active.id, payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update conversation");
    } finally {
      setBusyId("");
    }
  }

  if (!conversations.length) {
    return (
      <section className="space-y-6 p-8">
        {pendingRequests}
        <Panel title="Messages">
          <div className="rounded-xl border border-dashed border-[#cfd6e6] bg-[#f8faff] p-6">
            <p className="font-black text-[#1f2333]">No accepted conversations yet.</p>
            <p className="mt-2 font-medium text-[#737b8f]">
              Students must request a connection and mentors must accept before messaging starts.
            </p>
            <button
              className="mt-4 h-11 rounded-xl bg-nusPurple px-6 font-bold text-white"
              onClick={() => setActiveView("find")}
            >
              Find mentors
            </button>
          </div>
        </Panel>
      </section>
    );
  }

  return (
    <section className="grid grid-cols-[360px_1fr] gap-7 p-8 max-xl:grid-cols-1">
      <div className="space-y-6">
        {pendingRequests}
        <Panel title="Conversations">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 text-[#8a92a6]" size={18} />
            <input
              className="field pl-10"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search conversations"
            />
          </div>
          <div className="mt-4 grid grid-cols-5 gap-1 rounded-xl border border-[#d9deeb] bg-[#f7f9fd] p-1 text-xs font-black">
            {(["all", "unread", "pinned", "archived", "muted"] as ConversationFilter[]).map((item) => (
              <button
                key={item}
                className={`h-9 rounded-lg capitalize ${filter === item ? "bg-white text-nusPurple shadow-sm" : "text-[#687086]"}`}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <p className="mt-4 text-sm font-semibold text-[#737b8f]">
            {unreadTotal ? `${unreadTotal} unread message${unreadTotal === 1 ? "" : "s"}` : "Inbox is caught up"}
          </p>
          <div className="mt-4 space-y-3">
            {visibleConversations.map((conversation) => (
              <ConversationButton
                key={conversation.id}
                conversation={conversation}
                user={user}
                active={active?.id === conversation.id}
                loading={busyId === conversation.id}
                onOpen={() => openConversation(conversation)}
              />
            ))}
            {!visibleConversations.length && (
              <p className="rounded-xl border border-dashed border-[#d4dae8] p-4 text-sm font-semibold text-[#737b8f]">
                No conversations match this view.
              </p>
            )}
          </div>
        </Panel>
      </div>

      <Panel title={active ? `Chat with ${conversationParticipantName(active, user)}` : "Messages"}>
        {active && (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <StateButton
                active={active.is_pinned}
                icon={<Pin size={16} />}
                label={active.is_pinned ? "Unpin" : "Pin"}
                onClick={() => updateState({ is_pinned: !active.is_pinned })}
              />
              <StateButton
                active={active.is_archived}
                icon={<Archive size={16} />}
                label={active.is_archived ? "Unarchive" : "Archive"}
                onClick={() => updateState({ is_archived: !active.is_archived })}
              />
              <StateButton
                active={active.is_muted}
                icon={<BellOff size={16} />}
                label={active.is_muted ? "Unmute" : "Mute"}
                onClick={() => updateState({ is_muted: !active.is_muted })}
              />
              {active.unread_count > 0 && (
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d4dae8] px-4 text-sm font-bold text-[#596173]"
                  onClick={() => openConversation(active)}
                >
                  <CheckCheck size={16} />
                  Mark read
                </button>
              )}
            </div>
            {error && (
              <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                {error}
              </p>
            )}
            <div className="max-h-[56vh] space-y-3 overflow-y-auto pr-2">
              {active.messages.map((item) => (
                <div
                  key={item.id}
                  className={`max-w-[75%] rounded-2xl p-4 ${item.sender_id === user.id ? "ml-auto bg-nusPurple text-white" : "bg-[#f3f5fb] text-[#1f2333]"}`}
                >
                  <p className="text-xs font-black uppercase opacity-75">{item.sender_name}</p>
                  <p className="mt-1 font-medium">{item.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex gap-3 max-md:flex-col">
              <input
                className="field"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Write a message"
                onKeyDown={(event) => {
                  if (event.key === "Enter") void submitMessage();
                }}
              />
              <button
                className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-nusPurple px-6 font-bold text-white disabled:opacity-60"
                disabled={sending || !message.trim()}
                onClick={submitMessage}
              >
                <Send size={18} />
                {sending ? "Sending" : "Send"}
              </button>
            </div>
          </>
        )}
      </Panel>
    </section>
  );
}

function ConversationButton({
  conversation,
  user,
  active,
  loading,
  onOpen,
}: {
  conversation: Conversation;
  user: User;
  active: boolean;
  loading: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      className={`w-full rounded-xl border p-4 text-left ${active ? "border-nusPurple bg-[#f3f0ff]" : "border-[#d4dae8] bg-white"}`}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black">{conversationParticipantName(conversation, user)}</p>
          <p className="text-sm font-medium text-[#737b8f]">{conversation.mentor_programme}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {conversation.is_pinned && <Pin className="text-nusPurple" size={15} />}
          {conversation.is_archived && <Archive className="text-[#737b8f]" size={15} />}
          {conversation.is_muted && <BellOff className="text-[#737b8f]" size={15} />}
          {conversation.unread_count > 0 && (
            <span className="grid min-h-6 min-w-6 place-items-center rounded-full bg-nusOrange px-1.5 text-xs font-black text-white">
              {conversation.unread_count}
            </span>
          )}
        </div>
      </div>
      <p className="mt-2 truncate text-sm text-[#596173]">{conversation.last_message}</p>
      {loading && <p className="mt-2 text-xs font-bold text-nusPurple">Updating...</p>}
    </button>
  );
}

function StateButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-bold ${active ? "border-nusPurple bg-[#f3f0ff] text-nusPurple" : "border-[#d4dae8] text-[#596173]"}`}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}
