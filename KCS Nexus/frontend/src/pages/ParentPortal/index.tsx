import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bell, BookOpen, Calendar, CheckCircle2, Clock, FileText, Mail, Phone, TrendingUp, UserRound } from 'lucide-react'
import PortalSidebar from '@/components/layout/PortalSidebar'
import AccountSettingsPanel from '@/components/shared/AccountSettingsPanel'
import SuggestionBox from '@/components/shared/SuggestionBox'
import OfficialTranscriptPanel from '@/components/shared/OfficialTranscriptPanel'
import { eventsAPI, messagesAPI, notificationsAPI, studentsAPI } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { getLocalizedGreeting, getLocalizedPortalDate } from '@/utils/portalGreeting'

type ParentChild = {
  id: string
  localProfileId?: string | null
  studentNumber: string
  name: string
  grade: string
  avatar: string | null
  gpa: number | null
  attendance: number | null
  academicSummary?: {
    average: number | null
    attendanceRate: number | null
    publishedGrades: number
    attendanceRecords: number
    pendingAssignments: number
    overdueAssignments: number
    enrolledCourses: number
  }
}
type Grade = { id: string; score: number; maxScore: number; percentage: number; letterGrade: string; period: string; createdAt: string; course?: { name?: string; code?: string } }
type Assignment = { id: string; status: string; score?: number | null; assignment?: { title?: string; dueDate?: string; course?: { name?: string } } }
type Attendance = { id: string; date: string; className: string; period?: string | null; subject?: string | null; status: string; note?: string | null }
type Schedule = { id?: string; day: string; startTime: string; endTime: string; room: string }
type EventItem = { id: string; title: string; description?: string; startDate: string; endDate: string; location: string; type: string }
type Notice = { id: string; title: string; message: string; type: string; isRead: boolean; createdAt: string; link?: string }
type Contact = { id: string; firstName: string; lastName: string; role: string }
type InternalMessage = { id: string; subject: string; body: string; createdAt: string; readAt?: string | null; senderId: string; recipientId?: string; sender?: Contact; recipient?: Contact }

const card = 'rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50'
const button = 'rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-kcs-blue-800 disabled:cursor-not-allowed disabled:opacity-50'
const field = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-kcs-blue-950 outline-none focus:border-kcs-blue-500 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white'
const empty = (text: string) => <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500 dark:bg-kcs-blue-800/30 dark:text-gray-300">{text}</p>
const segmentFrom = (pathname: string) => {
  const value = pathname.split('/').filter(Boolean).at(-1)
  return !value || value === 'parent' || value === 'dashboard' ? 'dashboard' : value
}
const displayDate = (value?: string) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'
const personName = (person?: Contact) => person ? `${person.firstName} ${person.lastName}`.trim() : 'KCS'

function downloadCalendarEvent(event: EventItem) {
  const stamp = (value: string) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const clean = (value: string) => value.replace(/[\\,;]/g, (char) => `\\${char}`).replace(/\n/g, '\\n')
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//KCS Nexus//Parent Portal//EN', 'BEGIN:VEVENT', `UID:${event.id}@kinshasachristianschool.org`, `DTSTAMP:${stamp(new Date().toISOString())}`, `DTSTART:${stamp(event.startDate)}`, `DTEND:${stamp(event.endDate)}`, `SUMMARY:${clean(event.title)}`, `DESCRIPTION:${clean(event.description ?? '')}`, `LOCATION:${clean(event.location)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${event.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'kcs-event'}.ics`
  link.click()
  URL.revokeObjectURL(url)
}

export default function ParentPortal() {
  const { user } = useAuthStore()
  const { language } = useUIStore()
  const location = useLocation()
  const segment = segmentFrom(location.pathname)
  const [children, setChildren] = useState<ParentChild[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [grades, setGrades] = useState<Grade[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [timetable, setTimetable] = useState<Schedule[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [notices, setNotices] = useState<Notice[]>([])
  const [messages, setMessages] = useState<InternalMessage[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [recipientId, setRecipientId] = useState('')
  const [subject, setSubject] = useState('')
  const [messageBody, setMessageBody] = useState('')
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState('')

  const selectedChild = useMemo(() => children.find((child) => child.id === selectedId) ?? children[0] ?? null, [children, selectedId])
  const upcoming = useMemo(() => events.filter((event) => new Date(event.endDate).getTime() >= Date.now()).slice(0, 12), [events])
  const unread = notices.filter((notice) => !notice.isRead).length
  const academicSummary = selectedChild?.academicSummary

  useEffect(() => {
    let active = true
    Promise.allSettled([studentsAPI.getMyChildren(), eventsAPI.getAll(), notificationsAPI.getAll(), messagesAPI.getAll(), messagesAPI.getContacts()])
      .then((results) => {
        if (!active) return
        const childPayload = results[0].status === 'fulfilled' ? results[0].value.data?.data : []
        const loaded = (Array.isArray(childPayload) ? childPayload : []).map((profile: any): ParentChild => ({
          id: String(profile.id), localProfileId: profile.localProfileId ? String(profile.localProfileId) : null,
          studentNumber: String(profile.studentNumber ?? ''),
          name: [profile.user?.lastName, profile.user?.middleName, profile.user?.firstName].filter(Boolean).join(' ') || String(profile.studentNumber ?? 'Student'),
          grade: [profile.grade, profile.section].filter(Boolean).join(' '), avatar: profile.user?.avatar ?? null,
          gpa: null, attendance: null, academicSummary: profile.academicSummary,
        }))
        setChildren(loaded)
        setSelectedId((current) => current || loaded[0]?.id || '')
        if (results[1].status === 'fulfilled') setEvents(Array.isArray(results[1].value.data?.data) ? results[1].value.data.data : [])
        if (results[2].status === 'fulfilled') setNotices(Array.isArray(results[2].value.data?.data) ? results[2].value.data.data : [])
        if (results[3].status === 'fulfilled') setMessages(Array.isArray(results[3].value.data?.data) ? results[3].value.data.data : [])
        if (results[4].status === 'fulfilled') {
          const values = Array.isArray(results[4].value.data?.data) ? results[4].value.data.data : []
          setContacts(values)
          setRecipientId(values[0]?.id ?? '')
        }
        if (results[0].status === 'rejected') setError(results[0].reason?.response?.data?.message ?? 'Unable to load the children linked to this family.')
      })
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  useEffect(() => {
    const profileId = selectedChild?.localProfileId
    if (!profileId) { setGrades([]); setAssignments([]); setAttendance([]); setTimetable([]); return }
    let active = true
    setDetailLoading(true)
    Promise.allSettled([studentsAPI.getGrades(profileId), studentsAPI.getAssignments(profileId), studentsAPI.getAttendance(profileId), studentsAPI.getTimetable(profileId)])
      .then(([gradeResult, assignmentResult, attendanceResult, timetableResult]) => {
        if (!active) return
        setGrades(gradeResult.status === 'fulfilled' && Array.isArray(gradeResult.value.data?.data) ? gradeResult.value.data.data : [])
        setAssignments(assignmentResult.status === 'fulfilled' && Array.isArray(assignmentResult.value.data?.data) ? assignmentResult.value.data.data : [])
        setAttendance(attendanceResult.status === 'fulfilled' && Array.isArray(attendanceResult.value.data?.data) ? attendanceResult.value.data.data : [])
        setTimetable(timetableResult.status === 'fulfilled' && Array.isArray(timetableResult.value.data?.data) ? timetableResult.value.data.data : [])
      })
      .finally(() => active && setDetailLoading(false))
    return () => { active = false }
  }, [selectedChild?.localProfileId])

  const sendMessage = async () => {
    if (!recipientId || subject.trim().length < 2 || !messageBody.trim()) return
    setSending(true); setFeedback('')
    try {
      const response = await messagesAPI.send({ recipientId, subject: `${subject.trim()} — ${selectedChild?.name ?? 'Family'}`, body: messageBody.trim() })
      setMessages((items) => [response.data.data, ...items]); setSubject(''); setMessageBody(''); setFeedback('Message sent and saved in your family history.')
    } catch (reason: any) { setFeedback(reason?.response?.data?.message ?? 'The message could not be sent.') }
    finally { setSending(false) }
  }

  const markNotice = async (notice: Notice) => {
    if (notice.isRead) return
    await notificationsAPI.markRead(notice.id)
    setNotices((items) => items.map((item) => item.id === notice.id ? { ...item, isRead: true } : item))
  }

  const title = segment === 'dashboard' ? 'Family Dashboard' : ({ performance: 'Academic Performance', grades: 'Grades & Reports', messages: 'School Messages', calendar: 'School Calendar', finance: 'Finance & EduPay', profile: 'Family Profile', settings: 'Account Settings' } as Record<string, string>)[segment] ?? 'Parent Portal'

  const academics = (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {[['Verified average', academicSummary?.average != null ? academicSummary.average + '%' : '—'], ['Verified attendance', academicSummary?.attendanceRate != null ? academicSummary.attendanceRate + '%' : 'Aucune donnée'], ['Recorded grades', String(academicSummary?.publishedGrades ?? grades.length)]].map(([label, value]) => <div key={label} className={card}><p className="text-xs font-bold uppercase tracking-wide text-gray-400">{label}</p><p className="mt-2 text-3xl font-bold text-kcs-blue-900 dark:text-white">{value}</p></div>)}
      </div>
      <div className={card}>
        <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Grades for {selectedChild?.name}</h2>
        {detailLoading ? empty('Loading academic records…') : grades.length === 0 ? empty('No grade has been published for this student yet.') : <div className="overflow-x-auto"><table className="min-w-[620px] w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-gray-400"><th className="pb-3">Course</th><th className="pb-3">Period</th><th className="pb-3 text-right">Score</th><th className="pb-3 text-right">Published</th></tr></thead><tbody>{grades.map((grade) => <tr key={grade.id} className="border-b border-gray-50 dark:border-kcs-blue-800"><td className="py-3 font-semibold dark:text-white">{grade.course?.name ?? grade.course?.code ?? 'Course'}</td><td>{grade.period}</td><td className="text-right font-bold">{grade.score}/{grade.maxScore} ({grade.percentage.toFixed(1)}%)</td><td className="text-right">{displayDate(grade.createdAt)}</td></tr>)}</tbody></table></div>}
      </div>
      <div className={card}><h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Assignments</h2>{assignments.length === 0 ? empty('No assignment is currently linked to this student.') : <div className="grid gap-3 md:grid-cols-2">{assignments.map((item) => <div key={item.id} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30"><p className="font-semibold dark:text-white">{item.assignment?.title ?? 'Assignment'}</p><p className="mt-1 text-sm text-gray-500">{item.assignment?.course?.name ?? 'Course'} · due {displayDate(item.assignment?.dueDate)}</p><span className="mt-2 inline-block rounded-full bg-kcs-blue-100 px-2 py-1 text-xs font-bold text-kcs-blue-700">{item.status}</span></div>)}</div>}</div>
      <div className="grid gap-6 xl:grid-cols-2"><div className={card}><h2 className="mb-4 font-bold dark:text-white">Verified attendance history</h2>{attendance.length === 0 ? empty('No attendance record has been entered yet.') : <div className="space-y-2">{attendance.slice(0,12).map((record) => <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 p-3 text-sm dark:bg-kcs-blue-800/30"><span><strong className="dark:text-white">{displayDate(record.date)}</strong><span className="block text-xs text-gray-500">{record.subject || record.className}{record.period ? ' · ' + record.period : ''}</span></span><span className="rounded-full bg-kcs-blue-100 px-3 py-1 text-xs font-bold text-kcs-blue-700">{record.status}</span></div>)}</div>}</div><div className={card}><h2 className="mb-4 font-bold dark:text-white">Published timetable</h2>{timetable.length === 0 ? empty('No timetable has been published for this child.') : <div className="space-y-2">{timetable.slice(0,12).map((slot,index) => <div key={slot.id ?? index} className="flex justify-between rounded-xl bg-gray-50 p-3 text-sm dark:bg-kcs-blue-800/30"><span className="font-semibold dark:text-white">{slot.day}</span><span className="text-gray-500">{slot.startTime}–{slot.endTime} · {slot.room}</span></div>)}</div>}</div></div>
      <OfficialTranscriptPanel studentId={selectedChild?.id} />
    </div>
  )

  const content = segment === 'settings' ? <AccountSettingsPanel roleLabel="Parent account" /> : segment === 'performance' || segment === 'grades' ? academics : segment === 'messages' ? (
    <div className="grid gap-6 xl:grid-cols-2"><div className={card}><h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Conversation history</h2>{messages.length === 0 ? empty('No school message yet.') : <div className="space-y-3">{messages.map((item) => <div key={item.id} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30"><div className="flex justify-between gap-3"><p className="font-semibold dark:text-white">{item.subject}</p><span className="text-xs text-gray-400">{displayDate(item.createdAt)}</span></div><p className="mt-1 text-xs font-semibold text-kcs-blue-600">{item.senderId === user?.id ? `To ${personName(item.recipient)}` : `From ${personName(item.sender)}`}</p><p className="mt-2 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">{item.body}</p></div>)}</div>}</div><div className={card}><h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Write to the school</h2><div className="space-y-3"><select className={field} value={recipientId} onChange={(event) => setRecipientId(event.target.value)}><option value="">Select an authorized contact</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{personName(contact)} — {contact.role}</option>)}</select><input className={field} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" maxLength={160}/><textarea className={`${field} min-h-36`} value={messageBody} onChange={(event) => setMessageBody(event.target.value)} placeholder={`Message regarding ${selectedChild?.name ?? 'your family'}`} maxLength={10000}/><button className={`${button} w-full`} disabled={sending || !recipientId || subject.trim().length < 2 || !messageBody.trim()} onClick={() => void sendMessage()}>{sending ? 'Sending…' : 'Send securely'}</button>{feedback && <p className="rounded-xl bg-kcs-blue-50 p-3 text-sm text-kcs-blue-800 dark:bg-kcs-blue-800 dark:text-white">{feedback}</p>}</div></div></div>
  ) : segment === 'calendar' ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{upcoming.length === 0 ? empty('No upcoming school event has been published.') : upcoming.map((event) => <div key={event.id} className={card}><p className="text-xs font-bold uppercase text-kcs-blue-600">{event.type}</p><h2 className="mt-2 font-bold dark:text-white">{event.title}</h2><p className="mt-2 text-sm text-gray-500">{displayDate(event.startDate)} · {event.location}</p><p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{event.description}</p><button className={`${button} mt-4 w-full`} onClick={() => downloadCalendarEvent(event)}>Add to my calendar</button></div>)}</div>
  : segment === 'finance' ? <div className={card}><div className="flex items-start gap-4"><div className="rounded-xl bg-kcs-gold-100 p-3 text-kcs-gold-700"><FileText/></div><div><h2 className="text-xl font-bold text-kcs-blue-900 dark:text-white">EduPay is the official financial source</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-300">Payments, balances, receipts and bank-transfer proofs are managed only in the parent EduPay portal. KCS Nexus never marks an invoice as paid and never generates an unverified receipt.</p><a className={`${button} mt-5 inline-block`} href="https://edupay.kinshasachristianschool.org/" target="_blank" rel="noreferrer">Open EduPay securely</a></div></div></div>
  : segment === 'profile' ? <div className="grid gap-6 xl:grid-cols-2"><div className={card}><div className="flex items-center gap-4"><div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-kcs-blue-100 text-xl font-bold text-kcs-blue-700">{user?.firstName?.[0]}{user?.lastName?.[0]}</div><div><h2 className="text-2xl font-bold dark:text-white">{`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'KCS Parent'}</h2><p className="text-sm text-gray-500">Authorized family account</p></div></div><div className="mt-5 space-y-2 text-sm"><a className="flex items-center gap-2 text-kcs-blue-700 dark:text-kcs-blue-300" href={`mailto:${user?.email}`}><Mail size={16}/>{user?.email}</a>{user?.phone && <a className="flex items-center gap-2 text-kcs-blue-700 dark:text-kcs-blue-300" href={`tel:${user.phone}`}><Phone size={16}/>{user.phone}</a>}</div></div><div className={card}><h2 className="mb-4 font-bold dark:text-white">Children linked to this account</h2><div className="space-y-3">{children.map((child) => <button key={child.id} onClick={() => setSelectedId(child.id)} className="flex w-full items-center justify-between rounded-xl bg-gray-50 p-4 text-left dark:bg-kcs-blue-800/30"><span><strong className="block dark:text-white">{child.name}</strong><span className="text-sm text-gray-500">{child.grade} · {child.studentNumber}</span></span><CheckCircle2 className="text-green-500" size={20}/></button>)}</div></div></div>
  : <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[[BookOpen,'Children',String(children.length)],[TrendingUp,'Verified average',academicSummary?.average != null ? academicSummary.average + '%' : '—'],[CheckCircle2,'Verified attendance',academicSummary?.attendanceRate != null ? academicSummary.attendanceRate + '%' : 'Aucune donnée'],[Bell,'Overdue assignments',String(academicSummary?.overdueAssignments ?? 0)]].map(([Icon,label,value]: any) => <div key={label} className={card}><Icon className="text-kcs-blue-600" size={22}/><p className="mt-3 text-xs font-bold uppercase text-gray-400">{label}</p><p className="mt-1 text-3xl font-bold text-kcs-blue-900 dark:text-white">{value}</p></div>)}</div><div className="grid gap-6 xl:grid-cols-2"><div className={card}><div className="mb-4 flex items-center justify-between"><h2 className="font-bold dark:text-white">Latest grades</h2><Link to="/portal/parent/grades" className="text-sm font-semibold text-kcs-blue-600">View all</Link></div>{grades.slice(0,5).length === 0 ? empty('No grade has been published yet.') : grades.slice(0,5).map((grade) => <div key={grade.id} className="flex justify-between border-b py-3 text-sm dark:border-kcs-blue-800"><span className="dark:text-white">{grade.course?.name ?? 'Course'}</span><strong className="text-kcs-blue-700 dark:text-kcs-blue-300">{grade.percentage.toFixed(1)}%</strong></div>)}</div><div className={card}><div className="mb-4 flex items-center justify-between"><h2 className="font-bold dark:text-white">Notifications</h2><Link to="/portal/parent/messages" className="text-sm font-semibold text-kcs-blue-600">Messages</Link></div>{notices.slice(0,6).length === 0 ? empty('No notification at this time.') : notices.slice(0,6).map((notice) => <button key={notice.id} onClick={() => void markNotice(notice)} className={`mb-2 w-full rounded-xl p-3 text-left ${notice.isRead ? 'bg-gray-50 dark:bg-kcs-blue-800/20' : 'bg-kcs-blue-50 dark:bg-kcs-blue-800/50'}`}><span className="block text-sm font-semibold dark:text-white">{notice.title}</span><span className="mt-1 block text-xs text-gray-500 dark:text-gray-300">{notice.message}</span></button>)}</div></div><div className={card}><div className="mb-4 flex items-center justify-between"><h2 className="font-bold dark:text-white">Upcoming school events</h2><Link to="/portal/parent/calendar" className="text-sm font-semibold text-kcs-blue-600">Full calendar</Link></div><div className="grid gap-3 md:grid-cols-3">{upcoming.slice(0,3).length === 0 ? empty('No upcoming event.') : upcoming.slice(0,3).map((event) => <div key={event.id} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30"><Calendar size={18} className="text-kcs-gold-600"/><p className="mt-2 font-semibold dark:text-white">{event.title}</p><p className="mt-1 text-xs text-gray-500">{displayDate(event.startDate)}</p></div>)}</div></div></div>

  return <div className="flex min-h-screen bg-gray-50 dark:bg-kcs-blue-950"><PortalSidebar/><main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-7xl"><div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-semibold text-kcs-gold-600">{getLocalizedGreeting(language)}{user?.firstName ? `, ${user.firstName}` : ''}</p><h1 className="mt-1 font-display text-3xl font-bold text-kcs-blue-950 dark:text-white">{title}</h1><p className="mt-1 text-sm text-gray-500">{getLocalizedPortalDate(language)}</p></div>{children.length > 0 && <label className="min-w-64 text-xs font-bold uppercase text-gray-400">Active child<select className={`${field} mt-1 normal-case`} value={selectedChild?.id ?? ''} onChange={(event) => setSelectedId(event.target.value)}>{children.map((child) => <option key={child.id} value={child.id}>{child.name} — {child.grade}</option>)}</select></label>}</div>{error && <p className="mb-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}{loading ? <div className={card}><div className="flex items-center gap-3 text-gray-500"><Clock className="animate-spin" size={20}/>Loading the secure family workspace…</div></div> : children.length === 0 ? <div className={card}><UserRound className="text-kcs-blue-500"/><h2 className="mt-3 text-xl font-bold dark:text-white">No child is linked to this parent account</h2><p className="mt-2 text-sm text-gray-500">Please contact the school registry. The portal does not infer or expose unverified family links.</p></div> : content}<div className="mt-8"><SuggestionBox/></div></div></main></div>
}
