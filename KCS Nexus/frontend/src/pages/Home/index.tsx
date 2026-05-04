import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView, useAnimation } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight, BookOpen, Users, Award, Globe,
  ChevronDown, Star, Play, GraduationCap, Heart,
  Zap, Shield, TrendingUp, Calendar
} from 'lucide-react'
import { SCHOOL_DIVISIONS } from '@/constants/schoolLevels'

// ─── Animation Variants ───────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' } },
}

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
}

const slideIn = (direction: 'left' | 'right') => ({
  hidden: { opacity: 0, x: direction === 'left' ? -60 : 60 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: 'easeOut' } },
})

// ─── Animated Section Wrapper ─────────────────────────────────────────────────
const AnimatedSection = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={staggerContainer}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ─── Stats Data ───────────────────────────────────────────────────────────────
const stats = [
  { value: 'K1-G12', label: 'Christian Education', icon: Users },
  { value: '17', label: 'Levels Offered', icon: Award },
  { value: '2', label: 'Official Phones', icon: Star },
  { value: 'DRC', label: 'Kinshasa Campus', icon: Globe },
]

// ─── Programs ────────────────────────────────────────────────────────────────
const programs = [
  {
    level: SCHOOL_DIVISIONS[0].levels,
    title: 'Kindergarten',
    desc: SCHOOL_DIVISIONS[0].description,
    color: 'from-kcs-gold-500 to-kcs-blue-500',
    icon: '✦',
    highlights: ['Early Literacy', 'Faith Formation', 'Creative Play', 'Character Growth'],
  },
  {
    level: SCHOOL_DIVISIONS[1].levels,
    title: 'Elementary',
    desc: SCHOOL_DIVISIONS[1].description,
    color: 'from-kcs-blue-600 to-blue-700',
    icon: '✦',
    highlights: ['Core Academics', 'Bible Learning', 'Moral Integrity', 'Love of Learning'],
  },
  {
    level: `${SCHOOL_DIVISIONS[2].levels}, ${SCHOOL_DIVISIONS[3].levels}`,
    title: 'Middle & High School',
    desc: 'Equipping students from Grade 6 through Grade 12 with rigorous academics, biblical principles, spiritual maturity, and servant leadership.',
    color: 'from-kcs-blue-800 to-kcs-blue-950',
    icon: '✦',
    highlights: ['Leadership', 'Academic Rigor', 'Spiritual Maturity', 'Future Readiness'],
  },
]

// ─── Values ──────────────────────────────────────────────────────────────────
const values = [
  { icon: Heart, title: 'Faith', desc: 'Spiritual life is prioritized through prayer, Bible studies, services, and mentorship.', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
  { icon: Award, title: 'Excellence', desc: 'KCS commits to high standards in hiring, teaching, care, and performance.', color: 'text-kcs-gold-600', bg: 'bg-kcs-gold-50 dark:bg-kcs-gold-900/20' },
  { icon: Shield, title: 'Biblical Worldview', desc: 'Learning is grounded in Scripture and a Christian understanding of life and conduct.', color: 'text-kcs-blue-600', bg: 'bg-kcs-blue-50 dark:bg-kcs-blue-900/20' },
  { icon: Zap, title: 'Critical Thinking', desc: 'Students are encouraged to grow academically, creatively, socially, and spiritually.', color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  { icon: TrendingUp, title: 'Leadership', desc: 'The school helps raise the next generation of compassionate leaders.', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
  { icon: Globe, title: 'Service', desc: 'KCS encourages mercy, compassion, community service, and love for others.', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
]

// ─── Testimonials ────────────────────────────────────────────────────────────
const testimonials = [
  {
    quote: "KCS is dedicated to helping students grow academically, socially, and spiritually in a nurturing Christian environment.",
    name: 'KCS Students',
    role: 'Shaping the future, one student at a time',
    initials: 'MK',
  },
  {
    quote: "We are committed to excellence, from hiring qualified Christian educators to how we measure instruction and care.",
    name: 'Our Team',
    role: 'We are committed to excellence',
    initials: 'JM',
  },
  {
    quote: "Our mission is to prepare children for a competitive world while helping them show compassion and mercy.",
    name: 'Our Mission',
    role: 'Raising the next generation of leaders',
    initials: 'AD',
  },
]

// ─── News Preview ─────────────────────────────────────────────────────────────
const latestNews = [
  {
    category: 'Event',
    title: 'USA Trip',
    date: 'KCS Event',
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=250&fit=crop',
    excerpt: 'Staff and students explored cultural exchange, educational growth, and renowned academic institutions in the USA.',
  },
  {
    category: 'Event',
    title: 'Brazzaville Trip',
    date: 'KCS Event',
    image: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=400&h=250&fit=crop',
    excerpt: 'KCS students proudly brought home the trophy at the sports and arts festival in Brazzaville.',
  },
  {
    category: 'Community',
    title: 'Legacy Day',
    date: 'KCS Service',
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=250&fit=crop',
    excerpt: 'Students serve the community through street clean-up initiatives and visits to orphanages.',
  },
]

// ─── HOME PAGE ────────────────────────────────────────────────────────────────
const HomePage = () => {
  const { t } = useTranslation()

  return (
    <div className="overflow-x-hidden">
      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Background */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1920&q=80')`,
          }}
        />
        <div className="absolute inset-0 hero-overlay" />

        {/* Animated geometric shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
            className="absolute -top-20 -right-20 w-96 h-96 border border-white/5 rounded-full"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
            className="absolute -bottom-20 -left-20 w-[500px] h-[500px] border border-white/5 rounded-full"
          />
          <div className="absolute top-1/4 right-1/4 w-2 h-2 bg-kcs-gold-400 rounded-full animate-float" />
          <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-white/60 rounded-full animate-float-delay" />
          <div className="absolute bottom-1/4 left-1/4 w-3 h-3 bg-kcs-gold-300/60 rounded-full animate-float" />
        </div>

        {/* Content */}
        <div className="relative z-10 container-custom pt-28 pb-16">
          <div className="max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-kcs-gold-500/20 border border-kcs-gold-400/30 text-kcs-gold-300 text-sm font-medium mb-6"
            >
              <span className="w-2 h-2 bg-kcs-gold-400 rounded-full animate-pulse" />
              Kinshasa Christian School - Macampagne, Ngaliema
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-5xl md:text-6xl lg:text-7xl font-bold font-display text-white leading-tight mb-6"
            >
              Welcome to
              <br />
              <span className="text-gradient-gold">Kinshasa Christian</span>
              <br />
              School
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="text-xl text-kcs-blue-100 leading-relaxed mb-8 max-w-2xl"
            >
              We are committed to help raise the next generation of leaders through
              quality Christian education, biblical values, compassion, and academic excellence.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7 }}
              className="flex flex-wrap gap-4"
            >
              <Link
                to="/admissions"
                className="flex items-center gap-2 btn-gold text-base px-8 py-4 rounded-2xl"
              >
                Enroll Now
                <ArrowRight size={20} />
              </Link>
              <Link
                to="/academics"
                className="flex items-center gap-2 px-8 py-4 rounded-2xl border-2 border-white/30 text-white font-semibold hover:bg-white/10 hover:border-white transition-all duration-300 text-base"
              >
                <Play size={16} />
                Explore Programs
              </Link>
            </motion.div>

            {/* Stats Row */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.9 }}
              className="flex flex-wrap gap-8 mt-16 pt-8 border-t border-white/10"
            >
              {stats.map(({ value, label, icon: Icon }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                    <Icon size={18} className="text-kcs-gold-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white font-display">{value}</p>
                    <p className="text-kcs-blue-200 text-xs">{label}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white/50"
        >
          <ChevronDown size={28} />
        </motion.div>
      </section>

      {/* ── PROGRAMS ─────────────────────────────────────────────────────── */}
      <section className="section-padding bg-gray-50 dark:bg-kcs-blue-950/50">
        <div className="container-custom">
          <AnimatedSection>
            <motion.div variants={fadeUp} className="text-center mb-16">
              <span className="badge-blue text-sm mb-3">Academic Excellence</span>
              <h2 className="text-4xl md:text-5xl font-bold font-display text-kcs-blue-900 dark:text-white mb-4">
                World-Class Academic{' '}
                <span className="text-gradient-blue">Programs</span>
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-lg max-w-2xl mx-auto">
                A comprehensive Christian education from K1 through Grade 12,
                designed for academic growth, spiritual maturity, and strong moral character.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {programs.map((program, i) => (
                <motion.div
                  key={program.title}
                  variants={fadeUp}
                  whileHover={{ y: -8 }}
                  className="github-glass dark:github-glass-dark relative group overflow-hidden rounded-3xl transition-all duration-500 hover:-translate-y-1 hover:shadow-kcs-lg"
                >
                  <div className={`h-2 bg-gradient-to-r ${program.color}`} />
                  <div className="p-8">
                    <div className="text-4xl mb-4">{program.icon}</div>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${program.color} text-white mb-3`}>
                      {program.level}
                    </span>
                    <h3 className="text-xl font-bold font-display text-kcs-blue-900 dark:text-white mb-2">
                      {program.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-5">
                      {program.desc}
                    </p>
                    <ul className="space-y-2">
                      {program.highlights.map((h) => (
                        <li key={h} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-kcs-gold-500 flex-shrink-0" />
                          {h}
                        </li>
                      ))}
                    </ul>
                    <Link
                      to="/academics"
                      className="inline-flex items-center gap-2 mt-6 text-kcs-blue-600 dark:text-kcs-blue-300 font-semibold text-sm hover:gap-3 transition-all duration-200"
                    >
                      Learn More <ArrowRight size={16} />
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── MISSION & VALUES ─────────────────────────────────────────────── */}
      <section className="section-padding bg-white dark:bg-kcs-blue-950">
        <div className="container-custom">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Image & Mission */}
            <AnimatedSection>
              <motion.div variants={slideIn('left')} className="relative">
                <div className="relative rounded-3xl overflow-hidden shadow-kcs-lg">
                  <img
                    src="https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600&q=80"
                    alt="KCS Students"
                    className="w-full h-[480px] object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-kcs-blue-950/60 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="glass-card p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-kcs-gold-500 rounded-xl flex items-center justify-center">
                          <BookOpen size={20} className="text-kcs-blue-950" />
                        </div>
                        <div>
                          <p className="text-white font-semibold text-sm">Spiritual Life at KCS</p>
                          <p className="text-kcs-blue-200 text-xs">Prayer, Bible studies, mentorship</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating stat card */}
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="github-glass dark:github-glass-dark absolute -top-6 -right-6 rounded-2xl p-4"
                >
                  <p className="text-3xl font-bold text-kcs-blue-700 dark:text-white font-display">KCS</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Letting Our</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Light Shine</p>
                </motion.div>
              </motion.div>
            </AnimatedSection>

            {/* Right: Mission */}
            <AnimatedSection>
              <motion.div variants={slideIn('right')}>
                <span className="badge-gold text-sm mb-3">Our Purpose</span>
                <h2 className="text-4xl font-bold font-display text-kcs-blue-900 dark:text-white mb-4">
                  Transforming Lives Through{' '}
                  <span className="text-gradient-gold">Faith & Learning</span>
                </h2>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
                  Kinshasa Christian School provides a nurturing environment where students
                  grow academically, socially, and spiritually. The school empowers young minds
                  through faith-based education, critical thinking, creativity, and Christian values.
                </p>
                <div className="grid grid-cols-2 gap-4 mb-8">
                  {[
                    { label: 'Mission', text: 'Raise the next generation of leaders with compassion and mercy' },
                    { label: 'Vision', text: 'Equip passionate, independent, life-long learners with a biblical worldview' },
                  ].map(({ label, text }) => (
                    <div key={label} className="github-glass dark:github-glass-dark p-4 rounded-2xl">
                      <p className="text-xs font-bold text-kcs-gold-600 dark:text-kcs-gold-400 uppercase tracking-wider mb-1">{label}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{text}</p>
                    </div>
                  ))}
                </div>
                <Link to="/about" className="btn-primary inline-flex items-center gap-2">
                  Learn More About KCS <ArrowRight size={18} />
                </Link>
              </motion.div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ── VALUES GRID ──────────────────────────────────────────────────── */}
      <section className="section-padding bg-gradient-to-br from-kcs-blue-950 to-kcs-blue-900">
        <div className="container-custom">
          <AnimatedSection>
            <motion.div variants={fadeUp} className="text-center mb-16">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-kcs-gold-500/20 border border-kcs-gold-400/30 text-kcs-gold-300 text-sm font-medium mb-4">
                <Heart size={14} />
                Core Values
              </span>
              <h2 className="text-4xl font-bold font-display text-white mb-4">
                What Drives Everything We Do
              </h2>
              <p className="text-kcs-blue-200 text-lg max-w-2xl mx-auto">
                Six pillars that define the KCS experience and shape our students for a lifetime.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {values.map(({ icon: Icon, title, desc, color, bg }, i) => (
                <motion.div
                  key={title}
                  variants={fadeUp}
                  whileHover={{ y: -5 }}
                  className="group p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 backdrop-blur-sm"
                >
                  <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center mb-4`}>
                    <Icon size={22} className={color} />
                  </div>
                  <h3 className="text-lg font-bold text-white font-display mb-2">{title}</h3>
                  <p className="text-kcs-blue-200 text-sm leading-relaxed">{desc}</p>
                </motion.div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── AI PLATFORM HIGHLIGHT ─────────────────────────────────────────── */}
      <section className="section-padding bg-white dark:bg-kcs-blue-950">
        <div className="container-custom">
          <div className="rounded-3xl bg-gradient-to-br from-kcs-blue-700 to-kcs-blue-950 p-10 md:p-16 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-60 h-60 bg-kcs-gold-500/10 rounded-full translate-y-1/2 -translate-x-1/2" />

            <div className="relative z-10 grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-kcs-gold-500/20 border border-kcs-gold-400/30 text-kcs-gold-300 text-sm font-medium mb-5">
                  <Zap size={14} />
                  KCS Nexus Platform
                </span>
                <h2 className="text-3xl md:text-4xl font-bold font-display text-white mb-4">
                  Connected School Life{' '}
                  <span className="text-kcs-gold-300">for KCS</span>
                </h2>
                <p className="text-kcs-blue-100 leading-relaxed mb-6">
                  KCS Nexus brings the school community together with admissions, announcements,
                  events, galleries, portals, and digital learning tools for students, parents, and teachers.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                  {[
                    { title: 'Announcements', desc: 'Important school updates', icon: '✦' },
                    { title: 'Calendar', desc: 'Events and activities', icon: '✦' },
                    { title: 'Portals', desc: 'Student, parent, teacher access', icon: '✦' },
                  ].map((item) => (
                    <div key={item.title} className="p-4 rounded-2xl bg-white/10 border border-white/10">
                      <div className="text-2xl mb-2">{item.icon}</div>
                      <p className="text-white font-semibold text-sm">{item.title}</p>
                      <p className="text-kcs-blue-200 text-xs mt-0.5">{item.desc}</p>
                    </div>
                  ))}
                </div>
                <Link to="/login" className="btn-gold inline-flex items-center gap-2">
                  Access Portal <ArrowRight size={18} />
                </Link>
              </div>

              <div className="hidden lg:flex items-center justify-center">
                <div className="relative w-72 h-72">
                  <div className="absolute inset-0 rounded-full bg-kcs-gold-400/10 animate-pulse" />
                  <div className="absolute inset-4 rounded-full bg-kcs-gold-400/20" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-7xl">🧠</div>
                  </div>
                  {/* Orbiting icons */}
                  {['📚', '🎓', '🔬', '📊'].map((emoji, i) => (
                    <motion.div
                      key={i}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 8 + i * 2, repeat: Infinity, ease: 'linear' }}
                      className="absolute inset-0"
                      style={{ transformOrigin: 'center' }}
                    >
                      <div
                        className="absolute w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-xl"
                        style={{
                          top: `${[0, 35, 70, 35][i]}%`,
                          left: `${[35, 70, 35, 0][i]}%`,
                        }}
                      >
                        {emoji}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── LATEST NEWS ──────────────────────────────────────────────────── */}
      <section className="section-padding bg-gray-50 dark:bg-kcs-blue-950/50">
        <div className="container-custom">
          <AnimatedSection>
            <motion.div variants={fadeUp} className="flex items-center justify-between mb-12">
              <div>
                <span className="badge-blue text-sm mb-2">Stay Informed</span>
                <h2 className="text-3xl md:text-4xl font-bold font-display text-kcs-blue-900 dark:text-white">
                  Latest News & Events
                </h2>
              </div>
              <Link
                to="/news"
                className="hidden sm:flex items-center gap-2 text-kcs-blue-600 dark:text-kcs-blue-300 font-semibold hover:gap-3 transition-all"
              >
                View All <ArrowRight size={18} />
              </Link>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {latestNews.map((item, i) => (
                <motion.article
                  key={item.title}
                  variants={fadeUp}
                  whileHover={{ y: -5 }}
                  className="github-glass dark:github-glass-dark group overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-kcs-lg"
                >
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute top-3 left-3">
                      <span className="badge-blue">{item.category}</span>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 mb-2">
                      <Calendar size={12} />
                      {item.date}
                    </div>
                    <h3 className="font-bold text-kcs-blue-900 dark:text-white mb-2 leading-tight line-clamp-2">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2 mb-4">
                      {item.excerpt}
                    </p>
                    <Link
                      to="/news"
                      className="inline-flex items-center gap-1.5 text-kcs-blue-600 dark:text-kcs-blue-400 text-sm font-semibold hover:gap-2.5 transition-all"
                    >
                      Read More <ArrowRight size={14} />
                    </Link>
                  </div>
                </motion.article>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── TESTIMONIALS ────────────────────────────────────────────────── */}
      <section className="section-padding bg-white dark:bg-kcs-blue-950">
        <div className="container-custom">
          <AnimatedSection>
            <motion.div variants={fadeUp} className="text-center mb-14">
              <span className="badge-gold text-sm mb-3">Testimonials</span>
              <h2 className="text-4xl font-bold font-display text-kcs-blue-900 dark:text-white">
                Voices from Our Community
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {testimonials.map((item) => (
                <motion.div
                  key={item.name}
                  variants={fadeUp}
                  whileHover={{ y: -5 }}
                  className="github-glass dark:github-glass-dark p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-kcs"
                >
                  <div className="flex mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={16} className="text-kcs-gold-400 fill-kcs-gold-400" />
                    ))}
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-5 italic">
                    "{item.quote}"
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl kcs-gradient flex items-center justify-center text-white font-bold text-sm">
                      {item.initials}
                    </div>
                    <div>
                      <p className="font-semibold text-kcs-blue-900 dark:text-white text-sm">{item.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{item.role}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────────── */}
      <section className="py-24 bg-gradient-to-r from-kcs-blue-800 via-kcs-blue-700 to-kcs-blue-900 relative overflow-hidden">
        <div className="absolute inset-0 dots-bg opacity-20" style={{ backgroundSize: '40px 40px' }} />
        <div className="relative container-custom text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold font-display text-white mb-5">
              Begin Your KCS Journey Today
            </h2>
            <p className="text-xl text-kcs-blue-100 mb-10 max-w-xl mx-auto">
              Online registration is available for families who want their children
              to grow in faith, knowledge, character, and service.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link to="/admissions" className="btn-gold text-base px-10 py-4 rounded-2xl flex items-center gap-2">
                Enroll Now <ArrowRight size={20} />
              </Link>
              <Link to="/contact" className="border-2 border-white/40 hover:border-white text-white font-semibold px-10 py-4 rounded-2xl text-base transition-all duration-300 hover:bg-white/10">
                Contact Admissions
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export default HomePage
