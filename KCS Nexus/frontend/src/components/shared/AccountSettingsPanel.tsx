import { useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, Eye, EyeOff, KeyRound, Shield, UserCheck } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { authAPI } from '@/services/api'

type AccountSettingsPanelProps = { roleLabel?: string }

const inputClass = 'rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-kcs-blue-900 outline-none focus:border-kcs-blue-500 focus:ring-2 focus:ring-kcs-blue-100 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white'
const passwordInputClass = 'min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-kcs-blue-900 outline-none dark:text-white'

const AccountSettingsPanel = ({ roleLabel }: AccountSettingsPanelProps) => {
  const { user, updateUser } = useAuthStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState({ firstName: '', middleName: '', lastName: '', phone: '', avatar: '' })
  const [passwords, setPasswords] = useState({ current: '', newPassword: '', confirm: '' })
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setProfile({
      firstName: user?.firstName ?? '',
      middleName: user?.middleName ?? '',
      lastName: user?.lastName ?? '',
      phone: user?.phone ?? '',
      avatar: user?.avatar ?? '',
    })
  }, [user?.id])

  const displayName = [profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(' ') || 'Portal user'
  const initials = `${profile.firstName[0] ?? 'K'}${profile.lastName[0] ?? 'C'}`.toUpperCase()

  const choosePhoto = (file?: File) => {
    if (!file) return
    setError('')
    if (!file.type.startsWith('image/')) return setError('Veuillez choisir une image valide.')
    if (file.size > 1024 * 1024) return setError('La photo doit peser moins de 1 Mo.')
    const reader = new FileReader()
    reader.onload = () => setProfile((current) => ({ ...current, avatar: String(reader.result) }))
    reader.readAsDataURL(file)
  }

  const saveChanges = async () => {
    setError('')
    setMessage('')
    const wantsPasswordChange = Boolean(passwords.current || passwords.newPassword || passwords.confirm)
    if (wantsPasswordChange && passwords.newPassword.length < 8) return setError('Le nouveau mot de passe doit contenir au moins 8 caractères.')
    if (wantsPasswordChange && passwords.newPassword !== passwords.confirm) return setError('Les nouveaux mots de passe ne correspondent pas.')

    setSaving(true)
    try {
      const response = await authAPI.updateProfile({ avatar: profile.avatar })
      updateUser(response.data.data)
      if (wantsPasswordChange) {
        await authAPI.changePassword(passwords.current, passwords.newPassword)
        setPasswords({ current: '', newPassword: '', confirm: '' })
      }
      setMessage(wantsPasswordChange ? 'Photo, profil et mot de passe synchronisés dans l’écosystème.' : 'Photo et profil synchronisés dans l’écosystème.')
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || requestError?.response?.data?.detail || 'La modification du compte a échoué.')
    } finally {
      setSaving(false)
    }
  }

  const passwordFields = [
    ['current', 'Mot de passe actuel'], ['newPassword', 'Nouveau mot de passe'], ['confirm', 'Confirmer le mot de passe'],
  ] as const

  return (
    <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
      <section className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
        <div className="flex items-center gap-4">
          <div className="relative flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-visible rounded-2xl bg-kcs-blue-100 text-2xl font-black text-kcs-blue-700 dark:bg-kcs-blue-800 dark:text-kcs-blue-100">
            {profile.avatar ? <img src={profile.avatar} alt={displayName} className="h-full w-full rounded-2xl object-cover" /> : initials}
            <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full bg-kcs-blue-700 text-white shadow-lg hover:bg-kcs-blue-800" aria-label="Changer la photo"><Camera size={17}/></button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => choosePhoto(event.target.files?.[0])}/>
          </div>
          <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-kcs-blue-600 dark:text-kcs-blue-300">{roleLabel ?? user?.role ?? 'Compte'}</p><h2 className="truncate font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{displayName}</h2><p className="truncate text-sm text-gray-500 dark:text-gray-400">{user?.accessCode || user?.email}</p></div>
        </div>
        <div className="mt-5 grid gap-3">
          <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30"><UserCheck size={18}/><div><p className="text-xs text-gray-500">Identité</p><p className="font-bold text-kcs-blue-900 dark:text-white">Synchronisée</p></div></div><div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30"><KeyRound size={18}/><div><p className="text-xs text-gray-500">Mot de passe</p><p className="font-bold text-kcs-blue-900 dark:text-white">Modifiable ici</p></div></div><div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30"><Shield size={18}/><div><p className="text-xs text-gray-500">Photo canonique</p><p className="font-bold text-kcs-blue-900 dark:text-white">Visible dans les applications autorisées</p></div></div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">Identifiants et profil</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Modifiez uniquement votre photo et votre mot de passe.</p></div><button type="button" disabled={saving} onClick={() => void saveChanges()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-kcs-blue-800 disabled:opacity-60"><CheckCircle2 size={16}/>{saving ? 'Synchronisation…' : 'Enregistrer'}</button></div>
        <div className="mt-5 grid gap-5">
          <div className="rounded-xl border border-kcs-blue-100 bg-kcs-blue-50 p-4 text-sm text-kcs-blue-800 dark:border-kcs-blue-800 dark:bg-kcs-blue-950 dark:text-kcs-blue-100">
            Seuls la photo et le mot de passe peuvent être modifiés ici. Le nom, les contacts, l’e-mail et le code d’accès sont gérés par l’administration.
          </div>          <div className="grid gap-3 sm:grid-cols-3">
            {passwordFields.map(([id,label])=><label key={id} className="grid gap-1 text-xs font-semibold text-gray-500">{label}<span className="flex items-center overflow-hidden rounded-xl border border-gray-200 pr-2 dark:border-kcs-blue-700"><input className={passwordInputClass} value={passwords[id]} onChange={(e)=>setPasswords({...passwords,[id]:e.target.value})} type={visiblePasswords[id]?'text':'password'} autoComplete={id==='current'?'current-password':'new-password'}/><button type="button" onClick={()=>setVisiblePasswords({...visiblePasswords,[id]:!visiblePasswords[id]})} className="p-2">{visiblePasswords[id]?<EyeOff size={16}/>:<Eye size={16}/>}</button></span></label>)}
          </div>
          {message && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p>}
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        </div>
      </section>
    </div>
  )
}

export default AccountSettingsPanel