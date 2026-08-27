import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, useInView } from 'framer-motion'
import { ArrowRight, BookOpen, Church, Compass, Globe2, GraduationCap, Lightbulb, MapPin, School, Sparkles } from 'lucide-react'
import { kcsPublicImages } from '@/data/kcsPublicImages'

type Language = 'en' | 'fr'
type Copy = {
  heroTag: string; heroTitle: string; heroLead: string; welcome: string; welcomeTitle: string; welcomeBody: string
  history: string; historyTitle: string; founded: string; foundedTitle: string; foundedBody: string
  growth: string; growthTitle: string; growthBody: string; milestoneTitle: string
  milestones: Array<{ value: string; label: string; detail: string }>
  vision: string; mission: string; method: string; methodTitle: string
  methodItems: Array<{ title: string; text: string }>; values: string; valuesTitle: string; valuesBody: string
  journey: string; journeyTitle: string; ctaTitle: string; ctaBody: string; apply: string; contact: string; campusAlt: string
}

const content: Record<Language, Copy> = {
  en: {
    heroTag: 'Kinshasa, Democratic Republic of the Congo', heroTitle: 'A school founded in faith, built for lifelong learning',
    heroLead: 'Kinshasa Christian School equips children through an internationally respected American K-12 education centered on the Bible.',
    welcome: 'Welcome', welcomeTitle: 'Welcome to Kinshasa Christian School',
    welcomeBody: 'KCS is a Christian learning community where academic rigor, character, curiosity and service grow together. We invite every student to let their light shine for God’s glory and to engage the world with wisdom, courage and compassion.',
    history: 'Our history', historyTitle: 'A vision that began in Kinshasa', founded: '2013 · Macampagne', foundedTitle: 'Founded by Jean and Deborah Senga',
    foundedBody: 'Jean and Deborah Senga founded Kinshasa Christian School in Macampagne in 2013. Their backgrounds in education and administration in both the United States and the Democratic Republic of the Congo shaped a school able to connect international academic standards with the realities and calling of its local community.',
    growth: '2014 · Gombe', growthTitle: 'A second campus and a wider horizon',
    growthBody: 'In 2014, KCS opened a second campus in Gombe. That year also marked important opportunities for students to test their readiness, strengthen their English and experience learning across cultures.',
    milestoneTitle: '2014 milestones', milestones: [
      { value: '2', label: 'SAT participants', detail: 'Students took the SAT.' },
      { value: '7', label: 'Practice SAT participants', detail: 'Students completed a Practice SAT.' },
      { value: '16', label: 'Students in the United States', detail: 'Three weeks of English immersion, cultural learning and church partnership.' },
    ],
    vision: 'To see our society transformed by students holding a biblical worldview',
    mission: 'To equip children to become passionate, independent, life-long learners who engage all aspects of society with a biblical worldview',
    method: 'How we educate', methodTitle: 'Learning that reaches beyond a test', methodItems: [
      { title: 'Light and leadership', text: 'Students are encouraged to let their light shine for God’s glory while developing the leadership skills to influence their communities and the world.' },
      { title: 'Curiosity and creation', text: 'Learning cultivates curiosity about God’s creation and equips students to ask thoughtful questions, explore ideas and pursue truth.' },
      { title: 'A strong American K-12 foundation', text: 'KCS offers a solid, internationally respected American K-12 education designed to prepare world influencers and leaders.' },
      { title: 'Knowledge in action', text: 'Students learn to apply what they know and communicate their understanding beyond tests, presentations and classroom exercises.' },
      { title: 'Readers for life', text: 'The school nurtures lifelong reading, independent learning and the habits students need to keep growing throughout life.' },
      { title: 'The Bible at the center', text: 'The Bible is central to learning, character and the way students understand and engage every aspect of society.' },
    ],
    values: 'Our values', valuesTitle: 'Quality education, measured with purpose',
    valuesBody: 'KCS values quality education through a proven American curriculum, current teaching methods and the responsible use of data to understand progress and improve learning.',
    journey: 'Our journey', journeyTitle: 'From Macampagne to Gombe', ctaTitle: 'Continue the KCS story',
    ctaBody: 'Discover an education that joins academic strength, lifelong curiosity, leadership and a biblical worldview.', apply: 'Explore admissions', contact: 'Contact KCS', campusAlt: 'Kinshasa Christian School learning community',
  },
  fr: {
    heroTag: 'Kinshasa, République démocratique du Congo', heroTitle: 'Une école fondée dans la foi, bâtie pour apprendre toute la vie',
    heroLead: 'Kinshasa Christian School équipe les enfants grâce à une éducation américaine K-12 reconnue internationalement et centrée sur la Bible.',
    welcome: 'Bienvenue', welcomeTitle: 'Bienvenue à Kinshasa Christian School',
    welcomeBody: 'KCS est une communauté chrétienne d’apprentissage où l’exigence académique, le caractère, la curiosité et le service grandissent ensemble. Chaque élève est encouragé à faire briller sa lumière pour la gloire de Dieu et à agir dans le monde avec sagesse, courage et compassion.',
    history: 'Notre histoire', historyTitle: 'Une vision née à Kinshasa', founded: '2013 · Macampagne', foundedTitle: 'Fondée par Jean et Deborah Senga',
    foundedBody: 'Jean et Deborah Senga ont fondé Kinshasa Christian School à Macampagne en 2013. Leurs parcours dans l’éducation et l’administration, aux États-Unis comme en République démocratique du Congo, ont façonné une école qui relie les standards académiques internationaux aux réalités et à la vocation de sa communauté locale.',
    growth: '2014 · Gombe', growthTitle: 'Un second campus et de nouveaux horizons',
    growthBody: 'En 2014, KCS a ouvert un second campus à Gombe. Cette année a également offert aux élèves d’importantes occasions d’évaluer leur préparation, de renforcer leur anglais et de vivre un apprentissage interculturel.',
    milestoneTitle: 'Étapes marquantes de 2014', milestones: [
      { value: '2', label: 'participants au SAT', detail: 'Deux élèves ont passé le SAT.' },
      { value: '7', label: 'participants au SAT blanc', detail: 'Sept élèves ont réalisé un Practice SAT.' },
      { value: '16', label: 'élèves aux États-Unis', detail: 'Trois semaines d’immersion en anglais, d’apprentissage culturel et de partenariat avec une église.' },
    ],
    vision: 'Voir notre société transformée par des élèves porteurs d’une vision biblique du monde',
    mission: 'Équiper les enfants afin qu’ils deviennent des apprenants passionnés, autonomes et engagés tout au long de leur vie, capables d’agir dans toutes les sphères de la société avec une vision biblique du monde',
    method: 'Notre approche', methodTitle: 'Un apprentissage qui va au-delà des examens', methodItems: [
      { title: 'Lumière et leadership', text: 'Les élèves sont encouragés à faire briller leur lumière pour la gloire de Dieu et à développer les compétences de leadership nécessaires pour influencer leur communauté et le monde.' },
      { title: 'Curiosité et création', text: 'L’apprentissage nourrit la curiosité pour la création de Dieu et apprend aux élèves à questionner, explorer et rechercher la vérité.' },
      { title: 'Une solide base américaine K-12', text: 'KCS propose une éducation américaine K-12 solide et reconnue internationalement, qui prépare des leaders et acteurs d’influence dans le monde.' },
      { title: 'Mettre les connaissances en action', text: 'Les élèves apprennent à appliquer leurs acquis et à communiquer leur compréhension au-delà des examens, présentations et exercices de classe.' },
      { title: 'Lire et apprendre toute la vie', text: 'L’école développe le goût durable de la lecture, l’autonomie et les habitudes nécessaires pour continuer à apprendre toute la vie.' },
      { title: 'La Bible au centre', text: 'La Bible est au cœur des apprentissages, du caractère et de la manière dont les élèves comprennent et abordent chaque sphère de la société.' },
    ],
    values: 'Nos valeurs', valuesTitle: 'Une éducation de qualité, évaluée avec discernement',
    valuesBody: 'KCS valorise une éducation de qualité fondée sur un programme américain éprouvé, des méthodes pédagogiques actuelles et un usage responsable des données pour comprendre les progrès et améliorer les apprentissages.',
    journey: 'Notre parcours', journeyTitle: 'De Macampagne à Gombe', ctaTitle: 'Écrivez la suite de l’histoire KCS',
    ctaBody: 'Découvrez une éducation qui unit solidité académique, curiosité durable, leadership et vision biblique du monde.', apply: 'Découvrir les admissions', contact: 'Contacter KCS', campusAlt: 'Communauté éducative de Kinshasa Christian School',
  },
}

const fadeUp = { hidden: { opacity: 0, y: 32 }, visible: { opacity: 1, y: 0, transition: { duration: 0.65 } } }
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }

const AnimSection = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return <motion.div ref={ref} initial="hidden" animate={inView ? 'visible' : 'hidden'} variants={stagger} className={className}>{children}</motion.div>
}

const AboutPage = () => {
  const { i18n } = useTranslation()
  const language: Language = i18n.resolvedLanguage?.toLowerCase().startsWith('fr') ? 'fr' : 'en'
  const c = content[language]
  const methodIcons = [Sparkles, Lightbulb, GraduationCap, Compass, BookOpen, Church]

  return (
    <div className="pt-20">
      <section className="relative overflow-hidden bg-gradient-to-br from-kcs-blue-950 via-kcs-blue-900 to-kcs-blue-800 py-24">
        <div className="absolute inset-0 dots-bg opacity-10" style={{ backgroundSize: '40px 40px' }} />
        <div className="relative container-custom grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75 }}>
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-kcs-gold-400/30 bg-kcs-gold-500/15 px-4 py-2 text-sm font-medium text-kcs-gold-300"><MapPin size={16} />{c.heroTag}</span>
            <h1 className="max-w-4xl text-4xl font-bold font-display leading-tight text-white md:text-6xl">{c.heroTitle}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-kcs-blue-100">{c.heroLead}</p>
          </motion.div>
          <motion.img initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .8 }} src={kcsPublicImages.about} alt={c.campusAlt} className="h-[430px] w-full rounded-[2rem] object-cover shadow-kcs-lg" />
        </div>
      </section>

      <section className="section-padding bg-white dark:bg-kcs-blue-950"><div className="container-custom"><AnimSection className="grid gap-14 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
        <motion.div variants={fadeUp}><span className="badge-blue mb-4 text-sm">{c.welcome}</span><h2 className="text-4xl font-bold font-display text-kcs-blue-900 dark:text-white">{c.welcomeTitle}</h2></motion.div>
        <motion.p variants={fadeUp} className="text-lg leading-8 text-gray-600 dark:text-gray-300">{c.welcomeBody}</motion.p>
      </AnimSection></div></section>

      <section className="section-padding bg-gray-50 dark:bg-kcs-blue-950/50"><div className="container-custom"><AnimSection>
        <motion.div variants={fadeUp} className="mb-12"><span className="badge-gold mb-4 text-sm">{c.history}</span><h2 className="text-4xl font-bold font-display text-kcs-blue-900 dark:text-white">{c.historyTitle}</h2></motion.div>
        <div className="grid gap-6 lg:grid-cols-2">
          {[{ tag: c.founded, title: c.foundedTitle, body: c.foundedBody, icon: School }, { tag: c.growth, title: c.growthTitle, body: c.growthBody, icon: Globe2 }].map(({ tag, title, body, icon: Icon }) => <motion.article key={tag} variants={fadeUp} className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50"><div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl kcs-gradient-gold"><Icon className="text-kcs-blue-950" /></div><p className="text-sm font-bold text-kcs-gold-600">{tag}</p><h3 className="mt-2 text-2xl font-bold font-display text-kcs-blue-900 dark:text-white">{title}</h3><p className="mt-4 leading-7 text-gray-600 dark:text-gray-300">{body}</p></motion.article>)}
        </div>
      </AnimSection></div></section>

      <section className="section-padding bg-kcs-blue-950"><div className="container-custom"><AnimSection>
        <motion.h2 variants={fadeUp} className="mb-10 text-center text-4xl font-bold font-display text-white">{c.milestoneTitle}</motion.h2>
        <div className="grid gap-5 md:grid-cols-3">{c.milestones.map((item) => <motion.div key={item.label} variants={fadeUp} className="rounded-3xl border border-white/10 bg-white/5 p-7 text-center"><p className="text-5xl font-bold font-display text-kcs-gold-400">{item.value}</p><p className="mt-3 font-semibold text-white">{item.label}</p><p className="mt-2 text-sm leading-6 text-kcs-blue-200">{item.detail}</p></motion.div>)}</div>
      </AnimSection></div></section>

      <section className="section-padding bg-white dark:bg-kcs-blue-950"><div className="container-custom grid gap-6 lg:grid-cols-2">
        <article className="rounded-3xl border border-kcs-gold-200 bg-kcs-gold-50 p-8 dark:border-kcs-gold-800/40 dark:bg-kcs-gold-900/10"><p className="text-sm font-bold uppercase tracking-wider text-kcs-gold-700">Vision</p><p className="mt-4 text-2xl font-bold leading-relaxed text-kcs-blue-950 dark:text-white">“{c.vision}”</p></article>
        <article className="rounded-3xl border border-kcs-blue-100 bg-kcs-blue-50 p-8 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/40"><p className="text-sm font-bold uppercase tracking-wider text-kcs-blue-700 dark:text-kcs-blue-300">Mission</p><p className="mt-4 text-2xl font-bold leading-relaxed text-kcs-blue-950 dark:text-white">“{c.mission}”</p></article>
      </div></section>

      <section className="section-padding bg-gray-50 dark:bg-kcs-blue-950/50"><div className="container-custom"><AnimSection>
        <motion.div variants={fadeUp} className="mb-12 text-center"><span className="badge-blue mb-4 text-sm">{c.method}</span><h2 className="text-4xl font-bold font-display text-kcs-blue-900 dark:text-white">{c.methodTitle}</h2></motion.div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{c.methodItems.map((item, index) => { const Icon = methodIcons[index]; return <motion.article key={item.title} variants={fadeUp} className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50"><Icon className="mb-4 text-kcs-gold-600" /><h3 className="text-lg font-bold text-kcs-blue-900 dark:text-white">{item.title}</h3><p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{item.text}</p></motion.article> })}</div>
      </AnimSection></div></section>

      <section className="section-padding bg-white dark:bg-kcs-blue-950"><div className="container-custom grid items-center gap-12 lg:grid-cols-2"><img src={kcsPublicImages.spiritualLife} alt={c.campusAlt} className="h-[420px] w-full rounded-3xl object-cover shadow-kcs-lg" /><div><span className="badge-gold mb-4 text-sm">{c.values}</span><h2 className="text-4xl font-bold font-display text-kcs-blue-900 dark:text-white">{c.valuesTitle}</h2><p className="mt-5 text-lg leading-8 text-gray-600 dark:text-gray-300">{c.valuesBody}</p></div></div></section>

      <section className="bg-gradient-to-br from-kcs-blue-950 to-kcs-blue-900 py-20"><div className="container-custom text-center"><h2 className="text-4xl font-bold font-display text-white">{c.ctaTitle}</h2><p className="mx-auto mt-4 max-w-2xl text-kcs-blue-200">{c.ctaBody}</p><div className="mt-8 flex flex-wrap justify-center gap-4"><Link to="/admissions" className="btn-primary flex items-center gap-2">{c.apply}<ArrowRight size={18} /></Link><Link to="/contact" className="rounded-xl border border-white/20 px-6 py-3 font-semibold text-white hover:bg-white/10">{c.contact}</Link></div></div></section>
    </div>
  )
}

export default AboutPage
