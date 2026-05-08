import { Component, Suspense, lazy, type ErrorInfo, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
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

class AdminErrorBoundary extends Component<{ children: ReactNode; routeKey: string }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Admin dashboard render failed', error, info)
  }

  componentDidUpdate(previousProps: { routeKey: string }) {
    if (previousProps.routeKey !== this.props.routeKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="portal-shell flex">
        <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6 dark:bg-kcs-blue-950">
          <section className="w-full max-w-2xl rounded-2xl border border-red-100 bg-white p-6 shadow-xl dark:border-red-900/40 dark:bg-kcs-blue-900">
            <p className="text-xs font-bold uppercase tracking-wide text-red-600 dark:text-red-300">Admin section error</p>
            <h1 className="mt-2 font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">Cette section n'a pas pu s'afficher.</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{this.state.error.message}</p>
            <button
              type="button"
              className="mt-5 rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-kcs-blue-800"
              onClick={() => this.setState({ error: null })}
            >
              Reessayer
            </button>
          </section>
        </main>
      </div>
    )
  }
}

const AdminDashboardRoute = () => {
  const location = useLocation()

  return (
    <AdminErrorBoundary routeKey={location.pathname}>
      <AdminDashboard />
    </AdminErrorBoundary>
  )
}

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
              path="/portal/student/*"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentPortal />
                </ProtectedRoute>
              }
            />

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
              path="/portal/parent/*"
              element={
                <ProtectedRoute allowedRoles={['parent']}>
                  <ParentPortal />
                </ProtectedRoute>
              }
            />

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
              path="/portal/teacher/*"
              element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <TeacherPortal />
                </ProtectedRoute>
              }
            />

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
              path="/portal/staff/*"
              element={
                <ProtectedRoute allowedRoles={['staff']}>
                  <StaffPortal />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboardRoute />
                </ProtectedRoute>
              }
            />
            <Route path="/portal/admin" element={<Navigate to="/admin" replace />} />
            <Route path="/admin/dashboard" element={<Navigate to="/admin" replace />} />
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboardRoute />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  )
}

export default App
