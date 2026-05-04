import { useMemo, useState, useRef } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { Play, X, Camera, Film, ChevronRight } from 'lucide-react'

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
  id: number
  title: string
  category: Exclude<Category, 'All'>
  type: 'image' | 'video'
  image: string
  subtitle: string
  featured?: boolean
}

const galleryItems: GalleryItem[] = [
  {
    id: 1,
    title: 'Morning Assembly in the Courtyard',
    category: 'Faith',
    type: 'image',
    image: 'https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&w=1200&q=80',
    subtitle: 'Students gather for prayer, worship, and announcements every morning.',
    featured: true,
  },
  {
    id: 2,
    title: 'Robotics and Innovation Lab',
    category: 'Academics',
    type: 'image',
    image: 'https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=1200&q=80',
    subtitle: 'Hands-on STEM learning with coding, robotics, and prototyping.',
  },
  {
    id: 3,
    title: 'Varsity Basketball Tournament',
    category: 'Sports',
    type: 'image',
    image: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80',
    subtitle: 'Competition, discipline, and school spirit in action.',
  },
  {
    id: 4,
    title: 'Elementary Art Showcase',
    category: 'Arts',
    type: 'image',
    image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=80',
    subtitle: 'Creative expression across painting, sculpture, and mixed media.',
  },
  {
    id: 5,
    title: 'International Day Celebration',
    category: 'Events',
    type: 'image',
    image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80',
    subtitle: 'A vibrant celebration of the cultures represented at KCS.',
    featured: true,
  },
  {
    id: 6,
    title: 'High School Science Fair',
    category: 'Academics',
    type: 'image',
    image: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=80',
    subtitle: 'Student-led experiments, inquiry, and presentation excellence.',
  },
  {
    id: 7,
    title: 'Choir Rehearsal Before Concert Night',
    category: 'Arts',
    type: 'video',
    image: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?auto=format&fit=crop&w=1200&q=80',
    subtitle: 'Preparing harmonies for the annual spring performance.',
  },
  {
    id: 8,
    title: 'Library Research Session',
    category: 'Campus Life',
    type: 'image',
    image: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1200&q=80',
    subtitle: 'Quiet focus, collaboration, and deep reading across grade levels.',
  },
  {
    id: 9,
    title: 'Student Leadership Retreat',
    category: 'Faith',
    type: 'video',
    image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1200&q=80',
    subtitle: 'Formation, mentorship, and servant leadership development.',
  },
  {
    id: 10,
    title: 'Football Training Session',
    category: 'Sports',
    type: 'image',
    image: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=1200&q=80',
    subtitle: 'Teamwork and athletic excellence on the KCS field.',
  },
  {
    id: 11,
    title: 'Campus Green Spaces',
    category: 'Campus Life',
    type: 'image',
    image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=80',
    subtitle: 'Safe, beautiful environments designed for growth and connection.',
  },
  {
    id: 12,
    title: 'Graduation Ceremony Highlights',
    category: 'Events',
    type: 'video',
    image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80',
    subtitle: 'A milestone celebration for students and families.',
    featured: true,
  },
]

const GalleryPage = () => {
  const [activeCategory, setActiveCategory] = useState<Category>('All')
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null)

  const filteredItems = useMemo(() => {
    if (activeCategory === 'All') return galleryItems
    return galleryItems.filter((item) => item.category === activeCategory)
  }, [activeCategory])

  const featuredItems = galleryItems.filter((item) => item.featured)

  return (
    <div className="bg-white dark:bg-kcs-blue-950 min-h-screen">
      <section className="relative min-h-[78vh] overflow-hidden bg-kcs-blue-950 text-white">
        <div className="absolute inset-0 grid grid-cols-3 gap-3 p-3 opacity-25">
          {featuredItems.map((item) => (
            <div
              key={item.id}
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
              <a href="#collection" className="btn-gold">Browse Collection</a>
              <a href="#videos" className="btn-primary bg-white/10 border border-white/15">Watch Highlights</a>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="section-padding bg-gray-50 dark:bg-kcs-blue-900/20">
        <div className="container-custom">
          <AnimSection>
            <motion.div variants={fadeUp} className="grid lg:grid-cols-4 gap-4">
              {[
                { label: 'Photos', value: '240+' },
                { label: 'Video Stories', value: '18' },
                { label: 'Annual Events Covered', value: '32' },
                { label: 'Student Moments Captured', value: '1,000+' },
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

      <section id="collection" className="section-padding bg-white dark:bg-kcs-blue-950">
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
                  key={item.id}
                  variants={fadeUp}
                  whileHover={{ y: -6 }}
                  onClick={() => setSelectedItem(item)}
                  className="group relative w-full overflow-hidden rounded-3xl bg-white dark:bg-kcs-blue-900/60 border border-gray-100 dark:border-kcs-blue-800 text-left break-inside-avoid shadow-sm hover:shadow-kcs transition-all duration-300"
                >
                  <div className="relative overflow-hidden">
                    <img src={item.image} alt={item.title} className="w-full object-cover transition-transform duration-500 group-hover:scale-105" />
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

      <section id="videos" className="section-padding bg-gray-50 dark:bg-kcs-blue-900/20">
        <div className="container-custom">
          <AnimSection>
            <motion.div variants={fadeUp} className="text-center mb-12">
              <h2 className="text-3xl font-bold font-display text-kcs-blue-900 dark:text-white mb-3">Video Highlights</h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
                A short-form look at signature KCS experiences, from worship gatherings to student-led innovation.
              </p>
            </motion.div>
            <div className="grid lg:grid-cols-3 gap-6">
              {galleryItems
                .filter((item) => item.type === 'video')
                .map((item) => (
                  <motion.button
                    key={item.id}
                    variants={fadeUp}
                    onClick={() => setSelectedItem(item)}
                    className="group overflow-hidden rounded-3xl bg-white dark:bg-kcs-blue-900/50 border border-gray-100 dark:border-kcs-blue-800 text-left hover:shadow-kcs transition-all"
                  >
                    <div className="relative h-64 overflow-hidden">
                      <img src={item.image} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-kcs-blue-950/90 via-kcs-blue-950/20 to-transparent" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="w-16 h-16 rounded-full bg-kcs-gold-500 text-kcs-blue-950 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                          <Play size={24} fill="currentColor" />
                        </span>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-5">
                        <p className="text-white text-xl font-bold font-display mb-1">{item.title}</p>
                        <p className="text-white/75 text-sm">{item.subtitle}</p>
                      </div>
                    </div>
                  </motion.button>
                ))}
            </div>
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

      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md p-4 md:p-8"
            onClick={() => setSelectedItem(null)}
          >
            <div className="relative mx-auto flex h-full max-w-6xl items-center justify-center">
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => setSelectedItem(null)}
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
                className="grid w-full overflow-hidden rounded-[2rem] border border-white/10 bg-kcs-blue-950 lg:grid-cols-[1.35fr_0.65fr]"
              >
                <div className="relative min-h-[320px] bg-black">
                  <img src={selectedItem.image} alt={selectedItem.title} className="h-full w-full object-cover" />
                  {selectedItem.type === 'video' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-kcs-blue-950/30">
                      <span className="w-20 h-20 rounded-full bg-kcs-gold-500 text-kcs-blue-950 flex items-center justify-center shadow-2xl">
                        <Play size={28} fill="currentColor" />
                      </span>
                    </div>
                  )}
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
      </AnimatePresence>
    </div>
  )
}

export default GalleryPage
