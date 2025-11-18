import type { ReactNode } from 'react'
import { useAppData } from '../context/AppDataContext'

type AccessGuardProps = {
  allowedRoles?: Array<'Admin' | 'Manager' | 'DepartmentHead' | 'Specialist' | 'Viewer'>
  children: ReactNode
}

/**
 * AccessGuard component for component-level access control.
 * Use this to protect specific UI components within a page.
 * For route-level protection, use ProtectedRoute instead.
 */
export function AccessGuard({ allowedRoles, children }: AccessGuardProps) {
  const { userProfile, loading } = useAppData()

  // Show loading while profile is being loaded
  if (loading || !userProfile) {
    return (
      <div className="panel">
        <div className="loading-state">Loading access settings…</div>
      </div>
    )
  }

  // If no role restrictions, allow access
  if (!allowedRoles || allowedRoles.length === 0) {
    return <>{children}</>
  }

  // Normalize role for comparison (case-insensitive)
  const userRole = userProfile.role
  const normalizedUserRole = userRole as 'Admin' | 'Manager' | 'DepartmentHead' | 'Specialist' | 'Viewer'
  const hasAccess = allowedRoles.includes(normalizedUserRole)

  if (!hasAccess) {
    return (
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
    )
  }

  return <>{children}</>
}

