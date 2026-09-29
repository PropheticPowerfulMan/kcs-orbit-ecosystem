import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Camera, CheckCircle2, Eye, EyeOff, KeyRound, Shield, UserCheck } from 'lucide-react'
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
  const [profile, setProfile] = useState({ avatar: '' })
  const [passwords, setPasswords] = useState({ current: '', newPassword: '', confirm: '' })
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => setProfile({ avatar: user?.avatar ?? '' }), [user?.id, user?.avatar])

  const displayName = [user?.lastName, user?.middleName, user?.firstName].filter(Boolean).join(' ') || tr('Utilisateur du portail', 'Portal user')
  const initials = `${user?.firstName?.[0] ?? 'K'}${user?.lastName?.[0] ?? 'C'}`.toUpperCase()
  const identityValues = [user?.firstName, user?.middleName, user?.lastName, user?.email, user?.accessCode]

  const choosePhoto = (file?: File) => {
    if (!file) return
    setError('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setError(tr('Veuillez choisir une image JPEG, PNG ou WebP.', 'Please choose a JPEG, PNG, or WebP image.'))
    if (file.size > 1024 * 1024) return setError(tr('La photo doit peser moins de 1 Mo.', 'The photo must be smaller than 1 MB.'))
    const reader = new FileReader()
    reader.onload = () => setProfile({ avatar: String(reader.result) })
    reader.readAsDataURL(file)
  }

  const saveChanges = async () => {
    setError('')
    setMessage('')
    const wantsPasswordChange = Boolean(passwords.current || passwords.newPassword || passwords.confirm)
    const strength = evaluatePassword(passwords.newPassword, identityValues)
    if (wantsPasswordChange && !strength.strong) return setError(tr('Le nouveau mot de passe reste vulnérable. Respectez toutes les règles affichées en rouge.', 'The new password is still vulnerable. Complete every rule shown in red.'))
    if (wantsPasswordChange && passwords.newPassword !== passwords.confirm) return setError(tr('Les nouveaux mots de passe ne correspondent pas.', 'The new passwords do not match.'))

    setSaving(true)
    try {
      const response = await authAPI.updateProfile({ avatar: profile.avatar })
      updateUser(response.data.data)
      if (wantsPasswordChange) {
        await authAPI.changePassword(passwords.current, passwords.newPassword)
        setPasswords({ current: '', newPassword: '', confirm: '' })
      }
      setMessage(wantsPasswordChange
        ? tr('Photo personnelle Nexus enregistrée et mot de passe propagé dans l’écosystème.', 'Personal Nexus photo saved and password propagated across the ecosystem.')
        : tr('Photo personnelle enregistrée uniquement dans votre dashboard KCS Nexus.', 'Personal photo saved only in your KCS Nexus dashboard.'))
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || requestError?.response?.data?.detail || tr('La modification du compte a échoué.', 'The account update failed.'))
    } finally {
      setSaving(false)
    }
  }

  const passwordFields = [
    ['current', tr('Mot de passe actuel', 'Current password')],
    ['newPassword', tr('Nouveau mot de passe', 'New password')],
    ['confirm', tr('Confirmer le mot de passe', 'Confirm password')],
  ] as const

  return <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
    <section className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
      <div className="flex items-center gap-4">
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-visible rounded-2xl bg-kcs-blue-100 text-2xl font-black text-kcs-blue-700 dark:bg-kcs-blue-800 dark:text-kcs-blue-100">
          {profile.avatar ? <img src={profile.avatar} alt={displayName} className="h-full w-full rounded-2xl object-cover"/> : initials}
          <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full bg-kcs-blue-700 text-white shadow-lg hover:bg-kcs-blue-800" aria-label={tr('Changer la photo', 'Change photo')}><Camera size={17}/></button>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => choosePhoto(event.target.files?.[0])}/>
        </div>
        <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-kcs-blue-600 dark:text-kcs-blue-300">{roleLabel ?? user?.role ?? tr('Compte', 'Account')}</p><h2 className="truncate font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{displayName}</h2><p className="truncate text-sm text-gray-500 dark:text-gray-400">{user?.accessCode || user?.email}</p></div>
      </div>
      <div className="mt-5 grid gap-3">
        <Status icon={<UserCheck size={18}/>} label={tr('Identité', 'Identity')} value={tr('Synchronisée', 'Synchronized')}/>
        <Status icon={<KeyRound size={18}/>} label={tr('Mot de passe', 'Password')} value={tr('Partagé par les applications autorisées', 'Shared by authorized applications')}/>
        <Status icon={<Shield size={18}/>} label={tr('Photo personnelle', 'Personal photo')} value={tr('KCS Nexus uniquement · dossier officiel inchangé', 'KCS Nexus only · official record unchanged')}/>
      </div>
    </section>

    <section className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 className="font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{tr('Identifiants et profil', 'Credentials and profile')}</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{tr('Le serveur vérifie votre mot de passe actuel sans jamais l’afficher ni le récupérer.', 'The server verifies your current password without ever displaying or retrieving it.')}</p></div>
        <button type="button" disabled={saving} onClick={() => void saveChanges()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-kcs-blue-800 disabled:opacity-60"><CheckCircle2 size={16}/>{saving ? tr('Sécurisation…', 'Securing…') : tr('Enregistrer', 'Save')}</button>
      </div>
      <div className="mt-5 grid gap-5">
        <div className="rounded-xl border border-kcs-blue-100 bg-kcs-blue-50 p-4 text-sm text-kcs-blue-800 dark:border-kcs-blue-800 dark:bg-kcs-blue-950 dark:text-kcs-blue-100">{tr('La photo choisie ici personnalise uniquement votre dashboard KCS Nexus. Elle ne remplace jamais la photo officielle conservée par l’administration. Le mot de passe, lui, est propagé par l’autorité d’identité commune.', 'The photo selected here personalizes only your KCS Nexus dashboard. It never replaces the official portrait held by the administration. The password is propagated by the common identity authority.')}</div>
        <div className="grid gap-3 sm:grid-cols-3">
          {passwordFields.map(([id, label]) => <label key={id} className="grid gap-1 text-xs font-semibold text-gray-500">{label}<span className="flex items-center overflow-hidden rounded-xl border border-gray-200 pr-2 dark:border-kcs-blue-700"><input className={passwordInputClass} value={passwords[id]} onChange={(event) => setPasswords({ ...passwords, [id]: event.target.value })} type={visiblePasswords[id] ? 'text' : 'password'} autoComplete={id === 'current' ? 'current-password' : 'new-password'} placeholder={id === 'current' ? tr('Mot de passe actuel', 'Current password') : tr('Phrase de passe forte et unique', 'Strong unique passphrase')}/><button type="button" onClick={() => setVisiblePasswords({ ...visiblePasswords, [id]: !visiblePasswords[id] })} className="p-2" aria-label={visiblePasswords[id] ? tr('Masquer', 'Hide') : tr('Afficher', 'Show')}>{visiblePasswords[id] ? <EyeOff size={16}/> : <Eye size={16}/>}</button></span></label>)}
        </div>
        <PasswordStrengthMeter password={passwords.newPassword} identityValues={identityValues}/>
        {message && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">{message}</p>}
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-200">{error}</p>}
      </div>
    </section>
  </div>
}

function Status({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30">{icon}<div><p className="text-xs text-gray-500 dark:text-gray-300">{label}</p><p className="font-bold text-kcs-blue-900 dark:text-white">{value}</p></div></div>
}
