"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Bot, LogOut, Search, Star, UserRound, Zap } from "lucide-react";
import { fetchCurrentUser, fetchRecommendations, login, logout, Mentor, register, Role, User } from "@/lib/api";

const pastel = ["bg-[#e7ecff] text-[#5f16ee]", "bg-[#ffe3aa] text-[#ba3b12]", "bg-[#ecfdf3] text-[#087443]", "bg-[#f1f4f9] text-[#596173]", "bg-[#f5ecff] text-[#5f16ee]"];

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState("");
  const [activeRole, setActiveRole] = useState<Role>("student");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("studentid@u.nus.edu");
  const [password, setPassword] = useState("password123");
  const [name, setName] = useState("Student Name");
  const [faculty, setFaculty] = useState("SoC");
  const [interests, setInterests] = useState("AI/M4, Interest 2, UROPS");
  const [goals, setGoals] = useState("Explore modules, Find research guidance");
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [activeView, setActiveView] = useState<"home" | "find" | "mentor-profile" | "my-profile">("home");
  const [error, setError] = useState("");

  useEffect(() => {
    const savedToken = window.localStorage.getItem("nusphere_token");
    if (!savedToken) return;

    fetchCurrentUser(savedToken)
      .then((currentUser) => {
        setToken(savedToken);
        setUser(currentUser);
      })
      .catch(() => window.localStorage.removeItem("nusphere_token"));
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchRecommendations(user)
      .then(setMentors)
      .catch((err: Error) => setError(err.message));
  }, [user]);

  async function submitAuth() {
    setError("");
    try {
      const response =
        mode === "login"
          ? await login(email, password, activeRole)
          : await register({
              email,
              password,
              role: activeRole,
              name,
              faculty,
              interests: splitList(interests),
              goals: splitList(goals),
            });
      setToken(response.token);
      setUser(response.user);
      setActiveView("home");
      window.localStorage.setItem("nusphere_token", response.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to authenticate");
    }
  }

  async function handleLogout() {
    if (token) {
      await logout(token).catch(() => undefined);
    }
    setToken("");
    setUser(null);
    setMentors([]);
    setActiveView("home");
    window.localStorage.removeItem("nusphere_token");
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_bottom,#fff7e9,transparent_35%),linear-gradient(120deg,#f2f5ff,#ffffff)] px-5 py-8">
        <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[620px] items-center justify-center">
          <div className="card w-full max-w-[480px] px-11 py-12 shadow-soft">
            <Logo centered />
            <p className="mt-3 text-center text-[15px] font-medium text-[#6f7487]">Your NUS mentorship community</p>

            <div className="mt-9 grid h-12 grid-cols-2 rounded-xl border border-[#c8cfde] p-0.5">
              {(["student", "mentor"] as Role[]).map((role) => (
                <button
                  key={role}
                  className={`rounded-[10px] font-bold capitalize transition ${activeRole === role ? "bg-nusPurple text-white" : "text-[#687086]"}`}
                  onClick={() => {
                    setActiveRole(role);
                    setEmail(role === "student" ? "studentid@u.nus.edu" : "mentor@u.nus.edu");
                    setName(role === "student" ? "Student Name" : "Mentor Name");
                    setInterests(role === "student" ? "AI/M4, Interest 2, UROPS" : "AI/M4, Interest 3, NOC");
                    setGoals(role === "student" ? "Explore modules, Find research guidance" : "Mentor juniors");
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
                  <input className="field mt-2" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
                </label>
              )}
              <label className="block text-sm font-bold text-[#3f4659]">
                NUS Email
                <input className="field mt-2" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="studentid@u.nus.edu" />
              </label>
              <label className="block text-sm font-bold text-[#3f4659]">
                Password
                <input className="field mt-2" value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="password123" />
              </label>
              {mode === "register" && (
                <>
                  <label className="block text-sm font-bold text-[#3f4659]">
                    Faculty
                    <input className="field mt-2" value={faculty} onChange={(event) => setFaculty(event.target.value)} placeholder="SoC" />
                  </label>
                  <label className="block text-sm font-bold text-[#3f4659]">
                    Interests
                    <input className="field mt-2" value={interests} onChange={(event) => setInterests(event.target.value)} placeholder="AI/M4, Interest 2, UROPS" />
                  </label>
                  <label className="block text-sm font-bold text-[#3f4659]">
                    Goals
                    <input className="field mt-2" value={goals} onChange={(event) => setGoals(event.target.value)} placeholder="Explore modules, Find research guidance" />
                  </label>
                </>
              )}
            </div>

            <button className="mt-8 h-14 w-full rounded-xl bg-nusPurple font-bold text-white shadow-[0_8px_20px_rgba(95,22,238,0.25)]" onClick={submitAuth}>
              {mode === "login" ? "Sign in" : "Create account"}
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
              <button className="font-bold text-nusPurple" onClick={() => setMode(mode === "login" ? "register" : "login")}>
                {mode === "login" ? "Sign up" : "Sign in"}
              </button>
            </p>
            {error && <p className="mt-4 rounded-lg bg-[#fff1f0] px-4 py-3 text-sm font-semibold text-[#c02b18]">{error}</p>}

            <div className="mt-9 border-t border-[#edf0f6] pt-6 text-center">
              <p className="text-sm font-medium text-[#9aa1b3]">Trusted by NUS students across</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {["SoC", "Business", "Medicine", "Law", "Engineering"].map((item, index) => (
                  <span className={`chip ${pastel[index]}`} key={item}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-mist">
      <Nav activeView={activeView} setActiveView={setActiveView} user={user} onLogout={handleLogout} />
      {activeView === "home" && <Dashboard user={user} mentors={mentors} setActiveView={setActiveView} />}
      {activeView === "find" && <FindMentors mentors={mentors} setActiveView={setActiveView} />}
      {activeView === "mentor-profile" && <MentorProfile mentor={mentors[0]} setActiveView={setActiveView} />}
      {activeView === "my-profile" && <UserProfile user={user} setActiveView={setActiveView} />}
    </main>
  );
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function Logo({ centered = false }: { centered?: boolean }) {
  return (
    <h1 className={`brand-serif text-3xl font-black ${centered ? "text-center" : ""}`}>
      <span className="text-nusPurple">NUS</span>
      <span className="text-nusOrange">phere</span>
    </h1>
  );
}

type View = "home" | "find" | "mentor-profile" | "my-profile";

function Nav({ activeView, setActiveView, user, onLogout }: { activeView: string; setActiveView: (view: View) => void; user: User; onLogout: () => void }) {
  return (
    <nav className="sticky top-0 z-10 flex min-h-[70px] flex-wrap items-center justify-between gap-4 border-b border-[#cfd6e6] bg-white px-8 py-3">
      <Logo />
      <div className="flex flex-wrap items-center justify-center gap-2 text-base font-bold text-[#697085]">
        <button className={`rounded-lg px-4 py-2 ${activeView === "home" ? "bg-[#f3f0ff] text-nusPurple" : ""}`} onClick={() => setActiveView("home")}>
          Home
        </button>
        <button className={`rounded-lg px-4 py-2 ${activeView === "find" ? "bg-[#f3f0ff] text-nusPurple" : ""}`} onClick={() => setActiveView("find")}>
          Find Mentors
        </button>
        <button className="rounded-lg px-4 py-2">Q&A</button>
        <button className="rounded-lg px-4 py-2">For You</button>
        <button className={`rounded-lg px-4 py-2 ${activeView === "my-profile" ? "bg-[#f3f0ff] text-nusPurple" : ""}`} onClick={() => setActiveView("my-profile")}>
          Profile
        </button>
      </div>
      <div className="flex items-center gap-3">
        <button className="grid h-11 w-11 place-items-center rounded-xl border border-[#cfd6e6] bg-[#f4f6fb]" aria-label="Notifications">
          <Bell size={18} />
        </button>
        <button className="grid h-11 w-11 place-items-center rounded-xl border border-[#cfd6e6] bg-[#f4f6fb] text-[#697085]" onClick={() => setActiveView("my-profile")} aria-label="My profile">
          <UserRound size={18} />
        </button>
        <div className="grid h-12 w-12 place-items-center rounded-full bg-nusOrange text-sm font-black text-white">{user.name.slice(0, 2).toUpperCase()}</div>
        <button className="grid h-11 w-11 place-items-center rounded-xl border border-[#cfd6e6] bg-white text-[#697085]" onClick={onLogout} aria-label="Log out">
          <LogOut size={18} />
        </button>
      </div>
    </nav>
  );
}

function Dashboard({ user, mentors, setActiveView }: { user: User; mentors: Mentor[]; setActiveView: (view: View) => void }) {
  return (
    <>
      <section className="bg-[linear-gradient(105deg,#5f16ee,#4f00bf_55%,#b213f0)] px-8 py-8 text-white">
        <h2 className="brand-serif text-3xl font-black">Good morning, {user.name}</h2>
        <p className="mt-2 text-lg font-medium text-white/85">You have 2 new mentor responses and {mentors.length} recommended matches this week.</p>
        <div className="mt-6 grid grid-cols-3 gap-4">
          <Metric value={mentors.length} label="Active mentors" />
          <Metric value="12" label="Questions asked" />
          <Metric value="70%" label="Profile complete" />
        </div>
      </section>
      <section className="grid grid-cols-[1fr_360px] gap-7 p-8 max-xl:grid-cols-1">
        <div className="space-y-6">
          <Panel title="Recommended for you" action="See all" onAction={() => setActiveView("find")}>
            <div className="space-y-4">
              {mentors.map((mentor) => (
                <CompactMentor key={mentor.id} mentor={mentor} onProfile={() => setActiveView("mentor-profile")} />
              ))}
            </div>
          </Panel>
          <Panel title="Recent activity">
            <div className="flex items-center gap-4 py-4">
              <div className="h-10 w-10 rounded-xl bg-[#eef2ff]" />
              <div>
                <div className="dash-placeholder h-8 w-40" />
                <p className="mt-1 text-sm text-[#8b91a5]">2 hours ago</p>
              </div>
            </div>
          </Panel>
        </div>
        <aside className="space-y-6">
          <Panel title="PROFILE COMPLETION">
            <p className="brand-serif text-3xl font-black">70%</p>
            <div className="mt-3 h-2 rounded-full bg-[#eef1f7]">
              <div className="h-full w-[70%] rounded-full bg-[linear-gradient(90deg,#5f16ee,#ff6508)]" />
            </div>
            <p className="mt-4 font-medium text-[#737b8f]">Add goals and interests to improve your mentor matches.</p>
            <button className="mt-4 h-11 w-full rounded-xl border border-[#a7bdf5] font-bold text-nusPurple" onClick={() => setActiveView("my-profile")}>Complete profile</button>
          </Panel>
          <Panel title="TRENDING TOPICS">
            {["AI modules", "NOC prep", "Research", "Exchange"].map((topic, index) => (
              <div className="flex justify-between border-b border-[#eef1f7] py-3 last:border-b-0" key={topic}>
                <span className="font-medium text-[#596173]">{topic}</span>
                <span className="text-[#9aa1b3]">{12 - index} posts</span>
              </div>
            ))}
          </Panel>
          <div className="rounded-[18px] bg-[linear-gradient(135deg,#ff6508,#f04405)] p-6 text-white">
            <div className="flex items-center gap-2 font-black">
              <Bot size={20} />
              AI Assistant
            </div>
            <p className="mt-2 text-sm text-white/85">Short NUS context clarifications can live here after Milestone 1.</p>
          </div>
        </aside>
      </section>
    </>
  );
}

function FindMentors({ mentors, setActiveView }: { mentors: Mentor[]; setActiveView: (view: View) => void }) {
  const filters = ["All", "Seniors", "Professors", "SoC", "BIZ", "Interest 6", "Interest 2", "Topic", "CCAs"];
  return (
    <section>
      <div className="border-b border-[#cfd6e6] bg-white px-8 py-6">
        <div className="flex gap-4">
          <label className="relative flex-1">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[#8991a5]" size={20} />
            <input className="field h-14 pl-14" placeholder="Search by name, major, interest, CCA, exchange destination..." />
          </label>
          <button className="h-14 rounded-xl bg-nusPurple px-8 font-bold text-white">Search</button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {filters.map((filter, index) => (
            <button key={filter} className={`rounded-full border px-5 py-3 font-bold ${index === 0 ? "border-nusPurple bg-nusPurple text-white" : "border-[#c8cfde] bg-white text-[#687086]"}`}>
              {filter}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[1fr_330px] gap-7 p-8 max-xl:grid-cols-1">
        <div>
          <p className="mb-6 font-medium text-[#737b8f]">Showing {mentors.length} mentors - sorted by match score</p>
          <div className="space-y-5">
            {mentors.map((mentor) => (
                <MentorCard key={mentor.id} mentor={mentor} onProfile={() => setActiveView("mentor-profile")} />
            ))}
          </div>
        </div>
        <aside className="space-y-6">
          <Panel title="FILTER BY">
            <p className="font-bold">Faculty</p>
            {["SoC", "BIZ", "FASS", "Engineering", "Medicine"].map((faculty, index) => (
              <label key={faculty} className="mt-2 flex items-center gap-2 font-medium text-[#687086]">
                <input type="checkbox" defaultChecked={index === 0} className="h-4 w-4 accent-nusPurple" /> {faculty}
              </label>
            ))}
            <div className="mt-5 border-t border-[#eef1f7] pt-5">
              <p className="font-bold">Min. match score</p>
              <input className="mt-3 w-full accent-nusPurple" type="range" defaultValue={70} />
            </div>
          </Panel>
          <Panel title="INTERESTS">
            <div className="flex flex-wrap gap-2">
              {["AI/M4", "Interest 2", "Interest 3", "Interest 4", "Interest 5", "Research", "NOC"].map((tag, index) => (
                <span key={tag} className={`chip ${pastel[index % pastel.length]}`}>
                  {tag}
                </span>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </section>
  );
}

function UserProfile({ user, setActiveView }: { user: User; setActiveView: (view: View) => void }) {
  const completion = Math.min(100, 40 + user.interests.length * 10 + user.goals.length * 10);

  return (
    <section>
      <div className="bg-[linear-gradient(105deg,#5f16ee,#4f00bf_55%,#b213f0)] px-8 py-9 text-white">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <Avatar initials={user.name.slice(0, 2).toUpperCase()} large />
            <div>
              <h2 className="brand-serif text-3xl font-black">{user.name}</h2>
              <p className="mt-1 text-white/85">{user.email} - {user.faculty} - {user.role}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="chip bg-white/16 text-white ring-1 ring-white/25">{user.role === "student" ? "Student" : "Mentor"}</span>
                {user.interests.slice(0, 2).map((interest) => (
                  <span key={interest} className="chip bg-white/16 text-white ring-1 ring-white/25">{interest}</span>
                ))}
              </div>
            </div>
          </div>
          <button className="h-12 rounded-xl bg-nusOrange px-6 font-bold" onClick={() => setActiveView("find")}>Find mentors</button>
        </div>
        <div className="mt-7 grid grid-cols-3 gap-4 max-md:grid-cols-1">
          <Metric value={completion + "%"} label="Profile complete" />
          <Metric value={user.interests.length} label="Interests" />
          <Metric value={user.goals.length} label="Goals" />
        </div>
      </div>
      <div className="grid grid-cols-[1fr_330px] gap-7 p-8 max-xl:grid-cols-1">
        <div className="space-y-6">
          <Panel title="Profile Information">
            <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
              <ProfileField label="Name" value={user.name} />
              <ProfileField label="NUS Email" value={user.email} />
              <ProfileField label="Role" value={user.role} />
              <ProfileField label="Faculty" value={user.faculty} />
            </div>
          </Panel>
          <Panel title="Goals">
            <div className="space-y-3">
              {user.goals.map((goal) => (
                <div key={goal} className="dash-placeholder p-4 font-medium text-[#596173]">{goal}</div>
              ))}
            </div>
          </Panel>
        </div>
        <aside className="space-y-6">
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

function MentorProfile({ mentor, setActiveView }: { mentor?: Mentor; setActiveView: (view: View) => void }) {
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
              <p className="mt-1 text-white/85">{selected.year} - {selected.programme} - {selected.faculty} - NUS</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {["Mentor", "Interest 3 Alumni", "AI/M4 Focus"].map((tag) => (
                  <span key={tag} className="chip bg-white/16 text-white ring-1 ring-white/25">{tag}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="h-12 rounded-xl border border-white/25 bg-white/10 px-6 font-bold">Message</button>
            <button className="h-12 rounded-xl bg-nusOrange px-6 font-bold">Connect</button>
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
        </div>
        <aside className="space-y-6">
          <Panel title="CAN MENTOR ON">
            <div className="flex flex-wrap gap-2">
              {selected.interests.concat(selected.experience_tags.slice(0, 3)).map((tag, index) => (
                <span key={tag} className={`chip ${pastel[index % pastel.length]}`}>{tag}</span>
              ))}
            </div>
          </Panel>
          <Panel title="RECENT REVIEWS">
            {[1, 2].map((item) => (
              <div className="border-b border-[#eef1f7] py-3 last:border-b-0" key={item}>
                <div className="flex text-nusOrange">
                  {Array.from({ length: 5 }).map((_, index) => <Star key={index} size={15} fill="currentColor" />)}
                </div>
                <p className="mt-2 font-medium text-[#596173]">Review placeholder text.</p>
                <p className="text-sm text-[#a0a6b8]">Reviewer type</p>
              </div>
            ))}
          </Panel>
          <button className="h-12 w-full rounded-xl border border-[#a7bdf5] bg-white font-bold text-nusPurple" onClick={() => setActiveView("find")}>Back to mentors</button>
        </aside>
      </div>
    </section>
  );
}

function Panel({ title, children, action, onAction }: { title: string; children: React.ReactNode; action?: string; onAction?: () => void }) {
  return (
    <section className="card p-6">
      <div className="mb-5 flex items-center justify-between">
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

function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-xl border border-white/12 bg-white/10 px-6 py-4">
      <p className="brand-serif text-3xl font-black">{value}</p>
      <p className="text-sm font-semibold text-white/80">{label}</p>
    </div>
  );
}

function CompactMentor({ mentor, onProfile }: { mentor: Mentor; onProfile: () => void }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[#d4dae8] p-5">
      <Avatar initials={mentor.id.toUpperCase()} />
      <div className="min-w-0 flex-1">
        <p className="text-xl font-black">{mentor.name}</p>
        <p className="font-medium text-[#737b8f]">{mentor.year} - {mentor.programme} - {mentor.faculty}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {mentor.interests.slice(0, 3).map((tag, index) => <span key={tag} className={`chip ${pastel[index]}`}>{tag}</span>)}
        </div>
      </div>
      <Score score={mentor.match_score} />
      <button className="h-11 rounded-xl bg-nusPurple px-6 font-bold text-white" onClick={onProfile}>Connect</button>
    </div>
  );
}

function MentorCard({ mentor, onProfile }: { mentor: Mentor; onProfile: () => void }) {
  const stars = useMemo(() => Array.from({ length: 5 }), []);
  return (
    <article className="card p-6">
      <div className="flex items-start gap-5">
        <Avatar initials={mentor.id.toUpperCase()} />
        <div className="min-w-0 flex-1">
          <div className="flex justify-between">
            <div>
              <h3 className="text-2xl font-black">{mentor.name}</h3>
              <p className="font-medium text-[#737b8f]">{mentor.year} - {mentor.programme} - {mentor.faculty}</p>
            </div>
            <Score score={mentor.match_score} />
          </div>
          <div className="mt-3 flex items-center gap-1 text-nusOrange">
            {stars.map((_, index) => <Star key={index} size={16} fill="currentColor" />)}
            <span className="ml-2 font-medium text-[#737b8f]">( rating / review placeholder )</span>
          </div>
          <div className="dash-placeholder mt-4 p-4 font-medium text-[#737b8f]">{mentor.bio}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {mentor.interests.map((tag, index) => <span key={tag} className={`chip ${pastel[index % pastel.length]}`}>{tag}</span>)}
          </div>
          <div className="mt-5 flex items-center gap-3">
            <button className="h-11 rounded-xl bg-nusPurple px-6 font-bold text-white">Connect</button>
            <button className="h-11 rounded-xl bg-[#fff8ef] px-6 font-bold text-[#c94a12]">Message</button>
            <button className="h-11 px-2 font-bold text-nusPurple" onClick={onProfile}>View profile {"->"}</button>
          </div>
        </div>
      </div>
    </article>
  );
}

function Avatar({ initials, large = false }: { initials: string; large?: boolean }) {
  return (
    <div className={`grid shrink-0 place-items-center rounded-2xl bg-[#e5eaff] font-black text-nusPurple ${large ? "h-20 w-20 border-2 border-white/25 text-2xl" : "h-16 w-16 text-2xl"}`}>
      {initials}
    </div>
  );
}

function Score({ score }: { score: number }) {
  return (
    <span className="chip bg-[#fff8ef] text-nusOrange">
      <Zap size={14} fill="currentColor" />
      {score}% match
    </span>
  );
}
