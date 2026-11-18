import './publicGallery.css'
import {createPortal} from 'react-dom'
import {useUIStore} from '@/store/uiStore'
import PublicBroadcastGallery from '@/components/shared/PublicBroadcastGallery'
import SchoolVideoPlayer from '@/components/shared/SchoolVideoPlayer'
import { useEffect, useMemo, useState, useRef } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { Play, X, Camera, Film, Radio, RefreshCw, ChevronRight } from 'lucide-react'
import { kcsPublicImages } from '@/data/kcsPublicImages'
import { api,mediaAPI } from '@/services/api'

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
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

const categories = ['All', 'Campus Life', 'Academics', 'Sports', 'Arts', 'Faith', 'Events'] as const

type Category = (typeof categories)[number]

type GalleryItem = {
  id: number | string
  title: string
  category: Exclude<Category, 'All'>
  type: 'image' | 'video'
  image: string
  subtitle: string
  videoUrl?:string
  featured?: boolean
}

const galleryItems: GalleryItem[] = [
  {
    id: 1,
    title: 'Morning Assembly in the Courtyard',
    category: 'Faith',
    type: 'image',
    image: kcsPublicImages.assembly,
    subtitle: 'Students gather for prayer, worship, and announcements every morning.',
    featured: true,
  },
  {
    id: 2,
    title: 'Robotics and Innovation Lab',
    category: 'Academics',
    type: 'image',
    image: kcsPublicImages.qualityEducation,
    subtitle: 'Hands-on STEM learning with coding, robotics, and prototyping.',
  },
  {
    id: 3,
    title: 'Varsity Basketball Tournament',
    category: 'Sports',
    type: 'image',
    image: kcsPublicImages.brazzavilleTrip,
    subtitle: 'Competition, discipline, and school spirit in action.',
  },
  {
    id: 4,
    title: 'Elementary Art Showcase',
    category: 'Arts',
    type: 'image',
    image: kcsPublicImages.springConcert,
    subtitle: 'Creative expression across painting, sculpture, and mixed media.',
  },
  {
    id: 5,
    title: 'International Day Celebration',
    category: 'Events',
    type: 'image',
    image: kcsPublicImages.thanksgiving,
    subtitle: 'A vibrant celebration of the cultures represented at KCS.',
    featured: true,
  },
  {
    id: 6,
    title: 'High School Science Fair',
    category: 'Academics',
    type: 'image',
    image: kcsPublicImages.middleSchool,
    subtitle: 'Student-led experiments, inquiry, and presentation excellence.',
  },
  {
    id: 7,
    title: 'Choir Rehearsal Before Concert Night',
    category: 'Arts',
    type: 'video',
    image: kcsPublicImages.springConcert,
    subtitle: 'Preparing harmonies for the annual spring performance.',
  },
  {
    id: 8,
    title: 'Library Research Session',
    category: 'Campus Life',
    type: 'image',
    image: kcsPublicImages.elementaryHome,
    subtitle: 'Quiet focus, collaboration, and deep reading across grade levels.',
  },
  {
    id: 9,
    title: 'Student Leadership Retreat',
    category: 'Faith',
    type: 'video',
    image: kcsPublicImages.annualRetreat,
    subtitle: 'Formation, mentorship, and servant leadership development.',
  },
  {
    id: 10,
    title: 'Football Training Session',
    category: 'Sports',
    type: 'image',
    image: kcsPublicImages.brazzavilleTrip,
    subtitle: 'Teamwork and athletic excellence on the KCS field.',
  },
  {
    id: 11,
    title: 'Campus Green Spaces',
    category: 'Campus Life',
    type: 'image',
    image: kcsPublicImages.campusGlory,
    subtitle: 'Safe, beautiful environments designed for growth and connection.',
  },
  {
    id: 12,
    title: 'Graduation Ceremony Highlights',
    category: 'Events',
    type: 'video',
    image: kcsPublicImages.graduation,
    subtitle: 'A milestone celebration for students and families.',
    featured: true,
  },
]

const GalleryPage = () => {
  const language=useUIStore(state=>state.language)
  const tr=(fr:string,en:string)=>language==='fr'?fr:en
  const [section,setSection]=useState<'photos'|'videos'|'live'>('photos')
  const selectSection=(value:'photos'|'videos'|'live')=>{setSection(value);requestAnimationFrame(()=>document.getElementById('gallery-sections')?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}))}
  const [refreshing,setRefreshing]=useState(false),[loadError,setLoadError]=useState(false)
  const [activeCategory, setActiveCategory] = useState<Category>('All')
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null)
  useEffect(()=>{if(!selectedItem)return;const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;document.body.style.overflow='hidden';const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setSelectedItem(null)};document.addEventListener('keydown',close);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',close);previous?.focus()}},[selectedItem])
  const [publishedGallery, setPublishedGallery] = useState<GalleryItem[]>([])
  const [managed,setManaged]=useState<boolean|null>(null)

  useEffect(() => {
    let alive=true,pending=false
    const refresh=async()=>{
      if(pending||document.visibilityState==='hidden')return
      pending=true;if(alive)setRefreshing(true)
      try{
        const [{data},status]=await Promise.all([mediaAPI.getAll(),api.get('/site-content/publication-status')])
        if(!alive)return
        setManaged(status.data.data?.managed===true);setLoadError(false)
      const records = Array.isArray(data?.data) ? data.data : []
      setPublishedGallery(records
        .filter((item: any) => String(item.category || '').toLowerCase() === 'gallery')
        .map((item: any) => ({
          id: item.id,
          title: item.title,
          subtitle: item.description || 'A moment from life at Kinshasa Christian School.',
          category: (item.tags || []).map((tag: string) => categories.find((category) => category.toLowerCase() === String(tag).toLowerCase())).find(Boolean) || 'Campus Life',
          type: String(item.type).toUpperCase() === 'VIDEO' ? 'video' : 'image',
          image: item.thumbnailUrl || (String(item.type).toUpperCase()==='VIDEO'?kcsPublicImages.campusGlory:item.url),
          videoUrl:String(item.type).toUpperCase()==='VIDEO'?item.url:undefined,
          featured: (item.tags || []).some((tag: string) => String(tag).toLowerCase() === 'featured'),
        })))

      }catch{if(alive)setLoadError(true)}finally{pending=false;if(alive)setRefreshing(false)}
    }
    const wake=()=>{void refresh()}
    wake();const timer=window.setInterval(wake,30000)
    window.addEventListener('focus',wake);window.addEventListener('online',wake);window.addEventListener('kcs-gallery-refresh',wake);document.addEventListener('visibilitychange',wake)
    return()=>{alive=false;window.clearInterval(timer);window.removeEventListener('focus',wake);window.removeEventListener('online',wake);window.removeEventListener('kcs-gallery-refresh',wake);document.removeEventListener('visibilitychange',wake)}
  }, [])

  const allGalleryItems = useMemo(() => (managed!==false||publishedGallery.length) ? publishedGallery : galleryItems, [publishedGallery,managed])

  const filteredItems = useMemo(() => {
    return allGalleryItems.filter(item=>item.type==='image'&&(activeCategory==='All'||item.category===activeCategory))
  }, [activeCategory, allGalleryItems])

  const imageItems = allGalleryItems.filter((item) => item.type === 'image')
  const featuredItems = (imageItems.filter((item) => item.featured).length
    ? imageItems.filter((item) => item.featured)
    : imageItems.length ? imageItems : allGalleryItems).slice(0, 3)

  return (
    <div className="public-gallery-page bg-white dark:bg-kcs-blue-950 min-h-screen">
      <section className="relative min-h-[78vh] overflow-hidden bg-kcs-blue-950 text-white" data-public-hero>
        <div className="absolute inset-0 grid grid-cols-3 gap-3 p-3 opacity-25">
          {featuredItems.map((item) => (
            <div
              data-site-exclude key={item.id}
              className="rounded-3xl bg-cover bg-center"
              style={{ backgroundImage: `url(${item.image})` }}
            />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-kcs-blue-950/95 via-kcs-blue-900/80 to-kcs-gold-900/30" />
        <div className="absolute inset-0 dots-bg opacity-30" />

        <div className="relative container-custom py-24 md:py-32">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="max-w-3xl">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/15 bg-white/10 text-sm font-medium text-kcs-gold-300 mb-6">
              <Camera size={14} /> Life At KCS
            </span>
            <h1 className="text-4xl md:text-6xl font-bold font-display leading-tight mb-5">
              A Gallery Built Around
              <span className="block text-kcs-gold-400">Learning, Faith, and Belonging</span>
            </h1>
            <p className="text-lg text-kcs-blue-100 max-w-2xl mb-8">
              Explore the rhythm of Kinshasa Christian School through classrooms, competitions, worship, the arts, and the moments that shape student life.
            </p>
            <div className="flex flex-wrap gap-4">
              <a href="#gallery-sections" onClick={()=>selectSection('photos')} className="btn-gold">{tr('Voir les photos','Browse photos')}</a>
              <a href="#gallery-sections" onClick={()=>selectSection('videos')} className="btn-primary bg-white/10 border border-white/15">{tr('Voir les vidéos','Watch videos')}</a>
            </div>
          </motion.div>
        </div>
      </section>


      <nav id="gallery-sections" onKeyDown={event=>{if((event.target as HTMLElement).getAttribute('role')!=='tab'||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const keys=['photos','videos','live'] as const,index=keys.indexOf(section),next=event.key==='Home'?0:event.key==='End'?2:(index+(event.key==='ArrowRight'?1:2))%3;selectSection(keys[next]);requestAnimationFrame(()=>document.getElementById('gallery-tab-'+keys[next])?.focus())}} data-site-exclude aria-label={tr('Photos, vidéos et directs','Photos, videos and live streams')} className="scroll-mt-28 border-b border-sky-200 bg-sky-50 py-5 dark:border-sky-900 dark:bg-kcs-blue-900">
        <div className="container-custom flex flex-wrap items-center gap-3" role="tablist">{([
          ['photos',Camera,tr('Photos','Photos'),imageItems.length],
          ['videos',Film,tr('Vidéos','Videos'),allGalleryItems.filter(item=>item.type==='video'&&item.videoUrl).length],
          ['live',Radio,tr('Directs et replays','Live streams & replays'),null],
        ] as const).map(([key,Icon,label,count])=><button key={key} id={'gallery-tab-'+key} role="tab" aria-selected={section===key} aria-controls={key==='photos'?'collection':'videos'} onClick={()=>selectSection(key)} className={'inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-bold transition '+(section===key?'border-sky-700 bg-sky-800 text-white shadow-md':'border-sky-200 bg-white text-sky-950 hover:bg-sky-100 dark:border-sky-700 dark:bg-kcs-blue-950 dark:text-sky-100')}><Icon size={19}/>{label}{count!==null&&<span className="rounded-full bg-current/10 px-2 text-xs">{count}</span>}</button>)}<button type="button" disabled={refreshing} onClick={()=>window.dispatchEvent(new Event('kcs-gallery-refresh'))} aria-label={tr('Actualiser la galerie','Refresh gallery')} className="ml-auto rounded-xl border border-sky-300 p-3 text-sky-800 dark:border-sky-600 dark:text-sky-100"><RefreshCw size={18} className={refreshing?'animate-spin':''}/></button></div>
        {loadError&&<p role="status" className="container-custom mt-3 text-sm text-amber-800 dark:text-amber-200">{tr('La mise à jour est momentanément indisponible. Les dernières publications chargées restent affichées.','Refresh is temporarily unavailable. The last loaded publications remain visible.')}</p>}
      </nav>
      <section id="gallery-statistics" data-site-exclude className="public-gallery-stats section-padding bg-gray-50 dark:bg-kcs-blue-900/20">
        <div className="container-custom">
          <AnimSection>
            <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: tr('Photos publiées','Published photos'), value: String(imageItems.length) },
                { label: tr('Vidéos publiées','Published videos'), value: String(allGalleryItems.filter(item=>item.type==='video'&&item.videoUrl).length) },
                { label: tr('Collections représentées','Collections represented'), value: String(new Set(allGalleryItems.map(item=>item.category)).size) },
                { label: tr('Publications à la une','Featured publications'), value: String(allGalleryItems.filter(item=>item.featured).length) },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-gray-100 dark:border-kcs-blue-800 bg-white dark:bg-kcs-blue-900/50 p-5">
                  <p className="text-3xl font-bold font-display text-kcs-blue-900 dark:text-white">{stat.value}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{stat.label}</p>
                </div>
              ))}
            </motion.div>
          </AnimSection>
        </div>
      </section>

      <section hidden={section!=='photos'} role="tabpanel" aria-labelledby="gallery-tab-photos" id="collection" className="section-padding bg-white dark:bg-kcs-blue-950">
        <div className="container-custom">
          <AnimSection>
            <motion.div variants={fadeUp} className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
              <div>
                <h2 className="text-3xl font-bold font-display text-kcs-blue-900 dark:text-white mb-3">Photo Collection</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-2xl">
                  Filter by theme to see how KCS blends academic rigor, character formation, and a globally minded campus culture.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      activeCategory === category
                        ? 'kcs-gradient text-white shadow-kcs'
                        : 'bg-gray-100 dark:bg-kcs-blue-900/50 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-kcs-blue-800'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </motion.div>

            <motion.div variants={stagger} className="columns-1 md:columns-2 xl:columns-3 gap-6 space-y-6">
              {filteredItems.map((item) => (
                <motion.button
                  data-site-exclude key={item.id}
                  variants={fadeUp}
                  whileHover={{ y: -6 }}
                  onClick={() => setSelectedItem(item)}
                  className="group relative w-full overflow-hidden rounded-3xl bg-white dark:bg-kcs-blue-900/60 border border-gray-100 dark:border-kcs-blue-800 text-left break-inside-avoid shadow-sm hover:shadow-kcs transition-all duration-300"
                >
                  <div className="relative overflow-hidden">
                    {item.type === 'video'
                      ? <img src={item.image} alt={item.title} loading="lazy" className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      : <img src={item.image} alt={item.title} className="w-full object-cover transition-transform duration-500 group-hover:scale-105" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-90" />
                    <div className="absolute top-4 left-4 flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/15 text-white backdrop-blur-md border border-white/10">
                        {item.category}
                      </span>
                      {item.type === 'video' && (
                        <span className="w-9 h-9 rounded-full bg-kcs-gold-500 text-kcs-blue-950 flex items-center justify-center shadow-lg">
                          <Play size={16} fill="currentColor" />
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <p className="text-white text-xl font-bold font-display mb-2 leading-tight">{item.title}</p>
                      <p className="text-white/80 text-sm leading-relaxed">{item.subtitle}</p>
                    </div>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          </AnimSection>
        </div>
      </section>

      <section hidden={section==='photos'} role="tabpanel" aria-labelledby={'gallery-tab-'+section} id="videos" className="section-padding bg-gray-50 dark:bg-kcs-blue-900/20">
        <div className="container-custom">
          <AnimSection>
            <motion.div variants={fadeUp} className="text-center mb-12">
              <h2 className="text-3xl font-bold font-display text-kcs-blue-900 dark:text-white mb-3">{section==='live'?tr('Directs et replays','Live streams & replays'):tr('Vidéos à la une','Video Highlights')}</h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
                {section==='live'?tr('Retrouvez les événements diffusés par l’école, en direct ou en replay.','Follow school broadcasts, live or on replay.'):tr('Les vidéos publiées par l’école, réunies dans un espace dédié.','School videos, together in their own dedicated space.')}
              </p>
            </motion.div>
            <div hidden={section!=='videos'} className="grid lg:grid-cols-3 gap-6">
              {allGalleryItems
                .filter((item) => item.type === 'video' && Boolean(item.videoUrl))
                .map((item) => (
                  <motion.button
                    data-site-exclude data-gallery-video-card key={item.id}
                    variants={fadeUp}
                    onClick={() => setSelectedItem(item)}
                    className="group overflow-hidden rounded-3xl bg-white dark:bg-kcs-blue-900/50 border border-gray-100 dark:border-kcs-blue-800 text-left hover:shadow-kcs transition-all"
                  >
                    <div className="relative aspect-video overflow-hidden">
                      <img src={item.image} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="w-16 h-16 rounded-full bg-kcs-gold-500 text-kcs-blue-950 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                          <Play size={24} fill="currentColor" />
                        </span>
                      </div>
                    </div>
                    <div data-video-caption className="space-y-2 p-5">
                      <p className="break-words text-lg font-bold font-display text-kcs-blue-950 dark:text-white">{item.title}</p>
                      <p className="line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-slate-200">{item.subtitle}</p>
                    </div>
                  </motion.button>
                ))}
            </div>
          {section==='videos'&&!allGalleryItems.some(item=>item.type==='video'&&item.videoUrl)&&<div data-site-exclude className="mx-auto max-w-2xl rounded-3xl border border-dashed border-sky-300 bg-sky-50 p-9 text-center dark:border-sky-700 dark:bg-kcs-blue-900"><Film size={36} className="mx-auto mb-4 text-sky-700 dark:text-sky-200"/><h3 className="font-bold text-sky-950 dark:text-white">{tr('L’espace vidéo est prêt','Your video space is ready')}</h3><p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{tr('Les vidéos apparaîtront ici dès leur publication par l’école.','Videos will appear here as soon as the school publishes them.')}</p></div>}
          <div hidden={section!=='live'}><PublicBroadcastGallery/></div>
          </AnimSection>
        </div>
      </section>

      <section className="section-padding bg-kcs-blue-950 text-white">
        <div className="container-custom">
          <AnimSection>
            <motion.div variants={fadeUp} className="rounded-[2rem] border border-white/10 bg-white/5 p-8 md:p-12 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="max-w-2xl">
                <p className="text-kcs-gold-300 font-semibold mb-2">Visit In Person</p>
                <h2 className="text-3xl font-bold font-display mb-3">Experience The Campus Beyond The Screen</h2>
                <p className="text-kcs-blue-100">
                  Schedule a guided visit to meet our team, walk the campus, and see the culture of KCS first-hand.
                </p>
              </div>
              <a href="/contact" className="btn-gold whitespace-nowrap">
                Book A Campus Tour <ChevronRight size={16} className="inline ml-1" />
              </a>
            </motion.div>
          </AnimSection>
        </div>
      </section>

      {createPortal(<AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog" aria-modal="true" aria-label={selectedItem.title} data-gallery-viewer className="fixed inset-0 z-[210] bg-black/85 backdrop-blur-md p-4 md:p-8"
            onClick={() => setSelectedItem(null)}
          >
            <div className="relative mx-auto flex h-full max-w-6xl items-center justify-center">
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => setSelectedItem(null)}
                autoFocus aria-label={language==='fr'?'Fermer la vidéo ou la photo':'Close video or photo'}
                className="absolute right-0 top-0 z-10 w-12 h-12 rounded-full bg-white/10 text-white border border-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <X size={20} />
              </motion.button>

              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.96 }}
                transition={{ duration: 0.25 }}
                onClick={(event) => event.stopPropagation()}
                className="grid max-h-[calc(100dvh-6rem)] w-full overflow-y-auto rounded-[2rem] border border-white/10 bg-kcs-blue-950 lg:grid-cols-[1.35fr_0.65fr]"
              >
                <div className="relative min-h-[320px] bg-black">
                  {selectedItem.type === 'video'
                    ? <SchoolVideoPlayer url={selectedItem.videoUrl||selectedItem.image} title={selectedItem.title} poster={selectedItem.image}/>
                    : <img src={selectedItem.image} alt={selectedItem.title} className="h-full w-full object-cover" />}
                </div>
                <div className="flex flex-col justify-between p-8 text-white">
                  <div>
                    <div className="flex items-center gap-3 mb-5">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/10 border border-white/10">
                        {selectedItem.category}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-sm text-kcs-gold-300">
                        {selectedItem.type === 'video' ? <Film size={14} /> : <Camera size={14} />}
                        {selectedItem.type === 'video' ? 'Video Highlight' : 'Photo Story'}
                      </span>
                    </div>
                    <h3 className="text-3xl font-bold font-display mb-4 leading-tight">{selectedItem.title}</h3>
                    <p className="text-kcs-blue-100 leading-relaxed text-base">{selectedItem.subtitle}</p>
                  </div>
                  <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
                    <p className="text-sm text-kcs-blue-100">
                      This gallery item reflects the everyday excellence, warmth, and purpose that define the student experience at KCS.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}
    </div>
  )
}

export default GalleryPage
