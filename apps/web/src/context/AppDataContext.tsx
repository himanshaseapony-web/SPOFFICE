/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  type CollectionReference,
  type DocumentData,
  type Firestore,
  type Query,
  type Unsubscribe,
} from 'firebase/firestore'
import { getFirebaseApp } from '../lib/firebase'
import { useAuth } from './AuthContext'

export type Department = {
  id: string
  name: string
  slug: string
}

export type Task = {
  id: string
  title: string
  status: 'Backlog' | 'In Progress' | 'Review' | 'Completed'
  assignee: string
  assigneeId: string
  dueDate: string
  priority: 'Low' | 'Medium' | 'High'
  department: string
  summary: string
  blockers?: string[]
  fileUrls?: string[]
}

export type ChatMessage = {
  id: string
  author: string
  authorId: string
  department: string
  createdAt: Date
  text: string
  role: string
}

export type UserProfile = {
  id: string
  displayName: string
  email: string
  department: string
  role: 'Admin' | 'Manager' | 'DepartmentHead' | 'Specialist' | 'Viewer'
  permissions?: string[]
  isDepartmentHead?: boolean
  profileImageUrl?: string
}

export type TaskFilters = {
  statuses: Task['status'][]
  priorities: Task['priority'][]
  departments: string[]
}

type AppDataContextValue = {
  departments: Department[]
  tasks: Task[]
  filteredTasks: Task[]
  chatMessages: ChatMessage[]
  userProfile: UserProfile | null
  allUserProfiles: UserProfile[]
  loading: boolean
  firestore: Firestore | null
  dataError: Error | null
  filters: TaskFilters
  setFilters: (filters: TaskFilters) => void
  updateTask: (taskId: string, updates: Partial<Omit<Task, 'id'>>) => Promise<void>
  deleteTask: (taskId: string) => Promise<void>
  deleteChatMessage: (messageId: string) => Promise<void>
  deleteCompanyChatMessage: (messageId: string) => Promise<void>
}

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined)

const DEFAULT_DEPARTMENTS: Department[] = [
  { id: 'programming', name: 'Programming', slug: 'programming' },
  { id: '3d-design', name: '3D Design', slug: '3d-design' },
  { id: 'ui-ux', name: 'UI/UX', slug: 'ui-ux' },
]

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [departments, setDepartments] = useState<Department[]>(DEFAULT_DEPARTMENTS)
  const [tasks, setTasks] = useState<Task[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [allUserProfiles, setAllUserProfiles] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [firestore, setFirestore] = useState<Firestore | null>(null)
  const [dataError, setDataError] = useState<Error | null>(null)
  const tasksUnsubscribeRef = useRef<Unsubscribe | null>(null)
  const chatsUnsubscribeRef = useRef<Unsubscribe | null>(null)
  const [filters, setFilters] = useState<TaskFilters>({
    statuses: ['Backlog', 'In Progress', 'Review', 'Completed'],
    priorities: ['High', 'Medium', 'Low'],
    departments: [],
  })

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const app = getFirebaseApp()
      setFirestore(getFirestore(app))
    } catch (error) {
      console.error('Failed to initialize Firestore', error)
      setDataError(error as Error)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!firestore) {
      return () => {}
    }

    const departmentsRef = collection(firestore, 'departments')
    const unsubscribe = onSnapshot(
      departmentsRef,
      (snapshot) => {
        if (snapshot.empty) {
          setDepartments(DEFAULT_DEPARTMENTS)
          return
        }

        setDepartments(
          snapshot.docs.map((docSnapshot) => {
            const data = docSnapshot.data() as Partial<Department>
            const { id: _idFromDoc, ...rest } = data
            void _idFromDoc
            return {
              id: docSnapshot.id,
              ...(rest as Omit<Department, 'id'>),
            }
          }),
        )
      },
      (error) => {
        console.error('Failed to load departments', error)
        setDataError(error)
      },
    )

    return () => unsubscribe()
  }, [firestore])

  // Load all user profiles for user selection
  useEffect(() => {
    if (!firestore || !user) {
      return () => {}
    }

    const profilesRef = collection(firestore, 'userProfiles')
    const unsubscribe = onSnapshot(
      profilesRef,
      (snapshot) => {
        setAllUserProfiles(
          snapshot.docs.map((docSnapshot) => ({
            id: docSnapshot.id,
            ...(docSnapshot.data() as DocumentData),
          })) as UserProfile[],
        )
      },
      (error) => {
        console.error('Failed to load user profiles', error)
      },
    )

    return () => unsubscribe()
  }, [firestore, user])

  useEffect(() => {
    if (!firestore) {
      return () => {}
    }

    if (!user) {
      setTasks([])
      setChatMessages([])
      setUserProfile(null)
      setLoading(false)
      return () => {}
    }

    setLoading(true)

    const profileRef = doc(firestore, 'userProfiles', user.uid)
    console.log('👂 Setting up real-time listener for user profile:', user.uid)
    
    const profileUnsubscribe = onSnapshot(
      profileRef,
      async (snapshot) => {
        console.log('📡 Profile snapshot received for user:', user.uid, 'Has data:', snapshot.exists())
        let profileData: UserProfile | null = null
        if (snapshot.exists()) {
          const data = snapshot.data() as DocumentData
          // Validate and normalize role
          const validRoles = ['Admin', 'Manager', 'DepartmentHead', 'Specialist', 'Viewer']
          const rawRole = data.role ?? 'Viewer'
          
          // Log the raw role from database for debugging
          console.log('🔍 Raw role from database:', rawRole, 'Type:', typeof rawRole)
          
          // Check if role is valid (case-sensitive exact match)
          const normalizedRole = validRoles.includes(rawRole) 
            ? (rawRole as UserProfile['role'])
            : 'Viewer'
          
          // Warn if role was normalized
          if (normalizedRole === 'Viewer' && rawRole !== 'Viewer' && rawRole !== undefined && rawRole !== null) {
            console.warn('⚠️ Invalid role detected, defaulting to Viewer. Raw role:', rawRole, 'Valid roles:', validRoles)
          }
          
          profileData = {
            id: snapshot.id,
            displayName: data.displayName ?? '',
            email: data.email ?? '',
            department: data.department ?? '',
            role: normalizedRole,
            permissions: data.permissions,
            isDepartmentHead: data.isDepartmentHead ?? false,
            profileImageUrl: data.profileImageUrl,
          } as UserProfile
          console.log('📋 User profile loaded/updated:', {
            id: profileData.id,
            role: profileData.role,
            rawRole: rawRole,
            normalizedRole: normalizedRole,
            department: profileData.department,
            displayName: profileData.displayName,
            isDepartmentHead: profileData.isDepartmentHead,
            profileImageUrl: profileData.profileImageUrl ? 'Set' : 'Not set',
          })
        } else {
          // Profile doesn't exist - create it with default Viewer role
          // Admin users should be set manually in Firebase Console
          console.log('⚠️ User profile not found, creating default profile...')
          try {
            const defaultProfile: Omit<UserProfile, 'id'> = {
              displayName: user.displayName || user.email || 'Unknown User',
              email: user.email || '',
              department: 'Programming',
              role: 'Viewer',
            }
            await setDoc(profileRef, {
              ...defaultProfile,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
            // Profile will be loaded on next snapshot
            return
          } catch (error) {
            console.error('Failed to create user profile', error)
          }
        }
        setUserProfile(profileData)

        // Clean up previous subscriptions
        if (tasksUnsubscribeRef.current) {
          tasksUnsubscribeRef.current()
          tasksUnsubscribeRef.current = null
        }
        if (chatsUnsubscribeRef.current) {
          chatsUnsubscribeRef.current()
          chatsUnsubscribeRef.current = null
        }

        // Set up tasks query with the loaded profile
        // Department heads see all tasks in their department
        // Regular users see all tasks (for viewing) but can only edit their own
        const departmentFilter = profileData?.department ?? null
        const isDepartmentHead = profileData?.isDepartmentHead ?? false
        const userRole = profileData?.role ?? 'Viewer'
        
        const tasksRef = collection(firestore, 'tasks')
        let tasksQuery: Query<DocumentData, DocumentData> | CollectionReference<DocumentData, DocumentData> = tasksRef
        
        // Filter by department if user is not Admin and not a department head with 'all' access
        if (userRole !== 'Admin' && departmentFilter && departmentFilter !== 'all') {
          if (isDepartmentHead) {
            // Department heads see all tasks in their department
            tasksQuery = query(tasksRef, where('department', '==', departmentFilter))
          } else {
            // Regular users see all tasks for viewing, but filtering happens client-side
            tasksQuery = tasksRef
          }
        }

        tasksUnsubscribeRef.current = onSnapshot(
          tasksQuery,
          (taskSnapshot) => {
            const allTasks = taskSnapshot.docs.map((docSnapshot) => {
              const data = docSnapshot.data()
              return {
                id: docSnapshot.id,
                title: data.title ?? '',
                status: data.status ?? 'Backlog',
                assignee: data.assignee ?? '',
                assigneeId: data.assigneeId ?? '',
                dueDate: data.dueDate ?? '',
                priority: data.priority ?? 'Medium',
                department: data.department ?? '',
                summary: data.summary ?? '',
                blockers: data.blockers ?? [],
                fileUrls: data.fileUrls ?? [],
              } satisfies Task
            })
            
            // For regular users (not Admin, not Department Head), show all tasks for viewing
            // but they can only edit their own tasks (handled in TaskBoard component)
            setTasks(allTasks)
          },
          (error) => {
            console.error('Failed to load tasks', error)
            setDataError(error)
          },
        )

        // Set up chats query
        const chatsRef = collection(firestore, 'departmentChats')
        const chatsQuery =
          departmentFilter && departmentFilter !== 'all'
            ? query(chatsRef, where('department', '==', departmentFilter))
            : chatsRef

        chatsUnsubscribeRef.current = onSnapshot(
          chatsQuery,
          (chatsSnapshot) => {
            setChatMessages(
              chatsSnapshot.docs.map((docSnapshot) => {
                const data = docSnapshot.data()
                return {
                  id: docSnapshot.id,
                  author: data.author ?? '',
                  authorId: data.authorId ?? '',
                  department: data.department ?? '',
                  createdAt: data.createdAt?.toDate?.() ?? new Date(),
                  text: data.text ?? '',
                  role: data.role ?? '',
                } satisfies ChatMessage
              }),
            )
            setLoading(false)
          },
          (error) => {
            console.error('Failed to load chat messages', error)
            setDataError(error)
            setLoading(false)
          },
        )
      },
      (error) => {
        console.error('Failed to load user profile', error)
        setDataError(error)
        setLoading(false)
      },
    )

    return () => {
      profileUnsubscribe()
      if (tasksUnsubscribeRef.current) {
        tasksUnsubscribeRef.current()
      }
      if (chatsUnsubscribeRef.current) {
        chatsUnsubscribeRef.current()
      }
    }
  }, [firestore, user])
  /* eslint-enable react-hooks/set-state-in-effect */

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesStatus = filters.statuses.includes(task.status)
      const matchesPriority = filters.priorities.includes(task.priority)
      const matchesDepartment =
        filters.departments.length === 0 || filters.departments.includes(task.department)
      return matchesStatus && matchesPriority && matchesDepartment
    })
  }, [tasks, filters])

  const updateTask = async (taskId: string, updates: Partial<Omit<Task, 'id'>>) => {
    if (!firestore) {
      throw new Error('Firestore is not initialized')
    }
    const taskRef = doc(firestore, 'tasks', taskId)
    await updateDoc(taskRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    })
  }

  const deleteTask = async (taskId: string) => {
    if (!firestore) {
      throw new Error('Firestore is not initialized')
    }
    const taskRef = doc(firestore, 'tasks', taskId)
    await deleteDoc(taskRef)
  }

  const deleteChatMessage = async (messageId: string) => {
    if (!firestore) {
      throw new Error('Firestore is not initialized')
    }
    const messageRef = doc(firestore, 'departmentChats', messageId)
    await deleteDoc(messageRef)
  }

  const deleteCompanyChatMessage = async (messageId: string) => {
    if (!firestore) {
      throw new Error('Firestore is not initialized')
    }
    const messageRef = doc(firestore, 'companyChats', messageId)
    await deleteDoc(messageRef)
  }

  const value = useMemo<AppDataContextValue>(
    () => ({
      departments,
      tasks,
      filteredTasks,
      chatMessages,
      userProfile,
      allUserProfiles,
      loading,
      firestore,
      dataError,
      filters,
      setFilters,
      updateTask,
      deleteTask,
      deleteChatMessage,
      deleteCompanyChatMessage,
    }),
    [
      allUserProfiles,
      chatMessages,
      dataError,
      departments,
      firestore,
      filteredTasks,
      filters,
      loading,
      tasks,
      userProfile,
    ],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData() {
  const context = useContext(AppDataContext)
  if (!context) {
    throw new Error('useAppData must be used within an AppDataProvider')
  }
  return context
}

/* eslint-enable react-refresh/only-export-components */

