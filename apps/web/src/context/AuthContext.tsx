/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  GithubAuthProvider,
  GoogleAuthProvider,
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  getAuth,
  type Auth,
  type Unsubscribe,
  type User,
} from 'firebase/auth'
import { getFirebaseApp } from '../lib/firebase'

type AuthContextValue = {
  user: User | null
  loading: boolean
  authError: Error | null
  signInWithEmail: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signInWithGithub: () => Promise<void>
  signOutUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseAuth, setFirebaseAuth] = useState<Auth | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<Error | null>(null)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let unsubscribe: Unsubscribe | undefined
    try {
      const app = getFirebaseApp()
      const authInstance = getAuth(app)
      setFirebaseAuth(authInstance)
      void setPersistence(authInstance, browserLocalPersistence)
      unsubscribe = onAuthStateChanged(authInstance, (nextUser) => {
        setUser(nextUser)
        setLoading(false)
      })
    } catch (error) {
      console.error('Failed to initialize Firebase Auth', error)
      setAuthError(error as Error)
      setLoading(false)
    }

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  function assertAuthInstance() {
    if (firebaseAuth) return firebaseAuth
    const error =
      authError ?? new Error('Authentication is currently unavailable. Please try again later.')
    setAuthError(error)
    throw error
  }

  const contextValue: AuthContextValue = {
    user,
    loading,
    authError,
    async signInWithEmail(email: string, password: string) {
      const authInstance = assertAuthInstance()
      await signInWithEmailAndPassword(authInstance, email, password)
    },
    async signInWithGoogle() {
      const provider = new GoogleAuthProvider()
      const authInstance = assertAuthInstance()
      await signInWithPopup(authInstance, provider)
    },
    async signInWithGithub() {
      const provider = new GithubAuthProvider()
      const authInstance = assertAuthInstance()
      await signInWithPopup(authInstance, provider)
    },
    async signOutUser() {
      const authInstance = assertAuthInstance()
      await signOut(authInstance)
    },
  }

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/* eslint-enable react-refresh/only-export-components */

