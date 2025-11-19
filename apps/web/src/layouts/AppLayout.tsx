import { useMemo, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { addDoc, collection, Timestamp } from 'firebase/firestore'
import { Topbar } from '../components/Topbar'
import { Sidebar } from '../components/Sidebar'
import { RightRail } from '../components/RightRail'
import { FilterDrawer } from '../components/FilterDrawer'
import { navItems } from '../config/navigation'
import { useAppData } from '../context/AppDataContext'
import { useAuth } from '../context/AuthContext'

export function AppLayout() {
  const location = useLocation()
  const { user, loading: authLoading, authError } = useAuth()
  const { chatMessages, departments, tasks, firestore, dataError, allUserProfiles, userProfile } = useAppData()
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [isCreatingTask, setIsCreatingTask] = useState(false)

  const activeTitle = useMemo(() => {
    const directMatch = navItems.find((item) => item.path === location.pathname)
    if (directMatch) return directMatch.label

    const nestedMatch = navItems
      .filter((item) => item.path !== '/')
      .find((item) => location.pathname.startsWith(item.path))

    return nestedMatch?.label ?? navItems[0]?.label ?? 'Workspace'
  }, [location.pathname])

  const outletContext = useMemo(
    () => ({
      openCreateTask: () => setIsCreateTaskOpen(true),
      openFilter: () => setIsFilterOpen(true),
    }),
    [],
  )

  if (authLoading) {
    return (
      <div className="app-shell">
        <div className="loading-state">Loading workspace…</div>
      </div>
    )
  }

  if (authError) {
    return (
      <div className="app-shell">
        <div className="loading-state">
          <p>We couldn&apos;t connect to Firebase Authentication.</p>
          <p>{authError.message}</p>
          <p>Verify your Firebase credentials in `.env.local` and reload the page.</p>
        </div>
      </div>
    )
  }

  // Note: Authentication is now handled by ProtectedRoute at the route level
  // This check is a fallback for better UX
  if (!authLoading && !user) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="app-shell">
      <Topbar
        pageTitle={activeTitle}
        onCreateTask={() => setIsCreateTaskOpen(true)}
      />

      <div className="body">
        <Sidebar />
        <main className="main-content">
          {dataError && (
            <div className="empty-state">
              <h3>We&apos;re having trouble loading workspace data</h3>
              <p>{dataError.message}</p>
              <p>Check your Firebase configuration or network connection and reload.</p>
            </div>
          )}
          <Outlet context={outletContext} />
        </main>
        {location.pathname.startsWith('/tasks') && (
          <RightRail
            messages={chatMessages}
            departmentSummaries={departments.map((dept) => {
              const deptTasks = tasks.filter((task) => task.department === dept.name)
              return {
                name: dept.name,
                onTrack: deptTasks.filter((task) => task.status === 'In Progress').length,
                atRisk: deptTasks.filter((task) => task.status === 'Review').length,
                overdue: deptTasks.filter((task) => task.status === 'Backlog').length,
              }
            })}
          />
        )}
      </div>

      {isCreateTaskOpen && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true">
            <header className="modal-header">
              <div>
                <h2>Create Task</h2>
                <p>Draft a task and assign it to a teammate.</p>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setIsCreateTaskOpen(false)}
              >
                Close
              </button>
            </header>
            <form
              className="modal-form"
              onSubmit={async (event) => {
                event.preventDefault()
                setTaskError(null)
                
                if (!user || !firestore) {
                  setTaskError(
                    'Cannot create tasks right now. Verify Firebase configuration and try again.',
                  )
                  return
                }
                
                const formElement = event.currentTarget
                const data = new FormData(formElement)
                const title = (data.get('title') as string)?.trim() ?? ''
                const department = (data.get('department') as string)?.trim() ?? ''
                const assigneeName = (data.get('assignee') as string)?.trim() ?? ''
                const dueDate = (data.get('dueDate') as string)?.trim() ?? ''
                const summary = (data.get('summary') as string)?.trim() ?? ''
                const fileUrlsInput = (data.get('fileUrls') as string)?.trim() ?? ''

                // Validate required fields
                if (!title) {
                  setTaskError('Title is required.')
                  return
                }
                if (!department) {
                  setTaskError('Department is required.')
                  return
                }
                if (!assigneeName) {
                  setTaskError('Assignee is required.')
                  return
                }
                if (!summary) {
                  setTaskError('Summary is required.')
                  return
                }

                // Find the assignee's user ID from the selected name
                const selectedAssignee = allUserProfiles.find(
                  (profile) => profile.displayName === assigneeName
                )
                
                if (!selectedAssignee) {
                  setTaskError('Selected assignee not found. Please select a valid user.')
                  return
                }

                // Parse file URLs (comma or newline separated)
                const fileUrls = fileUrlsInput
                  ? fileUrlsInput
                      .split(/[,\n]/)
                      .map((url) => url.trim())
                      .filter((url) => url.length > 0 && (url.startsWith('http://') || url.startsWith('https://')))
                  : []

                setIsCreatingTask(true)
                
                try {
                  console.log('📝 Creating task with data:', {
                    title,
                    department,
                    assignee: assigneeName,
                    assigneeId: selectedAssignee.id,
                    dueDate,
                    summary,
                    fileUrls,
                    status: 'Backlog',
                    priority: 'Medium',
                    userRole: userProfile?.role,
                    userProfile: userProfile,
                  })
                  
                  const taskData: Record<string, any> = {
                    title,
                    department,
                    assignee: assigneeName,
                    assigneeId: selectedAssignee.id,
                    dueDate: dueDate || null,
                    summary,
                    status: 'Backlog',
                    priority: 'Medium',
                    createdAt: Timestamp.now(),
                    createdBy: user.uid,
                  }
                  
                  // Only include fileUrls if there are valid URLs
                  if (fileUrls.length > 0) {
                    taskData.fileUrls = fileUrls
                  }
                  
                  console.log('📤 Sending to Firestore:', taskData)
                  
                  const docRef = await addDoc(collection(firestore, 'tasks'), taskData)

                  console.log('✅ Task created successfully with ID:', docRef.id)
                  
                  // Reset form if it still exists
                  if (formElement) {
                    formElement.reset()
                  }
                  
                  setTaskError(null)
                  setIsCreateTaskOpen(false)
                } catch (error: any) {
                  console.error('❌ Failed to create task:', error)
                  console.error('Error code:', error.code)
                  console.error('Error message:', error.message)
                  console.error('Error name:', error.name)
                  console.error('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
                  
                  let errorMessage = 'Unable to create the task. Please try again later.'
                  if (error.code === 'permission-denied') {
                    errorMessage = `Permission denied. Check your role in Firebase Console (userProfiles/${user.uid}). Your role must be Admin, Manager, or Specialist. Current role: ${userProfile?.role || 'Unknown'}`
                  } else if (error.code === 'unavailable') {
                    errorMessage = 'Firestore is unavailable. Please check your internet connection and try again.'
                  } else if (error.code === 'failed-precondition') {
                    errorMessage = 'Firestore rules check failed. Please check your user profile exists and has the correct role.'
                  } else if (error.message) {
                    errorMessage = `Error: ${error.message} (Code: ${error.code || 'unknown'})`
                  }
                  
                  setTaskError(errorMessage)
                  
                  // Keep error visible for at least 5 seconds
                  setTimeout(() => {
                    // Only clear if user hasn't set a new error
                    setTaskError((current) => current === errorMessage ? null : current)
                  }, 10000)
                } finally {
                  setIsCreatingTask(false)
                }
              }}
            >
              <label>
                <span>Title</span>
                <input name="title" type="text" placeholder="Task title" required />
              </label>
              <label>
                <span>Department</span>
                <select name="department" required>
                  <option value="">Select department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.name}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Assignee</span>
                <select name="assignee" required>
                  <option value="">Select assignee</option>
                  {allUserProfiles.map((profile) => (
                    <option key={profile.id} value={profile.displayName}>
                      {profile.displayName} ({profile.department})
                    </option>
                  ))}
                  {allUserProfiles.length === 0 && (
                    <option disabled>No users available. Create a user profile first.</option>
                  )}
                </select>
              </label>
              <label>
                <span>Due date</span>
                <input name="dueDate" type="date" />
              </label>
              <label>
                <span>Summary</span>
                <textarea name="summary" rows={3} placeholder="Describe the task" required />
              </label>
              <label>
                <span>File URLs (optional)</span>
                <textarea 
                  name="fileUrls" 
                  rows={2} 
                  placeholder="Add file URLs (one per line or comma-separated). Example: https://example.com/file.pdf" 
                  style={{ resize: 'vertical' }}
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                  Optional: Enter URLs to share files. Invalid URLs will be ignored. Each URL should start with http:// or https://
                </small>
              </label>
              {taskError && (
                <div style={{ 
                  padding: '1rem', 
                  background: '#fee',
                  border: '1px solid #fcc',
                  borderRadius: '0.5rem',
                  margin: '1rem 0',
                  color: '#c33'
                }}>
                  <strong>Error:</strong> {taskError}
                </div>
              )}
              <footer className="modal-footer">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setTaskError(null)
                    setIsCreateTaskOpen(false)
                  }}
                  disabled={isCreatingTask}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={!firestore || Boolean(dataError) || isCreatingTask}
                >
                  {isCreatingTask ? 'Creating...' : 'Create Task'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
      <FilterDrawer isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} />
    </div>
  )
}

