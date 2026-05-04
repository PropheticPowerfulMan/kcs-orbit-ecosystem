import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import type { UserRole } from '@/types'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
  redirectTo?: string
}

const ProtectedRoute = ({ children, allowedRoles, redirectTo = '/login' }: ProtectedRouteProps) => {
  const { isAuthenticated, user } = useAuthStore()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />
  }

  if (allowedRoles && user && user.role !== 'admin' && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" state={{ from: location, unauthorizedRole: user.role }} replace />
  }

  return <>{children}</>
}

export default ProtectedRoute
