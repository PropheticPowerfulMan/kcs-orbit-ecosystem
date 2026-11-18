import {useUIStore} from '@/store/uiStore'
import {sitePage,siteRoutes} from '@/utils/siteContent'
import {PublicPreviewContext} from './PublicPreviewContext'
import './publicDesign.css'
import { Outlet, useLocation } from 'react-router-dom'
import { useContext,useEffect,useState,useCallback,useLayoutEffect } from 'react'
import PublicSiteContent from '@/components/shared/PublicSiteContent'
import Header from './Header'
import Footer from './Footer'
import AIChat from '@/components/shared/AIChat'

const Layout = () => {
  const location = useLocation()
  const preview=useContext(PublicPreviewContext)
  const language=useUIStore(state=>state.language)==='fr'?'fr':'en'
  const contentKey=sitePage(location.pathname)+':'+language
  const [visualState,setVisualState]=useState({key:'',ready:false})
  useLayoutEffect(()=>setVisualState(previous=>previous.key===contentKey?previous:{key:contentKey,ready:false}),[contentKey])
  const visualReady=useCallback(()=>setVisualState(previous=>previous.key===contentKey&&previous.ready?previous:{key:contentKey,ready:true}),[contentKey])
  const visualPending=siteRoutes.includes(sitePage(location.pathname))&&!(visualState.key===contentKey&&visualState.ready)
  // Scroll to top on route change
  useEffect(() => {
    if(preview)document.querySelector('[data-public-preview-viewport]')?.scrollTo({top:0,behavior:'auto'});else window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [location.pathname,preview])

  // Portal routes don't use the public layout
  const isPortalRoute = (location.pathname === '/portal' || location.pathname.startsWith('/portal/')) ||
                        (location.pathname === '/admin' || location.pathname.startsWith('/admin/'))

  if (isPortalRoute) {
    return <Outlet />
  }

  const publicPage = location.pathname.replace(/^\//,'').split('/')[0] || 'home'
  const redesigned = ['home','about','academics','admissions','news','gallery','contact','school-handbook','privacy','terms','sitemap','login'].includes(publicPage)

  return (
    <div data-site-visual-pending={visualPending?'true':undefined} data-public-page={publicPage} className={`public-site-shell${redesigned?' kcs-public-redesign':''} min-h-screen flex flex-col dark:bg-kcs-blue-950`}>
      <Header />
      <main className="public-site-main flex-1">
        <Outlet />
      </main>
      <Footer />
      {!preview&&<div data-site-exclude><AIChat /></div>}
      <PublicSiteContent onVisualReady={visualReady}/>
    </div>
  )
}

export default Layout
