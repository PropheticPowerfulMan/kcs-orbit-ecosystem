import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownToLine, ArrowUpRight, BookOpen, ChevronRight, ExternalLink, FileText, Globe2, Search, X } from 'lucide-react'
import PortalSidebar from '@/components/layout/PortalSidebar'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { getAssetUrl } from '@/utils/assets'
import { getLocalizedGreeting, getLocalizedPortalDate, getUserDisplayName } from '@/utils/portalGreeting'
import documents from '@/data/schoolHandbook.json'
import topics from '@/data/schoolHandbookTopics.json'
import './schoolHandbook.css'

const HandbookPdfReader = lazy(() => import('@/components/shared/HandbookPdfReader'))

type Language = 'en' | 'fr'
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
export default function SchoolHandbook({ portal = false }: { portal?: boolean }) {
  const language = useUIStore(state => state.language)
  const user = useAuthStore(state => state.user)
  const tr = (fr: string, en: string) => language === 'fr' ? fr : en
  const [documentLanguage, setDocumentLanguage] = useState<Language>(language === 'fr' ? 'fr' : 'en')
  const [query, setQuery] = useState('')
  const [reader, setReader] = useState<{ language: Language; page: number } | null>(null)
  const readerRef = useRef<HTMLElement>(null)
  useEffect(() => setDocumentLanguage(language === 'fr' ? 'fr' : 'en'), [language])
  const chosen = documents.find(document => document.language === documentLanguage)!
  const opened = documents.find(document => document.language === reader?.language)
  const shown = topics.filter(topic => normalize([topic.title.en, topic.title.fr, topic.summary.en, topic.summary.fr, topic.keywords].join(' ')).includes(normalize(query.trim())))
  const read = (lang: Language, page = 1) => {
    setDocumentLanguage(lang); setReader({ language: lang, page })
    window.requestAnimationFrame(() => readerRef.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }))
  }
  const content = <div className={`school-handbook ${portal ? 'school-handbook--portal' : 'school-handbook--public'}`} data-school-handbook>
    <section className="handbook-hero" aria-labelledby="handbook-title" data-public-hero>
      <div className="handbook-hero-copy">
        <span className="handbook-eyebrow"><BookOpen size={15} aria-hidden="true"/> KCS · {tr('VIE SCOLAIRE', 'SCHOOL LIFE')}</span>
        <h1 id="handbook-title">{tr('Le manuel de notre école.', 'Our school handbook.')}<br/><span>{tr('Une référence pour chacun.', 'One reference for everyone.')}</span></h1>
        <p>{tr('Les valeurs, les attentes et les procédures qui accompagnent chaque élève, famille et membre de l’équipe KCS. Consultez le manuel complet dans la langue de votre choix.', 'The values, expectations and procedures that guide every KCS learner, family and team member. Explore the complete handbook in your preferred language.')}</p>
        <div className="handbook-hero-meta"><span><Globe2 size={16} aria-hidden="true"/> English · Français</span><span><FileText size={16} aria-hidden="true"/> {tr('PDF téléchargeables', 'Downloadable PDFs')}</span></div>
      </div>
      <div className="handbook-brand" aria-hidden="true"><img src={getAssetUrl('images/kcs.jpg')} alt=""/><span>LETTING OUR<br/>LIGHT SHINE</span></div>
    </section>
    <section className="handbook-editions" aria-label={tr('Choisir et télécharger un manuel', 'Choose and download a handbook')}>
      {documents.map(document => <article className="handbook-edition" key={document.language} data-handbook-language={document.language} lang={document.language}>
        <img className="handbook-cover" src={getAssetUrl(document.cover)} alt={document.language === 'fr' ? 'Couverture du manuel KCS en français' : 'English KCS handbook cover'} width="464" height="600"/>
        <div className="handbook-edition-copy">
          <span className="handbook-language-tag">{document.language === 'en' ? 'ENGLISH' : 'FRANÇAIS'}</span>
          <h2>{document.title}</h2>
          <p>{document.language === 'en' ? 'The complete school handbook.' : 'Le manuel scolaire dans son intégralité.'}</p>
          <span className="handbook-file-meta">PDF · {document.pages} pages · {(document.bytes / 1024 / 1024).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-GB', { maximumFractionDigits: 2 })} {tr('Mo', 'MB')}</span>
          <div className="handbook-actions"><button type="button" className="handbook-primary" onClick={() => read(document.language as Language)}><BookOpen size={16} aria-hidden="true"/>{tr('Consulter', 'Read')}</button><a className="handbook-secondary" href={getAssetUrl(document.file)} download={document.downloadName} data-handbook-download={document.language}><ArrowDownToLine size={16} aria-hidden="true"/>{tr('Télécharger', 'Download')}</a></div>
        </div>
      </article>)}
    </section>
    {reader && opened && <section ref={readerRef} className="handbook-reader" aria-label={tr('Consultation du manuel', 'Handbook reader')}>
      <div className="handbook-reader-bar"><div><span className="handbook-eyebrow">{tr('LECTURE DU DOCUMENT', 'DOCUMENT READER')}</span><h2>{opened.title} <small>· {tr('page', 'page')} {reader.page}</small></h2></div><button type="button" className="handbook-icon-button" onClick={() => setReader(null)} aria-label={tr('Fermer le document', 'Close document')}><X size={20}/></button></div>
      <div className="handbook-reader-actions"><a className="handbook-primary" href={`${getAssetUrl(opened.file)}#page=${reader.page}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} aria-hidden="true"/>{tr('Ouvrir en plein écran', 'Open full screen')}</a><a className="handbook-secondary" href={getAssetUrl(opened.file)} download={opened.downloadName}><ArrowDownToLine size={16} aria-hidden="true"/>{tr('Télécharger le PDF', 'Download PDF')}</a></div>
      <p className="handbook-reader-hint">{tr('Consultez toutes les pages ici. Vous pouvez aussi ouvrir ou télécharger le document original.', 'Read every page here. You can also open or download the original document.')}</p>
      <Suspense fallback={<p className="handbook-pdf-status" role="status">{tr('Ouverture du lecteur PDF…', 'Opening PDF reader…')}</p>}><HandbookPdfReader key={opened.language} src={getAssetUrl(opened.file)} initialPage={reader.page} title={opened.title} language={language}/></Suspense>
    </section>}
    <section className="handbook-topics" aria-labelledby="handbook-topics-title">
      <div className="handbook-section-heading"><div><span className="handbook-eyebrow">{tr('TROUVER UNE INFORMATION', 'FIND WHAT YOU NEED')}</span><h2 id="handbook-topics-title">{tr('Votre guide de lecture', 'Your reading guide')}</h2><p>{tr('Choisissez un thème pour ouvrir sa première page. Les dispositions complètes figurent dans le PDF.', 'Choose a topic to open its first page. Refer to the PDF for the complete policies and conditions.')}</p></div><div className="handbook-language-switch" role="group" aria-label={tr('Langue du document à consulter', 'Reading language')}>{(['en', 'fr'] as const).map(lang => <button key={lang} type="button" aria-pressed={documentLanguage === lang} onClick={() => {setDocumentLanguage(lang);if(reader){const topic=[...topics].filter(item=>item.page[reader.language]<=reader.page).sort((a,b)=>b.page[reader.language]-a.page[reader.language])[0];setReader({language:lang,page:topic?.page[lang]||1})}}}>{lang === 'en' ? 'English' : 'Français'}</button>)}</div></div>
      <label className="handbook-search"><Search size={18} aria-hidden="true"/><span className="sr-only">{tr('Rechercher un thème du manuel', 'Search handbook topics')}</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={tr('Rechercher : absence, uniforme, bulletin…', 'Search: attendance, uniform, report cards…')}/>{query && <button type="button" className="handbook-icon-button" onClick={() => setQuery('')} aria-label={tr('Effacer la recherche', 'Clear search')}><X size={16}/></button>}</label>
      <p className="handbook-result-count" role="status">{shown.length} {tr('rubrique(s)', 'topic(s)')} · {chosen.title}</p>
      <div className="handbook-topic-grid">{shown.map(topic => <button key={topic.id} type="button" className="handbook-topic" onClick={() => read(documentLanguage, topic.page[documentLanguage])}><span className="handbook-topic-number">{topic.id}</span><div><h3>{topic.title[language === 'fr' ? 'fr' : 'en']}</h3><p>{topic.summary[language === 'fr' ? 'fr' : 'en']}</p><span>{tr('Ouvrir la page', 'Open page')} {topic.page[documentLanguage]} <ChevronRight size={14} aria-hidden="true"/></span></div></button>)}</div>
      {!shown.length && <div className="handbook-empty"><Search size={24} aria-hidden="true"/><h3>{tr('Aucune rubrique trouvée', 'No matching topics')}</h3><p>{tr('Essayez un autre mot-clé ou consultez le PDF complet.', 'Try another keyword or read the full PDF.')}</p><button type="button" className="handbook-secondary" onClick={() => setQuery('')}>{tr('Voir toutes les rubriques', 'Show all topics')}</button></div>}
    </section>
    <aside className="handbook-help"><div><h2>{tr('Une question sur la vie à KCS ?', 'A question about life at KCS?')}</h2><p>{tr('L’administration est à votre disposition pour préciser les règles et accompagner votre famille.', 'Our school office can clarify school policies and support your family.')}</p></div><a href="mailto:kinshasachristianschool@gmail.com">kinshasachristianschool@gmail.com <ArrowUpRight size={16} aria-hidden="true"/></a><a href="tel:+243895326011">+243 895 326 011</a></aside>
  </div>
  if (!portal) return content
  return <div className="portal-shell flex"><PortalSidebar/><main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto"><header className="handbook-portal-header"><div><p>{getLocalizedGreeting(language)}, {getUserDisplayName(user)}</p><span>{getLocalizedPortalDate(language)} · {tr('Manuel de l’école', 'School Handbook')}</span></div><Link to={user?.role === 'admin' ? '/admin' : `/portal/${user?.role}`}><ChevronRight size={16} aria-hidden="true"/>{tr('Tableau de bord', 'Dashboard')}</Link></header>{content}</main></div>
}
