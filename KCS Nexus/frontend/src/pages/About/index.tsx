import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import {
  ArrowRight,
  Award,
  BookOpen,
  Globe,
  GraduationCap,
  Heart,
  Lightbulb,
  MapPin,
  Shield,
  Users,
} from 'lucide-react'

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7 } },
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
}

const AnimSection = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? 'visible' : 'hidden'} variants={stagger} className={className}>
      {children}
    </motion.div>
  )
}

const leadership = [
  {
    name: 'Dr. Samuel Watkins',
    title: 'Head of School',
    bio: '25+ years in international education. Passionate about transforming African education through Christian values.',
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
    initials: 'SW',
  },
  {
    name: 'Dr. Grace Mwamba',
    title: 'Academic Director',
    bio: 'Former professor at University of Kinshasa. Leads our curriculum development and academic excellence initiatives.',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face',
    initials: 'GM',
  },
  {
    name: 'Mr. David Okonkwo',
    title: 'Dean of Students',
    bio: 'Dedicated to student wellbeing and leadership development. Champion of student government and extracurriculars.',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face',
    initials: 'DO',
  },
  {
    name: 'Mrs. Amelia Chen',
    title: 'Admissions Director',
    bio: 'Guides families through the KCS admissions journey with warmth and expertise across three continents.',
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face',
    initials: 'AC',
  },
]

const faculty = [
  { name: 'Mr. Thomas Belanger', dept: 'Mathematics & Sciences', exp: '18 years', flag: 'US' },
  { name: 'Mrs. Fatima Diallo', dept: 'English Language Arts', exp: '14 years', flag: 'SN' },
  { name: 'Dr. Pierre Lukusa', dept: 'History & Social Studies', exp: '20 years', flag: 'CD' },
  { name: 'Ms. Sarah Johnson', dept: 'Arts & Music', exp: '12 years', flag: 'GB' },
  { name: 'Mr. Carlos Rivera', dept: 'Physical Education', exp: '10 years', flag: 'MX' },
  { name: 'Mrs. Josephine Nkosi', dept: 'French & Languages', exp: '16 years', flag: 'ZA' },
]

const milestones = [
  { year: 'Faith', event: 'Spiritual Life', desc: 'Daily prayer, services, Bible studies, and mentorship support student growth.' },
  { year: 'Vision', event: 'Biblical Worldview', desc: 'KCS equips children to become passionate, independent, life-long learners.' },
  { year: 'Mission', event: 'Leadership', desc: 'The school helps raise leaders prepared for a competitive world with compassion and mercy.' },
  { year: 'Team', event: 'Excellence', desc: 'KCS values qualified Christian educators and high standards of care and instruction.' },
  { year: 'Service', event: 'Community', desc: 'Students are encouraged to live out love, compassion, and service to others.' },
  { year: 'Future', event: 'KCS Nexus', desc: 'Digital tools connect families, students, teachers, and school information.' },
]

const storyStats = [
  { icon: Users, label: 'KCS Students', sub: 'Academic, social, spiritual growth' },
  { icon: GraduationCap, label: 'Life-long Learners', sub: 'Passionate and independent' },
  { icon: Globe, label: 'Biblical Worldview', sub: 'Ready to transform society' },
  { icon: Award, label: 'Excellence', sub: 'High standards in education and care' },
]

const missionCards = [
  {
    icon: Heart,
    title: 'Our Mission',
    color: 'text-red-500',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-100 dark:border-red-800/30',
    text: 'To provide an exceptional American education rooted in Christian values, empowering students in Kinshasa and across the Congo to become servant leaders who transform their communities and the world.',
  },
  {
    icon: Lightbulb,
    title: 'Our Vision',
    color: 'text-kcs-gold-600',
    bg: 'bg-kcs-gold-50 dark:bg-kcs-gold-900/20',
    border: 'border-kcs-gold-100 dark:border-kcs-gold-800/30',
    text: 'To be the leading international school in Central Africa, recognized for academic excellence, spiritual depth, and the development of globally-minded leaders who make a lasting impact.',
  },
  {
    icon: MapPin,
    title: 'Our Promise',
    color: 'text-kcs-blue-600',
    bg: 'bg-kcs-blue-50 dark:bg-kcs-blue-900/20',
    border: 'border-kcs-blue-100 dark:border-kcs-blue-800/30',
    text: 'Every student who walks through our doors receives a world-class education, personalized care, and the tools to succeed at the highest levels - academically, professionally, and spiritually.',
  },
]

const AboutPage = () => {
  return (
    <div className="pt-20">
      <section className="relative overflow-hidden bg-gradient-to-br from-kcs-blue-950 via-kcs-blue-900 to-kcs-blue-800 py-24">
        <div className="absolute inset-0 dots-bg opacity-10" style={{ backgroundSize: '40px 40px' }} />
        <div className="relative container-custom text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-kcs-gold-400/30 bg-kcs-gold-500/20 px-4 py-2 text-sm font-medium text-kcs-gold-300">
              Kinshasa, DRC - Letting Our Light Shine
            </span>
            <h1 className="mb-5 text-5xl font-bold font-display text-white md:text-6xl">
              About <span className="text-gradient-gold">KCS</span>
            </h1>
            <p className="mx-auto max-w-3xl text-xl leading-relaxed text-kcs-blue-100">
              KCS provides a nurturing Christian environment where students grow academically, socially, and spiritually.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="section-padding bg-white dark:bg-kcs-blue-950">
        <div className="container-custom">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <AnimSection>
              <motion.div variants={fadeUp}>
                <span className="badge-blue mb-3 text-sm">Our Story</span>
                <h2 className="mb-5 text-4xl font-bold font-display text-kcs-blue-900 dark:text-white">
                  A Legacy Built on <span className="text-gradient-blue">Faith & Purpose</span>
                </h2>
                <p className="mb-4 leading-relaxed text-gray-600 dark:text-gray-300">
                  Kinshasa Christian School prioritizes the spiritual development of students through prayer, services, Bible studies, and mentorship programs.
                </p>
                <p className="mb-6 leading-relaxed text-gray-600 dark:text-gray-300">
                  KCS is committed to excellence in teaching and care while helping children become compassionate leaders ready to transform society with a biblical worldview.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {storyStats.map(({ icon: Icon, label, sub }) => (
                    <div key={label} className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-900/30">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-kcs-blue-100 dark:bg-kcs-blue-800">
                        <Icon size={18} className="text-kcs-blue-600 dark:text-kcs-blue-300" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-kcs-blue-900 dark:text-white">{label}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimSection>

            <AnimSection>
              <motion.div variants={fadeUp} className="relative">
                <img
                  src="https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600&q=80"
                  alt="KCS Campus"
                  className="h-[500px] w-full rounded-3xl object-cover shadow-kcs-lg"
                  loading="lazy"
                />
                <div className="absolute -bottom-6 -left-6 max-w-xs rounded-2xl border border-gray-100 bg-white p-5 shadow-kcs-lg dark:border-kcs-blue-800 dark:bg-kcs-blue-900">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl kcs-gradient-gold">
                      <BookOpen size={22} className="text-kcs-blue-900" />
                    </div>
                    <div>
                      <p className="font-bold text-kcs-blue-900 dark:text-white">American Curriculum</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Faith-based learning with a biblical worldview</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimSection>
          </div>
        </div>
      </section>

      <section className="section-padding bg-gray-50 dark:bg-kcs-blue-950/50">
        <div className="container-custom">
          <AnimSection>
            <motion.div variants={fadeUp} className="mb-14 text-center">
              <h2 className="text-4xl font-bold font-display text-kcs-blue-900 dark:text-white">
                Mission, Vision & Values
              </h2>
            </motion.div>

            <div className="mb-12 grid gap-6 md:grid-cols-3">
              {missionCards.map(({ icon: Icon, title, color, bg, border, text }) => (
                <motion.div
                  key={title}
                  variants={fadeUp}
                  className={`rounded-3xl border bg-white p-8 shadow-sm dark:bg-kcs-blue-900/50 ${border}`}
                >
                  <div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ${bg}`}>
                    <Icon size={26} className={color} />
                  </div>
                  <h3 className="mb-3 text-xl font-bold font-display text-kcs-blue-900 dark:text-white">{title}</h3>
                  <p className="leading-relaxed text-gray-600 dark:text-gray-300">{text}</p>
                </motion.div>
              ))}
            </div>
          </AnimSection>
        </div>
      </section>

      <section className="section-padding bg-white dark:bg-kcs-blue-950">
        <div className="container-custom">
          <AnimSection>
            <motion.div variants={fadeUp} className="mb-14 text-center">
              <span className="badge-gold mb-3 text-sm">Our Team</span>
              <h2 className="text-4xl font-bold font-display text-kcs-blue-900 dark:text-white">Leadership Team</h2>
              <p className="mx-auto mt-3 max-w-xl text-gray-500 dark:text-gray-400">
                Experienced, passionate educators dedicated to the KCS mission.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {leadership.map((person) => (
                <motion.div
                  key={person.name}
                  variants={fadeUp}
                  whileHover={{ y: -6 }}
                  className="group rounded-3xl border border-gray-100 bg-gray-50 p-6 text-center transition-all duration-300 hover:shadow-kcs dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50"
                >
                  <div className="relative mx-auto mb-4 h-24 w-24">
                    <img src={person.image} alt={person.name} className="h-full w-full rounded-2xl object-cover" loading="lazy" />
                    <div className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-lg bg-kcs-gold-400">
                      <Shield size={14} className="text-kcs-blue-900" />
                    </div>
                  </div>
                  <h3 className="mb-0.5 text-sm font-bold text-kcs-blue-900 dark:text-white">{person.name}</h3>
                  <p className="mb-3 text-xs font-medium text-kcs-blue-600 dark:text-kcs-blue-400">{person.title}</p>
                  <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">{person.bio}</p>
                </motion.div>
              ))}
            </div>
          </AnimSection>
        </div>
      </section>

      <section className="section-padding bg-gray-50 dark:bg-kcs-blue-950/50">
        <div className="container-custom">
          <AnimSection>
            <motion.div variants={fadeUp} className="mb-12 text-center">
              <span className="badge-blue mb-3 text-sm">Faculty</span>
              <h2 className="text-4xl font-bold font-display text-kcs-blue-900 dark:text-white">Expert Educators</h2>
              <p className="mx-auto mt-3 max-w-xl text-gray-500 dark:text-gray-400">
                Over 80 certified teachers from around the world, bringing global perspectives to the classroom.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {faculty.map((member) => (
                <motion.div
                  key={member.name}
                  variants={fadeUp}
                  className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 transition-all duration-300 hover:shadow-kcs dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50"
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl kcs-gradient text-sm font-bold text-white">
                    {member.flag}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-kcs-blue-900 dark:text-white">{member.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{member.dept}</p>
                    <p className="text-xs font-medium text-kcs-gold-600 dark:text-kcs-gold-400">{member.exp} experience</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimSection>
        </div>
      </section>

      <section className="section-padding bg-gradient-to-br from-kcs-blue-950 to-kcs-blue-900">
        <div className="container-custom">
          <AnimSection>
            <motion.div variants={fadeUp} className="mb-14 text-center">
              <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-kcs-gold-400/30 bg-kcs-gold-500/20 px-4 py-2 text-sm font-medium text-kcs-gold-300">
                Our Journey
              </span>
              <h2 className="text-4xl font-bold font-display text-white">KCS Through the Years</h2>
            </motion.div>

            <div className="relative">
              <div className="absolute left-1/2 h-full w-0.5 -translate-x-px bg-kcs-blue-700" />
              <div className="space-y-10">
                {milestones.map((m, i) => (
                  <motion.div key={m.year} variants={fadeUp} className={`relative flex items-center ${i % 2 === 0 ? 'flex-row' : 'flex-row-reverse'}`}>
                    <div className={`w-1/2 ${i % 2 === 0 ? 'pr-10 text-right' : 'pl-10'}`}>
                      <div className={`inline-block max-w-xs rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm ${i % 2 === 0 ? 'ml-auto' : ''}`}>
                        <p className="text-lg font-bold font-display text-kcs-gold-400">{m.year}</p>
                        <p className="mb-1 font-semibold text-white">{m.event}</p>
                        <p className="text-sm text-kcs-blue-200">{m.desc}</p>
                      </div>
                    </div>
                    <div className="absolute left-1/2 z-10 h-4 w-4 -translate-x-1/2 rounded-full border-4 border-kcs-blue-900 bg-kcs-gold-400" />
                    <div className="w-1/2" />
                  </motion.div>
                ))}
              </div>
            </div>
          </AnimSection>
        </div>
      </section>

      <section className="bg-white py-20 dark:bg-kcs-blue-950">
        <div className="container-custom text-center">
          <AnimSection>
            <motion.div variants={fadeUp}>
              <h2 className="mb-4 text-3xl font-bold font-display text-kcs-blue-900 dark:text-white">Become Part of the KCS Story</h2>
              <p className="mx-auto mb-8 max-w-xl text-gray-600 dark:text-gray-400">
                Join our community of learners, leaders, and believers. Your chapter in the KCS story starts with an application.
              </p>
              <div className="flex justify-center gap-4">
                <Link to="/admissions" className="btn-primary flex items-center gap-2">
                  Apply Now <ArrowRight size={18} />
                </Link>
                <Link to="/contact" className="flex items-center gap-2 rounded-xl border-2 border-kcs-blue-200 px-6 py-3 font-semibold text-kcs-blue-700 transition-all duration-200 hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-300 dark:hover:bg-kcs-blue-900/20">
                  Contact Us
                </Link>
              </div>
            </motion.div>
          </AnimSection>
        </div>
      </section>
    </div>
  )
}

export default AboutPage
