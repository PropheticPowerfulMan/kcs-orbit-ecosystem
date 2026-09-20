import React, { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { SecurePageLoader } from './components/common/SecurePageState';
import { applyFontTheme, getStoredFontTheme } from './constants/fontThemes';
import { useAuthStore } from './store/authStore';

const CHUNK_RECOVERY_KEY = 'savanex:last-chunk-recovery';
const lazyWithRecovery = (importer) => lazy(async () => {
  try {
    const module = await importer();
    sessionStorage.removeItem(CHUNK_RECOVERY_KEY);
    return module;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const chunkFailed = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(message);
    const recoveryKey = `${window.location.pathname}${window.location.hash}`;
    if (chunkFailed && sessionStorage.getItem(CHUNK_RECOVERY_KEY) !== recoveryKey) {
      sessionStorage.setItem(CHUNK_RECOVERY_KEY, recoveryKey);
      window.location.reload();
      await new Promise(() => undefined);
    }
    throw error;
  }
});

const LoginPage = lazyWithRecovery(() => import('./pages/auth/LoginPage'));
const DashboardPage = lazyWithRecovery(() => import('./pages/dashboard/DashboardPage'));
const AnalyticsPage = lazyWithRecovery(() => import('./pages/dashboard/AnalyticsPage'));
const StudentsPage = lazyWithRecovery(() => import('./pages/students/StudentsPage'));
const ParentsPage = lazyWithRecovery(() => import('./pages/parents/ParentsPage'));
const TeachersPage = lazyWithRecovery(() => import('./pages/teachers/TeachersPage'));
const TimetablePage = lazyWithRecovery(() => import('./pages/timetable/TimetablePage'));
const CommunicationPage = lazyWithRecovery(() => import('./pages/communication/CommunicationPage'));
const ProfilePage = lazyWithRecovery(() => import('./pages/profile/ProfilePage'));
const EntityWorkspacePage = lazyWithRecovery(() => import('./pages/entities/EntityWorkspacePage'));

const ProtectedRoute = ({ children }) => {
  const token = useAuthStore((s) => s.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

const App = () => {
  const token = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    applyFontTheme(getStoredFontTheme());
  }, []);

  return (
    <Suspense fallback={<SecurePageLoader />}>
      <Routes>
      <Route path="/login" element={token ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
      <Route path="/students" element={<ProtectedRoute><StudentsPage /></ProtectedRoute>} />
      <Route path="/students/new-family" element={<ProtectedRoute><StudentsPage familyWorkspace /></ProtectedRoute>} />
      <Route path="/students/:id" element={<ProtectedRoute><EntityWorkspacePage type="student" mode="view" /></ProtectedRoute>} />
      <Route path="/students/:id/edit" element={<ProtectedRoute><EntityWorkspacePage type="student" mode="edit" /></ProtectedRoute>} />
      <Route path="/parents" element={<ProtectedRoute><ParentsPage /></ProtectedRoute>} />
      <Route path="/parents/:id" element={<ProtectedRoute><EntityWorkspacePage type="parent" mode="view" /></ProtectedRoute>} />
      <Route path="/parents/:id/edit" element={<ProtectedRoute><EntityWorkspacePage type="parent" mode="edit" /></ProtectedRoute>} />
      <Route path="/teachers" element={<ProtectedRoute><TeachersPage /></ProtectedRoute>} />
      <Route path="/timetable" element={<ProtectedRoute><TimetablePage /></ProtectedRoute>} />
      <Route path="/communication" element={<ProtectedRoute><CommunicationPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={token ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </Suspense>
  );
};

export default App;
