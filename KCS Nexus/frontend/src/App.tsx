import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import ProtectedRoute from '@/components/shared/ProtectedRoute'
import { useAuthStore } from '@/store/authStore'
import GlobalTextTranslator from '@/components/shared/GlobalTextTranslator'

const HomePage = lazy(() => import('@/pages/Home'))
const AboutPage = lazy(() => import('@/pages/About'))
const AcademicsPage = lazy(() => import('@/pages/Academics'))
const NewsPage = lazy(() => import('@/pages/News'))
const AdmissionsPage = lazy(() => import('@/pages/Admissions'))
const GalleryPage = lazy(() => import('@/pages/Gallery'))
const ContactPage = lazy(() => import('@/pages/Contact'))
const LoginPage = lazy(() => import('@/pages/Auth/Login'))
const StudentPortal = lazy(() => import('@/pages/StudentPortal'))
const AITutorPage = lazy(() => import('@/pages/StudentPortal/AITutor'))
const StudentForumPage = lazy(() => import('@/pages/StudentForum'))
const ParentPortal = lazy(() => import('@/pages/ParentPortal'))
const ParentForumPage = lazy(() => import('@/pages/ParentForum'))
const TeacherPortal = lazy(() => import('@/pages/TeacherPortal'))
const StaffPortal = lazy(() => import('@/pages/StaffPortal'))
const AdminDashboard = lazy(() => import('@/pages/Admin'))
const SchoolRegistryPage = lazy(() => import('@/pages/Admin/SchoolRegistry'))
const ForumInsightsPage = lazy(() => import('@/pages/Admin/ForumInsights'))
const StudentForumInsightsPage = lazy(() => import('@/pages/Admin/StudentForumInsights'))

const PortalRedirect = () => {
  const { user, isAuthenticated } = useAuthStore()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  return <Navigate to={user.role === 'admin' ? '/admin' : `/portal/${user.role}`} replace />
}

const RouteFallback = () => <div className="min-h-[40vh]" />

const App = () => {
  return (
    <>
      <GlobalTextTranslator />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/academics" element={<AcademicsPage />} />
            <Route path="/news" element={<NewsPage />} />
            <Route path="/news/:id" element={<NewsPage />} />
            <Route path="/admissions" element={<AdmissionsPage />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy" element={<ContactPage />} />
            <Route path="/terms" element={<AboutPage />} />
            <Route path="/sitemap" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/portal"
              element={
                <ProtectedRoute>
                  <PortalRedirect />
                </ProtectedRoute>
              }
            />

            <Route
              path="/portal/notifications"
              element={
                <ProtectedRoute>
                  <PortalRedirect />
                </ProtectedRoute>
              }
            />

            <Route
              path="/portal/student"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentPortal />
                </ProtectedRoute>
              }
            />
            <Route
              path="/portal/student/dashboard"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentPortal />
                </ProtectedRoute>
              }
            />
            <Route
              path="/portal/student/ai-tutor"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <AITutorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/portal/student/forum"
              element={
                <ProtectedRoute allowedRoles={['student', 'admin']}>
                  <StudentForumPage />
                </ProtectedRoute>
              }
            />
            {['grades', 'assignments', 'timetable', 'messages', 'profile'].map((segment) => (
              <Route
                key={segment}
                path={`/portal/student/${segment}`}
                element={
                  <ProtectedRoute allowedRoles={['student']}>
                    <StudentPortal />
                  </ProtectedRoute>
                }
              />
            ))}

            <Route
              path="/portal/parent"
              element={
                <ProtectedRoute allowedRoles={['parent']}>
                  <ParentPortal />
                </ProtectedRoute>
              }
            />
            <Route
              path="/portal/parent/dashboard"
              element={
                <ProtectedRoute allowedRoles={['parent']}>
                  <ParentPortal />
                </ProtectedRoute>
              }
            />
            <Route
              path="/portal/parent/forum"
              element={
                <ProtectedRoute allowedRoles={['parent', 'admin']}>
                  <ParentForumPage />
                </ProtectedRoute>
              }
            />
            {['performance', 'messages', 'calendar', 'profile', 'grades', 'finance'].map((segment) => (
              <Route
                key={segment}
                path={`/portal/parent/${segment}`}
                element={
                  <ProtectedRoute allowedRoles={['parent']}>
                    <ParentPortal />
                  </ProtectedRoute>
                }
              />
            ))}

            <Route
              path="/portal/teacher"
              element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <TeacherPortal />
                </ProtectedRoute>
              }
            />
            <Route
              path="/portal/teacher/dashboard"
              element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <TeacherPortal />
                </ProtectedRoute>
              }
            />
            <Route path="/portal/teacher/report-card" element={<Navigate to="/portal/teacher/grades" replace />} />
            {['courses', 'students', 'attendance', 'assignments', 'grades', 'reports', 'discipline', 'messages'].map((segment) => (
              <Route
                key={segment}
                path={`/portal/teacher/${segment}`}
                element={
                  <ProtectedRoute allowedRoles={['teacher']}>
                    <TeacherPortal />
                  </ProtectedRoute>
                }
              />
            ))}

            <Route
              path="/portal/staff"
              element={
                <ProtectedRoute allowedRoles={['staff']}>
                  <StaffPortal />
                </ProtectedRoute>
              }
            />
            <Route
              path="/portal/staff/dashboard"
              element={
                <ProtectedRoute allowedRoles={['staff']}>
                  <StaffPortal />
                </ProtectedRoute>
              }
            />
            {['records', 'admissions', 'announcements', 'reports', 'finance', 'messages', 'permissions'].map((segment) => (
              <Route
                key={segment}
                path={`/portal/staff/${segment}`}
                element={
                  <ProtectedRoute allowedRoles={['staff']}>
                    <StaffPortal />
                  </ProtectedRoute>
                }
              />
            ))}

            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/portal/admin" element={<Navigate to="/admin" replace />} />
            <Route path="/admin/dashboard" element={<Navigate to="/admin" replace />} />
            <Route
              path="/admin/registry"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <SchoolRegistryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/forum-insights"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ForumInsightsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/student-forum-insights"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <StudentForumInsightsPage />
                </ProtectedRoute>
              }
            />
            {['students', 'teachers', 'courses', 'admissions', 'finance', 'reports', 'news', 'media', 'analytics', 'settings', 'transcripts', 'communications', 'staff-attendance', 'discipline'].map((segment) => (
              <Route
                key={segment}
                path={`/admin/${segment}`}
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
            ))}

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  )
}

export default App
