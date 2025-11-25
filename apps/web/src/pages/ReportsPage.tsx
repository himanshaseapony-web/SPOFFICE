import { useMemo, useState } from 'react'
import { AccessGuard } from '../components/AccessGuard'
import { useAppData } from '../context/AppDataContext'
import { useAuth } from '../context/AuthContext'
import type { Task } from '../context/AppDataContext'
import { collection, addDoc, Timestamp } from 'firebase/firestore'

function exportTasksToCSV(tasks: Task[], filename: string) {
  const headers = ['ID', 'Title', 'Status', 'Priority', 'Department', 'Assignee', 'Due Date', 'Summary']
  const rows = tasks.map((task) => [
    task.id,
    task.title,
    task.status,
    task.priority,
    task.department,
    task.assignee,
    task.dueDate || 'N/A',
    task.summary.replace(/"/g, '""'), // Escape quotes for CSV
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function ReportsPage() {
  const { tasks, departments, allUserProfiles, userProfile, firestore } = useAppData()
  const { user } = useAuth()
  const [exporting, setExporting] = useState(false)
  const [isCreateUpdateOpen, setIsCreateUpdateOpen] = useState(false)
  const [updateDate, setUpdateDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedMembers, setSelectedMembers] = useState<Array<{ 
    userId: string
    userName: string
    taskIds: string[]
    manualTasks: string[] // Array of manually entered task titles
  }>>([])
  const [manualTaskInputs, setManualTaskInputs] = useState<Record<string, string>>({}) // userId -> manual task input value
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState(false)
  
  const completedTasks = tasks.filter((task) => task.status === 'Completed')
  const reviewQueue = tasks.filter((task) => task.status === 'Review')
  const activeTasks = tasks.filter((task) => task.status !== 'Completed')
  
  const departmentStats = useMemo(() => {
    return departments.map((dept) => {
      const deptTasks = tasks.filter((task) => task.department === dept.name)
      return {
        name: dept.name,
        total: deptTasks.length,
        completed: deptTasks.filter((t) => t.status === 'Completed').length,
        inProgress: deptTasks.filter((t) => t.status === 'In Progress').length,
        review: deptTasks.filter((t) => t.status === 'Review').length,
        backlog: deptTasks.filter((t) => t.status === 'Backlog').length,
      }
    })
  }, [tasks, departments])

  const handleExportAll = () => {
    setExporting(true)
    try {
      exportTasksToCSV(tasks, `all-tasks-${new Date().toISOString().split('T')[0]}.csv`)
    } catch (error) {
      console.error('Failed to export CSV', error)
    } finally {
      setExporting(false)
    }
  }

  const handleExportCompleted = () => {
    setExporting(true)
    try {
      exportTasksToCSV(completedTasks, `completed-tasks-${new Date().toISOString().split('T')[0]}.csv`)
    } catch (error) {
      console.error('Failed to export CSV', error)
    } finally {
      setExporting(false)
    }
  }

  // Get department members (only for department heads)
  const departmentMembers = useMemo(() => {
    if (!userProfile || !userProfile.isDepartmentHead || !userProfile.department) {
      return []
    }
    return allUserProfiles.filter(
      (profile) => 
        profile.department === userProfile.department && 
        profile.id !== user?.uid &&
        profile.role !== 'Viewer'
    )
  }, [allUserProfiles, userProfile, user])

  // Get tasks completed on a specific date by a specific user
  const getTasksCompletedOnDate = (userId: string, dateString: string): Task[] => {
    if (!dateString) return []
    
    const selectedDate = new Date(dateString)
    selectedDate.setHours(0, 0, 0, 0)
    const nextDay = new Date(selectedDate)
    nextDay.setDate(nextDay.getDate() + 1)

    return tasks.filter((task) => {
      if (task.assigneeId !== userId || task.status !== 'Completed') {
        return false
      }
      if (!task.completedAt) return false
      
      const completedDate = new Date(task.completedAt)
      return completedDate >= selectedDate && completedDate < nextDay
    })
  }


  const handleAddMember = () => {
    if (departmentMembers.length === 0) return
    
    // Find first member not already added
    const availableMember = departmentMembers.find(
      (member) => !selectedMembers.some((sm) => sm.userId === member.id)
    )
    
    if (availableMember) {
      setSelectedMembers([
        ...selectedMembers,
        {
          userId: availableMember.id,
          userName: availableMember.displayName,
          taskIds: [],
          manualTasks: [],
        },
      ])
      setManualTaskInputs({
        ...manualTaskInputs,
        [availableMember.id]: '',
      })
    }
  }

  const handleRemoveMember = (userId: string) => {
    setSelectedMembers(selectedMembers.filter((m) => m.userId !== userId))
    const newInputs = { ...manualTaskInputs }
    delete newInputs[userId]
    setManualTaskInputs(newInputs)
  }

  const handleToggleTask = (memberUserId: string, taskId: string) => {
    setSelectedMembers(
      selectedMembers.map((member) => {
        if (member.userId === memberUserId) {
          const taskIds = member.taskIds.includes(taskId)
            ? member.taskIds.filter((id) => id !== taskId)
            : [...member.taskIds, taskId]
          return { ...member, taskIds }
        }
        return member
      })
    )
  }

  const handleAddManualTask = (memberUserId: string) => {
    const taskTitle = manualTaskInputs[memberUserId]?.trim()
    if (!taskTitle) return

    setSelectedMembers(
      selectedMembers.map((member) => {
        if (member.userId === memberUserId) {
          return {
            ...member,
            manualTasks: [...member.manualTasks, taskTitle],
          }
        }
        return member
      })
    )
    setManualTaskInputs({
      ...manualTaskInputs,
      [memberUserId]: '',
    })
  }

  const handleRemoveManualTask = (memberUserId: string, taskIndex: number) => {
    setSelectedMembers(
      selectedMembers.map((member) => {
        if (member.userId === memberUserId) {
          return {
            ...member,
            manualTasks: member.manualTasks.filter((_, index) => index !== taskIndex),
          }
        }
        return member
      })
    )
  }

  const handleCreateDailyUpdate = async () => {
    if (!user || !userProfile || !firestore) {
      setCreateError('Cannot create update. Please verify your authentication and try again.')
      return
    }

    if (!userProfile.isDepartmentHead || !userProfile.department) {
      setCreateError('Only department heads can create daily work updates.')
      return
    }

    // Validate that at least one member with at least one task (system or manual) is selected
    const hasValidData = selectedMembers.some(
      (member) => member.taskIds.length > 0 || member.manualTasks.length > 0
    )
    if (!hasValidData) {
      setCreateError('Please select at least one member with at least one task (from system or manually entered).')
      return
    }

    setIsCreating(true)
    setCreateError(null)
    setCreateSuccess(false)

    try {
      // Filter members to only include those with tasks (system or manual)
      const membersWithTasks = selectedMembers
        .filter((member) => member.taskIds.length > 0 || member.manualTasks.length > 0)
        .map((member) => {
          // Get system tasks
          const systemTasks = member.taskIds
            .map((taskId) => {
              const task = tasks.find((t) => t.id === taskId)
              return task
                ? { taskId: task.id, taskTitle: task.title, isManual: false }
                : null
            })
            .filter((t): t is { taskId: string; taskTitle: string; isManual: boolean } => t !== null)

          // Get manual tasks
          const manualTasks = member.manualTasks.map((taskTitle) => ({
            taskTitle,
            isManual: true,
          }))

          // Combine both types
          const allTasks = [
            ...systemTasks,
            ...manualTasks,
          ] as Array<{
            taskId?: string
            taskTitle: string
            isManual?: boolean
          }>

          return {
            userId: member.userId,
            userName: member.userName,
            tasksCompleted: allTasks,
          }
        })

      const updateData = {
        date: updateDate,
        department: userProfile.department,
        createdBy: user.uid,
        createdByName: userProfile.displayName,
        createdAt: Timestamp.now(),
        members: membersWithTasks,
      }

      await addDoc(collection(firestore, 'dailyWorkUpdates'), updateData)

      setCreateSuccess(true)
      setSelectedMembers([])
      setManualTaskInputs({})
      setUpdateDate(new Date().toISOString().split('T')[0])
      
      // Close modal after 2 seconds
      setTimeout(() => {
        setIsCreateUpdateOpen(false)
        setCreateSuccess(false)
      }, 2000)
    } catch (error: any) {
      console.error('Failed to create daily work update', error)
      let errorMessage = 'Failed to create daily work update. Please try again.'
      
      if (error?.code === 'permission-denied') {
        errorMessage = 'Permission denied. You may not have permission to create daily work updates.'
      } else if (error?.code === 'unavailable') {
        errorMessage = 'Firestore is unavailable. Please check your internet connection and try again.'
      } else if (error?.message) {
        errorMessage = `Error: ${error.message}`
      }
      
      setCreateError(errorMessage)
    } finally {
      setIsCreating(false)
    }
  }

  const isDepartmentHead = userProfile?.isDepartmentHead ?? false
  const userDepartment = userProfile?.department

  return (
    <AccessGuard allowedRoles={['Admin', 'Manager', 'DepartmentHead']}>
      <div className="panel">
        <header className="panel-header">
          <div>
            <h2>Reporting Workspace</h2>
            <p>Generate exports and review historical performance.</p>
          </div>
          {isDepartmentHead && userDepartment && (
            <button
              type="button"
              className="primary-button"
              onClick={() => setIsCreateUpdateOpen(true)}
            >
              Create Daily Work Update
            </button>
          )}
        </header>
        <div className="reports-grid">
          <article className="report-card">
            <h3>Task Summary</h3>
            <div className="metric-card">
              <strong>{activeTasks.length}</strong>
              <span className="section-label">Active tasks</span>
            </div>
            <div className="metric-card">
              <strong>{completedTasks.length}</strong>
              <span className="section-label">Completed</span>
            </div>
            <div className="metric-card">
              <strong>{reviewQueue.length}</strong>
              <span className="section-label">In review</span>
            </div>
            <button
              type="button"
              className="primary-button"
              onClick={handleExportAll}
              disabled={exporting || tasks.length === 0}
            >
              {exporting ? 'Exporting...' : 'Export All CSV'}
            </button>
          </article>
          <article className="report-card">
            <h3>Completed Tasks</h3>
            <p>{completedTasks.length} tasks completed.</p>
            <button
              type="button"
              className="primary-button"
              onClick={handleExportCompleted}
              disabled={exporting || completedTasks.length === 0}
            >
              {exporting ? 'Exporting...' : 'Export Completed CSV'}
            </button>
          </article>
          <article className="report-card">
            <h3>Department Performance</h3>
            <div className="summary-list">
              {departmentStats.map((stat) => (
                <div key={stat.name} className="summary-card">
                  <div>
                    <span className="section-label">{stat.name}</span>
                    <strong>{stat.completed}/{stat.total} completed</strong>
                  </div>
                  <div className="summary-stats">
                    <span>{stat.inProgress} in progress</span>
                    <span>{stat.review} review</span>
                    <span>{stat.backlog} backlog</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>

      {/* Daily Work Update Modal */}
      {isCreateUpdateOpen && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: '800px', maxHeight: '90vh', overflow: 'auto' }}>
            <header className="modal-header">
              <div>
                <h2>Create Daily Work Update</h2>
                <p>Document what your department members accomplished today.</p>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setIsCreateUpdateOpen(false)
                  setCreateError(null)
                  setCreateSuccess(false)
                  setSelectedMembers([])
                  setManualTaskInputs({})
                }}
              >
                Close
              </button>
            </header>

            <div className="modal-form" style={{ padding: '1.5rem' }}>
              {createSuccess && (
                <div style={{
                  padding: '1rem',
                  background: '#dfd',
                  border: '1px solid #9c9',
                  borderRadius: '0.5rem',
                  marginBottom: '1rem',
                  color: '#363'
                }}>
                  ✓ Daily work update created successfully!
                </div>
              )}

              {createError && (
                <div style={{
                  padding: '1rem',
                  background: '#fee',
                  border: '1px solid #fcc',
                  borderRadius: '0.5rem',
                  marginBottom: '1rem',
                  color: '#c33'
                }}>
                  <strong>Error:</strong> {createError}
                </div>
              )}

              <label>
                <span>Date</span>
                <input
                  type="date"
                  value={updateDate}
                  onChange={(e) => setUpdateDate(e.target.value)}
                  disabled={isCreating}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border-soft)',
                    fontSize: '0.9rem',
                    width: '100%',
                  }}
                />
              </label>

              <div style={{ marginTop: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '1rem' }}>Department Members</span>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={handleAddMember}
                    disabled={isCreating || departmentMembers.length === 0 || selectedMembers.length >= departmentMembers.length}
                    style={{ fontSize: '0.875rem' }}
                  >
                    + Add Member
                  </button>
                </div>

                {selectedMembers.length === 0 ? (
                  <div style={{
                    padding: '2rem',
                    textAlign: 'center',
                    background: 'var(--surface-elevated)',
                    borderRadius: '0.5rem',
                    color: 'var(--text-muted)'
                  }}>
                    No members added yet. Click "Add Member" to start.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {selectedMembers.map((member) => {
                      // Get tasks completed on the selected date
                      const tasksForDate = getTasksCompletedOnDate(member.userId, updateDate)

                      return (
                        <div
                          key={member.userId}
                          style={{
                            padding: '1rem',
                            border: '1px solid var(--border-soft)',
                            borderRadius: '0.5rem',
                            background: 'var(--surface-elevated)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <strong>{member.userName}</strong>
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={() => handleRemoveMember(member.userId)}
                              disabled={isCreating}
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', color: '#dc2626' }}
                            >
                              Remove
                            </button>
                          </div>

                          {/* System Tasks Section */}
                          {tasksForDate.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                              <span style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                                Select completed tasks from system:
                              </span>
                              {tasksForDate.map((task) => (
                                <label
                                  key={task.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.5rem',
                                    borderRadius: '0.25rem',
                                    cursor: 'pointer',
                                    background: member.taskIds.includes(task.id) ? 'var(--accent-soft)' : 'transparent',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={member.taskIds.includes(task.id)}
                                    onChange={() => handleToggleTask(member.userId, task.id)}
                                    disabled={isCreating}
                                  />
                                  <span style={{ fontSize: '0.875rem' }}>{task.title}</span>
                                </label>
                              ))}
                            </div>
                          )}

                          {/* Manual Tasks Section */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                              Or enter tasks manually:
                            </span>
                            
                            {/* Display existing manual tasks */}
                            {member.manualTasks.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                {member.manualTasks.map((taskTitle, index) => (
                                  <div
                                    key={index}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '0.5rem',
                                      borderRadius: '0.25rem',
                                      background: 'var(--accent-soft)',
                                    }}
                                  >
                                    <span style={{ fontSize: '0.875rem', flex: 1 }}>{taskTitle}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveManualTask(member.userId, index)}
                                      disabled={isCreating}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#dc2626',
                                        cursor: 'pointer',
                                        padding: '0.25rem 0.5rem',
                                        fontSize: '0.75rem',
                                      }}
                                      title="Remove task"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Input for new manual task */}
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <input
                                type="text"
                                value={manualTaskInputs[member.userId] || ''}
                                onChange={(e) =>
                                  setManualTaskInputs({
                                    ...manualTaskInputs,
                                    [member.userId]: e.target.value,
                                  })
                                }
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    handleAddManualTask(member.userId)
                                  }
                                }}
                                placeholder="Enter task description..."
                                disabled={isCreating}
                                style={{
                                  flex: 1,
                                  padding: '0.5rem',
                                  borderRadius: '0.375rem',
                                  border: '1px solid var(--border-soft)',
                                  fontSize: '0.875rem',
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleAddManualTask(member.userId)}
                                disabled={isCreating || !manualTaskInputs[member.userId]?.trim()}
                                className="ghost-button"
                                style={{
                                  fontSize: '0.875rem',
                                  padding: '0.5rem 1rem',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <footer className="modal-footer" style={{ marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setIsCreateUpdateOpen(false)
                    setCreateError(null)
                    setCreateSuccess(false)
                    setSelectedMembers([])
                  }}
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleCreateDailyUpdate}
                  disabled={
                    isCreating ||
                    !firestore ||
                    selectedMembers.filter((m) => m.taskIds.length > 0 || m.manualTasks.length > 0).length === 0
                  }
                >
                  {isCreating ? 'Creating...' : 'Create Update'}
                </button>
              </footer>
            </div>
          </div>
        </div>
      )}
    </AccessGuard>
  )
}

export default ReportsPage

