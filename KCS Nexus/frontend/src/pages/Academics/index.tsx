import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { ArrowRight, BookOpen, Microscope, Palette, Trophy, Calculator, Globe, Music, Code } from 'lucide-react'
import { SCHOOL_DIVISIONS } from '@/constants/schoolLevels'

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7 } },
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

const programs = [
  {
    id: 'kindergarten',
    level: SCHOOL_DIVISIONS[0].levels,
    title: SCHOOL_DIVISIONS[0].title,
    emoji: '🌱',
    tagline: 'Nurturing Early Learners',
    color: 'from-green-500 to-emerald-600',
    textColor: 'text-green-700 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-900/20',
    image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&q=80',
    description: SCHOOL_DIVISIONS[0].description,
    subjects: ['Early Literacy', 'Early Numeracy', 'Bible & Chapel', 'Creative Play', 'Music & Movement', 'French Exposure'],
    highlights: ['K1 through K5 progression', 'Play-based learning', 'Faith and character formation', 'Readiness for Grade 1', 'Close parent communication', 'Safe early-years routines'],
  },
  {
    id: 'elementary',
    level: SCHOOL_DIVISIONS[1].levels,
    title: SCHOOL_DIVISIONS[1].title,
    emoji: '📘',
    tagline: 'Building Strong Foundations',
    color: 'from-kcs-blue-500 to-blue-700',
    textColor: 'text-kcs-blue-600 dark:text-kcs-blue-400',
    bg: 'bg-kcs-blue-50 dark:bg-kcs-blue-900/20',
    image: 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=600&q=80',
    description: SCHOOL_DIVISIONS[1].description,
    subjects: ['English Language Arts', 'Mathematics', 'Science', 'Social Studies', 'Bible & Chapel', 'Art & Music', 'Physical Education', 'French Language'],
    highlights: ['Grade 1 through Grade 5', 'Strong literacy and numeracy', 'Daily Bible curriculum', 'STEAM integration', 'Character education', 'After-school programs'],
  },
  {
    id: 'middle',
    level: SCHOOL_DIVISIONS[2].levels,
    title: SCHOOL_DIVISIONS[2].title,
    emoji: '🔬',
    tagline: 'Growing in Knowledge & Character',
    color: 'from-cyan-500 to-kcs-blue-700',
    textColor: 'text-kcs-blue-600 dark:text-kcs-blue-400',
    bg: 'bg-kcs-blue-50 dark:bg-kcs-blue-900/20',
    image: 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=600&q=80',
    description: SCHOOL_DIVISIONS[2].description,
    subjects: ['Advanced English', 'Pre-Algebra & Algebra', 'Life & Earth Science', 'World History', 'Bible Studies', 'Visual Arts', 'Band & Orchestra', 'Computer Science'],
    highlights: ['Pre-AP coursework', 'Student government', 'Service learning projects', 'Sports teams', 'Annual science fair', 'Leadership retreats'],
  },
  {
    id: 'high',
    level: SCHOOL_DIVISIONS[3].levels,
    title: SCHOOL_DIVISIONS[3].title,
    emoji: '🎓',
    tagline: 'Ready for the World Stage',
    color: 'from-kcs-blue-800 to-kcs-blue-950',
    textColor: 'text-kcs-blue-800 dark:text-kcs-blue-300',
    bg: 'bg-kcs-blue-100 dark:bg-kcs-blue-900/30',
    image: 'https://images.unsplash.com/photo-1571260899304-425eee4c7efc?w=600&q=80',
    description: SCHOOL_DIVISIONS[3].description,
    subjects: ['AP English & Literature', 'AP Calculus & Statistics', 'AP Biology & Chemistry', 'AP World & US History', 'AP Economics', 'Senior Bible & Ethics', 'Journalism & Media', 'Coding & AI Fundamentals'],
    highlights: ['10+ AP courses offered', 'Dedicated college counselor', '98% college acceptance rate', 'SAT/ACT preparation', 'Internship programs', 'National Honor Society'],
  },
]

const departments = [
  { icon: BookOpen, name: 'Language Arts', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  { icon: Calculator, name: 'Mathematics', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
  { icon: Microscope, name: 'Sciences', color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  { icon: Globe, name: 'Social Studies', color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  { icon: Palette, name: 'Visual Arts', color: 'text-pink-600', bg: 'bg-pink-50 dark:bg-pink-900/20' },
  { icon: Music, name: 'Music & Performing', color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
  { icon: Code, name: 'Technology & CS', color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-900/20' },
  { icon: Trophy, name: 'Athletics', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
]

type ProgramId = (typeof programs)[number]['id']

const AcademicsPage = () => {
  const [activeTab, setActiveTab] = useState<ProgramId>('kindergarten')
  const activeProgram = programs.find((p) => p.id === activeTab)!

  return (
    <div className="pt-20">
      {/* HERO */}
      <section className="relative py-24 kcs-gradient overflow-hidden">
        <div className="absolute inset-0 dots-bg opacity-10" style={{ backgroundSize: '40px 40px' }} />
        <div className="relative container-custom text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-kcs-gold-500/20 border border-kcs-gold-400/30 text-kcs-gold-300 text-sm font-medium mb-5">
              ACSI Accredited • American Curriculum
            </span>
            <h1 className="text-5xl md:text-6xl font-bold font-display text-white mb-5">
              Academic{' '}
              <span className="text-gradient-gold">Programs</span>
            </h1>
            <p className="text-xl text-kcs-blue-100 max-w-2xl mx-auto">
              A world-class American curriculum designed to challenge, inspire, and prepare students for excellence at the highest level.
            </p>
          </motion.div>
        </div>
      </section>

      {/* PROGRAM TABS */}
      <section className="section-padding bg-white dark:bg-kcs-blue-950">
        <div className="container-custom">
          {/* Tab Navigation */}
          <div className="flex flex-col sm:flex-row justify-center gap-3 mb-12">
            {programs.map((p) => (
              <button
                key={p.id}
                onClick={() => setActiveTab(p.id as typeof activeTab)}
                className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-semibold transition-all duration-300 ${
                  activeTab === p.id
                    ? `bg-gradient-to-r ${p.color} text-white shadow-kcs`
                    : 'bg-gray-100 dark:bg-kcs-blue-900/50 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-kcs-blue-800/50'
                }`}
              >
                <span className="text-2xl">{p.emoji}</span>
                <div className="text-left">
                  <p className="text-sm leading-tight">{p.title}</p>
                  <p className={`text-xs ${activeTab === p.id ? 'text-white/80' : 'text-gray-400'}`}>{p.level}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Program Detail */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="grid lg:grid-cols-2 gap-12 items-start"
          >
            <div>
              <img
                src={activeProgram.image}
                alt={activeProgram.title}
                className="w-full h-80 object-cover rounded-3xl shadow-kcs-lg"
                loading="lazy"
              />
            </div>
            <div>
              <span className={`inline-block px-3 py-1.5 rounded-full text-xs font-bold mb-3 ${activeProgram.bg} ${activeProgram.textColor}`}>
                {activeProgram.level}
              </span>
              <h2 className="text-3xl font-bold font-display text-kcs-blue-900 dark:text-white mb-2">
                {activeProgram.title}
              </h2>
              <p className="text-kcs-gold-600 dark:text-kcs-gold-400 font-semibold mb-4">{activeProgram.tagline}</p>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">{activeProgram.description}</p>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <h4 className="font-bold text-kcs-blue-900 dark:text-white text-sm mb-3">Core Subjects</h4>
                  <ul className="space-y-1.5">
                    {activeProgram.subjects.map((s) => (
                      <li key={s} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-kcs-gold-500 flex-shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-kcs-blue-900 dark:text-white text-sm mb-3">Highlights</h4>
                  <ul className="space-y-1.5">
                    {activeProgram.highlights.map((h) => (
                      <li key={h} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-kcs-blue-500 flex-shrink-0" />
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <Link to="/admissions" className="btn-primary inline-flex items-center gap-2">
                Apply for {activeProgram.title} <ArrowRight size={18} />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* DEPARTMENTS */}
      <section className="section-padding bg-gray-50 dark:bg-kcs-blue-950/50">
        <div className="container-custom">
          <AnimSection>
            <motion.div variants={fadeUp} className="text-center mb-12">
              <span className="badge-blue text-sm mb-3">Departments</span>
              <h2 className="text-4xl font-bold font-display text-kcs-blue-900 dark:text-white">
                Academic Departments
              </h2>
            </motion.div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {departments.map(({ icon: Icon, name, color, bg }) => (
                <motion.div
                  key={name}
                  variants={fadeUp}
                  whileHover={{ y: -5 }}
                  className="p-5 bg-white dark:bg-kcs-blue-900/50 rounded-2xl border border-gray-100 dark:border-kcs-blue-800 hover:shadow-kcs transition-all duration-300 text-center group"
                >
                  <div className={`w-12 h-12 ${bg} rounded-xl flex items-center justify-center mx-auto mb-3`}>
                    <Icon size={22} className={color} />
                  </div>
                  <p className="font-semibold text-kcs-blue-900 dark:text-white text-sm">{name}</p>
                </motion.div>
              ))}
            </div>
          </AnimSection>
        </div>
      </section>

      {/* AP COURSES */}
      <section className="section-padding bg-white dark:bg-kcs-blue-950">
        <div className="container-custom">
          <AnimSection>
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div variants={fadeUp}>
                <span className="badge-gold text-sm mb-3">Advanced Placement</span>
                <h2 className="text-4xl font-bold font-display text-kcs-blue-900 dark:text-white mb-4">
                  AP & Honors Courses
                </h2>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
                  KCS offers 10+ College Board AP courses, giving high school students the opportunity 
                  to earn college credit while building the academic rigor needed for top universities.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    'AP Calculus AB/BC', 'AP Biology', 'AP Chemistry', 'AP Physics',
                    'AP English Literature', 'AP US History', 'AP Economics', 'AP Statistics',
                    'AP Computer Science', 'AP Environmental Science',
                  ].map((course) => (
                    <div key={course} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 py-1.5 border-b border-gray-100 dark:border-gray-800">
                      <span className="w-2 h-2 rounded-full bg-kcs-gold-500 flex-shrink-0" />
                      {course}
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div variants={fadeUp} className="grid grid-cols-2 gap-4">
                {[
                  { label: 'AP Courses Offered', value: '10+', icon: BookOpen },
                  { label: 'Average AP Score', value: '3.8', icon: Trophy },
                  { label: 'College Acceptance', value: '98%', icon: Globe },
                  { label: 'Merit Scholarships', value: '$2M+', icon: Calculator },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="p-6 rounded-2xl bg-gradient-to-br from-kcs-blue-50 to-white dark:from-kcs-blue-900/30 dark:to-kcs-blue-900/50 border border-kcs-blue-100 dark:border-kcs-blue-800 text-center">
                    <Icon size={24} className="text-kcs-blue-600 dark:text-kcs-blue-400 mx-auto mb-2" />
                    <p className="text-3xl font-bold font-display text-kcs-blue-900 dark:text-white">{value}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
                  </div>
                ))}
              </motion.div>
            </div>
          </AnimSection>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 kcs-gradient">
        <div className="container-custom text-center">
          <AnimSection>
            <motion.div variants={fadeUp}>
              <h2 className="text-3xl font-bold font-display text-white mb-4">
                Start Your Academic Journey at KCS
              </h2>
              <p className="text-kcs-blue-100 mb-8 max-w-xl mx-auto">
                Applications are open from K1 through Grade 12. Join a community of learners who dare to excel.
              </p>
              <Link to="/admissions" className="btn-gold inline-flex items-center gap-2 text-base px-8 py-4 rounded-2xl">
                Apply Now <ArrowRight size={20} />
              </Link>
            </motion.div>
          </AnimSection>
        </div>
      </section>
    </div>
  )
}

export default AcademicsPage
