import {useNexusDashboardPhoto} from "../hooks/useNexusDashboardPhoto";
import {eduplannerNexusReturn} from "../utils/nexusReturn";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { FormEvent, useState, useEffect } from "react";
import { Menu, X, BookOpen, LayoutDashboard, ArrowLeft, CalendarDays, Download, Eye, EyeOff, FileText, Languages, LogOut, Mail, MessageSquare, Moon, Plus, Search, ShieldCheck, Sun, UserRound } from "lucide-react";
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
  const [fromAcademy] = useState(()=>{try{if(new URL(window.location.href).searchParams.get('from')==='academy')sessionStorage.setItem('kcs-planner-origin','academy');return sessionStorage.getItem('kcs-planner-origin')==='academy'}catch{return false}});
  const { dark, toggleDark, language, setLanguage, imageUrl } = useApp();
  const { currentUser, signOut, can, changePassword, changeEmail, updateProfile } = useAuth();
  const { createLesson } = useLessons();
  const { showInstall, install } = usePwaInstall();
  const { notify } = useToast();
  const navigate = useNavigate();
  const location=useLocation();
  const [menuOpen,setMenuOpen]=useState(false);
  const [compactMenu,setCompactMenu]=useState(()=>{try{return localStorage.getItem("eduplanner:compact-navigation:v1")==="1"}catch{return false}});
  const [mobileNavigation,setMobileNavigation]=useState(()=>window.matchMedia("(max-width:767px)").matches);
  const {photoUrl:dashboardPhoto,linked:photoFromNexus}=useNexusDashboardPhoto(currentUser);
  useEffect(()=>{const media=window.matchMedia("(max-width:767px)");const change=()=>{setMobileNavigation(media.matches);setMenuOpen(false)};media.addEventListener("change",change);return()=>media.removeEventListener("change",change)},[]);
  const toggleNavigation=()=>{if(mobileNavigation)setMenuOpen(v=>!v);else setCompactMenu(value=>{const next=!value;try{localStorage.setItem("eduplanner:compact-navigation:v1",next?"1":"0")}catch{}return next})};
  useEffect(()=>{
    if(!menuOpen||!window.matchMedia("(max-width:767px)").matches)return;
    const prior=document.activeElement as HTMLElement|null,bodyOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
    const drawer=document.getElementById("eduplanner-navigation"),focusable=()=>Array.from(drawer?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select')||[]).filter(el=>el.getClientRects().length>0);
    const frame=requestAnimationFrame(()=>focusable()[0]?.focus());
    const key=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.preventDefault();setMenuOpen(false)}if(event.key==="Tab"){const items=focusable(),first=items[0],last=items[items.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}};
    window.addEventListener("keydown",key);return()=>{cancelAnimationFrame(frame);window.removeEventListener("keydown",key);document.body.style.overflow=bodyOverflow;if(prior?.isConnected)prior.focus()}
  },[menuOpen]);

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

  const fr=language==="fr",tr=(en:string,frText:string)=>fr?frText:en;
  const links=[{to:"/",label:tr("Overview","Vue d’ensemble"),Icon:LayoutDashboard},{to:"/plans",label:tr("Lesson plans","Préparations"),Icon:FileText},...(can("curriculum:read")?[{to:"/curriculum",label:tr("Curriculum","Programme"),Icon:BookOpen}]:[]),{to:"/messages",label:tr("Messages","Messages"),Icon:MessageSquare}];
  const current=links.find(link=>link.to==="/"?location.pathname==="/":location.pathname.startsWith(link.to))||links[1];
  return (
    <div className="ep-shell" data-collapsed={compactMenu} data-eduplanner-workspace>
      {menuOpen&&<button type="button" className="ep-nav-scrim" aria-label={tr("Close navigation","Fermer la navigation")} onClick={()=>setMenuOpen(false)}/>}
      <aside id="eduplanner-navigation" className="ep-sidebar" data-open={menuOpen} role={mobileNavigation&&menuOpen?"dialog":undefined} aria-modal={mobileNavigation&&menuOpen?true:undefined} aria-label={tr("Eduplanner navigation","Navigation Eduplanner")}>
        <NavLink to="/" className="ep-brand" onClick={()=>setMenuOpen(false)}><img src={imageUrl} alt="KCS"/><span><small>KCS ORBIT ECOSYSTEM</small><strong>Eduplanner<span>{tr("Teaching, thoughtfully.","Enseigner avec intention.")}</span></strong></span></NavLink>
        <button type="button" className="ep-drawer-close" aria-label={tr("Close navigation","Fermer la navigation")} onClick={()=>setMenuOpen(false)}><X size={19}/></button>
        <p className="ep-nav-caption">{tr("YOUR WORKSPACE","VOTRE ESPACE")}</p>
        <nav aria-label={tr("Main navigation","Navigation principale")}>{links.map(({to,label,Icon})=><NavLink key={to} to={to} end={to==="/"} onClick={()=>setMenuOpen(false)} title={label} aria-label={label} className={({isActive})=>isActive?"ep-nav-link is-active":"ep-nav-link"}><Icon size={19}/><span>{label}</span></NavLink>)}</nav>
        {canCreateLessons&&<Button className="ep-create" title={tr("New lesson plan","Nouvelle préparation")} aria-label={tr("New lesson plan","Nouvelle préparation")} onClick={()=>{const lesson=createLesson();setMenuOpen(false);navigate("/editor/"+lesson.id)}}><Plus size={18}/><span>{tr("New lesson plan","Nouvelle préparation")}</span></Button>}
        <div className="ep-sidebar-note"><BookOpen size={22}/><strong>{tr("Every lesson, a step forward.","Chaque leçon, un pas de plus.")}</strong><p>{tr("Plan, review and share your teaching in one place.","Préparez, révisez et partagez votre enseignement au même endroit.")}</p></div>
        <div className="ep-sidebar-footer"><a aria-label={tr("Back to Nexus AI","Retour à Nexus AI")} title={tr("Back to Nexus AI","Retour à Nexus AI")} href={eduplannerNexusReturn(currentUser.role)} data-nexus-return><ArrowLeft size={16}/><span>{tr("Back to Nexus AI","Retour à Nexus AI")}</span></a>{fromAcademy&&<a href="https://academy.kinshasachristianschool.org" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground hover:bg-accent"><BookOpen className="h-4 w-4"/>{language==='fr'?'Retour à Academy':'Back to Academy'}</a>}{showInstall&&<button type="button" aria-label={tr("Install app","Installer l’application")} title={tr("Install app","Installer l’application")} onClick={()=>void install().then(ok=>notify(ok?tr("Eduplanner installed","Eduplanner installé"):tr("Use your browser’s installation menu.","Utilisez le menu d’installation du navigateur.")))}><Download size={16}/><span>{tr("Install app","Installer l’application")}</span></button>}<button type="button" aria-label={tr("Sign out","Déconnexion")} title={tr("Sign out","Déconnexion")} onClick={()=>{signOut().finally(()=>navigate("/login",{replace:true}))}}><LogOut size={16}/><span>{tr("Sign out","Déconnexion")}</span></button></div>
      </aside>
      <div className="ep-body">
        <header className="ep-topbar">
          <button type="button" className="ep-menu-button" aria-expanded={mobileNavigation?menuOpen:!compactMenu} aria-controls="eduplanner-navigation" aria-label={mobileNavigation?tr("Open navigation","Ouvrir la navigation"):compactMenu?tr("Expand navigation","Développer la navigation"):tr("Collapse navigation","Réduire la navigation")} onClick={toggleNavigation}><Menu size={21}/></button>
          <div className="ep-context"><small>EDUPLANNER <span>/ KCS</span></small><h1>{current.label}</h1></div>
          <div className="ep-toolbar"><button type="button" className="ep-search" onClick={()=>navigate("/plans?focus=search")}><Search size={17}/><span>{tr("Find a lesson…","Rechercher une préparation…")}</span><kbd>⌕</kbd></button>
            <button type="button" aria-label={tr("Change language","Changer la langue")} onClick={toggleLanguage} className="ep-icon-button"><Languages size={17}/><b>{language==="en"?"FR":"EN"}</b></button>
            <button type="button" aria-label={tr("Change theme","Changer de thème")} onClick={toggleDark} className="ep-icon-button">{dark?<Sun size={18}/>:<Moon size={18}/>}</button>
            <button type="button" className="ep-profile" aria-label={tr("Account security","Sécurité du compte")} onClick={openAccount}>{dashboardPhoto?<img src={dashboardPhoto} alt=""/>:<span><UserRound size={19}/></span>}<div><strong>{currentUser.name}</strong><small>{roleLabels[currentUser.role]}</small></div><ShieldCheck size={16}/></button>
          </div>
        </header>
        <main className="ep-main"><Outlet/></main>
        <footer className="ep-footer"><span>KCS ORBIT · EDUPLANNER</span><span>{tr("Designed for purposeful teaching.","Au service d’un enseignement réfléchi.")}</span></footer>
      </div>
      <Dialog open={accountOpen} title="Account Security" onClose={() => setAccountOpen(false)}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-cyan-300/20 bg-card/80 p-4 lg:col-span-2">
            <h3 className="flex items-center gap-2 text-sm font-black text-foreground"><UserRound size={16} /> Profile Photo</h3>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {dashboardPhoto ? <img src={dashboardPhoto} alt="" className="h-16 w-16 rounded-full object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-full border border-cyan-300/20 bg-white/[0.06]"><UserRound size={26} /></div>}
              {!photoFromNexus&&<label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-cyan-300/25 bg-white/[0.06] px-4 text-sm font-bold text-foreground hover:bg-cyan-500/15">
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
              </label>}
              {photoFromNexus&&<p className="ep-portrait-sync">{tr("Personal dashboard photo synchronized from Nexus AI. Manage it in your Nexus settings; the official school portrait stays separate.","Photo personnelle synchronisée depuis Nexus AI. Gérez-la dans vos paramètres Nexus ; la photo officielle de l’école reste indépendante.")}</p>}
              {!photoFromNexus&&currentUser.photoUrl && <Button variant="outline" onClick={() => updateProfile({ ...currentUser, photoUrl: "" })}>Remove photo</Button>}
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
