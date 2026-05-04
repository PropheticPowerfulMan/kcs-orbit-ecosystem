import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import AnalyticsPage from './pages/dashboard/AnalyticsPage';
import StudentsPage from './pages/students/StudentsPage';
import ParentsPage from './pages/parents/ParentsPage';
import TeachersPage from './pages/teachers/TeachersPage';
import TimetablePage from './pages/timetable/TimetablePage';
import CommunicationPage from './pages/communication/CommunicationPage';
import { useAuthStore } from './store/authStore';

const ProtectedRoute = ({ children }) => {
  const token = useAuthStore((s) => s.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

const App = () => {
  const token = useAuthStore((s) => s.accessToken);

  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
      <Route path="/students" element={<ProtectedRoute><StudentsPage /></ProtectedRoute>} />
      <Route path="/parents" element={<ProtectedRoute><ParentsPage /></ProtectedRoute>} />
      <Route path="/teachers" element={<ProtectedRoute><TeachersPage /></ProtectedRoute>} />
      <Route path="/timetable" element={<ProtectedRoute><TimetablePage /></ProtectedRoute>} />
      <Route path="/communication" element={<ProtectedRoute><CommunicationPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={token ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
};

export default App;
