"use client";

import { LogOut, UserRound } from "lucide-react";

import { NotificationPanel } from "@/components/notifications/NotificationPanel";
import { Logo } from "@/components/ui/Logo";
import type { Notification, User } from "@/types/api";
import type { View } from "@/types/navigation";

export function Nav({
  activeView,
  setActiveView,
  user,
  notifications,
  notificationUnreadCount,
  notificationsLoading,
  notificationError,
  setActiveConversationId,
  onRefreshNotifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onLogout,
}: {
  activeView: View;
  setActiveView: (view: View) => void;
  user: User;
  notifications: Notification[];
  notificationUnreadCount: number;
  notificationsLoading: boolean;
  notificationError: string;
  setActiveConversationId: (id: string) => void;
  onRefreshNotifications: () => Promise<void>;
  onMarkNotificationRead: (notificationId: string) => Promise<void>;
  onMarkAllNotificationsRead: () => Promise<void>;
  onLogout: () => void;
}) {
  return (
    <nav className="sticky top-0 z-10 flex min-h-[70px] flex-wrap items-center justify-between gap-4 border-b border-[#cfd6e6] bg-white px-8 py-3">
      <Logo />
      <div className="flex flex-wrap items-center justify-center gap-2 text-base font-bold text-[#697085]">
        <button
          className={`rounded-lg px-4 py-2 ${activeView === "home" ? "bg-[#f3f0ff] text-nusPurple" : ""}`}
          onClick={() => setActiveView("home")}
        >
          Home
        </button>
        <button
          className={`rounded-lg px-4 py-2 ${activeView === "find" ? "bg-[#f3f0ff] text-nusPurple" : ""}`}
          onClick={() => setActiveView("find")}
        >
          Find Mentors
        </button>
        <button
          className={`rounded-lg px-4 py-2 ${activeView === "opportunities" ? "bg-[#f3f0ff] text-nusPurple" : ""}`}
          onClick={() => setActiveView("opportunities")}
        >
          For You
        </button>
        <button
          className={`rounded-lg px-4 py-2 ${activeView === "qa" ? "bg-[#f3f0ff] text-nusPurple" : ""}`}
          onClick={() => setActiveView("qa")}
        >
          Q&A
        </button>
        <button
          className={`rounded-lg px-4 py-2 ${activeView === "messages" ? "bg-[#f3f0ff] text-nusPurple" : ""}`}
          onClick={() => setActiveView("messages")}
        >
          Messages
        </button>
        <button
          className={`rounded-lg px-4 py-2 ${activeView === "my-profile" ? "bg-[#f3f0ff] text-nusPurple" : ""}`}
          onClick={() => setActiveView("my-profile")}
        >
          Profile
        </button>
      </div>
      <div className="flex items-center gap-3">
        <NotificationPanel
          notifications={notifications}
          unreadCount={notificationUnreadCount}
          loading={notificationsLoading}
          error={notificationError}
          onRefresh={onRefreshNotifications}
          onMarkRead={onMarkNotificationRead}
          onMarkAllRead={onMarkAllNotificationsRead}
          setActiveView={setActiveView}
          setActiveConversationId={setActiveConversationId}
        />
        <button
          className="grid h-11 w-11 place-items-center rounded-xl border border-[#cfd6e6] bg-[#f4f6fb] text-[#697085]"
          onClick={() => setActiveView("my-profile")}
          aria-label="My profile"
        >
          <UserRound size={18} />
        </button>
        <div className="grid h-12 w-12 place-items-center rounded-full bg-nusOrange text-sm font-black text-white">
          {user.name.slice(0, 2).toUpperCase()}
        </div>
        <button
          className="grid h-11 w-11 place-items-center rounded-xl border border-[#cfd6e6] bg-white text-[#697085]"
          onClick={onLogout}
          aria-label="Log out"
        >
          <LogOut size={18} />
        </button>
      </div>
    </nav>
  );
}
