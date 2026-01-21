import { useState, useEffect, useRef, useCallback } from 'react'
import type { FormEvent } from 'react'
import { Timestamp, addDoc, collection } from 'firebase/firestore'
import { useAuth } from '../context/AuthContext'
import { useAppData } from '../context/AppDataContext'
import { Avatar } from '../components/Avatar'
import { PasswordVerificationModal } from '../components/PasswordVerificationModal'

export function CompanyChatPage() {
  const [messageText, setMessageText] = useState('')
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null)
  const { user } = useAuth()
  const { 
    userProfile, 
    firestore, 
    dataError, 
    allUserProfiles, 
    deleteCompanyChatMessage,
    companyChatMessages,
    markCompanyChatAsRead,
    markCompanyChatMessageAsSeen
  } = useAppData()
  
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const seenMessagesRef = useRef<Set<string>>(new Set())

  // Mark company chat as read when page is visited
  useEffect(() => {
    markCompanyChatAsRead()
  }, [markCompanyChatAsRead])

  // Track visible messages and mark them as seen
  useEffect(() => {
    if (!user || !companyChatMessages.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const messageId = entry.target.getAttribute('data-message-id')
            if (messageId && !seenMessagesRef.current.has(messageId)) {
              // Only mark as seen if it's not the current user's message
              const message = companyChatMessages.find((m) => m.id === messageId)
              if (message && message.authorId !== user.uid) {
                seenMessagesRef.current.add(messageId)
                markCompanyChatMessageAsSeen(messageId).catch((error) => {
                  console.error('Failed to mark message as seen', error)
                  seenMessagesRef.current.delete(messageId) // Retry on next intersection
                })
              }
            }
          }
        })
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: 0.5, // Message is considered visible when 50% is in view
      }
    )

    // Observe all message elements
    messageRefs.current.forEach((element) => {
      observer.observe(element)
    })

    return () => {
      observer.disconnect()
    }
  }, [user, companyChatMessages, markCompanyChatMessageAsSeen])

  // Set up message refs
  const setMessageRef = useCallback((messageId: string, element: HTMLDivElement | null) => {
    if (element) {
      messageRefs.current.set(messageId, element)
    } else {
      messageRefs.current.delete(messageId)
    }
  }, [])

  const canDeleteMessage = (_messageAuthorId: string): boolean => {
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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [companyChatMessages])

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
        {companyChatMessages.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem', margin: 0, textAlign: 'center', color: 'var(--text-muted)' }}>
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          companyChatMessages.map((message) => {
            const messageUser = allUserProfiles.find((p) => p.id === message.authorId)
            const isCurrentUser = message.authorId === user?.uid
            const seenBy = message.seenBy ?? []
            // Get unique users who have seen this message (excluding the author)
            const seenByUsers = seenBy
              .filter((seen) => seen.userId !== message.authorId)
              .map((seen) => {
                const profile = allUserProfiles.find((p) => p.id === seen.userId)
                return {
                  userId: seen.userId,
                  seenAt: seen.seenAt,
                  profile,
                }
              })
              .filter((seen) => seen.profile) // Only include users with profiles
            
            return (
              <div
                key={message.id}
                ref={(el) => setMessageRef(message.id, el)}
                data-message-id={message.id}
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
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
                    {seenByUsers.length > 0 && (
                      <div 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.25rem',
                          marginTop: '0.25rem',
                          flexWrap: 'wrap'
                        }}
                        title={`Seen by: ${seenByUsers.map((s) => s.profile?.displayName || 'Unknown').join(', ')}`}
                      >
                        {seenByUsers.slice(0, 5).map((seen) => (
                          <Avatar
                            key={seen.userId}
                            displayName={seen.profile?.displayName}
                            email={seen.profile?.email}
                            profileImageUrl={seen.profile?.profileImageUrl}
                            size="small"
                            className="imessage-seen-avatar"
                          />
                        ))}
                        {seenByUsers.length > 5 && (
                          <span style={{ 
                            fontSize: '0.7rem', 
                            color: 'var(--text-muted)',
                            marginLeft: '0.25rem'
                          }}>
                            +{seenByUsers.length - 5}
                          </span>
                        )}
                      </div>
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

