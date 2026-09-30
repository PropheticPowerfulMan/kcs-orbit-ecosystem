import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { FormEvent, useState } from "react";
import { CalendarDays, Download, Eye, EyeOff, FileText, Languages, LogOut, Mail, MessageSquare, Moon, Plus, Search, ShieldCheck, Sun, UserRound } from "lucide-react";
import { useApp } from "../contexts/AppContext";
import { useAuth } from "../contexts/AuthContext";
import { useLessons } from "../hooks/useLessons";
import { usePwaInstall } from "../hooks/usePwaInstall";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useToast } from "../components/Toast";
import { schoolDisplayName } from "../data/defaults";
import { roleLabels } from "../types/user";

export const AppLayout = () => {
  const { dark, toggleDark, language, setLanguage, imageUrl } = useApp();
  const { currentUser, signOut, can, changePassword, changeEmail, updateProfile } = useAuth();
  const { createLesson } = useLessons();
  const { showInstall, install } = usePwaInstall();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nextEmail, setNextEmail] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");
  const [accountError, setAccountError] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState({ current: false, next: false, confirm: false, emailCurrent: false });
  const canCreateLessons = can("lesson:create");
  if (!currentUser) return null;

  const resetAccountForm = () => {
    setCurrentPassword("");
    setNextPassword("");
    setConfirmPassword("");
    setNextEmail(currentUser.email);
    setAccountMessage("");
    setAccountError("");
    setVisiblePasswords({ current: false, next: false, confirm: false, emailCurrent: false });
  };

  const openAccount = () => {
    resetAccountForm();
    setAccountOpen(true);
  };

  const submitPasswordChange = async (event: FormEvent) => {
    event.preventDefault();
    if (accountBusy) return;
    setAccountError("");
    setAccountMessage("");
    if (nextPassword !== confirmPassword) {
      setAccountError("The new password confirmation does not match.");
      return;
    }
    setAccountBusy(true);
    try {
      await changePassword(currentPassword, nextPassword);
      setCurrentPassword("");
      setNextPassword("");
      setConfirmPassword("");
      setAccountMessage("Password updated successfully.");
      notify("Password updated");
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Unable to update password.");
    } finally {
      setAccountBusy(false);
    }
  };

  const submitEmailChange = async (event: FormEvent) => {
    event.preventDefault();
    if (accountBusy) return;
    setAccountError("");
    setAccountMessage("");
    setAccountBusy(true);
    try {
      await changeEmail(nextEmail, currentPassword);
      notify("Email change requested. Please sign in again.");
      navigate("/login", { replace: true });
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Unable to update email.");
    } finally {
      setAccountBusy(false);
    }
  };

  const toggleLanguage = () => {
    const next = language === "en" ? "fr" : "en";
    setLanguage(next);
    notify(next === "fr" ? "Langue changée : français" : "Language changed: English");
  };

  return (
    <div className="flex min-h-screen flex-col bg-transparent text-foreground">
      <header className="sticky top-2 z-30 mx-2 mt-2 rounded-lg glass sm:top-3 sm:mx-3 sm:mt-3">
        <div className="mx-auto flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4 lg:flex-nowrap lg:px-6">
          <NavLink to="/" className="flex min-w-0 flex-1 items-center gap-3 lg:flex-none">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-cyan-300/25 bg-white/95 p-1 shadow-[0_0_28px_rgba(20,184,222,0.18)]">
              <img src={imageUrl} alt="KCS identity" className="h-full w-full rounded-sm object-cover" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-black uppercase text-cyan-200">EduPlanner KCS</p>
              <p className="truncate text-sm font-black text-white sm:text-base">{schoolDisplayName} Lesson Planner</p>
            </div>
          </NavLink>
          <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto md:order-none md:w-auto">
            <NavLink to="/" className={({ isActive }) => `rounded-md px-3 py-2 text-sm font-bold ${isActive ? "border border-primary/30 bg-primary/15 text-foreground dark:border-cyan-300/25 dark:bg-cyan-500/15 dark:text-cyan-100" : "text-muted-foreground hover:bg-primary/10 hover:text-foreground dark:hover:bg-white/10 dark:hover:text-white"}`}>
              Dashboard
            </NavLink>
            <NavLink to="/plans" className={({ isActive }) => `rounded-md px-3 py-2 text-sm font-bold ${isActive ? "border border-primary/30 bg-primary/15 text-foreground dark:border-cyan-300/25 dark:bg-cyan-500/15 dark:text-cyan-100" : "text-muted-foreground hover:bg-primary/10 hover:text-foreground dark:hover:bg-white/10 dark:hover:text-white"}`}>
              Plans
            </NavLink>
            {can("curriculum:read") && (
              <NavLink to="/curriculum" className={({ isActive }) => `rounded-md px-3 py-2 text-sm font-bold ${isActive ? "border border-primary/30 bg-primary/15 text-foreground dark:border-cyan-300/25 dark:bg-cyan-500/15 dark:text-cyan-100" : "text-muted-foreground hover:bg-primary/10 hover:text-foreground dark:hover:bg-white/10 dark:hover:text-white"}`}>
                Curriculum
              </NavLink>
            )}
            <NavLink to="/messages" className={({ isActive }) => `rounded-md px-3 py-2 text-sm font-bold ${isActive ? "border border-primary/30 bg-primary/15 text-foreground dark:border-cyan-300/25 dark:bg-cyan-500/15 dark:text-cyan-100" : "text-muted-foreground hover:bg-primary/10 hover:text-foreground dark:hover:bg-white/10 dark:hover:text-white"}`}>
              Communication
            </NavLink>
          </nav>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            <div className="order-4 flex w-full min-w-0 items-center gap-2 rounded-md border border-border bg-card/90 px-3 py-2 shadow-sm dark:bg-[#061520]/90 sm:w-auto sm:min-w-[240px] lg:order-none">
              {currentUser.photoUrl ? <img src={currentUser.photoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" /> : <UserRound size={16} className="shrink-0 text-cyan-200" />}
              <div className="min-w-0">
                <p className="truncate text-xs font-black text-foreground">{currentUser.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{roleLabels[currentUser.role]} - {currentUser.email}</p>
              </div>
            </div>
            <Button variant="outline" className="hidden sm:inline-flex" onClick={() => navigate("/plans?focus=search")}>
              <Search size={17} /> Search
            </Button>
            {showInstall && (
              <Button
                variant="outline"
                className="hidden md:inline-flex"
                onClick={() => install().then((accepted) => {
                  notify(accepted ? "KCS EduPlanner installed" : "Use the browser installation icon or menu if the prompt is not available yet.");
                })}
              >
                <Download size={17} /> Install App
              </Button>
            )}
            {canCreateLessons && (
              <Button
                className="px-3 sm:px-4"
                onClick={() => {
                  const lesson = createLesson();
                  navigate(`/editor/${lesson.id}`);
                }}
              >
                <Plus size={17} /> <span className="hidden sm:inline">New Lesson Plan</span>
              </Button>
            )}
            <Button variant="ghost" onClick={toggleLanguage} aria-label="Toggle language" title={language === "en" ? "Switch to French" : "Passer en anglais"}>
              <Languages size={18} />
              <span className="text-xs font-black uppercase">{language === "en" ? "FR" : "EN"}</span>
            </Button>
            <Button variant="ghost" onClick={toggleDark} aria-label="Toggle theme" title={dark ? "Switch to light theme" : "Switch to dark theme"}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
            <Button variant="ghost" onClick={openAccount} aria-label="Account security" title="Account security">
              <ShieldCheck size={18} />
            </Button>
            <Button variant="ghost" onClick={() => { signOut().finally(() => navigate("/login", { replace: true })); }} aria-label="Logout">
              <LogOut size={18} />
            </Button>
          </div>
        </div>
      </header>
      <main className="min-w-0 flex-1 px-2 py-4 sm:px-5 lg:px-6 xl:px-8">
        <Outlet />
      </main>
      <footer className="mx-2 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg glass px-3 py-3 text-xs text-muted-foreground sm:mx-3 sm:mb-3 sm:px-4 lg:px-6">
        <span className="flex items-center gap-2"><FileText size={14} /> KCS Lesson Planner</span>
        <span className="hidden sm:inline">{currentUser.name} - {roleLabels[currentUser.role]}</span>
        <span className="flex items-center gap-1">
          <CalendarDays size={14} /> A4 print-ready
        </span>
      </footer>
      <Dialog open={accountOpen} title="Account Security" onClose={() => setAccountOpen(false)}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-cyan-300/20 bg-card/80 p-4 lg:col-span-2">
            <h3 className="flex items-center gap-2 text-sm font-black text-foreground"><UserRound size={16} /> Profile Photo</h3>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {currentUser.photoUrl ? <img src={currentUser.photoUrl} alt="" className="h-16 w-16 rounded-full object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-full border border-cyan-300/20 bg-white/[0.06]"><UserRound size={26} /></div>}
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-cyan-300/25 bg-white/[0.06] px-4 text-sm font-bold text-foreground hover:bg-cyan-500/15">
                <MessageSquare size={16} /> Choose photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (!file.type.startsWith("image/")) {
                      setAccountError("Choose an image file.");
                      return;
                    }
                    setAccountError("");
                    resizeProfilePhoto(file).then(async (photoUrl) => {
                      setAccountBusy(true);
                      try {
                        await updateProfile({ ...currentUser, photoUrl });
                        notify("Profile photo updated");
                      } catch (error) {
                        setAccountError(error instanceof Error ? error.message : "Unable to update profile photo.");
                      } finally {
                        setAccountBusy(false);
                        event.target.value = "";
                      }
                    }).catch(() => setAccountError("Unable to read this image."));
                  }}
                />
              </label>
              {currentUser.photoUrl && <Button variant="outline" onClick={() => updateProfile({ ...currentUser, photoUrl: "" })}>Remove photo</Button>}
            </div>
          </div>
          <div className="rounded-md border border-cyan-300/20 bg-card/80 p-4">
            <h3 className="flex items-center gap-2 text-sm font-black text-foreground"><ShieldCheck size={16} /> Change Password</h3>
            <form className="mt-3 space-y-3" onSubmit={submitPasswordChange}>
              <PasswordField label="Current password" visible={visiblePasswords.current} onToggle={() => setVisiblePasswords((value) => ({ ...value, current: !value.current }))} autoComplete="current-password" value={currentPassword} onChange={setCurrentPassword} />
              <PasswordField label="New password" visible={visiblePasswords.next} onToggle={() => setVisiblePasswords((value) => ({ ...value, next: !value.next }))} autoComplete="new-password" value={nextPassword} onChange={setNextPassword} minLength={6} />
              <PasswordField label="Confirm new password" visible={visiblePasswords.confirm} onToggle={() => setVisiblePasswords((value) => ({ ...value, confirm: !value.confirm }))} autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} minLength={6} />
              <Button className="w-full" type="submit" disabled={accountBusy}>{accountBusy ? "Updating..." : "Update Password"}</Button>
            </form>
          </div>
          <div className="rounded-md border border-cyan-300/20 bg-card/80 p-4">
            <h3 className="flex items-center gap-2 text-sm font-black text-foreground"><Mail size={16} /> Change Email</h3>
            <form className="mt-3 space-y-3" onSubmit={submitEmailChange}>
              <Field label="New email"><Input required type="email" autoComplete="email" value={nextEmail} onChange={(event) => setNextEmail(event.target.value)} /></Field>
              <PasswordField label="Current password" visible={visiblePasswords.emailCurrent} onToggle={() => setVisiblePasswords((value) => ({ ...value, emailCurrent: !value.emailCurrent }))} autoComplete="current-password" value={currentPassword} onChange={setCurrentPassword} />
              <p className="text-xs text-muted-foreground">After changing email, you may need to confirm the new address depending on Supabase email settings. You will be signed out for security.</p>
              <Button className="w-full" type="submit" disabled={accountBusy}>{accountBusy ? "Requesting..." : "Update Email"}</Button>
            </form>
          </div>
          {(accountMessage || accountError) && (
            <p className={`lg:col-span-2 rounded-md border px-3 py-2 text-sm font-bold ${accountError ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"}`}>
              {accountError || accountMessage}
            </p>
          )}
        </div>
      </Dialog>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="space-y-1">
    <Label>{label}</Label>
    {children}
  </label>
);

const resizeProfilePhoto = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read image."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Unable to load image."));
      image.onload = () => {
        const size = 256;
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Unable to prepare image."));
          return;
        }
        canvas.width = size;
        canvas.height = size;
        const scale = Math.max(size / image.width, size / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });

const PasswordField = ({
  label,
  value,
  visible,
  autoComplete,
  minLength,
  onToggle,
  onChange
}: {
  label: string;
  value: string;
  visible: boolean;
  autoComplete: string;
  minLength?: number;
  onToggle: () => void;
  onChange: (value: string) => void;
}) => (
  <Field label={label}>
    <div className="relative">
      <Input required minLength={minLength} type={visible ? "text" : "password"} autoComplete={autoComplete} className="pr-11" value={value} onChange={(event) => onChange(event.target.value)} />
      <button type="button" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-cyan-200 hover:bg-cyan-500/15 hover:text-white" onClick={onToggle} aria-label={visible ? "Hide password" : "Show password"}>
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  </Field>
);
