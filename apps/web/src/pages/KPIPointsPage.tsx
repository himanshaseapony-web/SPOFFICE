import { useMemo, useState } from 'react'
import { useAppData } from '../context/AppDataContext'
import { useAuth } from '../context/AuthContext'
import { resetAllKPIPoints } from '../lib/kpi'

export function KPIPointsPage() {
  const { kpiPoints, allUserProfiles, departments, firestore, userProfile } = useAppData()
  const { user } = useAuth()
  const [isResetting, setIsResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // Enrich KPI points with user profile data (department, role)
  const enrichedPoints = useMemo(() => {
    return kpiPoints
      .filter((point) => point.points > 0) // Only include users with points > 0
      .map((point) => {
        const userProfile = allUserProfiles.find((profile) => profile.id === point.userId)
        return {
          ...point,
          department: userProfile?.department || 'Unknown',
          role: userProfile?.role || 'Unknown',
          displayName: userProfile?.displayName || point.userName,
        }
      })
  }, [kpiPoints, allUserProfiles])

  // Group by department for department view
  const pointsByDepartment = useMemo(() => {
    const grouped: Record<string, typeof enrichedPoints> = {}
    enrichedPoints.forEach((point) => {
      const dept = point.department
      if (!grouped[dept]) {
        grouped[dept] = []
      }
      grouped[dept].push(point)
    })
    return grouped
  }, [enrichedPoints])

  // Calculate total points across all users
  const totalPoints = useMemo(() => {
    return enrichedPoints.reduce((sum, point) => sum + point.points, 0)
  }, [enrichedPoints])

  // Get top performers (top 10)
  const topPerformers = useMemo(() => {
    return enrichedPoints.slice(0, 10)
  }, [enrichedPoints])

  // Check if user is admin
  const isAdmin = userProfile?.role === 'Admin'

  // Handle KPI reset
  const handleResetKPI = async () => {
    if (!firestore || !user || !userProfile) {
      setResetError('Unable to reset KPI points. Please ensure you are logged in.')
      return
    }

    if (!isAdmin) {
      setResetError('Only administrators can reset KPI points.')
      return
    }

    setIsResetting(true)
    setResetError(null)

    try {
      const result = await resetAllKPIPoints(firestore, user.uid, userProfile.displayName)
      
      if (result.success) {
        alert(`✅ Successfully reset KPI points for ${result.usersReset} user(s).\n\nAll points have been set to 0 and audit records have been created.`)
        setShowResetConfirm(false)
      } else {
        setResetError(result.error || 'Failed to reset KPI points')
      }
    } catch (error: any) {
      console.error('Reset error:', error)
      setResetError(error.message || 'An unexpected error occurred')
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="kpi-points-page">
      <header className="panel-header">
        <div>
          <h1>KPI Points Leaderboard</h1>
          <p>Track performance based on completed calendar updates</p>
        </div>
        {isAdmin && enrichedPoints.length > 0 && (
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            disabled={isResetting}
            className="ghost-button"
            style={{ color: '#d1434c', borderColor: '#d1434c' }}
          >
            {isResetting ? 'Resetting...' : '🔄 Reset All KPI Points'}
          </button>
        )}
      </header>

      {/* Summary Stats */}
      <section className="panel" style={{ marginBottom: '2rem' }}>
        <div className="metrics-grid">
          <div className="metric-card">
            <span className="section-label">Total Points Awarded</span>
            <strong>{totalPoints}</strong>
            <p>Across all team members</p>
          </div>
          <div className="metric-card">
            <span className="section-label">Active Participants</span>
            <strong>{enrichedPoints.length}</strong>
            <p>Team members with points</p>
          </div>
          <div className="metric-card">
            <span className="section-label">Average Points</span>
            <strong>
              {enrichedPoints.length > 0
                ? Math.round((totalPoints / enrichedPoints.length) * 10) / 10
                : 0}
            </strong>
            <p>Per team member</p>
          </div>
        </div>
      </section>

      {/* Top Performers */}
      {topPerformers.length > 0 && (
        <section className="panel" style={{ marginBottom: '2rem' }}>
          <header className="panel-header">
            <div>
              <h2>Top Performers</h2>
              <p>Top 10 team members by KPI points</p>
            </div>
          </header>
          <div className="kpi-leaderboard">
            {topPerformers.map((point, index) => (
              <div
                key={point.id}
                className={`kpi-leaderboard-item ${index < 3 ? 'kpi-leaderboard-top' : ''}`}
              >
                <div className="kpi-rank">
                  {index === 0 && <span className="kpi-medal">🥇</span>}
                  {index === 1 && <span className="kpi-medal">🥈</span>}
                  {index === 2 && <span className="kpi-medal">🥉</span>}
                  {index >= 3 && <span className="kpi-rank-number">#{index + 1}</span>}
                </div>
                <div className="kpi-user-info">
                  <div className="kpi-user-name">{point.displayName}</div>
                  <div className="kpi-user-meta">
                    <span>{point.department}</span>
                    <span className="kpi-separator">•</span>
                    <span>{point.role}</span>
                  </div>
                </div>
                <div className="kpi-points">
                  <strong>{point.points}</strong>
                  <span className="kpi-points-label">points</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Full Leaderboard */}
      <section className="panel">
        <header className="panel-header">
          <div>
            <h2>Full Leaderboard</h2>
            <p>Complete list of all team members sorted by points</p>
          </div>
        </header>
        {enrichedPoints.length === 0 ? (
          <div className="empty-state">
            <p>No KPI points have been awarded yet.</p>
            <p>Points are awarded when calendar updates are completed.</p>
          </div>
        ) : (
          <div className="kpi-table-container">
            <table className="kpi-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Role</th>
                  <th>Points</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {enrichedPoints.map((point, index) => (
                  <tr key={point.id}>
                    <td className="kpi-rank-cell">
                      {index === 0 && <span className="kpi-medal-small">🥇</span>}
                      {index === 1 && <span className="kpi-medal-small">🥈</span>}
                      {index === 2 && <span className="kpi-medal-small">🥉</span>}
                      {index >= 3 && <span>#{index + 1}</span>}
                    </td>
                    <td className="kpi-name-cell">
                      <strong>{point.displayName}</strong>
                    </td>
                    <td>{point.department}</td>
                    <td>{point.role}</td>
                    <td className="kpi-points-cell">
                      <strong>{point.points}</strong>
                    </td>
                    <td className="kpi-date-cell">
                      {point.lastUpdated
                        ? new Date(point.lastUpdated).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Department Breakdown */}
      {Object.keys(pointsByDepartment).length > 0 && (
        <section className="panel" style={{ marginTop: '2rem' }}>
          <header className="panel-header">
            <div>
              <h2>Department Breakdown</h2>
              <p>Points distribution by department</p>
            </div>
          </header>
          <div className="kpi-departments-grid">
            {Object.entries(pointsByDepartment)
              .sort(([a], [b]) => {
                const totalA = a
                  ? pointsByDepartment[a].reduce((sum, p) => sum + p.points, 0)
                  : 0
                const totalB = b
                  ? pointsByDepartment[b].reduce((sum, p) => sum + p.points, 0)
                  : 0
                return totalB - totalA
              })
              .map(([department, points]) => {
                const deptTotal = points.reduce((sum, p) => sum + p.points, 0)
                const deptAvg =
                  points.length > 0 ? Math.round((deptTotal / points.length) * 10) / 10 : 0
                return (
                  <div key={department} className="kpi-department-card">
                    <h3>{department}</h3>
                    <div className="kpi-department-stats">
                      <div>
                        <span className="section-label">Total Points</span>
                        <strong>{deptTotal}</strong>
                      </div>
                      <div>
                        <span className="section-label">Members</span>
                        <strong>{points.length}</strong>
                      </div>
                      <div>
                        <span className="section-label">Average</span>
                        <strong>{deptAvg}</strong>
                      </div>
                    </div>
                    <div className="kpi-department-members">
                      {points
                        .sort((a, b) => b.points - a.points)
                        .slice(0, 5)
                        .map((point) => (
                          <div key={point.id} className="kpi-department-member">
                            <span>{point.displayName}</span>
                            <strong>{point.points} pts</strong>
                          </div>
                        ))}
                    </div>
                  </div>
                )
              })}
          </div>
        </section>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true">
            <header className="modal-header">
              <div>
                <h2>⚠️ Reset All KPI Points</h2>
                <p>This action will permanently reset all user KPI points to zero.</p>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setShowResetConfirm(false)
                  setResetError(null)
                }}
                disabled={isResetting}
              >
                Close
              </button>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
              <div style={{ 
                padding: '1rem', 
                background: '#fee',
                border: '1px solid #fcc',
                borderRadius: '0.75rem',
                color: '#c33'
              }}>
                <strong>⚠️ Warning:</strong> This action cannot be undone!
              </div>

              <div style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
                <p><strong>This will:</strong></p>
                <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                  <li>Set all user KPI points to 0</li>
                  <li>Create audit trail records for the reset</li>
                  <li>Affect {enrichedPoints.length} user{enrichedPoints.length !== 1 ? 's' : ''}</li>
                  <li>Remove a total of {totalPoints} point{totalPoints !== 1 ? 's' : ''}</li>
                </ul>
                <p style={{ marginTop: '1rem' }}>
                  <strong>Use this feature to:</strong>
                </p>
                <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                  <li>Start a new performance period (e.g., new quarter/year)</li>
                  <li>Clear test data</li>
                  <li>Reset after system changes</li>
                </ul>
              </div>

              {resetError && (
                <div style={{ 
                  padding: '1rem', 
                  background: '#fee',
                  border: '1px solid #fcc',
                  borderRadius: '0.75rem',
                  color: '#c33',
                  fontSize: '0.9rem'
                }}>
                  <strong>Error:</strong> {resetError}
                </div>
              )}

              <div style={{ 
                padding: '1rem', 
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border-soft)',
                borderRadius: '0.75rem',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)'
              }}>
                💡 <strong>Tip:</strong> All reset operations are logged in the KPI Point History for audit purposes.
              </div>
            </div>

            <footer className="modal-footer">
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setShowResetConfirm(false)
                  setResetError(null)
                }}
                disabled={isResetting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetKPI}
                disabled={isResetting}
                className="primary-button"
                style={{ 
                  background: '#d1434c',
                  borderColor: '#d1434c'
                }}
              >
                {isResetting ? 'Resetting...' : 'Yes, Reset All Points'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}

export default KPIPointsPage
