import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  Briefcase,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  MessageSquare,
  UserRoundCheck,
  Users,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SchoolLogo from '../ui/SchoolLogo';

const Sidebar = ({ role = 'admin', isOpen = false, isCollapsed = false, onClose = () => {}, onToggleCollapse = () => {} }) => {
  const { t } = useTranslation();

  const links = [
    { to: '/dashboard', icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/students', icon: Users, label: t('nav.students') },
    { to: '/parents', icon: UserRoundCheck, label: t('nav.parents') },
    { to: '/teachers', icon: Briefcase, label: t('nav.teachers') },
    { to: '/timetable', icon: CalendarClock, label: t('nav.timetable') },
    { to: '/communication', icon: MessageSquare, label: t('nav.communication') },
    { to: '/analytics', icon: BarChart3, label: t('nav.analytics') },
  ];

  const navigation = (
    <>
      <div className={`flex items-start justify-between gap-3 px-5 py-5 lg:px-4 lg:py-5 ${isCollapsed ? 'lg:flex-col lg:items-center' : 'lg:block lg:px-6 lg:py-6'}`}>
        <div className={isCollapsed ? 'lg:flex lg:flex-col lg:items-center' : ''}>
          <SchoolLogo withText={!isCollapsed} />
          <p className={`mt-4 text-xs uppercase tracking-[0.2em] text-slate-500 ${isCollapsed ? 'lg:mt-3 lg:text-center' : ''}`}>{role}</p>
        </div>
        <div className={`flex shrink-0 items-center gap-2 ${isCollapsed ? 'lg:w-full lg:justify-center' : ''}`}>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden h-10 w-10 items-center justify-center rounded-xl border border-github-border bg-slate-900/55 text-slate-300 transition hover:border-kcs-blue/50 hover:text-sky-200 lg:flex"
            aria-label={isCollapsed ? 'Etendre la barre laterale' : 'Reduire la barre laterale'}
            title={isCollapsed ? 'Etendre la barre laterale' : 'Reduire la barre laterale'}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-github-border bg-slate-900/70 text-slate-300 transition hover:border-kcs-blue/50 hover:text-sky-200 lg:hidden"
            aria-label="Fermer le menu"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <nav className={`flex-1 space-y-1 px-3 pb-4 ${isCollapsed ? 'lg:px-2' : ''}`}>
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={onClose}
              title={isCollapsed ? link.label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition ${isCollapsed ? 'lg:justify-center lg:px-2' : ''} ${
                  isActive
                    ? 'border-kcs-blue/40 bg-kcs-blue/15 text-sky-200 shadow-glass'
                    : 'border-transparent text-slate-300 hover:border-github-border hover:bg-slate-800/55 hover:text-slate-100'
                }`
              }
            >
              <Icon size={16} className="shrink-0" />
              <span className={isCollapsed ? 'lg:hidden' : ''}>{link.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      <aside className={`hidden shrink-0 lg:block ${isCollapsed ? 'w-24' : 'w-72'}`}>
        <div className="savanex-sidebar-panel flex h-[calc(100vh-2.5rem)] flex-col overflow-hidden rounded-[1.75rem] border border-github-border bg-github-canvas/78 shadow-glass backdrop-blur-xl">
          {navigation}
        </div>
      </aside>

      <div
        className={`fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`savanex-sidebar-panel fixed inset-y-0 left-0 z-50 flex w-[min(20rem,88vw)] flex-col border-r border-github-border bg-github-canvas/95 shadow-2xl backdrop-blur-xl transition-transform duration-300 lg:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Menu principal"
        aria-hidden={!isOpen}
      >
        {navigation}
      </aside>
    </>
  );
};

export default Sidebar;
