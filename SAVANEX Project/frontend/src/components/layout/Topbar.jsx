import React from 'react';
import { Bell, PanelLeft, PanelLeftClose, LogOut, Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import FontThemeSelector from '../ui/FontThemeSelector';
import LanguageToggle from '../ui/LanguageToggle';
import { useAuthStore } from '../../store/authStore';
import SchoolLogo from '../ui/SchoolLogo';

const Topbar = ({ onMenuClick = () => {}, isSidebarCollapsed = false, onSidebarToggle = () => {} }) => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-github-border bg-github-canvas/72 px-4 py-3 backdrop-blur-xl lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-github-border bg-slate-900/55 text-slate-300 transition hover:border-kcs-blue/50 hover:text-sky-200 lg:hidden"
          aria-label="Ouvrir le menu"
        >
          <Menu size={18} />
        </button>
        <SchoolLogo size="sm" className="lg:hidden" />
        <div className="min-w-0">
          <h1 className="truncate font-display text-base font-semibold text-slate-100 sm:text-lg">{t('app.title')}</h1>
          <p className="truncate text-xs text-slate-400">{user?.full_name || user?.username}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onSidebarToggle}
          className="hidden rounded-xl border border-github-border bg-slate-900/45 p-2 text-slate-300 backdrop-blur transition hover:border-kcs-blue/50 hover:text-sky-300 lg:block"
          aria-label={isSidebarCollapsed ? 'Etendre la barre laterale' : 'Reduire la barre laterale'}
          title={isSidebarCollapsed ? 'Etendre la barre laterale' : 'Reduire la barre laterale'}
        >
          {isSidebarCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>
        <FontThemeSelector />
        <LanguageToggle />
        <button
          className="hidden rounded-xl border border-github-border bg-slate-900/45 p-2 text-slate-300 backdrop-blur hover:border-kcs-blue/50 hover:text-sky-300 sm:block"
          aria-label="Notifications"
        >
          <Bell size={16} />
        </button>
        <button
          onClick={clearAuth}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-300 backdrop-blur hover:bg-amber-500/10 sm:w-auto sm:px-3 sm:py-2 sm:text-xs sm:font-semibold"
          aria-label={t('actions.logout')}
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">{t('actions.logout')}</span>
        </button>
      </div>
    </header>
  );
};

export default Topbar;
