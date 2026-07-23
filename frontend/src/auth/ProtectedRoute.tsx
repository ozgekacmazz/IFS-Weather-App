import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import { getRoleHomePath } from './authNavigation'
import type { UserRole } from './authTypes'

interface ProtectedRouteProps {
  allowedRole?: UserRole
}

export function ProtectedRoute({ allowedRole }: ProtectedRouteProps) {
  const { session } = useAuth()
  const location = useLocation()

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (allowedRole !== undefined && session.role !== allowedRole) {
    return <Navigate to={getRoleHomePath(session.role)} replace />
  }

  return <Outlet />
}
