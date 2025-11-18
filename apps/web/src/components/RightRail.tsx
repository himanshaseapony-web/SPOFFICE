import { useState } from 'react'
import type { FormEvent } from 'react'
import { Timestamp, addDoc, collection } from 'firebase/firestore'
import type { ChatMessage } from '../context/AppDataContext'
import { useAuth } from '../context/AuthContext'
import { useAppData } from '../context/AppDataContext'
import { Avatar } from './Avatar'
import { PasswordVerificationModal } from './PasswordVerificationModal'

type DepartmentSummary = {
  name: string
  onTrack: number
  atRisk: number
  overdue: number
}

type RightRailProps = {
  messages: ChatMessage[]
  departmentSummaries: DepartmentSummary[]
}

export function RightRail({ messages, departmentSummaries }: RightRailProps) {
  const [messageText, setMessageText] = useState('')
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [isFullViewOpen, setIsFullViewOpen] = useState(false)
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null)
  const { user } = useAuth()
  const { userProfile, firestore, dataError, allUserProfiles, deleteChatMessage } = useAppData()

  const canDeleteMessage = (message: ChatMessage): boolean => {
    if (!user || !userProfile) return false
    const role = userProfile.role
    // Only Admins and Managers can delete messages
    return role === 'Admin' || role === 'Manager'
  }

  const handleDeleteMessage = async () => {
    if (!deleteMessageId) return
    try {
      await deleteChatMessage(deleteMessageId)
      setDeleteMessageId(null)
    } catch (error) {
      console.error('Failed to delete message', error)
      setSubmissionError('Failed to delete message. Please try again.')
    }
  }

  const departmentName =
    userProfile?.department ??
    (departmentSummaries.length > 0 ? departmentSummaries[0].name : 'Programming')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !messageText.trim() || !firestore) return

    try {
      await addDoc(collection(firestore, 'departmentChats'), {
        author: user.displayName ?? user.email ?? 'Anonymous',
        authorId: user.uid,
        role: userProfile?.role ?? 'Viewer',
        department: departmentName,
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

  const sortedMessages = [...messages].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  )

  return (
    <aside className="right-rail">
      <section className="panel">
        <header className="panel-header">
          <div>
            <h2>Department Chat</h2>
            <p>{departmentName}</p>
          </div>
          <button 
            className="ghost-button" 
            type="button"
            onClick={() => setIsFullViewOpen(true)}
          >
            Open Full View
          </button>
        </header>
        <div className="chat-feed">
          {sortedMessages.length === 0 ? null : (
            sortedMessages.map((message) => {
              const messageUser = allUserProfiles.find((p) => p.id === message.authorId)
              return (
                <article key={message.id} className="chat-message">
                  <div className="chat-author">
                    <Avatar
                      displayName={message.author}
                      profileImageUrl={messageUser?.profileImageUrl}
                      size="small"
                      className="chat-avatar"
                    />
                  <div>
                    <strong>{message.author}</strong>
                    <span>{message.role}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="chat-time">
                      {message.createdAt.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {canDeleteMessage(message) && (
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => setDeleteMessageId(message.id)}
                        style={{ 
                          fontSize: '0.75rem', 
                          padding: '0.25rem 0.5rem',
                          color: '#dc2626',
                          borderColor: '#dc2626',
                          minWidth: 'auto'
                        }}
                        title="Delete message"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
                <p>{message.text}</p>
              </article>
            )
          })
        )}
        </div>
        <form
          className="chat-input"
          aria-label="Send message"
          onSubmit={handleSubmit}
        >
          <input
            type="text"
            placeholder="Message department chat…"
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
            disabled={!user || !firestore || Boolean(dataError)}
          />
          <button
            type="submit"
            disabled={!user || !firestore || Boolean(dataError) || !messageText.trim()}
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
      </section>

      <section className="panel">
        <header className="panel-header">
          <div>
            <h2>Department Snapshot</h2>
            <p>How teams are tracking today</p>
          </div>
        </header>
        <ul className="summary-list">
          {departmentSummaries.map((dept) => (
            <li key={dept.name} className="summary-card">
              <div>
                <span className="section-label">{dept.name}</span>
                <strong>{dept.onTrack} on track</strong>
              </div>
              <div className="summary-stats">
                <span>{dept.atRisk} at risk</span>
                <span>{dept.overdue} overdue</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {isFullViewOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsFullViewOpen(false)}>
          <div className="modal modal-large" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <div>
                <h2>Department Chat - {departmentName}</h2>
                <p>Full conversation view</p>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setIsFullViewOpen(false)}
              >
                Close
              </button>
            </header>
            <div className="chat-feed chat-feed-full">
              {sortedMessages.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem', margin: 0 }}>
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                sortedMessages.map((message) => (
                  <article key={message.id} className="chat-message">
                    <div className="chat-author">
                      <Avatar
                        displayName={message.author}
                        profileImageUrl={
                          allUserProfiles.find((p) => p.id === message.authorId)?.profileImageUrl
                        }
                        size="small"
                        className="chat-avatar"
                      />
                      <div>
                        <strong>{message.author}</strong>
                        <span>{message.role}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="chat-time">
                          {message.createdAt.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {canDeleteMessage(message) && (
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => setDeleteMessageId(message.id)}
                            style={{ 
                              fontSize: '0.75rem', 
                              padding: '0.25rem 0.5rem',
                              color: '#dc2626',
                              borderColor: '#dc2626',
                              minWidth: 'auto'
                            }}
                            title="Delete message"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                    <p>{message.text}</p>
                  </article>
                ))
              )}
            </div>
            <form
              className="chat-input"
              aria-label="Send message"
              onSubmit={handleSubmit}
            >
              <input
                type="text"
                placeholder="Message department chat…"
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                disabled={!user || !firestore || Boolean(dataError)}
              />
              <button
                type="submit"
                disabled={!user || !firestore || Boolean(dataError) || !messageText.trim()}
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
          </div>
        </div>
      )}

      <PasswordVerificationModal
        isOpen={deleteMessageId !== null}
        onClose={() => setDeleteMessageId(null)}
        onVerify={handleDeleteMessage}
        title="Delete Message"
        message="Are you sure you want to delete this message? This action cannot be undone."
      />
    </aside>
  )
}

