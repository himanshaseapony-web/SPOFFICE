export type NavItem = {
  label: string
  path: string
  allowedRoles?: Array<'Admin' | 'Manager' | 'DepartmentHead' | 'Specialist' | 'Viewer'>
}

export const navItems: NavItem[] = [
  { label: 'Overview', path: '/' },
  { label: 'Task Board', path: '/tasks' },
  { label: 'My Tasks', path: '/my-tasks', allowedRoles: ['Specialist', 'DepartmentHead'] },
  { label: 'Company Chat', path: '/company-chat' },
  { label: 'In Progress', path: '/in-progress', allowedRoles: ['Admin', 'Manager'] },
  { label: 'Departments', path: '/departments', allowedRoles: ['Admin', 'Manager', 'DepartmentHead'] },
  { label: 'Reports', path: '/reports', allowedRoles: ['Admin', 'Manager', 'DepartmentHead'] },
  { label: 'Automation', path: '/automation', allowedRoles: ['Admin'] },
  { label: 'Settings', path: '/settings' },
]

