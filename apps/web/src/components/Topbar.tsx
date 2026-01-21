import { useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useAppData } from '../context/AppDataContext'
import { useTheme } from '../context/ThemeContext'
import { Avatar } from './Avatar'

type TopbarProps = {
  pageTitle: string
  onCreateTask?: () => void
}

export function Topbar({ pageTitle, onCreateTask }: TopbarProps) {
  const { user, signOutUser } = useAuth()
  const { userProfile } = useAppData()
  const { theme, toggleTheme } = useTheme()


  // Debug: log user profile role
  useMemo(() => {
    if (userProfile) {
      console.log('🔍 Topbar - User role:', userProfile.role, 'Full profile:', userProfile)
    } else if (user) {
      console.log('⚠️ Topbar - User profile is null for user:', user.uid)
    }
  }, [userProfile, user])

  const canCreateTask =
    !!onCreateTask && ['Admin', 'Manager', 'DepartmentHead', 'Specialist'].includes(userProfile?.role ?? 'Viewer')

  return (
    <header className="topbar">
      <div className="brand">
        <img 
          src="/sea-pony-logo.png" 
          alt="Sea Pony Studios" 
          className="brand-logo"
          onError={(e) => {
            console.error('Logo failed to load:', e)
            const target = e.target as HTMLImageElement
            target.style.display = 'none'
          }}
        />
        <div className="brand-stack">
          <span className="brand-name">SP Office</span>
          <span className="brand-subtitle">{pageTitle}</span>
        </div>
      </div>
      <div className="topbar-actions">
        <button
          className="ghost-button theme-toggle"
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          )}
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={() => onCreateTask?.()}
          disabled={!canCreateTask}
        >
          Create Task
        </button>
        <div className="user-chip">
          <Avatar
            displayName={user?.displayName ?? undefined}
            email={user?.email ?? undefined}
            profileImageUrl={userProfile?.profileImageUrl}
            size="medium"
            className="user-avatar"
          />
          <div>
            <strong>{user?.displayName ?? user?.email ?? 'Unknown User'}</strong>
            <span>{userProfile?.role ?? 'Viewer'}</span>
          </div>
        </div>
        <button className="ghost-button" type="button" onClick={() => void signOutUser()}>
          Sign out
        </button>
      </div>
    </header>
  )
}

