import { useState } from 'react'
import { Camera, CheckCircle2, Eye, EyeOff, KeyRound, Mail, Shield, UserCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

type AccountSettingsPanelProps = {
  roleLabel?: string
}

const inputClass = 'rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-kcs-blue-900 outline-none transition-colors focus:border-kcs-blue-500 focus:ring-2 focus:ring-kcs-blue-100 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white dark:focus:border-kcs-blue-400 dark:focus:ring-kcs-blue-800/60'
const passwordInputClass = 'min-w-0 flex-1 bg-white px-4 py-3 text-sm text-kcs-blue-900 outline-none transition-colors dark:bg-kcs-blue-950 dark:text-white dark:[color-scheme:dark] dark:[&:-webkit-autofill]:[-webkit-text-fill-color:#ffffff] dark:[&:-webkit-autofill]:[box-shadow:0_0_0_1000px_#0f2352_inset]'

const accountStatusItems: Array<[string, string, LucideIcon]> = [
  ['Profile completeness', '92%', UserCheck],
  ['Password status', 'Protected', KeyRound],
  ['Two-step security', 'Ready to enable', Shield],
]

const notificationSettings: Array<[string, string, LucideIcon]> = [
  ['Email notifications', 'Receive academic, finance, attendance, and security alerts by email.', Mail],
  ['Security alerts', 'Notify this account after password, profile, and device changes.', Shield],
]

const AccountSettingsPanel = ({ roleLabel }: AccountSettingsPanelProps) => {
  const { user } = useAuthStore()
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Portal user'
  const initials = `${user?.firstName?.[0] ?? 'K'}${user?.lastName?.[0] ?? 'C'}`.toUpperCase()
  const passwordFields = [
    ['current', 'Current password', 'Current password'],
    ['new', 'New password', 'New password'],
    ['confirm', 'Confirm password', 'Confirm password'],
  ]

  return (
    <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
      <section className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
        <div className="flex items-center gap-4">
          <div className="relative flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl bg-kcs-blue-100 text-2xl font-black text-kcs-blue-700 dark:bg-kcs-blue-800 dark:text-kcs-blue-100">
            {initials}
            <button type="button" className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-kcs-blue-700 text-white shadow-lg hover:bg-kcs-blue-800" aria-label="Change profile photo">
              <Camera size={16} />
            </button>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-kcs-blue-600 dark:text-kcs-blue-300">{roleLabel ?? user?.role ?? 'Account'}</p>
            <h2 className="font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{displayName}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email ?? 'email pending'}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3">
          {accountStatusItems.map(([label, value, Icon]) => (
            <div key={label} className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-kcs-blue-200">
                <Icon size={16} />
              </span>
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</p>
                <p className="font-bold text-kcs-blue-900 dark:text-white">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">Account Settings</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Update profile, password, photo, communication, and account preferences.</p>
          </div>
          <button type="button" className="inline-flex items-center justify-center gap-2 rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-kcs-blue-800">
            <CheckCircle2 size={16} /> Save changes
          </button>
        </div>

        <div className="mt-5 grid gap-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
              First name
              <input className={inputClass} defaultValue={user?.firstName ?? ''} />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
              Last name
              <input className={inputClass} defaultValue={user?.lastName ?? ''} />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
              Email
              <input className={inputClass} type="email" defaultValue={user?.email ?? ''} />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
              Phone
              <input className={inputClass} placeholder="+243 ..." />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {passwordFields.map(([id, label, placeholder]) => (
              <label key={id} className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                {label}
                <span className="flex items-center overflow-hidden rounded-xl border border-gray-200 bg-white pr-2 focus-within:border-kcs-blue-500 focus-within:ring-2 focus-within:ring-kcs-blue-100 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:focus-within:border-kcs-blue-400 dark:focus-within:ring-kcs-blue-800/60">
                  <input
                    className={passwordInputClass}
                    type={visiblePasswords[id] ? 'text' : 'password'}
                    placeholder={placeholder}
                  />
                  <button
                    type="button"
                    onClick={() => setVisiblePasswords((current) => ({ ...current, [id]: !current[id] }))}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-kcs-blue-700 dark:text-gray-300 dark:hover:bg-kcs-blue-800"
                    aria-label={visiblePasswords[id] ? `Hide ${label}` : `Show ${label}`}
                  >
                    {visiblePasswords[id] ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </span>
              </label>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {notificationSettings.map(([title, detail, Icon]) => (
              <label key={title} className="flex items-start gap-3 rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                <input type="checkbox" defaultChecked className="mt-1 h-4 w-4 rounded border-gray-300 text-kcs-blue-700 focus:ring-kcs-blue-500" />
                <span className="flex-1">
                  <span className="flex items-center gap-2 font-bold text-kcs-blue-900 dark:text-white"><Icon size={15} /> {title}</span>
                  <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{detail}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export default AccountSettingsPanel
