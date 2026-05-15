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
      <div className="savanex-workspace flex min-h-screen flex-1 flex-col overflow-hidden rounded-[1.75rem] border border-github-border bg-github-panel/45 shadow-glass backdrop-blur-xl lg:h-[calc(100vh-2.5rem)] lg:min-h-0">
        <Topbar
          onMenuClick={() => setIsSidebarOpen(true)}
          isSidebarCollapsed={isSidebarCollapsed}
          onSidebarToggle={() => setIsSidebarCollapsed((current) => !current)}
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
