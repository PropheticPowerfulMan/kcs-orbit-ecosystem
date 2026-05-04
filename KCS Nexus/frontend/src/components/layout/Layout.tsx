import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Header from './Header'
import Footer from './Footer'
import AIChat from '@/components/shared/AIChat'
import { useUIStore } from '@/store/uiStore'

const Layout = () => {
  const location = useLocation()
  const { theme } = useUIStore()

  // Apply theme on mount and theme changes
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [location.pathname])

  // Portal routes don't use the public layout
  const isPortalRoute = location.pathname.startsWith('/portal') || 
                        location.pathname.startsWith('/admin')

  if (isPortalRoute) {
    return <Outlet />
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-kcs-blue-950">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <AIChat />
    </div>
  )
}

export default Layout
