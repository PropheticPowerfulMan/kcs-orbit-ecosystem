import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  Menu, X, Sun, Moon, Globe, Bell,
  GraduationCap, BookOpen, Users, Home, Phone, Image, Newspaper, LogIn
} from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { getAssetUrl } from '@/utils/assets'

const Header = () => {
  const { t, i18n } = useTranslation()
  const { theme, toggleTheme, language, setLanguage, unreadCount } = useUIStore()
  const { isAuthenticated, user } = useAuthStore()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobileOpen) return

    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node
      if (headerRef.current?.contains(target) || mobileMenuRef.current?.contains(target)) {
        return
      }
      setMobileOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [mobileOpen])

  const currentLanguage = (i18n.resolvedLanguage || language).startsWith('fr') ? 'fr' : 'en'

  const toggleLanguage = () => {
    const next = currentLanguage === 'en' ? 'fr' : 'en'
    setLanguage(next)
    void i18n.changeLanguage(next)
  }

  const isHomePage = location.pathname === '/'
  const logoSrc = getAssetUrl('images/kcs.jpg')
  const dashboardPath = user?.role === 'admin' ? '/admin' : `/portal/${user?.role ?? ''}`

  const navItems = [
    { to: '/', label: t('nav.home'), icon: Home },
    { to: '/about', label: t('nav.about'), icon: Users },
    { to: '/academics', label: t('nav.academics'), icon: GraduationCap },
    { to: '/news', label: t('nav.news'), icon: Newspaper },
    { to: '/admissions', label: t('nav.admissions'), icon: BookOpen },
    { to: '/gallery', label: t('nav.gallery'), icon: Image },
    { to: '/contact', label: t('nav.contact'), icon: Phone },
  ]

  return (
    <header
      ref={headerRef}
      className="fixed top-0 left-0 right-0 z-50 px-3 pt-3 transition-all duration-500"
    >
      <div className="container-custom">
        <div
          className={`flex h-[68px] items-center justify-between gap-2 rounded-[34px] px-2.5 pr-3 transition-all duration-500 sm:h-[76px] sm:gap-3 sm:rounded-[38px] sm:px-3.5 md:px-4 ${
            scrolled || !isHomePage
              ? 'github-glass dark:github-glass-dark'
              : 'border border-white/20 bg-kcs-blue-950/26 shadow-kcs backdrop-blur-2xl'
          }`}
        >
          {/* Logo */}
          <Link to="/" className="group flex min-w-0 shrink-0 items-center gap-2.5 rounded-full pr-1 transition-colors hover:bg-white/10 sm:gap-3 sm:pr-2">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-white p-1 shadow-kcs ring-4 ring-white/35 transition-all duration-300 group-hover:scale-[1.03] group-hover:shadow-kcs-lg sm:h-16 sm:w-16 dark:ring-kcs-blue-900/45">
              <img
                src={logoSrc}
                alt="Kinshasa Christian School"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="hidden sm:block">
              <p className={`font-bold text-sm leading-tight font-display transition-colors duration-300 ${
                scrolled || !isHomePage
                  ? 'text-kcs-blue-900 dark:text-white'
                  : 'text-white'
              }`}>
                Kinshasa Christian
              </p>
              <p className={`text-xs font-medium transition-colors duration-300 ${
                scrolled || !isHomePage
                  ? 'text-kcs-blue-600 dark:text-kcs-gold-300'
                  : 'text-kcs-gold-100'
              }`}>
                Letting Our Light Shine
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `max-w-[118px] truncate rounded-full px-3 py-2 text-center text-[13px] font-semibold leading-none transition-all duration-200 xl:max-w-none xl:px-3.5 ${
                    isActive
                      ? 'bg-kcs-blue-700 text-white shadow-sm dark:bg-kcs-gold-600 dark:text-kcs-blue-950'
                      : scrolled || !isHomePage
                      ? 'text-kcs-blue-950 dark:text-gray-200 hover:bg-kcs-blue-50 hover:text-kcs-blue-700 dark:hover:bg-white/10'
                      : 'text-white/90 hover:bg-white/10 hover:text-white'
                  }`
                }
                title={label}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Right Actions */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {/* Language Toggle */}
            <button
              onClick={toggleLanguage}
              className={`flex h-10 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold transition-all duration-200 sm:px-3 ${
                scrolled || !isHomePage
                  ? 'text-kcs-blue-800 dark:text-gray-200 hover:bg-kcs-blue-50 dark:hover:bg-white/10'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
              aria-label={t('common.language')}
            >
              <Globe size={16} />
              <span className="hidden sm:inline">{currentLanguage.toUpperCase()}</span>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 ${
                scrolled || !isHomePage
                  ? 'text-kcs-blue-800 dark:text-gray-200 hover:bg-kcs-blue-50 dark:hover:bg-white/10'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
              aria-label={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Notifications (when logged in) */}
            {isAuthenticated && (
              <Link
                to="/portal/notifications"
                className={`relative rounded-full p-2 transition-all duration-200 ${
                  scrolled || !isHomePage
                    ? 'text-kcs-blue-800 dark:text-gray-200 hover:bg-kcs-blue-50 dark:hover:bg-white/10'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            )}

            {/* Auth Button */}
            {isAuthenticated ? (
              <Link
                to={dashboardPath}
                className="hidden sm:flex items-center gap-2 btn-primary text-sm py-2"
              >
                <div className="w-6 h-6 rounded-full bg-kcs-gold-500 flex items-center justify-center text-kcs-blue-950 text-xs font-bold">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
                <span>{t('nav.dashboard')}</span>
              </Link>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <Link to="/login" className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition-all duration-200 ${
                  scrolled || !isHomePage
                    ? 'text-kcs-blue-700 dark:text-kcs-blue-200 hover:bg-kcs-blue-50 dark:hover:bg-white/10'
                    : 'text-white hover:bg-white/10'
                }`}>
                  <LogIn size={16} />
                  {t('nav.login')}
                </Link>
                <Link to="/admissions" className="rounded-full bg-kcs-blue-700 px-4 py-2 text-sm font-bold text-white shadow-kcs transition-all duration-300 hover:-translate-y-0.5 hover:bg-kcs-blue-800 hover:shadow-kcs-lg dark:bg-kcs-gold-600 dark:text-kcs-blue-950 dark:hover:bg-kcs-gold-700">
                  {t('nav.applyNow')}
                </Link>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className={`flex h-11 w-11 items-center justify-center rounded-full border transition-all duration-200 lg:hidden ${
                scrolled || !isHomePage
                  ? 'border-kcs-blue-100 bg-white/65 text-kcs-blue-800 shadow-sm hover:bg-kcs-blue-50 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/40 dark:text-gray-200 dark:hover:bg-white/10'
                  : 'border-white/20 bg-white/10 text-white shadow-sm hover:bg-white/15'
              }`}
              aria-label={mobileOpen ? t('common.close') : t('nav.portal')}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="lg:hidden overflow-hidden"
          >
            <div className="container-custom py-3">
              <div ref={mobileMenuRef} className="github-glass dark:github-glass-dark max-h-[calc(100dvh-96px)] space-y-1 overflow-y-auto rounded-[30px] p-2.5 shadow-2xl shadow-kcs-blue-950/15 sm:rounded-[34px] sm:p-3">
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex min-h-12 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? 'bg-kcs-blue-700 text-white shadow-kcs'
                        : 'text-kcs-blue-900 dark:text-gray-200 hover:bg-kcs-blue-50 dark:hover:bg-white/10'
                    }`
                  }
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-kcs-blue-700 shadow-sm dark:bg-kcs-blue-950 dark:text-kcs-blue-200">
                    <Icon size={17} />
                  </span>
                  {label}
                </NavLink>
              ))}

              <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3 dark:border-kcs-blue-800">
                {isAuthenticated ? (
                  <Link to={dashboardPath} onClick={() => setMobileOpen(false)} className="flex-1 rounded-2xl bg-kcs-blue-700 px-4 py-3 text-center text-sm font-bold text-white shadow-kcs">
                    {t('nav.dashboard')}
                  </Link>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setMobileOpen(false)} className="flex-1 rounded-2xl bg-kcs-blue-700 px-4 py-3 text-center text-sm font-bold text-white shadow-kcs">
                      {t('nav.login')}
                    </Link>
                    <Link to="/admissions" onClick={() => setMobileOpen(false)} className="flex-1 rounded-2xl bg-kcs-gold-500 px-4 py-3 text-center text-sm font-bold text-kcs-blue-950 shadow-kcs">
                      {t('nav.applyNow')}
                    </Link>
                  </>
                )}
              </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

export default Header
