"use client";

import { useState } from "react";

import { PasswordChecklist } from "@/components/auth/PasswordChecklist";
import { ConsultationCalendar } from "@/components/ui/ConsultationCalendar";
import { OptionDatalist, TextInput } from "@/components/ui/FormControls";
import { Logo } from "@/components/ui/Logo";
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
import { signIn, signUp } from "@/lib/auth";
import {
  formatConsultationSlots,
  splitList,
  toggleSlot,
} from "@/lib/profile-utils";
import type { AuthenticatedSession, MentorType, Role } from "@/types/api";

type AuthScreenProps = {
  error: string;
  onError: (message: string) => void;
  onAuthenticated: (response: AuthenticatedSession) => void;
};

export function AuthScreen({
  error,
  onError,
  onAuthenticated,
}: AuthScreenProps) {
  const [activeRole, setActiveRole] = useState<Role>("student");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [name, setName] = useState("");
  const [faculty, setFaculty] = useState("Computing");
  const [major, setMajor] = useState("Computer Science");
  const [modulesTaken, setModulesTaken] = useState("");
  const [ccaText, setCcaText] = useState("");
  const [opportunityText, setOpportunityText] = useState("");
  const [exchangeText, setExchangeText] = useState("");
  const [accommodation, setAccommodation] = useState(
    "Off-campus accommodation",
  );
  const [interests, setInterests] = useState("");
  const [goals, setGoals] = useState("");
  const [bio, setBio] = useState("");
  const [mentorType, setMentorType] = useState<MentorType>("senior");
  const [mentorshipGoals, setMentorshipGoals] = useState("");
  const [mentorTypeOther, setMentorTypeOther] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [department, setDepartment] = useState("");
  const [selectedConsultationSlots, setSelectedConsultationSlots] = useState<
    string[]
  >([]);
  const [modulesTaught, setModulesTaught] = useState("");
  const [areasOfExpertise, setAreasOfExpertise] = useState("");
  const [officeLocation, setOfficeLocation] = useState("");
  const [office, setOffice] = useState("");
  const majorOptions = facultyMajors[faculty] ?? [];
  const departmentOptions = departmentsByFaculty[faculty] ?? [];
  const passwordsMatch = !confirmPassword || password === confirmPassword;
  const passwordRequirements = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    match: Boolean(confirmPassword) && password === confirmPassword,
  };
  const passwordReady = Object.values(passwordRequirements).every(Boolean);

  async function submitAuth() {
    if (isSubmitting) return;
    onError("");
    setNotice("");
    if (mode === "register" && !passwordReady) {
      onError(
        "Please fix the password requirements before creating your account.",
      );
      return;
    }
    setIsSubmitting(true);
    try {
      if (mode === "login") {
        onAuthenticated(await signIn(email, password, activeRole));
        return;
      }

      const result = await signUp({
        email,
        password,
        role: activeRole,
        name,
        faculty,
        major,
        modules_taken: splitList(modulesTaken),
        ccas: splitList(ccaText),
        nus_opportunities: splitList(opportunityText),
        exchange_universities: splitList(exchangeText),
        accommodation,
        interests: splitList(interests),
        goals: splitList(goals),
        bio,
        mentor_type: activeRole === "mentor" ? mentorType : undefined,
        mentorship_goals: activeRole === "mentor" ? mentorshipGoals : undefined,
        mentor_type_other:
          activeRole === "mentor" && mentorType === "other"
            ? mentorTypeOther
            : undefined,
        graduation_year:
          activeRole === "mentor" && mentorType === "alumni"
            ? graduationYear
            : undefined,
        current_role:
          activeRole === "mentor" && ["alumni", "other"].includes(mentorType)
            ? currentRole
            : undefined,
        organisation:
          activeRole === "mentor" && ["alumni", "other"].includes(mentorType)
            ? organisation
            : undefined,
        department:
          activeRole === "mentor" &&
          ["professor", "nus_staff"].includes(mentorType)
            ? department || departmentOptions[0]
            : undefined,
        consultation_hours:
          activeRole === "mentor"
            ? formatConsultationSlots(selectedConsultationSlots)
            : undefined,
        modules_taught:
          activeRole === "mentor" && mentorType === "professor"
            ? splitList(modulesTaught)
            : [],
        areas_of_expertise:
          activeRole === "mentor" &&
          ["professor", "nus_staff", "other"].includes(mentorType)
            ? splitList(areasOfExpertise)
            : [],
        office_location:
          activeRole === "mentor" && mentorType === "professor"
            ? officeLocation
            : undefined,
        office:
          activeRole === "mentor" && mentorType === "nus_staff"
            ? office
            : undefined,
      });
      if (result.status === "confirmation-required") {
        setNotice(
          `Check ${result.email} for the Supabase confirmation link, then return here and sign in.`,
        );
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        return;
      }
      onAuthenticated(result.session);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Unable to authenticate");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_bottom,#fff7e9,transparent_35%),linear-gradient(120deg,#f2f5ff,#ffffff)] px-5 py-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[760px] items-start justify-center py-5">
        <div className="card w-full max-w-[640px] px-8 py-10 shadow-soft sm:px-11">
          <Logo centered />
          <p className="mt-3 text-center text-[15px] font-medium text-[#6f7487]">
            Your NUS mentorship community
          </p>

          <div className="mt-9 grid h-12 grid-cols-2 rounded-xl border border-[#c8cfde] p-0.5">
            {(["student", "mentor"] as Role[]).map((role) => (
              <button
                key={role}
                className={`rounded-[10px] font-bold capitalize transition ${activeRole === role ? "bg-nusPurple text-white" : "text-[#687086]"}`}
                onClick={() => {
                  setNotice("");
                  setActiveRole(role);
                  setEmail("");
                  setPassword("");
                  setConfirmPassword("");
                  setShowPassword(false);
                  setShowConfirmPassword(false);
                  setName("");
                  setFaculty("Computing");
                  setMajor(
                    role === "student"
                      ? "Computer Science"
                      : "Business Analytics",
                  );
                  setModulesTaken("");
                  setCcaText("");
                  setOpportunityText("");
                  setExchangeText("");
                  setAccommodation("Off-campus accommodation");
                  setInterests("");
                  setGoals("");
                  setBio("");
                  setMentorshipGoals("");
                  setMentorType("senior");
                  setMentorTypeOther("");
                  setGraduationYear("");
                  setCurrentRole("");
                  setOrganisation("");
                  setDepartment("");
                  setSelectedConsultationSlots([]);
                  setModulesTaught("");
                  setAreasOfExpertise("");
                  setOfficeLocation("");
                  setOffice("");
                }}
              >
                {role}
              </button>
            ))}
          </div>

          <div className="mt-8 space-y-5">
            {mode === "register" && (
              <label className="block text-sm font-bold text-[#3f4659]">
                Full name
                <input
                  className="field mt-2"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                />
              </label>
            )}
            <label className="block text-sm font-bold text-[#3f4659]">
              NUS Email
              <input
                className="field mt-2"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={
                  activeRole === "mentor"
                    ? "mentor@u.nus.edu"
                    : "student@u.nus.edu"
                }
              />
            </label>
            <label className="block text-sm font-bold text-[#3f4659]">
              Password
              <div className="mt-2 flex rounded-xl border border-[#c8cfde] bg-white focus-within:border-[#6d28f2] focus-within:shadow-[0_0_0_3px_rgba(109,40,242,0.12)]">
                <input
                  className="min-w-0 flex-1 rounded-xl px-4 py-3.5 outline-none"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                />
                <button
                  type="button"
                  className="px-4 font-bold text-nusPurple"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            {mode === "register" && (
              <label className="block text-sm font-bold text-[#3f4659]">
                Confirm password
                <div className="mt-2 flex rounded-xl border border-[#c8cfde] bg-white focus-within:border-[#6d28f2] focus-within:shadow-[0_0_0_3px_rgba(109,40,242,0.12)]">
                  <input
                    className="min-w-0 flex-1 rounded-xl px-4 py-3.5 outline-none"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm password"
                  />
                  <button
                    type="button"
                    className="px-4 font-bold text-nusPurple"
                    onClick={() =>
                      setShowConfirmPassword((current) => !current)
                    }
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {confirmPassword && (
                  <p
                    className={`mt-2 text-sm font-bold ${passwordsMatch ? "text-[#087443]" : "text-[#c02b18]"}`}
                  >
                    {passwordsMatch
                      ? "Passwords match"
                      : "Passwords do not match"}
                  </p>
                )}
              </label>
            )}
            {mode === "register" && (
              <PasswordChecklist requirements={passwordRequirements} />
            )}
            {mode === "register" && (
              <>
                {activeRole === "mentor" && (
                  <div className="rounded-2xl border border-[#d4dae8] bg-[#f8faff] p-4">
                    <p className="font-black text-[#3f4659]">
                      What type of mentor are you?
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {mentorTypes.map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          className={`rounded-xl border p-3 text-left transition ${mentorType === type.value ? "border-nusPurple bg-[#f3f0ff] text-nusPurple" : "border-[#d4dae8] bg-white text-[#596173]"}`}
                          onClick={() => setMentorType(type.value)}
                        >
                          <span className="block font-black">{type.label}</span>
                          <span className="mt-1 block text-xs font-medium">
                            {type.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <label className="block text-sm font-bold text-[#3f4659]">
                  Faculty
                  <select
                    className="field mt-2"
                    value={faculty}
                    onChange={(event) => {
                      const selectedFaculty = event.target.value;
                      setFaculty(selectedFaculty);
                      setMajor(facultyMajors[selectedFaculty]?.[0] ?? "");
                      setDepartment(
                        departmentsByFaculty[selectedFaculty]?.[0] ?? "",
                      );
                    }}
                  >
                    {Object.keys(facultyMajors).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-bold text-[#3f4659]">
                  {activeRole === "mentor" && mentorType === "professor"
                    ? "Related programme"
                    : activeRole === "mentor" && mentorType === "alumni"
                      ? "NUS programme graduated from"
                      : "Major / Programme"}
                  <select
                    className="field mt-2"
                    value={major}
                    onChange={(event) => setMajor(event.target.value)}
                  >
                    {majorOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                {(activeRole === "student" ||
                  (activeRole === "mentor" && mentorType === "senior")) && (
                  <>
                    <TextInput
                      label="Modules taken"
                      value={modulesTaken}
                      onChange={setModulesTaken}
                      placeholder="CS1010, MA1521, GET1029"
                    />
                    <TextInput
                      label="CCAs, clubs, or organisations"
                      value={ccaText}
                      onChange={setCcaText}
                      list="cca-options"
                      placeholder="Start typing a NUS club, or type your own"
                    />
                    <TextInput
                      label="Other NUS opportunities"
                      value={opportunityText}
                      onChange={setOpportunityText}
                      list="opportunity-options"
                      placeholder="NOC, UROP, startup programmes..."
                    />
                    <TextInput
                      label="Exchange universities"
                      value={exchangeText}
                      onChange={setExchangeText}
                      list="exchange-options"
                      placeholder="Start typing partner universities, or type Other"
                    />
                    <label className="block text-sm font-bold text-[#3f4659]">
                      Accommodation
                      <select
                        className="field mt-2"
                        value={accommodation}
                        onChange={(event) =>
                          setAccommodation(event.target.value)
                        }
                      >
                        {accommodationOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
                {activeRole === "mentor" && mentorType === "alumni" && (
                  <>
                    <TextInput
                      label="Graduation year"
                      value={graduationYear}
                      onChange={setGraduationYear}
                      placeholder="2024"
                    />
                    <TextInput
                      label="Current role"
                      value={currentRole}
                      onChange={setCurrentRole}
                      placeholder="Software engineer, analyst, founder..."
                    />
                    <TextInput
                      label="Current organisation"
                      value={organisation}
                      onChange={setOrganisation}
                      placeholder="Company, university, startup, or organisation"
                    />
                    <TextInput
                      label="NUS experiences you can advise on"
                      value={opportunityText}
                      onChange={setOpportunityText}
                      list="opportunity-options"
                      placeholder="NOC, UROP, exchange, internships..."
                    />
                  </>
                )}
                {activeRole === "mentor" && mentorType === "professor" && (
                  <>
                    <label className="block text-sm font-bold text-[#3f4659]">
                      Department
                      <select
                        className="field mt-2"
                        value={department || departmentOptions[0] || ""}
                        onChange={(event) => setDepartment(event.target.value)}
                      >
                        {(departmentOptions.length
                          ? departmentOptions
                          : ["Other"]
                        ).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <TextInput
                      label="Modules taught"
                      value={modulesTaught}
                      onChange={setModulesTaught}
                      placeholder="CS1010, CS2040S, CS4248"
                    />
                    <TextInput
                      label="Area of expertise"
                      value={areasOfExpertise}
                      onChange={setAreasOfExpertise}
                      placeholder="AI, systems, HCI, databases..."
                    />
                    <TextInput
                      label="Office / cubicle number"
                      value={officeLocation}
                      onChange={setOfficeLocation}
                      placeholder="COM3-02-15"
                    />
                  </>
                )}
                {activeRole === "mentor" && mentorType === "nus_staff" && (
                  <>
                    <TextInput
                      label="NUS office / unit"
                      value={office}
                      onChange={setOffice}
                      placeholder="CFG, NUS Enterprise, GRO, OSA..."
                    />
                    <TextInput
                      label="Department or team"
                      value={department}
                      onChange={setDepartment}
                      placeholder="Career advisory, exchange, entrepreneurship..."
                    />
                    <TextInput
                      label="Area of expertise / focus"
                      value={areasOfExpertise}
                      onChange={setAreasOfExpertise}
                      placeholder="Career planning, startups, exchange, wellbeing..."
                    />
                    <TextInput
                      label="Office / cubicle number"
                      value={officeLocation}
                      onChange={setOfficeLocation}
                      placeholder="Optional"
                    />
                  </>
                )}
                {activeRole === "mentor" && mentorType === "other" && (
                  <>
                    <TextInput
                      label="Specify mentor type"
                      value={mentorTypeOther}
                      onChange={setMentorTypeOther}
                      placeholder="Industry mentor, startup founder, research mentor..."
                    />
                    <TextInput
                      label="Current role"
                      value={currentRole}
                      onChange={setCurrentRole}
                      placeholder="Your current role or affiliation"
                    />
                    <TextInput
                      label="Organisation / affiliation"
                      value={organisation}
                      onChange={setOrganisation}
                      placeholder="Organisation or NUS affiliation"
                    />
                    <TextInput
                      label="Area of expertise / focus"
                      value={areasOfExpertise}
                      onChange={setAreasOfExpertise}
                      placeholder="Topics you can advise on"
                    />
                  </>
                )}
                {activeRole === "mentor" && (
                  <ConsultationCalendar
                    selectedSlots={selectedConsultationSlots}
                    onToggle={(slot) =>
                      setSelectedConsultationSlots((current) =>
                        toggleSlot(current, slot),
                      )
                    }
                  />
                )}
                <label className="block text-sm font-bold text-[#3f4659]">
                  {activeRole === "mentor"
                    ? "Topics you can mentor on"
                    : "Areas of interest"}
                  <input
                    className="field mt-2"
                    value={interests}
                    onChange={(event) => setInterests(event.target.value)}
                    placeholder={
                      activeRole === "mentor"
                        ? "Module planning, research, NOC, internships"
                        : "AI/M4, Interest 2, UROPS"
                    }
                  />
                </label>
                <label className="block text-sm font-bold text-[#3f4659]">
                  {activeRole === "mentor"
                    ? "Students you hope to support"
                    : "Goals"}
                  <input
                    className="field mt-2"
                    value={goals}
                    onChange={(event) => setGoals(event.target.value)}
                    placeholder={
                      activeRole === "mentor"
                        ? "Students exploring computing, research, exchange..."
                        : "Explore modules, Find research guidance"
                    }
                  />
                </label>
                <label className="block text-sm font-bold text-[#3f4659]">
                  {activeRole === "mentor"
                    ? "Short public mentor profile"
                    : "About you and what you want to achieve at NUS"}
                  <textarea
                    className="field mt-2 min-h-28 resize-y py-3"
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                    placeholder={
                      activeRole === "mentor"
                        ? "Briefly describe your background and what students can approach you for."
                        : "Tell mentors what you are exploring and what support would help."
                    }
                  />
                </label>
                {activeRole === "mentor" && (
                  <label className="block text-sm font-bold text-[#3f4659]">
                    What do you want to achieve with mentorship?
                    <textarea
                      className="field mt-2 min-h-24 resize-y py-3"
                      value={mentorshipGoals}
                      onChange={(event) =>
                        setMentorshipGoals(event.target.value)
                      }
                      placeholder="Describe the kind of guidance you want to offer."
                    />
                  </label>
                )}
              </>
            )}
          </div>

          {mode === "register" && (
            <>
              <OptionDatalist id="cca-options" options={ccas} />
              <OptionDatalist
                id="opportunity-options"
                options={opportunities}
              />
              <OptionDatalist
                id="exchange-options"
                options={exchangeUniversities}
              />
            </>
          )}

          <button
            className="mt-8 h-14 w-full rounded-xl bg-nusPurple font-bold text-white shadow-[0_8px_20px_rgba(95,22,238,0.25)] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={submitAuth}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Please wait..."
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>

          <div className="my-8 flex items-center gap-4 text-sm font-semibold text-[#9aa1b3]">
            <span className="h-px flex-1 bg-[#d2d7e4]" />
            or
            <span className="h-px flex-1 bg-[#d2d7e4]" />
          </div>

          <button className="flex h-14 w-full items-center justify-center gap-3 rounded-xl border border-[#c8cfde] font-bold text-[#3f4659]">
            <span className="grid grid-cols-2 gap-1">
              <i className="h-3 w-3 rounded-sm bg-nusPurple" />
              <i className="h-3 w-3 rounded-sm bg-[#ff6508]" />
              <i className="h-3 w-3 rounded-sm bg-[#7166f9]" />
              <i className="h-3 w-3 rounded-sm bg-[#ff8a00]" />
            </span>
            Continue with NUS SSO
          </button>

          <p className="mt-6 text-center text-sm font-medium text-[#7b8295]">
            {mode === "login" ? "No account?" : "Already registered?"}{" "}
            <button
              className="font-bold text-nusPurple"
              onClick={() => {
                setNotice("");
                onError("");
                setMode(mode === "login" ? "register" : "login");
              }}
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
          {notice && (
            <p className="mt-4 rounded-lg bg-[#eef7ff] px-4 py-3 text-sm font-semibold text-[#235b91]">
              {notice}
            </p>
          )}
          {error && (
            <p className="mt-4 rounded-lg bg-[#fff1f0] px-4 py-3 text-sm font-semibold text-[#c02b18]">
              {error}
            </p>
          )}

          <div className="mt-9 border-t border-[#edf0f6] pt-6 text-center">
            <p className="text-sm font-medium text-[#9aa1b3]">
              Trusted by NUS students across
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {["SoC", "Business", "Medicine", "Law", "Engineering"].map(
                (item, index) => (
                  <span className={`chip ${pastel[index]}`} key={item}>
                    {item}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
