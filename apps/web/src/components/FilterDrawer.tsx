import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useAppData, type TaskFilters } from '../context/AppDataContext'

type FilterDrawerProps = {
  isOpen: boolean
  onClose: () => void
}

export function FilterDrawer({ isOpen, onClose }: FilterDrawerProps) {
  const { departments, filters, setFilters } = useAppData()
  const [localFilters, setLocalFilters] = useState<TaskFilters>(filters)

  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  const departmentOptions =
    departments.length > 0
      ? departments
      : [
          { id: 'programming', name: 'Programming', slug: 'programming' },
          { id: '3d-design', name: '3D Design', slug: '3d-design' },
          { id: 'ui-ux', name: 'UI/UX', slug: 'ui-ux' },
        ]

  const handleStatusChange = (status: TaskFilters['statuses'][0], checked: boolean) => {
    setLocalFilters((prev) => ({
      ...prev,
      statuses: checked
        ? [...prev.statuses, status]
        : prev.statuses.filter((s) => s !== status),
    }))
  }

  const handlePriorityChange = (priority: TaskFilters['priorities'][0], checked: boolean) => {
    setLocalFilters((prev) => ({
      ...prev,
      priorities: checked
        ? [...prev.priorities, priority]
        : prev.priorities.filter((p) => p !== priority),
    }))
  }

  const handleDepartmentChange = (deptName: string, checked: boolean) => {
    setLocalFilters((prev) => ({
      ...prev,
      departments: checked
        ? [...prev.departments, deptName]
        : prev.departments.filter((d) => d !== deptName),
    }))
  }

  const handleApply = (event: FormEvent) => {
    event.preventDefault()
    setFilters(localFilters)
    onClose()
  }

  const handleReset = () => {
    const defaultFilters: TaskFilters = {
      statuses: ['Backlog', 'In Progress', 'Review', 'Completed'],
      priorities: ['High', 'Medium', 'Low'],
      departments: [],
    }
    setLocalFilters(defaultFilters)
    setFilters(defaultFilters)
  }

  return (
    <div className={isOpen ? 'filter-drawer open' : 'filter-drawer'}>
      <header className="filter-header">
        <div>
          <h3>Filter Tasks</h3>
          <p>Refine by status, priority, and department.</p>
        </div>
        <button type="button" className="ghost-button" onClick={onClose}>
          Close
        </button>
      </header>
      <form className="filter-form" onSubmit={handleApply}>
        <fieldset>
          <legend>Status</legend>
          {(['Backlog', 'In Progress', 'Review', 'Completed'] as const).map((status) => (
            <label key={status}>
              <input
                type="checkbox"
                checked={localFilters.statuses.includes(status)}
                onChange={(e) => handleStatusChange(status, e.target.checked)}
              />
              <span>{status}</span>
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Priority</legend>
          {(['High', 'Medium', 'Low'] as const).map((priority) => (
            <label key={priority}>
              <input
                type="checkbox"
                checked={localFilters.priorities.includes(priority)}
                onChange={(e) => handlePriorityChange(priority, e.target.checked)}
              />
              <span>{priority}</span>
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Department</legend>
          {departmentOptions.map((dept) => (
            <label key={dept.id}>
              <input
                type="checkbox"
                checked={localFilters.departments.includes(dept.name)}
                onChange={(e) => handleDepartmentChange(dept.name, e.target.checked)}
              />
              <span>{dept.name}</span>
            </label>
          ))}
        </fieldset>
      </form>
      <footer className="filter-footer">
        <button type="button" className="ghost-button" onClick={handleReset}>
          Reset
        </button>
        <button type="button" className="primary-button" onClick={handleApply}>
          Apply Filters
        </button>
      </footer>
    </div>
  )
}
