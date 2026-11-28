import { Megaphone, MessageSquare } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { workspaceRole } from '@/utils/accountScope'
import { getLocalizedGreeting, getLocalizedPortalDate } from '@/utils/portalGreeting'

export default function AdministratorPortalHeader({ status = 'ready' }: { status?: string }) {
  const language = useUIStore(state => state.language)
  const user = useAuthStore(state => state.user)
  const {pathname} = useLocation()
  const principal = workspaceRole(user,pathname) === 'admin'
  const basePath = principal ? '/admin' : '/portal/staff'
  const roleTitle = principal ? 'Principal' : language === 'fr' ? 'Personnel administratif' : 'Administrative Staff'
  const statusLabel = ({ready:language==='fr'?'prêt':'ready',loading:language==='fr'?'synchronisation…':'syncing…',error:language==='fr'?'connexion à vérifier':'check connection'} as Record<string,string>)[status] || status
  const name = [user?.lastName,user?.firstName].filter(Boolean).join(' ')
  return <header data-administrative-header className="portal-dashboard-topbar sticky top-0 z-20 border-b px-4 py-3 backdrop-blur-2xl sm:px-6 sm:py-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h1 className="portal-dashboard-title font-display text-xl font-bold sm:text-2xl">{getLocalizedGreeting(language)}, {name || roleTitle}</h1><p data-workspace-title className="mt-1 text-sm font-medium text-kcs-blue-700 dark:text-kcs-blue-100">{getLocalizedPortalDate(language)} · {roleTitle} · {statusLabel}</p></div><div className="flex gap-2"><Link to={basePath+'/announcements'} className="btn-primary flex items-center gap-2 py-2 text-sm"><Megaphone size={16}/>{language === 'fr' ? 'Annonces' : 'Announcements'}</Link><Link to={basePath+'/messages'} className="btn-gold flex items-center gap-2 py-2 text-sm"><MessageSquare size={16}/>Messages</Link></div></div></header>
}
