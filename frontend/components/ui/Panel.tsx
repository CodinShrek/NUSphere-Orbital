import type { ReactNode } from "react";

export function Panel({
  title,
  children,
  action,
  onAction,
}: {
  title: string;
  children: ReactNode;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <section className="card p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h3 className="text-lg font-black tracking-[0.01em]">{title}</h3>
        {action && (
          <button className="font-bold text-nusPurple" onClick={onAction}>
            {action} {"->"}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
