import { useMemo } from 'react'
import type { LeaveRequest } from '../context/AppDataContext'
import { useAuth } from '../context/AuthContext'
import { getQuotaPeriod, calculateQuotaUsage } from '../lib/leaveQuota'

type LeaveQuotaTrackerProps = {
  leaveRequests: LeaveRequest[]
}

export function LeaveQuotaTracker({ leaveRequests }: LeaveQuotaTrackerProps) {
  const { user } = useAuth()

  // Calculate the current quota period (25th of current month to 25th of next month)
  const quotaPeriod = useMemo(() => getQuotaPeriod(), [])

  // Count approved requests in the current period
  const quotaUsage = useMemo(() => {
    if (!user) return { leave: 0, wfh: 0 }
    return calculateQuotaUsage(leaveRequests, user.uid)
  }, [leaveRequests, user])

  const maxLeave = 2 // 2 days of leave per period
  const maxWFH = 2 // 2 days of WFH per period
  const leaveRemaining = Math.max(0, maxLeave - quotaUsage.leave)
  const wfhRemaining = Math.max(0, maxWFH - quotaUsage.wfh)

  // Export quota info for validation (used in LeaveRequestsPage)
  // This will be accessed via a ref or context if needed

  const formatPeriod = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const getProgressColor = (used: number, max: number) => {
    const percentage = (used / max) * 100
    if (percentage >= 100) return '#ef4444' // Red - exceeded
    if (percentage >= 75) return '#f59e0b' // Orange - warning
    return '#22c55e' // Green - good
  }

  const getProgressPercentage = (used: number, max: number) => {
    return Math.min(100, (used / max) * 100)
  }

  if (!user) return null

  return (
    <section className="panel" style={{ position: 'sticky', top: '1rem' }}>
      <header className="panel-header">
        <div>
          <h2>Leave & WFH Quota</h2>
          <p style={{ fontSize: '0.85rem' }}>
            {formatPeriod(quotaPeriod.start)} - {formatPeriod(quotaPeriod.end)}
          </p>
        </div>
      </header>

      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Leave Quota */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.75rem',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🏖️</span>
                <span>Leave Requests</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {quotaUsage.leave} of {maxLeave} day{maxLeave > 1 ? 's' : ''} used
              </div>
            </div>
            <div
              style={{
                fontSize: '2rem',
                fontWeight: 700,
                color: getProgressColor(quotaUsage.leave, maxLeave),
                minWidth: '50px',
                textAlign: 'right',
              }}
            >
              {leaveRemaining}
            </div>
          </div>
          <div
            style={{
              width: '100%',
              height: '8px',
              background: 'var(--surface-elevated)',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${getProgressPercentage(quotaUsage.leave, maxLeave)}%`,
                height: '100%',
                background: getProgressColor(quotaUsage.leave, maxLeave),
                borderRadius: '4px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          {quotaUsage.leave >= maxLeave && (
            <div
              style={{
                marginTop: '0.5rem',
                padding: '0.5rem',
                background: 'rgba(239, 68, 68, 0.1)',
                borderRadius: '0.5rem',
                fontSize: '0.8rem',
                color: '#ef4444',
              }}
            >
              ⚠️ Quota reached
            </div>
          )}
        </div>

        {/* WFH Quota */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.75rem',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🏠</span>
                <span>Work From Home</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {quotaUsage.wfh} of {maxWFH} day{maxWFH > 1 ? 's' : ''} used
              </div>
            </div>
            <div
              style={{
                fontSize: '2rem',
                fontWeight: 700,
                color: getProgressColor(quotaUsage.wfh, maxWFH),
                minWidth: '50px',
                textAlign: 'right',
              }}
            >
              {wfhRemaining}
            </div>
          </div>
          <div
            style={{
              width: '100%',
              height: '8px',
              background: 'var(--surface-elevated)',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${getProgressPercentage(quotaUsage.wfh, maxWFH)}%`,
                height: '100%',
                background: getProgressColor(quotaUsage.wfh, maxWFH),
                borderRadius: '4px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          {quotaUsage.wfh >= maxWFH && (
            <div
              style={{
                marginTop: '0.5rem',
                padding: '0.5rem',
                background: 'rgba(239, 68, 68, 0.1)',
                borderRadius: '0.5rem',
                fontSize: '0.8rem',
                color: '#ef4444',
              }}
            >
              ⚠️ Quota reached
            </div>
          )}
        </div>

        {/* Summary */}
        <div
          style={{
            padding: '0.75rem',
            background: 'var(--surface-elevated)',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-soft)',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Quota Period</div>
          <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            You can request up to <strong>{maxLeave} days of leave</strong> and{' '}
            <strong>{maxWFH} days of work from home</strong> during this period.
          </div>
        </div>
      </div>
    </section>
  )
}
