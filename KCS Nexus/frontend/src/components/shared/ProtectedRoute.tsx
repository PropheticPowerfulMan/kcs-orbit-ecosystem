import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { authAPI } from '@/services/api'
import type { UserRole } from '@/types'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
  redirectTo?: string
}

const ProtectedRoute = ({ children, allowedRoles, redirectTo = '/login' }: ProtectedRouteProps) => {
  const { isAuthenticated, user, updateUser } = useAuthStore()
  const location = useLocation()

  useEffect(() => {
    if (!isAuthenticated || !user) return
    let active = true
    void authAPI.me().then((response) => {
      if (active && response.data?.data) updateUser(response.data.data)
    }).catch(() => undefined)
    return () => { active = false }
  }, [isAuthenticated, user?.id, updateUser])
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    const fallbackRoute = user.role === 'admin' ? '/admin' : redirectTo
    return <Navigate to={fallbackRoute} state={{ from: location, unauthorizedRole: user.role }} replace />
  }

  return <>{children}</>
}

export default ProtectedRoute
