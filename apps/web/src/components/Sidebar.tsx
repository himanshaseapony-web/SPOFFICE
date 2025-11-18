import { NavLink } from 'react-router-dom'
import { navItems } from '../config/navigation'
import { useAppData } from '../context/AppDataContext'

export function Sidebar() {
  const { userProfile, departments } = useAppData()
  const allowedDepartments =
    departments.length > 0
      ? departments
      : [
          { id: 'programming', name: 'Programming', slug: 'programming' },
          { id: '3d-design', name: '3D Design', slug: '3d-design' },
          { id: 'ui-ux', name: 'UI/UX', slug: 'ui-ux' },
        ]
  const role = userProfile?.role ?? 'Viewer'
  
  // Validate role is one of the allowed values
  const validRoles = ['Admin', 'Manager', 'DepartmentHead', 'Specialist', 'Viewer']
  const normalizedRole = validRoles.includes(role) ? role : 'Viewer'

  return (
    <nav className="sidebar">
      <div className="sidebar-section">
        <span className="sidebar-label">Navigation</span>
        <ul>
          {navItems
            .filter((item) => !item.allowedRoles || item.allowedRoles.includes(normalizedRole))
            .map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    isActive ? 'sidebar-link active' : 'sidebar-link'
                  }
                  end={item.path === '/'}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
        </ul>
      </div>

      <div className="sidebar-section">
        <span className="sidebar-label">Departments</span>
        <ul className="tag-list">
          {allowedDepartments.map((dept) => (
            <li key={dept.id}>
              <span className="tag">{dept.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}

