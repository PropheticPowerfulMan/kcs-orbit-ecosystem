import { useState, useRef } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import {
  CheckCircle2, ChevronRight, FileText, Upload, User, Users,
  GraduationCap, Calendar, ClipboardList, ArrowRight, Star
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { SCHOOL_DIVISIONS, SCHOOL_LEVELS } from '@/constants/schoolLevels'
import { admissionsAPI } from '@/services/api'

/* ────────────── Animation helpers ────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
}
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}
const AnimSection = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.div ref={ref} variants={stagger} initial="hidden" animate={inView ? 'visible' : 'hidden'} className={className}>
      {children}
    </motion.div>
  )
}

/* ────────────── Data ────────────── */
const steps = [
  { num: 1, title: 'Submit Application', desc: 'Complete the online form with student and family details.', icon: ClipboardList },
  { num: 2, title: 'Document Review', desc: 'Our admissions team reviews transcripts, recommendation letters, and required documents.', icon: FileText },
  { num: 3, title: 'Entrance Assessment', desc: 'Scheduled assessment in English, Math, and general knowledge for new students.', icon: GraduationCap },
  { num: 4, title: 'Parent Interview', desc: 'A meeting with the Principal and Admissions Director to discuss school fit and expectations.', icon: Users },
  { num: 5, title: 'Admission Decision', desc: 'You will receive a decision within 5-10 business days via email.', icon: CheckCircle2 },
  { num: 6, title: 'Enrollment & Registration', desc: 'Complete enrollment forms, pay registration fees, and join the KCS family!', icon: Star },
]

const requirements = [
  'Completed online application form',
  'Birth certificate',
  'Previous school transcript',
  'Parent or guardian contact information',
  'Requested class level',
  'Additional comments for the admissions team',
]

const programs = SCHOOL_DIVISIONS.map((division, index) => ({
  name: division.title,
  grades: division.levels,
  age: index === 0 ? 'Early learners' : index === 1 ? 'Primary learners' : index === 2 ? 'Adolescents' : 'Teens',
  tuition: index === 0 ? 'Faith & readiness' : index === 1 ? 'Strong foundation' : index === 2 ? 'Knowledge & character' : 'Future readiness',
  spots: [8, 12, 6, 10][index],
}))

/* ────────────── Zod Form Schema ────────────── */
const STEPS = ['Student', 'Parent', 'Documents', 'Review'] as const
type Step = (typeof STEPS)[number]
const DOCUMENT_FIELDS = [
  { key: 'birthCertificate', label: 'Birth Certificate' },
  { key: 'transcript', label: 'Previous School Transcript' },
  { key: 'additional', label: 'Additional Required Documents' },
] as const

const studentSchema = z.object({
  firstName:      z.string().min(2, 'Required'),
  lastName:       z.string().min(2, 'Required'),
  dateOfBirth:    z.string().min(1, 'Required'),
  nationality:    z.string().min(2, 'Required'),
  applyingGrade:  z.string().min(1, 'Select a grade'),
  currentSchool:  z.string().min(2, 'Required'),
  languages:      z.string().optional(),
})
const parentSchema = z.object({
  parentName:   z.string().min(2, 'Required'),
  relationship: z.string().min(2, 'Required'),
  email:        z.string().email('Valid email required'),
  phone:        z.string().min(8, 'Valid phone required'),
  address:      z.string().min(5, 'Required'),
  occupation:   z.string().optional(),
})

type StudentData = z.infer<typeof studentSchema>
type ParentData  = z.infer<typeof parentSchema>

const SCHOOL_ADMISSIONS_EMAIL = 'kinshasachristianschool@gmail.com'
const ADMIN_ADMISSIONS_STORAGE_KEY = 'kcs-admin-admission-submissions'
const isStaticAdmissionsSite = import.meta.env.PROD && !import.meta.env.VITE_API_URL

const buildAdmissionEmailBody = (
  applicationNumber: string,
  studentData: StudentData,
  parentData: ParentData,
  notes: string,
  documents: Record<string, File | null>,
) => {
  const documentNames = Object.values(documents).filter(Boolean).map((file) => file?.name).join(', ') || 'No documents attached online'

  return [
    `New KCS online admission application: ${applicationNumber}`,
    '',
    'STUDENT INFORMATION',
    `First name: ${studentData.firstName}`,
    `Last name: ${studentData.lastName}`,
    `Date of birth: ${studentData.dateOfBirth}`,
    `Nationality: ${studentData.nationality}`,
    `Grade applying: ${studentData.applyingGrade}`,
    `Previous/current school: ${studentData.currentSchool}`,
    `Languages spoken: ${studentData.languages || 'Not provided'}`,
    '',
    'PARENT / GUARDIAN INFORMATION',
    `Name: ${parentData.parentName}`,
    `Relationship: ${parentData.relationship}`,
    `Email: ${parentData.email}`,
    `Phone: ${parentData.phone}`,
    `Address: ${parentData.address}`,
    `Occupation: ${parentData.occupation || 'Not provided'}`,
    '',
    'NOTES',
    notes || 'Not provided',
    '',
    'DOCUMENTS',
    documentNames,
  ].join('\n')
}

const buildAdmissionMailtoHref = (
  applicationNumber: string,
  studentData: StudentData,
  parentData: ParentData,
  notes: string,
  documents: Record<string, File | null>,
) => {
  const subject = `New KCS online admission - ${applicationNumber} - ${studentData.firstName} ${studentData.lastName}`
  const body = buildAdmissionEmailBody(applicationNumber, studentData, parentData, notes, documents)
  return `mailto:${SCHOOL_ADMISSIONS_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

const saveApplicationForAdmin = (
  applicationNumber: string,
  studentData: StudentData,
  parentData: ParentData,
  notes: string,
  documents: Record<string, File | null>,
) => {
  if (typeof window === 'undefined') return

  const existing = JSON.parse(window.localStorage.getItem(ADMIN_ADMISSIONS_STORAGE_KEY) || '[]')
  const nextApplication = {
    id: applicationNumber,
    applicationNumber,
    firstName: studentData.firstName,
    lastName: studentData.lastName,
    studentName: `${studentData.firstName} ${studentData.lastName}`,
    dateOfBirth: studentData.dateOfBirth,
    nationality: studentData.nationality,
    gradeApplying: studentData.applyingGrade,
    previousSchool: studentData.currentSchool,
    languages: studentData.languages ?? '',
    parentName: parentData.parentName,
    parentEmail: parentData.email,
    parentPhone: parentData.phone,
    relationship: parentData.relationship,
    address: parentData.address,
    occupation: parentData.occupation ?? '',
    notes,
    documents: Object.values(documents).filter(Boolean).map((file) => file?.name),
    status: 'SUBMITTED',
    submittedAt: new Date().toISOString(),
  }

  const withoutDuplicate = existing.filter((item: { applicationNumber?: string }) => item.applicationNumber !== applicationNumber)
  window.localStorage.setItem(ADMIN_ADMISSIONS_STORAGE_KEY, JSON.stringify([nextApplication, ...withoutDuplicate]))
}

const sendAdmissionFallbackEmail = async (
  applicationNumber: string,
  studentData: StudentData,
  parentData: ParentData,
  notes: string,
  documents: Record<string, File | null>,
) => {
  const fallbackData = new FormData()
  fallbackData.append('_subject', `New KCS online admission - ${applicationNumber} - ${studentData.firstName} ${studentData.lastName}`)
  fallbackData.append('_template', 'table')
  fallbackData.append('_captcha', 'false')
  fallbackData.append('_replyto', parentData.email)
  fallbackData.append('_autoresponse', `Thank you for applying to Kinshasa Christian School. Your application ID is ${applicationNumber}.`)
  fallbackData.append('Application number', applicationNumber)
  fallbackData.append('Student first name', studentData.firstName)
  fallbackData.append('Student last name', studentData.lastName)
  fallbackData.append('Date of birth', studentData.dateOfBirth)
  fallbackData.append('Nationality', studentData.nationality)
  fallbackData.append('Grade applying', studentData.applyingGrade)
  fallbackData.append('Previous/current school', studentData.currentSchool)
  fallbackData.append('Languages spoken', studentData.languages ?? 'Not provided')
  fallbackData.append('Parent/guardian name', parentData.parentName)
  fallbackData.append('Relationship', parentData.relationship)
  fallbackData.append('Parent email', parentData.email)
  fallbackData.append('Parent phone', parentData.phone)
  fallbackData.append('Address', parentData.address)
  fallbackData.append('Occupation', parentData.occupation ?? 'Not provided')
  fallbackData.append('Notes', notes || 'Not provided')
  Object.entries(documents).forEach(([key, file]) => {
    if (file) fallbackData.append(`Document provided - ${key}`, file.name)
  })

  const response = await fetch(`https://formsubmit.co/ajax/${SCHOOL_ADMISSIONS_EMAIL}`, {
    method: 'POST',
    body: fallbackData,
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) throw new Error('Fallback email service failed')
  return response.json()
}

/* ────────────── Component ────────────── */
const AdmissionsPage = () => {
  const [activeStep, setActiveStep] = useState<Step>('Student')
  const [studentData, setStudentData] = useState<StudentData | null>(null)
  const [parentData,  setParentData]  = useState<ParentData  | null>(null)
  const [documents, setDocuments] = useState<Record<string, File | null>>({})
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitWarning, setSubmitWarning] = useState('')
  const [applicationId, setApplicationId] = useState('')
  const [manualEmailHref, setManualEmailHref] = useState('')

  const stepIdx = STEPS.indexOf(activeStep)

  const studentForm = useForm<StudentData>({ resolver: zodResolver(studentSchema) })
  const parentForm  = useForm<ParentData>({  resolver: zodResolver(parentSchema) })

  const handleStudentSubmit = (data: StudentData) => {
    setStudentData(data)
    setActiveStep('Parent')
  }
  const handleParentSubmit = (data: ParentData) => {
    setParentData(data)
    setActiveStep('Documents')
  }
  const handleDocumentChange = (key: string, files: FileList | null) => {
    setDocuments((current) => ({ ...current, [key]: files?.[0] ?? null }))
  }

  const handleFinalSubmit = async () => {
    if (!studentData || !parentData) return

    setSubmitting(true)
    setSubmitError('')
    setSubmitWarning('')
    setManualEmailHref('')

    try {
      const applicationNumber = `KCS-${Date.now().toString().slice(-6)}`

      if (isStaticAdmissionsSite) {
        await sendAdmissionFallbackEmail(applicationNumber, studentData, parentData, notes, documents)
        saveApplicationForAdmin(applicationNumber, studentData, parentData, notes, documents)
        setApplicationId(applicationNumber)
        setSubmitWarning('Application sent to the school email. Uploaded file names were included; large documents should also be sent directly to the admissions office if requested.')
        setManualEmailHref(buildAdmissionMailtoHref(applicationNumber, studentData, parentData, notes, documents))
        setSubmitted(true)
        return
      }

      const formData = new FormData()
      formData.append('firstName', studentData.firstName)
      formData.append('lastName', studentData.lastName)
      formData.append('dateOfBirth', studentData.dateOfBirth)
      formData.append('gender', 'Not specified')
      formData.append('nationality', studentData.nationality)
      formData.append('gradeApplying', studentData.applyingGrade)
      formData.append('previousSchool', studentData.currentSchool)
      formData.append('languages', studentData.languages ?? '')
      formData.append('parentName', parentData.parentName)
      formData.append('relationship', parentData.relationship)
      formData.append('parentEmail', parentData.email)
      formData.append('parentPhone', parentData.phone)
      formData.append('address', parentData.address)
      formData.append('occupation', parentData.occupation ?? '')
      formData.append('notes', notes)

      Object.values(documents).forEach((file) => {
        if (file) formData.append('documents', file)
      })

      const response = await admissionsAPI.create(formData)
      const savedApplicationNumber = response.data?.data?.applicationNumber || applicationNumber
      const emailSent = response.data?.data?.emailDelivery?.sent

      if (!emailSent) {
        try {
          await sendAdmissionFallbackEmail(savedApplicationNumber, studentData, parentData, notes, documents)
          setSubmitWarning('Application saved. The school mail server needs SMTP configuration, so a backup email notification was sent to the school address.')
        } catch (fallbackError) {
          console.error('Admission backup email failed after API submission:', fallbackError)
          setSubmitWarning(`Application saved successfully, but the email notification could not be sent automatically. Please contact the school at ${SCHOOL_ADMISSIONS_EMAIL} with your application number.`)
          setManualEmailHref(buildAdmissionMailtoHref(savedApplicationNumber, studentData, parentData, notes, documents))
        }
      }

      saveApplicationForAdmin(savedApplicationNumber, studentData, parentData, notes, documents)
      setApplicationId(savedApplicationNumber)
      setSubmitted(true)
    } catch (error) {
      const fallbackApplicationNumber = `KCS-${Date.now().toString().slice(-6)}`

      try {
        await sendAdmissionFallbackEmail(fallbackApplicationNumber, studentData, parentData, notes, documents)
        saveApplicationForAdmin(fallbackApplicationNumber, studentData, parentData, notes, documents)
        setApplicationId(fallbackApplicationNumber)
        setSubmitWarning('The live admissions API was unavailable, so the application was sent directly to the school email using the backup channel.')
        setManualEmailHref(buildAdmissionMailtoHref(fallbackApplicationNumber, studentData, parentData, notes, documents))
        setSubmitted(true)
      } catch {
        console.error('Admission submission failed:', error)
        setManualEmailHref(buildAdmissionMailtoHref(fallbackApplicationNumber, studentData, parentData, notes, documents))
        setSubmitError(`We could not send the application automatically. Please email the school directly at ${SCHOOL_ADMISSIONS_EMAIL} or try again in a few minutes.`)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white dark:bg-kcs-blue-950 min-h-screen">
      {/* Hero */}
      <section className="relative bg-kcs-blue-900 text-white py-24 overflow-hidden">
        <div className="absolute inset-0 dots-bg opacity-30" />
        <div className="absolute inset-0 hero-overlay" />
        <div className="relative container-custom text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-kcs-gold-500/20 text-kcs-gold-300 text-sm font-medium mb-6 border border-kcs-gold-500/30">
              <Star size={14} /> Admissions 2025–2026 Now Open
            </span>
            <h1 className="text-4xl md:text-6xl font-bold font-display mb-4">
              Begin Your <span className="text-kcs-gold-400">KCS Journey</span>
            </h1>
            <p className="text-kcs-blue-200 text-lg max-w-2xl mx-auto mb-8">
              Kinshasa Christian School welcomes families seeking an excellence-driven, faith-based American education for their children.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <a href="#apply" className="btn-gold">Apply Now <ArrowRight size={16} className="inline ml-1" /></a>
              <a href="#programs" className="btn-primary bg-white/10 border border-white/20">View Programs</a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Available Programs */}
      <section id="programs" className="section-padding bg-gray-50 dark:bg-kcs-blue-900/30">
        <div className="container-custom">
          <AnimSection>
            <motion.div variants={fadeUp} className="text-center mb-12">
              <h2 className="text-3xl font-bold font-display text-kcs-blue-900 dark:text-white mb-3">Available Programs</h2>
              <p className="text-gray-500 dark:text-gray-400">Spaces available for the 2025–2026 academic year</p>
            </motion.div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {programs.map((p) => (
                <motion.div key={p.name} variants={fadeUp} className="card-hover bg-white dark:bg-kcs-blue-900 rounded-2xl p-6 text-center border border-gray-100 dark:border-kcs-blue-800">
                  <div className="w-12 h-12 kcs-gradient rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <GraduationCap size={24} className="text-white" />
                  </div>
                  <h3 className="font-bold text-kcs-blue-900 dark:text-white mb-1">{p.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{p.grades} · {p.age}</p>
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-kcs-blue-800">
                    <p className="text-lg font-bold text-kcs-blue-700 dark:text-kcs-blue-300">{p.tuition}</p>
                    <p className="text-xs text-gray-400">{p.spots} spots remaining</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimSection>
        </div>
      </section>

      {/* Admission Process */}
      <section className="section-padding bg-white dark:bg-kcs-blue-950">
        <div className="container-custom">
          <AnimSection>
            <motion.div variants={fadeUp} className="text-center mb-12">
              <h2 className="text-3xl font-bold font-display text-kcs-blue-900 dark:text-white mb-3">Admission Process</h2>
              <p className="text-gray-500 dark:text-gray-400">Six simple steps to joining KCS</p>
            </motion.div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {steps.map(({ num, title, desc, icon: Icon }) => (
                <motion.div key={num} variants={fadeUp} className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-2xl kcs-gradient flex items-center justify-center">
                      <Icon size={22} className="text-white" />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-kcs-gold-600 dark:text-kcs-gold-400 mb-0.5">Step {num}</p>
                    <h3 className="font-bold text-kcs-blue-900 dark:text-white mb-1">{title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimSection>
        </div>
      </section>

      {/* Requirements */}
      <section className="section-padding bg-kcs-blue-900 text-white">
        <div className="container-custom">
          <AnimSection>
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div variants={fadeUp}>
                <h2 className="text-3xl font-bold font-display mb-4">Required Documents</h2>
                <p className="text-kcs-blue-200 mb-6">Please prepare the following documents before beginning your application.</p>
                <ul className="space-y-3">
                  {requirements.map((req) => (
                    <li key={req} className="flex items-center gap-3">
                      <CheckCircle2 size={18} className="text-kcs-gold-400 flex-shrink-0" />
                      <span className="text-kcs-blue-100">{req}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
              <motion.div variants={fadeUp} className="glass-card rounded-2xl p-6 bg-white/5 border border-white/10">
                <h3 className="font-bold text-xl mb-4">Key Dates 2025–2026</h3>
                {[
                  { date: 'Now – Jun 30', label: 'Applications Open' },
                  { date: 'Jul 1 – Jul 15', label: 'Entrance Assessments' },
                  { date: 'Jul 20', label: 'Decisions Released' },
                  { date: 'Aug 1 – Aug 15', label: 'Enrollment Period' },
                  { date: 'Aug 25', label: 'First Day of School' },
                ].map(({ date, label }) => (
                  <div key={label} className="flex justify-between items-center py-2.5 border-b border-white/10 last:border-0">
                    <span className="text-kcs-blue-200 text-sm">{label}</span>
                    <span className="text-kcs-gold-400 font-semibold text-sm">{date}</span>
                  </div>
                ))}
              </motion.div>
            </div>
          </AnimSection>
        </div>
      </section>

      {/* Application Form */}
      <section id="apply" className="section-padding bg-gray-50 dark:bg-kcs-blue-900/20">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold font-display text-kcs-blue-900 dark:text-white mb-3">Online Application</h2>
              <p className="text-gray-500 dark:text-gray-400">Complete all sections to submit your application.</p>
            </div>

            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-kcs-blue-900/50 rounded-2xl p-10 text-center border border-gray-100 dark:border-kcs-blue-800 shadow-kcs"
              >
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-5">
                  <CheckCircle2 size={40} className="text-green-600" />
                </div>
                <h3 className="text-2xl font-bold font-display text-kcs-blue-900 dark:text-white mb-2">Application Submitted!</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">Thank you for applying to KCS. We will be in touch within 5–10 business days.</p>
                <div className="inline-block bg-kcs-blue-50 dark:bg-kcs-blue-900/30 rounded-xl px-6 py-3 border border-kcs-blue-100 dark:border-kcs-blue-800">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Your Application ID</p>
                  <p className="text-2xl font-bold text-kcs-blue-700 dark:text-kcs-blue-300 tracking-wider">{applicationId}</p>
                </div>
                <p className="text-xs text-gray-400 mt-4">Save this ID to track your application status.</p>
                {submitWarning && (
                  <p className="mx-auto mt-4 max-w-xl rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-900/40 dark:bg-yellow-900/20 dark:text-yellow-200">
                    {submitWarning}
                  </p>
                )}
                {manualEmailHref && (
                  <a
                    href={manualEmailHref}
                    className="mt-4 inline-flex items-center justify-center rounded-xl bg-kcs-blue-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-kcs-blue-800"
                  >
                    Open email manually
                  </a>
                )}
              </motion.div>
            ) : (
              <div className="bg-white dark:bg-kcs-blue-900/50 rounded-2xl border border-gray-100 dark:border-kcs-blue-800 shadow-kcs overflow-hidden">
                {/* Step Progress */}
                <div className="flex border-b border-gray-100 dark:border-kcs-blue-800">
                  {STEPS.map((s, i) => (
                    <button
                      key={s}
                      onClick={() => { if (i < stepIdx) setActiveStep(s) }}
                      className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                        s === activeStep ? 'text-kcs-blue-700 dark:text-kcs-blue-300 border-b-2 border-kcs-blue-600 bg-kcs-blue-50/50 dark:bg-kcs-blue-800/30' :
                        i < stepIdx ? 'text-green-600 dark:text-green-400' :
                        'text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      {i < stepIdx ? <CheckCircle2 size={16} /> : <span className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-xs font-bold">{i + 1}</span>}
                      <span className="hidden sm:inline">{s}</span>
                    </button>
                  ))}
                </div>

                <div className="p-8">
                  <AnimatePresence mode="wait">
                    {/* Step 1: Student Info */}
                    {activeStep === 'Student' && (
                      <motion.form key="student" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                        onSubmit={studentForm.handleSubmit(handleStudentSubmit)}
                        className="space-y-5">
                        <h3 className="font-bold text-kcs-blue-900 dark:text-white flex items-center gap-2">
                          <User size={18} className="text-kcs-blue-600" /> Student Information
                        </h3>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">First Name *</label>
                            <input {...studentForm.register('firstName')} className="input-kcs" placeholder="e.g. Grace" />
                            {studentForm.formState.errors.firstName && <p className="text-xs text-red-500 mt-1">{studentForm.formState.errors.firstName.message}</p>}
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Last Name *</label>
                            <input {...studentForm.register('lastName')} className="input-kcs" placeholder="e.g. Mutombo" />
                            {studentForm.formState.errors.lastName && <p className="text-xs text-red-500 mt-1">{studentForm.formState.errors.lastName.message}</p>}
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Date of Birth *</label>
                            <input type="date" {...studentForm.register('dateOfBirth')} className="input-kcs" />
                            {studentForm.formState.errors.dateOfBirth && <p className="text-xs text-red-500 mt-1">{studentForm.formState.errors.dateOfBirth.message}</p>}
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Nationality *</label>
                            <input {...studentForm.register('nationality')} className="input-kcs" placeholder="e.g. Congolese" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Applying for Grade *</label>
                            <select {...studentForm.register('applyingGrade')} className="input-kcs">
                              <option value="">Select grade...</option>
                              {SCHOOL_LEVELS.map(g => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                            </select>
                            {studentForm.formState.errors.applyingGrade && <p className="text-xs text-red-500 mt-1">{studentForm.formState.errors.applyingGrade.message}</p>}
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Current School *</label>
                            <input {...studentForm.register('currentSchool')} className="input-kcs" placeholder="School name" />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Languages Spoken</label>
                            <input {...studentForm.register('languages')} className="input-kcs" placeholder="e.g. English, French, Lingala" />
                          </div>
                        </div>
                        <div className="flex justify-end pt-2">
                          <button type="submit" className="btn-primary flex items-center gap-2">
                            Next: Parent Info <ChevronRight size={16} />
                          </button>
                        </div>
                      </motion.form>
                    )}

                    {/* Step 2: Parent Info */}
                    {activeStep === 'Parent' && (
                      <motion.form key="parent" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                        onSubmit={parentForm.handleSubmit(handleParentSubmit)}
                        className="space-y-5">
                        <h3 className="font-bold text-kcs-blue-900 dark:text-white flex items-center gap-2">
                          <Users size={18} className="text-kcs-blue-600" /> Parent / Guardian Information
                        </h3>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Full Name *</label>
                            <input {...parentForm.register('parentName')} className="input-kcs" placeholder="Parent full name" />
                            {parentForm.formState.errors.parentName && <p className="text-xs text-red-500 mt-1">{parentForm.formState.errors.parentName.message}</p>}
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Relationship to Student *</label>
                            <select {...parentForm.register('relationship')} className="input-kcs">
                              <option value="">Select...</option>
                              <option>Father</option>
                              <option>Mother</option>
                              <option>Guardian</option>
                              <option>Other</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Email Address *</label>
                            <input type="email" {...parentForm.register('email')} className="input-kcs" placeholder="parent@email.com" />
                            {parentForm.formState.errors.email && <p className="text-xs text-red-500 mt-1">{parentForm.formState.errors.email.message}</p>}
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Phone Number *</label>
                            <input {...parentForm.register('phone')} className="input-kcs" placeholder="+243 81 000 0000" />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Home Address *</label>
                            <input {...parentForm.register('address')} className="input-kcs" placeholder="Full address in Kinshasa" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Occupation</label>
                            <input {...parentForm.register('occupation')} className="input-kcs" placeholder="e.g. Engineer" />
                          </div>
                        </div>
                        <div className="flex justify-between pt-2">
                          <button type="button" onClick={() => setActiveStep('Student')} className="btn-primary bg-gray-100 dark:bg-kcs-blue-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200">
                            Back
                          </button>
                          <button type="submit" className="btn-primary flex items-center gap-2">
                            Next: Documents <ChevronRight size={16} />
                          </button>
                        </div>
                      </motion.form>
                    )}

                    {/* Step 3: Documents */}
                    {activeStep === 'Documents' && (
                      <motion.div key="docs" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                        <h3 className="font-bold text-kcs-blue-900 dark:text-white flex items-center gap-2 mb-5">
                          <Upload size={18} className="text-kcs-blue-600" /> Upload Documents
                        </h3>
                        <div className="space-y-4">
                          {DOCUMENT_FIELDS.map((doc) => (
                            <div key={doc.key} className="flex items-center justify-between p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-kcs-blue-700 hover:border-kcs-blue-400 dark:hover:border-kcs-blue-500 transition-colors group">
                              <div className="flex items-center gap-3">
                                <FileText size={20} className="text-gray-400 group-hover:text-kcs-blue-500 transition-colors" />
                                <div>
                                  <span className="block text-sm text-gray-700 dark:text-gray-300">{doc.label}</span>
                                  {documents[doc.key] && (
                                    <span className="text-xs text-kcs-blue-600 dark:text-kcs-blue-300">{documents[doc.key]?.name}</span>
                                  )}
                                </div>
                              </div>
                              <label className="cursor-pointer text-xs font-semibold text-kcs-blue-600 dark:text-kcs-blue-400 hover:underline">
                                Upload PDF / JPG
                                <input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  className="hidden"
                                  onChange={(event) => handleDocumentChange(doc.key, event.target.files)}
                                />
                              </label>
                            </div>
                          ))}
                        </div>
                        <div className="mt-5">
                          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Additional comments</label>
                          <textarea
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            className="input-kcs min-h-28 resize-y"
                            placeholder="Anything the admissions team should know?"
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-3">* Documents can also be submitted in person at the KCS Admissions Office.</p>
                        <div className="flex justify-between pt-6">
                          <button onClick={() => setActiveStep('Parent')} className="btn-primary bg-gray-100 dark:bg-kcs-blue-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200">
                            Back
                          </button>
                          <button onClick={() => setActiveStep('Review')} className="btn-primary flex items-center gap-2">
                            Review Application <ChevronRight size={16} />
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 4: Review */}
                    {activeStep === 'Review' && studentData && parentData && (
                      <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                        <h3 className="font-bold text-kcs-blue-900 dark:text-white mb-5">Review & Submit</h3>
                        <div className="grid sm:grid-cols-2 gap-6 mb-6">
                          <div className="p-4 rounded-xl bg-gray-50 dark:bg-kcs-blue-800/30 border border-gray-100 dark:border-kcs-blue-800">
                            <h4 className="font-semibold text-sm text-kcs-blue-900 dark:text-white mb-3 flex items-center gap-2"><User size={14} /> Student</h4>
                            {[
                              ['Name', `${studentData.firstName} ${studentData.lastName}`],
                              ['DOB', studentData.dateOfBirth],
                              ['Nationality', studentData.nationality],
                              ['Applying For', studentData.applyingGrade],
                              ['Current School', studentData.currentSchool],
                            ].map(([k, v]) => (
                              <div key={k} className="flex justify-between text-xs py-1 border-b border-gray-100 dark:border-kcs-blue-700 last:border-0">
                                <span className="text-gray-500 dark:text-gray-400">{k}</span>
                                <span className="font-medium text-gray-700 dark:text-gray-300">{v}</span>
                              </div>
                            ))}
                          </div>
                          <div className="p-4 rounded-xl bg-gray-50 dark:bg-kcs-blue-800/30 border border-gray-100 dark:border-kcs-blue-800">
                            <h4 className="font-semibold text-sm text-kcs-blue-900 dark:text-white mb-3 flex items-center gap-2"><Users size={14} /> Parent</h4>
                            {[
                              ['Name', parentData.parentName],
                              ['Relationship', parentData.relationship],
                              ['Email', parentData.email],
                              ['Phone', parentData.phone],
                            ].map(([k, v]) => (
                              <div key={k} className="flex justify-between text-xs py-1 border-b border-gray-100 dark:border-kcs-blue-700 last:border-0">
                                <span className="text-gray-500 dark:text-gray-400">{k}</span>
                                <span className="font-medium text-gray-700 dark:text-gray-300">{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="p-4 rounded-xl bg-kcs-blue-50 dark:bg-kcs-blue-900/30 border border-kcs-blue-100 dark:border-kcs-blue-800 mb-6">
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input type="checkbox" required className="mt-0.5 w-4 h-4 accent-kcs-blue-600" />
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                              I confirm that all information provided is accurate and complete. I agree to the KCS{' '}
                              <a href="/about" className="text-kcs-blue-600 dark:text-kcs-blue-400 underline">Terms & Conditions</a> and{' '}
                              <a href="/about" className="text-kcs-blue-600 dark:text-kcs-blue-400 underline">Privacy Policy</a>.
                            </span>
                          </label>
                        </div>
                        {submitError && (
                          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                            {submitError}
                          </p>
                        )}
                        {manualEmailHref && (
                          <a
                            href={manualEmailHref}
                            className="mb-4 inline-flex rounded-xl bg-kcs-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-kcs-blue-800"
                          >
                            Open email manually
                          </a>
                        )}
                        <div className="flex justify-between">
                          <button onClick={() => setActiveStep('Documents')} className="btn-primary bg-gray-100 dark:bg-kcs-blue-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200">
                            Back
                          </button>
                          <button onClick={handleFinalSubmit} disabled={submitting} className="btn-gold flex items-center gap-2 disabled:opacity-60">
                            {submitting ? 'Submitting...' : 'Submit Application'} <ArrowRight size={16} />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

export default AdmissionsPage
