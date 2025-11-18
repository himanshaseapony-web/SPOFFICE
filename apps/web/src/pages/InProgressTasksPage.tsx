import { useMemo } from 'react'
import { AccessGuard } from '../components/AccessGuard'
import { useAppData } from '../context/AppDataContext'
import { Avatar } from '../components/Avatar'
import type { Task } from '../context/AppDataContext'

function formatDueDate(dateString: string): string {
  if (!dateString) return 'No due date'
  const parsed = new Date(dateString)
  if (isNaN(parsed.getTime())) return 'Invalid date'
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: parsed.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  })
}

export function InProgressTasksPage() {
  const { tasks, allUserProfiles } = useAppData()

  // Filter tasks that are "In Progress"
  const inProgressTasks = useMemo(() => {
    return tasks.filter((task) => task.status === 'In Progress')
  }, [tasks])

  // Group tasks by assignee
  const tasksByUser = useMemo(() => {
    const grouped: Record<string, { user: typeof allUserProfiles[0] | undefined; tasks: Task[] }> = {}
    
    inProgressTasks.forEach((task) => {
      const assigneeId = task.assigneeId
      if (!grouped[assigneeId]) {
        grouped[assigneeId] = {
          user: allUserProfiles.find((p) => p.id === assigneeId),
          tasks: [],
        }
      }
      grouped[assigneeId].tasks.push(task)
    })

    // Sort by number of tasks (descending), then by user name
    return Object.values(grouped).sort((a, b) => {
      if (b.tasks.length !== a.tasks.length) {
        return b.tasks.length - a.tasks.length
      }
      const aName = a.user?.displayName || a.user?.email || 'Unknown'
      const bName = b.user?.displayName || b.user?.email || 'Unknown'
      return aName.localeCompare(bName)
    })
  }, [inProgressTasks, allUserProfiles])

  // Priority label mapping
  const priorityLabel: Record<Task['priority'], string> = {
    Low: 'Low priority',
    Medium: 'Medium priority',
    High: 'High priority',
  }

  const priorityColor: Record<Task['priority'], string> = {
    Low: 'var(--text-muted)',
    Medium: 'var(--accent)',
    High: '#dc2626',
  }

  return (
    <AccessGuard allowedRoles={['Admin', 'Manager']}>
      <div className="panel">
        <header className="panel-header">
          <div>
            <h2>In Progress Tasks</h2>
            <p>View what tasks users are currently working on</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="section-label">
              {inProgressTasks.length} task{inProgressTasks.length !== 1 ? 's' : ''} in progress
            </span>
          </div>
        </header>

        {tasksByUser.length === 0 ? (
          <div className="empty-state">
            <h3>No tasks in progress</h3>
            <p>There are currently no tasks with "In Progress" status.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {tasksByUser.map(({ user: assignee, tasks: userTasks }) => {
              const displayName = assignee?.displayName || assignee?.email || 'Unassigned'
              const department = assignee?.department || 'No department'
              const role = assignee?.role || 'Unknown'

              return (
                <section
                  key={assignee?.id || 'unassigned'}
                  style={{
                    padding: '1.5rem',
                    background: 'var(--surface-elevated)',
                    borderRadius: '0.75rem',
                    border: '1px solid var(--border-soft)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      marginBottom: '1rem',
                      paddingBottom: '1rem',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    <Avatar
                      displayName={displayName}
                      email={assignee?.email}
                      profileImageUrl={assignee?.profileImageUrl}
                      size="large"
                    />
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: 0, marginBottom: '0.25rem' }}>{displayName}</h3>
                      <div
                        style={{
                          display: 'flex',
                          gap: '1rem',
                          fontSize: '0.875rem',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <span>{department}</span>
                        <span>•</span>
                        <span>{role}</span>
                        <span>•</span>
                        <span>
                          <strong>{userTasks.length}</strong> task{userTasks.length !== 1 ? 's' : ''} in progress
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {userTasks.map((task) => (
                      <div
                        key={task.id}
                        style={{
                          padding: '1rem',
                          background: 'var(--surface-default)',
                          borderRadius: '0.5rem',
                          border: '1px solid var(--border-soft)',
                          transition: 'border-color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--accent)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border-soft)'
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
                          <div style={{ flex: 1 }}>
                            <h4 style={{ margin: 0, marginBottom: '0.25rem', fontSize: '1rem' }}>
                              {task.title}
                            </h4>
                            <p
                              style={{
                                margin: 0,
                                fontSize: '0.875rem',
                                color: 'var(--text-secondary)',
                                lineHeight: 1.5,
                              }}
                            >
                              {task.summary}
                            </p>
                          </div>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            gap: '1rem',
                            alignItems: 'center',
                            fontSize: '0.875rem',
                            color: 'var(--text-muted)',
                            flexWrap: 'wrap',
                          }}
                        >
                          <span
                            style={{
                              padding: '0.25rem 0.5rem',
                              borderRadius: '0.25rem',
                              background: 'var(--accent-soft)',
                              color: 'var(--accent)',
                              fontWeight: 500,
                            }}
                          >
                            {task.department}
                          </span>
                          <span
                            style={{
                              color: priorityColor[task.priority],
                              fontWeight: 500,
                            }}
                          >
                            {priorityLabel[task.priority]}
                          </span>
                          <span>Due: {formatDueDate(task.dueDate)}</span>
                          {task.fileUrls && task.fileUrls.length > 0 && (
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                              }}
                            >
                              📎 {task.fileUrls.length} file{task.fileUrls.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </AccessGuard>
  )
}

export default InProgressTasksPage

