import {useDashboardPortrait} from '../useDashboardPortrait'
import { uiText } from "../uiText";
import {createPortal}from"react-dom";
import { KeyRound, ShieldCheck, Eye, EyeOff, X, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { LanguageSwitch } from "./LanguageSwitch";
import { FontSwitch } from "./FontSwitch";
import { schoolBranding } from "../config/branding";
import { useI18n } from "../i18n";
import { api } from "../services/api";
import { useAuthStore } from "../store/auth";
import { useUiStore } from "../store/ui";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

function imageFileToAvatar(file: File, lang: "fr" | "en"): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error(lang === "fr" ? "Veuillez choisir une image valide." : "Please choose a valid image."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const size = 360;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error(lang === "fr" ? "Image non lisible." : "Unable to read the image."));
          return;
        }
        const minSide = Math.min(image.width, image.height);
        const sx = (image.width - minSide) / 2;
        const sy = (image.height - minSide) / 2;
        ctx.drawImage(image, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      image.onerror = () => reject(new Error(lang === "fr" ? "Image non lisible." : "Unable to read the image."));
      image.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error(lang === "fr" ? "Image non lisible." : "Unable to read the image."));
    reader.readAsDataURL(file);
  });
}

function ChangePasswordModal({ onClose, onChanged, temporaryPassword = false }: { onClose: () => void; onChanged?: () => void; temporaryPassword?: boolean }) {
  const { t, lang } = useI18n();
  const L = (fr: string, en: string) => lang === "fr" ? fr : en;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const titleId=useId(),panel=useRef<HTMLFormElement>(null),[visible,setVisible]=useState<Record<string,boolean>>({});
  const closeRef=useRef(onClose),savingRef=useRef(saving);closeRef.current=onClose;savingRef.current=saving;
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;document.body.style.overflow='hidden';panel.current?.querySelector<HTMLInputElement>('input')?.focus();
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!savingRef.current){event.preventDefault();closeRef.current()}if(event.key==='Tab'){const items=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')||[]).filter(el=>el.getClientRects().length);const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}};document.addEventListener('keydown',key);
    return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);previous?.focus()};
  },[]);
  const passwordField=(name:string,label:string,value:string,change:(next:string)=>void,autocomplete:string)=><label className="edupay-password-field"><span>{label}</span><div><KeyRound size={17} aria-hidden="true"/><input required name={name} type={visible[name]?'text':'password'} autoComplete={autocomplete} value={value} disabled={saving} onChange={event=>change(event.target.value)}/><button type="button" disabled={saving} aria-label={visible[name]?L('Masquer le mot de passe','Hide password'):L('Afficher le mot de passe','Show password')} aria-pressed={Boolean(visible[name])} onClick={()=>setVisible(all=>({...all,[name]:!all[name]}))}>{visible[name]?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>;


  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (newPassword.length < 8) {
      setError(t("passwordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }
    setSaving(true);
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword })
      });
      setMessage(t("passwordChanged"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("passwordChangeFailed"));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="edupay-password-overlay" onClick={()=>{if(!saving)onClose()}}>
      <form ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={submit} className="edupay-password-panel" onClick={event=>event.stopPropagation()}>
        <header><span className="edupay-password-icon"><ShieldCheck size={27}/></span><div><p>KCS EDUPAY · {L('ACCÈS PERSONNEL','PERSONAL ACCESS')}</p><h3 id={titleId}>{t('changePasswordTitle')}</h3></div><button type="button" disabled={saving} className="edupay-password-close" onClick={onClose} aria-label={t('close')}><X size={20}/></button></header>
        <div className="edupay-password-body"><p className="edupay-password-intro">{temporaryPassword?L('Remplacez votre mot de passe temporaire pour sécuriser votre accès personnel.','Replace your temporary password to secure your personal access.'):L('Définissez un nouveau mot de passe pour votre compte EduPay. Les autres applications conservent leurs propres accès.','Set a new password for your EduPay account. Other applications keep their own credentials.')}</p>
          {passwordField('currentPassword',t('currentPassword'),currentPassword,setCurrentPassword,'current-password')}
          {passwordField('newPassword',t('newPasswordField'),newPassword,setNewPassword,'new-password')}
          {passwordField('confirmPassword',t('confirmNewPassword'),confirmPassword,setConfirmPassword,'new-password')}
          <small className="edupay-password-hint">{L('Utilisez un mot de passe personnel et difficile à deviner. Le serveur vérifie les règles de sécurité avant confirmation.','Use a personal password that is difficult to guess. The server checks security requirements before confirming the change.')}</small>
          {error&&<p role="alert" className="edupay-password-error">{uiText(error)}</p>}{message&&<p role="status" className="edupay-password-success">{message}</p>}
        </div>
        <footer><button type="button" disabled={saving} onClick={onClose}>{t('close')}</button><button disabled={saving} className="btn-primary">{saving?t('pmSaving'):t('pmSave')}</button></footer>
      </form>
    </div>,document.body
  );
}

export function Navbar() {
  const { t, lang } = useI18n();
  const L = (fr: string, en: string) => lang === "fr" ? fr : en;
  const { token,fullName, role, mustChangePassword, setPhotoUrl, setMustChangePassword, logout } = useAuthStore();
  const personalPortrait=useDashboardPortrait(token,()=>api<{image:string|null}>('/api/auth/personal-portrait'));
  const isDesktopSidebarOpen = useUiStore((s) => s.isDesktopSidebarOpen);
  const isMobileNavOpen = useUiStore((s) => s.isMobileNavOpen);
  const toggleDesktopSidebar = useUiStore((s) => s.toggleDesktopSidebar);
  const toggleMobileNav = useUiStore((s) => s.toggleMobileNav);
  const hasDeferredPasswordReminder = mustChangePassword && role === "PARENT";
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isUserMenuOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && userMenuRef.current?.contains(target)) return;
      setIsUserMenuOpen(false);
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsUserMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isUserMenuOpen]);

  const updatePhoto = async (file?: File) => {
    if (!file) return;
    setPhotoError("");
    try {
      const nextPhotoUrl = await imageFileToAvatar(file, lang);
      await api('/api/auth/personal-portrait',{method:'PUT',body:JSON.stringify({image:nextPhotoUrl})});
      window.dispatchEvent(new Event('kcs:personal-portrait-changed'));
      setPhotoUrl(nextPhotoUrl);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : t("profilePhotoFailed"));
    }
  };

  const removePhoto = async () => {
    setPhotoError("");
    try {
      await api('/api/auth/personal-portrait',{method:'PUT',body:JSON.stringify({image:''})});
      window.dispatchEvent(new Event('kcs:personal-portrait-changed'));
      setPhotoUrl(null);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : t("profilePhotoFailed"));
    }
  };

  return (
    <header data-edupay-renewal-header className="sticky top-0 z-50 bg-[linear-gradient(180deg,rgba(2,6,23,0.92),rgba(5,16,24,0.78))] shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
      {showPasswordModal && <ChangePasswordModal temporaryPassword={mustChangePassword} onChanged={() => {
        setMustChangePassword(false);
        setShowPasswordModal(false);
      }} onClose={() => setShowPasswordModal(false)} />}
      <div className="relative w-full px-3 py-2.5 sm:px-5 sm:py-3 lg:px-6 xl:px-8">
        <div className="flex items-center justify-between gap-2 rounded-[2rem] bg-white/[0.04] px-2.5 py-2 shadow-[0_20px_45px_rgba(2,6,23,0.18)] sm:px-3">
          {/* Logo Section */}
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <button
              type="button"
              data-kcs-no-processing="true" onClick={toggleMobileNav}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-brand-300/20 bg-white/[0.07] text-brand-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition-all duration-200 hover:border-brand-300/40 hover:bg-brand-500/10 lg:hidden"
              aria-label={isMobileNavOpen ? L("Masquer la navigation mobile", "Hide mobile navigation") : L("Afficher la navigation mobile", "Show mobile navigation")}
              title={isMobileNavOpen ? L("Masquer la navigation", "Hide navigation") : L("Afficher la navigation", "Show navigation")}
            >
              {isMobileNavOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
            <button
              type="button"
              data-kcs-no-processing="true" onClick={toggleDesktopSidebar}
              className="hidden h-10 w-10 items-center justify-center rounded-2xl border border-brand-300/20 bg-white/[0.07] text-brand-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition-all duration-200 hover:border-brand-300/40 hover:bg-brand-500/10 lg:inline-flex"
              aria-label={isDesktopSidebarOpen ? L("Masquer la navigation latérale", "Hide sidebar navigation") : L("Afficher la navigation latérale", "Show sidebar navigation")}
              title={isDesktopSidebarOpen ? L("Masquer la navigation", "Hide navigation") : L("Afficher la navigation", "Show navigation")}
            >
              {isDesktopSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
            <div className="relative">
              <div className="absolute -inset-1 rounded-full bg-brand-300/20 blur-md" />
              <img 
                src={schoolBranding.logoSrc} 
                alt={`Logo ${schoolBranding.schoolName}`} 
                className="relative h-11 w-11 rounded-full border border-white/25 bg-white p-1 shadow-glow transition-all duration-200 hover:scale-105" 
              />
            </div>
            <div className="ep-header-brand-label">
              <p className="font-display text-base font-semibold leading-tight text-white">{schoolBranding.appName}</p>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-300/95">{schoolBranding.shortName} - {L("Excellence", "Excellence")}</p>
            </div>
          </div>

          {/* Center - Branding */}
          <div className="mx-8 hidden flex-1 items-center justify-center md:flex">
            <div className="text-center">
              <p className="rounded-full border border-brand-300/20 bg-[linear-gradient(135deg,rgba(125,232,255,0.09),rgba(255,255,255,0.05))] px-5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_10px_30px_rgba(20,184,222,0.08)]">
                {schoolBranding.schoolName}
              </p>
            </div>
          </div>

          {/* Right Section */}
          <div data-edupay-header-actions className="flex min-w-0 items-center gap-1.5 sm:gap-3">
            <div className="hidden items-center gap-3 lg:flex">
              <FontSwitch />
              <LanguageSwitch />
            </div>

            {/* User Menu */}
            <div className="relative z-[70]" ref={userMenuRef}>
              <button
                data-kcs-no-processing="true" onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                aria-label={L("Ouvrir mon profil et les préférences", "Open my profile and preferences")}
                aria-expanded={isUserMenuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-full border border-brand-300/20 bg-white/[0.07] px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition-all duration-200 hover:border-brand-300/40 hover:bg-brand-500/10 sm:gap-3 sm:px-3"
              >
                {hasDeferredPasswordReminder && <span className="h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.9)]" aria-hidden="true" />}
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-semibold text-white">{fullName || t("user")}</p>
                  <p className="text-xs text-ink-dim capitalize">{role || t("guest")}</p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-white via-brand-200 to-brand-500 text-sm font-bold text-slate-950 ring-1 ring-white/30">
                  {personalPortrait ? (
                    <img src={personalPortrait||undefined} alt={fullName || t("user")} className="h-full w-full object-cover" />
                  ) : (
                    (fullName || t("user")).charAt(0).toUpperCase()
                  )}
                </div>
              </button>

              {/* Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="glass absolute right-0 top-full z-[90] mt-2 w-[min(92vw,15rem)] overflow-hidden rounded-2xl py-2 shadow-2xl animate-fadeInDown sm:w-60">
                  <div className="px-4 py-3 border-b border-brand-300/15">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-200 to-brand-500 text-sm font-bold text-slate-950">
                        {personalPortrait ? (
                          <img src={personalPortrait||undefined} alt={fullName || t("user")} className="h-full w-full object-cover" />
                        ) : (
                          (fullName || t("user")).charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{fullName || t("user")}</p>
                        <p className="text-xs text-ink-dim">{role || t("guest")}</p>
                      </div>
                    </div>
                    {hasDeferredPasswordReminder && (
                      <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-medium text-amber-100">
                        {L("Mot de passe temporaire détecté. Vous pouvez le changer maintenant ou plus tard depuis ce menu.", "Temporary password detected. You can change it now or later from this menu.")}
                      </p>
                    )}
                    {photoError && <p className="mt-2 text-xs text-danger">{uiText(photoError)}</p>}
                  </div>
                  <div className="ep-profile-preferences flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3 lg:hidden"><FontSwitch/><LanguageSwitch/></div>
                  <label className="block w-full cursor-pointer px-4 py-2 text-sm text-ink-dim transition-all duration-200 hover:bg-brand-500/10 hover:text-white">
                    {personalPortrait ? t("changeProfilePhoto") : t("addProfilePhoto")}
                    <input type="file" accept="image/*" className="hidden" onChange={(event) => void updatePhoto(event.target.files?.[0])} />
                  </label>
                  {personalPortrait && (
                    <button
                      onClick={() => void removePhoto()}
                      className="w-full text-left px-4 py-2 text-sm text-ink-dim transition-all duration-200 hover:bg-brand-500/10 hover:text-white"
                    >
                      {t("removeProfilePhoto")}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowPasswordModal(true);
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-ink-dim transition-all duration-200 hover:bg-brand-500/10 hover:text-white"
                  >
                    {t("changePassword")}{hasDeferredPasswordReminder ? L(" · recommandé", " · recommended") : ""}
                  </button>
                  <button
                    onClick={() => {
                      logout();
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-ink-dim transition-all duration-200 hover:bg-brand-500/10 hover:text-danger"
                  >
                    {t("logout")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="ep-old-mobile-preferences mt-2 flex items-center justify-end gap-2 rounded-xl border border-brand-300/15 bg-white/[0.04] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] lg:hidden">
          <FontSwitch />
          <LanguageSwitch />
        </div>
      </div>
    </header>
  );
}
