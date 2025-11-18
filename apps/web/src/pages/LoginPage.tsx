import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { user, authError, signInWithEmail, signInWithGoogle, signInWithGithub } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) {
    return <Navigate to="/" replace />
  }

  async function handleEmailLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signInWithEmail(email, password)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-shell">
      <div className="login-panel">
        <header>
          <span className="brand-mark" aria-hidden />
          <h1>SP Office</h1>
          <p>Sign in to manage tasks across Programming, 3D Design, and UI/UX.</p>
        </header>

        <form className="login-form" onSubmit={handleEmailLogin}>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={submitting || Boolean(authError)}
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={submitting || Boolean(authError)}
            />
          </label>
          {authError && (
            <p className="login-error">
              {authError.message}. Please verify your Firebase credentials.
            </p>
          )}
          {error && <p className="login-error">{error}</p>}
          <button
            type="submit"
            className="primary-button"
            disabled={submitting || Boolean(authError)}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="login-divider">
          <span />
          <p>or</p>
          <span />
        </div>

        <div className="login-oauth">
          <button
            type="button"
            className="ghost-button"
            onClick={() => void signInWithGoogle().catch((err) => setError(err.message))}
            disabled={Boolean(authError)}
          >
            Continue with Google
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => void signInWithGithub().catch((err) => setError(err.message))}
            disabled={Boolean(authError)}
          >
            Continue with GitHub
          </button>
        </div>
      </div>
    </div>
  )
}

