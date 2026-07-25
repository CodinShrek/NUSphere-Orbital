"use client";

import { useState } from "react";

import {
  AvailabilityEditor,
  VerificationBadge,
  VerificationControls,
} from "@/components/mentors/MentorQuality";
import { Avatar } from "@/components/ui/Avatar";
import { OptionDatalist, TextAreaInput, TextInput } from "@/components/ui/FormControls";
import { Metric } from "@/components/ui/Metric";
import { Panel } from "@/components/ui/Panel";
import {
  accommodationOptions,
  ccas,
  departmentsByFaculty,
  exchangeUniversities,
  facultyMajors,
  mentorTypes,
  opportunities,
  pastel,
} from "@/data/profile-options";
import { profileCompletion } from "@/lib/dashboard-utils";
import { splitList } from "@/lib/profile-utils";
import type { updateProfile } from "@/lib/api";
import type { AvailabilitySlot, MentorType, User, VerificationStatus } from "@/types/api";
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

export function UserProfile({
  user,
  token,
  setActiveView,
  onSaveProfile,
  onAvailabilityChange,
  onVerificationChange,
}: {
  user: User;
  token: string;
  setActiveView: (view: View) => void;
  onSaveProfile: (payload: Parameters<typeof updateProfile>[1]) => Promise<void>;
  onAvailabilityChange: (
    mentorId: string,
    slots: AvailabilitySlot[],
  ) => void;
  onVerificationChange: (status: VerificationStatus) => void;
}) {
  const completion = profileCompletion(user);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    name: user.name,
    faculty: user.faculty,
    major: user.major,
    modules_taken: user.modules_taken.join(", "),
    ccas: user.ccas.join(", "),
    nus_opportunities: user.nus_opportunities.join(", "),
    exchange_universities: user.exchange_universities.join(", "),
    accommodation: user.accommodation,
    interests: user.interests.join(", "),
    goals: user.goals.join(", "),
    bio: user.bio,
    mentorship_goals: user.mentorship_goals ?? "",
    mentor_type: user.mentor_type ?? "senior",
    mentor_type_other: user.mentor_type_other ?? "",
    graduation_year: user.graduation_year ?? "",
    current_role: user.current_role ?? "",
    organisation: user.organisation ?? "",
    department: user.department ?? "",
    consultation_hours: user.consultation_hours ?? "",
    modules_taught: user.modules_taught.join(", "),
    areas_of_expertise: user.areas_of_expertise.join(", "),
    office_location: user.office_location ?? "",
    office: user.office ?? "",
    profile_picture: user.profile_picture ?? "",
  });
  const majorOptions = facultyMajors[draft.faculty] ?? [];
  const departmentOptions = departmentsByFaculty[draft.faculty] ?? [];

  function updateDraft(field: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function handleProfilePhoto(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateDraft("profile_picture", String(reader.result ?? ""));
    reader.readAsDataURL(file);
  }

  async function save() {
    setSaving(true);
    try {
      await onSaveProfile({
        name: draft.name,
        faculty: draft.faculty,
        major: draft.major,
        modules_taken: splitList(draft.modules_taken),
        ccas: splitList(draft.ccas),
        nus_opportunities: splitList(draft.nus_opportunities),
        exchange_universities: splitList(draft.exchange_universities),
        accommodation: draft.accommodation,
        interests: splitList(draft.interests),
        goals: splitList(draft.goals),
        bio: draft.bio,
        mentorship_goals: user.role === "mentor" ? draft.mentorship_goals : undefined,
        mentor_type: user.role === "mentor" ? (draft.mentor_type as MentorType) : undefined,
        mentor_type_other: user.role === "mentor" ? draft.mentor_type_other : undefined,
        graduation_year: user.role === "mentor" ? draft.graduation_year : undefined,
        current_role: user.role === "mentor" ? draft.current_role : undefined,
        organisation: user.role === "mentor" ? draft.organisation : undefined,
        department: user.role === "mentor" ? draft.department : undefined,
        consultation_hours: user.role === "mentor" ? draft.consultation_hours : undefined,
        modules_taught: user.role === "mentor" ? splitList(draft.modules_taught) : [],
        areas_of_expertise: user.role === "mentor" ? splitList(draft.areas_of_expertise) : [],
        office_location: user.role === "mentor" ? draft.office_location : undefined,
        office: user.role === "mentor" ? draft.office : undefined,
        profile_picture: draft.profile_picture,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="bg-[linear-gradient(105deg,#5f16ee,#4f00bf_55%,#b213f0)] px-8 py-9 text-white">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <Avatar initials={user.name.slice(0, 2).toUpperCase()} large src={user.profile_picture} />
            <div>
              <h2 className="brand-serif text-3xl font-black">{user.name}</h2>
              <p className="mt-1 text-white/85">{user.email} - {user.faculty} - {user.major} - {user.role}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="chip bg-white/16 text-white ring-1 ring-white/25">{user.role === "student" ? "Student" : "Mentor"}</span>
                {user.role === "mentor" && (
                  <VerificationBadge
                    status={user.verification_status}
                    onDark
                  />
                )}
                {user.interests.slice(0, 2).map((interest) => (
                  <span key={interest} className="chip bg-white/16 text-white ring-1 ring-white/25">{interest}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="h-12 rounded-xl border border-white/25 bg-white/10 px-6 font-bold" onClick={() => setEditing((current) => !current)}>{editing ? "Cancel edit" : "Edit profile"}</button>
            <button className="h-12 rounded-xl bg-nusOrange px-6 font-bold" onClick={() => setActiveView("find")}>Find mentors</button>
          </div>
        </div>
        <div className="mt-7 grid grid-cols-3 gap-4 max-md:grid-cols-1">
          <Metric value={completion + "%"} label="Profile complete" />
          <Metric value={user.interests.length} label="Interests" />
          <Metric value={user.ccas.length + user.nus_opportunities.length} label="Campus signals" />
        </div>
      </div>
      <div className="grid grid-cols-[1fr_330px] gap-7 p-8 max-xl:grid-cols-1">
        <div className="space-y-6">
          {editing && (
            <Panel title="Edit Profile">
              <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
                <TextInput label="Name" value={draft.name} onChange={(value) => updateDraft("name", value)} placeholder="Your name" />
                <label className="block text-sm font-bold text-[#3f4659]">
                  Profile picture URL
                  <input className="field mt-2" value={draft.profile_picture} onChange={(event) => updateDraft("profile_picture", event.target.value)} placeholder="Paste an image URL, or upload below" />
                  <input className="mt-3 block w-full text-sm font-medium text-[#596173]" type="file" accept="image/*" onChange={(event) => handleProfilePhoto(event.target.files?.[0])} />
                </label>
                <label className="block text-sm font-bold text-[#3f4659]">
                  Faculty
                  <select
                    className="field mt-2"
                    value={draft.faculty}
                    onChange={(event) => {
                      const selectedFaculty = event.target.value;
                      setDraft((current) => ({
                        ...current,
                        faculty: selectedFaculty,
                        major: facultyMajors[selectedFaculty]?.[0] ?? "",
                        department: departmentsByFaculty[selectedFaculty]?.[0] ?? current.department,
                      }));
                    }}
                  >
                    {Object.keys(facultyMajors).map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-bold text-[#3f4659]">
                  Major / Programme
                  <select className="field mt-2" value={draft.major} onChange={(event) => updateDraft("major", event.target.value)}>
                    {(majorOptions.length ? majorOptions : [draft.major]).map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-bold text-[#3f4659]">
                  Accommodation
                  <select className="field mt-2" value={draft.accommodation} onChange={(event) => updateDraft("accommodation", event.target.value)}>
                    {accommodationOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <div className="md:col-span-2">
                  <TextAreaInput label="Modules taken" value={draft.modules_taken} onChange={(value) => updateDraft("modules_taken", value)} placeholder="CS1010, MA1521" />
                </div>
                <div className="md:col-span-2">
                  <TextAreaInput label="CCAs and organisations" value={draft.ccas} onChange={(value) => updateDraft("ccas", value)} placeholder="NUS Hackers, TeamNUS" />
                </div>
                <div className="md:col-span-2">
                  <TextAreaInput label="NUS opportunities" value={draft.nus_opportunities} onChange={(value) => updateDraft("nus_opportunities", value)} placeholder="NOC, UROP" />
                </div>
                <div className="md:col-span-2">
                  <TextAreaInput label="Exchange universities" value={draft.exchange_universities} onChange={(value) => updateDraft("exchange_universities", value)} placeholder="University of Tokyo, Other" />
                </div>
                <TextInput label="Areas of interest" value={draft.interests} onChange={(value) => updateDraft("interests", value)} placeholder="AI/M4, startups, research" />
                <div className="md:col-span-2">
                  <TextAreaInput label="Goals" value={draft.goals} onChange={(value) => updateDraft("goals", value)} placeholder="Find research guidance, plan exchange" />
                </div>
              </div>
              <div className="mt-4">
                <TextAreaInput label="About" value={draft.bio} onChange={(value) => updateDraft("bio", value)} placeholder="Tell others what you are exploring at NUS." rows={5} />
              </div>
              {user.role === "mentor" && (
                <div className="mt-4 grid grid-cols-2 gap-4 max-md:grid-cols-1">
                  <label className="block text-sm font-bold text-[#3f4659]">
                    Mentor type
                    <select className="field mt-2" value={draft.mentor_type} onChange={(event) => updateDraft("mentor_type", event.target.value)}>
                      {mentorTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                  </label>
                  {draft.mentor_type === "other" && <TextInput label="Specify mentor type" value={draft.mentor_type_other} onChange={(value) => updateDraft("mentor_type_other", value)} placeholder="Industry mentor, research mentor..." />}
                  <TextInput label="Graduation year" value={draft.graduation_year} onChange={(value) => updateDraft("graduation_year", value)} placeholder="2024" />
                  <TextInput label="Current role" value={draft.current_role} onChange={(value) => updateDraft("current_role", value)} placeholder="Professor, senior, analyst..." />
                  <TextInput label="Organisation" value={draft.organisation} onChange={(value) => updateDraft("organisation", value)} placeholder="NUS, company, startup..." />
                  <label className="block text-sm font-bold text-[#3f4659]">
                    Department / team
                    {draft.mentor_type === "professor" ? (
                      <select className="field mt-2" value={draft.department || departmentOptions[0] || ""} onChange={(event) => updateDraft("department", event.target.value)}>
                        {(departmentOptions.length ? departmentOptions : [draft.department || "Other"]).map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    ) : (
                      <input className="field mt-2" value={draft.department} onChange={(event) => updateDraft("department", event.target.value)} placeholder="Department or team" />
                    )}
                  </label>
                  <TextInput label="Consultation hours" value={draft.consultation_hours} onChange={(value) => updateDraft("consultation_hours", value)} placeholder="Mon 09:00, Wed 14:00" />
                  <TextInput label="Modules taught" value={draft.modules_taught} onChange={(value) => updateDraft("modules_taught", value)} placeholder="CS1010, CS2103T" />
                  <TextInput label="Areas of expertise" value={draft.areas_of_expertise} onChange={(value) => updateDraft("areas_of_expertise", value)} placeholder="AI, systems, HCI" />
                  <TextInput label="Office / cubicle" value={draft.office_location} onChange={(value) => updateDraft("office_location", value)} placeholder="COM3-02-15" />
                  <TextInput label="Office / unit" value={draft.office} onChange={(value) => updateDraft("office", value)} placeholder="CFG, NUS Enterprise..." />
                  <label className="block text-sm font-bold text-[#3f4659] md:col-span-2">
                    Mentorship goals
                    <textarea className="field mt-2 min-h-24 resize-y py-3" value={draft.mentorship_goals} onChange={(event) => updateDraft("mentorship_goals", event.target.value)} placeholder="Describe the guidance you want to offer." />
                  </label>
                </div>
              )}
              <OptionDatalist id="profile-cca-options" options={ccas} />
              <OptionDatalist id="profile-opportunity-options" options={opportunities} />
              <OptionDatalist id="profile-exchange-options" options={exchangeUniversities} />
              <div className="mt-5 flex flex-wrap gap-3">
                <button className="h-11 rounded-xl bg-nusPurple px-6 font-bold text-white disabled:opacity-60" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save changes"}</button>
                <button className="h-11 rounded-xl border border-[#c8cfde] px-6 font-bold text-nusPurple" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </Panel>
          )}
          {!editing && (
            <>
              <Panel title="Profile Information">
                <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
                  <ProfileField label="Name" value={user.name} />
                  <ProfileField label="NUS Email" value={user.email} />
                  <ProfileField label="Role" value={user.role} />
                  {user.role === "mentor" && <ProfileField label="Mentor type" value={mentorTypeLabel(user)} />}
                  <ProfileField label="Faculty" value={user.faculty} />
                  <ProfileField label="Major / Programme" value={user.major} />
                  <ProfileField label="Accommodation" value={user.accommodation} />
                </div>
              </Panel>
              <Panel title="Academic and NUS Experience">
                <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
                  <ProfileList label="Modules taken" values={user.modules_taken} />
                  <ProfileList label="Exchange" values={user.exchange_universities} />
                  <ProfileList label="CCAs and organisations" values={user.ccas} />
                  <ProfileList label="NUS opportunities" values={user.nus_opportunities} />
                  {user.modules_taught.length > 0 && <ProfileList label="Modules taught" values={user.modules_taught} />}
                  {user.areas_of_expertise.length > 0 && <ProfileList label="Areas of expertise" values={user.areas_of_expertise} />}
                </div>
              </Panel>
              {user.role === "mentor" && (
                <>
                  <Panel title="Mentor Details">
                    <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
                      {user.graduation_year && <ProfileField label="Graduation year" value={user.graduation_year} />}
                      {user.current_role && <ProfileField label="Current role" value={user.current_role} />}
                      {user.organisation && <ProfileField label="Organisation" value={user.organisation} />}
                      {user.department && <ProfileField label="Department / team" value={user.department} />}
                      {user.consultation_hours && <ProfileField label="Legacy consultation hours" value={user.consultation_hours} />}
                      {user.office_location && <ProfileField label="Office / cubicle" value={user.office_location} />}
                      {user.office && <ProfileField label="Office / unit" value={user.office} />}
                    </div>
                  </Panel>
                  <AvailabilityEditor
                    mentorId={user.id}
                    token={token}
                    onAvailabilityChange={(slots) =>
                      onAvailabilityChange(user.id, slots)
                    }
                  />
                </>
              )}
              <Panel title="About">
                <div className="dash-placeholder p-4 font-medium text-[#596173]">{user.bio || "No description added yet."}</div>
                {user.role === "mentor" && user.mentorship_goals && (
                  <div className="mt-3 dash-placeholder p-4 font-medium text-[#596173]">
                    <span className="font-black text-[#1f2333]">Mentorship goal: </span>
                    {user.mentorship_goals}
                  </div>
                )}
              </Panel>
              <Panel title="Goals">
                <div className="space-y-3">
                  {user.goals.map((goal) => (
                    <div key={goal} className="dash-placeholder p-4 font-medium text-[#596173]">{goal}</div>
                  ))}
                </div>
              </Panel>
            </>
          )}
        </div>
        <aside className="space-y-6">
          {user.role === "mentor" && (
            <VerificationControls
              status={user.verification_status}
              token={token}
              onStatusChange={onVerificationChange}
            />
          )}
          <Panel title="INTERESTS">
            <div className="flex flex-wrap gap-2">
              {user.interests.map((interest, index) => (
                <span key={interest} className={`chip ${pastel[index % pastel.length]}`}>{interest}</span>
              ))}
            </div>
          </Panel>
          <Panel title="ACCOUNT">
            <p className="font-medium text-[#737b8f]">This information is loaded from the backend account created during sign up.</p>
            <button className="mt-4 h-11 w-full rounded-xl bg-nusPurple font-bold text-white" onClick={() => setActiveView("home")}>Back home</button>
          </Panel>
        </aside>
      </div>
    </section>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#d4dae8] bg-[#f8faff] p-4">
      <p className="text-sm font-black uppercase text-[#9aa1b3]">{label}</p>
      <p className="mt-2 font-bold text-[#1f2333]">{value}</p>
    </div>
  );
}

function ProfileList({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="rounded-xl border border-[#d4dae8] bg-[#f8faff] p-4">
      <p className="text-sm font-black uppercase text-[#9aa1b3]">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {values.length ? values.map((value, index) => <span key={value} className={`chip ${pastel[index % pastel.length]}`}>{value}</span>) : <p className="font-medium text-[#737b8f]">Not added yet</p>}
      </div>
    </div>
  );
}
