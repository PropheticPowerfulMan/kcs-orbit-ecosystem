import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, Eye, EyeOff, KeyRound, Lock, LogIn, Mail, Send, ShieldCheck, X } from 'lucide-react'
import { API_BASE, authAPI } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import type { User, UserRole } from '@/types'

const loginSchema = z.object({
  email: z.string().min(1, 'Email ou code d\'accès requis'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginFormValues = z.infer<typeof loginSchema>

const resetSchema = z.object({
  email: z.string().optional(),
  token: z.string().optional(),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
}).superRefine((value, ctx) => {
  if (!value.token?.trim()) {
    if (!value.email?.trim() || !z.string().email().safeParse(value.email).success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid email address', path: ['email'] })
    }
    return
  }
  if (!value.password || value.password.length < 8) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Password must be at least 8 characters', path: ['password'] })
  }
  if (value.password !== value.confirmPassword) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Passwords do not match', path: ['confirmPassword'] })
  }
})

type ResetFormValues = z.infer<typeof resetSchema>

type DemoAccount = {
  email: string
  password: string
  role: UserRole
  firstName: string
  lastName: string
  label: string
}

const demoAccounts: DemoAccount[] = [
  { email: 'superadmin@kcsnexus.com', password: 'SuperAdmin123!', role: 'admin', firstName: 'Super', lastName: 'Admin', label: 'Super admin' },
  { email: 'staff@kcsnexus.edu', password: 'password123', role: 'staff', firstName: 'Miriam', lastName: 'Office', label: 'Administrative staff' },
  { email: 'student@kcsnexus.edu', password: 'password123', role: 'student', firstName: 'Grace', lastName: 'Mwamba', label: 'Student demo' },
  { email: 'parent@kcsnexus.edu', password: 'password123', role: 'parent', firstName: 'Rachel', lastName: 'Kabongo', label: 'Parent demo' },
  { email: 'teacher@kcsnexus.edu', password: 'password123', role: 'teacher', firstName: 'Daniel', lastName: 'Mukendi', label: 'Teacher demo' },
  { email: 'admin@kcsnexus.edu', password: 'password123', role: 'admin', firstName: 'Sarah', lastName: 'Carter', label: 'Admin demo' },
]

const superAdminAliases = ['superadmin@kcsnexus.com', 'superadmin@kcsnexus.edu', 'admin@kcsnexus.com']
const superAdminPasswords = ['SuperAdmin123!', 'password123']
const superAdminAccount = demoAccounts[0]

const findDemoAccount = (values: LoginFormValues) => {
  const email = values.email.trim().toLowerCase()
  const password = values.password.trim()

  if (superAdminAliases.includes(email) && superAdminPasswords.includes(password)) {
    return superAdminAccount
  }

  return demoAccounts.find((account) => (
    account.email.toLowerCase() === email && account.password === password
  ))
}

const buildDemoUser = (account: DemoAccount): User => ({
  id: account.role + '-demo',
  email: account.email,
  accessCode: `ACC-${account.role.slice(0, 3).toUpperCase()}-DEMO`,
  firstName: account.firstName,
  lastName: account.lastName,
  role: account.role,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

const getLoginErrorMessage = (err: any) => {
  if (err?.response?.data?.message) {
    return `Erreur API: ${err.response.data.message}. Pour le Super Admin demo, utilisez superadmin@kcsnexus.com / SuperAdmin123!.`
  }

  if (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error') {
    return `Erreur reseau : KCS Nexus n'arrive pas a joindre son API (${API_BASE}). Lancez le backend KCS Nexus, puis verifiez que EDUPAY_API_URL pointe vers EduPay API et que SAVANEX_API_URL pointe vers SAVANEX pour accepter les identifiants crees dans les autres applications.`
  }

  if (err?.code === 'ECONNABORTED') {
    return `Erreur reseau : la connexion a l'API KCS Nexus (${API_BASE}) a expire. Verifiez que KCS Nexus Backend, EduPay API, SAVANEX et KCS Orbit sont demarres.`
  }

  if (err?.message) {
    return `Erreur: ${err.message}. Pour le Super Admin demo, utilisez superadmin@kcsnexus.com / SuperAdmin123!.`
  }

  return 'Login failed. Use one of the demo accounts or connect the backend auth service.'
}

const LoginPage = () => {
  const navigate = useNavigate()
  const { login, logout, user, isAuthenticated, setLoading, isLoading } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  const [resetMessage, setResetMessage] = useState('')
  const [resetError, setResetError] = useState('')
  const [resetSubmitting, setResetSubmitting] = useState(false)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const resetForm = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      email: '',
      token: '',
      password: '',
      confirmPassword: '',
    },
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const resetToken = params.get('resetToken')
    if (resetToken) {
      resetForm.setValue('token', resetToken)
      setResetOpen(true)
    }
  }, [resetForm])

  const resolveDestination = (role: UserRole) => {
    return role === 'admin' ? '/admin' : `/portal/${role}`
  }

  const handleDemoLogin = (user: User) => {
    logout()
    login(user, 'demo-access-token', 'demo-refresh-token')
    navigate(resolveDestination(user.role), { replace: true })
  }

  const handleApiLogin = async (values: LoginFormValues) => {
    const response = await authAPI.login(values.email.trim(), values.password)
    const data = response.data?.data
    if (!data?.user || !data?.token || !data?.refreshToken) {
      throw new Error('Invalid authentication response')
    }
    logout()
    login(data.user, data.token, data.refreshToken)
    navigate(resolveDestination(data.user.role), { replace: true })
  }

  const enterSuperAdmin = async () => {
    setLoading(true)
    setErrorMessage('')
    try {
      await handleApiLogin({ email: superAdminAccount.email, password: superAdminAccount.password })
    } catch {
      handleDemoLogin(buildDemoUser(superAdminAccount))
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (values: LoginFormValues) => {
    setLoading(true)
    setErrorMessage('')

    try {
      await handleApiLogin(values)
    } catch (err: any) {
      const demoAccount = findDemoAccount(values)
      if (demoAccount) {
        handleDemoLogin(buildDemoUser(demoAccount))
      } else {
        setErrorMessage(getLoginErrorMessage(err))
      }
    } finally {
      setLoading(false)
    }
  }

  const openPasswordReset = () => {
    resetForm.setValue('email', form.getValues('email') || '')
    setResetMessage('')
    setResetError('')
    setResetOpen(true)
  }

  const handlePasswordReset = async (values: ResetFormValues) => {
    setResetSubmitting(true)
    setResetMessage('')
    setResetError('')

    try {
      if (values.token?.trim()) {
        await authAPI.resetPassword(values.token.trim(), values.password || '')
        setResetMessage('Password updated. You can sign in with the new password.')
        resetForm.reset({ email: values.email, token: '', password: '', confirmPassword: '' })
        window.history.replaceState({}, document.title, window.location.pathname)
      } else {
        await authAPI.forgotPassword((values.email || '').trim())
        setResetMessage('If this account exists, a secure reset link has been sent.')
      }
    } catch (err: any) {
      setResetError(err?.response?.data?.message || 'Password reset is temporarily unavailable.')
    } finally {
      setResetSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-kcs-blue-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(29,78,216,0.28),transparent_35%)]" />
      <div className="absolute inset-0 dots-bg opacity-30" />

      <div className="relative container-custom flex min-h-screen items-center justify-center py-16">
        <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/6 backdrop-blur-xl lg:grid-cols-[0.95fr_1.05fr]">
          <div className="hidden flex-col justify-between border-r border-white/10 p-10 text-white lg:flex">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-sm text-kcs-gold-300">
                <ShieldCheck size={14} /> Secure Access
              </span>
              <h1 className="mt-8 text-4xl font-bold font-display leading-tight">
                Enter The Digital Campus Of KCS Nexus
              </h1>
              <p className="mt-4 max-w-md text-kcs-blue-100">
                Access role-based dashboards for students, parents, teachers, and school leadership with AI-powered workflows built into the experience.
              </p>
            </div>
            <div className="space-y-4">
              {demoAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => {
                    form.setValue('email', account.email)
                    form.setValue('password', account.password)
                  }}
                  className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition-colors hover:bg-white/10"
                >
                  <div>
                    <p className="font-semibold">{account.label}</p>
                    <p className="text-sm text-kcs-blue-200">{account.email}</p>
                  </div>
                  <span className="rounded-full bg-kcs-gold-400 px-3 py-1 text-xs font-semibold text-kcs-blue-950">Quick Fill</span>
                </button>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white p-8 dark:bg-kcs-blue-950/95 md:p-10"
          >
            <div className="mx-auto max-w-md">
              <Link to="/" className="inline-flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl kcs-gradient text-sm font-bold text-white shadow-kcs">KCS</div>
                <div>
                  <p className="font-display text-sm font-bold text-kcs-blue-900 dark:text-white">Kinshasa Christian School</p>
                  <p className="text-xs text-kcs-gold-600 dark:text-kcs-gold-400">Nexus Platform</p>
                </div>
              </Link>

              <div className="mt-10 mb-8">
                <h2 className="text-3xl font-bold font-display text-kcs-blue-900 dark:text-white">Sign In</h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Use your email, access code, or one of the demo accounts.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                  {errorMessage}
                </div>
              )}

              {isAuthenticated && user && (
                <div className="mb-6 rounded-2xl border border-kcs-blue-200 bg-kcs-blue-50 px-4 py-3 text-sm text-kcs-blue-800 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/30 dark:text-kcs-blue-200">
                  Session active: {user.firstName} {user.lastName} ({user.role}). Choisissez un compte demo ci-dessous pour remplacer cette session.
                </div>
              )}

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">Email ou code d'accès</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input {...form.register('email')} className="input-kcs pl-11" placeholder="name@kcsnexus.edu ou ACC-ADM-SUPER1" />
                  </div>
                  {form.formState.errors.email && <p className="mt-1 text-xs text-red-500">{form.formState.errors.email.message}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      {...form.register('password')}
                      type={showPassword ? 'text' : 'password'}
                      className="input-kcs pl-11 pr-11"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-kcs-blue-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {form.formState.errors.password && <p className="mt-1 text-xs text-red-500">{form.formState.errors.password.message}</p>}
                </div>

                <div className="flex items-center justify-between pt-1 text-sm">
                  <label className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <input type="checkbox" className="accent-kcs-blue-600" /> Remember me
                  </label>
                  <button type="button" onClick={openPasswordReset} className="font-medium text-kcs-blue-600 dark:text-kcs-blue-400">
                    Forgot password?
                  </button>
                </div>

                <button type="submit" disabled={isLoading} className="btn-primary flex w-full items-center justify-center gap-2 py-3 disabled:opacity-60">
                  <LogIn size={16} /> {isLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              <div className="my-6 flex items-center gap-4 text-xs uppercase tracking-[0.2em] text-gray-400">
                <div className="h-px flex-1 bg-gray-200 dark:bg-kcs-blue-800" />
                Demo access
                <div className="h-px flex-1 bg-gray-200 dark:bg-kcs-blue-800" />
              </div>

              <div className="mb-3 grid grid-cols-2 gap-2 lg:hidden">
                {demoAccounts.slice(0, 4).map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => {
                      form.setValue('email', account.email)
                      form.setValue('password', account.password)
                    }}
                    className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-700 transition-colors hover:bg-white dark:border-kcs-blue-800 dark:bg-kcs-blue-900/40 dark:text-white"
                  >
                    {account.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={enterSuperAdmin}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-kcs-gold-300 bg-kcs-gold-400 px-4 py-3 font-semibold text-kcs-blue-950 transition-colors hover:bg-kcs-gold-500"
              >
                <ShieldCheck size={18} />
                Entrer comme Super Admin
              </button>

              <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
                Need admission support? <Link to="/admissions" className="font-semibold text-kcs-blue-600 dark:text-kcs-blue-400">Start your application</Link>
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      {resetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-kcs-blue-950/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Password reset">
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-6 shadow-2xl dark:bg-kcs-blue-950"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-kcs-blue-100 text-kcs-blue-700 dark:bg-kcs-blue-900 dark:text-kcs-blue-200">
                  <KeyRound size={20} />
                </div>
                <h3 className="mt-4 text-xl font-bold text-kcs-blue-900 dark:text-white">Reset password</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Enter your email to receive a secure link, or paste the token from the link to set a new password.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResetOpen(false)}
                className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-kcs-blue-700 dark:hover:bg-kcs-blue-900"
                aria-label="Close password reset"
              >
                <X size={18} />
              </button>
            </div>

            {resetMessage && (
              <div className="mt-5 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200">
                <CheckCircle2 size={17} className="mt-0.5 flex-shrink-0" />
                <span>{resetMessage}</span>
              </div>
            )}

            {resetError && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                {resetError}
              </div>
            )}

            <form onSubmit={resetForm.handleSubmit(handlePasswordReset)} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input {...resetForm.register('email')} className="input-kcs pl-11" placeholder="name@kcsnexus.edu" />
                </div>
                {resetForm.formState.errors.email && <p className="mt-1 text-xs text-red-500">{resetForm.formState.errors.email.message}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">Reset token</label>
                <input {...resetForm.register('token')} className="input-kcs" placeholder="Paste token from email link" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">New password</label>
                  <input {...resetForm.register('password')} type="password" className="input-kcs" placeholder="8+ characters" />
                  {resetForm.formState.errors.password && <p className="mt-1 text-xs text-red-500">{resetForm.formState.errors.password.message}</p>}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">Confirm</label>
                  <input {...resetForm.register('confirmPassword')} type="password" className="input-kcs" placeholder="Repeat password" />
                  {resetForm.formState.errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{resetForm.formState.errors.confirmPassword.message}</p>}
                </div>
              </div>

              <button type="submit" disabled={resetSubmitting} className="btn-primary flex w-full items-center justify-center gap-2 py-3 disabled:opacity-60">
                <Send size={16} /> {resetSubmitting ? 'Processing...' : 'Continue'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default LoginPage
