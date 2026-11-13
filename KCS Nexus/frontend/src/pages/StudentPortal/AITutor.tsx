import { useEffect, useRef, useState } from 'react'
import { Brain, Send, BookOpen, Loader2, Lightbulb, RefreshCw, Copy, Check, Compass, Target, FileCheck2, ArrowRight } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { getLocalizedGreeting, getLocalizedPortalDate } from '@/utils/portalGreeting'
import PortalSidebar from '@/components/layout/PortalSidebar'
import { aiAPI } from '@/services/api'

type Mode = 'coach' | 'practice' | 'review'
type Message = { id: string; role: 'user' | 'assistant'; content: string; welcome?: boolean }
const subjects = [
  { id: 'math', en: 'Mathematics', fr: 'Mathématiques', emoji: '📐', enPrompt: 'Help me understand a math problem, one step at a time.', frPrompt: 'Aide-moi à comprendre un problème de mathématiques, étape par étape.' },
  { id: 'science', en: 'Science', fr: 'Sciences', emoji: '🔬', enPrompt: 'Explain a science concept with an everyday example.', frPrompt: 'Explique un concept scientifique avec un exemple de la vie quotidienne.' },
  { id: 'english', en: 'English', fr: 'Anglais', emoji: '📝', enPrompt: 'Help me improve my writing. What should I share first?', frPrompt: 'Aide-moi à améliorer mon anglais écrit. Que dois-je partager ?' },
  { id: 'history', en: 'History', fr: 'Histoire', emoji: '🌍', enPrompt: 'Help me compare the causes and effects of a historical event.', frPrompt: 'Aide-moi à comparer les causes et les conséquences d’un événement historique.' },
  { id: 'french', en: 'French', fr: 'Français', emoji: '🇫🇷', enPrompt: 'Help me practice French grammar at my school level.', frPrompt: 'Aide-moi à pratiquer la grammaire française à mon niveau scolaire.' },
  { id: 'bible', en: 'Bible & Ethics', fr: 'Bible et éthique', emoji: '📖', enPrompt: 'Help me understand a Bible passage and its context.', frPrompt: 'Aide-moi à comprendre un passage biblique et son contexte.' },
]
const modes = [
  { id: 'coach' as const, icon: Compass, en: 'Understand', fr: 'Comprendre', enDetail: 'Hints, examples and guided reasoning', frDetail: 'Indices, exemples et raisonnement guidé' },
  { id: 'practice' as const, icon: Target, en: 'Practice', fr: 'S’entraîner', enDetail: 'One exercise at a time, with feedback', frDetail: 'Un exercice à la fois, avec retour' },
  { id: 'review' as const, icon: FileCheck2, en: 'Review my work', fr: 'Revoir mon travail', enDetail: 'Check your attempt and improve it', frDetail: 'Vérifier et améliorer votre travail' },
]
const id = () => crypto.randomUUID()

export default function AITutorPage() {
  const { user } = useAuthStore()
  const language = useUIStore(state => state.language)
  const tr = (fr: string, en: string) => language === 'fr' ? fr : en
  const [subjectId, setSubjectId] = useState<string | null>(null)
  const subject = subjects.find(item => item.id === subjectId)
  const [mode, setMode] = useState<Mode>('coach')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const conversation = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { const el = conversation.current; el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }) }, [messages, loading])
  const start = (selected: typeof subjects[number]) => {
    setSubjectId(selected.id); setError(''); setInput('')
    setMessages([{ id: id(), role: 'assistant', welcome: true, content: tr(
      `Bonjour ${user?.firstName || ''} ! Nous allons travailler en ${selected.fr.toLowerCase()}. Partage ta question, ton raisonnement ou le point qui te pose problème. Je t’aiderai à progresser, étape par étape.`,
      `Hello ${user?.firstName || ''}! Let’s work on ${selected.en.toLowerCase()}. Share your question, your attempt or the part you find difficult. I’ll help you make progress, one step at a time.`,
    ) }])
  }
  const send = async (suggestion?: string) => {
    const text = (suggestion ?? input).trim()
    if (!text || loading || !subject) return
    const message: Message = { id: id(), role: 'user', content: text }
    const history = messages.filter(item => !item.welcome).slice(-12).map(({ role, content }) => ({ role, content: content.slice(0, 4000) }))
    setMessages(previous => [...previous, message]); setInput(''); setError(''); setLoading(true)
    try {
      const response = await aiAPI.tutor(subject.en, text, undefined, { language, mode, history })
      const answer = response.data?.data?.response
      if (typeof answer !== 'string' || !answer.trim()) throw new Error('Empty tutor response')
      setMessages(previous => [...previous, { id: id(), role: 'assistant', content: answer }])
    } catch {
      setMessages(previous => previous.filter(item => item.id !== message.id))
      setInput(text)
      setError(tr('Le tuteur est momentanément indisponible. Votre question est conservée ci-dessous : vous pouvez réessayer.', 'The tutor is temporarily unavailable. Your question is kept below so you can try again.'))
    } finally { setLoading(false); setTimeout(() => inputRef.current?.focus(), 100) }
  }
  const copy = async (message: Message) => {
    try { await navigator.clipboard.writeText(message.content); setCopied(message.id); setTimeout(() => setCopied(null), 2000) } catch { setError(tr('Copie indisponible. Vous pouvez sélectionner le texte.', 'Clipboard unavailable. You can select the text.')) }
  }
  const button = 'rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-kcs-blue-800 transition hover:border-sky-400 hover:bg-sky-100 active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-100 dark:hover:bg-sky-900 disabled:cursor-not-allowed disabled:opacity-50'
  return <div className="portal-shell flex">
    <PortalSidebar />
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <header className="portal-dashboard-topbar border-b px-4 py-3 backdrop-blur-2xl sm:px-6 sm:py-4">
        <h1 className="portal-dashboard-title font-display text-lg font-bold leading-tight sm:text-2xl">{getLocalizedGreeting(language)}{user?.firstName ? `, ${user.firstName}` : ''}</h1>
        <p className="mt-1 text-xs text-kcs-blue-700 dark:text-kcs-blue-100">{getLocalizedPortalDate(language)} · {tr('Votre espace d’apprentissage guidé', 'Your guided learning space')}</p>
      </header>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-sky-200/70 bg-gradient-to-r from-sky-50 to-indigo-50 px-4 py-3 dark:border-sky-800 dark:from-kcs-blue-950 dark:to-indigo-950 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md"><Brain size={22} /></div>
          <div className="min-w-0"><h2 className="text-base font-bold text-kcs-blue-900 dark:text-white">{tr('Tuteur IA', 'AI Tutor')}</h2><p className="text-xs text-slate-600 dark:text-sky-200">{subject ? (language === 'fr' ? subject.fr : subject.en) : tr('Comprendre · S’entraîner · Progresser', 'Understand · Practice · Grow')}</p></div>
        </div>
        {subject && <button type="button" data-kcs-no-processing="true" disabled={loading} className={button + ' inline-flex items-center gap-2'} onClick={() => { setSubjectId(null); setMessages([]); setError(''); setInput('') }}><RefreshCw size={14} />{tr('Changer de matière', 'Change subject')}</button>}
      </div>
      {!subject ? <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-4xl space-y-5">
          <section className="relative overflow-hidden rounded-3xl border border-sky-200 bg-gradient-to-br from-white via-sky-50 to-indigo-100 p-5 dark:border-sky-800 dark:from-kcs-blue-950 dark:via-kcs-blue-900 dark:to-indigo-950 sm:p-8">
            <span className="text-[10px] font-bold uppercase tracking-[.2em] text-sky-700 dark:text-sky-300">KCS · {tr('Apprendre avec confiance', 'Learn with confidence')}</span>
            <h2 className="mt-3 max-w-xl text-xl font-bold leading-tight text-kcs-blue-950 dark:text-white sm:text-3xl">{tr('Une question ? Construisons la réponse ensemble.', 'A question? Let’s work it out together.')}</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-sky-100">{tr('Un accompagnement adapté à votre niveau, qui suit votre raisonnement et vous aide à comprendre vos erreurs.', 'Support adapted to your school level that follows your reasoning and helps you learn from mistakes.')}</p>
            <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-semibold text-sky-800 dark:text-sky-200">{[tr('Exemples guidés', 'Guided examples'), tr('Exercices progressifs', 'Adaptive practice'), tr('Français / Anglais', 'English / French')].map(label => <span key={label} className="rounded-full border border-sky-200 bg-white/70 px-3 py-1.5 dark:border-sky-700 dark:bg-sky-950/50">{label}</span>)}</div>
          </section>
          <div><h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-kcs-blue-900 dark:text-white"><BookOpen size={17}/>{tr('Choisissez une matière pour commencer', 'Choose a subject to begin')}</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{subjects.map(item => <button type="button" data-kcs-no-processing="true" key={item.id} onClick={() => start(item)} className="group flex min-w-0 flex-col rounded-2xl border border-sky-200 bg-white p-4 text-left transition duration-200 hover:-translate-y-1 hover:border-sky-400 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-sky-800 dark:bg-kcs-blue-950/80 dark:hover:bg-kcs-blue-900 motion-reduce:transform-none sm:p-5">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-2xl dark:bg-sky-900/40" aria-hidden="true">{item.emoji}</span>
              <span className="text-sm font-bold text-kcs-blue-900 dark:text-white">{language === 'fr' ? item.fr : item.en}</span><span className="mt-2 flex items-center gap-1 text-[11px] text-sky-700 dark:text-sky-300">{tr('Explorer ensemble', 'Explore together')}<ArrowRight size={12}/></span>
            </button>)}</div>
          </div>
          <p className="flex items-start gap-2 rounded-2xl bg-sky-100/60 p-4 text-xs leading-relaxed text-slate-600 dark:bg-sky-950/60 dark:text-sky-200"><Lightbulb size={16} className="shrink-0"/>{tr('L’IA peut se tromper. Vérifiez les réponses importantes avec votre professeur. Le tuteur ne remplace pas l’enseignement et ne révèle aucun résultat scolaire privé.', 'AI can make mistakes. Check important answers with your teacher. The tutor supports learning and does not reveal private academic results.')}</p>
        </div>
      </div> : <>
        <div className="border-b border-sky-200/60 bg-white/70 px-3 py-2 dark:border-sky-900 dark:bg-kcs-blue-950/60 sm:px-6"><div className="mx-auto flex max-w-4xl flex-wrap gap-2" role="group" aria-label={tr('Mode d’apprentissage', 'Learning mode')}>{modes.map(item => <button type="button" data-kcs-no-processing="true" key={item.id} disabled={loading} aria-pressed={mode === item.id} title={language === 'fr' ? item.frDetail : item.enDetail} onClick={() => setMode(item.id)} className={button + (mode === item.id ? ' !border-sky-500 !bg-kcs-blue-700 !text-white dark:!bg-sky-700' : '') + ' inline-flex items-center gap-2'}><item.icon size={14}/>{language === 'fr' ? item.fr : item.en}</button>)}</div></div>
        <div ref={conversation} className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-6" role="log" aria-label={tr('Conversation avec le tuteur', 'Tutor conversation')} aria-live="polite" aria-relevant="additions">
          <div className="mx-auto max-w-4xl space-y-5">{messages.map(message => <div key={message.id} className={`flex items-start gap-2.5 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${message.role === 'user' ? 'bg-kcs-blue-700 text-white' : 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100'}`}>{message.role === 'user' ? user?.firstName?.slice(0,1) || 'K' : <Brain size={17}/>}</span>
            <div className="min-w-0 max-w-[88%] sm:max-w-[82%]"><div className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-relaxed [overflow-wrap:anywhere] ${message.role === 'user' ? 'rounded-tr-sm bg-kcs-blue-700 text-white' : 'rounded-tl-sm border border-sky-200 bg-white text-slate-800 dark:border-sky-800 dark:bg-kcs-blue-950/90 dark:text-sky-50'}`}>{message.content}</div>
              {message.role === 'assistant' && !message.welcome && <button type="button" data-kcs-no-processing="true" className="mt-1 inline-flex items-center gap-1 p-1 text-[11px] text-slate-500 hover:text-sky-700 dark:text-sky-300" onClick={() => void copy(message)}>{copied === message.id ? <Check size={12}/> : <Copy size={12}/>} {copied === message.id ? tr('Copié', 'Copied') : tr('Copier', 'Copy')}</button>}
            </div>
          </div>)}
          {loading && <div role="status" className="flex items-center gap-2 text-xs text-sky-800 dark:text-sky-200"><Loader2 size={16} className="animate-spin"/>{tr('Le tuteur prépare votre accompagnement…', 'Your tutor is preparing some guidance…')}</div>}
          </div>
        </div>
        <div className="border-t border-sky-200 bg-white/90 p-3 dark:border-sky-800 dark:bg-kcs-blue-950 sm:p-4">
          <div className="mx-auto max-w-4xl space-y-2">
            {messages.length === 1 && <button type="button" data-kcs-no-processing="true" disabled={loading} onClick={() => void send(language === 'fr' ? subject.frPrompt : subject.enPrompt)} className={button + ' flex items-center gap-2 text-left'}><Lightbulb size={14} className="shrink-0"/>{language === 'fr' ? subject.frPrompt : subject.enPrompt}</button>}
            {error && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">{error}</p>}
            <form className="flex items-end gap-2" onSubmit={event => { event.preventDefault(); void send() }}>
              <label className="sr-only" htmlFor="tutor-question">{tr('Votre question', 'Your question')}</label>
              <textarea id="tutor-question" ref={inputRef} value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send() } }} maxLength={4000} rows={2} disabled={loading} placeholder={tr('Votre question ou votre raisonnement…', 'Your question or your attempt…')} className="min-w-0 flex-1 resize-none rounded-2xl border border-sky-300 bg-sky-50/70 px-4 py-3 text-sm text-kcs-blue-950 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-sky-700 dark:bg-sky-950 dark:text-white dark:placeholder:text-sky-300/70"/>
              <button type="submit" data-kcs-no-processing="true" disabled={!input.trim() || loading} aria-label={tr('Envoyer au tuteur', 'Send to tutor')} aria-busy={loading} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-600 to-kcs-blue-800 text-white shadow-md transition hover:shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">{loading ? <Loader2 size={19} className="animate-spin"/> : <Send size={19}/>}</button>
            </form>
            <p className="text-center text-[10px] text-slate-500 dark:text-sky-300">{tr('Entrée : envoyer · Maj + Entrée : nouvelle ligne · Vérifiez les réponses importantes.', 'Enter: send · Shift + Enter: new line · Verify important answers.')}</p>
          </div>
        </div>
      </>}
    </main>
  </div>
}
