import { useEffect, useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, BookOpen, Mail, Phone, Plus, ShieldAlert, UserRound, Users } from 'lucide-react'
import PortalSidebar from '@/components/layout/PortalSidebar'
import SearchField from '@/components/shared/SearchField'
import { SCHOOL_LEVELS } from '@/constants/schoolLevels'
import { registryAPI } from '@/services/api'

type RegistryFamily = {
  id: string
  familyLabel: string
  studentCount: number
  parents: Array<{ id?: string; externalId?: string; relation: string; parent: { firstName: string; lastName: string; fullName: string; email?: string; phone?: string } }>
  children: Array<{ id: string; externalId?: string; studentNumber: string; grade: string; section: string; status?: string; student: { firstName: string; lastName: string; fullName: string; email?: string } }>
}

const SchoolRegistryPage = () => {
  const [families, setFamilies] = useState<RegistryFamily[]>([])
  const [source, setSource] = useState<'orbit' | 'local'>('local')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [registrationNotice, setRegistrationNotice] = useState('')
  const [query, setQuery] = useState('')
  const [form, setForm] = useState({
    studentFirst: '',
    studentLast: '',
    studentNumber: '',
    grade: '',
    section: 'A',
    parentFirst: '',
    parentLast: '',
    parentEmail: '',
    parentPhone: '',
    relation: 'Parent',
  })

  useEffect(() => {
    const loadFamilies = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await registryAPI.getFamilies()
        setFamilies(response.data.data.families)
        setSource(response.data.data.source)
      } catch {
        setError('Unable to load the registry at the moment.')
      } finally {
        setLoading(false)
      }
    }

    void loadFamilies()
  }, [])

  const filteredFamilies = families.filter((family) => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return true

    const parentHaystack = family.parents
      .flatMap((item) => [item.id, item.externalId, item.parent.fullName, item.parent.email, item.parent.phone, item.relation])
      .filter(Boolean)
      .join(' ')

    const childHaystack = family.children
      .flatMap((child) => [child.id, child.externalId, child.student.fullName, child.studentNumber, child.grade, child.section, child.status])
      .filter(Boolean)
      .join(' ')

    const haystack = `${family.id} ${family.familyLabel} ${parentHaystack} ${childHaystack}`.toLowerCase()
    return haystack.includes(normalizedQuery)
  })

  const registerFamily = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.studentFirst || !form.studentLast || !form.studentNumber || !form.parentEmail) return
    setError('')
    setRegistrationNotice('')

    try {
      const registration = await registryAPI.registerFamily({
        parent: {
          firstName: form.parentFirst,
          lastName: form.parentLast,
          email: form.parentEmail,
          phone: form.parentPhone,
          relationship: form.relation,
        },
        student: {
          firstName: form.studentFirst,
          lastName: form.studentLast,
          studentNumber: form.studentNumber,
          grade: form.grade,
          section: form.section,
        },
      })

      const registrationData = registration.data?.data
      const parentAccessCode = typeof registrationData?.parent?.accessCode === 'string' ? registrationData.parent.accessCode : ''
      const studentAccessCode = typeof registrationData?.student?.accessCode === 'string' ? registrationData.student.accessCode : ''
      if (parentAccessCode || studentAccessCode) {
        setRegistrationNotice([
          parentAccessCode ? `Parent access code: ${parentAccessCode}` : '',
          studentAccessCode ? `Student access code: ${studentAccessCode}` : '',
        ].filter(Boolean).join(' | '))
      }

      const response = await registryAPI.getFamilies()
      setFamilies(response.data.data.families)
      setSource(response.data.data.source)
    } catch {
      setError('Unable to register this family from KCS Nexus.')
      return
    }

    setForm({ studentFirst: '', studentLast: '', studentNumber: '', grade: '', section: 'A', parentFirst: '', parentLast: '', parentEmail: '', parentPhone: '', relation: 'Parent' })
  }

  return (
    <div className="portal-shell flex">
      <PortalSidebar />
      <main>
        <div className="sticky top-0 z-20 border-b border-gray-100 bg-white/85 px-6 py-4 backdrop-blur-md dark:border-kcs-blue-800 dark:bg-kcs-blue-950/85">
          <h1 className="font-display text-xl font-bold text-kcs-blue-900 dark:text-white">Family and Student Registry</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Central registration for every parent and student in the school.</p>
        </div>

        <div className="grid gap-6 p-6 xl:grid-cols-[0.85fr_1.35fr]">
          {source === 'local' ? (
            <form onSubmit={registerFamily} className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-kcs-blue-50 text-kcs-blue-700 dark:bg-kcs-blue-900/40 dark:text-kcs-blue-300">
                  <Plus size={20} />
                </div>
                <div>
                  <h2 className="font-bold text-kcs-blue-900 dark:text-white">Register a Family</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Local registry mode is active because Orbit is not configured for this portal.</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['studentFirst', 'Student first name'],
                  ['studentLast', 'Student last name'],
                  ['studentNumber', 'Student number'],
                  ['parentFirst', 'Parent first name'],
                  ['parentLast', 'Parent last name'],
                  ['parentEmail', 'Parent email'],
                  ['parentPhone', 'Parent phone'],
                ].map(([key, label]) => (
                  <input
                    key={key}
                    value={form[key as keyof typeof form]}
                    onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                    placeholder={label}
                    className="input-kcs"
                  />
                ))}
                <select value={form.grade} onChange={(event) => setForm({ ...form, grade: event.target.value })} className="input-kcs">
                  <option value="">Select level</option>
                  {SCHOOL_LEVELS.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
                <select value={form.section} onChange={(event) => setForm({ ...form, section: event.target.value })} className="input-kcs">
                  <option>A</option>
                  <option>B</option>
                  <option>C</option>
                </select>
                <select value={form.relation} onChange={(event) => setForm({ ...form, relation: event.target.value })} className="input-kcs">
                  <option>Parent</option>
                  <option>Mother</option>
                  <option>Father</option>
                  <option>Guardian</option>
                </select>
              </div>
              {registrationNotice ? (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">
                  {registrationNotice}
                </div>
              ) : null}
              <button type="submit" className="btn-primary mt-5 inline-flex w-full items-center justify-center gap-2">
                <Plus size={18} /> Register Family
              </button>
            </form>
          ) : (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-100">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-800/40 dark:text-amber-200">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h2 className="font-bold">Orbit-backed registry</h2>
                  <p className="text-xs opacity-80">KCS Nexus is reading the consolidated registry from Orbit. Family creation should stay in the owning source systems.</p>
                </div>
              </div>
              <p className="text-sm leading-6">This page is now acting as a unified reader. Academic ownership remains in SAVANEX and financial ownership remains in EduPay, while KCS Nexus displays the federated picture.</p>
            </section>
          )}

          <section className="space-y-4">
            {loading ? (
              <div className="rounded-2xl border border-gray-100 bg-white p-5 text-sm text-gray-500 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50 dark:text-gray-300">Loading registry...</div>
            ) : null}
            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-200">
                <div className="flex items-center gap-2"><AlertCircle size={16} /> {error}</div>
              </div>
            ) : null}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Students', value: families.reduce((sum, item) => sum + item.children.length, 0), icon: BookOpen },
                { label: 'Parent links', value: families.reduce((sum, item) => sum + item.parents.length, 0), icon: Users },
                { label: 'Grades covered', value: new Set(families.flatMap((item) => item.children.map((child) => child.grade))).size, icon: UserRound },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
                  <Icon size={18} className="mb-3 text-kcs-blue-600" />
                  <p className="font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{value}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <SearchField wrapperClassName="mb-4" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student, parent, class, grade, or any ID" inputClassName="border-gray-200 bg-gray-50 text-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-800/40 dark:text-white" />

              <div className="space-y-3">
                {filteredFamilies.map((family, index) => (
                  <motion.div
                    key={family.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/20"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-kcs-blue-900 dark:text-white">{family.familyLabel}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{family.studentCount} student{family.studentCount > 1 ? 's' : ''} · {family.parents.length} parent link{family.parents.length > 1 ? 's' : ''}</p>
                      </div>
                      <span className="badge-blue">Active</span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {family.parents.map(({ parent, relation }) => (
                        <div key={`${family.id}-${parent.fullName}-${relation}`} className="rounded-xl bg-white p-3 text-sm dark:bg-kcs-blue-900/50">
                          <p className="font-semibold text-kcs-blue-900 dark:text-white">{parent.firstName} {parent.lastName} <span className="text-xs font-normal text-gray-400">({relation})</span></p>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500"><Mail size={12} /> {parent.email || 'No email recorded'}</p>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500"><Phone size={12} /> {parent.phone || 'No phone recorded'}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-xl border border-gray-100 bg-white/70 p-3 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/30">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Children linked in this family</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        {family.children.map((child) => (
                          <div key={child.id} className="rounded-xl border border-gray-100 bg-white p-3 text-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-950/40">
                            <p className="font-semibold text-kcs-blue-900 dark:text-white">{child.student.fullName}</p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{child.studentNumber} · {child.grade} · Section {child.section}</p>
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Status: {child.status || 'ACTIVE'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

export default SchoolRegistryPage
