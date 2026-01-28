/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
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
  orderBy,
  limit,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  addDoc,
  Timestamp,
  where,
  type CollectionReference,
  type DocumentData,
  type Firestore,
  type Query,
  type Unsubscribe,
} from 'firebase/firestore'
import { getFirebaseApp } from '../lib/firebase'
import { useAuth } from './AuthContext'
import { playNotificationSound, showDesktopNotification } from '../lib/notifications'
import { normalizeDepartment } from '../lib/kpi'

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
  createdBy?: string
  completedAt?: string
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
  assignedToMe?: boolean
}

export type DailyWorkUpdate = {
  id: string
  date: string // ISO date string (YYYY-MM-DD)
  department: string
  createdBy: string // User ID of the department head
  createdByName: string // Display name of the department head
  createdAt: string // ISO timestamp
  members: Array<{
    userId: string
    userName: string
    tasksCompleted: Array<{
      taskId?: string // Optional - present for tasks from system, absent for manual tasks
      taskTitle: string
      isManual?: boolean // Flag to indicate if this is a manually entered task
    }>
  }>
}

export type KPIPoint = {
  id: string
  userId: string
  userName: string
  department: string
  points: number
  tasksAssigned: number
  tasksCompletedOnTime: number
  tasksCompletedLate: number
  tasksIncomplete: number
  effectivePoints: number
  score: number
  lastUpdated: string
}

export type LeaveRequest = {
  id: string
  userId: string
  userName: string
  userEmail: string
  department: string
  type: 'Leave' | 'Work From Home'
  startDate: string // ISO date string (legacy, for backward compatibility)
  endDate: string // ISO date string (legacy, for backward compatibility)
  selectedDays: string[] // Array of ISO date strings for selected days
  numberOfDays: number // Number of days requested
  reason: string
  status: 'Pending' | 'Approved' | 'Rejected'
  requestedAt: string // ISO timestamp
  reviewedBy?: string // User ID of approver
  reviewedByName?: string // Display name of approver
  reviewedAt?: string // ISO timestamp
  rejectionReason?: string
}

type AppDataContextValue = {
  departments: Department[]
  tasks: Task[]
  filteredTasks: Task[]
  chatMessages: ChatMessage[]
  companyChatMessages: Array<{
    id: string
    author: string
    authorId: string
    role: string
    createdAt: Date
    text: string
    seenBy?: Array<{
      userId: string
      seenAt: Date
    }>
  }>
  companyChatUnreadCount: number
  markCompanyChatAsRead: () => void
  userProfile: UserProfile | null
  allUserProfiles: UserProfile[]
  kpiPoints: KPIPoint[]
  leaveRequests: LeaveRequest[]
  loading: boolean
  firestore: Firestore | null
  dataError: Error | null
  filters: TaskFilters
  setFilters: (filters: TaskFilters) => void
  updateTask: (taskId: string, updates: Partial<Omit<Task, 'id'>>) => Promise<void>
  deleteTask: (taskId: string) => Promise<void>
  deleteChatMessage: (messageId: string) => Promise<void>
  deleteCompanyChatMessage: (messageId: string) => Promise<void>
  markCompanyChatMessageAsSeen: (messageId: string) => Promise<void>
  createLeaveRequest: (request: Omit<LeaveRequest, 'id' | 'status' | 'requestedAt'>) => Promise<void>
  updateLeaveRequest: (requestId: string, updates: Partial<LeaveRequest>) => Promise<void>
  deleteLeaveRequest: (requestId: string) => Promise<void>
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
  const [companyChatMessages, setCompanyChatMessages] = useState<Array<{
    id: string
    author: string
    authorId: string
    role: string
    createdAt: Date
    text: string
    seenBy?: Array<{
      userId: string
      seenAt: Date
    }>
  }>>([])
  const [companyChatUnreadCount, setCompanyChatUnreadCount] = useState(0)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [allUserProfiles, setAllUserProfiles] = useState<UserProfile[]>([])
  const [kpiPoints, setKpiPoints] = useState<KPIPoint[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [firestore, setFirestore] = useState<Firestore | null>(null)
  const [dataError, setDataError] = useState<Error | null>(null)
  const tasksUnsubscribeRef = useRef<Unsubscribe | null>(null)
  const chatsUnsubscribeRef = useRef<Unsubscribe | null>(null)
  const companyChatsUnsubscribeRef = useRef<Unsubscribe | null>(null)
  const previousChatMessageIdsRef = useRef<Set<string>>(new Set())
  const previousCompanyChatMessageIdsRef = useRef<Set<string>>(new Set())
  const [filters, setFilters] = useState<TaskFilters>({
    statuses: ['Backlog', 'In Progress', 'Review', 'Completed'],
    priorities: ['High', 'Medium', 'Low'],
    departments: [],
    assignedToMe: false,
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
                createdBy: data.createdBy ?? undefined,
                completedAt: data.completedAt ?? undefined,
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
            const newMessages = chatsSnapshot.docs.map((docSnapshot) => {
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
            })
            
            // Check for new messages (not sent by current user)
            const currentMessageIds = new Set(newMessages.map(m => m.id))
            const previousIds = previousChatMessageIdsRef.current
            
            // Find new messages that weren't in the previous set
            const newMessageIds = newMessages
              .filter(msg => !previousIds.has(msg.id) && msg.authorId !== user?.uid)
              .map(msg => msg.id)
            
            // Play notification sound for new messages from other users
            if (newMessageIds.length > 0 && previousIds.size > 0) {
              playNotificationSound()
            }
            
            // Update previous message IDs
            previousChatMessageIdsRef.current = currentMessageIds
            
            setChatMessages(newMessages)
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
      if (companyChatsUnsubscribeRef.current) {
        companyChatsUnsubscribeRef.current()
      }
    }
  }, [firestore, user])

  // Load company chat messages and track unread count
  useEffect(() => {
    if (!firestore || !user) {
      setCompanyChatMessages([])
      setCompanyChatUnreadCount(0)
      return () => {}
    }

    const companyChatsRef = collection(firestore, 'companyChats')
    const companyChatsQuery = query(
      companyChatsRef,
      orderBy('createdAt', 'desc'),
      limit(100)
    )

    companyChatsUnsubscribeRef.current = onSnapshot(
      companyChatsQuery,
      (snapshot) => {
        const messages = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data()
          const seenByData = data.seenBy ?? []
          return {
            id: docSnapshot.id,
            author: data.author ?? '',
            authorId: data.authorId ?? '',
            role: data.role ?? '',
            createdAt: data.createdAt?.toDate?.() ?? new Date(),
            text: data.text ?? '',
            seenBy: Array.isArray(seenByData) ? seenByData.map((item: any) => ({
              userId: item.userId ?? '',
              seenAt: item.seenAt?.toDate?.() ?? new Date(),
            })) : undefined,
          }
        })

        // Get last read timestamp from localStorage
        const lastReadKey = `companyChat_lastRead_${user.uid}`
        const lastReadTimestamp = localStorage.getItem(lastReadKey)
        const lastReadDate = lastReadTimestamp ? new Date(lastReadTimestamp) : null

        // Calculate unread count (messages after last read that aren't from current user)
        const unreadCount = messages.filter((msg) => {
          if (msg.authorId === user.uid) return false // Don't count own messages
          if (!lastReadDate) return true // If never read, count all messages
          return msg.createdAt > lastReadDate
        }).length

        setCompanyChatUnreadCount(unreadCount)

        // Check for new messages (not sent by current user)
        const currentMessageIds = new Set(messages.map(m => m.id))
        const previousIds = previousCompanyChatMessageIdsRef.current

        // Find new messages that weren't in the previous set
        const newMessages = messages.filter(
          msg => !previousIds.has(msg.id) && msg.authorId !== user.uid
        )

        // Play notification sound and show desktop notification for new messages
        if (newMessages.length > 0 && previousIds.size > 0) {
          playNotificationSound()
          
          // Show desktop notification for the most recent new message
          const latestMessage = newMessages[0]
          showDesktopNotification('New Company Chat Message', {
            body: `${latestMessage.author}: ${latestMessage.text.substring(0, 100)}${latestMessage.text.length > 100 ? '...' : ''}`,
            tag: 'company-chat',
            requireInteraction: false,
          })
        }

        // Update previous message IDs
        previousCompanyChatMessageIdsRef.current = currentMessageIds

        // Reverse to show oldest first
        setCompanyChatMessages(messages.reverse())
      },
      (error) => {
        console.error('Failed to load company chat messages', error)
      }
    )

    return () => {
      if (companyChatsUnsubscribeRef.current) {
        companyChatsUnsubscribeRef.current()
      }
    }
  }, [firestore, user])

  // Load KPI points (for Managers and Admins)
  useEffect(() => {
    if (!firestore || !user) {
      setKpiPoints([])
      return () => {}
    }

    const kpiPointsRef = collection(firestore, 'kpiPoints')
    const unsubscribe = onSnapshot(
      kpiPointsRef,
      (snapshot) => {
        const points = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data()
          const rawDepartment = data.department ?? 'Unknown'
          // Normalize department name for display (e.g., "ui" → "UI/UX", "3d design" → "3D Development")
          const normalizedDept = rawDepartment !== 'Unknown' ? normalizeDepartment(rawDepartment) : 'Unknown'
          
          return {
            id: docSnapshot.id,
            userId: data.userId ?? docSnapshot.id,
            userName: data.userName ?? '',
            department: normalizedDept,
            points: data.points ?? 0,
            tasksAssigned: data.tasksAssigned ?? 0,
            tasksCompletedOnTime: data.tasksCompletedOnTime ?? 0,
            tasksCompletedLate: data.tasksCompletedLate ?? 0,
            tasksIncomplete: data.tasksIncomplete ?? 0,
            effectivePoints: data.effectivePoints ?? 0,
            score: data.score ?? 0,
            lastUpdated: data.lastUpdated ?? '',
          } satisfies KPIPoint
        })
        // Sort by score descending (not just points)
        points.sort((a, b) => b.score - a.score)
        setKpiPoints(points)
      },
      (error) => {
        console.error('Failed to load KPI points', error)
      }
    )

    return () => unsubscribe()
  }, [firestore, user])

  // Load leave requests - users see only their own, Managers/Admins see all
  useEffect(() => {
    if (!firestore || !user || !userProfile) {
      setLeaveRequests([])
      return () => {}
    }

    const leaveRequestsRef = collection(firestore, 'leaveRequests')
    const userRole = userProfile.role
    const isManagerOrAdmin = userRole === 'Admin' || userRole === 'Manager'
    
    // Managers and Admins see all requests, others see only their own
    // For regular users, we filter by userId and sort in memory to avoid composite index requirement
    const requestsQuery = isManagerOrAdmin
      ? query(leaveRequestsRef, orderBy('requestedAt', 'desc'))
      : query(leaveRequestsRef, where('userId', '==', user.uid))

    const unsubscribe = onSnapshot(
      requestsQuery,
      (snapshot) => {
        const requests = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data()
          return {
            id: docSnapshot.id,
            userId: data.userId ?? '',
            userName: data.userName ?? '',
            userEmail: data.userEmail ?? '',
            department: data.department ?? '',
            type: data.type ?? 'Leave',
            startDate: data.startDate ?? '',
            endDate: data.endDate ?? '',
            selectedDays: data.selectedDays ?? (data.startDate && data.endDate ? [] : []),
            numberOfDays: data.numberOfDays ?? 0,
            reason: data.reason ?? '',
            status: data.status ?? 'Pending',
            requestedAt: data.requestedAt ?? new Date().toISOString(),
            reviewedBy: data.reviewedBy,
            reviewedByName: data.reviewedByName,
            reviewedAt: data.reviewedAt,
            rejectionReason: data.rejectionReason,
          } satisfies LeaveRequest
        })
        // Sort by requestedAt descending (newest first)
        requests.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
        setLeaveRequests(requests)
      },
      (error) => {
        console.error('Failed to load leave requests', error)
      }
    )

    return () => unsubscribe()
  }, [firestore, user, userProfile])

  // Function to mark company chat as read
  const markCompanyChatAsRead = useCallback(() => {
    if (!user) return
    const lastReadKey = `companyChat_lastRead_${user.uid}`
    localStorage.setItem(lastReadKey, new Date().toISOString())
    setCompanyChatUnreadCount(0)
  }, [user])

  /* eslint-enable react-hooks/set-state-in-effect */

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesStatus = filters.statuses.includes(task.status)
      const matchesPriority = filters.priorities.includes(task.priority)
      const matchesDepartment =
        filters.departments.length === 0 || filters.departments.includes(task.department)
      const matchesAssignedToMe = !filters.assignedToMe || (user && task.assigneeId === user.uid)
      return matchesStatus && matchesPriority && matchesDepartment && matchesAssignedToMe
    })
  }, [tasks, filters, user])

  const updateTask = async (taskId: string, updates: Partial<Omit<Task, 'id'>>) => {
    if (!firestore) {
      throw new Error('Firestore is not initialized')
    }
    const taskRef = doc(firestore, 'tasks', taskId)
    
    // Filter out undefined values and prepare update object
    const updateData: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    }
    
    // Only include defined values in the update
    Object.keys(updates).forEach((key) => {
      const value = updates[key as keyof typeof updates]
      if (value !== undefined) {
        updateData[key] = value
      }
    })
    
    await updateDoc(taskRef, updateData)
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

  const markCompanyChatMessageAsSeen = async (messageId: string) => {
    if (!firestore || !user) {
      return
    }

    try {
      const messageRef = doc(firestore, 'companyChats', messageId)
      const messageSnapshot = await getDoc(messageRef)
      
      if (!messageSnapshot.exists()) {
        return
      }

      const currentData = messageSnapshot.data()
      const existingSeenBy = currentData.seenBy ?? []
      
      // Check if user has already seen this message
      const alreadySeen = existingSeenBy.some((item: any) => item.userId === user.uid)
      
      if (!alreadySeen) {
        // Add current user to seenBy array
        const updatedSeenBy = [
          ...existingSeenBy,
          {
            userId: user.uid,
            seenAt: Timestamp.now(),
          },
        ]
        
        await updateDoc(messageRef, {
          seenBy: updatedSeenBy,
        })
      }
    } catch (error) {
      console.error('Failed to mark message as seen', error)
      // Don't throw - this is a non-critical operation
    }
  }

  const createLeaveRequest = async (request: Omit<LeaveRequest, 'id' | 'status' | 'requestedAt'>) => {
    if (!firestore || !user || !userProfile) {
      throw new Error('Firestore is not initialized or user not authenticated')
    }

    // Calculate startDate and endDate from selectedDays for backward compatibility
    const sortedDays = request.selectedDays?.length > 0 
      ? [...request.selectedDays].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      : []
    
    const requestData = {
      ...request,
      startDate: sortedDays.length > 0 ? sortedDays[0] : request.startDate || new Date().toISOString().split('T')[0],
      endDate: sortedDays.length > 0 ? sortedDays[sortedDays.length - 1] : request.endDate || new Date().toISOString().split('T')[0],
      status: 'Pending' as const,
      requestedAt: new Date().toISOString(),
    }

    await addDoc(collection(firestore, 'leaveRequests'), requestData)
  }

  const updateLeaveRequest = async (requestId: string, updates: Partial<LeaveRequest>) => {
    if (!firestore) {
      throw new Error('Firestore is not initialized')
    }

    const requestRef = doc(firestore, 'leaveRequests', requestId)
    const updateData: Record<string, any> = {
      ...updates,
    }

    // Remove undefined values
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key]
      }
    })

    await updateDoc(requestRef, updateData)
  }

  const deleteLeaveRequest = async (requestId: string) => {
    if (!firestore) {
      throw new Error('Firestore is not initialized')
    }

    const requestRef = doc(firestore, 'leaveRequests', requestId)
    await deleteDoc(requestRef)
  }

  const value = useMemo<AppDataContextValue>(
    () => ({
      departments,
      tasks,
      filteredTasks,
      chatMessages,
      companyChatMessages,
      companyChatUnreadCount,
      markCompanyChatAsRead,
      userProfile,
      allUserProfiles,
      kpiPoints,
      leaveRequests,
      loading,
      firestore,
      dataError,
      filters,
      setFilters,
      updateTask,
      deleteTask,
      deleteChatMessage,
      deleteCompanyChatMessage,
      markCompanyChatMessageAsSeen,
      createLeaveRequest,
      updateLeaveRequest,
      deleteLeaveRequest,
    }),
    [
      allUserProfiles,
      chatMessages,
      companyChatMessages,
      companyChatUnreadCount,
      dataError,
      departments,
      firestore,
      filteredTasks,
      filters,
      kpiPoints,
      leaveRequests,
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

