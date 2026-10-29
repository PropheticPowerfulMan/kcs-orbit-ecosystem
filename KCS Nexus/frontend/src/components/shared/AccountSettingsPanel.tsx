import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Camera, CheckCircle2, Eye, EyeOff, Fingerprint, KeyRound, Loader2, Mail, PenTool, Phone, Save, Shield, Trash2, UserCheck, UsersRound } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { authAPI } from '@/services/api'
import PasswordStrengthMeter from '@/components/shared/PasswordStrengthMeter'
import { evaluatePassword } from '@/utils/passwordStrength'

type AccountSettingsPanelProps = { roleLabel?: string }

const passwordInputClass = 'min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-kcs-blue-900 outline-none dark:text-white'

export default function AccountSettingsPanel({ roleLabel }: AccountSettingsPanelProps) {
  const { user, updateUser } = useAuthStore()
  const language = useUIStore((state) => state.language)
  const tr = (fr: string, en: string) => language === 'fr' ? fr : en
  const fileInputRef = useRef<HTMLInputElement>(null)
  const signatureInputRef = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState({ avatar: '' })
  const [signature, setSignature] = useState({ saved: '', draft: '', loaded: false })
  const [passwords, setPasswords] = useState({ current: '', newPassword: '', confirm: '' })
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})
  const [savingAction, setSavingAction] = useState<'all' | 'password' | ''>('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => setProfile({ avatar: user?.avatar ?? '' }), [user?.id, user?.avatar])
  useEffect(() => {
    let active = true
    if (!user?.id) return
    authAPI.signature().then(({ data }) => {
      if (!active) return
      const value = data?.data?.signatureImage ?? ''
      setSignature({ saved: value, draft: value, loaded: true })
    }).catch(() => { if (active) setSignature((current) => ({ ...current, loaded: true })) })
    return () => { active = false }
  }, [user?.id])

  const displayName = [user?.lastName, user?.middleName, user?.firstName].filter(Boolean).join(' ') || tr('Utilisateur du portail', 'Portal user')
  const initials = `${user?.firstName?.[0] ?? 'K'}${user?.lastName?.[0] ?? 'C'}`.toUpperCase()
  const identityValues = [user?.firstName, user?.middleName, user?.lastName, user?.email, user?.accessCode]
  const passwordDrafted = Boolean(passwords.current || passwords.newPassword || passwords.confirm)
  const photoChanged = profile.avatar !== (user?.avatar ?? '')
  const signatureChanged = signature.loaded && signature.draft !== signature.saved
  const canUseOfficialSignature = Boolean(user && (user.role === 'teacher' || user.role === 'staff' || user.role === 'admin' || user.accessRoles?.includes('teacher') || user.accessRoles?.includes('staff')))
  const accessProfiles = (user?.accessRoles?.length ? user.accessRoles : user?.role ? [user.role] : [])
    .map((role) => ({ admin: tr('Superadministration', 'Super Administration'), staff: tr('Administration', 'Administration'), teacher: tr('Enseignant', 'Teacher'), student: tr('Élève', 'Student'), parent: tr('Parent', 'Parent') }[role] ?? role))
    .join(' · ')

  const choosePhoto = (file?: File) => {
    if (!file) return
    setError('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setError(tr('Veuillez choisir une image JPEG, PNG ou WebP.', 'Please choose a JPEG, PNG, or WebP image.'))
    if (file.size > 1024 * 1024) return setError(tr('La photo doit peser moins de 1 Mo.', 'The photo must be smaller than 1 MB.'))
    const reader = new FileReader()
    reader.onload = () => setProfile({ avatar: String(reader.result) })
    reader.readAsDataURL(file)
  }

  const chooseSignature = (file?: File) => {
    if (!file) return
    setError('')
    if (!['image/png', 'image/webp'].includes(file.type)) return setError(tr('Choisissez une signature PNG ou WebP, idéalement sur fond transparent.', 'Choose a PNG or WebP signature, preferably with a transparent background.'))
    if (file.size > 600 * 1024) return setError(tr('La signature doit peser moins de 600 Ko.', 'The signature must be smaller than 600 KB.'))
    const reader = new FileReader()
    reader.onload = () => setSignature((current) => ({ ...current, draft: String(reader.result) }))
    reader.readAsDataURL(file)
  }

  const validatePassword = () => {
    if (!passwordDrafted) return tr('Saisissez votre mot de passe actuel et votre nouveau mot de passe.', 'Enter your current password and your new password.')
    if (!passwords.current || !passwords.newPassword || !passwords.confirm) return tr('Complétez les trois champs du mot de passe.', 'Complete all three password fields.')
    const strength = evaluatePassword(passwords.newPassword, identityValues)
    if (!strength.strong) return tr('Le nouveau mot de passe reste vulnérable. Respectez toutes les règles affichées en rouge.', 'The new password is still vulnerable. Complete every rule shown in red.')
    if (passwords.newPassword !== passwords.confirm) return tr('Les nouveaux mots de passe ne correspondent pas.', 'The new passwords do not match.')
    return ''
  }

  const changePassword = async () => {
    const validationError = validatePassword()
    if (validationError) throw new Error(validationError)
    await authAPI.changePassword(passwords.current, passwords.newPassword)
    setPasswords({ current: '', newPassword: '', confirm: '' })
  }

  const savePasswordOnly = async () => {
    setError('')
    setMessage('')
    const validationError = validatePassword()
    if (validationError) return setError(validationError)
    setSavingAction('password')
    try {
      await changePassword()
      setMessage(tr('Mot de passe enregistré et propagé dans les applications autorisées de l’écosystème.', 'Password saved and propagated across authorized ecosystem applications.'))
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || requestError?.response?.data?.detail || requestError?.message || tr('La modification du mot de passe a échoué.', 'The password update failed.'))
    } finally {
      setSavingAction('')
    }
  }

  const saveAllUpdates = async () => {
    setError('')
    setMessage('')
    if (!photoChanged && !signatureChanged && !passwordDrafted) return setMessage(tr('Aucune nouvelle modification à enregistrer.', 'There are no new changes to save.'))
    if (passwordDrafted) {
      const validationError = validatePassword()
      if (validationError) return setError(validationError)
    }
    setSavingAction('all')
    try {
      if (photoChanged) {
        const response = await authAPI.updateProfile({ avatar: profile.avatar })
        updateUser(response.data.data)
      }
      if (signatureChanged) {
        await authAPI.updateSignature(signature.draft)
        setSignature((current) => ({ ...current, saved: current.draft }))
      }
      if (passwordDrafted) await changePassword()
      setMessage((photoChanged || signatureChanged) && passwordDrafted
        ? tr('Profil, signature officielle et mot de passe enregistrés avec succès.', 'Profile, official signature and password saved successfully.')
        : signatureChanged
          ? tr('Signature électronique officielle enregistrée et auditée.', 'Official electronic signature saved and audited.')
        : photoChanged
          ? tr('Photo personnelle enregistrée uniquement dans votre dashboard KCS Nexus.', 'Personal photo saved only in your KCS Nexus dashboard.')
          : tr('Mot de passe enregistré et propagé dans l’écosystème.', 'Password saved and propagated across the ecosystem.'))
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || requestError?.response?.data?.detail || requestError?.message || tr('La modification du compte a échoué.', 'The account update failed.'))
    } finally {
      setSavingAction('')
    }
  }

  const passwordFields = [
    ['current', tr('Mot de passe actuel', 'Current password')],
    ['newPassword', tr('Nouveau mot de passe', 'New password')],
    ['confirm', tr('Confirmer le mot de passe', 'Confirm password')],
  ] as const

  return <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
    <section className="rounded-3xl border border-kcs-blue-100 bg-gradient-to-br from-kcs-blue-50 to-cyan-50 p-5 shadow-sm dark:border-kcs-blue-800 dark:from-kcs-blue-900 dark:to-kcs-blue-950">
      <div className="flex items-center gap-4">
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-visible rounded-2xl bg-kcs-blue-100 text-2xl font-black text-kcs-blue-700 dark:bg-kcs-blue-800 dark:text-kcs-blue-100">
          {profile.avatar ? <img src={profile.avatar} alt={displayName} className="h-full w-full rounded-2xl object-cover"/> : initials}
          <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full bg-kcs-blue-700 text-white shadow-lg hover:bg-kcs-blue-800" aria-label={tr('Changer la photo', 'Change photo')}><Camera size={17}/></button>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => choosePhoto(event.target.files?.[0])}/>
        </div>
        <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-kcs-blue-600 dark:text-kcs-blue-300">{roleLabel ?? user?.role ?? tr('Compte', 'Account')}</p><h2 className="truncate font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{displayName}</h2><p className="truncate text-sm text-gray-500 dark:text-gray-400">{tr('Identité institutionnelle vérifiée', 'Verified institutional identity')}</p></div>
      </div>
      <div className="mt-5 grid gap-3">
        <Status icon={<Fingerprint size={18}/>} label={tr('Code d’accès institutionnel', 'Institutional access code')} value={user?.accessCode || tr('Non attribué', 'Not assigned')}/>
        <Status icon={<Mail size={18}/>} label={tr('Adresse professionnelle', 'Professional email')} value={user?.email || tr('Non renseignée', 'Not provided')}/>
        <Status icon={<Phone size={18}/>} label={tr('Téléphone', 'Phone')} value={user?.phone || tr('Non renseigné', 'Not provided')}/>
        <Status icon={<UsersRound size={18}/>} label={tr('Profils autorisés', 'Authorized profiles')} value={accessProfiles || user?.role || tr('Compte', 'Account')}/>
        <Status icon={<UserCheck size={18}/>} label={tr('Identité', 'Identity')} value={tr('Synchronisée avec le registre KCS Orbit', 'Synchronized with the KCS Orbit registry')}/>
        <Status icon={<Shield size={18}/>} label={tr('Photo personnelle', 'Personal photo')} value={tr('KCS Nexus uniquement · dossier officiel inchangé', 'KCS Nexus only · official record unchanged')}/>
      </div>
      <button type="button" disabled={Boolean(savingAction)} onClick={() => void saveAllUpdates()} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-kcs-blue-700 to-cyan-600 px-4 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">{savingAction === 'all' ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>} {savingAction === 'all' ? tr('Enregistrement…', 'Saving…') : tr('Enregistrer les modifications', 'Save updates')}</button>
      {canUseOfficialSignature ? <div className="mt-5 rounded-2xl border border-sky-200 bg-white/80 p-4 dark:border-kcs-blue-700 dark:bg-kcs-blue-950/50">
        <div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-black text-kcs-blue-950 dark:text-white"><PenTool size={17}/>{tr('Signature électronique officielle', 'Official electronic signature')}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{tr('Elle est apposée uniquement aux documents qui exigent votre fonction : titulaire, Principal ou Head of School.', 'It is only placed on documents requiring your role: main teacher, Principal or Head of School.')}</p></div>{signature.draft ? <button type="button" onClick={() => setSignature((current) => ({ ...current, draft: '' }))} className="rounded-lg p-2 text-rose-600" aria-label={tr('Supprimer la signature', 'Remove signature')}><Trash2 size={17}/></button> : null}</div>
        <div className="mt-3 flex min-h-24 items-center justify-center rounded-xl border border-dashed border-sky-300 bg-sky-50 p-3 dark:border-kcs-blue-600 dark:bg-kcs-blue-900">{signature.draft ? <img src={signature.draft} alt={tr('Signature électronique', 'Electronic signature')} className="max-h-20 max-w-full object-contain"/> : <span className="text-xs font-bold text-slate-500">{tr('Aucune signature enregistrée', 'No signature saved')}</span>}</div>
        <button type="button" onClick={() => signatureInputRef.current?.click()} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-sky-300 px-4 py-2 text-sm font-bold text-kcs-blue-800 dark:text-sky-200"><PenTool size={16}/>{tr('Choisir la signature', 'Choose signature')}</button>
        <input ref={signatureInputRef} type="file" accept="image/png,image/webp" className="hidden" onChange={(event) => chooseSignature(event.target.files?.[0])}/>
      </div> : null}
    </section>

    <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 className="font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{tr('Identifiants et profil', 'Credentials and profile')}</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{tr('Le serveur vérifie votre mot de passe actuel sans jamais l’afficher ni le récupérer.', 'The server verifies your current password without ever displaying or retrieving it.')}</p></div>
        <button type="button" disabled={Boolean(savingAction)} onClick={() => void savePasswordOnly()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-kcs-blue-800 disabled:cursor-wait disabled:opacity-60">{savingAction === 'password' ? <Loader2 size={16} className="animate-spin"/> : <KeyRound size={16}/>} {savingAction === 'password' ? tr('Sécurisation…', 'Securing…') : tr('Enregistrer', 'Save')}</button>
      </div>
      <div className="mt-5 grid gap-5">
        <div className="rounded-xl border border-kcs-blue-100 bg-kcs-blue-50 p-4 text-sm text-kcs-blue-800 dark:border-kcs-blue-800 dark:bg-kcs-blue-950 dark:text-kcs-blue-100">{tr('La photo choisie ici personnalise uniquement votre dashboard KCS Nexus. Elle ne remplace jamais la photo officielle conservée par l’administration. Le mot de passe, lui, est propagé par l’autorité d’identité commune.', 'The photo selected here personalizes only your KCS Nexus dashboard. It never replaces the official portrait held by the administration. The password is propagated by the common identity authority.')}</div>
        <div className="grid gap-3 sm:grid-cols-3">
          {passwordFields.map(([id, label]) => <label key={id} className="grid gap-1 text-xs font-semibold text-gray-500">{label}<span className="flex items-center overflow-hidden rounded-xl border border-gray-200 pr-2 dark:border-kcs-blue-700"><input className={passwordInputClass} value={passwords[id]} onChange={(event) => setPasswords({ ...passwords, [id]: event.target.value })} type={visiblePasswords[id] ? 'text' : 'password'} autoComplete={id === 'current' ? 'current-password' : 'new-password'} placeholder={id === 'current' ? tr('Mot de passe actuel', 'Current password') : tr('Phrase de passe forte et unique', 'Strong unique passphrase')}/><button type="button" onClick={() => setVisiblePasswords({ ...visiblePasswords, [id]: !visiblePasswords[id] })} className="p-2" aria-label={visiblePasswords[id] ? tr('Masquer', 'Hide') : tr('Afficher', 'Show')}>{visiblePasswords[id] ? <EyeOff size={16}/> : <Eye size={16}/>}</button></span></label>)}
        </div>
        <PasswordStrengthMeter password={passwords.newPassword} identityValues={identityValues}/>
        {message && <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200" role="status"><CheckCircle2 size={17}/>{message}</p>}
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-200" role="alert">{error}</p>}
      </div>
    </section>
  </div>
}

function Status({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30">{icon}<div><p className="text-xs text-gray-500 dark:text-gray-300">{label}</p><p className="font-bold text-kcs-blue-900 dark:text-white">{value}</p></div></div>
}
