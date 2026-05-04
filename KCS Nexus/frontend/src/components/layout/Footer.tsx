import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { 
  MapPin, Phone, Mail, Clock, Facebook, 
  Instagram, Youtube, Linkedin, ArrowRight, BookOpen
} from 'lucide-react'
import { motion } from 'framer-motion'
import { getAssetUrl } from '@/utils/assets'

const Footer = () => {
  const { t } = useTranslation()
  const logoSrc = getAssetUrl('images/kcs.jpg')

  const quickLinks = [
    { to: '/about', label: t('nav.about') },
    { to: '/academics', label: t('nav.academics') },
    { to: '/news', label: t('nav.news') },
    { to: '/admissions', label: t('nav.admissions') },
    { to: '/gallery', label: t('nav.gallery') },
    { to: '/contact', label: t('nav.contact') },
  ]

  const programs = [
    { to: '/academics#kindergarten', label: 'K1-K5' },
    { to: '/academics#elementary', label: 'Elementary' },
    { to: '/academics#middle', label: 'Middle School' },
    { to: '/academics#high', label: 'High School' },
    { to: '/academics#spiritual-life', label: 'Spiritual Life' },
    { to: '/news', label: 'Events & News' },
  ]

  const portals = [
    { to: '/login', label: 'Student Portal' },
    { to: '/login', label: 'Parent Portal' },
    { to: '/login', label: 'Teacher Portal' },
    { to: '/login', label: 'Admin Panel' },
  ]

  const socials = [
    { icon: Facebook, href: 'https://www.facebook.com/KinshasaChristianSchool', label: 'Facebook' },
    { icon: Instagram, href: 'https://www.instagram.com/kinshasachristianschoolknights', label: 'Instagram' },
    { icon: Youtube, href: 'https://wa.me/243895326011', label: 'WhatsApp' },
    { icon: Linkedin, href: '#', label: 'LinkedIn' },
  ]

  return (
    <footer className="bg-kcs-blue-950 dark:bg-gray-950 text-white">
      {/* CTA Banner */}
      <div className="bg-gradient-to-r from-kcs-blue-700 via-kcs-blue-600 to-kcs-blue-800 py-12">
        <div className="container-custom">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl font-bold font-display mb-1">
                Ready to Join the KCS Family?
              </h3>
              <p className="text-kcs-blue-100 text-sm">
                Online registration is open for families who want a faith-based education.
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                to="/admissions"
                className="flex items-center gap-2 bg-kcs-gold-500 hover:bg-kcs-gold-400 text-kcs-blue-900 font-bold px-6 py-3 rounded-xl transition-all duration-300 hover:shadow-gold"
              >
                Apply Now
                <ArrowRight size={18} />
              </Link>
              <Link
                to="/contact"
                className="flex items-center gap-2 border-2 border-white/30 hover:border-white text-white font-semibold px-6 py-3 rounded-xl transition-all duration-300"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="py-16">
        <div className="container-custom">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
            {/* Brand */}
            <div className="lg:col-span-1">
              <Link to="/" className="flex items-center gap-3 mb-5">
                <div className="w-14 h-14 rounded-lg bg-white flex items-center justify-center shadow-kcs p-1.5">
                  <img src={logoSrc} alt="Kinshasa Christian School" className="h-full w-full object-contain" />
                </div>
                <div>
                  <p className="font-bold text-sm leading-tight font-display text-white">
                    Kinshasa Christian
                  </p>
                  <p className="text-xs font-medium text-kcs-gold-400">
                    Letting Our Light Shine
                  </p>
                </div>
              </Link>
              <p className="text-kcs-blue-200 text-sm leading-relaxed mb-5">
                We are committed to help raise the next generation of leaders through quality
                Christian education, compassion, mercy, and academic excellence.
              </p>

              {/* Bible Verse */}
              <div className="p-3 rounded-xl bg-kcs-blue-900/50 border border-kcs-blue-700/50">
                <div className="flex items-start gap-2">
                  <BookOpen size={14} className="text-kcs-gold-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-kcs-blue-200 text-xs italic leading-relaxed">
                      "Let your light shine before people."
                    </p>
                    <p className="text-kcs-gold-400 text-xs font-medium mt-1">
                      Matthew 5:16
                    </p>
                  </div>
                </div>
              </div>

              {/* Social Links */}
              <div className="flex gap-3 mt-5">
                {socials.map(({ icon: Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    aria-label={label}
                    className="w-9 h-9 rounded-lg bg-kcs-blue-800 hover:bg-kcs-blue-600 flex items-center justify-center text-kcs-blue-300 hover:text-white transition-all duration-200"
                  >
                    <Icon size={16} />
                  </a>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-bold text-sm uppercase tracking-wider text-kcs-gold-400 mb-4">
                Quick Links
              </h4>
              <ul className="space-y-2">
                {quickLinks.map(({ to, label }) => (
                  <li key={to}>
                    <Link
                      to={to}
                      className="flex items-center gap-2 text-kcs-blue-200 hover:text-white text-sm transition-colors duration-200 group"
                    >
                      <ArrowRight size={14} className="text-kcs-blue-500 group-hover:text-kcs-gold-400 transition-colors duration-200" />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>

              <h4 className="font-bold text-sm uppercase tracking-wider text-kcs-gold-400 mb-4 mt-6">
                Portals
              </h4>
              <ul className="space-y-2">
                {portals.map(({ to, label }) => (
                  <li key={label}>
                    <Link
                      to={to}
                      className="flex items-center gap-2 text-kcs-blue-200 hover:text-white text-sm transition-colors duration-200 group"
                    >
                      <ArrowRight size={14} className="text-kcs-blue-500 group-hover:text-kcs-gold-400 transition-colors duration-200" />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Programs */}
            <div>
              <h4 className="font-bold text-sm uppercase tracking-wider text-kcs-gold-400 mb-4">
                Academic Programs
              </h4>
              <ul className="space-y-2">
                {programs.map(({ to, label }) => (
                  <li key={label}>
                    <Link
                      to={to}
                      className="flex items-center gap-2 text-kcs-blue-200 hover:text-white text-sm transition-colors duration-200 group"
                    >
                      <ArrowRight size={14} className="text-kcs-blue-500 group-hover:text-kcs-gold-400 transition-colors duration-200" />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>

              {/* Accreditation */}
              <div className="mt-6 p-4 rounded-xl bg-kcs-blue-900/50 border border-kcs-blue-700/50">
                <p className="text-xs font-semibold text-kcs-gold-400 mb-1 uppercase tracking-wider">
                  Accredited By
                </p>
                <p className="text-kcs-blue-200 text-sm font-medium">
                  K1-K5, Grade 1-Grade 5, Grade 6-Grade 8, and Grade 9-Grade 12
                </p>
                <p className="text-kcs-blue-300 text-xs mt-1">
                  Faith-based learning with a biblical worldview
                </p>
              </div>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-bold text-sm uppercase tracking-wider text-kcs-gold-400 mb-4">
                Contact Us
              </h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3 text-sm">
                  <MapPin size={16} className="text-kcs-gold-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium">KCS Campus</p>
                    <p className="text-kcs-blue-200">Avenue de la Republique n° 1,</p>
                    <p className="text-kcs-blue-200">Macampagne, Ngaliema,</p>
                    <p className="text-kcs-blue-200">Kinshasa, DRC, Ref. 80 jours</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone size={16} className="text-kcs-gold-400 flex-shrink-0" />
                  <div>
                    <p className="text-kcs-blue-200">+243 895 326 011</p>
                    <p className="text-kcs-blue-200">+243 994 645 735</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Mail size={16} className="text-kcs-gold-400 flex-shrink-0" />
                  <div>
                    <p className="text-kcs-blue-200">kinshasachristianschool@gmail.com</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <Clock size={16} className="text-kcs-gold-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium">Office Hours</p>
                    <p className="text-kcs-blue-200">Mon–Fri: 7:30 AM – 4:30 PM</p>
                    <p className="text-kcs-blue-200">Saturday: 8:00 AM – 12:00 PM</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-kcs-blue-800 py-6">
        <div className="container-custom flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-kcs-blue-400">
          <p>© {new Date().getFullYear()} Kinshasa Christian School. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link to="/sitemap" className="hover:text-white transition-colors">Sitemap</Link>
          </div>
          <p className="text-kcs-blue-500">
            Powered by <span className="text-kcs-gold-500 font-medium">KCS Nexus</span>
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
