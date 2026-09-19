import { Megaphone, MessageSquare } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { getLocalizedGreeting, getLocalizedPortalDate } from '@/utils/portalGreeting'

export default function AdministratorPortalHeader({ status = 'ready' }: { status?: string }) {
  const user = useAuthStore((state) => state.user)
  const language = useUIStore((state) => state.language)
  const workspaceTitle = language === 'fr' ? 'Centre opérationnel administrateur' : 'Administrator operations center'
  return <header className="portal-dashboard-topbar sticky top-0 z-20 border-b px-4 py-3 backdrop-blur-2xl sm:px-6 sm:py-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h1 className="portal-dashboard-title font-display text-xl font-bold sm:text-2xl">{getLocalizedGreeting(language)}, {user?.firstName}</h1><p className="mt-1 text-sm font-medium text-kcs-blue-700 dark:text-kcs-blue-100">{getLocalizedPortalDate(language)} · {workspaceTitle} · {status}</p></div><div className="flex gap-2"><Link to="/admin/announcements" className="btn-primary flex items-center gap-2 py-2 text-sm"><Megaphone size={16}/>{language === 'fr' ? 'Annonces' : 'Announcements'}</Link><Link to="/admin/messages" className="btn-gold flex items-center gap-2 py-2 text-sm"><MessageSquare size={16}/>{language === 'fr' ? 'Messages' : 'Messages'}</Link></div></div></header>
}
