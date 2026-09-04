import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { Calendar, ArrowRight, Clock, Search } from 'lucide-react'
import SearchField from '@/components/shared/SearchField'
import { kcsPublicImages } from '@/data/kcsPublicImages'
import { formatSchoolCalendarDate, getUpcomingSchoolEvents, schoolCalendarEvents2026_2027, schoolYear2026_2027 } from '@/data/schoolCalendar2026_2027'

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
}

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }

const AnimSection = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? 'visible' : 'hidden'} variants={stagger} className={className}>
      {children}
    </motion.div>
  )
}

const allPosts = [
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
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFullCalendar, setShowFullCalendar] = useState(false)

  const filtered = allPosts.filter((p) => {
    const matchCategory = activeCategory === 'all' || p.category === activeCategory
    const matchSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.excerpt.toLowerCase().includes(searchQuery.toLowerCase())
    return matchCategory && matchSearch
  })

  const featured = allPosts[0]

  return (
    <div className="pt-20">
      {/* HERO */}
      <section className="relative py-20 kcs-gradient overflow-hidden">
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
      <section className="py-12 bg-gray-50 dark:bg-kcs-blue-950/50">
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
      </section>

      {/* FILTERS & GRID */}
      <section className="py-16 bg-white dark:bg-kcs-blue-950">
        <div className="container-custom">
          <AnimSection className="mb-12">
            <motion.div variants={fadeUp} className="mb-6">
              <span className="badge-gold mb-3 inline-flex items-center gap-2 text-sm">
                <Calendar size={14} /> Official 2026-2027 Calendar
              </span>
              <h2 className="font-display text-3xl font-bold text-kcs-blue-900 dark:text-white">
                One verified calendar for the whole KCS ecosystem
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                Nexus, Savanex, EduPay, EduSync and Academy use the same school year, semester and trimester reference dates.
              </p>
            </motion.div>

            <div className="grid gap-5 lg:grid-cols-3">
              <motion.article variants={fadeUp} className="rounded-2xl border border-kcs-blue-100 bg-kcs-blue-50 p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
                <p className="text-xs font-bold uppercase tracking-wide text-kcs-blue-600 dark:text-kcs-blue-300">School year</p>
                <h3 className="mt-2 text-xl font-bold text-kcs-blue-950 dark:text-white">{schoolYear2026_2027.name}</h3>
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">First day: {formatSchoolCalendarDate({ date: schoolYear2026_2027.firstDay })}</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Last official day: {formatSchoolCalendarDate({ date: schoolYear2026_2027.lastOfficialDay })}</p>
              </motion.article>
              <motion.article variants={fadeUp} className="rounded-2xl border border-gray-100 bg-gray-50 p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
                <p className="text-xs font-bold uppercase tracking-wide text-kcs-blue-600 dark:text-kcs-blue-300">Semesters</p>
                <div className="mt-3 space-y-3">{schoolYear2026_2027.semesters.map((period) => (
                  <div key={period.code}><p className="font-bold text-kcs-blue-950 dark:text-white">{period.code} · {period.name}</p><p className="text-xs text-gray-500 dark:text-gray-400">{formatSchoolCalendarDate({ date: period.startDate, endDate: period.endDate })}</p></div>
                ))}</div>
              </motion.article>
              <motion.article variants={fadeUp} className="rounded-2xl border border-gray-100 bg-gray-50 p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
                <p className="text-xs font-bold uppercase tracking-wide text-kcs-blue-600 dark:text-kcs-blue-300">Trimesters</p>
                <div className="mt-3 space-y-3">{schoolYear2026_2027.trimesters.map((period) => (
                  <div key={period.code}><p className="font-bold text-kcs-blue-950 dark:text-white">{period.code} · {period.name}</p><p className="text-xs text-gray-500 dark:text-gray-400">{formatSchoolCalendarDate({ date: period.startDate, endDate: period.endDate })}</p></div>
                ))}</div>
              </motion.article>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {schoolYear2026_2027.quarterEnds.map((quarter) => (
                <span key={quarter.code} className="rounded-full border border-kcs-gold-200 bg-kcs-gold-50 px-3 py-1.5 text-xs font-bold text-kcs-blue-800">
                  {quarter.code} ends {formatSchoolCalendarDate({ date: quarter.date })}
                </span>
              ))}
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
            <div className="lg:col-span-2">
              <AnimSection>
                <div className="grid sm:grid-cols-2 gap-5">
                  {filtered.slice(1).map((post) => (
                    <motion.article
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
                    <p>No results found for "{searchQuery}"</p>
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
                      Upcoming Official Events
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-kcs-blue-800">
                    {upcomingEvents.length ? upcomingEvents.map((event) => (
                      <article key={`${event.date}-${event.title}`} className="p-4 transition-colors hover:bg-white dark:hover:bg-kcs-blue-800/50">
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
                  <div className="border-t border-gray-100 p-4 dark:border-kcs-blue-800">
                    <button type="button" onClick={() => setShowFullCalendar((visible) => !visible)} className="flex w-full items-center justify-center gap-1 text-center text-sm font-semibold text-kcs-blue-600 transition-all hover:gap-2 dark:text-kcs-blue-400">
                      {showFullCalendar ? 'Hide Full Calendar' : 'View Full Calendar'} <ArrowRight size={14} className={showFullCalendar ? 'rotate-90' : ''} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {showFullCalendar && (
            <AnimSection className="mt-12">
              <motion.div variants={fadeUp} className="rounded-3xl border border-kcs-blue-100 bg-kcs-blue-50 p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/40 sm:p-7">
                <div className="mb-6">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-kcs-gold-700 dark:text-kcs-gold-300">Approved source: KCS 2026-2027 School Event Calendar</p>
                  <h2 className="mt-2 font-display text-2xl font-bold text-kcs-blue-950 dark:text-white">Full Official Calendar</h2>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">All dates below come from the school calendar supplied by KCS administration.</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {schoolCalendarEvents2026_2027.map((event) => (
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
