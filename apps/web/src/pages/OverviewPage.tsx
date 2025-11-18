import { useAppData } from '../context/AppDataContext'

export function OverviewPage() {
  const { tasks, departments } = useAppData()
  const activeTasks = tasks.filter((task) => task.status !== 'Completed')

  return (
    <div className="overview-grid">
      <section className="panel">
        <header className="panel-header">
          <div>
            <h2>Today&apos;s Focus</h2>
            <p>Quick summary of workload across departments.</p>
          </div>
        </header>
        <div className="metrics-grid">
          <div className="metric-card">
            <span className="section-label">Active tasks</span>
            <strong>{activeTasks.length}</strong>
            <p>Tasks currently in progress or review.</p>
          </div>
          <div className="metric-card">
            <span className="section-label">Departments</span>
            <strong>{(departments.length || 3).toString()}</strong>
            <p>Teams connected into SP Office today.</p>
          </div>
          <div className="metric-card">
            <span className="section-label">At risk</span>
            <strong>
              {tasks.filter((task) => task.status === 'Review').length}
            </strong>
            <p>Workstreams needing manager attention.</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <div>
            <h2>Department Health</h2>
            <p>Use this to guide standups and unblock teams.</p>
          </div>
        </header>
        <ul className="summary-list">
          {(
            departments.length > 0
              ? departments
              : [
                  { id: 'programming', name: 'Programming' },
                  { id: '3d-design', name: '3D Design' },
                  { id: 'ui-ux', name: 'UI/UX' },
                ]
          ).map((dept) => {
            const deptTasks = tasks.filter((task) => task.department === dept.name)
            const onTrack = deptTasks.filter((task) => task.status === 'In Progress').length
            const atRisk = deptTasks.filter((task) => task.status === 'Review').length
            const overdue = deptTasks.filter((task) => task.status === 'Backlog').length
            return (
              <li key={dept.id ?? dept.name} className="summary-card">
                <div>
                  <span className="section-label">{dept.name}</span>
                  <strong>{onTrack} on track</strong>
                </div>
                <div className="summary-stats">
                  <span>{atRisk} at risk</span>
                  <span>{overdue} backlog</span>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="panel">
        <header className="panel-header">
          <div>
            <h2>Working Agreements</h2>
            <p>SP Office keeps everyone aligned on how work moves forward.</p>
          </div>
        </header>
        <ol className="agreement-list">
          <li>All new tasks start in Backlog and require a summary, owner, and due date.</li>
          <li>Updates belong in departmental chats to keep everyone informed asynchronously.</li>
          <li>Escalations happen automatically when tasks exceed their SLA timelines.</li>
        </ol>
      </section>
    </div>
  )
}

export default OverviewPage

