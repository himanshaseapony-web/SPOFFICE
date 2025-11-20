import { useMemo, useState } from 'react'
import { useAppData, type Task } from '../context/AppDataContext'
import { useAuth } from '../context/AuthContext'
import { useLayoutActions } from '../layouts/useLayoutActions'

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
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
  const diffMs = due.getTime() - today.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
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

const MAX_SUMMARY_LENGTH = 120

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

export function MyTasksPage() {
  const { tasks, allUserProfiles } = useAppData()
  const { user } = useAuth()
  const { openFilter } = useLayoutActions()
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  // Filter tasks assigned to the current user
  const myTasks = useMemo(() => {
    if (!user) return []
    return tasks.filter((task) => task.assigneeId === user.uid)
  }, [tasks, user])

  // Get creator name for a task
  const getCreatorName = (task: Task): string | null => {
    if (!task.createdBy || task.createdBy === task.assigneeId) {
      return null // Self-assigned or no creator info
    }
    const creator = allUserProfiles.find((profile) => profile.id === task.createdBy)
    return creator?.displayName || null
  }

  const selectedTask = useMemo(
    () => myTasks.find((task) => task.id === selectedTaskId) ?? myTasks[0],
    [myTasks, selectedTaskId],
  )

  return (
    <section className="panel panel-primary">
      <header className="panel-header">
        <div>
          <h2>My Tasks</h2>
          <p>Tasks assigned to you. Shows who assigned each task if assigned by someone else.</p>
        </div>
        <button className="ghost-button" type="button" onClick={openFilter}>
          Filter
        </button>
      </header>

      {myTasks.length === 0 ? (
        <div className="empty-state">
          <h3>No tasks assigned to you</h3>
          <p>You don&apos;t have any tasks assigned yet. Tasks assigned to you will appear here.</p>
        </div>
      ) : (
        <div className="task-board">
          <div className="task-list">
            {myTasks.map((task) => {
              const creatorName = getCreatorName(task)
              const isSelfAssigned = !task.createdBy || task.createdBy === task.assigneeId

              return (
                <button
                  key={task.id}
                  type="button"
                  className={task.id === selectedTask?.id ? 'task-card active' : 'task-card'}
                  onClick={() => setSelectedTaskId(task.id)}
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
                    {creatorName ? (
                      <span
                        style={{
                          fontSize: '0.85rem',
                          color: 'var(--text-muted)',
                          fontStyle: 'italic',
                        }}
                        title={`Assigned by ${creatorName}`}
                      >
                        By {creatorName}
                      </span>
                    ) : isSelfAssigned ? (
                      <span
                        style={{
                          fontSize: '0.85rem',
                          color: 'var(--accent)',
                          fontWeight: 500,
                        }}
                        title="You assigned this task to yourself"
                      >
                        Self-assigned
                      </span>
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="task-detail">
            <header>
              <div>
                <span className="task-id">{selectedTask?.id}</span>
                <h3>{selectedTask?.title}</h3>
                {(() => {
                  const creatorName = selectedTask ? getCreatorName(selectedTask) : null
                  const isSelfAssigned = selectedTask
                    ? !selectedTask.createdBy || selectedTask.createdBy === selectedTask.assigneeId
                    : false

                  if (creatorName) {
                    return (
                      <p style={{ margin: '0.5rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        Assigned by: <strong>{creatorName}</strong>
                      </p>
                    )
                  }
                  if (isSelfAssigned) {
                    return (
                      <p style={{ margin: '0.5rem 0', fontSize: '0.9rem', color: 'var(--accent)' }}>
                        <strong>Self-assigned</strong>
                      </p>
                    )
                  }
                  return null
                })()}
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
                <span className="section-label">Due</span>
                {selectedTask?.dueDate ? (
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
                          flex: 1,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
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
      )}
    </section>
  )
}

export default MyTasksPage

