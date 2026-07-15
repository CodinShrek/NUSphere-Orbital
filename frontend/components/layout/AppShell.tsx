import type { ReactNode } from "react";

import { Nav } from "@/components/layout/Nav";
import type { User } from "@/types/api";
import type { View } from "@/types/navigation";

type AppShellProps = {
  activeView: View;
  setActiveView: (view: View) => void;
  user: User;
  onLogout: () => void;
  children: ReactNode;
};

export function AppShell({
  activeView,
  setActiveView,
  user,
  onLogout,
  children,
}: AppShellProps) {
  return (
    <main className="min-h-screen bg-mist">
      <Nav
        activeView={activeView}
        setActiveView={setActiveView}
        user={user}
        onLogout={onLogout}
      />
      {children}
    </main>
  );
}
