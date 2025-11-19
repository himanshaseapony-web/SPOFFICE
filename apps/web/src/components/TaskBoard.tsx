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

function getTimeUntilDeadline(dueDateString: string): { text: string; color: string; isOverdue: boolean } {
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

export function TaskBoard({ tasks, selectedId, onSelect, onFilter }: TaskBoardProps) {
  const { updateTask, deleteTask, userProfile } = useAppData()
  const { user } = useAuth()
  const [updating, setUpdating] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [isAddingUrl, setIsAddingUrl] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedId) ?? tasks[0],
    [tasks, selectedId],
  )

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
      await updateTask(taskId, { status: newStatus })
    } catch (error) {
      console.error('Failed to update task status', error)
      setUpdateError('Failed to update task status. Please try again.')
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

  return (
    <section className="panel panel-primary">
      <header className="panel-header">
        <div>
          <h2>Task Board</h2>
          <p>Monitor key workstreams and unblock teams quickly.</p>
        </div>
        <button className="ghost-button" type="button" onClick={onFilter}>
          Filter
        </button>
      </header>

      {tasks.length === 0 ? (
        <div className="empty-state">
          <h3>No tasks yet</h3>
          <p>Create a task to get started. Assign it to Programming, 3D Design, or UI/UX.</p>
        </div>
      ) : (
      <div className="task-board">
        <div className="task-list">
          {tasks.map((task) => (
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
              <p>{task.summary}</p>
              <div className="task-card-footer">
                <span className={statusPillClass[task.status]}>{task.status}</span>
                {(() => {
                  const deadline = getTimeUntilDeadline(task.dueDate)
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
            <p>{selectedTask?.summary}</p>
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
              {selectedTask?.dueDate ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <p style={{ margin: 0 }}>{formatDueDate(selectedTask.dueDate)}</p>
                  {(() => {
                    const deadline = getTimeUntilDeadline(selectedTask.dueDate)
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
      )}

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

