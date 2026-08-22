import DateSelect from '@/components/shared/DateSelect'
import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, Eye, LockKeyhole, MessageSquareText, Printer, Search, Send, ShieldCheck, X } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { getAssetUrl } from '@/utils/assets'
import { suggestionsAPI } from '@/services/api'

type SuggestionStatus = 'New' | 'Under review' | 'Resolved'
type SuggestionRecord = {
  id: string; createdAt: string; category: string; message: string; anonymousRole: string
  status?: SuggestionStatus; privateIdentity: { userId: string; fullName: string; email: string; role: string }
}

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character] ?? character))

export default function SuggestionBox() {
  const { user } = useAuthStore()
  const { language } = useUIStore()
  const [category, setCategory] = useState('wellbeing')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [records, setRecords] = useState<SuggestionRecord[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('All')
  const [authorFilter, setAuthorFilter] = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selected, setSelected] = useState<SuggestionRecord | null>(null)
  const [identityVisible, setIdentityVisible] = useState(false)
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    if (!isAdmin) return
    let active = true
    suggestionsAPI.getAll().then((response) => {
      if (!active) return
      const data = (response.data?.data ?? []).map((record: any) => ({
        id: record.id,
        createdAt: record.createdAt,
        category: record.category,
        message: record.message,
        anonymousRole: String(record.anonymousRole ?? '').toLowerCase(),
        status: record.status,
        privateIdentity: {
          userId: record.author?.id ?? '',
          fullName: `${record.author?.firstName ?? ''} ${record.author?.lastName ?? ''}`.trim(),
          email: record.author?.email ?? '',
          role: String(record.author?.role ?? '').toLowerCase(),
        },
      }))
      setRecords(data)
    }).catch((error) => {
      if (active) setRequestError(error?.response?.data?.message || 'The confidential registry could not be loaded.')
    })
    return () => { active = false }
  }, [isAdmin])

  const filtered = useMemo(() => records.filter((record) => {
    const haystack = `${record.id} ${record.message} ${record.category} ${record.anonymousRole} ${record.privateIdentity.fullName} ${record.privateIdentity.email} ${record.createdAt}`.toLowerCase()
    const day = record.createdAt.slice(0, 10)
    return (!query.trim() || haystack.includes(query.trim().toLowerCase())) && (categoryFilter === 'All' || record.category === categoryFilter) && (authorFilter === 'All' || record.privateIdentity.userId === authorFilter) && (roleFilter === 'All' || record.anonymousRole === roleFilter) && (!dateFrom || day >= dateFrom) && (!dateTo || day <= dateTo)
  }), [authorFilter, categoryFilter, dateFrom, dateTo, query, records, roleFilter])

  const categories = useMemo(() => Array.from(new Set(records.map((record) => record.category))).sort(), [records])
  const authors = useMemo(() => Array.from(new Map(records.map((record) => [record.privateIdentity.userId, record.privateIdentity])).values()).sort((a, b) => a.fullName.localeCompare(b.fullName)), [records])
  const resetFilters = () => { setQuery(''); setCategoryFilter('All'); setAuthorFilter('All'); setRoleFilter('All'); setDateFrom(''); setDateTo('') }

  const printOfficialRegistry = () => {
    const output = window.open('', '_blank', 'width=1200,height=900')
    if (!output) return
    const logo = new URL(getAssetUrl('images/kcs.jpg'), window.location.origin).href
    const scope = `Category: ${categoryFilter} | Author: ${authorFilter === 'All' ? 'All' : authors.find((author) => author.userId === authorFilter)?.fullName} | Role: ${roleFilter} | Period: ${dateFrom || 'Beginning'} to ${dateTo || 'Today'} | Search: ${query || 'None'}`
    const rows = filtered.map((record, index) => `<tr><td>${index + 1}</td><td><b>${escapeHtml(record.id)}</b><br><small>${escapeHtml(new Date(record.createdAt).toLocaleString())}</small></td><td>${escapeHtml(record.category)}</td><td>${escapeHtml(record.anonymousRole)}</td><td><b>${escapeHtml(record.privateIdentity.fullName)}</b><br><small>${escapeHtml(record.privateIdentity.email)}</small></td><td>${escapeHtml(record.message)}</td><td>${escapeHtml(record.status ?? 'New')}</td></tr>`).join('')
    output.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>KCS Official Suggestion Registry</title><style>@page{size:A4 landscape;margin:13mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#10234f;margin:0}.watermark{position:fixed;left:50%;top:50%;width:430px;height:430px;transform:translate(-50%,-50%);object-fit:contain;opacity:.045;z-index:-1}.header{display:flex;align-items:center;gap:20px;border-bottom:4px solid #d8a928;padding-bottom:14px}.logo{width:105px;height:105px;object-fit:contain}.school{font-size:24px;font-weight:800;margin:0}.title{font-size:18px;font-weight:700;margin:6px 0;color:#167aaa}.seal{margin-left:auto;border:2px solid #a61b1b;color:#a61b1b;padding:8px 12px;font-weight:800;transform:rotate(-2deg)}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}.card{border:1px solid #dce3ee;border-radius:8px;padding:10px}.card small{color:#65738b;text-transform:uppercase}.scope{font-size:10px;background:#f3f7fb;border-left:4px solid #167aaa;padding:9px;margin-bottom:12px}table{width:100%;border-collapse:collapse;font-size:9px}th{background:#10234f;color:#fff;padding:8px;text-align:left}td{border:1px solid #dce3ee;padding:7px;vertical-align:top;line-height:1.35}tbody tr:nth-child(even){background:#f7f9fc}small{color:#65738b}.signature{margin:30px 0 12px auto;width:260px;border-top:1px solid #10234f;padding-top:6px;text-align:center;font-size:10px}.footer{display:flex;justify-content:space-between;border-top:1px solid #bcc7d8;padding-top:8px;font-size:9px;color:#65738b}</style></head><body><img class="watermark" src="${logo}" alt=""><header class="header"><img class="logo" src="${logo}" alt="KCS logo"><div><p class="school">KINSHASA CHRISTIAN SCHOOL</p><p class="title">OFFICIAL CONFIDENTIAL SUGGESTION REGISTRY</p><small>KCS Nexus AI · Super Administration</small></div><div class="seal">CONFIDENTIAL</div></header><div class="meta"><div class="card"><small>Total registry</small><br><b>${records.length}</b></div><div class="card"><small>Included</small><br><b>${filtered.length}</b></div><div class="card"><small>Categories</small><br><b>${new Set(filtered.map((record) => record.category)).size}</b></div><div class="card"><small>Roles</small><br><b>${new Set(filtered.map((record) => record.anonymousRole)).size}</b></div></div><div class="scope"><b>Applied scope:</b> ${escapeHtml(scope)}</div><table><thead><tr><th>#</th><th>Reference / Date</th><th>Category</th><th>Role</th><th>Confidential identity</th><th>Suggestion</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="7">No suggestion matches the selected scope.</td></tr>'}</tbody></table><div class="signature">Super Administrator signature and official seal</div><footer class="footer"><span>Generated ${escapeHtml(new Date().toLocaleString())}</span><span>Official KCS Nexus AI confidential document · Unauthorized disclosure prohibited</span></footer><script>window.onload=()=>setTimeout(()=>window.print(),350)</script></body></html>`)
    output.document.close()
  }

  const submit = async () => {
    if (!message.trim() || !user || isSubmitting) return
    setIsSubmitting(true)
    setRequestError('')
    setSent(false)
    try {
      await suggestionsAPI.submit({ category, message: message.trim() })
      setMessage('')
      setSent(true)
    } catch (error: any) {
      setRequestError(error?.response?.data?.message || 'The confidential suggestion could not be submitted.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateStatus = async (id: string, status: SuggestionStatus) => {
    setRequestError('')
    try {
      await suggestionsAPI.updateStatus(id, status)
      const next = records.map((record) => record.id === id ? { ...record, status } : record)
      setRecords(next); setSelected((record) => record?.id === id ? { ...record, status } : record)
    } catch (error: any) {
      setRequestError(error?.response?.data?.message || 'The suggestion status could not be updated.')
    }
  }

  if (isAdmin) return (
    <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
      <div className="bg-gradient-to-r from-kcs-blue-950 to-kcs-blue-800 p-5 text-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-kcs-gold-300"><MessageSquareText size={16}/> Suggestion box</p><p className="mt-2 text-sm text-kcs-blue-100">The normal view stays anonymous, while the super admin receives the confidential registry.</p></div><span className="flex w-fit items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-bold text-cyan-100"><LockKeyhole size={15}/> Private seal</span></div>
      </div>
      <div className="p-5">
        {requestError && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">{requestError}</p>}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="flex items-center gap-2 font-bold text-kcs-blue-900 dark:text-white"><ShieldCheck size={18} className="text-kcs-gold-600"/> Super admin suggestion registry</p></div><button type="button" onClick={printOfficialRegistry} className="inline-flex items-center justify-center gap-2 rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-kcs-blue-800"><Printer size={16}/> Imprimer / PDF</button></div>
        <label className="mt-4 flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 dark:border-kcs-blue-700"><Search size={16} className="text-gray-400"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Recherche fine: ID, texte, rôle, identité, email, date..." className="w-full bg-transparent text-sm outline-none dark:text-white"/></label>
        <div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-5"><select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white"><option value="All">Toutes catégories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select><select value={authorFilter} onChange={(e) => setAuthorFilter(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white"><option value="All">Tous parents/auteurs</option>{authors.map((author) => <option key={author.userId} value={author.userId}>{author.fullName}</option>)}</select><select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white"><option value="All">Tous rôles</option><option value="student">Élèves</option><option value="parent">Parents</option><option value="teacher">Enseignants</option><option value="staff">Administration</option></select><DateSelect aria-label="Date de début"  value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white"/><DateSelect aria-label="Date de fin"  value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white"/></div>
        <div className="mt-3 flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between"><p className="font-semibold text-kcs-blue-700 dark:text-kcs-blue-300">{filtered.length} suggestion(s) affichée(s) sur {records.length}.</p><button type="button" onClick={resetFilters} className="w-fit text-sm font-bold text-kcs-gold-600 hover:underline">Réinitialiser les filtres</button></div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Total', records.length], ['Filtrées', filtered.length], ['Catégories', new Set(filtered.map((record) => record.category)).size], ['Rôles', new Set(filtered.map((record) => record.anonymousRole)).size]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30"><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p><p className="mt-1 font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{value}</p></div>)}</div>
        <div className="mt-4 space-y-2">{filtered.length ? filtered.map((record) => <button type="button" key={record.id} onClick={() => { setSelected(record); setIdentityVisible(false) }} className="grid w-full gap-2 rounded-xl border border-gray-100 bg-gray-50 p-4 text-left transition hover:border-kcs-blue-300 hover:bg-kcs-blue-50 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/30 dark:hover:bg-kcs-blue-800 sm:grid-cols-[170px_1fr_130px]"><div><p className="text-xs font-bold text-kcs-gold-600">{record.id}</p><p className="mt-1 text-xs capitalize text-gray-400">{record.anonymousRole} · {record.category}</p></div><p className="line-clamp-2 text-sm text-kcs-blue-900 dark:text-white">{record.message}</p><span className="flex items-center gap-1 text-xs font-bold text-kcs-blue-600 dark:text-kcs-blue-300"><Clock3 size={14}/>{record.status ?? 'New'}</span></button>) : <p className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-kcs-blue-700">No suggestion matches these search criteria.</p>}</div>
      </div>
      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-kcs-blue-950/65 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl dark:bg-kcs-blue-900"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-kcs-gold-600">{selected.id} · {selected.category}</p><h3 className="mt-1 text-xl font-bold text-kcs-blue-900 dark:text-white">Anonymous {selected.anonymousRole} suggestion</h3></div><button type="button" onClick={() => setSelected(null)} className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-kcs-blue-800"><X size={18}/></button></div><p className="mt-5 rounded-xl bg-gray-50 p-4 text-sm leading-relaxed text-gray-700 dark:bg-kcs-blue-800/30 dark:text-gray-200">{selected.message}</p><p className="mt-3 text-xs text-gray-400">Received {new Date(selected.createdAt).toLocaleString()} · Status: {selected.status ?? 'New'}</p>{identityVisible && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">Confidential identity: {selected.privateIdentity.fullName} · {selected.privateIdentity.email} · {selected.privateIdentity.role} · {selected.privateIdentity.userId}</p>}<div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setIdentityVisible((value) => !value)} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-kcs-blue-700 dark:border-kcs-blue-700 dark:text-kcs-blue-200"><Eye size={16}/> {identityVisible ? 'Hide identity' : 'Reveal identity'}</button><button type="button" onClick={() => updateStatus(selected.id, 'Under review')} className="rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-semibold text-white">Mark under review</button><button type="button" onClick={() => updateStatus(selected.id, 'Resolved')} className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white"><CheckCircle2 size={16}/> Resolve</button></div></div></div>}
    </section>
  )

  return (
    <section className="rounded-2xl border border-white/12 bg-kcs-blue-950/70 p-5 text-white shadow-[0_24px_70px_rgba(0,27,54,0.28)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-kcs-gold-300">
            <MessageSquareText size={16} /> {language === 'fr' ? 'Boîte à suggestions confidentielle' : 'Confidential Suggestion Box'}
          </p>
          <div className="mt-2 space-y-1 text-xs leading-relaxed text-kcs-blue-100/90 sm:text-sm">
            <p className="font-semibold text-kcs-gold-200">
              {language === 'fr'
                ? '• Le message est strictement confidentiel.'
                : '• This message is strictly confidential.'}
            </p>
            <p>
              {language === 'fr'
                ? '• L\'auteur n\'est jamais révélé à l\'enseignant ni aux autres utilisateurs.'
                : '• The author\'s identity is never revealed to the Teacher or other users.'}
            </p>
            <p className="text-kcs-blue-200/80">
              {null}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-bold text-cyan-200">
            <LockKeyhole size={14} /> {language === 'fr' ? 'Anonymat garanti' : 'Anonymity protected'}
          </span>
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[200px_1fr_auto]">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label={language === 'fr' ? 'Catégorie de suggestion' : 'Suggestion category'}
          className="rounded-xl border border-white/10 bg-kcs-blue-900 px-3 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-kcs-gold-400"
        >
          <option value="wellbeing">Wellbeing</option>
          <option value="discipline">Discipline</option>
          <option value="teaching">Teaching</option>
          <option value="finance">Finance</option>
          <option value="safety">Safety</option>
          <option value="other">Other</option>
        </select>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="min-h-24 rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-sm text-white outline-none placeholder:text-kcs-blue-200/60 focus:ring-2 focus:ring-kcs-gold-400"
          placeholder={language === 'fr' ? 'Écrivez votre suggestion confidentielle...' : 'Write your confidential suggestion...'}
        />
        <button
          type="button"
          onClick={submit}
          disabled={isSubmitting || !message.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-kcs-gold-400 px-5 py-3 text-sm font-black text-kcs-blue-950 transition hover:bg-kcs-gold-300"
        >
          <Send size={16} /> {isSubmitting ? (language === 'fr' ? 'Envoi...' : 'Sending...') : (language === 'fr' ? 'Envoyer' : 'Send')}
        </button>
      </div>
      {requestError && <p className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{requestError}</p>}
      {sent && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-500/20 px-4 py-2.5 text-sm font-semibold text-emerald-200 border border-emerald-500/30">
          <CheckCircle2 size={16} className="text-emerald-400" />
          {language === 'fr'
            ? 'Votre suggestion confidentielle a été transmise de manière sécurisée.'
            : 'Your confidential suggestion was securely delivered to the confidential registry.'}
        </div>
      )}
    </section>
  )
}
