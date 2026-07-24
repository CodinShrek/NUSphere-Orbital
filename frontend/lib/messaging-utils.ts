import type { Conversation, User } from "@/types/api";

export function conversationParticipantName(
  conversation: Conversation,
  user: Pick<User, "id" | "role">,
) {
  return user.id === conversation.mentor_id || user.role === "mentor"
    ? conversation.student_name
    : conversation.mentor_name;
}

export function totalUnreadMessages(conversations: Conversation[]) {
  return conversations.reduce(
    (total, conversation) => total + conversation.unread_count,
    0,
  );
}

export function filterConversations(
  conversations: Conversation[],
  query: string,
  mode: "all" | "unread" | "pinned" | "archived" | "muted",
  user: Pick<User, "id" | "role">,
) {
  const normalisedQuery = query.trim().toLowerCase();
  return conversations
    .filter((conversation) => {
      if (mode === "unread" && conversation.unread_count === 0) return false;
      if (mode === "pinned" && !conversation.is_pinned) return false;
      if (mode === "archived" && !conversation.is_archived) return false;
      if (mode === "muted" && !conversation.is_muted) return false;
      if (mode === "all" && conversation.is_archived) return false;
      if (!normalisedQuery) return true;
      const participant = conversationParticipantName(conversation, user);
      return [
        participant,
        conversation.mentor_programme,
        conversation.last_message,
        ...conversation.messages.map((message) => message.body),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalisedQuery);
    })
    .sort((first, second) => {
      if (first.is_pinned !== second.is_pinned) {
        return first.is_pinned ? -1 : 1;
      }
      return (
        new Date(second.updated_at).getTime() - new Date(first.updated_at).getTime()
      );
    });
}
