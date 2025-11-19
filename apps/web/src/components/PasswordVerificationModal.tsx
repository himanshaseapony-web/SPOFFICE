import { useState, type FormEvent } from 'react'
import { reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth'
import { useAuth } from '../context/AuthContext'
import { PasswordInput } from './PasswordInput'

type PasswordVerificationModalProps = {
  isOpen: boolean
  onClose: () => void
  onVerify: () => Promise<void>
  title: string
  message: string
}

export function PasswordVerificationModal({
  isOpen,
  onClose,
  onVerify,
  title,
  message,
}: PasswordVerificationModalProps) {
  const { user } = useAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)

  if (!isOpen) return null

  // Check if user has email/password provider (not OAuth)
  const hasEmailPassword = user?.providerData?.some(
    (provider) => provider.providerId === 'password'
  ) ?? false

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!user || !user.email) {
      setError('User not authenticated')
      return
    }

    // If user doesn't have email/password, they can't verify with password
    if (!hasEmailPassword) {
      setError('Password verification is only available for email/password accounts. Please sign in with email and password to use this feature.')
      return
    }

    setError(null)
    setVerifying(true)

    try {
      // Re-authenticate user with password
      const credential = EmailAuthProvider.credential(user.email, password)
      await reauthenticateWithCredential(user, credential)

      // Password verified, proceed with the action
      await onVerify()
      setPassword('')
      onClose()
    } catch (err: any) {
      console.error('Password verification failed:', err)
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Incorrect password. Please try again.')
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.')
      } else if (err.code === 'auth/requires-recent-login') {
        setError('Please sign out and sign in again to perform this action.')
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Password verification is not available for your account type. Please sign in with email and password.')
      } else {
        setError(err.message || 'Password verification failed. Please try again.')
      }
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div>
            <h2>{title}</h2>
            <p>{message}</p>
          </div>
          <button
            type="button"
            className="ghost-button"
            onClick={onClose}
            disabled={verifying}
          >
            Close
          </button>
        </header>
        <form className="modal-form" onSubmit={handleSubmit}>
          {!hasEmailPassword ? (
            <div style={{ 
              padding: '1rem', 
              background: '#fee', 
              border: '1px solid #fcc', 
              borderRadius: '0.5rem',
              color: '#c33'
            }}>
              <p><strong>Password verification unavailable</strong></p>
              <p>You signed in with Google or GitHub. Password verification is only available for email/password accounts.</p>
              <p>Please sign out and sign in with your email and password to use this feature.</p>
            </div>
          ) : (
            <label>
              <span>Enter your password to confirm</span>
              <PasswordInput
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError(null)
                }}
                placeholder="Your password"
                required
                disabled={verifying}
                autoFocus
              />
            </label>
          )}
          {error && <p className="login-error">{error}</p>}
          <footer className="modal-footer">
            <button
              type="button"
              className="ghost-button"
              onClick={onClose}
              disabled={verifying}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={verifying || !hasEmailPassword || !password.trim()}
            >
              {verifying ? 'Verifying...' : 'Confirm Delete'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}

