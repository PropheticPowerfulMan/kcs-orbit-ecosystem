import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuthStore } from '../../store/authStore';

const SIDEBAR_MODE_STORAGE_KEY = 'savanex_sidebar_collapsed';

const DashboardLayout = ({ children }) => {
  const role = useAuthStore((s) => s.user?.role || 'admin');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.localStorage.getItem(SIDEBAR_MODE_STORAGE_KEY) === 'true';
  });

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_MODE_STORAGE_KEY, String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  return (
    <div className="savanex-shell flex min-h-screen overflow-x-hidden bg-transparent lg:h-screen lg:overflow-hidden lg:gap-6 lg:px-5 lg:py-5 xl:px-6">
      <Sidebar
        role={role}
        isOpen={isSidebarOpen}
        isCollapsed={isSidebarCollapsed}
        onClose={() => setIsSidebarOpen(false)}
        onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
      />
      <div className="savanex-workspace flex min-h-[100dvh] min-w-0 flex-1 flex-col overflow-hidden border border-github-border bg-github-panel/45 shadow-glass backdrop-blur-xl lg:h-[calc(100vh-2.5rem)] lg:min-h-0 lg:rounded-[1.75rem]">
        <Topbar
          onMenuClick={() => setIsSidebarOpen(true)}
          isSidebarCollapsed={isSidebarCollapsed}
          onSidebarToggle={() => setIsSidebarCollapsed((current) => !current)}
        />
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-4 sm:px-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
