import { uiText } from "../uiText";
import { ArrowRight, ArrowUpRight, LockKeyhole, ReceiptText, ShieldCheck, WalletCards } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FontSwitch } from "../components/FontSwitch";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { schoolBranding } from "../config/branding";
import { useI18n } from "../i18n";
import { api } from "../services/api";
import { normalizeRole, useAuthStore } from "../store/auth";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

type ForgotStep = "form" | "sent";

function ForgotPasswordModal({ onClose, t, lang, initialResetToken = "" }: { onClose: () => void; t: (k: string) => string; lang: "fr" | "en"; initialResetToken?: string }) {
  const L = (fr: string, en: string) => lang === "fr" ? fr : en;
  const [step, setStep] = useState<ForgotStep>("form");
  const [adminRecovery, setAdminRecovery] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [recoveryChannel, setRecoveryChannel] = useState<"email" | "sms">("email");
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (initialResetToken) {
      setResetToken(initialResetToken);
      setStep("sent");
    }
  }, [initialResetToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (identifier.trim().length < 3) {
      setError("Entrez votre e-mail ou votre code d'accès.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await api<{ message?: string; resetToken?: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ identifier: identifier.trim(), channel: recoveryChannel })
      });
      if (result.resetToken) {
        setResetToken(result.resetToken);
      }
      setSuccessMessage(result.message || "Si ce compte existe, un code vient d'être envoyé.");
    } catch {
      // Even on error we show success to not leak account existence
      setSuccessMessage("Si ce compte existe, un code vient d'être envoyé.");
    } finally {
      setLoading(false);
      setStep("sent");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (identifier.trim().length < 3) {
      setError("Entrez l'e-mail ou le code d'accès du compte.");
      return;
    }
    if (resetToken.trim().length < 24) {
      setError("Entrez le code de réinitialisation reçu par e-mail.");
      return;
    }
    if (newPassword.length < 8) {
      setError(t("passwordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }
    setLoading(true);
    setError("");
    setSuccessMessage("");
    try {
      const result = await api<{ message?: string }>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ identifier: identifier.trim(), token: resetToken.trim(), newPassword })
      });
      setSuccessMessage(result.message || "Mot de passe réinitialisé. Vous pouvez vous connecter.");
      setResetToken("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de reinitialiser le mot de passe.");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !identifier.includes("@")) {
      setError(t("forgotInvalidEmail"));
      return;
    }
    if (newPassword.length < 10) {
      setError(t("adminRecoveryPasswordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }
    setLoading(true);
    setError("");
    setSuccessMessage("");
    try {
      const result = await api<{ message?: string }>("/api/auth/recover-admin-password", {
        method: "POST",
        body: JSON.stringify({
          email: identifier.trim().toLowerCase(),
          recoveryCode,
          newPassword
        })
      });
      setSuccessMessage(result.message || t("adminRecoverySuccess"));
      setRecoveryCode("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminRecoveryFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm glass rounded-2xl p-8 space-y-6 animate-fadeInUp"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-ink-dim hover:text-white transition-colors"
          aria-label={L("Fermer", "Close")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {step === "form" && !adminRecovery ? (
          <>
            <div>
              <h3 className="font-display text-xl font-bold text-white">{t("forgotTitle")}</h3>
              <p className="text-sm text-ink-dim mt-2">{t("forgotSubtitle")}</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-2" role="group" aria-label={L("Canal de récupération", "Recovery channel")}>
                <button type="button" onClick={() => setRecoveryChannel("email")} className={recoveryChannel === "email" ? "btn-primary py-2" : "rounded-lg border border-slate-600 py-2 text-sm font-semibold text-ink-dim"}>{L("E-mail", "Email")}</button>
                <button type="button" onClick={() => setRecoveryChannel("sms")} className={recoveryChannel === "sms" ? "btn-primary py-2" : "rounded-lg border border-slate-600 py-2 text-sm font-semibold text-ink-dim"}>SMS</button>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-ink-dim">{L("E-mail ou code d'accès", "Email or access code")}</label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={L("email@exemple.com ou ACC-PAR-XXXXXX", "email@example.com or ACC-PAR-XXXXXX")}
                  className="w-full"
                  autoFocus
                />
                {error && <p className="text-xs text-danger">{uiText(error)}</p>}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-3 font-semibold disabled:opacity-50"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t("forgotSending")}
                  </div>
                ) : t("forgotSend")}
              </button>
            </form>
            <button
              type="button"
              onClick={() => {
                setAdminRecovery(true);
                setError("");
                setSuccessMessage("");
              }}
              className="w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-200 hover:bg-amber-500/20"
            >
              {t("adminRecoveryOpen")}
            </button>
          </>
        ) : step === "form" ? (
          <>
            <div>
              <h3 className="font-display text-xl font-bold text-white">{t("adminRecoveryTitle")}</h3>
              <p className="text-sm text-ink-dim mt-2">{t("adminRecoverySubtitle")}</p>
            </div>
            <form onSubmit={handleAdminRecovery} className="space-y-4">
              <input type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder={L("E-mail administrateur", "Administrator email")} className="w-full" />
              <input type="password" value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} placeholder={t("adminRecoveryCode")} className="w-full" />
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t("newPasswordField")} className="w-full" />
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t("confirmNewPassword")} className="w-full" />
              {error && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{uiText(error)}</p>}
              {successMessage && <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{uiText(successMessage)}</p>}
              <button type="submit" disabled={loading} className="w-full btn-primary py-3 font-semibold disabled:opacity-50">
                {loading ? t("forgotSending") : t("adminRecoverySubmit")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdminRecovery(false);
                  setError("");
                  setSuccessMessage("");
                }}
                className="w-full rounded-lg border border-slate-600 px-4 py-3 text-sm font-semibold text-ink-dim hover:text-white"
              >
                {t("forgotClose")}
              </button>
            </form>
          </>
        ) : (
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="text-center">
              <h3 className="font-display text-xl font-bold text-white">{t("forgotSentTitle")}</h3>
              <p className="text-sm text-ink-dim">{successMessage || "Si ce compte existe, un code vient d'être envoyé. Collez ce code ci-dessous pour choisir un nouveau mot de passe."}</p>
            </div>
            {resetToken ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={L("E-mail ou code d'accès du compte", "Account email or access code")}
                className="w-full"
              />
              <textarea
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                placeholder={L("Code de réinitialisation reçu par e-mail", "Reset code received by email")}
                className="min-h-20 w-full resize-none"
              />
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t("newPasswordField")} className="w-full" />
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t("confirmNewPassword")} className="w-full" />
              {error && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{uiText(error)}</p>}
              {successMessage && resetToken === "" && <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{uiText(successMessage)}</p>}
              <button type="submit" disabled={loading} className="w-full btn-primary py-3 font-semibold disabled:opacity-50">
                {loading ? t("forgotSending") : uiText("Reinitialiser le mot de passe")}
              </button>
              <button type="button" onClick={onClose} className="w-full rounded-lg border border-slate-600 px-4 py-3 text-sm font-semibold text-ink-dim hover:text-white">{t("forgotClose")}</button>
            </form>
            ) : (
              <button type="button" onClick={onClose} className="w-full rounded-lg border border-slate-600 px-4 py-3 text-sm font-semibold text-ink-dim hover:text-white">{t("forgotClose")}</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const loginSchema = z.object({
  email: z.string().min(1, 'Identifiant requis'),
  password: z.string().min(8)
});

type LoginInput = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { t, lang } = useI18n();
  const L = (fr: string, en: string) => lang === "fr" ? fr : en;
  const { setAuth } = useAuthStore();
  const resetTokenFromUrl = new URLSearchParams((window.location.hash.split("?")[1] ?? "")).get("resetToken") ?? "";
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(Boolean(resetTokenFromUrl));
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  const loginWithCredentials = async (values: LoginInput) => {
    setApiError(null);
    const result = await api<{ token: string; role?: string; fullName: string; parentId?: string; photoUrl?: string | null; mustChangePassword?: boolean }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        identifier: values.email.trim(),
        password: values.password
      })
    });
    const role = normalizeRole(result.role, result.parentId);
    if (!role) throw new Error("Rôle utilisateur invalide.");

    setAuth(result.token, role, result.fullName, result.parentId, result.photoUrl, Boolean(result.mustChangePassword));
    window.location.replace(`${import.meta.env.BASE_URL}#${role === "PARENT" ? "/parent" : "/"}`);
  };

  const onSubmit = async (values: LoginInput) => {
    try {
      await loginWithCredentials(values);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("loginFailedHint");
      setApiError(message);
    }
  };

  return (
    <div className="ep-login">
      {showForgot && <ForgotPasswordModal initialResetToken={resetTokenFromUrl} onClose={() => setShowForgot(false)} t={t} lang={lang} />}
      <header className="ep-login-topbar">
        <a className="ep-login-brand" href={import.meta.env.VITE_NEXUS_URL || "https://kinshasachristianschool.org/"}>
          <img src={schoolBranding.logoSrc} alt={schoolBranding.schoolName} width="48" height="48" />
          <span><strong>EduPay</strong><small>KCS ORBIT ECOSYSTEM</small></span>
        </a>
        <div className="ep-login-top-actions" data-edupay-header-actions>
          <a className="ep-login-return" aria-label={L("Retour à Nexus", "Back to Nexus")} title={L("Retour à Nexus", "Back to Nexus")} href={import.meta.env.VITE_NEXUS_URL || "https://kinshasachristianschool.org/"}>
            <span>{L("Retour à Nexus", "Back to Nexus")}</span> <ArrowUpRight size={17} />
          </a>
        </div>
      </header>
      <main className="ep-login-card">
        <aside className="ep-login-story">
          <img
            className="ep-login-photo"
            src="/images/school-finance-1440.webp"
            srcSet="/images/school-finance-768.webp 768w, /images/school-finance-1440.webp 1440w, /images/school-finance-3840.webp 3840w"
            sizes="(max-width: 760px) 100vw, 58vw"
            alt={L("Équipe financière d'une école vérifiant les frais de scolarité et les reçus", "School finance team reviewing tuition records and receipts")}
            width="3840" height="2160" fetchPriority="high"
          />
          <div className="ep-login-photo-shade" />
          <span className="ep-login-story-badge"><ShieldCheck size={16} /> {L("Votre espace financier KCS", "Your KCS finance workspace")}</span>
          <div className="ep-login-story-copy">
            <span className="ep-login-kicker">KCS EDUPAY</span>
            <h1>{L("Les finances scolaires.", "School finance.")}<br /><em>{L("En toute clarté.", "With clarity.")}</em></h1>
            <p>{L("Un espace commun pour suivre les frais, les paiements et les reçus de votre communauté scolaire.", "One shared workspace for your school community’s fees, payments and receipts.")}</p>
            <div className="ep-login-story-tags">
              <span><WalletCards size={15} /> {L("Paiements", "Payments")}</span>
              <span><ReceiptText size={15} /> {L("Reçus officiels", "Official receipts")}</span>
            </div>
          </div>
        </aside>
        <section className="ep-login-form-panel">
          <div className="ep-login-preferences"><FontSwitch /><LanguageSwitch /></div>
          <div className="ep-login-intro">
            <span className="ep-login-access"><LockKeyhole size={15} /> {L("Accès sécurisé", "Secure access")}</span>
            <h2>{t("loginTitle")}</h2>
            <p>{t("loginSubtitle")}</p>
          </div>
          <form className="ep-login-form" onSubmit={handleSubmit(onSubmit)}>
            <div className="ep-login-field">
              <label htmlFor="ep-login-identifier">{L("E-mail ou code d'accès", "Email or access code")}</label>
              <input {...register("email")} id="ep-login-identifier" placeholder={L("email@ecole.cd ou code Orbit", "email@school.com or Orbit code")} type="text" autoComplete="username" aria-invalid={Boolean(errors.email)} />
              {errors.email && <p className="ep-login-error">{errors.email.message}</p>}
            </div>
            <div className="ep-login-field">
              <div className="ep-login-label-row">
                <label htmlFor="ep-login-password">{t("password")}</label>
                <button type="button" data-kcs-no-processing="true" onClick={() => setShowForgot(true)}>{t("forgotLink")}</button>
              </div>
              <div className="ep-login-password">
                <input {...register("password")} id="ep-login-password" type={showPassword ? "text" : "password"} placeholder={t("password")} autoComplete="current-password" aria-invalid={Boolean(errors.password)} />
                <button type="button" data-kcs-no-processing="true" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? t("hidePassword") : t("showPassword")} aria-pressed={showPassword}><EyeIcon open={showPassword} /></button>
              </div>
              {errors.password && <p className="ep-login-error">{errors.password.message}</p>}
            </div>
            {apiError && <div className="ep-login-api-error" role="alert">{uiText(apiError)}</div>}
            <button disabled={isSubmitting} className="ep-login-submit btn-primary">
              {isSubmitting ? <span className="ep-login-spinner" aria-hidden="true" /> : <LockKeyhole size={18} />}
              <span>{isSubmitting ? t("signingIn") : t("signIn")}</span>
              {!isSubmitting && <ArrowRight size={18} />}
            </button>
          </form>
          <p className="ep-login-reassurance"><ShieldCheck size={17} /> {L("Vos identifiants personnels. Votre espace KCS.", "Your personal credentials. Your KCS workspace.")}</p>
          <div className="ep-login-school"><strong>{schoolBranding.schoolName}</strong><span>{schoolBranding.tagline}</span></div>
        </section>
      </main>
      <footer className="ep-login-footer">© {new Date().getFullYear()} {schoolBranding.schoolName} · {L("Tous droits réservés.", "All rights reserved.")}</footer>
    </div>
  );
}
