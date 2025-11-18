import { useState, useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import { Timestamp, addDoc, collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore'
import { useAuth } from '../context/AuthContext'
import { useAppData } from '../context/AppDataContext'
import { Avatar } from '../components/Avatar'
import { PasswordVerificationModal } from '../components/PasswordVerificationModal'

export function CompanyChatPage() {
  const [messageText, setMessageText] = useState('')
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [companyMessages, setCompanyMessages] = useState<Array<{
    id: string
    author: string
    authorId: string
    role: string
    createdAt: Date
    text: string
  }>>([])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null)
  const { user } = useAuth()
  const { userProfile, firestore, dataError, allUserProfiles, deleteCompanyChatMessage } = useAppData()

  const canDeleteMessage = (messageAuthorId: string): boolean => {
    if (!user || !userProfile) return false
    const role = userProfile.role
    // Only Admins and Managers can delete messages
    return role === 'Admin' || role === 'Manager'
  }

  const handleDeleteMessage = async () => {
    if (!deleteMessageId) return
    try {
      await deleteCompanyChatMessage(deleteMessageId)
      setDeleteMessageId(null)
    } catch (error) {
      console.error('Failed to delete message', error)
      setSubmissionError('Failed to delete message. Please try again.')
    }
  }

  // Load company chat messages
  useEffect(() => {
    if (!firestore) return

    const companyChatsRef = collection(firestore, 'companyChats')
    const companyChatsQuery = query(
      companyChatsRef,
      orderBy('createdAt', 'desc'),
      limit(100) // Limit to last 100 messages for performance
    )

    const unsubscribe = onSnapshot(
      companyChatsQuery,
      (snapshot) => {
        const messages = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data()
          return {
            id: docSnapshot.id,
            author: data.author ?? '',
            authorId: data.authorId ?? '',
            role: data.role ?? '',
            createdAt: data.createdAt?.toDate?.() ?? new Date(),
            text: data.text ?? '',
          }
        })
        // Reverse to show oldest first
        setCompanyMessages(messages.reverse())
      },
      (error) => {
        console.error('Failed to load company chat messages', error)
        setSubmissionError('Failed to load messages. Please refresh the page.')
      }
    )

    return () => unsubscribe()
  }, [firestore])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [companyMessages])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !messageText.trim() || !firestore) return

    try {
      await addDoc(collection(firestore, 'companyChats'), {
        author: user.displayName ?? user.email ?? 'Anonymous',
        authorId: user.uid,
        role: userProfile?.role ?? 'Viewer',
        text: messageText.trim(),
        createdAt: Timestamp.now(),
      })
      setMessageText('')
      setSubmissionError(null)
    } catch (error) {
      console.error('Failed to send chat message', error)
      setSubmissionError('Unable to send message right now. Please try again later.')
    }
  }

  return (
    <div className="panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <header className="panel-header">
        <div>
          <h2>Company Chat</h2>
          <p>Company-wide communication channel - all team members can participate</p>
        </div>
      </header>

      <div className="imessage-chat-feed" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {companyMessages.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem', margin: 0, textAlign: 'center', color: 'var(--text-muted)' }}>
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          companyMessages.map((message) => {
            const messageUser = allUserProfiles.find((p) => p.id === message.authorId)
            const isCurrentUser = message.authorId === user?.uid
            
            return (
              <div
                key={message.id}
                className={`imessage-message ${isCurrentUser ? 'imessage-sent' : 'imessage-received'}`}
              >
                {!isCurrentUser && (
                  <Avatar
                    displayName={message.author}
                    profileImageUrl={messageUser?.profileImageUrl}
                    size="small"
                    className="imessage-avatar"
                  />
                )}
                <div className="imessage-bubble">
                  {!isCurrentUser && (
                    <div className="imessage-author-name">{message.author}</div>
                  )}
                  <div className="imessage-text">{message.text}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div className="imessage-time">
                      {message.createdAt.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    {canDeleteMessage(message.authorId) && (
                      <button
                        type="button"
                        onClick={() => setDeleteMessageId(message.id)}
                        style={{ 
                          fontSize: '0.75rem', 
                          padding: '0.25rem 0.5rem',
                          color: '#dc2626',
                          background: 'transparent',
                          border: '1px solid #dc2626',
                          borderRadius: '0.25rem',
                          cursor: 'pointer',
                          opacity: 0.7,
                          transition: 'opacity 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                        title="Delete message"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={chatEndRef} />
      </div>

      <form
        className="imessage-input"
        aria-label="Send message"
        onSubmit={handleSubmit}
        style={{ marginTop: 'auto' }}
      >
        <input
          type="text"
          placeholder="Message company chat…"
          value={messageText}
          onChange={(event) => setMessageText(event.target.value)}
          disabled={!user || !firestore || Boolean(dataError)}
          className="imessage-input-field"
        />
        <button
          type="submit"
          disabled={!user || !firestore || Boolean(dataError) || !messageText.trim()}
          className="imessage-send-button"
        >
          Send
        </button>
      </form>
      {submissionError && <p className="login-error">{submissionError}</p>}
      {dataError && (
        <p className="login-error">
          Chat is temporarily unavailable. Check your Firebase configuration and try again.
        </p>
      )}

      <PasswordVerificationModal
        isOpen={deleteMessageId !== null}
        onClose={() => setDeleteMessageId(null)}
        onVerify={handleDeleteMessage}
        title="Delete Message"
        message="Are you sure you want to delete this message? This action cannot be undone."
      />
    </div>
  )
}

export default CompanyChatPage

