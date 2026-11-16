import {usePublishedAcademicCalendar} from '@/hooks/usePublishedAcademicCalendar'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link,useParams } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { Calendar, ArrowRight, Clock, Search } from 'lucide-react'
import SearchField from '@/components/shared/SearchField'
import { kcsPublicImages } from '@/data/kcsPublicImages'
import { formatSchoolCalendarDate, getUpcomingSchoolEvents, schoolCalendarEvents2026_2027 } from '@/data/schoolCalendar2026_2027'
import { useUIStore } from '@/store/uiStore'
import { api, eventsAPI, newsAPI } from '@/services/api'

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
}

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }

const AnimSection = ({ children, className = '',hidden=false }: { children: React.ReactNode; className?: string;hidden?:boolean }) => {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.div ref={ref} hidden={hidden} initial="hidden" animate={inView ? 'visible' : 'hidden'} variants={stagger} className={className}>
      {children}
    </motion.div>
  )
}

const fallbackPosts = [
  {
    id: 'official-calendar-2026-2027',
    category: 'announcement',
    title: 'Official KCS 2026-2027 School Calendar',
    excerpt: 'Classes begin September 7, 2026. The calendar includes official quarters, semester exams, school breaks, conferences, graduation, and closing ceremonies.',
    date: 'September 1, 2026',
    author: 'KCS Administration',
    image: kcsPublicImages.campusGlory,
    readTime: '2 min read',
  },
  {
    id: 'first-day-2026',
    category: 'event',
    title: 'First Day of School — September 7',
    excerpt: 'The official first day of classes for every KCS family is Monday, September 7, 2026.',
    date: 'September 7, 2026',
    author: 'KCS Administration',
    image: kcsPublicImages.qualityEducation,
    readTime: '1 min read',
  },
  {
    id: 'high-school-orientation-2026',
    category: 'event',
    title: 'High School Orientation — September 9-10',
    excerpt: 'Upper School students begin the year with the official High School orientation program.',
    date: 'September 9, 2026',
    author: 'Upper School',
    image: kcsPublicImages.assembly,
    readTime: '1 min read',
  },
  {
    id: 'parent-orientation-2026',
    category: 'announcement',
    title: 'High School Parent Orientation — September 12',
    excerpt: 'The official parent orientation meeting will be held online.',
    date: 'September 12, 2026',
    author: 'Upper School',
    image: kcsPublicImages.campusGlory,
    readTime: '1 min read',
  },
  {
    id: 'parent-prayer-2026',
    category: 'event',
    title: 'Parent Prayer Meeting — September 19',
    excerpt: 'KCS parents are invited to the first official prayer meeting of the school year.',
    date: 'September 19, 2026',
    author: 'KCS Administration',
    image: kcsPublicImages.assembly,
    readTime: '1 min read',
  },
  {
    id: 'legacy-day-2026',
    category: 'event',
    title: 'Legacy Day — October 19',
    excerpt: 'The KCS community celebrates Legacy Day during Legacy Month.',
    date: 'October 19, 2026',
    author: 'KCS Communications',
    image: kcsPublicImages.graduation,
    readTime: '1 min read',
  },
]

const upcomingEvents = getUpcomingSchoolEvents().slice(0, 8)

const categories = ['all', 'news', 'event', 'announcement', 'achievement']

const categoryColors: Record<string, string> = {
  all: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  news: 'bg-kcs-blue-100 text-kcs-blue-700 dark:bg-kcs-blue-900/40 dark:text-kcs-blue-300',
  event: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  announcement: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  achievement: 'bg-kcs-gold-100 text-kcs-gold-700 dark:bg-kcs-gold-900/40 dark:text-kcs-gold-300',
}

const eventTypeColors: Record<string, string> = {
  academic: 'bg-kcs-blue-100 text-kcs-blue-700',
  assessment: 'bg-orange-100 text-orange-700',
  break: 'bg-emerald-100 text-emerald-700',
  community: 'bg-pink-100 text-pink-700',
  holiday: 'bg-red-100 text-red-700',
  spiritual: 'bg-purple-100 text-purple-700',
}

const NewsPage = () => {
  const {id:articleKey}=useParams<{id:string}>()
  const language = useUIStore((state) => state.language)
  const {calendar:officialCalendar}=usePublishedAcademicCalendar(true)
  const schoolYear=officialCalendar?{name:officialCalendar.name,firstDay:officialCalendar.startDate,lastOfficialDay:officialCalendar.endDate,semesters:officialCalendar.periods.filter(p=>p.type==='SEMESTER'),quarters:officialCalendar.periods.filter(p=>p.type==='QUARTER')}:null
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFullCalendar, setShowFullCalendar] = useState(false)
  const [calendarExpanded,setCalendarExpanded]=useState(false),[eventSearch,setEventSearch]=useState(''),[eventMonth,setEventMonth]=useState('all'),[eventWindow,setEventWindow]=useState('upcoming'),[eventPage,setEventPage]=useState(1)
  useEffect(()=>setEventPage(1),[eventSearch,eventMonth,eventWindow])
  const [livePosts, setLivePosts] = useState<any[]>([])
  const [liveEvents, setLiveEvents] = useState<any[]>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [managed,setManaged]=useState<boolean|null>(null),[loadError,setLoadError]=useState(false)

  useEffect(() => {
    Promise.all([newsAPI.getAll(), eventsAPI.getAll(),api.get('/site-content/publication-status')])
      .then(([news, events,status]) => {
        setManaged(status.data.data?.managed===true);setLoadError(false)
        setLivePosts(Array.isArray(news.data?.data) ? news.data.data : [])
        setLiveEvents(Array.isArray(events.data?.data) ? events.data.data : [])
      })
      .catch(()=>setLoadError(true))
      .finally(() => setLoading(false))
  }, [])

  const allPosts = useMemo(() => (managed!==false||livePosts.length) ? livePosts.map((post) => ({
    id: post.slug || post.id, category: String(post.category || 'news').toLowerCase(), title: post.title, excerpt: post.excerpt,
    date: new Date(post.publishedAt || post.createdAt).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { dateStyle: 'long' }),
    rawDate: post.publishedAt || post.createdAt, author: [post.author?.lastName, post.author?.firstName].filter(Boolean).join(' ') || 'KCS Administration',
    image: post.coverImage || kcsPublicImages.campusGlory, readTime: Math.max(1, Math.ceil(String(post.content || '').split(/\s+/).length / 220)) + ' min',
  })) : fallbackPosts, [language, livePosts,managed])

  const displayedUpcomingEvents = managed!==false||liveEvents.length ? liveEvents.map((event) => ({
    ...event,
    date: event.startDate,
    type: String(event.type || 'academic').toLowerCase(),
    description: event.description || '',
    location: event.location || '',
  })) : upcomingEvents

  const schoolToday=new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Kinshasa'})
  const eventKey=(event:{date:string;title:string})=>event.date+'-'+event.title
  const monthOptions=[...new Set(displayedUpcomingEvents.map(event=>event.date.slice(0,7)))].sort()
  const eventMatches=displayedUpcomingEvents.filter(event=>(eventWindow==='all'||String(event.endDate||event.date).slice(0,10)>=schoolToday)&&(eventMonth==='all'||event.date.startsWith(eventMonth))&&eventSearch.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().split(/\s+/).every(word=>[event.title,event.description,event.location,event.date].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(word)))
  const eventPages=Math.max(1,Math.ceil(eventMatches.length/4)),currentEventPage=Math.min(eventPage,eventPages),visibleEventKeys=new Set(eventMatches.slice((currentEventPage-1)*4,currentEventPage*4).map(eventKey))
  const filtered = allPosts.filter((p) => {
    const terms = searchQuery.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().split(/\s+/).filter(Boolean)
    const haystack = [p.title, p.excerpt, p.author, p.category, p.date].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const published = (p as any).rawDate ? new Date((p as any).rawDate) : null
    const from = dateFrom ? new Date(dateFrom + 'T00:00:00') : null
    const to = dateTo ? new Date(dateTo + 'T23:59:59.999') : null
    return (activeCategory === 'all' || p.category === activeCategory) && terms.every((term) => haystack.includes(term))
      && (!from || !published || published >= from) && (!to || !published || published <= to)
  })

  const featured = allPosts[0]

  const article = livePosts.find(post=>post.id===articleKey||post.slug===articleKey)
  if(articleKey)return <div className="min-h-[65vh] bg-sky-50 px-4 pb-16 pt-28 text-kcs-blue-950 dark:bg-kcs-blue-950 dark:text-sky-50"><article className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-sky-200 bg-sky-50 shadow-lg dark:border-sky-800 dark:bg-[#0b2b43]" data-public-news-article><div className="p-5 sm:p-9"><Link to="/news" className="inline-flex rounded-xl border border-sky-300 px-4 py-2 text-sm font-bold text-sky-800 dark:border-sky-700 dark:text-cyan-200">← {language==='fr'?'Retour aux actualités':'Back to news'}</Link>{loading?<p className="py-12">{language==='fr'?'Chargement de l’article…':'Loading article…'}</p>:article?<><p className="mt-7 text-xs font-bold uppercase tracking-widest text-sky-700 dark:text-cyan-200">KCS · {language==='fr'?'Publications officielles':'Official publications'}</p><h1 className="mt-3 font-display text-2xl font-bold leading-tight sm:text-4xl">{article.title}</h1><p className="mt-4 text-sm text-slate-500 dark:text-sky-200">{new Date(article.publishedAt||article.createdAt).toLocaleDateString(language==='fr'?'fr-FR':'en-US',{dateStyle:'long'})} · {[article.author?.lastName,article.author?.firstName].filter(Boolean).join(' ')||'KCS Administration'}</p>{article.coverImage&&<img src={article.coverImage} alt={article.title} className="mt-7 max-h-[480px] w-full rounded-2xl object-cover"/>}<p className="mt-7 border-l-4 border-cyan-500 pl-5 text-base font-semibold leading-7 text-sky-900 dark:text-sky-100">{article.excerpt}</p><div className="mt-7 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700 dark:text-sky-100 sm:text-base" data-news-full-content>{article.content}</div>{Boolean(article.attachments?.length)&&<section className="mt-8 rounded-2xl border border-sky-200 bg-sky-100/50 p-5 dark:border-sky-700 dark:bg-sky-950/50" data-public-news-attachments><h2 className="text-lg font-bold">{language==='fr'?'Documents à télécharger':'Download documents'}</h2><ul className="mt-4 space-y-3">{article.attachments.map((file:any)=><li key={file.id}><a href={file.url} download={file.name} className="flex items-center justify-between gap-3 rounded-xl border border-sky-300 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-900 transition hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-900 dark:text-sky-50"><span className="min-w-0 break-words">{file.name}<small className="ml-2 font-normal">{Math.ceil(file.size/1024)} KB</small></span><span className="shrink-0">↓ {language==='fr'?'Télécharger':'Download'}</span></a></li>)}</ul></section>}</>:<div className="py-12"><h1 className="text-2xl font-bold">{language==='fr'?'Article indisponible':'Article unavailable'}</h1><p className="mt-3 text-sm">{language==='fr'?'Il a été retiré ou la connexion n’a pas permis son chargement. Retournez à la liste des actualités.':'It has been removed or could not be loaded. Return to the news list.'}</p></div>}</div></article></div>

  return (
    <div className="pt-20">
      {loadError&&<p role="alert" className="mx-auto my-4 max-w-5xl rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">{language==='fr'?'Les publications sont temporairement indisponibles. Actualisez la page pour réessayer.':'Publications are temporarily unavailable. Refresh the page to retry.'}</p>}
      {/* HERO */}
      <section className="relative py-20 kcs-gradient overflow-hidden" data-public-hero data-public-photo-hero style={{backgroundImage:`url(${kcsPublicImages.assembly})`}}>
        <div className="absolute inset-0 dots-bg opacity-10" style={{ backgroundSize: '40px 40px' }} />
        <div className="relative container-custom text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <h1 className="text-5xl font-bold font-display text-white mb-4">
              News &{' '}
              <span className="text-gradient-gold">Events</span>
            </h1>
            <p className="text-kcs-blue-100 text-lg max-w-xl mx-auto">
              Stay connected with the latest happenings, achievements, and upcoming events at KCS.
            </p>
          </motion.div>
        </div>
      </section>

      {/* FEATURED POST */}
      {featured&&<section className="py-12 bg-gray-50 dark:bg-kcs-blue-950/50">
        <div className="container-custom">
          <AnimSection>
            <motion.div
              variants={fadeUp}
              className="relative rounded-3xl overflow-hidden shadow-kcs-lg group"
            >
              <img
                src={featured.image}
                alt={featured.title}
                className="w-full h-80 md:h-96 object-cover group-hover:scale-105 transition-transform duration-700"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-kcs-blue-950 via-kcs-blue-950/50 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <span className={`badge-gold mb-3 inline-block capitalize`}>{featured.category}</span>
                <h2 className="text-2xl md:text-3xl font-bold font-display text-white mb-2 leading-tight">
                  {featured.title}
                </h2>
                <p className="text-kcs-blue-100 mb-4 max-w-2xl line-clamp-2">{featured.excerpt}</p>
                <div className="flex items-center gap-4">
                  <span className="text-kcs-blue-200 text-sm flex items-center gap-1.5">
                    <Calendar size={14} /> {featured.date}
                  </span>
                  <span className="text-kcs-blue-200 text-sm flex items-center gap-1.5">
                    <Clock size={14} /> {featured.readTime}
                  </span>
                  <Link to={`/news/${featured.id}`} className="ml-auto flex items-center gap-2 btn-gold text-sm py-2 px-5">
                    Read Full Story <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </motion.div>
          </AnimSection>
        </div>
      </section>}

      {/* FILTERS & GRID */}
      <section className="py-16 bg-white dark:bg-kcs-blue-950">
        <div className="container-custom">
          <aside className="public-calendar-shortcut mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-800 dark:bg-kcs-blue-900"><div><b className="text-sm text-sky-950 dark:text-sky-50">{language==='fr'?'Calendrier et année scolaire':'Calendar and school year'} · {(schoolYear?.name||'—')}</b><p className="text-xs text-slate-600 dark:text-slate-300">{language==='fr'?'Semestres, quarters et dates de référence dans un panneau repliable.':'Semesters, quarters and reference dates in a collapsible panel.'}</p></div><button type="button" aria-expanded={calendarExpanded} onClick={()=>setCalendarExpanded(value=>!value)} className="rounded-xl bg-sky-700 px-4 py-2.5 text-xs font-bold text-white">{calendarExpanded?(language==='fr'?'Masquer les repères':'Hide reference dates'):(language==='fr'?'Voir les repères scolaires':'View school dates')}</button></aside>
          <AnimSection className="mb-12 public-calendar-reference" hidden={!calendarExpanded}>
            <motion.div variants={fadeUp} className="mb-6">
              <span className="badge-gold mb-3 inline-flex items-center gap-2 text-sm">
                <Calendar size={14} /> {language==='fr'?'Calendrier scolaire publié':'Published school calendar'}
              </span>
              <h2 className="font-display text-3xl font-bold text-kcs-blue-900 dark:text-white">
                One verified calendar for the whole KCS ecosystem
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                Nexus, Savanex, EduPay, EduSync and Academy use the same 180-day school year, semester and quarter reference dates.
              </p>
            </motion.div>

            <div className="grid gap-5 lg:grid-cols-3">
              <motion.article variants={fadeUp} className="rounded-2xl border border-kcs-blue-100 bg-kcs-blue-50 p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
                <p className="text-xs font-bold uppercase tracking-wide text-kcs-blue-600 dark:text-kcs-blue-300">School year</p>
                <h3 className="mt-2 text-xl font-bold text-kcs-blue-950 dark:text-white">{(schoolYear?.name||'—')}</h3>
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">First day: {formatSchoolCalendarDate({ date: (schoolYear?.firstDay||'') })}</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Last official day: {formatSchoolCalendarDate({ date: (schoolYear?.lastOfficialDay||'') })}</p>
              </motion.article>
              <motion.article variants={fadeUp} className="rounded-2xl border border-gray-100 bg-gray-50 p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
                <p className="text-xs font-bold uppercase tracking-wide text-kcs-blue-600 dark:text-kcs-blue-300">Semesters</p>
                <div className="mt-3 space-y-3">{(schoolYear?.semesters||[]).map((period) => (
                  <div key={period.code}><p className="font-bold text-kcs-blue-950 dark:text-white">{period.code} · {period.name}</p><p className="text-xs text-gray-500 dark:text-gray-400">{formatSchoolCalendarDate({ date: period.startDate, endDate: period.endDate })}</p></div>
                ))}</div>
              </motion.article>
              <motion.article variants={fadeUp} className="rounded-2xl border border-gray-100 bg-gray-50 p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
                <p className="text-xs font-bold uppercase tracking-wide text-kcs-blue-600 dark:text-kcs-blue-300">Quarters · 45 instructional days each</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">{(schoolYear?.quarters||[]).map((period) => (
                  <div key={period.code}><p className="font-bold text-kcs-blue-950 dark:text-white">{period.code} · {period.name}</p><p className="text-xs text-gray-500 dark:text-gray-400">{formatSchoolCalendarDate({ date: period.startDate, endDate: period.endDate })}</p></div>
                ))}</div>
              </motion.article>
            </div>
          </AnimSection>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-10">
            <SearchField wrapperClassName="flex-1 max-w-md" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search news & events..." />
            <div className="flex gap-2 flex-wrap">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 capitalize ${
                    activeCategory === cat
                      ? 'bg-kcs-blue-700 text-white shadow-kcs'
                      : 'bg-gray-100 dark:bg-kcs-blue-900/30 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-kcs-blue-800/50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Posts Grid */}
            <div data-site-exclude className="lg:col-span-2">
              <AnimSection>
                <div className="grid sm:grid-cols-2 gap-5">
                  {filtered.slice(1).map((post) => (
                    <motion.article data-site-exclude
                      key={post.id}
                      variants={fadeUp}
                      whileHover={{ y: -5 }}
                      className="bg-white dark:bg-kcs-blue-900/50 rounded-2xl overflow-hidden border border-gray-100 dark:border-kcs-blue-800 shadow-sm hover:shadow-kcs transition-all duration-300 group"
                    >
                      <div className="relative h-44 overflow-hidden">
                        <img
                          src={post.image}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                        <div className="absolute top-3 left-3">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${categoryColors[post.category]}`}>
                            {post.category}
                          </span>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500 mb-2">
                          <span className="flex items-center gap-1"><Calendar size={11} /> {post.date}</span>
                        </div>
                        <h3 className="font-bold text-kcs-blue-900 dark:text-white mb-2 line-clamp-2 text-sm leading-tight">
                          {post.title}
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 text-xs line-clamp-2 mb-3">{post.excerpt}</p>
                        <Link
                          to={`/news/${post.id}`}
                          className="text-kcs-blue-600 dark:text-kcs-blue-400 text-xs font-semibold flex items-center gap-1 hover:gap-2 transition-all"
                        >
                          Read More <ArrowRight size={12} />
                        </Link>
                      </div>
                    </motion.article>
                  ))}
                </div>

                {filtered.length === 0 && (
                  <div className="text-center py-16 text-gray-400">
                    <Search size={40} className="mx-auto mb-3 opacity-50" />
                    <p>{language === 'fr' ? `Aucun résultat trouvé pour « ${searchQuery} »` : `No results found for "${searchQuery}"`}</p>
                  </div>
                )}
              </AnimSection>
            </div>

            {/* Sidebar: Upcoming Events */}
            <div className="lg:col-span-1">
              <div className="sticky top-28">
                <div className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
                  <div className="p-5 kcs-gradient">
                    <h3 className="flex items-center gap-2 font-bold text-white">
                      <Calendar size={18} className="text-kcs-gold-400" />
                      {language==='fr'?'Événements officiels':'Official events'}
                    </h3>
                  </div>
                  <fieldset className="grid gap-2 border-b border-sky-200 p-4 dark:border-sky-800"><legend className="sr-only">{language==='fr'?'Rechercher dans le calendrier':'Search calendar'}</legend><input aria-label={language==='fr'?'Rechercher un événement':'Search events'} value={eventSearch} onChange={event=>setEventSearch(event.target.value)} placeholder={language==='fr'?'Titre, date, lieu…':'Title, date, location…'} className="min-w-0 rounded-xl border px-3 py-2 text-sm"/><div className="grid grid-cols-2 gap-2"><select aria-label={language==='fr'?'Période des événements':'Event range'} value={eventWindow} onChange={event=>setEventWindow(event.target.value)} className="min-w-0 rounded-xl border px-2 py-2 text-xs"><option value="upcoming">{language==='fr'?'À venir':'Upcoming'}</option><option value="all">{language==='fr'?'Tous':'All dates'}</option></select><select aria-label={language==='fr'?'Mois de l’événement':'Event month'} value={eventMonth} onChange={event=>setEventMonth(event.target.value)} className="min-w-0 rounded-xl border px-2 py-2 text-xs"><option value="all">{language==='fr'?'Tous les mois':'All months'}</option>{monthOptions.map(month=><option key={month} value={month}>{new Date(month+'-15T12:00:00Z').toLocaleDateString(language==='fr'?'fr-FR':'en-GB',{month:'short',year:'numeric'})}</option>)}</select></div></fieldset>
                  <div className="divide-y divide-gray-100 dark:divide-kcs-blue-800">
                    {displayedUpcomingEvents.length ? displayedUpcomingEvents.map((event) => (
                      <article key={`${event.date}-${event.title}`} hidden={!visibleEventKeys.has(eventKey(event))} className="p-4 transition-colors hover:bg-white dark:hover:bg-kcs-blue-800/50">
                        <p className="text-xs font-bold text-kcs-gold-700 dark:text-kcs-gold-300">{formatSchoolCalendarDate(event)}</p>
                        <p className="mt-1 font-semibold text-kcs-blue-900 dark:text-white">{event.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{event.description}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${eventTypeColors[event.type]}`}>{event.type}</span>
                          <span className="text-xs text-gray-400">{event.location}</span>
                        </div>
                      </article>
                    )) : (
                      <p className="p-5 text-sm text-gray-500 dark:text-gray-400">The 2026-2027 official calendar is complete.</p>
                    )}
                  </div>
                  {!eventMatches.length&&<p role="status" className="p-4 text-sm text-slate-600 dark:text-slate-200">{language==='fr'?'Aucun événement ne correspond à cette sélection.':'No events match this selection.'}</p>}
                  <nav className="flex items-center justify-between gap-2 border-t border-sky-100 p-3 text-xs dark:border-sky-800" aria-label={language==='fr'?'Pages du calendrier':'Calendar pages'}><button type="button" aria-label={language==='fr'?'Événements précédents':'Previous events'} disabled={currentEventPage===1} onClick={()=>setEventPage(value=>Math.max(1,value-1))} className="rounded-lg border px-3 py-2 disabled:opacity-40">←</button><span>{eventMatches.length} {language==='fr'?'événement(s)':'event(s)'} · {currentEventPage}/{eventPages}</span><button type="button" aria-label={language==='fr'?'Événements suivants':'Next events'} disabled={currentEventPage===eventPages} onClick={()=>setEventPage(value=>Math.min(eventPages,value+1))} className="rounded-lg border px-3 py-2 disabled:opacity-40">→</button></nav>
                  <div className="border-t border-gray-100 p-4 dark:border-kcs-blue-800">
                    <button type="button" onClick={() => {setEventWindow('all');setShowFullCalendar((visible) => !visible);requestAnimationFrame(()=>document.getElementById('news-full-calendar')?.scrollIntoView({block:'start',behavior:'smooth'}))}} className="flex w-full items-center justify-center gap-1 text-center text-sm font-semibold text-kcs-blue-600 transition-all hover:gap-2 dark:text-kcs-blue-400">
                      {showFullCalendar?(language==='fr'?'Masquer le calendrier complet':'Hide Full Calendar'):(language==='fr'?'Calendrier complet':'View Full Calendar')} <ArrowRight size={14} className={showFullCalendar ? 'rotate-90' : ''} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {showFullCalendar && (
            <AnimSection className="mt-12">
              <motion.div id="news-full-calendar" variants={fadeUp} className="max-h-[70dvh] overflow-y-auto rounded-3xl border border-kcs-blue-100 bg-kcs-blue-50 p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/40 sm:p-7">
                <div className="mb-6">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-kcs-gold-700 dark:text-kcs-gold-300">{language==='fr'?'Événements publiés par KCS':'Events published by KCS'}</p>
                  <h2 className="mt-2 font-display text-2xl font-bold text-kcs-blue-950 dark:text-white">Full Official Calendar</h2>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{language==='fr'?'Les dates ci-dessous proviennent des événements publiés par la direction.':'The dates below come from events published by school leadership.'}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {(managed?liveEvents.map(event=>({date:event.startDate,endDate:event.endDate,title:event.title,description:event.description,type:String(event.type).toLowerCase(),location:event.location})):schoolCalendarEvents2026_2027).map((event) => (
                    <article key={`full-${event.date}-${event.title}`} className="rounded-xl border border-white bg-white p-4 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-950/60">
                      <p className="text-xs font-bold text-kcs-gold-700 dark:text-kcs-gold-300">{formatSchoolCalendarDate(event)}</p>
                      <h3 className="mt-1 font-bold text-kcs-blue-950 dark:text-white">{event.title}</h3>
                      <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{event.description}</p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${eventTypeColors[event.type]}`}>{event.type}</span>
                        <span className="text-xs text-gray-400">{event.location}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </motion.div>
            </AnimSection>
          )}
        </div>
      </section>
    </div>
  )
}

export default NewsPage
