import { Navigate, useLocation } from 'react-router-dom'
import { useAppData } from '../context/AppDataContext'
import { useAuth } from '../context/AuthContext'
import type { ReactNode } from 'react'

type ProtectedRouteProps = {
  children: ReactNode
  allowedRoles?: Array<'Admin' | 'Manager' | 'DepartmentHead' | 'Specialist' | 'Viewer'>
}

/**
 * ProtectedRoute component that handles route-level access control.
 * Redirects to login if not authenticated, or shows access denied if role doesn't match.
 */
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth()
  const { userProfile, loading: dataLoading } = useAppData()
  const location = useLocation()

  // Show loading while checking authentication
  if (authLoading || dataLoading) {
    return (
      <div className="app-shell">
        <div className="loading-state">Loading workspace…</div>
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // If no role restrictions, allow access
  if (!allowedRoles) {
    return <>{children}</>
  }

  // Check if user has required role
  const userRole = userProfile?.role ?? 'Viewer'
  const hasAccess = allowedRoles.includes(userRole)

  if (!hasAccess) {
    // Show access denied message
    return (
      <div className="app-shell">
        <div className="panel">
          <header className="panel-header">
            <div>
              <h2>Access Restricted</h2>
              <p>
                This area requires one of the following roles: {allowedRoles.join(', ')}.
                <br />
                Your current role: <strong>{userRole}</strong>
                <br />
                Contact your administrator if you need access.
              </p>
            </div>
          </header>
        </div>
      </div>
    )
  }

  // User has access, render the protected content
  return <>{children}</>
}

