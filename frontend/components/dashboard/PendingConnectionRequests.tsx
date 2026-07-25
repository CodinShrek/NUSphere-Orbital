import { Panel } from "@/components/ui/Panel";
import type { Connection, User } from "@/types/api";
export function PendingConnectionRequests({ user, connections, onAcceptConnection }: { user: User; connections: Connection[]; onAcceptConnection: (connectionId: string) => void }) {
  if (!connections.length) {
    return (
      <Panel title="Pending Connection Requests">
        <p className="font-medium text-[#737b8f]">{user.role === "mentor" ? "No pending connection requests right now." : "No mentor requests are waiting for approval right now."}</p>
      </Panel>
    );
  }

  return (
    <Panel title="Pending Connection Requests">
      <div className="space-y-3">
        {connections.map((connection) => (
          <div key={connection.id} className="rounded-xl border border-[#d4dae8] p-4">
            <p className="font-black">{user.role === "mentor" ? connection.student_name : connection.mentor_name}</p>
            <p className="text-sm font-medium text-[#737b8f]">
              {user.role === "mentor" ? `Wants to connect about ${connection.mentor_programme}` : `Waiting for approval about ${connection.mentor_programme}`}
            </p>
            {user.role === "mentor" ? (
              <button className="mt-3 h-10 rounded-xl bg-nusPurple px-4 font-bold text-white" onClick={() => onAcceptConnection(connection.id)}>Accept connection</button>
            ) : (
              <span className="mt-3 inline-flex h-10 items-center rounded-xl bg-[#fff8ef] px-4 font-bold text-[#c94a12]">Pending mentor approval</span>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}
