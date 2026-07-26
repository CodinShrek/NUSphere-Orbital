import {
  AvailabilityList,
  MentorReviewSection,
  VerificationBadge,
} from "@/components/mentors/MentorQuality";
import { Avatar } from "@/components/ui/Avatar";
import { Metric } from "@/components/ui/Metric";
import { Panel } from "@/components/ui/Panel";
import { pastel } from "@/data/profile-options";
import type { Connection, Mentor, User } from "@/types/api";
import type { View } from "@/types/navigation";
export function MentorProfile({
  mentor,
  connection,
  token,
  user,
  setActiveView,
  returnView = "find",
  onRequestConnection,
  onStartConversation,
  onReviewsChange,
}: {
  mentor?: Mentor;
  connection?: Connection;
  token: string;
  user: User;
  setActiveView: (view: View) => void;
  returnView?: View;
  onRequestConnection: (mentorId: string) => void;
  onStartConversation: (mentorId: string) => void;
  onReviewsChange: () => Promise<void>;
}) {
  const selected = mentor ?? null;
  if (!selected) return null;
  return (
    <section>
      <div className="bg-[linear-gradient(105deg,#5f16ee,#4f00bf_55%,#b213f0)] px-8 py-9 text-white">
        <div className="flex justify-between">
          <div className="flex gap-6">
            <Avatar initials="M1" large />
            <div>
              <h2 className="brand-serif text-3xl font-black">{selected.name}</h2>
              <p className="mt-1 text-white/85">{selected.mentor_type_label} - {selected.programme} - {selected.faculty} - NUS</p>
              <p className="mt-1 font-bold text-white">{selected.email}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <VerificationBadge
                  status={selected.verification_status}
                  onDark
                />
                {[selected.mentor_type_label, ...selected.interests.slice(0, 2)].map((tag) => (
                  <span key={tag} className="chip bg-white/16 text-white ring-1 ring-white/25">{tag}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="h-12 rounded-xl border border-white/25 bg-white/10 px-6 font-bold disabled:opacity-60" disabled={connection?.status !== "accepted"} onClick={() => onStartConversation(selected.id)}>Message</button>
            <button className="h-12 rounded-xl bg-nusOrange px-6 font-bold disabled:opacity-60" disabled={connection?.status === "accepted" || connection?.status === "pending"} onClick={() => onRequestConnection(selected.id)}>{connection?.status === "accepted" ? "Connected" : connection?.status === "pending" ? "Pending" : "Connect"}</button>
          </div>
        </div>
        <div className="mt-7 grid grid-cols-4 gap-4">
          <Metric value={selected.rating} label="Rating" />
          <Metric value={selected.reviews} label="Reviews" />
          <Metric value={selected.answers} label="Q&A answers" />
          <Metric value={selected.mentees} label="Mentees" />
        </div>
      </div>
      <div className="grid grid-cols-[1fr_330px] gap-7 p-8 max-xl:grid-cols-1">
        <div className="space-y-6">
          <Panel title="About">
            <div className="dash-placeholder p-5 font-medium text-[#737b8f]">{selected.bio}</div>
          </Panel>
          <Panel title="Availability">
            <AvailabilityList slots={selected.availability} />
          </Panel>
          <Panel title="Experience">
            <div className="space-y-5">
              {selected.experience.map((item, index) => (
                <div key={item} className="flex gap-4 border-b border-[#eef1f7] pb-5 last:border-b-0">
                  <span className={`mt-2 h-3 w-3 rounded-full ${index === 0 ? "bg-nusOrange" : "bg-[#7166f9]"}`} />
                  <div>
                    <p className="font-black">{item}</p>
                    <p className="text-[#8b91a5]">Organisation - Location</p>
                    <p className="text-[#a0a6b8]">Start date - End date</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
          <MentorReviewSection
            mentorId={selected.id}
            token={token}
            isStudent={user.role === "student"}
            onReviewsChange={onReviewsChange}
          />
        </div>
        <aside className="space-y-6">
          <Panel title="VERIFICATION">
            <VerificationBadge status={selected.verification_status} />
            <p className="mt-3 text-sm font-medium text-[#737b8f]">
              {selected.verification_status === "verified"
                ? "NUSphere has marked this mentor profile as verified."
                : selected.verification_status === "pending"
                  ? "This mentor has submitted a verification request."
                  : "This mentor profile has not been verified yet."}
            </p>
          </Panel>
          <Panel title="CAN MENTOR ON">
            <div className="flex flex-wrap gap-2">
              {selected.interests.concat(selected.experience_tags.slice(0, 3)).map((tag, index) => (
                <span key={tag} className={`chip ${pastel[index % pastel.length]}`}>{tag}</span>
              ))}
            </div>
          </Panel>
          <button className="h-12 w-full rounded-xl border border-[#a7bdf5] bg-white font-bold text-nusPurple" onClick={() => setActiveView(returnView)}>{returnView === "home" ? "Back home" : "Back to mentors"}</button>
        </aside>
      </div>
    </section>
  );
}
