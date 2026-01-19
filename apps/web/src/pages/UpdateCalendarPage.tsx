import { useState, useMemo, useEffect } from 'react'
import { useAppData } from '../context/AppDataContext'
import { useAuth } from '../context/AuthContext'
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, Timestamp, updateDoc, where, getDocs } from 'firebase/firestore'
import { StatusSelector, type DepartmentStatus } from '../components/StatusSelector'
import { playNotificationSound, showDesktopNotification } from '../lib/notifications'
import './UpdateCalendarPage.css'

type Assignee = {
  name: string
  id: string
  department: string
}

type DepartmentStatusData = {
  status: DepartmentStatus
  requestedBy?: string
  requestedByName?: string
  requestedAt?: string
  approvedBy?: string
  approvedByName?: string
  approvedAt?: string
}

type CalendarUpdate = {
  id: string
  month: string // e.g., "January", "February", etc.
  year: number
  deadline: string // ISO date string (legacy - fallback)
  departmentDeadlines?: Record<string, string> // Department name -> ISO datetime string
  departmentStatuses?: Record<string, DepartmentStatusData> // Department name -> Status data
  overallStatus?: 'In Progress' | 'Completed'
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
            departmentStatuses: data.departmentStatuses ?? undefined,
            overallStatus: data.overallStatus ?? 'In Progress',
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

    // Initialize department statuses to "Not Started"
    const initialStatuses: Record<string, DepartmentStatusData> = {}
    departments.forEach(dept => {
      initialStatuses[dept] = {
        status: 'Not Started',
      }
    })

    setIsSubmitting(true)

    try {
      await addDoc(collection(firestore, 'calendarUpdates'), {
        month: selectedMonth,
        year: selectedYear,
        deadline: earliestDeadline, // Legacy field for backward compatibility
        departmentDeadlines: deptDeadlines,
        departmentStatuses: initialStatuses,
        overallStatus: 'In Progress',
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

  const canApprove = userProfile?.role === 'Admin' || userProfile?.role === 'Manager'

  // Check if all departments are completed
  const checkAllDepartmentsComplete = (update: CalendarUpdate): boolean => {
    if (!update.departmentStatuses) return false
    const departments = Object.keys(update.departmentStatuses)
    if (departments.length === 0) return false
    return departments.every(dept => 
      update.departmentStatuses![dept]?.status === 'Completed'
    )
  }

  // Update department status
  const handleStatusChange = async (updateId: string, department: string, newStatus: DepartmentStatus) => {
    if (!firestore || !user || !userProfile) return

    setIsSubmitting(true)
    setError(null)

    try {
      const updateRef = doc(firestore, 'calendarUpdates', updateId)
      const currentUpdate = calendarUpdates.find(u => u.id === updateId)
      
      if (!currentUpdate) {
        throw new Error('Update not found')
      }

      const existingStatuses = currentUpdate.departmentStatuses || {}
      const now = new Date().toISOString()

      // Check if user is task creator
      const userIsTaskCreator = currentUpdate.createdBy === user.uid

      // Prepare status update
      const statusUpdate: DepartmentStatusData = {
        ...existingStatuses[department],
        status: newStatus,
      }

      // If requesting approval (Specialist/DepartmentHead setting to Pending Approval)
      if (newStatus === 'Pending Approval' && !userIsTaskCreator && !canApprove) {
        statusUpdate.requestedBy = user.uid
        statusUpdate.requestedByName = userProfile.displayName
        statusUpdate.requestedAt = now

        // Create notification for managers/admins
        const managersAndAdmins = allUserProfiles.filter(
          p => p.role === 'Admin' || p.role === 'Manager'
        )

        // Create notification document
        await addDoc(collection(firestore, 'calendarStatusNotifications'), {
          updateId,
          department,
          requestedBy: user.uid,
          requestedByName: userProfile.displayName,
          requestedAt: Timestamp.now(),
          status: 'pending',
          month: currentUpdate.month,
          year: currentUpdate.year,
          taskDetails: currentUpdate.taskDetails,
        })

        // Notify managers and admins
        playNotificationSound()
        showDesktopNotification('Calendar Update Approval Requested', {
          body: `${userProfile.displayName} from ${department} requested approval for: ${currentUpdate.taskDetails}`,
          tag: `calendar-approval-${updateId}-${department}`,
          requireInteraction: false,
        })

        // Also notify via company chat
        if (managersAndAdmins.length > 0) {
          const notificationText = `📋 Approval Request: ${userProfile.displayName} from ${department} has completed their work and requested approval for "${currentUpdate.taskDetails}" in ${currentUpdate.month} ${currentUpdate.year}.`
          
          await addDoc(collection(firestore, 'companyChats'), {
            author: 'System',
            authorId: 'system',
            role: 'System',
            text: notificationText,
            createdAt: Timestamp.now(),
          })
        }
      }

      // Only Managers/Admins can approve Pending Approval → Completed
      if (newStatus === 'Completed') {
        // Check if this is an approval (from Pending Approval) and user has permission
        if (existingStatuses[department]?.status === 'Pending Approval' && canApprove) {
          // Manager/Admin is approving the request
          statusUpdate.approvedBy = user.uid
          statusUpdate.approvedByName = userProfile.displayName
          statusUpdate.approvedAt = now

          // Mark notification as approved
          const notificationsRef = collection(firestore, 'calendarStatusNotifications')
          const notificationsQuery = query(
            notificationsRef,
            where('updateId', '==', updateId),
            where('department', '==', department),
            where('status', '==', 'pending')
          )
          const notificationsSnapshot = await getDocs(notificationsQuery)
          notificationsSnapshot.forEach(async (notifDoc) => {
            await updateDoc(doc(firestore, 'calendarStatusNotifications', notifDoc.id), {
              status: 'approved',
              reviewedBy: user.uid,
              reviewedAt: Timestamp.now(),
            })
          })
        } else if (!canApprove) {
          // Non-managers/admins trying to set to Completed - not allowed
          throw new Error('Only Managers and Admins can approve requests and set status to Completed.')
        }
      }

      // Update department status
      const updatedStatuses = {
        ...existingStatuses,
        [department]: statusUpdate,
      }

      // Check if all departments are completed
      const tempUpdate = { ...currentUpdate, departmentStatuses: updatedStatuses }
      const allComplete = checkAllDepartmentsComplete(tempUpdate)

      // Update the calendar update
      await updateDoc(updateRef, {
        departmentStatuses: updatedStatuses,
        overallStatus: allComplete ? 'Completed' : 'In Progress',
        updatedAt: Timestamp.now(),
      })

      // If all completed, show notification
      if (allComplete) {
        playNotificationSound()
        showDesktopNotification('Calendar Update Completed', {
          body: `All departments have completed their work for: ${currentUpdate.taskDetails}`,
          tag: `calendar-completed-${updateId}`,
        })
      }
    } catch (err: any) {
      console.error('Failed to update status:', err)
      let errorMessage = 'Failed to update status. Please try again.'
      if (err.code === 'permission-denied') {
        errorMessage = 'Permission denied. Check your role permissions.'
      }
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Check if user is assigned to this department
  const isUserAssignedToDepartment = (update: CalendarUpdate, department: string): boolean => {
    if (!user) return false
    return update.assignees.some(
      assignee => assignee.department === department && assignee.id === user.uid
    )
  }

  // Check if user is the task creator
  const isTaskCreator = (update: CalendarUpdate): boolean => {
    if (!user) return false
    return update.createdBy === user.uid
  }

  // Check if user can edit this department's status
  const canEditDepartmentStatus = (update: CalendarUpdate, department: string): boolean => {
    if (canApprove) return true // Managers/Admins can edit any
    if (isTaskCreator(update)) return true // Task creator can edit any department status
    if (canEdit && isUserAssignedToDepartment(update, department)) return true
    return false
  }

  return (
    <div className="calendar-page">
      <header className="calendar-header">
        <div className="calendar-header-content">
          <div>
            <h1>Update Calendar</h1>
            <p>Track monthly update deadlines and task assignments across departments</p>
          </div>
          <div className="calendar-year-selector">
            <label>
              <span>Year:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
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

      <div className="calendar-grid">
        {MONTHS.map((month, index) => {
          const monthKey = `${month}-${selectedYear}`
          const monthUpdates = updatesByMonth[monthKey] || []
          const monthDate = new Date(selectedYear, index, 1)
          const isPastMonth = monthDate < new Date(currentYear, new Date().getMonth(), 1)

          return (
            <div
              key={month}
              className={`calendar-month-card panel ${isPastMonth ? 'calendar-month-past' : ''}`}
            >
              <header className="panel-header">
                <div>
                  <h3>{month}</h3>
                  <p>{monthUpdates.length} {monthUpdates.length === 1 ? 'update' : 'updates'}</p>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    className="primary-button calendar-add-button"
                    onClick={() => handleOpenCreate(month)}
                  >
                    + Add
                  </button>
                )}
              </header>

              <div className="calendar-month-content">
                {monthUpdates.length === 0 ? (
                  <div className="calendar-empty-state">
                    <p>No updates scheduled</p>
                  </div>
                ) : (
                  <div className="calendar-updates-list">
                    {(() => {
                      const isExpanded = expandedMonths.has(monthKey)
                      const displayUpdates = isExpanded ? monthUpdates : monthUpdates.slice(0, 3)
                      const hasMore = monthUpdates.length > 3

                      return (
                        <>
                          {displayUpdates.map((update) => {
                            // Get the earliest deadline for display
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
                                className={`calendar-update-card ${isOverdue ? 'calendar-update-overdue' : ''}`}
                              >
                                <div className="calendar-update-header">
                                  <div className="calendar-deadline-display">
                                    <span className="calendar-deadline-icon">📅</span>
                                    <div>
                                      {earliestDeadline ? (
                                        <>
                                          <div className={`calendar-deadline-date ${isOverdue ? 'calendar-deadline-overdue' : ''}`}>
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
                                            <div className="calendar-overdue-badge">OVERDUE</div>
                                          )}
                                        </>
                                      ) : (
                                        <div className="calendar-no-deadline">No deadline set</div>
                                      )}
                                    </div>
                                  </div>
                                  {canEdit && (
                                    <button
                                      type="button"
                                      className="calendar-delete-button"
                                      onClick={() => handleDelete(update.id)}
                                    >
                                      🗑 Delete
                                    </button>
                                  )}
                                </div>

                                <div className="calendar-task-details">
                                  <div className="section-label">Task Details</div>
                                  <p>{update.taskDetails}</p>
                                </div>

                                <div className="calendar-departments-section">
                                  <div className="section-label">
                                    Assigned To & Deadlines
                                    {update.overallStatus === 'Completed' && (
                                      <span className="calendar-overall-status-badge">✓ All Completed</span>
                                    )}
                                  </div>
                                  <div className="calendar-departments-table">
                                    {Object.entries(assigneesByDept).map(([dept, assignees], idx) => {
                                      const deptDeadline = update.departmentDeadlines?.[dept] 
                                        ? new Date(update.departmentDeadlines[dept])
                                        : (update.deadline ? new Date(update.deadline) : null)
                                      const isDeptOverdue = deptDeadline && deptDeadline < new Date() && 
                                                           deptDeadline.toDateString() !== new Date().toDateString()
                                      const isEditing = editingDeadline?.updateId === update.id && editingDeadline?.department === dept
                                      const deptStatus = update.departmentStatuses?.[dept]?.status || 'Not Started'
                                      const canEditDeptStatus = canEditDepartmentStatus(update, dept)
                                      
                                      return (
                                        <div
                                          key={dept}
                                          className={`calendar-dept-row ${idx % 2 === 0 ? 'calendar-dept-row-even' : 'calendar-dept-row-odd'}`}
                                        >
                                          <div className="calendar-dept-name">{dept}</div>
                                          <div className="calendar-dept-assignees">
                                            {assignees.map((assignee, aIdx) => (
                                              <span key={assignee.id}>
                                                {assignee.name}
                                                {aIdx < assignees.length - 1 && ','}
                                              </span>
                                            ))}
                                          </div>
                                          <div className={`calendar-dept-deadline ${isDeptOverdue ? 'calendar-dept-deadline-overdue' : ''}`}>
                                            {isEditing ? (
                                              <div className="calendar-deadline-editor">
                                                <input
                                                  type="date"
                                                  value={departmentDeadlines[dept]?.date || ''}
                                                  onChange={(e) => setDepartmentDeadlines({
                                                    ...departmentDeadlines,
                                                    [dept]: { ...departmentDeadlines[dept], date: e.target.value, time: departmentDeadlines[dept]?.time || '17:00' }
                                                  })}
                                                />
                                                <input
                                                  type="time"
                                                  value={departmentDeadlines[dept]?.time || ''}
                                                  onChange={(e) => setDepartmentDeadlines({
                                                    ...departmentDeadlines,
                                                    [dept]: { ...departmentDeadlines[dept], date: departmentDeadlines[dept]?.date || '', time: e.target.value }
                                                  })}
                                                />
                                                {error && editingDeadline?.updateId === update.id && editingDeadline?.department === dept && (
                                                  <div className="calendar-deadline-error">{error}</div>
                                                )}
                                                <div className="calendar-deadline-actions">
                                                  <button
                                                    type="button"
                                                    onClick={() => handleUpdateDeadline(update.id, dept)}
                                                    disabled={isSubmitting}
                                                    className="primary-button calendar-save-button"
                                                  >
                                                    Save
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={handleCloseEditDeadline}
                                                    disabled={isSubmitting}
                                                    className="ghost-button calendar-cancel-button"
                                                  >
                                                    Cancel
                                                  </button>
                                                </div>
                                              </div>
                                            ) : (
                                              <>
                                                {deptDeadline ? (
                                                  <>
                                                    <div className="calendar-dept-deadline-date">
                                                      {deptDeadline.toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                      })}
                                                    </div>
                                                    <div className="calendar-dept-deadline-time">
                                                      {deptDeadline.toLocaleTimeString('en-US', {
                                                        hour: 'numeric',
                                                        minute: '2-digit',
                                                      })}
                                                    </div>
                                                    {isDeptOverdue && (
                                                      <div className="calendar-dept-overdue-badge">OVERDUE</div>
                                                    )}
                                                  </>
                                                ) : (
                                                  <div className="calendar-dept-no-deadline">No deadline</div>
                                                )}
                                                {canEdit && (
                                                  <button
                                                    type="button"
                                                    onClick={() => handleOpenEditDeadline(update.id, dept, update.departmentDeadlines?.[dept] || update.deadline)}
                                                    className="calendar-edit-deadline-button"
                                                  >
                                                    {deptDeadline ? 'Edit' : 'Set'}
                                                  </button>
                                                )}
                                              </>
                                            )}
                                          </div>
                                          <div className="calendar-dept-status">
                                            <StatusSelector
                                              currentStatus={deptStatus}
                                              department={dept}
                                              updateId={update.id}
                                              canEdit={canEditDeptStatus}
                                              canApprove={canApprove}
                                              isTaskCreator={isTaskCreator(update)}
                                              onStatusChange={(newStatus) => handleStatusChange(update.id, dept, newStatus)}
                                              isSubmitting={isSubmitting}
                                            />
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                          
                          {hasMore && (
                            <button
                              type="button"
                              onClick={() => toggleMonthExpanded(monthKey)}
                              className="calendar-show-more-button"
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
          <div className="modal modal-large" role="dialog" aria-modal="true">
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
                <label className="calendar-assignees-label">
                  <span>Assignees ({selectedAssignees.length})</span>
                </label>
                
                {selectedAssignees.length > 0 && (
                  <div className="calendar-selected-assignees">
                    {selectedAssignees.map((assignee) => (
                      <div key={assignee.id} className="calendar-assignee-item">
                        <div>
                          <strong>{assignee.name}</strong>
                          <span className="calendar-assignee-dept">({assignee.department})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAssignee(assignee.id)}
                          className="calendar-remove-assignee-button"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <select
                  value=""
                  onChange={(e) => {
                    const profile = allUserProfiles.find((p) => p.id === e.target.value)
                    if (profile) {
                      addAssignee(profile)
                    }
                  }}
                  className="calendar-assignee-select"
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
                  <small className="calendar-assignees-hint">
                    Add at least one assignee to this update
                  </small>
                )}
              </div>

              {/* Department Deadlines Section */}
              {selectedAssignees.length > 0 && (
                <div>
                  <label className="calendar-deadlines-label">
                    <span>Department Deadlines</span>
                  </label>
                  <div className="calendar-deadlines-table">
                    {[...new Set(selectedAssignees.map(a => a.department))].map((dept, idx) => {
                      const defaultDate = new Date()
                      defaultDate.setDate(defaultDate.getDate() + 7) // Default to 7 days from now
                      const defaultDateStr = defaultDate.toISOString().split('T')[0]
                      const defaultTimeStr = '17:00'
                      
                      return (
                        <div
                          key={dept}
                          className={`calendar-deadline-row ${idx % 2 === 0 ? 'calendar-deadline-row-even' : 'calendar-deadline-row-odd'}`}
                        >
                          <div className="calendar-deadline-dept-name">{dept}</div>
                          <div>
                            <label>
                              <span>Date</span>
                              <input
                                name={`deadline-date-${dept}`}
                                type="date"
                                defaultValue={defaultDateStr}
                                required
                              />
                            </label>
                          </div>
                          <div>
                            <label>
                              <span>Time</span>
                              <input
                                name={`deadline-time-${dept}`}
                                type="time"
                                defaultValue={defaultTimeStr}
                                required
                              />
                            </label>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <small className="calendar-deadlines-hint">
                    Set a deadline date and time for each department. Deadlines can be edited later if needed.
                  </small>
                </div>
              )}

              {error && (
                <div className="calendar-form-error">
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
