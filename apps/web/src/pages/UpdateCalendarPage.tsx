import { useState, useMemo, useEffect } from 'react'
import { useAppData } from '../context/AppDataContext'
import { useAuth } from '../context/AuthContext'
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, Timestamp, updateDoc } from 'firebase/firestore'

type Assignee = {
  name: string
  id: string
  department: string
}

type CalendarUpdate = {
  id: string
  month: string // e.g., "January", "February", etc.
  year: number
  deadline: string // ISO date string (legacy - fallback)
  departmentDeadlines?: Record<string, string> // Department name -> ISO datetime string
  taskDetails: string
  assignees: Assignee[] // Multiple assignees with departments
  createdBy: string
  createdByName: string
  createdAt: string
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export function UpdateCalendarPage() {
  const { allUserProfiles, userProfile, firestore } = useAppData()
  const { user } = useAuth()
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [calendarUpdates, setCalendarUpdates] = useState<CalendarUpdate[]>([])
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const [selectedAssignees, setSelectedAssignees] = useState<Assignee[]>([])
  const [editingDeadline, setEditingDeadline] = useState<{ updateId: string; department: string } | null>(null)
  const [departmentDeadlines, setDepartmentDeadlines] = useState<Record<string, { date: string; time: string }>>({})

  // Load calendar updates from Firestore
  useEffect(() => {
    if (!firestore) return

    const updatesRef = collection(firestore, 'calendarUpdates')
    const updatesQuery = query(updatesRef)

    const unsubscribe = onSnapshot(
      updatesQuery,
      (snapshot) => {
        const updates = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data()
          
          // Handle both old and new data structures
          let assignees: Assignee[] = []
          if (data.assignees && Array.isArray(data.assignees)) {
            assignees = data.assignees
          } else if (data.assignedPerson && data.assignedPersonId && data.department) {
            // Legacy single assignee format
            assignees = [{
              name: data.assignedPerson,
              id: data.assignedPersonId,
              department: data.department,
            }]
          }
          
          return {
            id: docSnapshot.id,
            month: data.month ?? '',
            year: data.year ?? currentYear,
            deadline: data.deadline ?? '',
            departmentDeadlines: data.departmentDeadlines ?? undefined,
            taskDetails: data.taskDetails ?? '',
            assignees,
            createdBy: data.createdBy ?? '',
            createdByName: data.createdByName ?? '',
            createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
          } as CalendarUpdate
        })
        setCalendarUpdates(updates)
      },
      (err) => {
        console.error('Failed to load calendar updates:', err)
      }
    )

    return () => unsubscribe()
  }, [firestore, currentYear])

  // Group updates by month and year
  const updatesByMonth = useMemo(() => {
    const grouped: Record<string, CalendarUpdate[]> = {}
    MONTHS.forEach((month) => {
      const key = `${month}-${selectedYear}`
      grouped[key] = calendarUpdates.filter(
        (update) => update.month === month && update.year === selectedYear
      )
    })
    return grouped
  }, [calendarUpdates, selectedYear])

  const toggleMonthExpanded = (month: string) => {
    setExpandedMonths((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(month)) {
        newSet.delete(month)
      } else {
        newSet.add(month)
      }
      return newSet
    })
  }

  const handleOpenCreate = (month: string) => {
    setSelectedMonth(month)
    setSelectedAssignees([])
    setIsCreateOpen(true)
    setError(null)
  }

  const handleCloseCreate = () => {
    setIsCreateOpen(false)
    setSelectedMonth('')
    setSelectedAssignees([])
    setDepartmentDeadlines({})
    setError(null)
  }

  const handleOpenEditDeadline = (updateId: string, department: string, currentDeadline?: string) => {
    setEditingDeadline({ updateId, department })
    if (currentDeadline) {
      const date = new Date(currentDeadline)
      const dateStr = date.toISOString().split('T')[0]
      const timeStr = date.toTimeString().slice(0, 5) // HH:MM format
      setDepartmentDeadlines({
        [department]: { date: dateStr, time: timeStr }
      })
    } else {
      // Default to tomorrow at 5 PM
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const dateStr = tomorrow.toISOString().split('T')[0]
      setDepartmentDeadlines({
        [department]: { date: dateStr, time: '17:00' }
      })
    }
  }

  const handleCloseEditDeadline = () => {
    setEditingDeadline(null)
    setDepartmentDeadlines({})
    setError(null)
  }

  const handleUpdateDeadline = async (updateId: string, department: string) => {
    if (!firestore || !user) return

    const deadlineData = departmentDeadlines[department]
    if (!deadlineData || !deadlineData.date || !deadlineData.time) {
      setError('Please provide both date and time for the deadline.')
      return
    }

    // Combine date and time into ISO string
    const deadlineDateTime = new Date(`${deadlineData.date}T${deadlineData.time}`)
    if (isNaN(deadlineDateTime.getTime())) {
      setError('Invalid date or time. Please check your input.')
      return
    }

    const deadlineISO = deadlineDateTime.toISOString()

    setIsSubmitting(true)
    setError(null)

    try {
      const updateRef = doc(firestore, 'calendarUpdates', updateId)
      const updateData: any = {
        updatedAt: Timestamp.now(),
      }

      // Get current update to merge department deadlines
      const currentUpdate = calendarUpdates.find(u => u.id === updateId)
      if (currentUpdate) {
        const existingDeadlines = currentUpdate.departmentDeadlines || {}
        updateData.departmentDeadlines = {
          ...existingDeadlines,
          [department]: deadlineISO,
        }
      } else {
        updateData.departmentDeadlines = {
          [department]: deadlineISO,
        }
      }

      await updateDoc(updateRef, updateData)
      handleCloseEditDeadline()
    } catch (err: any) {
      console.error('Failed to update deadline:', err)
      let errorMessage = 'Failed to update deadline. Please try again.'
      if (err.code === 'permission-denied') {
        errorMessage = 'Permission denied. Check your role permissions.'
      }
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const addAssignee = (profile: typeof allUserProfiles[0]) => {
    if (!selectedAssignees.some((a) => a.id === profile.id)) {
      setSelectedAssignees([
        ...selectedAssignees,
        {
          name: profile.displayName,
          id: profile.id,
          department: profile.department,
        },
      ])
    }
  }

  const removeAssignee = (assigneeId: string) => {
    setSelectedAssignees(selectedAssignees.filter((a) => a.id !== assigneeId))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!firestore || !user || !userProfile) {
      setError('Unable to create update. Please ensure you are logged in.')
      return
    }

    const formData = new FormData(event.currentTarget)
    const taskDetails = (formData.get('taskDetails') as string)?.trim() ?? ''

    // Validation
    if (!taskDetails) {
      setError('Task details are required.')
      return
    }
    if (selectedAssignees.length === 0) {
      setError('At least one assignee is required.')
      return
    }

    // Build department deadlines from form data
    const deptDeadlines: Record<string, string> = {}
    const departments = [...new Set(selectedAssignees.map(a => a.department))]
    
    for (const dept of departments) {
      const dateInput = formData.get(`deadline-date-${dept}`) as string
      const timeInput = formData.get(`deadline-time-${dept}`) as string
      
      if (dateInput && timeInput) {
        const deadlineDateTime = new Date(`${dateInput}T${timeInput}`)
        if (!isNaN(deadlineDateTime.getTime())) {
          deptDeadlines[dept] = deadlineDateTime.toISOString()
        }
      }
    }

    if (Object.keys(deptDeadlines).length === 0) {
      setError('At least one department deadline is required.')
      return
    }

    // Use the earliest deadline as the main deadline for backward compatibility
    const earliestDeadline = Object.values(deptDeadlines).sort()[0]

    setIsSubmitting(true)

    try {
      await addDoc(collection(firestore, 'calendarUpdates'), {
        month: selectedMonth,
        year: selectedYear,
        deadline: earliestDeadline, // Legacy field for backward compatibility
        departmentDeadlines: deptDeadlines,
        taskDetails,
        assignees: selectedAssignees,
        createdBy: user.uid,
        createdByName: userProfile.displayName,
        createdAt: Timestamp.now(),
      })

      // Reset form and close modal
      event.currentTarget.reset()
      handleCloseCreate()
    } catch (err: any) {
      console.error('Failed to create calendar update:', err)
      let errorMessage = 'Failed to create update. Please try again.'
      if (err.code === 'permission-denied') {
        errorMessage = 'Permission denied. Check your role permissions.'
      }
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (updateId: string) => {
    if (!firestore) return
    if (!confirm('Are you sure you want to delete this update?')) return

    try {
      await deleteDoc(doc(firestore, 'calendarUpdates', updateId))
    } catch (err) {
      console.error('Failed to delete update:', err)
      alert('Failed to delete update. Please try again.')
    }
  }

  const canEdit = userProfile?.role === 'Admin' || 
                  userProfile?.role === 'Manager' || 
                  userProfile?.role === 'DepartmentHead'

  return (
    <div style={{ padding: '2rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 600, margin: 0, marginBottom: '0.5rem' }}>
              Update Calendar
            </h1>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              Track monthly update deadlines and task assignments across departments
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 500 }}>Year:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.375rem',
                  border: '1px solid var(--border-soft)',
                  background: 'var(--surface-default)',
                  color: 'var(--text-primary)',
                  fontSize: '1rem',
                }}
              >
                {Array.from({ length: 5 }, (_, i) => currentYear - 1 + i).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </header>

      {/* Calendar Grid - 12 Month Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {MONTHS.map((month, index) => {
          const monthKey = `${month}-${selectedYear}`
          const monthUpdates = updatesByMonth[monthKey] || []
          const monthDate = new Date(selectedYear, index, 1)
          const isPastMonth = monthDate < new Date(currentYear, new Date().getMonth(), 1)

          return (
            <div
              key={month}
              className="panel"
              style={{
                minHeight: '280px',
                display: 'flex',
                flexDirection: 'column',
                opacity: isPastMonth ? 0.7 : 1,
              }}
            >
              <header
                className="panel-header"
                style={{
                  borderBottom: '1px solid var(--border-soft)',
                  paddingBottom: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                      {month}
                    </h3>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      {monthUpdates.length} {monthUpdates.length === 1 ? 'update' : 'updates'}
                    </p>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleOpenCreate(month)}
                      style={{
                        padding: '0.5rem 0.875rem',
                        borderRadius: '0.375rem',
                        border: 'none',
                        background: 'var(--accent)',
                        color: 'white',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.background = 'var(--accent-strong)')}
                      onMouseOut={(e) => (e.currentTarget.style.background = 'var(--accent)')}
                    >
                      + Add
                    </button>
                  )}
                </div>
              </header>

              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                {monthUpdates.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
                    <p>No updates scheduled</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {(() => {
                      const monthKey = `${month}-${selectedYear}`
                      const isExpanded = expandedMonths.has(monthKey)
                      const displayUpdates = isExpanded ? monthUpdates : monthUpdates.slice(0, 3)
                      const hasMore = monthUpdates.length > 3

                      return (
                        <>
                          {displayUpdates.map((update) => {
                            // Get the earliest deadline for display (either from departmentDeadlines or legacy deadline)
                            const getEarliestDeadline = () => {
                              if (update.departmentDeadlines && Object.keys(update.departmentDeadlines).length > 0) {
                                const deadlines = Object.values(update.departmentDeadlines).map(d => new Date(d))
                                return deadlines.sort((a, b) => a.getTime() - b.getTime())[0]
                              }
                              return update.deadline ? new Date(update.deadline) : null
                            }
                            
                            const earliestDeadline = getEarliestDeadline()
                            const isOverdue = earliestDeadline && earliestDeadline < new Date() && 
                                            earliestDeadline.toDateString() !== new Date().toDateString()
                            
                            // Group assignees by department
                            const assigneesByDept = update.assignees.reduce((acc, assignee) => {
                              if (!acc[assignee.department]) {
                                acc[assignee.department] = []
                              }
                              acc[assignee.department].push(assignee)
                              return acc
                            }, {} as Record<string, Assignee[]>)
                            
                            return (
                              <div
                                key={update.id}
                                style={{
                                  padding: '1rem',
                                  borderRadius: '0.5rem',
                                  border: `2px solid ${isOverdue ? '#fca5a5' : 'var(--border-soft)'}`,
                                  background: isOverdue ? 'rgba(252, 165, 165, 0.1)' : 'var(--surface-elevated)',
                                }}
                              >
                                {/* Deadline Header - Prominent */}
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '0.75rem',
                                    paddingBottom: '0.5rem',
                                    borderBottom: `1px solid ${isOverdue ? '#fca5a5' : 'var(--border-soft)'}`,
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>📅</span>
                                    <div>
                                      {earliestDeadline ? (
                                        <>
                                          <div
                                            style={{
                                              fontSize: '0.875rem',
                                              fontWeight: 700,
                                              color: isOverdue ? '#dc2626' : 'var(--text-primary)',
                                            }}
                                          >
                                            {earliestDeadline.toLocaleDateString('en-US', {
                                              month: 'short',
                                              day: 'numeric',
                                              year: 'numeric',
                                            })}
                                            {' '}
                                            {earliestDeadline.toLocaleTimeString('en-US', {
                                              hour: 'numeric',
                                              minute: '2-digit',
                                            })}
                                          </div>
                                          {isOverdue && (
                                            <div style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 600 }}>
                                              OVERDUE
                                            </div>
                                          )}
                                        </>
                                      ) : (
                                        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                          No deadline set
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {canEdit && (
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(update.id)}
                                      style={{
                                        padding: '0.375rem 0.75rem',
                                        border: 'none',
                                        background: 'transparent',
                                        color: 'var(--text-muted)',
                                        fontSize: '0.75rem',
                                        cursor: 'pointer',
                                        borderRadius: '0.25rem',
                                        fontWeight: 500,
                                      }}
                                      onMouseOver={(e) => {
                                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
                                        e.currentTarget.style.color = '#dc2626'
                                      }}
                                      onMouseOut={(e) => {
                                        e.currentTarget.style.background = 'transparent'
                                        e.currentTarget.style.color = 'var(--text-muted)'
                                      }}
                                    >
                                      🗑 Delete
                                    </button>
                                  )}
                                </div>

                                {/* Task Details */}
                                <div style={{ marginBottom: '0.75rem' }}>
                                  <div
                                    style={{
                                      fontSize: '0.7rem',
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.05em',
                                      color: 'var(--text-muted)',
                                      marginBottom: '0.35rem',
                                      fontWeight: 600,
                                    }}
                                  >
                                    Task Details
                                  </div>
                                  <p
                                    style={{
                                      margin: 0,
                                      fontSize: '0.875rem',
                                      color: 'var(--text-primary)',
                                      lineHeight: 1.5,
                                    }}
                                  >
                                    {update.taskDetails}
                                  </p>
                                </div>

                                {/* Assignees by Department - Table Style with Deadlines */}
                                <div>
                                  <div
                                    style={{
                                      fontSize: '0.7rem',
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.05em',
                                      color: 'var(--text-muted)',
                                      marginBottom: '0.5rem',
                                      fontWeight: 600,
                                    }}
                                  >
                                    Assigned To & Deadlines
                                  </div>
                                  <div
                                    style={{
                                      border: '1px solid var(--border-soft)',
                                      borderRadius: '0.375rem',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    {Object.entries(assigneesByDept).map(([dept, assignees], idx) => {
                                      const deptDeadline = update.departmentDeadlines?.[dept] 
                                        ? new Date(update.departmentDeadlines[dept])
                                        : (update.deadline ? new Date(update.deadline) : null)
                                      const isDeptOverdue = deptDeadline && deptDeadline < new Date() && 
                                                           deptDeadline.toDateString() !== new Date().toDateString()
                                      const isEditing = editingDeadline?.updateId === update.id && editingDeadline?.department === dept
                                      
                                      return (
                                        <div
                                          key={dept}
                                          style={{
                                            display: 'grid',
                                            gridTemplateColumns: '140px 1fr auto',
                                            borderTop: idx > 0 ? '1px solid var(--border-soft)' : 'none',
                                            background: idx % 2 === 0 ? 'var(--surface-default)' : 'var(--surface-subtle)',
                                          }}
                                        >
                                          <div
                                            style={{
                                              padding: '0.5rem 0.75rem',
                                              fontWeight: 600,
                                              fontSize: '0.75rem',
                                              color: 'var(--accent)',
                                              borderRight: '1px solid var(--border-soft)',
                                              display: 'flex',
                                              alignItems: 'center',
                                            }}
                                          >
                                            {dept}
                                          </div>
                                          <div
                                            style={{
                                              padding: '0.5rem 0.75rem',
                                              fontSize: '0.75rem',
                                              color: 'var(--text-secondary)',
                                              display: 'flex',
                                              flexWrap: 'wrap',
                                              gap: '0.375rem',
                                              alignItems: 'center',
                                            }}
                                          >
                                            {assignees.map((assignee, aIdx) => (
                                              <span key={assignee.id}>
                                                {assignee.name}
                                                {aIdx < assignees.length - 1 && ','}
                                              </span>
                                            ))}
                                          </div>
                                          <div
                                            style={{
                                              padding: '0.5rem 0.75rem',
                                              fontSize: '0.7rem',
                                              color: isDeptOverdue ? '#dc2626' : 'var(--text-secondary)',
                                              display: 'flex',
                                              flexDirection: 'column',
                                              alignItems: 'flex-end',
                                              gap: '0.25rem',
                                              borderLeft: '1px solid var(--border-soft)',
                                              minWidth: '120px',
                                            }}
                                          >
                                            {isEditing ? (
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%' }}>
                                                <input
                                                  type="date"
                                                  value={departmentDeadlines[dept]?.date || ''}
                                                  onChange={(e) => setDepartmentDeadlines({
                                                    ...departmentDeadlines,
                                                    [dept]: { ...departmentDeadlines[dept], date: e.target.value, time: departmentDeadlines[dept]?.time || '17:00' }
                                                  })}
                                                  style={{
                                                    padding: '0.25rem',
                                                    fontSize: '0.7rem',
                                                    border: '1px solid var(--border-soft)',
                                                    borderRadius: '0.25rem',
                                                    width: '100%',
                                                  }}
                                                />
                                                <input
                                                  type="time"
                                                  value={departmentDeadlines[dept]?.time || ''}
                                                  onChange={(e) => setDepartmentDeadlines({
                                                    ...departmentDeadlines,
                                                    [dept]: { ...departmentDeadlines[dept], date: departmentDeadlines[dept]?.date || '', time: e.target.value }
                                                  })}
                                                  style={{
                                                    padding: '0.25rem',
                                                    fontSize: '0.7rem',
                                                    border: '1px solid var(--border-soft)',
                                                    borderRadius: '0.25rem',
                                                    width: '100%',
                                                  }}
                                                />
                                                {error && editingDeadline?.updateId === update.id && editingDeadline?.department === dept && (
                                                  <div style={{
                                                    fontSize: '0.65rem',
                                                    color: '#dc2626',
                                                    padding: '0.25rem',
                                                    background: 'rgba(220, 38, 38, 0.1)',
                                                    borderRadius: '0.25rem',
                                                    width: '100%',
                                                  }}>
                                                    {error}
                                                  </div>
                                                )}
                                                <div style={{ display: 'flex', gap: '0.25rem', width: '100%' }}>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleUpdateDeadline(update.id, dept)}
                                                    disabled={isSubmitting}
                                                    style={{
                                                      flex: 1,
                                                      padding: '0.25rem 0.5rem',
                                                      fontSize: '0.65rem',
                                                      background: 'var(--accent)',
                                                      color: 'white',
                                                      border: 'none',
                                                      borderRadius: '0.25rem',
                                                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                                      opacity: isSubmitting ? 0.6 : 1,
                                                    }}
                                                  >
                                                    Save
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={handleCloseEditDeadline}
                                                    disabled={isSubmitting}
                                                    style={{
                                                      flex: 1,
                                                      padding: '0.25rem 0.5rem',
                                                      fontSize: '0.65rem',
                                                      background: 'transparent',
                                                      color: 'var(--text-muted)',
                                                      border: '1px solid var(--border-soft)',
                                                      borderRadius: '0.25rem',
                                                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                                    }}
                                                  >
                                                    Cancel
                                                  </button>
                                                </div>
                                              </div>
                                            ) : (
                                              <>
                                                {deptDeadline ? (
                                                  <>
                                                    <div style={{ fontWeight: 600 }}>
                                                      {deptDeadline.toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                      })}
                                                    </div>
                                                    <div style={{ fontSize: '0.65rem' }}>
                                                      {deptDeadline.toLocaleTimeString('en-US', {
                                                        hour: 'numeric',
                                                        minute: '2-digit',
                                                      })}
                                                    </div>
                                                    {isDeptOverdue && (
                                                      <div style={{ fontSize: '0.6rem', color: '#dc2626', fontWeight: 600 }}>
                                                        OVERDUE
                                                      </div>
                                                    )}
                                                  </>
                                                ) : (
                                                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                                    No deadline
                                                  </div>
                                                )}
                                                {canEdit && (
                                                  <button
                                                    type="button"
                                                    onClick={() => handleOpenEditDeadline(update.id, dept, update.departmentDeadlines?.[dept] || update.deadline)}
                                                    style={{
                                                      marginTop: '0.25rem',
                                                      padding: '0.25rem 0.5rem',
                                                      fontSize: '0.65rem',
                                                      background: 'transparent',
                                                      color: 'var(--accent)',
                                                      border: '1px solid var(--accent)',
                                                      borderRadius: '0.25rem',
                                                      cursor: 'pointer',
                                                      fontWeight: 500,
                                                    }}
                                                    onMouseOver={(e) => {
                                                      e.currentTarget.style.background = 'var(--accent-soft)'
                                                    }}
                                                    onMouseOut={(e) => {
                                                      e.currentTarget.style.background = 'transparent'
                                                    }}
                                                  >
                                                    {deptDeadline ? 'Edit' : 'Set'}
                                                  </button>
                                                )}
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                          
                          {/* Show More/Less Button */}
                          {hasMore && (
                            <button
                              type="button"
                              onClick={() => toggleMonthExpanded(monthKey)}
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px dashed var(--border-soft)',
                                background: 'transparent',
                                color: 'var(--accent)',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                borderRadius: '0.375rem',
                                transition: 'all 0.2s',
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.background = 'var(--accent-soft)'
                                e.currentTarget.style.borderStyle = 'solid'
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.background = 'transparent'
                                e.currentTarget.style.borderStyle = 'dashed'
                              }}
                            >
                              {isExpanded
                                ? '▲ Show Less'
                                : `▼ Show ${monthUpdates.length - 3} More`}
                            </button>
                          )}
                        </>
                      )
                    })()}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Create Update Modal */}
      {isCreateOpen && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true">
            <header className="modal-header">
              <div>
                <h2>Add Update for {selectedMonth}</h2>
                <p>Schedule a deadline and assign task for {selectedMonth} {selectedYear}</p>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={handleCloseCreate}
                disabled={isSubmitting}
              >
                Close
              </button>
            </header>
            <form className="modal-form" onSubmit={handleSubmit}>
              <label>
                <span>Task Details</span>
                <textarea
                  name="taskDetails"
                  rows={3}
                  placeholder="Describe what needs to be updated or completed"
                  required
                />
              </label>

              <div>
                <label style={{ marginBottom: '0.5rem' }}>
                  <span>Assignees ({selectedAssignees.length})</span>
                </label>
                
                {/* Selected Assignees */}
                {selectedAssignees.length > 0 && (
                  <div
                    style={{
                      marginBottom: '0.75rem',
                      padding: '0.75rem',
                      border: '1px solid var(--border-soft)',
                      borderRadius: '0.5rem',
                      background: 'var(--surface-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {selectedAssignees.map((assignee) => (
                        <div
                          key={assignee.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.5rem',
                            background: 'var(--surface-default)',
                            borderRadius: '0.375rem',
                            fontSize: '0.875rem',
                          }}
                        >
                          <div>
                            <strong>{assignee.name}</strong>
                            <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                              ({assignee.department})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAssignee(assignee.id)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              border: 'none',
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#dc2626',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              borderRadius: '0.25rem',
                              fontWeight: 500,
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add Assignee Dropdown */}
                <select
                  value=""
                  onChange={(e) => {
                    const profile = allUserProfiles.find((p) => p.id === e.target.value)
                    if (profile) {
                      addAssignee(profile)
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.75rem',
                    border: '1px solid var(--border-soft)',
                    background: 'var(--surface-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                >
                  <option value="">+ Add assignee...</option>
                  {allUserProfiles
                    .filter((profile) => !selectedAssignees.some((a) => a.id === profile.id))
                    .map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.displayName} - {profile.department}
                      </option>
                    ))}
                </select>
                
                {selectedAssignees.length === 0 && (
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                    Add at least one assignee to this update
                  </small>
                )}
              </div>

              {/* Department Deadlines Section */}
              {selectedAssignees.length > 0 && (
                <div>
                  <label style={{ marginBottom: '0.5rem' }}>
                    <span>Department Deadlines</span>
                  </label>
                  <div
                    style={{
                      border: '1px solid var(--border-soft)',
                      borderRadius: '0.5rem',
                      overflow: 'hidden',
                      background: 'var(--surface-subtle)',
                    }}
                  >
                    {[...new Set(selectedAssignees.map(a => a.department))].map((dept, idx) => {
                      const defaultDate = new Date()
                      defaultDate.setDate(defaultDate.getDate() + 7) // Default to 7 days from now
                      const defaultDateStr = defaultDate.toISOString().split('T')[0]
                      const defaultTimeStr = '17:00'
                      
                      return (
                        <div
                          key={dept}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '140px 1fr 1fr',
                            gap: '0.75rem',
                            padding: '0.75rem',
                            borderTop: idx > 0 ? '1px solid var(--border-soft)' : 'none',
                            background: idx % 2 === 0 ? 'var(--surface-default)' : 'var(--surface-subtle)',
                            alignItems: 'center',
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: '0.875rem',
                              color: 'var(--accent)',
                            }}
                          >
                            {dept}
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Date
                            </label>
                            <input
                              name={`deadline-date-${dept}`}
                              type="date"
                              defaultValue={defaultDateStr}
                              required
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid var(--border-soft)',
                                borderRadius: '0.375rem',
                                fontSize: '0.875rem',
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Time
                            </label>
                            <input
                              name={`deadline-time-${dept}`}
                              type="time"
                              defaultValue={defaultTimeStr}
                              required
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid var(--border-soft)',
                                borderRadius: '0.375rem',
                                fontSize: '0.875rem',
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                    Set a deadline date and time for each department. Deadlines can be edited later if needed.
                  </small>
                </div>
              )}

              {error && (
                <div
                  style={{
                    padding: '1rem',
                    background: '#fee',
                    border: '1px solid #fcc',
                    borderRadius: '0.5rem',
                    color: '#c33',
                  }}
                >
                  <strong>Error:</strong> {error}
                </div>
              )}

              <footer className="modal-footer">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={handleCloseCreate}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating...' : 'Create Update'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default UpdateCalendarPage
