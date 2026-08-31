import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, Eye, EyeOff, Lock, LogIn, Mail, ShieldCheck } from 'lucide-react'
import { API_BASE, authAPI } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import type { UserRole } from '@/types'

const loginSchema = z.object({
  email: z.string().min(1, "E-mail ou code d’accès requis"),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  twoFactorCode: z.string().regex(/^\d{6}$/, 'Saisissez le code à 6 chiffres').optional(),
})
type LoginFormValues = z.infer<typeof loginSchema>

const administrativeIdentifiers = [
  { label: 'Super administrateur', identifier: 'superadmin@kcsnexus.com', detail: 'Administration générale de la plateforme' },
  { label: 'Personnel administratif', identifier: 'staff@kcsnexus.edu', detail: 'Opérations scolaires autorisées' },
  { label: 'Administrateur', identifier: 'admin@kcsnexus.edu', detail: 'Administration de l’établissement' },
]

const getLoginErrorMessage = (error: any) => {
  if (error?.response?.data?.message) return error.response.data.message
  if (error?.code === 'ERR_NETWORK' || error?.message === 'Network Error') return `Connexion impossible à l’API KCS Nexus (${API_BASE}). Vérifiez que le service est disponible.`
  if (error?.code === 'ECONNABORTED') return 'Le service d’authentification met trop de temps à répondre. Réessayez.'
  return error?.message || 'Identifiant ou mot de passe incorrect.'
}

const LoginPage = () => {
  const navigate = useNavigate()
  const { login, user, isAuthenticated, setLoading, isLoading } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false)
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoveryChannel, setRecoveryChannel] = useState<'email' | 'sms'>('email')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [recoveryMessage, setRecoveryMessage] = useState('')
  const [recoveryError, setRecoveryError] = useState('')

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('resetToken') || ''
    if (token) { setResetToken(token); setRecoveryOpen(true) }
  }, [])

  const form = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })
  const resolveDestination = (role: UserRole) => role === 'admin' ? '/admin' : `/portal/${role}`

  const onSubmit = async (values: LoginFormValues) => {
    setLoading(true); setErrorMessage('')
    try {
      const response = await authAPI.login(values.email.trim(), values.password, values.twoFactorCode)
      const data = response.data?.data
      if (!data?.user || !data?.token || !data?.refreshToken) throw new Error('Réponse d’authentification invalide.')
      login(data.user, data.token, data.refreshToken)
      navigate(resolveDestination(data.user.role.toLowerCase() as UserRole), { replace: true })
    } catch (error: any) {
      if (error?.response?.status === 428) {
        setRequiresTwoFactor(true)
        setErrorMessage(error.response.data?.message || 'Saisissez votre code d’authentification.')
      } else setErrorMessage(getLoginErrorMessage(error))
    } finally { setLoading(false) }
  }

  const requestRecovery = async () => {
    setLoading(true); setRecoveryError(''); setRecoveryMessage('')
    try {
      const email = (recoveryEmail || form.getValues('email')).trim()
      await authAPI.forgotPassword(email, recoveryChannel)
      setRecoveryMessage(`Si ce compte existe, un nouveau mot de passe temporaire a été envoyé par ${recoveryChannel === 'sms' ? 'SMS' : 'e-mail'}.`)
    } catch (error: any) { setRecoveryError(error?.response?.data?.message || 'Récupération temporairement indisponible.') }
    finally { setLoading(false) }
  }

  const completeRecovery = async () => {
    setLoading(true); setRecoveryError(''); setRecoveryMessage('')
    try {
      await authAPI.resetPassword(resetToken.trim(), newPassword)
      setRecoveryMessage('Mot de passe réinitialisé. Vous pouvez maintenant vous connecter.')
      setResetToken(''); setNewPassword(''); window.history.replaceState({}, document.title, window.location.pathname)
    } catch (error: any) { setRecoveryError(error?.response?.data?.message || 'Lien invalide ou expiré.') }
    finally { setLoading(false) }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-kcs-blue-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(29,78,216,0.34),transparent_38%)]"/>
      <div className="absolute inset-0 dots-bg opacity-25"/>
      <div className="relative container-custom flex min-h-screen items-center justify-center py-10 sm:py-16">
        <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="border-b border-kcs-blue-700 bg-kcs-blue-950 p-7 text-white shadow-[inset_-1px_0_0_rgba(255,255,255,0.08)] lg:border-b-0 lg:border-r lg:p-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-1.5 text-sm text-emerald-200"><ShieldCheck size={14}/> Accès sécurisé de production</span>
            <h1 className="mt-7 font-display text-3xl font-bold leading-tight sm:text-4xl">Votre espace scolaire, selon vos autorisations</h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-kcs-blue-100">Élèves, parents et enseignants utilisent les identifiants personnels créés par l’administration. Aucun compte collectif ou mot de passe de démonstration n’est accepté.</p>
            <div className="mt-8 space-y-3">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-kcs-gold-300">Identifiants administratifs réservés</p>
              {import.meta.env.DEV && administrativeIdentifiers.map((account) => (
                <button key={account.identifier} type="button" onClick={() => { form.setValue('email', account.identifier, { shouldValidate: true }); form.setFocus('password') }} className="flex w-full items-center gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 text-left text-white shadow-sm transition hover:border-kcs-gold-300/60 hover:bg-white/15">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-kcs-gold-400/15 text-kcs-gold-300"><Building2 size={18}/></span>
                  <span className="min-w-0 flex-1"><span className="block font-semibold">{account.label}</span><span className="block truncate text-sm text-kcs-blue-200">{account.identifier}</span><span className="mt-1 block text-xs text-kcs-blue-300">{account.detail}</span></span>
                </button>
              ))}
            </div>
          </aside>

          <motion.main initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="bg-white p-7 dark:bg-kcs-blue-950/95 sm:p-10">
            <div className="mx-auto max-w-md">
              <Link to="/" className="inline-flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl kcs-gradient text-sm font-bold text-white shadow-kcs">KCS</div><div><p className="font-display text-sm font-bold text-kcs-blue-900 dark:text-white">Kinshasa Christian School</p><p className="text-xs text-kcs-gold-600 dark:text-kcs-gold-400">KCS Nexus</p></div></Link>
              <div className="mb-8 mt-9"><h2 className="font-display text-3xl font-bold text-kcs-blue-900 dark:text-white">Connexion</h2><p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Utilisez votre e-mail ou votre code d’accès personnel.</p></div>

              {errorMessage && <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">{errorMessage}</div>}
              {isAuthenticated && user && <div className="mb-5 rounded-2xl border border-kcs-blue-200 bg-kcs-blue-50 px-4 py-3 text-sm text-kcs-blue-800 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/30 dark:text-kcs-blue-200">Une session est active pour {user.firstName} {user.lastName}. Une nouvelle connexion remplacera cette session.</div>}

              <form onSubmit={form.handleSubmit(onSubmit)} autoComplete="off" className="space-y-4">
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">E-mail ou code d’accès</span><span className="relative block"><Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/><input {...form.register('email')} className="input-kcs pl-11" autoComplete="off" placeholder="nom@ecole.cd ou ACC-..."/></span>{form.formState.errors.email && <span className="mt-1 block text-xs text-red-500">{form.formState.errors.email.message}</span>}</label>
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">Mot de passe</span><span className="relative block"><Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/><input {...form.register('password')} type={showPassword?'text':'password'} className="input-kcs pl-11 pr-11" autoComplete="new-password" placeholder="Votre mot de passe"/><button type="button" onClick={()=>setShowPassword((value)=>!value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" aria-label={showPassword?'Masquer':'Afficher'}>{showPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button></span>{form.formState.errors.password && <span className="mt-1 block text-xs text-red-500">{form.formState.errors.password.message}</span>}</label>
                {requiresTwoFactor && <label className="block"><span className="mb-1.5 block text-xs font-semibold text-gray-600">Code d’authentification</span><input {...form.register('twoFactorCode')} inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="input-kcs tracking-[0.35em]" placeholder="000000" autoFocus/></label>}
                <div className="flex items-center justify-end"><button type="button" onClick={()=>{setRecoveryEmail(form.getValues('email'));setRecoveryOpen((value)=>!value);setRecoveryError('');setRecoveryMessage('')}} className="text-sm font-semibold text-kcs-blue-600 dark:text-kcs-blue-400">Mot de passe oublié ?</button></div>
                {recoveryOpen && <div className="rounded-2xl border border-kcs-blue-200 bg-kcs-blue-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/30"><p className="text-sm font-semibold text-kcs-blue-900 dark:text-white">Récupération sécurisée</p>{!resetToken?<div className="mt-3 space-y-3"><div className="grid grid-cols-2 gap-2" role="group" aria-label="Canal de récupération"><button type="button" onClick={()=>setRecoveryChannel('email')} className={recoveryChannel==='email'?'btn-primary':'btn-secondary'}>E-mail</button><button type="button" onClick={()=>setRecoveryChannel('sms')} className={recoveryChannel==='sms'?'btn-primary':'btn-secondary'}>SMS</button></div><input type="email" value={recoveryEmail} onChange={(event)=>setRecoveryEmail(event.target.value)} className="input-kcs" placeholder="Adresse e-mail du compte"/><button type="button" onClick={()=>void requestRecovery()} disabled={isLoading} className="btn-secondary w-full disabled:opacity-60">Recevoir le nouveau mot de passe</button></div>:<div className="mt-3 space-y-3"><input type="password" value={newPassword} onChange={(event)=>setNewPassword(event.target.value)} className="input-kcs" placeholder="Nouveau mot de passe" minLength={8}/><button type="button" onClick={()=>void completeRecovery()} disabled={isLoading||newPassword.length<8} className="btn-secondary w-full disabled:opacity-60">Réinitialiser</button></div>}{recoveryMessage&&<p className="mt-3 text-sm text-emerald-600">{recoveryMessage}</p>}{recoveryError&&<p className="mt-3 text-sm text-red-600">{recoveryError}</p>}</div>}
                <button type="submit" disabled={isLoading} className="btn-primary flex w-full items-center justify-center gap-2 py-3 disabled:opacity-60"><LogIn size={16}/>{isLoading?'Connexion…':'Se connecter'}</button>
              </form>
              <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">Besoin d’aide ? Contactez l’administration de votre établissement.</p>
            </div>
          </motion.main>
        </div>
      </div>
    </div>
  )
}

export default LoginPage