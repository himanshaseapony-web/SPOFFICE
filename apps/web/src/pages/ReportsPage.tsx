import { useMemo, useState } from 'react'
import { AccessGuard } from '../components/AccessGuard'
import { useAppData } from '../context/AppDataContext'
import { useAuth } from '../context/AuthContext'
import type { Task } from '../context/AppDataContext'

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
  const { tasks, departments, allUserProfiles, userProfile } = useAppData()
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

  // Export daily work update table to CSV
  const handlePrintDailyUpdate = () => {
    try {
      console.log('🔵 CSV Export Started', { tableRowsCount: tableRows.length, updateDate })
      
      // Validate that at least one row with at least one task exists
      const rowsWithTasks = tableRows.filter((row) => row.tasks && row.tasks.length > 0)
      console.log('🔵 Rows with tasks:', rowsWithTasks.length)
      
      if (rowsWithTasks.length === 0) {
        alert('Please add at least one member with at least one task before downloading.')
        return
      }

      // Format date for filename
      const dateStr = updateDate ? updateDate : new Date().toISOString().split('T')[0]
      const departmentName = userProfile?.department || 'Department'
      
      console.log('🔵 Generating CSV for:', { dateStr, departmentName })
      
      // Create CSV rows - one row per task (Member, Task format)
      const csvRows: string[][] = []
      
      // Add header
      csvRows.push(['Member', 'Task'])
      
      // Add date and department info
      csvRows.push([`Date: ${dateStr}`, `Department: ${departmentName}`])
      csvRows.push(['', '']) // Empty row for spacing
      
      // Add data rows - one row per task, with member name on each row for better readability
      rowsWithTasks.forEach((row) => {
        if (!row.tasks || row.tasks.length === 0) return
        
        // Add each task with member name for better print readability
        row.tasks.forEach((task) => {
          if (task && typeof task === 'string' && task.trim()) {
            csvRows.push([
              row.memberName || '',
              task.trim()
            ])
          }
        })
        
        // Add empty row between members for readability
        csvRows.push(['', ''])
      })

      console.log('🔵 CSV rows prepared:', csvRows.length)

      // Convert to CSV string - format all rows
      const csvLines: string[] = []
      
      csvRows.forEach((row) => {
        if (!row || row.length < 2) {
          csvLines.push('"",""')
        } else {
          const member = String(row[0] || '').replace(/"/g, '""')
          const task = String(row[1] || '').replace(/"/g, '""')
          csvLines.push(`"${member}","${task}"`)
        }
      })
      
      const csvContent = csvLines.join('\n')

      console.log('🔵 CSV content generated, length:', csvContent.length, 'rows:', csvLines.length)

      if (!csvContent || csvContent.trim().length === 0) {
        alert('No data to export. Please add tasks to the table.')
        return
      }

      // Create and download file - EXACT same pattern as exportTasksToCSV
      const sanitizedDeptName = departmentName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
      const filename = `daily-work-update-${sanitizedDeptName}-${dateStr}.csv`
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
    } catch (error: any) {
      console.error('❌ CSV Export Error:', error)
      alert(`Failed to download CSV: ${error?.message || 'Unknown error'}. Check console for details.`)
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
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '95vw', width: '1200px', maxHeight: '95vh', overflow: 'auto' }}>
            <header className="modal-header">
              <div>
                <h2>Daily Work Update Report</h2>
                <p>Add members and their tasks to generate a printable CSV report. Click "Download CSV / Print" to export.</p>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setIsCreateUpdateOpen(false)
                  setTableRows([])
                  setNewTaskInputs({})
                }}
              >
                Close
              </button>
            </header>

            <div className="modal-form" style={{ padding: '1.5rem' }}>

              <label>
                <span>Date</span>
                <input
                  type="date"
                  value={updateDate}
                  onChange={(e) => setUpdateDate(e.target.value)}
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
                    disabled={departmentMembers.length === 0 || tableRows.length >= departmentMembers.length}
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
                                  disabled={!newTaskInputs[row.id]?.trim()}
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
                    setTableRows([])
                    setNewTaskInputs({})
                  }}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    console.log('🖱️ Button clicked!', { tableRows, rowsWithTasks: tableRows.filter((row) => row.tasks && row.tasks.length > 0).length })
                    handlePrintDailyUpdate()
                  }}
                  disabled={tableRows.filter((row) => row.tasks && row.tasks.length > 0).length === 0}
                >
                  📄 Download CSV / Print
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

