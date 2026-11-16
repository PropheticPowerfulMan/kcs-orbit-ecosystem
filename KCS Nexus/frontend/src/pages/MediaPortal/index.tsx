import {useState} from 'react'
import {Navigate,useLocation} from 'react-router-dom'
import {Image,Radio,Newspaper,Settings,Film,ExternalLink} from 'lucide-react'
import PortalSidebar from '@/components/layout/PortalSidebar'
import AccountSettingsPanel from '@/components/shared/AccountSettingsPanel'
import AdminNewsEventsManager from '@/components/admin/AdminNewsEventsManager'
import WebsiteVideoManager from '@/components/admin/WebsiteVideoManager'
import {useUIStore} from '@/store/uiStore'
import {useAuthStore} from '@/store/authStore'
import {getLocalizedGreeting,getLocalizedPortalDate} from '@/utils/portalGreeting'
import '@/components/shared/portalWorkspace.css'
import './mediaPortal.css'
export default function MediaPortal(){
 const{pathname}=useLocation(),language=useUIStore(s=>s.language),user=useAuthStore(s=>s.user),tr=(fr:string,en:string)=>language==='fr'?fr:en
 const[galleryTab,setGalleryTab]=useState<'photos'|'videos'>('photos'),segment=pathname.split('/').filter(Boolean).at(-1)
 if(!['news','gallery','settings'].includes(segment||''))return <Navigate to="/portal/media/news" replace/>
 const Icon=segment==='news'?Newspaper:segment==='gallery'?Image:Settings
 return <div className="portal-shell flex"><PortalSidebar/><main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto"><header className="portal-dashboard-topbar sticky top-0 z-20 border-b px-4 py-4 sm:px-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="portal-dashboard-title text-xl font-bold">{getLocalizedGreeting(language)}, {user?.firstName||'Media'}</h1><p className="mt-1 text-xs text-sky-100">{getLocalizedPortalDate(language)} · KCS Media</p></div><a href={segment==='news'?'/news':'/gallery'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-sky-300/40 px-4 py-2 text-xs font-bold text-white"><ExternalLink size={15}/>{tr('Voir le site','View website')}</a></div></header>
 <div data-portal-workspace data-media-workspace className="space-y-5 p-4 sm:p-6"><header className="nexus-workspace-heading"><span className="nexus-workspace-heading-icon"><Icon size={25}/></span><div><span className="nexus-workspace-kicker">KCS · MEDIA STUDIO</span><h2>{segment==='news'?tr('Raconter la vie de notre école','Tell our school’s story'):segment==='gallery'?tr('Des images qui font rayonner KCS','Images that bring KCS to life'):tr('Votre compte Media','Your Media account')}</h2><p className="mt-2 text-sm">{segment==='settings'?tr('Une photo personnelle et un mot de passe propres à ce compte.','A personal photo and password for this account.'):tr('Publiez les actualités, les photos, les vidéos et les directs de l’école.','Publish school news, photos, videos and live streams.')}</p></div></header>
 {segment==='news'?<AdminNewsEventsManager/>:segment==='settings'?<AccountSettingsPanel roleLabel="KCS Media"/>:<><nav className="media-studio-tabs" aria-label={tr('Type de média','Media type')}>{([['photos',Image,tr('Photos et légendes','Photos & captions')],['videos',Film,tr('Vidéos et directs','Videos & live streams')]] as const).map(([key,TabIcon,label])=><button type="button" key={key} aria-pressed={galleryTab===key} onClick={()=>setGalleryTab(key)}><TabIcon size={18}/>{label}</button>)}</nav><div hidden={galleryTab!=='photos'}><AdminNewsEventsManager focus="media"/></div><div hidden={galleryTab!=='videos'}><WebsiteVideoManager/></div></>}
 </div></main></div>
}
