import { useState, useMemo, useEffect } from 'react'
import { useAppData } from '../context/AppDataContext'
import { useAuth } from '../context/AuthContext'
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, Timestamp } from 'firebase/firestore'

type Assignee = {
  name: string
  id: string
  department: string
}

type CalendarUpdate = {
  id: string
  month: string // e.g., "January", "February", etc.
  year: number
  deadline: string // ISO date string
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
  const { departments, allUserProfiles, userProfile, firestore } = useAppData()
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
  const [assigneeSearch, setAssigneeSearch] = useState('')

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
    setAssigneeSearch('')
    setIsCreateOpen(true)
    setError(null)
  }

  const handleCloseCreate = () => {
    setIsCreateOpen(false)
    setSelectedMonth('')
    setSelectedAssignees([])
    setAssigneeSearch('')
    setError(null)
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
    setAssigneeSearch('')
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
    const deadline = (formData.get('deadline') as string)?.trim() ?? ''
    const taskDetails = (formData.get('taskDetails') as string)?.trim() ?? ''

    // Validation
    if (!deadline) {
      setError('Deadline is required.')
      return
    }
    if (!taskDetails) {
      setError('Task details are required.')
      return
    }
    if (selectedAssignees.length === 0) {
      setError('At least one assignee is required.')
      return
    }

    setIsSubmitting(true)

    try {
      await addDoc(collection(firestore, 'calendarUpdates'), {
        month: selectedMonth,
        year: selectedYear,
        deadline,
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
                            const deadlineDate = new Date(update.deadline)
                            const isOverdue = deadlineDate < new Date() && deadlineDate.toDateString() !== new Date().toDateString()
                            
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
                                      <div
                                        style={{
                                          fontSize: '0.875rem',
                                          fontWeight: 700,
                                          color: isOverdue ? '#dc2626' : 'var(--text-primary)',
                                        }}
                                      >
                                        {new Date(update.deadline).toLocaleDateString('en-US', {
                                          month: 'short',
                                          day: 'numeric',
                                          year: 'numeric',
                                        })}
                                      </div>
                                      {isOverdue && (
                                        <div style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 600 }}>
                                          OVERDUE
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

                                {/* Assignees by Department - Table Style */}
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
                                    Assigned To
                                  </div>
                                  <div
                                    style={{
                                      border: '1px solid var(--border-soft)',
                                      borderRadius: '0.375rem',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    {Object.entries(assigneesByDept).map(([dept, assignees], idx) => (
                                      <div
                                        key={dept}
                                        style={{
                                          display: 'grid',
                                          gridTemplateColumns: '140px 1fr',
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
                                      </div>
                                    ))}
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
                <span>Deadline</span>
                <input name="deadline" type="date" required />
              </label>

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
