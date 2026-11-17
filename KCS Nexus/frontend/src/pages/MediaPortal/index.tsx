import {Navigate,useLocation} from 'react-router-dom'
import {ExternalLink,Settings} from 'lucide-react'
import PortalSidebar from '@/components/layout/PortalSidebar'
import AccountSettingsPanel from '@/components/shared/AccountSettingsPanel'
import AdminSiteManager from '@/components/admin/AdminSiteManager'
import {useUIStore} from '@/store/uiStore'
import {useAuthStore} from '@/store/authStore'
import {getLocalizedGreeting,getLocalizedPortalDate} from '@/utils/portalGreeting'
import '@/components/shared/portalWorkspace.css'
import './mediaPortal.css'
export default function MediaPortal(){
 const{pathname}=useLocation(),language=useUIStore(s=>s.language),user=useAuthStore(s=>s.user),tr=(fr:string,en:string)=>language==='fr'?fr:en
 const segment=pathname.split('/').filter(Boolean).at(-1)
 if(!['site','news','gallery','site-videos','settings'].includes(segment||''))return <Navigate to="/portal/media/site" replace/>
 const initial=segment==='news'?'news':segment==='gallery'?'media':segment==='site-videos'?'videos':'pages'
 return <div className="portal-shell flex" data-media-portal><PortalSidebar/><main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto"><header className="portal-dashboard-topbar sticky top-0 z-20 border-b px-4 py-4 sm:px-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="portal-dashboard-title text-xl font-bold">{getLocalizedGreeting(language)}, {user?.firstName||'Media'}</h1><p className="mt-1 text-xs text-kcs-blue-700 dark:text-sky-100">{getLocalizedPortalDate(language)} · KCS Media</p></div><a href={segment==='news'?'/news':segment==='gallery'||segment==='site-videos'?'/gallery':'/'} target="_blank" rel="noopener noreferrer" className="media-website-link inline-flex items-center gap-2 rounded-xl border border-sky-300/60 px-4 py-2 text-xs font-bold text-kcs-blue-800 dark:text-white"><ExternalLink size={15}/>{tr('Voir le site','View website')}</a></div></header>
 <div data-portal-workspace data-media-workspace className="space-y-5 p-4 sm:p-6">{segment==='settings'?<><header className="nexus-workspace-heading"><span className="nexus-workspace-heading-icon"><Settings size={25}/></span><div><span className="nexus-workspace-kicker">KCS · MEDIA STUDIO</span><h2>{tr('Votre compte Media','Your Media account')}</h2><p className="mt-2 text-sm">{tr('Une photo personnelle et un mot de passe propres à ce compte.','A personal photo and password for this account.')}</p></div></header><AccountSettingsPanel roleLabel="KCS Media"/></>:<AdminSiteManager initial={initial} basePath="/portal/media"/>}</div></main></div>
}
