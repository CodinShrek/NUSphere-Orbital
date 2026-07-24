import type { ReactNode } from "react";

import { Nav } from "@/components/layout/Nav";
import type { Notification, User } from "@/types/api";
import type { View } from "@/types/navigation";

type AppShellProps = {
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
  children: ReactNode;
};

export function AppShell({
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
  children,
}: AppShellProps) {
  return (
    <main className="min-h-screen bg-mist">
      <Nav
        activeView={activeView}
        setActiveView={setActiveView}
        user={user}
        notifications={notifications}
        notificationUnreadCount={notificationUnreadCount}
        notificationsLoading={notificationsLoading}
        notificationError={notificationError}
        setActiveConversationId={setActiveConversationId}
        onRefreshNotifications={onRefreshNotifications}
        onMarkNotificationRead={onMarkNotificationRead}
        onMarkAllNotificationsRead={onMarkAllNotificationsRead}
        onLogout={onLogout}
      />
      {children}
    </main>
  );
}
