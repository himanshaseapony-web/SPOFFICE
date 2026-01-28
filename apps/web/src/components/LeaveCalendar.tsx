import { useState, useMemo } from 'react'
import type { LeaveRequest } from '../context/AppDataContext'

type LeaveCalendarProps = {
  leaveRequests: LeaveRequest[]
  onDateClick?: (date: string, requests: LeaveRequest[]) => void
}

export function LeaveCalendar({ leaveRequests, onDateClick }: LeaveCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Get first day of month and number of days
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPreviousMonth = new Date(year, month, 0).getDate()

  // Create a map of dates to requests
  const dateToRequestsMap = useMemo(() => {
    const map = new Map<string, LeaveRequest[]>()
    
    leaveRequests.forEach((request) => {
      const days = request.selectedDays && request.selectedDays.length > 0
        ? request.selectedDays
        : request.startDate && request.endDate
          ? generateDateRange(request.startDate, request.endDate)
          : []
      
      days.forEach((day) => {
        const dateKey = day.split('T')[0] // Ensure YYYY-MM-DD format
        if (!map.has(dateKey)) {
          map.set(dateKey, [])
        }
        map.get(dateKey)!.push(request)
      })
    })
    
    return map
  }, [leaveRequests])

  // Generate date range for legacy requests
  function generateDateRange(startDate: string, endDate: string): string[] {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const dates: string[] = []
    
    const current = new Date(start)
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0])
      current.setDate(current.getDate() + 1)
    }
    
    return dates
  }

  // Get requests for a specific date
  const getRequestsForDate = (date: string): LeaveRequest[] => {
    return dateToRequestsMap.get(date) || []
  }

  // Get status color for a date
  const getDateColor = (date: string): { bg: string; border: string; text: string } => {
    const requests = getRequestsForDate(date)
    if (requests.length === 0) return { bg: 'transparent', border: 'transparent', text: 'var(--text-primary)' }
    
    // Priority: Rejected > Approved > Pending
    const hasRejected = requests.some((r) => r.status === 'Rejected')
    const hasApproved = requests.some((r) => r.status === 'Approved')
    const hasPending = requests.some((r) => r.status === 'Pending')
    
    if (hasRejected) {
      return {
        bg: 'rgba(239, 68, 68, 0.15)',
        border: 'rgba(239, 68, 68, 0.4)',
        text: '#ef4444',
      }
    }
    if (hasApproved) {
      return {
        bg: 'rgba(34, 197, 94, 0.15)',
        border: 'rgba(34, 197, 94, 0.4)',
        text: '#22c55e',
      }
    }
    if (hasPending) {
      return {
        bg: 'rgba(62, 99, 221, 0.15)',
        border: 'rgba(62, 99, 221, 0.4)',
        text: 'var(--accent)',
      }
    }
    
    return { bg: 'transparent', border: 'transparent', text: 'var(--text-primary)' }
  }

  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  // Generate calendar days
  const calendarDays: Array<{ date: number; isCurrentMonth: boolean; dateString: string }> = []
  
  // Previous month days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const date = daysInPreviousMonth - i
    const dateString = new Date(year, month - 1, date).toISOString().split('T')[0]
    calendarDays.push({ date, isCurrentMonth: false, dateString })
  }
  
  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const dateString = new Date(year, month, i).toISOString().split('T')[0]
    calendarDays.push({ date: i, isCurrentMonth: true, dateString })
  }
  
  // Next month days to fill the grid
  const remainingDays = 42 - calendarDays.length // 6 rows × 7 days
  for (let i = 1; i <= remainingDays; i++) {
    const dateString = new Date(year, month + 1, i).toISOString().split('T')[0]
    calendarDays.push({ date: i, isCurrentMonth: false, dateString })
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const handleDateClick = (dateString: string) => {
    setSelectedDate(dateString)
    const requests = getRequestsForDate(dateString)
    if (onDateClick) {
      onDateClick(dateString, requests)
    }
  }

  const isToday = (dateString: string) => {
    const today = new Date().toISOString().split('T')[0]
    return dateString === today
  }

  return (
    <div
      style={{
        background: 'var(--surface-default)',
        borderRadius: '0.75rem',
        border: '1px solid var(--border-soft)',
        padding: '1.5rem',
      }}
    >
      {/* Calendar Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            type="button"
            className="ghost-button"
            onClick={goToPreviousMonth}
            style={{ padding: '0.5rem' }}
          >
            ←
          </button>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
            {monthNames[month]} {year}
          </h3>
          <button
            type="button"
            className="ghost-button"
            onClick={goToNextMonth}
            style={{ padding: '0.5rem' }}
          >
            →
          </button>
        </div>
        <button
          type="button"
          className="ghost-button"
          onClick={goToToday}
          style={{ fontSize: '0.9rem' }}
        >
          Today
        </button>
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: '1.5rem',
          marginBottom: '1rem',
          padding: '0.75rem',
          background: 'var(--surface-elevated)',
          borderRadius: '0.5rem',
          fontSize: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '4px',
              background: 'rgba(62, 99, 221, 0.15)',
              border: '1px solid rgba(62, 99, 221, 0.4)',
            }}
          />
          <span style={{ color: 'var(--text-secondary)' }}>Pending</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '4px',
              background: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid rgba(34, 197, 94, 0.4)',
            }}
          />
          <span style={{ color: 'var(--text-secondary)' }}>Approved</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '4px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
            }}
          />
          <span style={{ color: 'var(--text-secondary)' }}>Rejected</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '0.5rem',
        }}
      >
        {/* Day Headers */}
        {dayNames.map((day) => (
          <div
            key={day}
            style={{
              padding: '0.75rem',
              textAlign: 'center',
              fontWeight: 600,
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
            }}
          >
            {day}
          </div>
        ))}

        {/* Calendar Days */}
        {calendarDays.map(({ date, isCurrentMonth, dateString }, index) => {
          const requests = getRequestsForDate(dateString)
          const color = getDateColor(dateString)
          const today = isToday(dateString)
          const isSelected = selectedDate === dateString

          return (
            <button
              key={`${dateString}-${index}`}
              type="button"
              onClick={() => handleDateClick(dateString)}
              style={{
                aspectRatio: '1',
                padding: '0.5rem',
                background: isSelected
                  ? 'var(--accent-soft)'
                  : color.bg,
                border: `2px solid ${
                  isSelected
                    ? 'var(--accent)'
                    : today
                      ? 'var(--accent)'
                      : color.border
                }`,
                borderRadius: '0.5rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                color: isCurrentMonth ? color.text : 'var(--text-muted)',
                fontSize: '0.9rem',
                fontWeight: today ? 600 : 400,
                transition: 'all 0.2s ease',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)'
                e.currentTarget.style.zIndex = '10'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.zIndex = '1'
              }}
            >
              <span>{date}</span>
              {requests.length > 0 && (
                <div
                  style={{
                    marginTop: '0.25rem',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    opacity: 0.8,
                  }}
                >
                  {requests.length}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected Date Details */}
      {selectedDate && (
        <div
          style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: 'var(--surface-elevated)',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-soft)',
          }}
        >
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem' }}>
            {new Date(selectedDate).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </h4>
          {getRequestsForDate(selectedDate).length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No leave or work from home requests for this date.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {getRequestsForDate(selectedDate).map((request) => (
                <div
                  key={request.id}
                  style={{
                    padding: '0.75rem',
                    background: 'var(--surface-default)',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-soft)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                        {request.userName}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {request.type} • {request.department}
                      </div>
                    </div>
                    <span
                      style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '0.5rem',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        ...(request.status === 'Pending'
                          ? {
                              background: 'var(--accent-soft)',
                              color: 'var(--accent)',
                              border: '1px solid var(--accent-subtle)',
                            }
                          : request.status === 'Approved'
                            ? {
                                background: 'rgba(34, 197, 94, 0.1)',
                                color: '#22c55e',
                                border: '1px solid rgba(34, 197, 94, 0.2)',
                              }
                            : {
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: '#ef4444',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                              }),
                      }}
                    >
                      {request.status}
                    </span>
                  </div>
                  {request.reason && (
                    <p style={{ margin: '0.5rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      {request.reason}
                    </p>
                  )}
                  {request.reviewedByName && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                      {request.status === 'Approved' ? 'Approved' : 'Rejected'} by{' '}
                      <strong>{request.reviewedByName}</strong>
                      {request.reviewedAt &&
                        ` on ${new Date(request.reviewedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}`}
                    </div>
                  )}
                  {request.rejectionReason && (
                    <div
                      style={{
                        marginTop: '0.5rem',
                        padding: '0.5rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        borderRadius: '0.25rem',
                        fontSize: '0.85rem',
                        color: '#ef4444',
                      }}
                    >
                      <strong>Reason:</strong> {request.rejectionReason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
