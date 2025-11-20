import { useState, useMemo } from 'react'
import type { Task } from '../context/AppDataContext'
import { useAppData } from '../context/AppDataContext'
import { useAuth } from '../context/AuthContext'
import { PasswordVerificationModal } from './PasswordVerificationModal'

type TaskBoardProps = {
  tasks: Task[]
  selectedId: string
  onSelect: (taskId: string) => void
  onFilter?: () => void
}

const statusPillClass: Record<Task['status'], string> = {
  Backlog: 'pill pill-neutral',
  'In Progress': 'pill pill-progress',
  Review: 'pill pill-review',
  Completed: 'pill pill-complete',
}

const priorityLabel: Record<Task['priority'], string> = {
  High: 'priority priority-high',
  Medium: 'priority priority-medium',
  Low: 'priority priority-low',
}

function formatDueDate(value?: string) {
  if (!value) return 'No due date'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function getTimeUntilDeadline(dueDateString: string, taskStatus?: Task['status']): { text: string; color: string; isOverdue: boolean } {
  // If task is completed, don't show overdue status
  if (taskStatus === 'Completed') {
    return { text: 'Completed', color: 'var(--text-muted)', isOverdue: false }
  }

  if (!dueDateString) {
    return { text: 'No due date', color: 'var(--text-muted)', isOverdue: false }
  }

  const dueDate = new Date(dueDateString)
  if (isNaN(dueDate.getTime())) {
    return { text: 'Invalid date', color: 'var(--text-muted)', isOverdue: false }
  }

  const now = new Date()
  // Set time to start of day for accurate day calculations
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())

  // Calculate difference in milliseconds
  const diffMs = due.getTime() - today.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    // Overdue
    const daysOverdue = Math.abs(diffDays)
    return {
      text: daysOverdue === 1 ? 'Overdue by 1 day' : `Overdue by ${daysOverdue} days`,
      color: '#dc2626',
      isOverdue: true,
    }
  } else if (diffDays === 0) {
    return { text: 'Due today', color: '#f59e0b', isOverdue: false }
  } else if (diffDays === 1) {
    return { text: 'Due tomorrow', color: '#f59e0b', isOverdue: false }
  } else if (diffDays <= 3) {
    return { text: `${diffDays} days remaining`, color: '#f59e0b', isOverdue: false }
  } else if (diffDays <= 7) {
    return { text: `${diffDays} days remaining`, color: 'var(--accent)', isOverdue: false }
  } else {
    return { text: `${diffDays} days remaining`, color: 'var(--text-muted)', isOverdue: false }
  }
}

const MAX_SUMMARY_LENGTH = 120 // Characters to show before collapsing

function CollapsibleSummary({ summary }: { summary: string }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const shouldCollapse = summary.length > MAX_SUMMARY_LENGTH
  const displayText = shouldCollapse && !isExpanded 
    ? summary.substring(0, MAX_SUMMARY_LENGTH).trim() + '...' 
    : summary

  if (!shouldCollapse) {
    return <p>{summary}</p>
  }

  return (
    <div>
      <p style={{ margin: 0, marginBottom: '0.5rem' }}>{displayText}</p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setIsExpanded(!isExpanded)
        }}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--accent)',
          cursor: 'pointer',
          padding: 0,
          fontSize: '0.875rem',
          fontWeight: 500,
          textDecoration: 'underline',
        }}
      >
        {isExpanded ? 'See less' : 'See more'}
      </button>
    </div>
  )
}

type ViewMode = 'active' | 'completed'

export function TaskBoard({ tasks, selectedId, onSelect, onFilter }: TaskBoardProps) {
  const { updateTask, deleteTask, userProfile } = useAppData()
  const { user } = useAuth()
  const [updating, setUpdating] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [isAddingUrl, setIsAddingUrl] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('active')

  // Separate active and completed tasks
  const activeTasks = useMemo(() => {
    return tasks.filter((task) => task.status !== 'Completed')
  }, [tasks])

  const completedTasks = useMemo(() => {
    return tasks.filter((task) => task.status === 'Completed')
  }, [tasks])

  // Group completed tasks by date
  const completedTasksByDate = useMemo(() => {
    const grouped: Record<string, Task[]> = {}
    
    completedTasks.forEach((task) => {
      // Use completedAt if available, otherwise use updatedAt or current date
      const completionDate = task.completedAt 
        ? new Date(task.completedAt)
        : new Date()
      
      // Format as YYYY-MM-DD for grouping
      const dateKey = completionDate.toISOString().split('T')[0]
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(task)
    })
    
    // Sort dates in descending order (most recent first)
    const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))
    
    // Sort tasks within each date by completion time (most recent first)
    sortedDates.forEach((date) => {
      grouped[date].sort((a, b) => {
        const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0
        const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0
        return dateB - dateA
      })
    })
    
    return { grouped, sortedDates }
  }, [completedTasks])

  const selectedTask = useMemo(() => {
    const taskList = viewMode === 'active' ? activeTasks : completedTasks
    return taskList.find((task) => task.id === selectedId) ?? taskList[0]
  }, [tasks, selectedId, viewMode, activeTasks, completedTasks])

  // Check if user can edit a specific task
  const canEditTask = (task: Task | undefined): boolean => {
    if (!user || !userProfile || !task) return false
    
    const role = userProfile.role
    const isDepartmentHead = userProfile.isDepartmentHead ?? false
    
    // Admins can edit all tasks
    if (role === 'Admin') return true
    
    // Managers can edit all tasks
    if (role === 'Manager') return true
    
    // Department heads can edit all tasks in their department
    if (isDepartmentHead && task.department === userProfile.department) return true
    
    // Users can edit tasks assigned to them (including when they create and assign to themselves)
    if (task.assigneeId === user.uid) return true
    
    // Users can also edit tasks they created (even if not assigned to themselves)
    if (task.createdBy === user.uid) return true
    
    // Specialists can edit tasks assigned to them
    if (role === 'Specialist' && task.assigneeId === user.uid) return true
    
    return false
  }

  // Check if user can delete a specific task
  const canDeleteTask = (task: Task | undefined): boolean => {
    if (!user || !userProfile || !task) return false
    
    const role = userProfile.role
    // Only Admins and Managers can delete tasks
    return role === 'Admin' || role === 'Manager'
  }

  const canEdit = canEditTask(selectedTask)
  const canDelete = canDeleteTask(selectedTask)

  const handleDeleteTask = async () => {
    if (!selectedTask) return
    try {
      await deleteTask(selectedTask.id)
      onSelect('') // Clear selection after deletion
    } catch (error) {
      console.error('Failed to delete task', error)
      setUpdateError('Failed to delete task. Please try again.')
    }
  }

  const handleStatusChange = async (taskId: string, newStatus: Task['status']) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!canEditTask(task)) return
    setUpdating(taskId)
    setUpdateError(null)
    try {
      const updates: Partial<Omit<Task, 'id'>> = { status: newStatus }
      
      // Set completedAt timestamp when task is marked as Completed
      if (newStatus === 'Completed' && task?.status !== 'Completed') {
        updates.completedAt = new Date().toISOString()
      }
      // Note: We don't clear completedAt when moving out of Completed status
      // to preserve the completion history. If needed, this can be added later.
      
      await updateTask(taskId, updates)
    } catch (error: any) {
      console.error('Failed to update task status', error)
      let errorMessage = 'Failed to update task status. Please try again.'
      
      // Provide more specific error messages
      if (error?.code === 'permission-denied') {
        errorMessage = 'Permission denied. You may not have permission to update this task. Please check your role and task assignment.'
      } else if (error?.code === 'unavailable') {
        errorMessage = 'Firestore is unavailable. Please check your internet connection and try again.'
      } else if (error?.message) {
        errorMessage = `Error: ${error.message}`
      }
      
      setUpdateError(errorMessage)
    } finally {
      setUpdating(null)
    }
  }

  const handlePriorityChange = async (taskId: string, newPriority: Task['priority']) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!canEditTask(task)) return
    setUpdating(taskId)
    setUpdateError(null)
    try {
      await updateTask(taskId, { priority: newPriority })
    } catch (error) {
      console.error('Failed to update task priority', error)
      setUpdateError('Failed to update task priority. Please try again.')
    } finally {
      setUpdating(null)
    }
  }

  const handleDueDateChange = async (taskId: string, newDueDate: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!canEditTask(task)) return
    setUpdating(taskId)
    setUpdateError(null)
    try {
      // Convert empty string to empty string (clear due date), or keep the date value
      const dateValue = newDueDate || ''
      await updateTask(taskId, { dueDate: dateValue })
    } catch (error: any) {
      console.error('Failed to update task due date', error)
      let errorMessage = 'Failed to update task due date. Please try again.'
      
      // Provide more specific error messages
      if (error?.code === 'permission-denied') {
        errorMessage = 'Permission denied. You may not have permission to update this task. Please check your role and task assignment.'
      } else if (error?.code === 'unavailable') {
        errorMessage = 'Firestore is unavailable. Please check your internet connection and try again.'
      } else if (error?.message) {
        errorMessage = `Error: ${error.message}`
      }
      
      setUpdateError(errorMessage)
    } finally {
      setUpdating(null)
    }
  }

  // Helper function to convert date string to YYYY-MM-DD format for input[type="date"]
  const formatDateForInput = (dateString: string | undefined): string => {
    if (!dateString) return ''
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return ''
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const handleAddUrl = async () => {
    if (!selectedTask || !newUrl.trim()) return
    
    const url = newUrl.trim()
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setUpdateError('Invalid URL. Please enter a URL that starts with http:// or https://')
      return
    }

    setUpdating(selectedTask.id)
    setUpdateError(null)
    try {
      const currentUrls = selectedTask.fileUrls || []
      await updateTask(selectedTask.id, { fileUrls: [...currentUrls, url] })
      setNewUrl('')
      setIsAddingUrl(false)
    } catch (error) {
      console.error('Failed to add file URL', error)
      setUpdateError('Failed to add file URL. Please try again.')
    } finally {
      setUpdating(null)
    }
  }

  // Format date for display
  const formatDateDisplay = (dateString: string): string => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    // Check if it's today
    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    }
    // Check if it's yesterday
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    }
    // Check if it's this week
    const daysDiff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    if (daysDiff <= 7) {
      return date.toLocaleDateString(undefined, { weekday: 'long' })
    }
    // Otherwise show full date
    return date.toLocaleDateString(undefined, { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  return (
    <section className="panel panel-primary">
      <header className="panel-header">
        <div>
          <h2>Task Board</h2>
          <p>Monitor key workstreams and unblock teams quickly.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--surface-elevated)', padding: '0.25rem', borderRadius: '0.5rem' }}>
            <button
              type="button"
              onClick={() => {
                setViewMode('active')
                onSelect('')
              }}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: 'none',
                background: viewMode === 'active' ? 'var(--accent)' : 'transparent',
                color: viewMode === 'active' ? 'white' : 'var(--text-primary)',
                cursor: 'pointer',
                fontWeight: viewMode === 'active' ? 600 : 400,
                fontSize: '0.875rem',
                transition: 'all 0.2s',
              }}
            >
              Active Tasks {activeTasks.length > 0 && `(${activeTasks.length})`}
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('completed')
                onSelect('')
              }}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: 'none',
                background: viewMode === 'completed' ? 'var(--accent)' : 'transparent',
                color: viewMode === 'completed' ? 'white' : 'var(--text-primary)',
                cursor: 'pointer',
                fontWeight: viewMode === 'completed' ? 600 : 400,
                fontSize: '0.875rem',
                transition: 'all 0.2s',
              }}
            >
              Completed {completedTasks.length > 0 && `(${completedTasks.length})`}
            </button>
          </div>
          {viewMode === 'active' && (
            <button className="ghost-button" type="button" onClick={onFilter}>
              Filter
            </button>
          )}
        </div>
      </header>

      {viewMode === 'active' ? (
        activeTasks.length === 0 ? (
          <div className="empty-state">
            <h3>No active tasks</h3>
            <p>All tasks are completed! Check the Completed tab to see your completed work.</p>
          </div>
        ) : (
          <div className="task-board">
            <div className="task-list">
              {activeTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              className={task.id === selectedTask?.id ? 'task-card active' : 'task-card'}
              onClick={() => onSelect(task.id)}
            >
              <div className="task-card-header">
                <span className="task-id">{task.id}</span>
                <span className={priorityLabel[task.priority]}>
                  {task.priority} priority
                </span>
              </div>
              <h3>{task.title}</h3>
              <CollapsibleSummary summary={task.summary} />
              <div className="task-card-footer">
                <span className={statusPillClass[task.status]}>{task.status}</span>
                {(() => {
                  const deadline = getTimeUntilDeadline(task.dueDate, task.status)
                  return (
                    <span
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.25rem',
                        background: deadline.isOverdue
                          ? '#dc262620'
                          : deadline.color === '#f59e0b'
                          ? '#f59e0b20'
                          : deadline.color === 'var(--accent)'
                          ? 'var(--accent-soft)'
                          : 'var(--surface-elevated)',
                        color: deadline.color,
                        fontWeight: 500,
                        border: deadline.isOverdue ? '1px solid #dc262640' : 'none',
                        fontSize: '0.85rem',
                      }}
                      title={`Due: ${formatDueDate(task.dueDate)}`}
                    >
                      {deadline.text}
                    </span>
                  )
                })()}
                <span>{task.assignee}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="task-detail">
          <header>
            <div>
              <span className="task-id">{selectedTask?.id}</span>
              <h3>{selectedTask?.title}</h3>
            </div>
            {selectedTask && (
              <div className="detail-meta" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {canEdit ? (
                  <select
                    value={selectedTask.status}
                    onChange={(e) =>
                      handleStatusChange(
                        selectedTask.id,
                        e.target.value as Task['status'],
                      )
                    }
                    disabled={updating === selectedTask.id}
                    className="status-select"
                  >
                    <option value="Backlog">Backlog</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Review">Review</option>
                    <option value="Completed">Completed</option>
                  </select>
                ) : (
                  <span className={statusPillClass[selectedTask.status]}>
                    {selectedTask.status}
                  </span>
                )}
                {canEdit ? (
                  <select
                    value={selectedTask.priority}
                    onChange={(e) =>
                      handlePriorityChange(
                        selectedTask.id,
                        e.target.value as Task['priority'],
                      )
                    }
                    disabled={updating === selectedTask.id}
                    className="priority-select"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                ) : (
                  <span className={priorityLabel[selectedTask.priority]}>
                    {selectedTask.priority} priority
                  </span>
                )}
                {canDelete && (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setShowDeleteModal(true)}
                    style={{ 
                      fontSize: '0.85rem', 
                      padding: '0.35rem 0.75rem',
                      color: '#dc2626',
                      borderColor: '#dc2626'
                    }}
                    title="Delete task"
                  >
                    Delete Task
                  </button>
                )}
              </div>
            )}
            {updateError && <p className="login-error">{updateError}</p>}
          </header>

          <section className="detail-section">
            <span className="section-label">Summary</span>
            {selectedTask && <CollapsibleSummary summary={selectedTask.summary} />}
          </section>

          <section className="detail-grid">
            <div>
              <span className="section-label">Assignee</span>
              <p>{selectedTask?.assignee}</p>
            </div>
            <div>
              <span className="section-label">Department</span>
              <p>{selectedTask?.department}</p>
            </div>
            <div>
              <span className="section-label">Due</span>
              {canEdit && selectedTask ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <input
                    type="date"
                    value={formatDateForInput(selectedTask.dueDate)}
                    onChange={(e) => handleDueDateChange(selectedTask.id, e.target.value)}
                    disabled={updating === selectedTask.id}
                    style={{
                      padding: '0.5rem',
                      borderRadius: '0.375rem',
                      border: '1px solid var(--border-soft)',
                      fontSize: '0.9rem',
                      background: 'var(--surface-default)',
                      color: 'var(--text-primary)',
                      cursor: updating === selectedTask.id ? 'not-allowed' : 'pointer',
                      opacity: updating === selectedTask.id ? 0.6 : 1,
                    }}
                  />
                  {selectedTask.dueDate && (() => {
                    const deadline = getTimeUntilDeadline(selectedTask.dueDate, selectedTask.status)
                    return (
                      <span
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '0.375rem',
                          background: deadline.isOverdue
                            ? '#dc262620'
                            : deadline.color === '#f59e0b'
                            ? '#f59e0b20'
                            : deadline.color === 'var(--accent)'
                            ? 'var(--accent-soft)'
                            : 'var(--surface-elevated)',
                          color: deadline.color,
                          fontWeight: 600,
                          border: deadline.isOverdue ? '1px solid #dc262640' : 'none',
                          fontSize: '0.875rem',
                          display: 'inline-block',
                          width: 'fit-content',
                        }}
                      >
                        {deadline.text}
                      </span>
                    )
                  })()}
                </div>
              ) : selectedTask?.dueDate ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <p style={{ margin: 0 }}>{formatDueDate(selectedTask.dueDate)}</p>
                  {(() => {
                    const deadline = getTimeUntilDeadline(selectedTask.dueDate, selectedTask.status)
                    return (
                      <span
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '0.375rem',
                          background: deadline.isOverdue
                            ? '#dc262620'
                            : deadline.color === '#f59e0b'
                            ? '#f59e0b20'
                            : deadline.color === 'var(--accent)'
                            ? 'var(--accent-soft)'
                            : 'var(--surface-elevated)',
                          color: deadline.color,
                          fontWeight: 600,
                          border: deadline.isOverdue ? '1px solid #dc262640' : 'none',
                          fontSize: '0.875rem',
                          display: 'inline-block',
                          width: 'fit-content',
                        }}
                      >
                        {deadline.text}
                      </span>
                    )
                  })()}
                </div>
              ) : (
                <p style={{ margin: 0 }}>No due date</p>
              )}
            </div>
          </section>

          {selectedTask?.blockers && selectedTask.blockers.length > 0 && (
            <section className="detail-section">
              <span className="section-label">Blockers</span>
              <ul className="blocker-list">
                {selectedTask.blockers.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="detail-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span className="section-label">File Links</span>
              {canEdit && !isAddingUrl && (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setIsAddingUrl(true)}
                  style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}
                >
                  + Add URL
                </button>
              )}
            </div>
            {isAddingUrl && canEdit && (
              <div style={{ 
                padding: '0.75rem', 
                background: 'var(--surface-elevated)', 
                borderRadius: '0.5rem',
                marginBottom: '0.75rem',
                border: '1px solid var(--border-soft)'
              }}>
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://example.com/file.pdf"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-soft)',
                    fontSize: '0.9rem',
                    marginBottom: '0.5rem'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddUrl()
                    } else if (e.key === 'Escape') {
                      setIsAddingUrl(false)
                      setNewUrl('')
                    }
                  }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      setIsAddingUrl(false)
                      setNewUrl('')
                    }}
                    style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleAddUrl}
                    disabled={!newUrl.trim() || (!newUrl.startsWith('http://') && !newUrl.startsWith('https://'))}
                    style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
            {selectedTask?.fileUrls && selectedTask.fileUrls.length > 0 ? (
              <ul className="file-urls-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {selectedTask.fileUrls.map((url, index) => (
                  <li key={index} style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ 
                        color: 'var(--accent)', 
                        textDecoration: 'none',
                        wordBreak: 'break-all',
                        flex: 1
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                      onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                    >
                      {url}
                    </a>
                    {canEdit && (
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => {
                          const currentUrls = selectedTask?.fileUrls || []
                          updateTask(selectedTask!.id, { 
                            fileUrls: currentUrls.filter((_, i) => i !== index) 
                          })
                        }}
                        style={{ 
                          fontSize: '0.75rem', 
                          padding: '0.25rem 0.5rem',
                          color: 'var(--text-muted)'
                        }}
                        title="Remove URL"
                      >
                        ×
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                No file links added yet.
              </p>
            )}
          </section>

          <section className="detail-section">
            <span className="section-label">Next Actions</span>
            <ul className="todo-list">
              <li>Confirm dependencies cleared before handoff</li>
              <li>Share status update in departmental chat</li>
              <li>Attach supporting documents for audit trail</li>
            </ul>
          </section>
        </div>
        </div>
          )
        ) : (
          // Completed Tasks Calendar View
          completedTasks.length === 0 ? (
            <div className="empty-state">
              <h3>No completed tasks yet</h3>
              <p>Completed tasks will appear here organized by completion date.</p>
            </div>
          ) : (
            <div className="task-board">
              <div className="task-list" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {completedTasksByDate.sortedDates.map((dateKey) => {
                    const dateTasks = completedTasksByDate.grouped[dateKey]
                    const displayDate = formatDateDisplay(dateKey)
                    const taskCount = dateTasks.length

                    return (
                      <div key={dateKey} style={{ borderBottom: '1px solid var(--border-soft)', paddingBottom: '1.5rem' }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.75rem', 
                          marginBottom: '1rem',
                          paddingBottom: '0.75rem',
                          borderBottom: '2px solid var(--accent)'
                        }}>
                          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                            {displayDate}
                          </h3>
                          <span style={{ 
                            fontSize: '0.875rem', 
                            color: 'var(--text-muted)',
                            background: 'var(--surface-elevated)',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '1rem'
                          }}>
                            {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
                          </span>
                        </div>
                        
                        <div style={{ 
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem'
                        }}>
                          {dateTasks.map((task) => {
                            const completionTime = task.completedAt 
                              ? new Date(task.completedAt).toLocaleTimeString([], { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })
                              : ''

                            return (
                              <button
                                key={task.id}
                                type="button"
                                onClick={() => onSelect(task.id)}
                                className={selectedTask?.id === task.id ? 'task-card active' : 'task-card'}
                                style={{
                                  textAlign: 'left',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.5rem',
                                  padding: '1rem'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ 
                                      fontSize: '0.75rem', 
                                      color: 'var(--text-muted)',
                                      marginBottom: '0.25rem'
                                    }}>
                                      {task.id}
                                    </div>
                                    <h4 style={{ 
                                      margin: 0, 
                                      fontSize: '1rem', 
                                      fontWeight: 600,
                                      color: 'var(--text-primary)'
                                    }}>
                                      {task.title}
                                    </h4>
                                  </div>
                                  {completionTime && (
                                    <span style={{ 
                                      fontSize: '0.75rem', 
                                      color: 'var(--text-muted)',
                                      whiteSpace: 'nowrap',
                                      marginLeft: '0.5rem'
                                    }}>
                                      {completionTime}
                                    </span>
                                  )}
                                </div>
                                
                                <p style={{ 
                                  margin: 0, 
                                  fontSize: '0.875rem', 
                                  color: 'var(--text-secondary)',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden'
                                }}>
                                  {task.summary}
                                </p>
                                
                                <div style={{ 
                                  display: 'flex', 
                                  gap: '0.5rem', 
                                  flexWrap: 'wrap',
                                  marginTop: '0.5rem'
                                }}>
                                  <span className={priorityLabel[task.priority]}>
                                    {task.priority}
                                  </span>
                                  <span style={{ 
                                    fontSize: '0.75rem', 
                                    color: 'var(--text-muted)',
                                    padding: '0.25rem 0.5rem',
                                    background: 'var(--surface-subtle)',
                                    borderRadius: '0.25rem'
                                  }}>
                                    {task.department}
                                  </span>
                                  <span style={{ 
                                    fontSize: '0.75rem', 
                                    color: 'var(--text-muted)',
                                    padding: '0.25rem 0.5rem',
                                    background: 'var(--surface-subtle)',
                                    borderRadius: '0.25rem'
                                  }}>
                                    {task.assignee}
                                  </span>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Task Detail View for Completed Tasks */}
              <div className="task-detail">
                <header>
                  <div>
                    <span className="task-id">{selectedTask?.id}</span>
                    <h3>{selectedTask?.title}</h3>
                    {selectedTask?.completedAt && (
                      <p style={{ margin: '0.5rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        Completed: {new Date(selectedTask.completedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </header>

                <section className="detail-section">
                  <span className="section-label">Summary</span>
                  {selectedTask && <CollapsibleSummary summary={selectedTask.summary} />}
                </section>

                <section className="detail-grid">
                  <div>
                    <span className="section-label">Status</span>
                    <p>{selectedTask?.status}</p>
                  </div>
                  <div>
                    <span className="section-label">Priority</span>
                    <p>{selectedTask?.priority}</p>
                  </div>
                  <div>
                    <span className="section-label">Department</span>
                    <p>{selectedTask?.department}</p>
                  </div>
                  <div>
                    <span className="section-label">Assignee</span>
                    <p>{selectedTask?.assignee}</p>
                  </div>
                </section>

                {selectedTask?.fileUrls && selectedTask.fileUrls.length > 0 && (
                  <section className="detail-section">
                    <span className="section-label">File Links</span>
                    <ul className="file-urls-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {selectedTask.fileUrls.map((url, index) => (
                        <li key={index} style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ 
                              color: 'var(--accent)', 
                              textDecoration: 'none',
                              wordBreak: 'break-all',
                              flex: 1
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                          >
                            {url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            </div>
          )
        )
      }

      <PasswordVerificationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onVerify={handleDeleteTask}
        title="Delete Task"
        message={`Are you sure you want to delete "${selectedTask?.title}"? This action cannot be undone.`}
      />
    </section>
  )
}

