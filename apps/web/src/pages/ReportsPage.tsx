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
  // Table rows: each row has a member and their tasks
  const [tableRows, setTableRows] = useState<Array<{
    id: string // unique ID for the row
    memberId: string
    memberName: string
    tasks: string[] // Array of task descriptions
  }>>([])
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState(false)
  const [newTaskInputs, setNewTaskInputs] = useState<Record<string, string>>({}) // rowId -> new task input
  
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
    if (!userProfile || !userProfile.department || userProfile.department === 'all') {
      return []
    }
    // Check if user is department head by flag or role
    const isDeptHead = (userProfile.isDepartmentHead ?? false) || userProfile.role === 'DepartmentHead'
    if (!isDeptHead) {
      return []
    }
    return allUserProfiles.filter(
      (profile) => 
        profile.department === userProfile.department && 
        profile.id !== user?.uid &&
        profile.role !== 'Viewer'
    )
  }, [allUserProfiles, userProfile, user])

  // Add a new row to the table
  const handleAddRow = () => {
    if (departmentMembers.length === 0) return
    
    // Find first member not already added
    const availableMember = departmentMembers.find(
      (member) => !tableRows.some((row) => row.memberId === member.id)
    )
    
    if (availableMember) {
      const newRow = {
        id: `row-${Date.now()}-${Math.random()}`,
        memberId: availableMember.id,
        memberName: availableMember.displayName,
        tasks: [],
      }
      setTableRows([...tableRows, newRow])
    }
  }

  // Remove a row from the table
  const handleRemoveRow = (rowId: string) => {
    setTableRows(tableRows.filter((row) => row.id !== rowId))
  }

  // Add a task to a row
  const handleAddTask = (rowId: string, taskText: string) => {
    if (!taskText.trim()) return
    
    setTableRows(
      tableRows.map((row) => {
        if (row.id === rowId) {
          return {
            ...row,
            tasks: [...row.tasks, taskText.trim()],
          }
        }
        return row
      })
    )
  }

  // Remove a task from a row
  const handleRemoveTask = (rowId: string, taskIndex: number) => {
    setTableRows(
      tableRows.map((row) => {
        if (row.id === rowId) {
          return {
            ...row,
            tasks: row.tasks.filter((_, index) => index !== taskIndex),
          }
        }
        return row
      })
    )
  }

  // Update task text in a row
  const handleUpdateTask = (rowId: string, taskIndex: number, newText: string) => {
    setTableRows(
      tableRows.map((row) => {
        if (row.id === rowId) {
          const updatedTasks = [...row.tasks]
          updatedTasks[taskIndex] = newText
          return {
            ...row,
            tasks: updatedTasks,
          }
        }
        return row
      })
    )
  }

  const handleCreateDailyUpdate = async () => {
    if (!user || !userProfile || !firestore) {
      setCreateError('Cannot create update. Please verify your authentication and try again.')
      return
    }

    // Check if user is department head by flag or role
    const isDeptHead = (userProfile.isDepartmentHead ?? false) || userProfile.role === 'DepartmentHead'
    if (!isDeptHead || !userProfile.department || userProfile.department === 'all') {
      setCreateError('Only department heads can create daily work updates.')
      return
    }

    // Validate that at least one row with at least one task exists
    const hasValidData = tableRows.some((row) => row.tasks.length > 0)
    if (!hasValidData) {
      setCreateError('Please add at least one member with at least one task.')
      return
    }

    setIsCreating(true)
    setCreateError(null)
    setCreateSuccess(false)

    try {
      // Convert table rows to members with tasks format
      const membersWithTasks = tableRows
        .filter((row) => row.tasks.length > 0)
        .map((row) => ({
          userId: row.memberId,
          userName: row.memberName,
          tasksCompleted: row.tasks.map((taskTitle) => ({
            taskTitle,
            isManual: true, // All tasks are manual entries for printing
          })),
        }))

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
      setTableRows([])
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

  // Check if user is a department head (either by flag or by role)
  const isDepartmentHead = userProfile 
    ? (userProfile.isDepartmentHead ?? false) || userProfile.role === 'DepartmentHead'
    : false
  const userDepartment = userProfile?.department

  return (
    <AccessGuard allowedRoles={['Admin', 'Manager', 'DepartmentHead']}>
      <div className="panel">
        <header className="panel-header">
          <div>
            <h2>Reporting Workspace</h2>
            <p>Generate exports and review historical performance.</p>
          </div>
          {isDepartmentHead && userDepartment && userDepartment !== 'all' && (
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
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: '95vw', width: '1200px', maxHeight: '95vh', overflow: 'auto' }}>
            <header className="modal-header">
              <div>
                <h2>Create Daily Work Update</h2>
                <p>Create a printable daily work report for your department members.</p>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setIsCreateUpdateOpen(false)
                  setCreateError(null)
                  setCreateSuccess(false)
                  setTableRows([])
                  setNewTaskInputs({})
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
                    marginBottom: '1.5rem',
                  }}
                />
              </label>

              {/* Table for Daily Work Update */}
              <div style={{ marginTop: '1.5rem', overflowX: 'auto', minHeight: '400px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '1rem' }}>Daily Work Report Table</span>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={handleAddRow}
                    disabled={isCreating || departmentMembers.length === 0 || tableRows.length >= departmentMembers.length}
                    style={{ fontSize: '0.875rem' }}
                  >
                    + Add Row
                  </button>
                </div>

                {tableRows.length === 0 ? (
                  <div style={{
                    padding: '2rem',
                    textAlign: 'center',
                    background: 'var(--surface-elevated)',
                    borderRadius: '0.5rem',
                    color: 'var(--text-muted)'
                  }}>
                    No rows added yet. Click "+ Add Row" to add a member and their tasks.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border-soft)', borderRadius: '0.5rem' }}>
                    <table style={{ 
                      width: '100%', 
                      minWidth: '800px',
                      borderCollapse: 'collapse',
                      background: 'var(--surface-default)',
                    }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-elevated)' }}>
                        <th style={{ 
                          padding: '1rem', 
                          textAlign: 'left', 
                          borderBottom: '2px solid var(--border-soft)',
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          minWidth: '200px',
                        }}>
                          Member
                        </th>
                        <th style={{ 
                          padding: '1rem', 
                          textAlign: 'left', 
                          borderBottom: '2px solid var(--border-soft)',
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          minWidth: '500px',
                        }}>
                          Tasks
                        </th>
                        <th style={{ 
                          padding: '1rem', 
                          textAlign: 'center', 
                          borderBottom: '2px solid var(--border-soft)',
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          width: '120px',
                        }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((row) => (
                        <tr key={row.id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                          <td style={{ padding: '1rem', verticalAlign: 'top', minWidth: '200px' }}>
                            <select
                              value={row.memberId}
                              onChange={(e) => {
                                const selectedMember = departmentMembers.find(m => m.id === e.target.value)
                                if (selectedMember) {
                                  setTableRows(tableRows.map(r => 
                                    r.id === row.id 
                                      ? { ...r, memberId: selectedMember.id, memberName: selectedMember.displayName }
                                      : r
                                  ))
                                }
                              }}
                              disabled={isCreating}
                              style={{
                                padding: '0.5rem',
                                borderRadius: '0.375rem',
                                border: '1px solid var(--border-soft)',
                                fontSize: '0.875rem',
                                width: '100%',
                                background: 'var(--surface-default)',
                              }}
                            >
                              {departmentMembers.map((member) => (
                                <option key={member.id} value={member.id}>
                                  {member.displayName}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '1rem', verticalAlign: 'top', minWidth: '500px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              {row.tasks.map((task, taskIndex) => (
                                <div
                                  key={taskIndex}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.5rem',
                                    background: 'var(--surface-elevated)',
                                    borderRadius: '0.25rem',
                                  }}
                                >
                                  <input
                                    type="text"
                                    value={task}
                                    onChange={(e) => handleUpdateTask(row.id, taskIndex, e.target.value)}
                                    disabled={isCreating}
                                    style={{
                                      flex: 1,
                                      padding: '0.375rem',
                                      borderRadius: '0.25rem',
                                      border: '1px solid var(--border-soft)',
                                      fontSize: '0.875rem',
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTask(row.id, taskIndex)}
                                    disabled={isCreating}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#dc2626',
                                      cursor: 'pointer',
                                      padding: '0.25rem 0.5rem',
                                      fontSize: '1rem',
                                    }}
                                    title="Remove task"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                  type="text"
                                  value={newTaskInputs[row.id] || ''}
                                  onChange={(e) => setNewTaskInputs({ ...newTaskInputs, [row.id]: e.target.value })}
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter' && newTaskInputs[row.id]?.trim()) {
                                      e.preventDefault()
                                      handleAddTask(row.id, newTaskInputs[row.id])
                                      setNewTaskInputs({ ...newTaskInputs, [row.id]: '' })
                                    }
                                  }}
                                  placeholder="Enter task..."
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
                                  onClick={() => {
                                    if (newTaskInputs[row.id]?.trim()) {
                                      handleAddTask(row.id, newTaskInputs[row.id])
                                      setNewTaskInputs({ ...newTaskInputs, [row.id]: '' })
                                    }
                                  }}
                                  disabled={isCreating || !newTaskInputs[row.id]?.trim()}
                                  className="ghost-button"
                                  style={{
                                    fontSize: '0.75rem',
                                    padding: '0.5rem 0.75rem',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  Add
                                </button>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center', verticalAlign: 'top', width: '120px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                handleRemoveRow(row.id)
                                const newInputs = { ...newTaskInputs }
                                delete newInputs[row.id]
                                setNewTaskInputs(newInputs)
                              }}
                              disabled={isCreating}
                              className="ghost-button"
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.5rem',
                                color: '#dc2626',
                              }}
                              title="Remove row"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                    setTableRows([])
                    setNewTaskInputs({})
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
                    tableRows.filter((row) => row.tasks.length > 0).length === 0
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

