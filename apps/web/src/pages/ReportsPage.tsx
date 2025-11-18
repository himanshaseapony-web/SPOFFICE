import { useMemo, useState } from 'react'
import { AccessGuard } from '../components/AccessGuard'
import { useAppData } from '../context/AppDataContext'
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
  const { tasks, departments } = useAppData()
  const [exporting, setExporting] = useState(false)
  
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

  return (
    <AccessGuard allowedRoles={['Admin', 'Manager', 'DepartmentHead']}>
      <div className="panel">
        <header className="panel-header">
          <div>
            <h2>Reporting Workspace</h2>
            <p>Generate exports and review historical performance.</p>
          </div>
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
    </AccessGuard>
  )
}

export default ReportsPage

