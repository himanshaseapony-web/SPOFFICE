import { useState } from 'react'

type DatePickerCalendarProps = {
  selectedDates: string[]
  onDatesChange: (dates: string[]) => void
  minDate?: string // YYYY-MM-DD format
  maxDate?: string // YYYY-MM-DD format
}

export function DatePickerCalendar({
  selectedDates,
  onDatesChange,
  minDate,
  maxDate,
}: DatePickerCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Get first day of month and number of days
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPreviousMonth = new Date(year, month, 0).getDate()

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

  // Check if date is selected
  const isDateSelected = (dateString: string): boolean => {
    return selectedDates.includes(dateString)
  }

  // Check if date is disabled (past dates or outside min/max range)
  const isDateDisabled = (dateString: string): boolean => {
    const date = new Date(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Disable past dates
    if (date < today) return true
    
    // Check min date
    if (minDate) {
      const min = new Date(minDate)
      min.setHours(0, 0, 0, 0)
      if (date < min) return true
    }
    
    // Check max date
    if (maxDate) {
      const max = new Date(maxDate)
      max.setHours(0, 0, 0, 0)
      if (date > max) return true
    }
    
    return false
  }

  // Toggle date selection
  const handleDateClick = (dateString: string) => {
    if (isDateDisabled(dateString)) return

    const isSelected = isDateSelected(dateString)
    let newDates: string[]

    if (isSelected) {
      // Remove date
      newDates = selectedDates.filter((d) => d !== dateString)
    } else {
      // Add date (keep sorted)
      newDates = [...selectedDates, dateString].sort(
        (a, b) => new Date(a).getTime() - new Date(b).getTime()
      )
    }

    onDatesChange(newDates)
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
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const isToday = (dateString: string) => {
    const today = new Date().toISOString().split('T')[0]
    return dateString === today
  }

  // Clear all selections
  const clearAll = () => {
    onDatesChange([])
  }

  return (
    <div
      style={{
        background: 'var(--surface-default)',
        borderRadius: '0.75rem',
        border: '1px solid var(--border-soft)',
        padding: '1rem',
        maxWidth: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Calendar Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
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
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
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
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="ghost-button"
            onClick={goToToday}
            style={{ fontSize: '0.9rem' }}
          >
            Today
          </button>
          {selectedDates.length > 0 && (
            <button
              type="button"
              className="ghost-button"
              onClick={clearAll}
              style={{ fontSize: '0.9rem', color: '#ef4444', borderColor: '#ef4444' }}
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Selected Dates Count */}
      {selectedDates.length > 0 && (
        <div
          style={{
            marginBottom: '0.75rem',
            padding: '0.5rem 0.75rem',
            background: 'var(--accent-soft)',
            borderRadius: '0.5rem',
            fontSize: '0.85rem',
            color: 'var(--accent)',
            fontWeight: 500,
          }}
        >
          {selectedDates.length} day{selectedDates.length !== 1 ? 's' : ''} selected
        </div>
      )}

      {/* Calendar Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '0.4rem',
          width: '100%',
        }}
      >
        {/* Day Headers */}
        {dayNames.map((day) => (
          <div
            key={day}
            style={{
              padding: '0.5rem 0.25rem',
              textAlign: 'center',
              fontWeight: 600,
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
            }}
          >
            {day}
          </div>
        ))}

        {/* Calendar Days */}
        {calendarDays.map(({ date, isCurrentMonth, dateString }, index) => {
          const isSelected = isDateSelected(dateString)
          const disabled = isDateDisabled(dateString)
          const today = isToday(dateString)

          return (
            <button
              key={`${dateString}-${index}`}
              type="button"
              onClick={() => handleDateClick(dateString)}
              disabled={disabled}
              style={{
                aspectRatio: '1',
                padding: '0.35rem',
                minWidth: 0,
                fontSize: '0.85rem',
                background: isSelected
                  ? 'var(--accent)'
                  : disabled
                    ? 'var(--surface-subtle)'
                    : 'transparent',
                border: `2px solid ${
                  isSelected
                    ? 'var(--accent)'
                    : today
                      ? 'var(--accent)'
                      : disabled
                        ? 'var(--border-soft)'
                        : 'var(--border-soft)'
                }`,
                borderRadius: '0.5rem',
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: disabled
                  ? 'var(--text-muted)'
                  : isSelected
                    ? '#fff'
                    : isCurrentMonth
                      ? 'var(--text-primary)'
                      : 'var(--text-muted)',
                fontWeight: today || isSelected ? 600 : 400,
                transition: 'all 0.2s ease',
                opacity: disabled ? 0.4 : 1,
              }}
              onMouseEnter={(e) => {
                if (!disabled && !isSelected) {
                  e.currentTarget.style.background = 'var(--accent-soft)'
                  e.currentTarget.style.transform = 'scale(1.05)'
                }
              }}
              onMouseLeave={(e) => {
                if (!disabled && !isSelected) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.transform = 'scale(1)'
                }
              }}
            >
              <span>{date}</span>
              {isSelected && (
                <span
                  style={{
                    marginTop: '0.15rem',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                  }}
                >
                  ✓
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected Dates List */}
      {selectedDates.length > 0 && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.75rem',
            background: 'var(--surface-elevated)',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-soft)',
            maxHeight: '150px',
            overflowY: 'auto',
          }}
        >
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 600 }}>
            Selected Dates:
          </h4>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            {selectedDates.map((date) => (
              <div
                key={date}
                style={{
                  padding: '0.5rem 0.75rem',
                  background: 'var(--accent)',
                  color: '#fff',
                  borderRadius: '0.5rem',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span>
                  {new Date(date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => handleDateClick(date)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
