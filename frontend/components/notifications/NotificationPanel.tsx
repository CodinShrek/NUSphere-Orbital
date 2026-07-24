"use client";

import { Bell, CheckCheck, LoaderCircle } from "lucide-react";
import { useState } from "react";

import type { Notification } from "@/types/api";
import type { View } from "@/types/navigation";

type NotificationPanelProps = {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string;
  onRefresh: () => Promise<void>;
  onMarkRead: (notificationId: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  setActiveView: (view: View) => void;
  setActiveConversationId: (id: string) => void;
};

export function NotificationPanel({
  notifications,
  unreadCount,
  loading,
  error,
  onRefresh,
  onMarkRead,
  onMarkAllRead,
  setActiveView,
  setActiveConversationId,
}: NotificationPanelProps) {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState("");

  async function toggleOpen() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) await onRefresh();
  }

  async function openNotification(notification: Notification) {
    setBusyId(notification.id);
    try {
      if (!notification.is_read) await onMarkRead(notification.id);
      if (notification.target_type === "conversation") {
        setActiveConversationId(notification.target_id);
        setActiveView("messages");
      }
      if (notification.target_type === "question") {
        setActiveView("qa");
      }
      setOpen(false);
    } finally {
      setBusyId("");
    }
  }

  async function markAllRead() {
    setBusyId("all");
    try {
      await onMarkAllRead();
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="relative">
      <button
        className="relative grid h-11 w-11 place-items-center rounded-xl border border-[#cfd6e6] bg-[#f4f6fb]"
        aria-label="Notifications"
        onClick={() => void toggleOpen()}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-nusOrange px-1 text-[11px] font-black text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-20 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[#d4dae8] bg-white shadow-soft">
          <div className="flex items-center justify-between gap-3 border-b border-[#eef1f7] px-4 py-3">
            <div>
              <p className="font-black text-[#1f2333]">Notifications</p>
              <p className="text-xs font-semibold text-[#737b8f]">
                {unreadCount ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>
            <button
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#d4dae8] px-3 text-xs font-bold text-[#596173] disabled:opacity-50"
              disabled={!unreadCount || busyId === "all"}
              onClick={() => void markAllRead()}
            >
              <CheckCheck size={14} />
              Read all
            </button>
          </div>
          {error && (
            <p className="m-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
              {error}
            </p>
          )}
          {loading && (
            <div className="flex items-center gap-2 p-4 text-sm font-bold text-[#737b8f]">
              <LoaderCircle className="animate-spin" size={16} />
              Loading notifications
            </div>
          )}
          {!loading && !notifications.length && (
            <p className="p-4 text-sm font-semibold text-[#737b8f]">
              No notifications yet.
            </p>
          )}
          <div className="max-h-[420px] overflow-y-auto">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                className={`block w-full border-b border-[#eef1f7] px-4 py-3 text-left last:border-b-0 ${notification.is_read ? "bg-white" : "bg-[#fff8ef]"}`}
                onClick={() => void openNotification(notification)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-[#1f2333]">
                      {notification.title}
                    </p>
                    <p className="mt-1 max-h-9 overflow-hidden text-xs font-semibold text-[#737b8f]">
                      {notification.body}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-nusOrange" />
                  )}
                </div>
                {busyId === notification.id && (
                  <p className="mt-2 text-xs font-bold text-nusPurple">Opening...</p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
