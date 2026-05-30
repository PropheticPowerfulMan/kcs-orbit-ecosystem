import { useMemo, useState } from 'react'
import { Eye, LockKeyhole, MessageSquareText, Send, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { getUserDisplayName } from '@/utils/portalGreeting'

type SuggestionRecord = {
  id: string
  createdAt: string
  category: string
  message: string
  anonymousRole: string
  privateIdentity: {
    userId: string
    fullName: string
    email: string
    role: string
  }
}

const STORAGE_KEY = 'kcs-nexus-anonymous-suggestions-v1'

function readSuggestions(): SuggestionRecord[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]') as SuggestionRecord[]
  } catch {
    return []
  }
}

function writeSuggestions(records: SuggestionRecord[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 100)))
}

export default function SuggestionBox() {
  const { user } = useAuthStore()
  const { language } = useUIStore()
  const [category, setCategory] = useState('wellbeing')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [revealedId, setRevealedId] = useState<string | null>(null)
  const [records, setRecords] = useState<SuggestionRecord[]>(readSuggestions)
  const isAdmin = user?.role === 'admin'

  const labels = useMemo(() => ({
    title: language === 'fr' ? 'Boîte à suggestions' : 'Suggestion box',
    subtitle: language === 'fr'
      ? 'Le message reste anonyme dans le suivi normal.'
      : 'The normal view stays anonymous.',
    send: language === 'fr' ? 'Envoyer en anonymat' : 'Send anonymously',
    sent: language === 'fr' ? 'Suggestion enregistrée dans le canal confidentiel.' : 'Suggestion saved in the confidential channel.',
    audit: language === 'fr' ? 'Audit super admin' : 'Super admin audit',
    reveal: language === 'fr' ? 'Voir identité' : 'Reveal identity',
  }), [language])

  const submit = () => {
    const cleanMessage = message.trim()
    if (!cleanMessage || !user) return

    const next: SuggestionRecord = {
      id: `SUG-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      category,
      message: cleanMessage,
      anonymousRole: user.role,
      privateIdentity: {
        userId: user.id,
        fullName: getUserDisplayName(user),
        email: user.email,
        role: user.role,
      },
    }
    const nextRecords = [next, ...records]
    writeSuggestions(nextRecords)
    setRecords(nextRecords)
    setMessage('')
    setSent(true)
  }

  return (
    <section className="rounded-2xl border border-white/12 bg-kcs-blue-950/70 p-5 text-white shadow-[0_24px_70px_rgba(0,27,54,0.28)] backdrop-blur-2xl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-kcs-gold-300">
            <MessageSquareText size={16} /> {labels.title}
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-kcs-blue-100">{labels.subtitle}</p>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-bold text-cyan-100">
          <LockKeyhole size={14} /> Private seal
        </div>
      </div>

      {!isAdmin && (
        <div className="mt-4 grid gap-3 lg:grid-cols-[220px_1fr_auto]">
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-sm text-white outline-none">
            <option value="wellbeing">Wellbeing</option>
            <option value="discipline">Discipline</option>
            <option value="teaching">Teaching</option>
            <option value="finance">Finance</option>
            <option value="safety">Safety</option>
            <option value="other">Other</option>
          </select>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="min-h-24 rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-sm text-white outline-none placeholder:text-kcs-blue-200"
            placeholder={language === 'fr' ? 'Écrivez librement votre suggestion...' : 'Write your suggestion freely...'}
          />
          <button type="button" onClick={submit} className="inline-flex items-center justify-center gap-2 rounded-xl bg-kcs-gold-400 px-4 py-3 text-sm font-black text-kcs-blue-950 transition-colors hover:bg-kcs-gold-300">
            <Send size={16} /> {labels.send}
          </button>
        </div>
      )}

      {sent && <p className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-100">{labels.sent}</p>}

      {isAdmin && (
        <div className="mt-4 space-y-3">
          <p className="flex items-center gap-2 text-sm font-bold text-cyan-100"><ShieldCheck size={16} /> {labels.audit}</p>
          {records.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-kcs-blue-100">No suggestion recorded yet.</p>
          ) : records.slice(0, 6).map((record) => (
            <div key={record.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-kcs-gold-300">{record.id} - {record.anonymousRole} - {record.category}</p>
                <button type="button" onClick={() => setRevealedId(revealedId === record.id ? null : record.id)} className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-cyan-100 hover:bg-white/10">
                  <Eye size={14} /> {labels.reveal}
                </button>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white">{record.message}</p>
              {revealedId === record.id && (
                <p className="mt-3 rounded-lg border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100">
                  {record.privateIdentity.fullName} - {record.privateIdentity.email} - {record.privateIdentity.role} - {record.privateIdentity.userId}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
