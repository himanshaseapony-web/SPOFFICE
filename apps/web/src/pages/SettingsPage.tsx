import { useState, useMemo, useRef, useEffect } from 'react'
import { useAppData } from '../context/AppDataContext'
import { useAuth } from '../context/AuthContext'
import { doc, updateDoc, setDoc, getDoc } from 'firebase/firestore'
import type { UserProfile } from '../context/AppDataContext'
import { uploadProfileImage, deleteProfileImage } from '../lib/storage'
import { Avatar } from '../components/Avatar'

type SettingsTab = 'workspace' | 'users' | 'departments' | 'profile'

export function SettingsPage() {
  const { userProfile, firestore, departments, allUserProfiles } = useAppData()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<SettingsTab>('workspace')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [settings, setSettings] = useState({
    workspaceName: 'SP Office',
    defaultSLA: 5,
    requireMFA: true,
    dataRetention: 18,
  })

  // User management state
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [newUser, setNewUser] = useState({
    email: '',
    displayName: '',
    password: '',
    department: '',
    role: 'Viewer' as UserProfile['role'],
    isDepartmentHead: false,
  })

  // Automatically set department to "all" when Manager role is selected
  useEffect(() => {
    if (newUser.role === 'Manager') {
      setNewUser((prev) => ({ ...prev, department: 'all' }))
    }
  }, [newUser.role])

  const handleWorkspaceSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!firestore) {
      setError('Firestore is not initialized')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const settingsRef = doc(firestore, 'settings', 'workspace')
      await setDoc(
        settingsRef,
        {
          workspaceName: settings.workspaceName,
          defaultSLA: settings.defaultSLA,
          requireMFA: settings.requireMFA,
          dataRetention: settings.dataRetention,
          updatedAt: new Date().toISOString(),
          updatedBy: userProfile?.id ?? 'unknown',
        },
        { merge: true },
      )
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      console.error('Failed to save settings', err)
      setError('Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleAddUser = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!firestore) {
      setError('Firestore is not initialized')
      return
    }

    if (!newUser.password || newUser.password.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      // Create Firebase Auth user with email and password
      // This requires a Cloud Function with Admin SDK, but for now we'll use a workaround
      // In production, you should create a Cloud Function endpoint
      
      // Option 1: Use Cloud Function (recommended)
      // const createUserResponse = await fetch('/api/createUser', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     email: newUser.email,
      //     password: newUser.password,
      //     displayName: newUser.displayName,
      //   }),
      // })
      // const { uid } = await createUserResponse.json()

      // Option 2: For development, we'll create the user profile and note that
      // the Firebase Auth user needs to be created separately or via Cloud Function
      // The user will need to sign up manually or you need to deploy a Cloud Function
      
      // For now, we'll use Firebase Auth REST API or create a temporary solution
      // Let's use the Firebase Auth REST API to create the user
      const apiKey = import.meta.env.VITE_FIREBASE_API_KEY
      if (!apiKey) {
        throw new Error('Firebase API key not configured')
      }

      // Create user via Firebase Auth REST API
      const createUserUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`
      
      const authResponse = await fetch(createUserUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newUser.email,
          password: newUser.password,
          returnSecureToken: true,
        }),
      })

      if (!authResponse.ok) {
        const errorData = await authResponse.json()
        throw new Error(errorData.error?.message || 'Failed to create user account')
      }

      const authData = await authResponse.json()
      const userId = authData.localId

      // Update the user's display name
      const updateProfileUrl = `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`
      await fetch(updateProfileUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idToken: authData.idToken,
          displayName: newUser.displayName,
          returnSecureToken: false,
        }),
      })

      // Verify admin role before attempting to create
      if (!userProfile || userProfile.role !== 'Admin') {
        throw new Error('Only Administrators can create new user profiles. Your current role: ' + (userProfile?.role ?? 'Unknown'))
      }
      
      if (!user) {
        throw new Error('User not authenticated')
      }
      
      // Double-check the role in the database to ensure it matches exactly
      const adminProfileRef = doc(firestore, 'userProfiles', user.uid)
      const adminProfileDoc = await getDoc(adminProfileRef)
      if (!adminProfileDoc.exists()) {
        throw new Error('Your user profile does not exist in Firestore. Please contact an administrator.')
      }
      
      const adminData = adminProfileDoc.data()
      const dbRole = adminData.role
      console.log('🔍 Verifying admin role in database:', {
        clientRole: userProfile.role,
        dbRole: dbRole,
        dbRoleType: typeof dbRole,
        dbRoleLength: dbRole?.length,
        exactMatch: dbRole === 'Admin',
      })
      
      if (dbRole !== 'Admin') {
        throw new Error(
          `Role mismatch detected. ` +
          `Client shows: "${userProfile.role}" but database has: "${dbRole}" (type: ${typeof dbRole}). ` +
          `The role in the database must be exactly "Admin" (case-sensitive, no spaces). ` +
          `Please update your role in the database to "Admin".`
        )
      }
      
      // Create user profile document in Firestore
      const userProfileRef = doc(firestore, 'userProfiles', userId)
      
      // Managers are in charge of all departments, so set department to "all"
      const finalDepartment = newUser.role === 'Manager' ? 'all' : newUser.department
      
      console.log('📝 Creating user profile for:', userId)
      console.log('👤 Current admin user:', user?.uid, 'Role:', userProfile?.role)
      console.log('📋 Profile data:', {
        id: userId,
        email: newUser.email,
        displayName: newUser.displayName,
        department: finalDepartment,
        role: newUser.role,
        isDepartmentHead: newUser.isDepartmentHead,
      })
      
      try {
        await setDoc(userProfileRef, {
          id: userId,
          email: newUser.email,
          displayName: newUser.displayName,
          department: finalDepartment,
          role: newUser.role,
          isDepartmentHead: newUser.isDepartmentHead,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        console.log('✅ User profile created successfully')
      } catch (createError: any) {
        console.error('❌ Failed to create user profile:', createError)
        console.error('Error code:', createError.code)
        console.error('Error message:', createError.message)
        
        if (createError.code === 'permission-denied') {
          if (!user) {
            throw new Error('User not authenticated')
          }
          // Check if admin profile exists and is accessible
          const adminProfileRef = doc(firestore, 'userProfiles', user.uid)
          try {
            const adminProfileDoc = await getDoc(adminProfileRef)
            if (adminProfileDoc.exists()) {
              const adminData = adminProfileDoc.data()
              console.error('Admin profile data:', adminData)
              throw new Error(
                `Permission denied by Firestore security rules. ` +
                `Your profile shows role: "${adminData.role}" (type: ${typeof adminData.role}). ` +
                `The security rules require exactly "Admin" (case-sensitive). ` +
                `Please verify your role in the database matches exactly "Admin".`
              )
            } else {
              throw new Error('Your user profile does not exist in Firestore. Please contact an administrator.')
            }
          } catch (checkError: any) {
            if (checkError.message.includes('Permission denied')) {
              throw checkError
            }
            throw new Error(
              `Permission denied. Firestore security rules rejected the request. ` +
              `This usually means your role in the database is not exactly "Admin" (case-sensitive). ` +
              `Error: ${createError.message}`
            )
          }
        }
        throw createError
      }

      setSuccess(true)
      setNewUser({
        email: '',
        displayName: '',
        password: '',
        department: '',
        role: 'Viewer' as UserProfile['role'],
        isDepartmentHead: false,
      })
      setIsAddUserOpen(false)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      console.error('Failed to add user', err)
      const errorMessage = err.message || 'Failed to add user. Please try again.'
      setError(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateUser = async (userId: string, updates: Partial<UserProfile>) => {
    if (!firestore) {
      setError('Firestore is not initialized')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const userProfileRef = doc(firestore, 'userProfiles', userId)
      
      // First, get the current document to ensure we don't lose any data
      const currentDoc = await getDoc(userProfileRef)
      if (!currentDoc.exists()) {
        throw new Error('User profile not found')
      }
      
      // Prepare update object, ensuring we don't include undefined values
      const updateData: Record<string, any> = {
        updatedAt: new Date().toISOString(),
      }
      
      // Only include defined values in the update
      Object.keys(updates).forEach((key) => {
        const value = updates[key as keyof UserProfile]
        if (value !== undefined && value !== null) {
          // Ensure role values are exactly as expected (case-sensitive)
          if (key === 'role' && typeof value === 'string') {
            const validRoles = ['Admin', 'Manager', 'DepartmentHead', 'Specialist', 'Viewer']
            if (!validRoles.includes(value)) {
              throw new Error(`Invalid role: ${value}. Must be one of: ${validRoles.join(', ')}`)
            }
            updateData[key] = value
          } else {
            updateData[key] = value
          }
        }
      })
      
      // Ensure we're not trying to update the id field
      delete updateData.id

      console.log('🔄 Updating user profile:', userId, 'Updates:', updateData)
      console.log('📄 Current profile data:', currentDoc.data())
      console.log('👤 Current user (admin):', user?.uid, 'Role:', userProfile?.role)
      
      // Use updateDoc - it's more efficient and works better with security rules
      // The merge approach was causing issues, so we'll use updateDoc which only updates specified fields
      console.log('💾 Updating with updateDoc:', updateData)
      
      // Ensure role is written exactly as expected (case-sensitive)
      if ('role' in updateData) {
        console.log('🔐 Writing role to database:', updateData.role, 'Type:', typeof updateData.role)
      }
      
      await updateDoc(userProfileRef, updateData)
      
      console.log('✅ updateDoc completed, waiting for real-time listener to pick up changes...')
      
      // Wait a moment for Firestore to process the update
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Verify the update by reading the document immediately after
      const updatedDoc = await getDoc(userProfileRef)
      if (updatedDoc.exists()) {
        const updatedData = updatedDoc.data()
        console.log('✅ User profile updated successfully. New data:', updatedData)
        console.log('🔍 Role changed to:', updatedData.role)
        console.log('🔍 isDepartmentHead:', updatedData.isDepartmentHead)
        console.log('🔍 Department:', updatedData.department)
        
        // Verify the specific fields were updated
        if ('role' in updateData) {
          const expectedRole = updateData.role
          const actualRole = updatedData.role
          if (actualRole === expectedRole) {
            console.log('✅ Role update confirmed in database:', actualRole)
          } else {
            console.error('❌ Role mismatch! Expected:', expectedRole, 'Got:', actualRole, 'Type:', typeof actualRole)
            console.error('📊 Full updated data:', updatedData)
          }
        }
        
        if ('isDepartmentHead' in updateData) {
          const expectedDeptHead = updateData.isDepartmentHead
          const actualDeptHead = updatedData.isDepartmentHead
          if (actualDeptHead === expectedDeptHead) {
            console.log('✅ isDepartmentHead update confirmed in database:', actualDeptHead)
          } else {
            console.error('❌ isDepartmentHead mismatch! Expected:', expectedDeptHead, 'Got:', actualDeptHead)
          }
        }
      } else {
        console.error('⚠️ Document does not exist after update!')
        throw new Error('Document was deleted or does not exist after update')
      }
      
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      console.error('❌ Failed to update user', err)
      const errorMessage = err.message || 'Failed to update user. Please try again.'
      setError(errorMessage)
      
      // Log more details for debugging
      if (err.code) {
        console.error('Error code:', err.code)
        if (err.code === 'permission-denied') {
          setError('Permission denied. You may not have access to update this user.')
        }
      }
    } finally {
      setSaving(false)
    }
  }

  const departmentHeads = useMemo(() => {
    return allUserProfiles.filter((u) => u.isDepartmentHead)
  }, [allUserProfiles])

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user || !firestore) return

    setUploadingImage(true)
    setError(null)
    setSuccess(false)

    try {
      // Delete old image if exists
      if (userProfile?.profileImageUrl) {
        await deleteProfileImage(userProfile.profileImageUrl)
      }

      // Upload new image
      const imageUrl = await uploadProfileImage(user.uid, file)

      // Update user profile
      const userProfileRef = doc(firestore, 'userProfiles', user.uid)
      await updateDoc(userProfileRef, {
        profileImageUrl: imageUrl,
        updatedAt: new Date().toISOString(),
      })

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      console.error('Failed to upload profile image', err)
      setError(err.message || 'Failed to upload profile image. Please try again.')
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveImage = async () => {
    if (!user || !firestore || !userProfile?.profileImageUrl) return

    setUploadingImage(true)
    setError(null)
    setSuccess(false)

    try {
      await deleteProfileImage(userProfile.profileImageUrl)

      const userProfileRef = doc(firestore, 'userProfiles', user.uid)
      await updateDoc(userProfileRef, {
        profileImageUrl: null,
        updatedAt: new Date().toISOString(),
      })

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      console.error('Failed to remove profile image', err)
      setError(err.message || 'Failed to remove profile image. Please try again.')
    } finally {
      setUploadingImage(false)
    }
  }

  // Profile tab is accessible to all users, other tabs require Admin
  const isAdmin = userProfile?.role === 'Admin'
  const showAdminTabs = isAdmin

  // Default to profile tab for non-admin users
  useEffect(() => {
    if (!isAdmin && activeTab !== 'profile' && (activeTab === 'workspace' || activeTab === 'users' || activeTab === 'departments')) {
      setActiveTab('profile')
    }
  }, [isAdmin, activeTab])

  return (
    <div className="panel">
        <header className="panel-header">
          <div>
            <h2>Settings</h2>
            <p>{isAdmin ? 'Manage workspace, users, and access control.' : 'Manage your profile and account settings.'}</p>
          </div>
        </header>

        <div className="settings-tabs">
          {showAdminTabs && (
            <>
              <button
                type="button"
                className={activeTab === 'workspace' ? 'tab-button active' : 'tab-button'}
                onClick={() => setActiveTab('workspace')}
              >
                Workspace
              </button>
              <button
                type="button"
                className={activeTab === 'users' ? 'tab-button active' : 'tab-button'}
                onClick={() => setActiveTab('users')}
              >
                Users
              </button>
              <button
                type="button"
                className={activeTab === 'departments' ? 'tab-button active' : 'tab-button'}
                onClick={() => setActiveTab('departments')}
              >
                Department Heads
              </button>
            </>
          )}
          <button
            type="button"
            className={activeTab === 'profile' ? 'tab-button active' : 'tab-button'}
            onClick={() => setActiveTab('profile')}
          >
            My Profile
          </button>
        </div>

        {showAdminTabs && activeTab === 'workspace' && (
          <form className="settings-form" onSubmit={handleWorkspaceSubmit}>
            <label>
              <span>Workspace name</span>
              <input
                type="text"
                value={settings.workspaceName}
                onChange={(e) => setSettings({ ...settings, workspaceName: e.target.value })}
              />
            </label>
            <label>
              <span>Default task SLA (days)</span>
              <input
                type="number"
                min={1}
                value={settings.defaultSLA}
                onChange={(e) =>
                  setSettings({ ...settings, defaultSLA: parseInt(e.target.value) || 5 })
                }
              />
            </label>
            <label>
              <span>Require MFA for admins</span>
              <div className="toggle">
                <input
                  type="checkbox"
                  checked={settings.requireMFA}
                  onChange={(e) => setSettings({ ...settings, requireMFA: e.target.checked })}
                />
                <div className="toggle-display" />
              </div>
            </label>
            <label>
              <span>Data retention (months)</span>
              <input
                type="number"
                min={1}
                value={settings.dataRetention}
                onChange={(e) =>
                  setSettings({ ...settings, dataRetention: parseInt(e.target.value) || 18 })
                }
              />
            </label>
            {error && <p className="login-error">{error}</p>}
            {success && <p style={{ color: 'var(--accent)' }}>Settings saved successfully!</p>}
            <footer className="settings-footer">
              <button type="submit" className="primary-button" disabled={saving || !firestore}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </footer>
          </form>
        )}

        {showAdminTabs && activeTab === 'users' && (
          <div className="settings-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3>User Management</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  Add and manage users in your workspace.
                </p>
              </div>
              <button
                type="button"
                className="primary-button"
                onClick={() => setIsAddUserOpen(true)}
              >
                Add User
              </button>
            </div>

            {isAddUserOpen && (
              <div className="panel" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                <h4 style={{ marginTop: 0 }}>Add New User</h4>
                <form className="settings-form" onSubmit={handleAddUser}>
                  <label>
                    <span>Email</span>
                    <input
                      type="email"
                      required
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      placeholder="user@example.com"
                    />
                  </label>
                  <label>
                    <span>Password</span>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      placeholder="Minimum 6 characters"
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                      Password must be at least 6 characters long
                    </small>
                  </label>
                  <label>
                    <span>Display Name</span>
                    <input
                      type="text"
                      required
                      value={newUser.displayName}
                      onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                      placeholder="John Doe"
                    />
                  </label>
                  <label>
                    <span>Department</span>
                    {newUser.role === 'Manager' ? (
                      <div style={{ 
                        padding: '0.75rem', 
                        background: 'var(--surface-subtle)', 
                        borderRadius: '0.5rem',
                        color: 'var(--text-secondary)',
                        fontSize: '0.9rem'
                      }}>
                        Managers are in charge of all departments. No department selection needed.
                      </div>
                    ) : (
                      <select
                        required
                        value={newUser.department}
                        onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                      >
                        <option value="">Select department</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.name}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </label>
                  <label>
                    <span>Role</span>
                    <select
                      value={newUser.role}
                      onChange={(e) =>
                        setNewUser({ ...newUser, role: e.target.value as UserProfile['role'] })
                      }
                    >
                      <option value="Viewer">Viewer</option>
                      <option value="Specialist">Specialist</option>
                      <option value="DepartmentHead">Department Head</option>
                      <option value="Manager">Manager</option>
                    </select>
                  </label>
                  <label>
                    <span>Make Department Head</span>
                    <div className="toggle">
                      <input
                        type="checkbox"
                        checked={newUser.isDepartmentHead}
                        onChange={(e) =>
                          setNewUser({
                            ...newUser,
                            isDepartmentHead: e.target.checked,
                            role: e.target.checked ? 'DepartmentHead' : newUser.role,
                          })
                        }
                      />
                      <div className="toggle-display" />
                    </div>
                  </label>
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => {
                        setIsAddUserOpen(false)
                        setNewUser({
                          email: '',
                          displayName: '',
                          password: '',
                          department: '',
                          role: 'Viewer',
                          isDepartmentHead: false,
                        })
                      }}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="primary-button" disabled={saving}>
                      {saving ? 'Adding...' : 'Add User'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Department</th>
                    <th>Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allUserProfiles.map((profile) => (
                    <tr key={profile.id}>
                      <td>{profile.displayName}</td>
                      <td>{profile.email}</td>
                      <td>{profile.department}</td>
                      <td>
                        {profile.role}
                        {profile.isDepartmentHead && (
                          <span style={{ marginLeft: '0.5rem', color: 'var(--accent)' }}>
                            (Head)
                          </span>
                        )}
                      </td>
                      <td>
                        <select
                          value={profile.role}
                          onChange={async (e) => {
                            const newRole = e.target.value as UserProfile['role']
                            console.log(`🔄 Changing role for ${profile.displayName} (${profile.id}) from ${profile.role} to ${newRole}`)
                            
                            // If changing from/to DepartmentHead, update isDepartmentHead flag
                            const updates: Partial<UserProfile> = {
                              role: newRole,
                            }
                            
                            // Managers are in charge of all departments
                            if (newRole === 'Manager') {
                              updates.department = 'all'
                              console.log('🔧 Setting department to "all" for Manager role')
                            }
                            
                            if (newRole === 'DepartmentHead' && !profile.isDepartmentHead) {
                              updates.isDepartmentHead = true
                              console.log('🔧 Setting isDepartmentHead to true for DepartmentHead role')
                            } else if (newRole !== 'DepartmentHead' && profile.isDepartmentHead) {
                              updates.isDepartmentHead = false
                              console.log('🔧 Setting isDepartmentHead to false (not DepartmentHead)')
                            }
                            
                            console.log('📝 Final updates object:', updates)
                            
                            try {
                              await handleUpdateUser(profile.id, updates)
                              console.log('✅ Role update completed for user:', profile.id)
                            } catch (error) {
                              console.error('❌ Failed to update role:', error)
                            }
                          }}
                          style={{ fontSize: '0.85rem', padding: '0.35rem 0.5rem' }}
                        >
                          <option value="Viewer">Viewer</option>
                          <option value="Specialist">Specialist</option>
                          <option value="DepartmentHead">Department Head</option>
                          <option value="Manager">Manager</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showAdminTabs && activeTab === 'departments' && (
          <div className="settings-section">
            <div style={{ marginBottom: '1.5rem' }}>
              <h3>Department Heads</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                Department heads can view and manage all tasks in their department. Assign department
                heads to give them oversight of their team&apos;s work.
              </p>
            </div>

            <div className="summary-list">
              {departments.map((dept) => {
                const head = departmentHeads.find((h) => h.department === dept.name)
                return (
                  <div key={dept.id} className="summary-card">
                    <div>
                      <span className="section-label">{dept.name}</span>
                      <strong>{head ? head.displayName : 'No head assigned'}</strong>
                      {head && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{head.email}</span>}
                    </div>
                    <div>
                      <select
                        value={head?.id || ''}
                        onChange={(e) => {
                          const userId = e.target.value
                          if (userId) {
                            // Remove department head from current user if exists
                            if (head) {
                              handleUpdateUser(head.id, { isDepartmentHead: false, role: 'Specialist' })
                            }
                            // Set new department head
                            handleUpdateUser(userId, {
                              isDepartmentHead: true,
                              role: 'DepartmentHead',
                              department: dept.name,
                            })
                          }
                        }}
                        style={{ fontSize: '0.85rem', padding: '0.5rem' }}
                      >
                        <option value="">Select user...</option>
                        {allUserProfiles
                          .filter((u) => u.department === dept.name)
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.displayName} ({u.role})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="settings-section">
            <div style={{ marginBottom: '1.5rem' }}>
              <h3>Profile Picture</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                Upload a profile image to personalize your account.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <Avatar
                displayName={userProfile?.displayName}
                email={user?.email ?? undefined}
                profileImageUrl={userProfile?.profileImageUrl}
                size="large"
              />
              <div style={{ flex: 1 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  style={{ display: 'none' }}
                  id="profile-image-input"
                />
                <label htmlFor="profile-image-input">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                  >
                    {uploadingImage ? 'Uploading...' : userProfile?.profileImageUrl ? 'Change Image' : 'Upload Image'}
                  </button>
                </label>
                {userProfile?.profileImageUrl && (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={handleRemoveImage}
                    disabled={uploadingImage}
                    style={{ marginLeft: '0.75rem' }}
                  >
                    Remove
                  </button>
                )}
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  JPG, PNG or GIF. Max size 5MB.
                </p>
              </div>
            </div>

            <div style={{ padding: '1rem', background: 'var(--surface-subtle)', borderRadius: '0.75rem' }}>
              <h4 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Profile Information</h4>
              <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
                <div>
                  <strong>Name:</strong> {userProfile?.displayName ?? 'Not set'}
                </div>
                <div>
                  <strong>Email:</strong> {user?.email ?? 'Not set'}
                </div>
                <div>
                  <strong>Department:</strong> {userProfile?.department ?? 'Not set'}
                </div>
                <div>
                  <strong>Role:</strong> {userProfile?.role ?? 'Not set'}
                </div>
              </div>
            </div>
          </div>
        )}

        {error && activeTab !== 'workspace' && <p className="login-error">{error}</p>}
        {success && activeTab !== 'workspace' && (
          <p style={{ color: 'var(--accent)' }}>Changes saved successfully!</p>
        )}

        <div className="panel-footer">
          <small>
            Signed in as {userProfile?.displayName ?? 'Unknown'} ({userProfile?.role})
          </small>
        </div>
    </div>
  )
}

export default SettingsPage
