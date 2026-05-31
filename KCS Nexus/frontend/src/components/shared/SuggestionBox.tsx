import { useMemo, useState } from 'react'
import { Eye, Filter, LockKeyhole, MessageSquareText, Printer, Search, Send, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { getUserDisplayName } from '@/utils/portalGreeting'
import { getAssetUrl } from '@/utils/assets'

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
const SCHOOL_NAME = 'Kinshasa Christian School'
const SCHOOL_LOGO_SRC = getAssetUrl('images/kcs-logo.png')

function readSuggestions(): SuggestionRecord[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]') as SuggestionRecord[]
  } catch {
    return []
  }
}

function writeSuggestions(records: SuggestionRecord[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 300)))
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function printSuggestionReport(records: SuggestionRecord[], scopeLabel: string) {
  const logoUrl = typeof window === 'undefined' ? SCHOOL_LOGO_SRC : new URL(SCHOOL_LOGO_SRC, window.location.origin).href
  const generatedAt = new Date().toLocaleString()
  const documentId = `KCS-SUG-${Date.now().toString(36).toUpperCase()}`
  const categoryCounts = records.reduce<Record<string, number>>((acc, record) => {
    acc[record.category] = (acc[record.category] || 0) + 1
    return acc
  }, {})
  const rows = records.map((record, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><strong>${escapeHtml(record.id)}</strong><br><small>${escapeHtml(new Date(record.createdAt).toLocaleString())}</small></td>
      <td>${escapeHtml(record.category)}</td>
      <td>${escapeHtml(record.anonymousRole)}</td>
      <td>${escapeHtml(record.message)}</td>
      <td>${escapeHtml(record.privateIdentity.fullName)}<br><small>${escapeHtml(record.privateIdentity.email)} - ${escapeHtml(record.privateIdentity.role)}</small></td>
    </tr>
  `).join('')
  const chips = Object.entries(categoryCounts).map(([category, count]) => `<span>${escapeHtml(category)}: <strong>${count}</strong></span>`).join('')

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Rapport suggestions KCS</title><style>
    body { margin: 0; background: #eef4fb; color: #0f172a; font-family: Arial, sans-serif; }
    .sheet { min-height: 100vh; padding: 26px; border-top: 10px solid #004080; background: #fff; position: relative; overflow: hidden; }
    .watermark { position: absolute; inset: 190px auto auto 50%; width: 470px; height: 470px; transform: translateX(-50%); opacity: .045; object-fit: contain; }
    header { display: flex; justify-content: space-between; gap: 18px; border-bottom: 1px solid #dbe4f0; padding-bottom: 18px; position: relative; z-index: 1; }
    .brand { display: flex; align-items: center; gap: 14px; }
    .logo { width: 66px; height: 66px; object-fit: contain; border: 1px solid #dbe4f0; border-radius: 16px; padding: 6px; background: white; }
    .school { margin: 0; color: #004080; font-weight: 900; font-size: 20px; }
    .tag { margin: 4px 0 0; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .12em; }
    .badge { border: 1px solid #c8a64d; border-radius: 18px; padding: 12px 14px; color: #004080; font-size: 12px; text-align: right; }
    h1 { color: #004080; margin: 24px 0 8px; font-size: 28px; }
    .scope { color: #475569; margin: 0 0 18px; }
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 18px 0; position: relative; z-index: 1; }
    .metric { border: 1px solid #dbe4f0; border-radius: 16px; padding: 12px; background: #f8fbff; }
    .metric span { display: block; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 800; }
    .metric strong { display: block; color: #004080; font-size: 20px; margin-top: 6px; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 20px; }
    .chips span { border: 1px solid #dbe4f0; border-radius: 999px; padding: 7px 10px; background: #f8fbff; font-size: 12px; }
    table { border-collapse: collapse; width: 100%; font-size: 11px; position: relative; z-index: 1; }
    th { background: #004080; color: white; text-align: left; padding: 9px; }
    td { border-bottom: 1px solid #e2e8f0; padding: 9px; vertical-align: top; }
    footer { display: flex; justify-content: space-between; gap: 16px; margin-top: 24px; border-top: 1px solid #dbe4f0; padding-top: 12px; color: #64748b; font-size: 10px; }
    @media print { body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .sheet { padding: 0; border-top-width: 8px; } }
  </style></head><body><main class="sheet">
    <img class="watermark" src="${escapeHtml(logoUrl)}" alt="">
    <header>
      <section class="brand"><img class="logo" src="${escapeHtml(logoUrl)}" alt="Logo ${escapeHtml(SCHOOL_NAME)}"><div><p class="school">${escapeHtml(SCHOOL_NAME)}</p><p class="tag">Rapport officiel des suggestions</p></div></section>
      <aside class="badge"><strong>Document confidentiel</strong><br>${escapeHtml(documentId)}<br>${escapeHtml(generatedAt)}</aside>
    </header>
    <h1>Registre super admin des suggestions</h1>
    <p class="scope">Filtre analytique: ${escapeHtml(scopeLabel || 'Toutes les suggestions')} - Generation: ${escapeHtml(generatedAt)}</p>
    <section class="metrics">
      <div class="metric"><span>Total</span><strong>${records.length}</strong></div>
      <div class="metric"><span>Categories</span><strong>${Object.keys(categoryCounts).length}</strong></div>
      <div class="metric"><span>Roles</span><strong>${new Set(records.map((r) => r.anonymousRole)).size}</strong></div>
      <div class="metric"><span>Canal</span><strong>Confidentiel</strong></div>
    </section>
    <section class="chips">${chips || '<span>Aucune categorie</span>'}</section>
    <table><thead><tr><th>#</th><th>ID / Date</th><th>Categorie</th><th>Role anonyme</th><th>Suggestion</th><th>Identite super admin</th></tr></thead><tbody>${rows || '<tr><td colspan="6">Aucune suggestion pour ce filtre.</td></tr>'}</tbody></table>
    <footer><span>${escapeHtml(SCHOOL_NAME)} - KCS Nexus - ${escapeHtml(documentId)}</span><span>Rapport conforme a la charte administrative KCS</span></footer>
  </main><script>window.addEventListener('load',function(){setTimeout(function(){window.focus();window.print();},250);});</script></body></html>`

  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=800')
  if (!printWindow) return
  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
}

export default function SuggestionBox() {
  const { user } = useAuthStore()
  const { language } = useUIStore()
  const [category, setCategory] = useState('wellbeing')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [revealedId, setRevealedId] = useState<string | null>(null)
  const [records, setRecords] = useState<SuggestionRecord[]>(readSuggestions)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const isAdmin = user?.role === 'admin'

  const labels = useMemo(() => ({
    title: language === 'fr' ? 'Boite a suggestions' : 'Suggestion box',
    subtitle: language === 'fr'
      ? 'Le message reste anonyme dans le suivi normal, mais il arrive dans le registre confidentiel du super admin.'
      : 'The normal view stays anonymous, while the super admin receives the confidential registry.',
    send: language === 'fr' ? 'Envoyer en anonymat' : 'Send anonymously',
    sent: language === 'fr' ? 'Suggestion enregistree dans le canal confidentiel du super admin.' : 'Suggestion saved in the super admin confidential channel.',
    audit: language === 'fr' ? 'Registre super admin des suggestions' : 'Super admin suggestion registry',
    reveal: language === 'fr' ? 'Voir identite' : 'Reveal identity',
  }), [language])

  const categories = useMemo(() => Array.from(new Set(records.map((record) => record.category))).sort(), [records])
  const roles = useMemo(() => Array.from(new Set(records.map((record) => record.anonymousRole))).sort(), [records])

  const filteredRecords = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return records.filter((record) => {
      if (categoryFilter !== 'all' && record.category !== categoryFilter) return false
      if (roleFilter !== 'all' && record.anonymousRole !== roleFilter) return false
      if (!needle) return true
      const haystack = [
        record.id,
        record.category,
        record.message,
        record.anonymousRole,
        record.privateIdentity.fullName,
        record.privateIdentity.email,
        record.privateIdentity.role,
        record.privateIdentity.userId,
        new Date(record.createdAt).toLocaleString(),
      ].join(' ').toLowerCase()
      return haystack.includes(needle)
    })
  }, [categoryFilter, query, records, roleFilter])

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
            placeholder={language === 'fr' ? 'Ecrivez librement votre suggestion...' : 'Write your suggestion freely...'}
          />
          <button type="button" onClick={submit} className="inline-flex items-center justify-center gap-2 rounded-xl bg-kcs-gold-400 px-4 py-3 text-sm font-black text-kcs-blue-950 transition-colors hover:bg-kcs-gold-300">
            <Send size={16} /> {labels.send}
          </button>
        </div>
      )}

      {sent && <p className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-100">{labels.sent}</p>}

      {isAdmin && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <p className="flex items-center gap-2 text-sm font-bold text-cyan-100"><ShieldCheck size={16} /> {labels.audit}</p>
            <button
              type="button"
              onClick={() => printSuggestionReport(filteredRecords, query || `${categoryFilter}/${roleFilter}`)}
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-kcs-gold-300/30 bg-kcs-gold-300/12 px-4 py-2.5 text-sm font-bold text-kcs-gold-100 hover:bg-kcs-gold-300/18"
            >
              <Printer size={16} /> Imprimer / PDF
            </button>
          </div>

          <div className="grid gap-3 xl:grid-cols-[1fr_180px_180px]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-kcs-blue-200" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/10 py-3 pl-10 pr-3 text-sm text-white outline-none placeholder:text-kcs-blue-200"
                placeholder="Recherche fine: ID, texte, role, identite, email, date..."
              />
            </label>
            <label className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-kcs-blue-200" />
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="w-full rounded-xl border border-white/10 bg-white/10 py-3 pl-10 pr-3 text-sm text-white outline-none">
                <option value="all">Toutes categories</option>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-sm text-white outline-none">
              <option value="all">Tous roles</option>
              {roles.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-kcs-blue-200">Total</p><p className="text-2xl font-black">{records.length}</p></div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-kcs-blue-200">Filtrees</p><p className="text-2xl font-black">{filteredRecords.length}</p></div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-kcs-blue-200">Categories</p><p className="text-2xl font-black">{categories.length}</p></div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-kcs-blue-200">Roles</p><p className="text-2xl font-black">{roles.length}</p></div>
          </div>

          {filteredRecords.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-kcs-blue-100">No suggestion recorded for this filter.</p>
          ) : filteredRecords.map((record) => (
            <div key={record.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-kcs-gold-300">{record.id} - {new Date(record.createdAt).toLocaleString()} - {record.anonymousRole} - {record.category}</p>
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
