import { FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Download, Eye, EyeOff, LockKeyhole, Mail, RotateCcw, ShieldCheck, UserPlus, UserRoundCheck } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input, Select } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../contexts/AuthContext";
import { schoolDisplayName, schoolImage } from "../data/defaults";
import { cloudAuthService } from "../services/cloudAuthService";
import { mockAuthService } from "../services/mockAuthService";
import { getRecoveryParam } from "../services/urlRecoveryService";
import { roleLabels, SignUpProfileInput, UserRole } from "../types/user";
import { usePwaInstall } from "../hooks/usePwaInstall";

type AuthPanel = "signin" | "signup" | "reset" | "new-password";

const departmentOptions = ["Administration", "Teaching", "English", "Mathematics", "Science", "Social Studies", "Bible", "French", "Arts", "Physical Education"];
const subjectOptions = ["English", "English (Writing and Grammar)", "Mathematics", "Science", "Social Studies", "Bible", "French", "Art", "Music", "Physical Education", "Computer Science"];
const gradeOptions = ["K3", "K4", "K5", ...Array.from({ length: 12 }, (_, index) => `Grade ${index + 1}`)];

const emptySignup: SignUpProfileInput = {
  name: "",
  email: "",
  password: "",
  role: "teacher",
  department: "",
  subjects: [],
  gradeClasses: []
};

export const Login = () => {
  const { currentUser, users, authMode, loading, signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();
  const { showInstall, install } = usePwaInstall();
  const activeUsers = useMemo(() => users.filter((user) => user.status === "active"), [users]);
  const pendingUsers = useMemo(() => users.filter((user) => user.status === "inactive"), [users]);
  const recoveryToken = getRecoveryAccessToken();
  const recoveryTemporaryPassword = getRecoveryTemporaryPassword();
  const [panel, setPanel] = useState<AuthPanel>(recoveryToken ? "new-password" : "signin");
  const [email, setEmail] = useState(authMode === "local" ? activeUsers[0]?.email || "" : "");
  const [password, setPassword] = useState(authMode === "local" ? mockAuthService.demoPassword : "");
  const [signup, setSignup] = useState(emptySignup);
  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (authMode === "local" && !email && activeUsers[0]?.email) setEmail(activeUsers[0].email);
  }, [activeUsers, authMode, email]);

  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    root.classList.add("dark");
    return () => {
      if (!wasDark) root.classList.remove("dark");
    };
  }, []);

  if (currentUser) return <Navigate to="/" replace />;

  const selectedUser = activeUsers.find((user) => user.email === email);

  const submitSignin = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await signIn(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect email or password.");
    } finally {
      setBusy(false);
    }
  };

  const submitSignup = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await signUp(signup);
      setSignup(emptySignup);
      setPanel("signin");
      setMessage("Account created. A school authority must activate it before first login.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create this account.";
      setError(message);
      if (authMode === "cloud" && message.toLowerCase().includes("too many account requests")) {
        setMessage("If this is urgent, ask an administrator, principal, or vice principal to create or activate the account from the authority portal.");
      }
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await resetPassword(resetEmail);
      setMessage("If this account exists, a branded KCS recovery email has been sent. Check the inbox and spam folder.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start password recovery.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!recoveryToken || !recoveryTemporaryPassword || authMode !== "cloud") return;
    let cancelled = false;
    setBusy(true);
    setError("");
    setMessage("");
    cloudAuthService.updatePasswordFromRecovery(recoveryToken, recoveryTemporaryPassword)
      .then(() => {
        if (cancelled) return;
        window.history.replaceState(null, "", `${import.meta.env.BASE_URL}#/login`);
        setPanel("signin");
        setMessage("Temporary password activated. Sign in with the temporary password sent by the school authority, then change it from your profile.");
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to activate the temporary password.");
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authMode, recoveryTemporaryPassword, recoveryToken]);

  const submitNewPassword = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      if (!recoveryToken || authMode !== "cloud") throw new Error("Recovery link is missing or expired.");
      await cloudAuthService.updatePasswordFromRecovery(recoveryToken, newPassword);
      window.history.replaceState(null, "", `${import.meta.env.BASE_URL}#/login`);
      setNewPassword("");
      setPanel("signin");
      setMessage("Password updated. You can sign in with your new password.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update the password.");
    } finally {
      setBusy(false);
    }
  };

  const patchSignup = <K extends keyof SignUpProfileInput>(key: K, value: SignUpProfileInput[K]) => setSignup((current) => ({ ...current, [key]: value }));

  return (
    <main className="login-edupay theme-dark-panel grid min-h-screen place-items-center overflow-hidden bg-[#030d14] px-4 py-8 text-[#e7faff]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(20,184,222,0.20),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.14),transparent_30%),linear-gradient(180deg,#031b34_0%,#04141f_42%,#030d14_100%)]" />
      <Card className="relative w-full max-w-2xl overflow-hidden border-cyan-300/20 bg-[#071824]/95 p-0 text-[#e7faff]">
        <div className="border-b border-cyan-300/20 bg-slate-950 px-6 py-5 text-white sm:px-7">
          <div className="flex items-center gap-3">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-md border border-cyan-200/40 bg-white p-1 shadow-sm">
              <img src={schoolImage} alt="KCS" className="h-full w-full rounded-sm object-cover" />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-xs font-black uppercase tracking-[0.22em] text-cyan-200">EduPlanner KCS</p>
              <h1 className="font-display truncate text-3xl font-bold text-white">Access Portal</h1>
              <p className="text-sm text-slate-300">{schoolDisplayName}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Tab active={panel === "signin"} onClick={() => setPanel("signin")}>Sign in</Tab>
            <Tab active={panel === "signup"} onClick={() => setPanel("signup")}>Create account</Tab>
            <Tab active={panel === "reset"} onClick={() => setPanel("reset")}>Password</Tab>
          </div>
          {showInstall && (
            <Button
              type="button"
              variant="outline"
              className="mt-3 hidden w-full border-cyan-300/25 bg-white/[0.05] text-cyan-50 md:inline-flex"
              onClick={() => install().then((accepted) => {
                setMessage(accepted
                  ? "KCS EduPlanner is now installed."
                  : "Use the installation icon in your browser address bar if the prompt is not available yet.");
              })}
            >
              <Download size={17} /> Install App
            </Button>
          )}
        </div>

        <div className="p-6 sm:p-7">
          {loading && <p className="rounded-md border border-cyan-300/20 bg-cyan-500/10 px-3 py-2 text-sm font-bold text-cyan-50">Loading secure session...</p>}
          {cloudAuthService.configurationError && <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive">{cloudAuthService.configurationError}</p>}
          {authMode === "cloud" && panel === "signin" && (
            <p className="mb-4 rounded-md border border-cyan-300/20 bg-cyan-500/10 px-3 py-2 text-sm font-bold text-cyan-50">
              KCS institutional access is active. Teachers may use their ecosystem email or access code. Existing Supabase accounts remain available and keep all previous lesson plans.
            </p>
          )}
          {message && <p className="mb-4 rounded-md border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-100">{message}</p>}
          {error && <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive">{error}</p>}

          {panel === "signin" && (
            <form className="space-y-4" onSubmit={submitSignin}>
              <AuthField label="KCS email or institutional code" icon={<Mail size={16} strokeWidth={2.5} />}>
                {authMode === "local" ? (
                  <Select className="border-cyan-300/20 bg-[#030d14]/85 pl-10 text-cyan-50" value={email} onChange={(event) => setEmail(event.target.value)}>
                    {activeUsers.map((user) => (
                      <option key={user.id} value={user.email}>{user.name} - {roleLabels[user.role]}</option>
                    ))}
                  </Select>
                ) : (
                  <Input required autoComplete="username" className="border-cyan-300/20 bg-[#030d14]/85 pl-10 text-cyan-50" type="text" value={email} onChange={(event) => setEmail(event.target.value)} />
                )}
              </AuthField>

              <AuthField label="Password" icon={<LockKeyhole size={16} strokeWidth={2.5} />}>
                <Input required className="border-cyan-300/20 bg-[#030d14]/85 pl-10 pr-11 text-cyan-50" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} />
                <button type="button" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-cyan-200 hover:bg-cyan-500/15 hover:text-white" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </AuthField>

              {authMode === "local" && <p className="text-xs text-cyan-100/80">Temporary local access: demo password {mockAuthService.demoPassword}</p>}
              {selectedUser && <AccountSummary user={selectedUser} />}
              <Button className="w-full" type="submit" disabled={busy || loading}>
                {busy ? <LoadingSpinner /> : <UserRoundCheck size={18} />}
                {busy ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          )}

          {panel === "signup" && (
            <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={submitSignup} autoComplete="off">
              <Field label="Full name"><Input required autoComplete="new-password" value={signup.name} onChange={(event) => patchSignup("name", event.target.value)} /></Field>
              <Field label="Email"><Input required autoComplete="new-password" type="email" value={signup.email} onChange={(event) => patchSignup("email", event.target.value)} /></Field>
              <Field label="Password">
                <div className="relative">
                  <Input required minLength={6} autoComplete="new-password" className="pr-11" type={showSignupPassword ? "text" : "password"} value={signup.password} onChange={(event) => patchSignup("password", event.target.value)} />
                  <button type="button" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-cyan-200 hover:bg-cyan-500/15 hover:text-white" onClick={() => setShowSignupPassword((value) => !value)} aria-label={showSignupPassword ? "Hide password" : "Show password"}>
                    {showSignupPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </Field>
              <Field label="Role">
                <Select value={signup.role} onChange={(event) => patchSignup("role", event.target.value as UserRole)}>
                  {Object.entries(roleLabels).map(([role, label]) => <option key={role} value={role}>{label}</option>)}
                </Select>
              </Field>
              <Field label="Department">
                <Select value={signup.department} onChange={(event) => patchSignup("department", event.target.value)}>
                  <option value="">Select department</option>
                  {departmentOptions.map((department) => <option key={department} value={department}>{department}</option>)}
                </Select>
              </Field>
              <ChoiceField label="Subjects" options={subjectOptions} values={signup.subjects} onChange={(subjects) => patchSignup("subjects", subjects)} />
              <ChoiceField label="Grade classes" options={gradeOptions} values={signup.gradeClasses} onChange={(gradeClasses) => patchSignup("gradeClasses", gradeClasses)} />
              <div className="flex items-end">
                <Button className="w-full" type="submit" disabled={busy || loading}>
                  {busy ? <LoadingSpinner /> : <UserPlus size={18} />}
                  {busy ? "Creating account..." : "Create account"}
                </Button>
              </div>
              <p className="md:col-span-2 text-sm text-cyan-100/80">
                New accounts start inactive. An administrator, principal, or vice principal activates the profile before access. If online signup is temporarily limited, ask a school authority to create or activate the account.
              </p>
            </form>
          )}

          {panel === "reset" && (
            <form className="space-y-4" onSubmit={submitReset}>
              <AuthField label="Account email" icon={<Mail size={16} strokeWidth={2.5} />}>
                <Input required className="border-cyan-300/20 bg-[#030d14]/85 pl-10 text-cyan-50" type="email" value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} />
              </AuthField>
              <Button className="w-full" type="submit" disabled={busy}>
                {busy ? <LoadingSpinner /> : <RotateCcw size={18} />}
                {busy ? "Sending recovery..." : "Recover password"}
              </Button>
            </form>
          )}

          {panel === "new-password" && (
            <form className="space-y-4" onSubmit={submitNewPassword}>
              <AuthField label="New password" icon={<LockKeyhole size={16} strokeWidth={2.5} />}>
                <Input required minLength={6} className="border-cyan-300/20 bg-[#030d14]/85 pl-10 pr-11 text-cyan-50" type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                <button type="button" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-cyan-200 hover:bg-cyan-500/15 hover:text-white" onClick={() => setShowNewPassword((value) => !value)} aria-label={showNewPassword ? "Hide password" : "Show password"}>
                  {showNewPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </AuthField>
              <Button className="w-full" type="submit" disabled={busy}>
                {busy ? <LoadingSpinner /> : <RotateCcw size={18} />}
                {busy ? "Updating password..." : "Set new password"}
              </Button>
            </form>
          )}

          {pendingUsers.length > 0 && (
            <p className="mt-5 rounded-md border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100">
              Pending activation: {pendingUsers.length} account{pendingUsers.length > 1 ? "s" : ""}.
            </p>
          )}
        </div>
      </Card>
    </main>
  );
};

const getRecoveryAccessToken = () => {
  return getRecoveryParam("access_token");
};

const getRecoveryTemporaryPassword = () => {
  return getRecoveryParam("temporary_password");
};

const Tab = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button type="button" className={`rounded-md border px-3 py-2 text-sm font-black ${active ? "border-cyan-200 bg-cyan-300/20 text-white" : "border-cyan-300/15 bg-white/[0.04] text-cyan-100 hover:bg-cyan-500/15"}`} onClick={onClick}>
    {children}
  </button>
);

const AuthField = ({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="space-y-1">
    <Label className="font-mono text-cyan-50">{label}</Label>
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 z-10 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-sm bg-cyan-300/10 text-[#9cecff] shadow-[0_0_12px_rgba(156,236,255,0.22)]">
        {icon}
      </span>
      {children}
    </div>
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="space-y-1">
    <span className="font-mono text-sm font-bold text-cyan-50">{label}</span>
    {children}
  </label>
);

const ChoiceField = ({ label, options, values, onChange }: { label: string; options: string[]; values: string[]; onChange: (values: string[]) => void }) => (
  <div className="space-y-1 md:col-span-2">
    <span className="font-mono text-sm font-bold text-cyan-50">{label}</span>
    <div className="grid max-h-40 gap-2 overflow-auto rounded-md border border-cyan-300/20 bg-[#030d14]/85 p-2 sm:grid-cols-2 md:grid-cols-3">
      {options.map((option) => {
        const checked = values.includes(option);
        return (
          <label key={option} className={`flex min-h-9 items-center gap-2 rounded-md border px-2 text-sm font-bold ${checked ? "border-cyan-200 bg-cyan-300/15 text-white" : "border-cyan-300/10 bg-white/[0.03] text-cyan-100"}`}>
            <input
              type="checkbox"
              className="h-4 w-4 accent-cyan-300"
              checked={checked}
              onChange={(event) => onChange(event.target.checked ? [...values, option] : values.filter((value) => value !== option))}
            />
            <span>{option}</span>
          </label>
        );
      })}
    </div>
  </div>
);

const LoadingSpinner = () => (
  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
);

const AccountSummary = ({ user }: { user: { role: UserRole; department: string; subjects: string[] } }) => (
  <div className="rounded-md border border-cyan-300/20 bg-cyan-500/10 px-3 py-3 text-sm">
    <p className="font-display flex items-center gap-2 font-bold text-cyan-50"><ShieldCheck size={16} /> {roleLabels[user.role]}</p>
    <p className="mt-1 text-cyan-100/80">{user.department} - {user.subjects.length ? user.subjects.join(", ") : "Institutional access"}</p>
  </div>
);
