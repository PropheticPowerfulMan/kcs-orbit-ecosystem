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
  const { user, token, refreshToken, updateUser } = useAuthStore()
  const location = useLocation()
  const hasSession = Boolean(user && token && refreshToken)

  useEffect(() => {
    if (!hasSession || !user) return
    let active = true
    const synchronizeProfile = () => void authAPI.me().then((response) => {
      if (active && response.data?.data) updateUser(response.data.data)
    }).catch(() => undefined)
    synchronizeProfile()
    const timer = window.setInterval(synchronizeProfile, 30_000)
    const synchronizeWhenVisible = () => {
      if (document.visibilityState === 'visible') synchronizeProfile()
    }
    document.addEventListener('visibilitychange', synchronizeWhenVisible)
    return () => {
      active = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', synchronizeWhenVisible)
    }
  }, [hasSession, user?.id, updateUser])
  if (!hasSession) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    const fallbackRoute = user.role === 'admin' ? '/admin' : `/portal/${user.role}`
    return <Navigate to={fallbackRoute} state={{ from: location, unauthorizedRole: user.role }} replace />
  }

  return <>{children}</>
}

export default ProtectedRoute
