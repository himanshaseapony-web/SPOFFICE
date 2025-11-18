import { useAppData } from '../context/AppDataContext'
import { AccessGuard } from '../components/AccessGuard'

export function DepartmentsPage() {
  const { departments, tasks } = useAppData()
  const availableDepartments =
    departments.length > 0
      ? departments
      : [
          { id: 'programming', name: 'Programming', slug: 'programming' },
          { id: '3d-design', name: '3D Design', slug: '3d-design' },
          { id: 'ui-ux', name: 'UI/UX', slug: 'ui-ux' },
        ]

  return (
    <AccessGuard allowedRoles={['Admin', 'Manager', 'DepartmentHead']}>
      <div className="panel">
        <header className="panel-header">
          <div>
            <h2>Department Directory</h2>
            <p>Browse teams, workloads, and escalation contacts.</p>
          </div>
          <button type="button" className="ghost-button">
            Add Department
          </button>
        </header>
        <table className="table">
          <thead>
            <tr>
              <th>Department</th>
              <th>Open Tasks</th>
              <th>At Risk</th>
              <th>Backlog</th>
              <th>Point of Contact</th>
            </tr>
          </thead>
          <tbody>
            {availableDepartments.map((dept) => {
              const deptTasks = tasks.filter((task) => task.department === dept.name)
              const openTasks = deptTasks.filter((task) => task.status !== 'Completed').length
              const atRisk = deptTasks.filter((task) => task.status === 'Review').length
              const backlog = deptTasks.filter((task) => task.status === 'Backlog').length
              return (
                <tr key={dept.id}>
                  <td>
                    <strong>{dept.name}</strong>
                  </td>
                  <td>{openTasks}</td>
                  <td>{atRisk}</td>
                  <td>{backlog}</td>
                  <td>{dept.name} Lead</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </AccessGuard>
  )
}

export default DepartmentsPage

