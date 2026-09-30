import { motion } from "framer-motion";
import {
  Activity,
  Archive,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clipboard,
  ClipboardCheck,
  Clock3,
  Database,
  Edit3,
  FileCheck2,
  FileText,
  Gauge,
  GraduationCap,
  HardDrive,
  Layers3,
  type LucideIcon,
  Plus,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trash2,
  UserCheck,
  Users,
  XCircle
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Dialog } from "../components/ui/dialog";
import { Input, Select } from "../components/ui/input";
import { useApp } from "../contexts/AppContext";
import { useAuth } from "../contexts/AuthContext";
import { schoolDisplayName } from "../data/defaults";
import { useLessons } from "../hooks/useLessons";
import { LessonPlan, LessonStatus } from "../types/lesson";
import { AuthMode, roleLabels, UserProfile } from "../types/user";

type MetricTone = "cyan" | "emerald" | "amber" | "rose" | "violet" | "slate";
type ActivityItem = { id: string; title: string; detail: string; timestamp: string };
type TemporaryPasswordDialogState = { email: string; password: string } | null;
type AccountStatusDialogState = { email: string; status: "active" | "inactive" } | null;
type DashboardContext = {
  lessons: LessonPlan[];
  users: UserProfile[];
  currentUser: UserProfile;
  updateProfile: (profile: UserProfile) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  resetPassword: (email: string) => Promise<string | void>;
  setUserPassword: (id: string, nextPassword?: string) => Promise<string | void>;
  authMode: AuthMode;
  navigate: ReturnType<typeof useNavigate>;
  createLesson: ReturnType<typeof useLessons>["createLesson"];
  stats: ReturnType<typeof buildStats>;
  recentActivity: ActivityItem[];
  upcoming: LessonPlan[];
  calendar: ReturnType<typeof buildCalendar>;
};

const reviewedStatuses: LessonStatus[] = ["approved", "final-approved", "published"];
const submittedStatuses: LessonStatus[] = ["submitted", "under-review"];
const rejectedStatuses: LessonStatus[] = ["rejected", "revision-requested"];

export const Dashboard = () => {
  const { imageUrl } = useApp();
  const { currentUser, users, authMode, updateProfile, deleteUser, resetPassword, setUserPassword } = useAuth();
  const { lessons, createLesson } = useLessons();
  const navigate = useNavigate();
  if (!currentUser) return null;

  const stats = useMemo(() => buildStats(lessons), [lessons]);
  const recentActivity = useMemo(() => buildRecentActivity(lessons), [lessons]);
  const upcoming = useMemo(() => buildUpcomingLessons(lessons), [lessons]);
  const calendar = useMemo(() => buildCalendar(new Date(), lessons), [lessons]);
  const context: DashboardContext = { lessons, users, currentUser, authMode, updateProfile, deleteUser, resetPassword, setUserPassword, navigate, createLesson, stats, recentActivity, upcoming, calendar };

  const roleTitle = currentUser.role === "head-of-department" ? "HOD Dashboard" : `${roleLabels[currentUser.role]} Dashboard`;

  return (
    <div className="space-y-6">
      <section className="theme-dark-panel relative overflow-hidden rounded-lg border border-cyan-300/20 bg-[#061520]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_70px_rgba(0,0,0,0.38)]">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(20,184,222,0.20),transparent_32%,rgba(16,185,129,0.12)_70%,rgba(251,191,36,0.10))]" />
        <div className="relative grid gap-6 p-5 text-white md:grid-cols-[1.35fr_0.65fr] md:p-8">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <span className="badge">Version 1.5 Enterprise Dashboard</span>
            <p className="mt-4 text-sm font-black uppercase tracking-wide text-cyan-100">{timeGreeting(new Date())}, {currentUser.name}</p>
            <h1 className="mt-2 max-w-3xl text-3xl font-black leading-tight text-[#f8fdff] drop-shadow-[0_2px_14px_rgba(0,0,0,0.55)] md:text-4xl xl:text-5xl">{roleTitle}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-cyan-50/80">
              Role-based operational command center for lesson planning, review workflows, curriculum progress, and school readiness at {schoolDisplayName}.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-cyan-100">
              <span className="inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-white/[0.06] px-3 py-2"><ShieldCheck size={15} /> {roleLabels[currentUser.role]}</span>
              <span className="inline-flex items-center gap-2 rounded-md border border-emerald-300/20 bg-emerald-500/10 px-3 py-2"><CheckCircle2 size={15} /> {stats.readiness}% inspection ready</span>
              <span className="inline-flex items-center gap-2 rounded-md border border-amber-300/20 bg-amber-500/10 px-3 py-2"><Clock3 size={15} /> {stats.submitted} awaiting review</span>
            </div>
          </motion.div>
          <div className="flex items-end justify-start gap-4 md:justify-end">
            <img src={imageUrl} alt="School identity" className="hidden h-24 w-24 rounded-lg border border-cyan-300/20 bg-white object-cover p-1 shadow-xl sm:block" />
            <Button
              className="h-11 px-5"
              onClick={() => {
                const lesson = createLesson();
                navigate(`/editor/${lesson.id}`);
              }}
            >
              <Plus size={19} /> New Lesson Plan
            </Button>
          </div>
        </div>
      </section>

      {currentUser.role === "teacher" && <TeacherDashboard context={context} />}
      {currentUser.role === "head-of-department" && <HodDashboard context={context} />}
      {(currentUser.role === "principal" || currentUser.role === "vice-principal") && <PrincipalDashboard context={context} />}
      {currentUser.role === "administrator" && <AdministratorDashboard context={context} />}
    </div>
  );
};

const TeacherDashboard = ({ context }: { context: DashboardContext }) => {
  const { lessons, stats, recentActivity, upcoming, navigate, createLesson } = context;
  return (
    <>
      <MetricGrid>
        <Metric icon={FileText} label="Total Lesson Plans" value={lessons.length} tone="cyan" />
        <Metric icon={Clock3} label="Drafts" value={stats.draft} tone="amber" />
        <Metric icon={ClipboardCheck} label="Submitted" value={stats.submitted} tone="violet" />
        <Metric icon={CheckCircle2} label="Approved" value={stats.approved} tone="emerald" />
        <Metric icon={XCircle} label="Rejected" value={stats.rejected} tone="rose" />
        <Metric icon={Gauge} label="Completion Progress" value={`${stats.completion}%`} tone="cyan" />
      </MetricGrid>
      <DashboardGrid>
        <Panel title="Recent Activity" icon={Activity}><ActivityList items={recentActivity} /></Panel>
        <Panel title="Upcoming Teaching Schedule" icon={CalendarDays}><ScheduleList lessons={upcoming} /></Panel>
        <Panel title="Completion Progress" icon={TrendingUp}><ProgressStack stats={stats} /></Panel>
        <Panel title="Quick Actions" icon={Sparkles}>
          <ActionGrid
            actions={[
              { label: "New Lesson Plan", icon: Plus, onClick: () => navigate(`/editor/${createLesson().id}`) },
              { label: "View Drafts", icon: FileText, onClick: () => navigate("/plans?status=draft") },
              { label: "Submitted Plans", icon: ClipboardCheck, onClick: () => navigate("/plans?status=submitted") },
              { label: "Curriculum", icon: BookOpen, onClick: () => navigate("/curriculum") }
            ]}
          />
        </Panel>
      </DashboardGrid>
    </>
  );
};

const HodDashboard = ({ context }: { context: DashboardContext }) => {
  const { lessons, users, currentUser, stats, recentActivity, navigate } = context;
  const departmentTeachers = users.filter((user) => user.role === "teacher" && (user.department === currentUser.department || user.subjects.some((subject) => currentUser.subjects.includes(subject))));
  const teachersWithSubmitted = new Set(lessons.filter((lesson) => ["submitted", "under-review", "approved", "final-approved", "published"].includes(lesson.status)).map((lesson) => lesson.ownerId));
  const pendingTeachers = departmentTeachers.filter((teacher) => !teachersWithSubmitted.has(teacher.id));

  return (
    <>
      <MetricGrid>
        <Metric icon={Layers3} label="Department Lesson Plans" value={lessons.length} tone="cyan" />
        <Metric icon={Clock3} label="Submitted for Review" value={stats.submitted} tone="amber" />
        <Metric icon={CheckCircle2} label="Approved" value={stats.approved} tone="emerald" />
        <Metric icon={XCircle} label="Rejected" value={stats.rejected} tone="rose" />
        <Metric icon={Users} label="Teachers Pending Submission" value={pendingTeachers.length} tone="violet" />
        <Metric icon={Gauge} label="Curriculum Progress" value={`${stats.curriculum}%`} tone="cyan" />
      </MetricGrid>
      <DashboardGrid>
        <Panel title="Curriculum Progress" icon={BookOpen}><ProgressStack stats={stats} /></Panel>
        <Panel title="Review Activity" icon={ClipboardCheck}><ActivityList items={recentActivity} /></Panel>
        <Panel title="Teachers Pending Submission" icon={Users}>
          <CompactList items={pendingTeachers.map((teacher) => ({ title: teacher.name, detail: `${teacher.department} - ${teacher.gradeClasses.join(", ") || "No classes assigned"}` }))} empty="No pending teacher submissions." />
        </Panel>
        <Panel title="Department Shortcuts" icon={Sparkles}>
          <ActionGrid
            actions={[
              { label: "Review Queue", icon: Clock3, onClick: () => navigate("/plans?status=submitted") },
              { label: "Approved Plans", icon: FileCheck2, onClick: () => navigate("/plans?status=approved") },
              { label: "Curriculum", icon: BookOpen, onClick: () => navigate("/curriculum") },
              { label: "All Plans", icon: FileText, onClick: () => navigate("/plans") }
            ]}
          />
        </Panel>
      </DashboardGrid>
    </>
  );
};

const PrincipalDashboard = ({ context }: { context: DashboardContext }) => {
  const { lessons, users, stats, recentActivity, navigate } = context;
  const departments = buildDepartmentPerformance(lessons);
  const activeTeachers = users.filter((user) => user.role === "teacher" && user.status === "active").length;

  return (
    <>
      <MetricGrid>
        <Metric icon={FileText} label="All Lesson Plans" value={lessons.length} tone="cyan" />
        <Metric icon={BarChart3} label="Approval Statistics" value={`${stats.approvalRate}%`} tone="emerald" />
        <Metric icon={UserCheck} label="Teacher Activity" value={activeTeachers} tone="violet" />
        <Metric icon={Gauge} label="Term Progress" value={`${stats.termProgress}%`} tone="amber" />
        <Metric icon={InspectionIcon} label="Inspection Readiness" value={`${stats.readiness}%`} tone="emerald" />
      </MetricGrid>
      <DashboardGrid wide>
        <Panel title="Department Performance" icon={BarChart3}><DepartmentPerformance departments={departments} /></Panel>
        <Panel title="Approval Statistics" icon={ClipboardCheck}><ApprovalStats stats={stats} /></Panel>
        <Panel title="Teacher Activity" icon={Users}><ActivityList items={recentActivity} /></Panel>
        <Panel title="Inspection Readiness" icon={ShieldCheck}>
          <ReadinessPanel stats={stats} />
          <ActionGrid actions={[{ label: "Review All Plans", icon: FileText, onClick: () => navigate("/plans") }, { label: "Curriculum Audit", icon: BookOpen, onClick: () => navigate("/curriculum") }]} />
        </Panel>
      </DashboardGrid>
    </>
  );
};

const AdministratorDashboard = ({ context }: { context: DashboardContext }) => {
  const { lessons, users, authMode, stats, recentActivity, navigate, updateProfile, deleteUser, resetPassword, setUserPassword } = context;
  const [window, setWindow] = useState<"overview" | "users" | "security" | "system">("overview");
  const roles = Object.entries(groupCount(users, "role"));
  const storageKb = Math.max(1, Math.round(JSON.stringify({ lessons, users }).length / 1024));

  return (
    <>
      <Card className="p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-4">
          {[
            ["overview", "Overview", Database],
            ["users", "Users", Users],
            ["security", "Security", ShieldCheck],
            ["system", "System", Settings]
          ].map(([key, label, Icon]) => (
            <button key={key as string} type="button" onClick={() => setWindow(key as typeof window)} className={`flex min-h-12 items-center justify-center gap-2 rounded-md border px-3 text-sm font-black ${window === key ? "border-cyan-200 bg-cyan-300/20 text-white" : "border-cyan-300/15 bg-white/[0.04] text-cyan-100 hover:bg-cyan-500/10"}`}>
              <Icon size={16} /> {label as string}
            </button>
          ))}
        </div>
      </Card>

      {window === "overview" && (
        <>
          <MetricGrid>
            <Metric icon={Users} label="Users" value={users.length} tone="cyan" />
            <Metric icon={ShieldCheck} label="Roles" value={roles.length} tone="violet" />
            <Metric icon={Activity} label="System Activity" value={recentActivity.length} tone="amber" />
            <Metric icon={Database} label="Lesson Data" value={lessons.length} tone="emerald" />
            <Metric icon={HardDrive} label="Storage Overview" value={`${storageKb} KB`} tone="slate" />
          </MetricGrid>
          <DashboardGrid>
            <Panel title="Users & Roles" icon={Users}>
              <CompactList items={roles.map(([role, count]) => ({ title: roleLabels[role as keyof typeof roleLabels], detail: `${count} profile${count > 1 ? "s" : ""}` }))} />
            </Panel>
            <Panel title="Data Overview" icon={Database}><ProgressStack stats={stats} /></Panel>
          </DashboardGrid>
        </>
      )}

      {window === "users" && <AdminUserManager users={users} lessons={lessons} currentUser={context.currentUser} authMode={authMode} updateProfile={updateProfile} deleteUser={deleteUser} resetPassword={resetPassword} setUserPassword={setUserPassword} />}

      {window === "security" && (
        <DashboardGrid>
          <PasswordRecoveryCenter users={users} authMode={authMode} resetPassword={resetPassword} setUserPassword={setUserPassword} />
          <Panel title="Administrator Authority" icon={ShieldCheck}>
            <CompactList
              items={users.filter((user) => ["administrator", "principal", "vice-principal"].includes(user.role)).map((user) => ({
                title: user.name,
                detail: `${roleLabels[user.role]} - ${user.email} - ${user.status}`
              }))}
              empty="No authority profiles found."
            />
          </Panel>
        </DashboardGrid>
      )}

      {window === "system" && (
        <DashboardGrid>
          <Panel title="System Activity" icon={Activity}><ActivityList items={recentActivity} /></Panel>
          <Panel title="Configuration Shortcuts" icon={Settings}>
            <ActionGrid
              actions={[
                { label: "Manage Plans", icon: FileText, onClick: () => navigate("/plans") },
                { label: "Curriculum Data", icon: BookOpen, onClick: () => navigate("/curriculum") },
                { label: "Approval Queue", icon: ClipboardCheck, onClick: () => navigate("/plans?status=submitted") },
                { label: "Archive Review", icon: Archive, onClick: () => navigate("/plans?status=archived") }
              ]}
            />
          </Panel>
        </DashboardGrid>
      )}
    </>
  );
};

const TemporaryPasswordDialog = ({
  value,
  onClose
}: {
  value: TemporaryPasswordDialogState;
  onClose: () => void;
}) => {
  const [copied, setCopied] = useState(false);
  if (!value) return null;

  const copyPassword = async () => {
    await navigator.clipboard.writeText(value.password);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Dialog open={Boolean(value)} title="Temporary password" onClose={onClose} size="compact">
      <div className="space-y-4 text-center">
        <p className="text-sm font-semibold text-slate-700 dark:text-cyan-100">
          Temporary password generated for <span className="text-white">{value.email}</span>.
        </p>
        <div className="rounded-md border border-cyan-300/20 bg-slate-950/70 p-3">
          <p className="break-all font-mono text-lg font-black text-cyan-100">{value.password}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={copyPassword}><Clipboard size={16} /> {copied ? "Copied" : "Copy password"}</Button>
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Dialog>
  );
};

const AccountStatusDialog = ({
  value,
  onClose
}: {
  value: AccountStatusDialogState;
  onClose: () => void;
}) => {
  if (!value) return null;
  const activated = value.status === "active";

  return (
    <Dialog open={Boolean(value)} title={activated ? "Account activated" : "Account disabled"} onClose={onClose} size="compact">
      <div className="space-y-4 text-center">
        <p className="text-sm font-semibold text-slate-700 dark:text-cyan-100">
          Account {activated ? "activated" : "disabled"} for <span className="text-white">{value.email}</span>.
        </p>
        <div className={`rounded-md border px-3 py-2 ${activated ? "border-emerald-300/20 bg-emerald-500/10" : "border-amber-300/25 bg-amber-500/10"}`}>
          <p className={`text-sm font-bold ${activated ? "text-emerald-100" : "text-amber-100"}`}>
            {activated ? "The user's existing account password was kept." : "The account is now inactive and cannot sign in until it is activated again."}
          </p>
        </div>
        <Button type="button" onClick={onClose}>OK</Button>
      </div>
    </Dialog>
  );
};

const AdminUserManager = ({
  users,
  lessons,
  currentUser,
  authMode,
  updateProfile,
  deleteUser,
  resetPassword,
  setUserPassword
}: {
  users: UserProfile[];
  lessons: LessonPlan[];
  currentUser: UserProfile;
  authMode: AuthMode;
  updateProfile: (profile: UserProfile) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  resetPassword: (email: string) => Promise<string | void>;
  setUserPassword: (id: string, nextPassword?: string) => Promise<string | void>;
}) => {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [lessonFilter, setLessonFilter] = useState("");
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<UserProfile | null>(null);
  const [notice, setNotice] = useState("");
  const [temporaryDialog, setTemporaryDialog] = useState<TemporaryPasswordDialogState>(null);
  const [accountStatusDialog, setAccountStatusDialog] = useState<AccountStatusDialogState>(null);
  const userLessons = useMemo(() => new Map(users.map((user) => [user.id, lessons.filter((lesson) => isUserLesson(user, lesson))])), [lessons, users]);
  const departmentOptions = useMemo(() => unique(users.map((user) => user.department).filter(Boolean)), [users]);
  const subjectOptions = useMemo(() => unique([...users.flatMap((user) => user.subjects), ...lessons.map((lesson) => lesson.subject)].filter(Boolean)), [lessons, users]);
  const gradeOptions = useMemo(() => unique([...users.flatMap((user) => user.gradeClasses), ...lessons.map((lesson) => lesson.gradeClass)].filter(Boolean)), [lessons, users]);
  const filtered = users.filter((user) => {
    const relatedLessons = userLessons.get(user.id) || [];
    const lessonStats = summarizeUserLessons(relatedLessons);
    const haystack = [
      user.name,
      user.email,
      user.department,
      roleLabels[user.role],
      user.subjects.join(" "),
      user.gradeClasses.join(" "),
      user.status,
      ...relatedLessons.flatMap((lesson) => [lesson.lessonNumber, lesson.topic, lesson.subject, lesson.gradeClass, lesson.status, lesson.week])
    ]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase());
    return (
      haystack &&
      (!roleFilter || user.role === roleFilter) &&
      (!statusFilter || user.status === statusFilter) &&
      (!departmentFilter || user.department === departmentFilter) &&
      (!subjectFilter || user.subjects.includes(subjectFilter) || relatedLessons.some((lesson) => lesson.subject === subjectFilter)) &&
      (!gradeFilter || user.gradeClasses.includes(gradeFilter) || relatedLessons.some((lesson) => lesson.gradeClass === gradeFilter)) &&
      matchesLessonFilter(lessonFilter, lessonStats)
    );
  });

  const resetFilters = () => {
    setQuery("");
    setRoleFilter("");
    setStatusFilter("");
    setDepartmentFilter("");
    setSubjectFilter("");
    setGradeFilter("");
    setLessonFilter("");
  };

  const startEdit = (user: UserProfile) => {
    setEditingId(user.id);
    setDraft({ ...user, subjects: [...user.subjects], gradeClasses: [...user.gradeClasses] });
    setNotice("");
  };

  const saveDraft = async () => {
    if (!draft) return;
    const previous = users.find((user) => user.id === draft.id);
    if (!keepsActiveAuthority(users, draft)) {
      setNotice("Keep at least one active administrator, principal, or vice-principal profile.");
      return;
    }
    await updateProfile({
      ...draft,
      subjects: normalizeCsv(draft.subjects.join(",")),
      gradeClasses: normalizeCsv(draft.gradeClasses.join(","))
    });
    const activated = previous?.status !== "active" && draft.status === "active";
    const disabled = previous?.status === "active" && draft.status === "inactive";
    setEditingId("");
    setDraft(null);
    if (activated || disabled) setAccountStatusDialog({ email: draft.email, status: draft.status });
    setNotice(activated ? "User profile activated. The user's existing account password was kept." : disabled ? "User profile disabled." : "User profile updated.");
  };

  const recover = async (user: UserProfile) => {
    try {
      const temporary = await setUserPassword(user.id);
      if (temporary) setTemporaryDialog({ email: user.email, password: temporary });
      setNotice(temporary ? `New temporary password ready for ${user.email}.` : `Secure recovery link sent to ${user.email}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to prepare password recovery.");
    }
  };

  const toggleStatus = async (user: UserProfile) => {
    const next = { ...user, status: user.status === "active" ? "inactive" : "active" } as UserProfile;
    if (!keepsActiveAuthority(users, next)) {
      setNotice("Keep at least one active administrator, principal, or vice-principal profile.");
      return;
    }
    await updateProfile(next);
    if (next.status === "active") {
      setAccountStatusDialog({ email: next.email, status: "active" });
      setNotice(`Account activated for ${next.email}. The user's existing account password was kept.`);
    } else {
      setAccountStatusDialog({ email: next.email, status: "inactive" });
      setNotice(`Account disabled for ${next.email}.`);
    }
  };

  const remove = async (user: UserProfile) => {
    if (user.id === currentUser.id) {
      setNotice("You cannot delete your own active administrator profile.");
      return;
    }
    if (!keepsActiveAuthority(users.filter((item) => item.id !== user.id))) {
      setNotice("Keep at least one active administrator, principal, or vice-principal profile.");
      return;
    }
    if (!confirm(`Delete ${user.name}'s application profile?`)) return;
    await deleteUser(user.id);
    setNotice("User profile deleted.");
  };

  return (
    <Card className="p-4 sm:p-5">
      <TemporaryPasswordDialog value={temporaryDialog} onClose={() => setTemporaryDialog(null)} />
      <AccountStatusDialog value={accountStatusDialog} onClose={() => setAccountStatusDialog(null)} />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-white"><Users className="text-cyan-300" size={20} /> User Administration</h2>
          <p className="text-sm text-slate-700 dark:text-muted-foreground">View identities, correct profiles, activate access, send password recovery, or remove application profiles.</p>
        </div>
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cyan-300" size={16} />
          <Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users" />
        </div>
      </div>
      <div className="mb-4 grid gap-2 md:grid-cols-2 xl:grid-cols-6">
        <Select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
          <option value="">Any role</option>
          {Object.entries(roleLabels).map(([role, label]) => <option key={role} value={role}>{label}</option>)}
        </Select>
        <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">Any user status</option>
          <option value="active">Active users</option>
          <option value="inactive">Inactive users</option>
        </Select>
        <Select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
          <option value="">Any department</option>
          {departmentOptions.map((department) => <option key={department} value={department}>{department}</option>)}
        </Select>
        <Select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
          <option value="">Any course</option>
          {subjectOptions.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
        </Select>
        <Select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)}>
          <option value="">Any class</option>
          {gradeOptions.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
        </Select>
        <Select value={lessonFilter} onChange={(event) => setLessonFilter(event.target.value)}>
          <option value="">Any lesson activity</option>
          <option value="has-lessons">Has lesson plans</option>
          <option value="no-lessons">No lesson plans</option>
          <option value="draft">Has drafts</option>
          <option value="submitted">Has submitted plans</option>
          <option value="under-review">Under review</option>
          <option value="approved">Approved/final/published</option>
          <option value="needs-attention">Rejected/revision requested</option>
        </Select>
      </div>
      {(query || roleFilter || statusFilter || departmentFilter || subjectFilter || gradeFilter || lessonFilter) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-cyan-300/15 bg-cyan-500/10 px-3 py-2">
          <p className="text-xs font-black uppercase text-cyan-100">{filtered.length} of {users.length} user profile{filtered.length === 1 ? "" : "s"} shown</p>
          <Button type="button" variant="outline" className="h-8 px-3" onClick={resetFilters}>Clear filters</Button>
        </div>
      )}
      {notice && <p className="mb-3 rounded-md border border-cyan-300/20 bg-cyan-500/10 px-3 py-2 text-sm font-bold text-cyan-50">{notice}</p>}
      <div className="grid gap-3">
        {filtered.map((user) => {
          const isEditing = editingId === user.id && draft;
          const stats = summarizeUserLessons(userLessons.get(user.id) || []);
          return (
            <div key={user.id} className="rounded-md border border-cyan-300/15 bg-white/[0.04] p-3">
              {isEditing ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                  <Input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
                  <Select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as UserProfile["role"] })}>
                    {Object.entries(roleLabels).map(([role, label]) => <option key={role} value={role}>{label}</option>)}
                  </Select>
                  <Input value={draft.department} onChange={(event) => setDraft({ ...draft, department: event.target.value })} placeholder="Department" />
                  <Input value={draft.subjects.join(", ")} onChange={(event) => setDraft({ ...draft, subjects: normalizeCsv(event.target.value) })} placeholder="Subjects" />
                  <Input value={draft.gradeClasses.join(", ")} onChange={(event) => setDraft({ ...draft, gradeClasses: normalizeCsv(event.target.value) })} placeholder="Grade classes" />
                  <Select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as UserProfile["status"] })}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </Select>
                  <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-3">
                    <Button type="button" onClick={saveDraft}><UserCheck size={16} /> Save profile</Button>
                    <Button type="button" variant="outline" onClick={() => { setEditingId(""); setDraft(null); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <p className="font-black text-white">{user.name}</p>
                    <p className="break-words text-sm text-slate-700 dark:text-muted-foreground">{user.email} - {roleLabels[user.role]} - {user.status}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-cyan-100/80">{user.department || "No department"} | {user.subjects.join(", ") || "No subjects"} | {user.gradeClasses.join(", ") || "No classes"}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-black">
                      <span className="rounded-sm border border-slate-300 bg-white/80 px-2 py-1 text-slate-900 dark:border-cyan-300/15 dark:bg-cyan-500/10 dark:text-cyan-100">Plans: {stats.total} total</span>
                      <span className="rounded-sm border border-slate-300 bg-white/80 px-2 py-1 text-slate-900 dark:border-cyan-300/15 dark:bg-cyan-500/10 dark:text-cyan-100">{stats.draft} draft</span>
                      <span className="rounded-sm border border-slate-300 bg-white/80 px-2 py-1 text-slate-900 dark:border-cyan-300/15 dark:bg-cyan-500/10 dark:text-cyan-100">{stats.submitted} submitted</span>
                      <span className="rounded-sm border border-slate-300 bg-white/80 px-2 py-1 text-slate-900 dark:border-cyan-300/15 dark:bg-cyan-500/10 dark:text-cyan-100">{stats.underReview} review</span>
                      <span className="rounded-sm border border-slate-300 bg-white/80 px-2 py-1 text-slate-900 dark:border-cyan-300/15 dark:bg-cyan-500/10 dark:text-cyan-100">{stats.approved} approved</span>
                      <span className="rounded-sm border border-amber-300 bg-amber-100 px-2 py-1 text-amber-950 dark:border-amber-300/25 dark:bg-amber-400/10 dark:text-amber-100">{stats.needsAttention} attention</span>
                    </div>
                    <p className="mt-1 text-[11px] font-semibold text-slate-600 dark:text-muted-foreground">Created {formatDate(user.createdAt)} | Updated {formatDate(user.updatedAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => startEdit(user)}><Edit3 size={15} /> Edit</Button>
                    <Button type="button" variant="outline" onClick={() => toggleStatus(user)}>
                      <UserCheck size={15} /> {user.status === "active" ? "Disable" : "Activate"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => recover(user)}><RotateCcw size={15} /> Recover</Button>
                    <Button type="button" variant="danger" onClick={() => remove(user)}><Trash2 size={15} /> Delete</Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <p className="py-8 text-sm text-muted-foreground">No users match this search.</p>}
      </div>
    </Card>
  );
};

const PasswordRecoveryCenter = ({ users, authMode, resetPassword, setUserPassword }: { users: UserProfile[]; authMode: AuthMode; resetPassword: (email: string) => Promise<string | void>; setUserPassword: (id: string, nextPassword?: string) => Promise<string | void> }) => {
  const [selectedId, setSelectedId] = useState(users[0]?.id || "");
  const [customPassword, setCustomPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [temporaryDialog, setTemporaryDialog] = useState<TemporaryPasswordDialogState>(null);
  const selected = users.find((user) => user.id === selectedId) || users[0];

  useEffect(() => {
    if (!selectedId && users[0]) setSelectedId(users[0].id);
    if (selectedId && !users.some((user) => user.id === selectedId)) setSelectedId(users[0]?.id || "");
  }, [selectedId, users]);

  const sendRecovery = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const temporary = await setUserPassword(selected.id);
      if (temporary) setTemporaryDialog({ email: selected.email, password: temporary });
      setNotice(authMode === "cloud"
        ? `Recovery ready for ${selected.email}. Temporary password is available in the copy window.`
        : `Local recovery ready for ${selected.email}. Temporary password is available in the copy window.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to prepare password recovery.");
    } finally {
      setBusy(false);
    }
  };

  const setTemporary = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const temporary = await setUserPassword(selected.id, customPassword || undefined);
      if (temporary) setTemporaryDialog({ email: selected.email, password: temporary });
      setNotice(temporary ? `New temporary password ready for ${selected.email}.` : `Secure recovery link sent to ${selected.email}.`);
      setCustomPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to set the temporary password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Password Recovery Center" icon={RotateCcw}>
      <TemporaryPasswordDialog value={temporaryDialog} onClose={() => setTemporaryDialog(null)} />
      <div className="space-y-3">
        <p className="text-sm text-slate-700 dark:text-muted-foreground">{authMode === "cloud" ? "Choose a user and generate a temporary password directly. This avoids blocked recovery emails." : "Choose a user and set a temporary password for local fallback mode."}</p>
        <Select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
          {users.map((user) => <option key={user.id} value={user.id}>{user.name} - {user.email}</option>)}
        </Select>
        {authMode === "local" && <Input value={customPassword} onChange={(event) => setCustomPassword(event.target.value)} placeholder="Optional temporary password" />}
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={sendRecovery} disabled={busy || !selected}><RotateCcw size={16} /> {busy ? "Preparing..." : "Send recovery"}</Button>
          <Button type="button" variant="outline" onClick={setTemporary} disabled={busy || !selected}><RotateCcw size={16} /> Set temporary password</Button>
        </div>
        {notice && <p className="rounded-md border border-cyan-300/20 bg-cyan-500/10 px-3 py-2 text-sm font-bold text-cyan-50">{notice}</p>}
        {error && <p className="rounded-md border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-100">{error}</p>}
      </div>
    </Panel>
  );
};

const isUserLesson = (user: UserProfile, lesson: LessonPlan) => {
  const teacherMatch = lesson.teachers?.trim().toLowerCase() === user.name.trim().toLowerCase();
  return lesson.ownerId === user.id || teacherMatch;
};

const summarizeUserLessons = (lessons: LessonPlan[]) => ({
  total: lessons.length,
  draft: lessons.filter((lesson) => lesson.status === "draft").length,
  submitted: lessons.filter((lesson) => lesson.status === "submitted").length,
  underReview: lessons.filter((lesson) => lesson.status === "under-review").length,
  approved: lessons.filter((lesson) => ["approved", "final-approved", "published"].includes(lesson.status)).length,
  needsAttention: lessons.filter((lesson) => ["rejected", "revision-requested"].includes(lesson.status)).length
});

const matchesLessonFilter = (filter: string, stats: ReturnType<typeof summarizeUserLessons>) => {
  if (!filter) return true;
  if (filter === "has-lessons") return stats.total > 0;
  if (filter === "no-lessons") return stats.total === 0;
  if (filter === "draft") return stats.draft > 0;
  if (filter === "submitted") return stats.submitted > 0;
  if (filter === "under-review") return stats.underReview > 0;
  if (filter === "approved") return stats.approved > 0;
  if (filter === "needs-attention") return stats.needsAttention > 0;
  return true;
};

const authorityRoles = ["administrator", "principal", "vice-principal"];
const keepsActiveAuthority = (users: UserProfile[], draft?: UserProfile) =>
  users
    .map((user) => (draft && user.id === draft.id ? draft : user))
    .some((user) => user.status === "active" && authorityRoles.includes(user.role));

const MetricGrid = ({ children }: { children: ReactNode }) => <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{children}</div>;

const DashboardGrid = ({ children, wide = false }: { children: ReactNode; wide?: boolean }) => (
  <div className={`grid min-w-0 gap-5 ${wide ? "xl:grid-cols-2" : "xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)]"}`}>{children}</div>
);

const Metric = ({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string | number; tone: MetricTone }) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
    <Card className="min-h-[132px] p-5">
      <Icon className={`mb-4 ${toneClass(tone)}`} size={22} />
      <p className="text-3xl font-black text-white">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </Card>
  </motion.div>
);

const Panel = ({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) => (
  <Card className="p-5">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex min-w-0 items-center gap-2 text-xl font-bold text-white"><Icon className="shrink-0 text-cyan-300" size={20} /> <span className="truncate">{title}</span></h2>
    </div>
    {children}
  </Card>
);

const ActivityList = ({ items }: { items: ActivityItem[] }) => (
  <div className="divide-y divide-cyan-300/10">
    {items.length === 0 && <p className="py-8 text-sm text-muted-foreground">No activity yet.</p>}
    {items.map((item) => (
      <div key={item.id} className="py-3">
        <p className="font-semibold text-white">{item.title}</p>
        <p className="text-sm text-muted-foreground">{item.detail}</p>
        <p className="mt-1 text-[11px] font-bold uppercase text-cyan-200">{formatDate(item.timestamp)}</p>
      </div>
    ))}
  </div>
);

const ScheduleList = ({ lessons }: { lessons: LessonPlan[] }) => (
  <div className="space-y-3">
    {lessons.length === 0 && <p className="py-8 text-sm text-muted-foreground">No upcoming lessons scheduled.</p>}
    {lessons.map((lesson) => (
      <div key={lesson.id} className="rounded-md border border-cyan-300/15 bg-white/[0.04] p-3">
        <p className="font-bold text-white">{lesson.topic || "Untitled Lesson"}</p>
        <p className="text-sm text-muted-foreground">{lesson.subject || "Subject"} - {lesson.gradeClass || "Grade"} - {formatDate(lesson.date)}</p>
      </div>
    ))}
  </div>
);

const ProgressStack = ({ stats }: { stats: ReturnType<typeof buildStats> }) => (
  <div className="space-y-3 text-sm">
    <Bar label="Completion Progress" value={stats.completion} />
    <Bar label="Approval Rate" value={stats.approvalRate} />
    <Bar label="Curriculum Progress" value={stats.curriculum} />
    <Bar label="Term Progress" value={stats.termProgress} />
  </div>
);

const ApprovalStats = ({ stats }: { stats: ReturnType<typeof buildStats> }) => (
  <div className="grid gap-3 sm:grid-cols-3">
    <SmallStat label="Approved" value={stats.approved} tone="emerald" />
    <SmallStat label="In Review" value={stats.submitted} tone="amber" />
    <SmallStat label="Rejected / Revision" value={stats.rejected} tone="rose" />
  </div>
);

const ReadinessPanel = ({ stats }: { stats: ReturnType<typeof buildStats> }) => (
  <div className="mb-4 rounded-md border border-emerald-300/20 bg-emerald-500/10 p-4">
    <p className="text-4xl font-black text-white">{stats.readiness}%</p>
    <p className="mt-1 text-sm text-muted-foreground">Inspection readiness blends approval rate, curriculum coverage, and live submission progress.</p>
  </div>
);

const DepartmentPerformance = ({ departments }: { departments: { department: string; total: number; approved: number; progress: number }[] }) => (
  <div className="space-y-3">
    {departments.length === 0 && <p className="py-8 text-sm text-muted-foreground">No department data yet.</p>}
    {departments.map((item) => (
      <div key={item.department} className="rounded-md border border-cyan-300/15 bg-white/[0.04] p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="font-bold text-white">{item.department}</p>
          <p className="text-sm font-black text-cyan-200">{item.approved}/{item.total} approved</p>
        </div>
        <Bar label="Performance" value={item.progress} />
      </div>
    ))}
  </div>
);

const CompactList = ({ items, empty = "No records to show." }: { items: { title: string; detail: string }[]; empty?: string }) => (
  <div className="space-y-2">
    {items.length === 0 && <p className="py-8 text-sm text-muted-foreground">{empty}</p>}
    {items.map((item) => (
      <div key={`${item.title}-${item.detail}`} className="rounded-md border border-cyan-300/15 bg-white/[0.04] px-3 py-2">
        <p className="font-bold text-white">{item.title}</p>
        <p className="text-sm text-muted-foreground">{item.detail}</p>
      </div>
    ))}
  </div>
);

const ActionGrid = ({ actions }: { actions: { label: string; icon: LucideIcon; onClick: () => void }[] }) => (
  <div className="grid gap-2 sm:grid-cols-2">
    {actions.map(({ label, icon: Icon, onClick }) => (
      <button key={label} className="flex min-h-16 items-center gap-3 rounded-md border border-cyan-300/15 bg-white/[0.04] px-3 py-3 text-left font-bold text-white transition hover:border-cyan-300/35 hover:bg-cyan-500/10" onClick={onClick}>
        <Icon className="shrink-0 text-cyan-300" size={18} />
        <span>{label}</span>
      </button>
    ))}
  </div>
);

const SmallStat = ({ label, value, tone }: { label: string; value: number; tone: MetricTone }) => (
  <div className="rounded-md border border-cyan-300/15 bg-white/[0.04] p-3">
    <p className={`text-2xl font-black ${toneClass(tone)}`}>{value}</p>
    <p className="text-sm text-muted-foreground">{label}</p>
  </div>
);

const Bar = ({ label, value }: { label: string; value: number }) => (
  <div>
    <div className="mb-1 flex justify-between gap-3 text-sm">
      <span>{label}</span>
      <span className="font-bold text-cyan-200">{value}%</span>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
      <motion.div className="h-full rounded-full bg-cyan-300" initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.5 }} />
    </div>
  </div>
);

const buildStats = (lessons: LessonPlan[]) => {
  const total = lessons.length;
  const draft = countStatus(lessons, ["draft"]);
  const submitted = countStatus(lessons, submittedStatuses);
  const approved = countStatus(lessons, reviewedStatuses);
  const rejected = countStatus(lessons, rejectedStatuses);
  const completion = total ? Math.round(((total - draft) / total) * 100) : 0;
  const approvalRate = total ? Math.round((approved / total) * 100) : 0;
  const curriculum = total ? Math.round((lessons.filter((lesson) => lesson.weeklyPlan?.some((day) => day.lesson && day.objectives)).length / total) * 100) : 0;
  const termProgress = total ? Math.min(100, Math.round(((approved + submitted) / total) * 100)) : 0;
  const readiness = Math.round((approvalRate * 0.45) + (curriculum * 0.35) + (completion * 0.2));
  return { total, draft, submitted, approved, rejected, completion, approvalRate, curriculum, termProgress, readiness };
};

const countStatus = (lessons: LessonPlan[], statuses: LessonStatus[]) => lessons.filter((lesson) => statuses.includes(lesson.status)).length;

const buildRecentActivity = (lessons: LessonPlan[]) =>
  lessons
    .flatMap((lesson) =>
      (lesson.activityLogs?.length ? lesson.activityLogs : [{ id: `${lesson.id}-updated`, description: "Lesson plan updated", timestamp: lesson.updatedAt, userName: lesson.ownerName }]).map((log) => ({
        id: `${lesson.id}-${log.id}`,
        title: lesson.topic || lesson.lessonNumber || "Untitled Lesson",
        detail: `${log.userName}: ${log.description}`,
        timestamp: log.timestamp
      }))
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 6);

const buildUpcomingLessons = (lessons: LessonPlan[]) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return lessons
    .filter((lesson) => lesson.date && new Date(`${lesson.date}T00:00:00`).getTime() >= today.getTime())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);
};

const buildDepartmentPerformance = (lessons: LessonPlan[]) =>
  Object.entries(groupBy(lessons, (lesson) => lesson.department || "Unassigned"))
    .map(([department, items]) => {
      const approved = countStatus(items, reviewedStatuses);
      return { department, total: items.length, approved, progress: items.length ? Math.round((approved / items.length) * 100) : 0 };
    })
    .sort((a, b) => b.progress - a.progress || b.total - a.total)
    .slice(0, 6);

const buildCalendar = (today: Date, lessons: LessonPlan[]) => {
  const year = today.getFullYear();
  const month = today.getMonth();
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long" }).format(today);
  return {
    year,
    monthLabel,
    plannedCount: lessons.filter((lesson) => {
      if (!lesson.date) return false;
      const date = new Date(`${lesson.date}T00:00:00`);
      return date.getFullYear() === year && date.getMonth() === month;
    }).length
  };
};

const groupBy = <T,>(items: T[], key: (item: T) => string) =>
  items.reduce<Record<string, T[]>>((groups, item) => {
    const groupKey = key(item);
    groups[groupKey] = [...(groups[groupKey] || []), item];
    return groups;
  }, {});

const groupCount = <T, K extends keyof T>(items: T[], key: K) =>
  items.reduce<Record<string, number>>((groups, item) => {
    const value = String(item[key] || "unknown");
    groups[value] = (groups[value] || 0) + 1;
    return groups;
  }, {});

const normalizeCsv = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

const unique = (values: string[]) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));

const timeGreeting = (date: Date) => {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
};

const formatDate = (value?: string) => {
  if (!value) return "No date";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "No date";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
};

const toneClass = (tone: MetricTone) => {
  const tones: Record<MetricTone, string> = {
    cyan: "text-cyan-300",
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    rose: "text-rose-300",
    violet: "text-violet-300",
    slate: "text-slate-300"
  };
  return tones[tone];
};

const InspectionIcon = GraduationCap;
