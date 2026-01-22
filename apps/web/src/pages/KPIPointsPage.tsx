import { useMemo, useState } from 'react'
import { useAppData } from '../context/AppDataContext'
import { useAuth } from '../context/AuthContext'
import { resetAllKPIPoints } from '../lib/kpi'

export function KPIPointsPage() {
  const { kpiPoints, allUserProfiles, firestore, userProfile } = useAppData()
  const { user } = useAuth()
  const [isResetting, setIsResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [selectedDepartment, setSelectedDepartment] = useState<string>('Programming')

  // Only show the three standard departments
  const departments = useMemo(() => {
    return ['Programming', '3D Development', 'UI/UX']
  }, [])

  // Enrich KPI points with user profile data
  const enrichedPoints = useMemo(() => {
    return kpiPoints
      .filter((point) => point.points > 0) // Only include users with points > 0
      .map((point) => {
        const profile = allUserProfiles.find((p) => p.id === point.userId)
        return {
          ...point,
          role: profile?.role || 'Unknown',
          displayName: profile?.displayName || point.userName,
        }
      })
  }, [kpiPoints, allUserProfiles])

  // Group by department and sort by score
  const pointsByDepartment = useMemo(() => {
    const grouped: Record<string, typeof enrichedPoints> = {}
    
    enrichedPoints.forEach((point) => {
      const dept = point.department
      if (!grouped[dept]) {
        grouped[dept] = []
      }
      grouped[dept].push(point)
    })

    // Sort each department's users by score descending
    Object.keys(grouped).forEach(dept => {
      grouped[dept].sort((a, b) => b.score - a.score)
    })

    return grouped
  }, [enrichedPoints])

  // Get current department leaderboard
  const currentLeaderboard = pointsByDepartment[selectedDepartment] || []

  // Calculate department stats
  const departmentStats = useMemo(() => {
    return Object.entries(pointsByDepartment).map(([dept, users]) => ({
      department: dept,
      totalUsers: users.length,
      totalPoints: users.reduce((sum, u) => sum + u.effectivePoints, 0),
      totalTasks: users.reduce((sum, u) => sum + u.tasksAssigned, 0),
      avgScore: users.length > 0 
        ? users.reduce((sum, u) => sum + u.score, 0) / users.length 
        : 0,
    }))
  }, [pointsByDepartment])

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
          <h1>KPI Points - Department Leaderboards</h1>
          <p>Track performance by department with deadline-based scoring</p>
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

      {/* Department Stats Overview */}
      {departmentStats.length > 0 && (
        <section className="panel" style={{ marginBottom: '2rem' }}>
          <div className="metrics-grid">
            {departmentStats.map(stat => (
              <div key={stat.department} className="metric-card">
                <span className="section-label">{stat.department}</span>
                <strong>{stat.totalUsers}</strong>
                <p>{stat.totalUsers === 1 ? 'participant' : 'participants'}</p>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  Avg Score: {stat.avgScore.toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Department Tabs */}
      <section className="panel">
        <div className="settings-tabs" style={{ marginBottom: '1.5rem' }}>
          {departments.map(dept => (
            <button
              key={dept}
              type="button"
              className={`tab-button ${selectedDepartment === dept ? 'active' : ''}`}
              onClick={() => setSelectedDepartment(dept)}
            >
              🏆 {dept}
            </button>
          ))}
        </div>

        {/* Current Department Leaderboard */}
        <div>
          <header className="panel-header" style={{ marginBottom: '1.5rem' }}>
            <div>
              <h2>{selectedDepartment} Leaderboard</h2>
              <p>
                {currentLeaderboard.length} {currentLeaderboard.length === 1 ? 'participant' : 'participants'}
                {currentLeaderboard.length > 0 && ` • Legend: ✅ On-time  ⚠️ Late  ❌ Incomplete`}
              </p>
            </div>
          </header>

          {currentLeaderboard.length === 0 ? (
            <div className="empty-state">
              <p>No KPI points in {selectedDepartment} yet.</p>
              <p>Points are awarded when calendar updates are completed.</p>
            </div>
          ) : (
            <div className="kpi-leaderboard">
              {currentLeaderboard.map((point, index) => {
                const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`
                const isTopThree = index < 3

                return (
                  <div
                    key={point.id}
                    className={`kpi-leaderboard-item ${isTopThree ? 'kpi-leaderboard-top' : ''}`}
                  >
                    <div className="kpi-rank">
                      <span className={isTopThree ? 'kpi-medal' : 'kpi-rank-number'}>
                        {rankEmoji}
                      </span>
                    </div>

                    <div className="kpi-user-info">
                      <div className="kpi-user-name">{point.displayName}</div>
                      <div className="kpi-user-meta">
                        <span>{point.role}</span>
                      </div>
                    </div>

                    <div className="kpi-task-breakdown">
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <span title="Completed on time">
                          ✅ {point.tasksCompletedOnTime}
                        </span>
                        <span title="Completed late">
                          ⚠️ {point.tasksCompletedLate}
                        </span>
                        <span title="Not completed">
                          ❌ {point.tasksIncomplete}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          / {point.tasksAssigned} total
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        Effective: {point.effectivePoints.toFixed(1)} points
                      </div>
                    </div>

                    <div className="kpi-points">
                      <strong style={{ fontSize: '1.8rem' }}>{Math.round(point.score)}%</strong>
                      <span className="kpi-points-label">score</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Full Details Table */}
      {currentLeaderboard.length > 0 && (
        <section className="panel" style={{ marginTop: '2rem' }}>
          <header className="panel-header">
            <div>
              <h2>Detailed Breakdown - {selectedDepartment}</h2>
              <p>Complete task statistics for all participants</p>
            </div>
          </header>
          
          <div className="kpi-table-container">
            <table className="kpi-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Name</th>
                  <th>Score</th>
                  <th>On-Time</th>
                  <th>Late</th>
                  <th>Incomplete</th>
                  <th>Total</th>
                  <th>Effective</th>
                </tr>
              </thead>
              <tbody>
                {currentLeaderboard.map((point, index) => (
                  <tr key={point.id}>
                    <td className="kpi-rank-cell">
                      {index === 0 && <span className="kpi-medal-small">🥇</span>}
                      {index === 1 && <span className="kpi-medal-small">🥈</span>}
                      {index === 2 && <span className="kpi-medal-small">🥉</span>}
                      {index >= 3 && <span>#{index + 1}</span>}
                    </td>
                    <td className="kpi-name-cell">
                      <strong>{point.displayName}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {point.role}
                      </div>
                    </td>
                    <td className="kpi-points-cell">
                      <strong>{Math.round(point.score)}%</strong>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ color: '#2b8a59' }}>✅ {point.tasksCompletedOnTime}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ color: '#c45a14' }}>⚠️ {point.tasksCompletedLate}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ color: '#d1434c' }}>❌ {point.tasksIncomplete}</span>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: '600' }}>
                      {point.tasksAssigned}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {point.effectivePoints.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ 
            marginTop: '1rem', 
            padding: '1rem', 
            background: 'var(--surface-subtle)', 
            borderRadius: '0.75rem',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)'
          }}>
            <strong>Scoring System:</strong>
            <ul style={{ margin: '0.5rem 0 0 1.5rem', lineHeight: '1.6' }}>
              <li>✅ On-time completion: <strong>1.0 point</strong> (full credit)</li>
              <li>⚠️ Late completion: <strong>0.5 points</strong> (50% penalty)</li>
              <li>❌ Incomplete: <strong>0.0 points</strong> (no credit)</li>
              <li>Score = (Effective Points / Total Assigned) × 100</li>
            </ul>
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
                  <li>Reset all task counts to 0</li>
                  <li>Create audit trail records for the reset</li>
                  <li>Affect {enrichedPoints.length} user{enrichedPoints.length !== 1 ? 's' : ''} across all departments</li>
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
