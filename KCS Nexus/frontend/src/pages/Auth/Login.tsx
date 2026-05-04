import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Lock, LogIn, Mail, ShieldCheck } from 'lucide-react'
import { authAPI } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import type { User, UserRole } from '@/types'

const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginFormValues = z.infer<typeof loginSchema>

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
  firstName: account.firstName,
  lastName: account.lastName,
  role: account.role,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

const LoginPage = () => {
  const navigate = useNavigate()
  const { login, logout, user, isAuthenticated, setLoading, isLoading } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const resolveDestination = (role: UserRole) => {
    return role === 'admin' ? '/admin' : `/portal/${role}`
  }

  const handleSuccessfulLogin = (user: User) => {
    logout()
    login(user, 'demo-access-token', 'demo-refresh-token')
    navigate(resolveDestination(user.role), { replace: true })
  }

  const enterSuperAdmin = () => {
    setErrorMessage('')
    handleSuccessfulLogin(buildDemoUser(superAdminAccount))
  }

  const onSubmit = async (values: LoginFormValues) => {
    setLoading(true)
    setErrorMessage('')

    try {
      const demoAccount = findDemoAccount(values)
      if (demoAccount) {
        handleSuccessfulLogin(buildDemoUser(demoAccount))
        return
      }

      const response = await authAPI.login(values.email.trim(), values.password)
      const data = response.data?.data
      if (!data?.user || !data?.token || !data?.refreshToken) {
        throw new Error('Invalid authentication response')
      }
      login(data.user, data.token, data.refreshToken)
      navigate(resolveDestination(data.user.role), { replace: true })
    } catch (err: any) {
      const demoAccount = findDemoAccount(values)
      if (demoAccount) {
        handleSuccessfulLogin(buildDemoUser(demoAccount))
      } else {
        // Afficher l’erreur réelle du backend si disponible
        let message = 'Login failed. Use one of the demo accounts or connect the backend auth service.'
        if (err?.response?.data?.message) {
          message = `Erreur API: ${err.response.data.message}. Pour le Super Admin demo, utilisez superadmin@kcsnexus.com / SuperAdmin123!.`
        } else if (err?.message) {
          message = `Erreur: ${err.message}. Pour le Super Admin demo, utilisez superadmin@kcsnexus.com / SuperAdmin123!.`
        }
        setErrorMessage(message)
      }
    } finally {
      setLoading(false)
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
                  Use your KCS credentials or one of the demo accounts.
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
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input {...form.register('email')} className="input-kcs pl-11" placeholder="name@kcsnexus.edu" />
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
                  <button type="button" className="font-medium text-kcs-blue-600 dark:text-kcs-blue-400">
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
    </div>
  )
}

export default LoginPage
