import { useState, useMemo } from 'react'
import { useAppData } from '../context/AppDataContext'
import { useAuth } from '../context/AuthContext'
import type { LeaveRequest } from '../context/AppDataContext'
import { LeaveCalendar } from '../components/LeaveCalendar'
import { DatePickerCalendar } from '../components/DatePickerCalendar'

export function LeaveRequestsPage() {
  const { leaveRequests, userProfile, createLeaveRequest, updateLeaveRequest, deleteLeaveRequest } = useAppData()
  const { user } = useAuth()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<'All' | 'Leave' | 'Work From Home'>('All')
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All')
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [numberOfDaysInput, setNumberOfDaysInput] = useState<number>(0)

  const isManagerOrAdmin = userProfile?.role === 'Admin' || userProfile?.role === 'Manager'

  // Filter requests based on user role and filters
  const filteredRequests = useMemo(() => {
    let filtered = leaveRequests

    // Regular users only see their own requests (already filtered in context)
    // Managers/Admins see all requests

    // Apply type filter
    if (filterType !== 'All') {
      filtered = filtered.filter((req) => req.type === filterType)
    }

    // Apply status filter
    if (filterStatus !== 'All') {
      filtered = filtered.filter((req) => req.status === filterStatus)
    }

    return filtered
  }, [leaveRequests, filterType, filterStatus])

  const handleCreateRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !userProfile) {
      setError('User not authenticated')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const formData = new FormData(event.currentTarget)
      const type = (formData.get('type') as string) || 'Leave'
      const numberOfDays = parseInt(formData.get('numberOfDays') as string) || 0
      const reason = (formData.get('reason') as string)?.trim() || ''

      // Validation
      if (numberOfDays <= 0) {
        setError('Number of days must be greater than 0')
        setIsSubmitting(false)
        return
      }

      if (selectedDates.length === 0) {
        setError('Please select at least one date from the calendar')
        setIsSubmitting(false)
        return
      }

      if (selectedDates.length !== numberOfDays) {
        setError(`Please select exactly ${numberOfDays} day${numberOfDays !== 1 ? 's' : ''} from the calendar`)
        setIsSubmitting(false)
        return
      }

      // Sort days chronologically
      const validDays = [...selectedDates].sort(
        (a, b) => new Date(a).getTime() - new Date(b).getTime()
      )

      if (!reason) {
        setError('Reason is required')
        setIsSubmitting(false)
        return
      }

      await createLeaveRequest({
        userId: user.uid,
        userName: userProfile.displayName,
        userEmail: user.email || '',
        department: userProfile.department,
        type: type as 'Leave' | 'Work From Home',
        startDate: validDays[0], // First day for backward compatibility
        endDate: validDays[validDays.length - 1], // Last day for backward compatibility
        selectedDays: validDays,
        numberOfDays: validDays.length,
        reason,
      })

      // Reset form and close modal
      event.currentTarget.reset()
      setSelectedDates([])
      setIsCreateOpen(false)
      setError(null)
    } catch (err: any) {
      console.error('Failed to create leave request', err)
      setError(err.message || 'Failed to create leave request. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleApprove = async (requestId: string) => {
    if (!user || !userProfile) {
      setError('User not authenticated')
      return
    }

    try {
      await updateLeaveRequest(requestId, {
        status: 'Approved',
        reviewedBy: user.uid,
        reviewedByName: userProfile.displayName,
        reviewedAt: new Date().toISOString(),
      })
    } catch (err: any) {
      console.error('Failed to approve request', err)
      setError(err.message || 'Failed to approve request. Please try again.')
    }
  }

  const handleReject = async (requestId: string, rejectionReason: string) => {
    if (!user || !userProfile) {
      setError('User not authenticated')
      return
    }

    if (!rejectionReason.trim()) {
      setError('Rejection reason is required')
      return
    }

    try {
      await updateLeaveRequest(requestId, {
        status: 'Rejected',
        reviewedBy: user.uid,
        reviewedByName: userProfile.displayName,
        reviewedAt: new Date().toISOString(),
        rejectionReason: rejectionReason.trim(),
      })
    } catch (err: any) {
      console.error('Failed to reject request', err)
      setError(err.message || 'Failed to reject request. Please try again.')
    }
  }

  const handleDelete = async (requestId: string) => {
    if (!user || !userProfile) {
      setError('User not authenticated')
      return
    }

    try {
      await deleteLeaveRequest(requestId)
    } catch (err: any) {
      console.error('Failed to delete request', err)
      setError(err.message || 'Failed to delete request. Please try again.')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getStatusBadge = (status: LeaveRequest['status']) => {
    const styles = {
      Pending: {
        background: 'var(--accent-soft)',
        color: 'var(--accent)',
        border: '1px solid var(--accent-subtle)',
      },
      Approved: {
        background: 'rgba(34, 197, 94, 0.1)',
        color: '#22c55e',
        border: '1px solid rgba(34, 197, 94, 0.2)',
      },
      Rejected: {
        background: 'rgba(239, 68, 68, 0.1)',
        color: '#ef4444',
        border: '1px solid rgba(239, 68, 68, 0.2)',
      },
    }

    const style = styles[status]

    return (
      <span
        style={{
          padding: '0.25rem 0.75rem',
          borderRadius: '0.5rem',
          fontSize: '0.8rem',
          fontWeight: 500,
          ...style,
        }}
      >
        {status}
      </span>
    )
  }

  const pendingCount = leaveRequests.filter((r) => r.status === 'Pending').length
  const myPendingCount = leaveRequests.filter((r) => r.userId === user?.uid && r.status === 'Pending').length
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')

  return (
    <div className="panel">
      <header className="panel-header">
        <div>
          <h2>Leave & Work From Home Requests</h2>
          <p>
            {isManagerOrAdmin
              ? `Manage leave and work from home requests. ${pendingCount} pending request${pendingCount !== 1 ? 's' : ''}.`
              : `Request leave or work from home. You have ${myPendingCount} pending request${myPendingCount !== 1 ? 's' : ''}.`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {isManagerOrAdmin && (
            <div
              style={{
                display: 'flex',
                gap: '0.25rem',
                background: 'var(--surface-elevated)',
                padding: '0.25rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-soft)',
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('list')}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.25rem',
                  border: 'none',
                  background: viewMode === 'list' ? 'var(--accent)' : 'transparent',
                  color: viewMode === 'list' ? '#fff' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  transition: 'all 0.2s ease',
                }}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setViewMode('calendar')}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.25rem',
                  border: 'none',
                  background: viewMode === 'calendar' ? 'var(--accent)' : 'transparent',
                  color: viewMode === 'calendar' ? '#fff' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  transition: 'all 0.2s ease',
                }}
              >
                Calendar
              </button>
            </div>
          )}
          <button
            type="button"
            className="primary-button"
            onClick={() => setIsCreateOpen(true)}
          >
            New Request
          </button>
        </div>
      </header>

      {/* Filters */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1.5rem',
          padding: '1rem',
          background: 'var(--surface-elevated)',
          borderRadius: '0.75rem',
          border: '1px solid var(--border-soft)',
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Type</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as typeof filterType)}
            style={{
              padding: '0.5rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-soft)',
              background: 'var(--surface-default)',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
            }}
          >
            <option value="All">All Types</option>
            <option value="Leave">Leave</option>
            <option value="Work From Home">Work From Home</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Status</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            style={{
              padding: '0.5rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-soft)',
              background: 'var(--surface-default)',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
            }}
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </label>
      </div>

      {error && (
        <div
          style={{
            padding: '1rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '0.5rem',
            color: '#ef4444',
            marginBottom: '1rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Calendar View for Managers/Admins */}
      {isManagerOrAdmin && viewMode === 'calendar' && (
        <div style={{ marginBottom: '2rem' }}>
          <LeaveCalendar leaveRequests={leaveRequests} />
        </div>
      )}

      {/* Requests List */}
      {viewMode === 'list' && filteredRequests.length === 0 ? (
        <div className="empty-state">
          <h3>No requests found</h3>
          <p>
            {filterType !== 'All' || filterStatus !== 'All'
              ? 'Try adjusting your filters to see more requests.'
              : isManagerOrAdmin
                ? 'No leave or work from home requests have been submitted yet.'
                : "You haven't submitted any requests yet. Click 'New Request' to get started."}
          </p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="summary-list">
          {filteredRequests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              isManagerOrAdmin={isManagerOrAdmin}
              isAdmin={userProfile?.role === 'Admin'}
              currentUserId={user?.uid || ''}
              onApprove={handleApprove}
              onReject={handleReject}
              onDelete={handleDelete}
              formatDate={formatDate}
              getStatusBadge={getStatusBadge}
            />
          ))}
        </div>
      ) : null}

      {/* Create Request Modal */}
      {isCreateOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsCreateOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <div>
                <h2>New Request</h2>
                <p>Submit a leave or work from home request.</p>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setIsCreateOpen(false)
                  setSelectedDates([])
                  setNumberOfDaysInput(0)
                  setError(null)
                }}
                disabled={isSubmitting}
              >
                Close
              </button>
            </header>
            <form className="modal-form" onSubmit={handleCreateRequest}>
              <label>
                <span>Type</span>
                <select name="type" required>
                  <option value="Leave">Leave</option>
                  <option value="Work From Home">Work From Home</option>
                </select>
              </label>
              <label>
                <span>Number of Days</span>
                <input
                  name="numberOfDays"
                  type="number"
                  min="1"
                  max="365"
                  required
                  placeholder="Enter number of days"
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0
                    setNumberOfDaysInput(value)
                    if (value > 0 && selectedDates.length > value) {
                      // If user reduces number of days, remove excess selections
                      setSelectedDates(selectedDates.slice(0, value))
                    }
                  }}
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                  How many days do you need? Then select the dates from the calendar below.
                </small>
              </label>
              <div>
                <span style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Select Days
                </span>
                <DatePickerCalendar
                  selectedDates={selectedDates}
                  onDatesChange={(dates) => {
                    if (numberOfDaysInput > 0 && dates.length > numberOfDaysInput) {
                      // Limit selections to the number of days specified
                      setSelectedDates(dates.slice(0, numberOfDaysInput))
                      setError(`You can only select ${numberOfDaysInput} day${numberOfDaysInput !== 1 ? 's' : ''}. Please adjust the number of days or deselect some dates.`)
                    } else {
                      setSelectedDates(dates)
                      setError(null)
                    }
                  }}
                />
                {selectedDates.length > 0 && (
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem', display: 'block' }}>
                    {selectedDates.length} day{selectedDates.length !== 1 ? 's' : ''} selected. Click dates to toggle selection.
                  </small>
                )}
              </div>
              <label>
                <span>Reason</span>
                <textarea
                  name="reason"
                  rows={4}
                  placeholder="Please provide a reason for your request..."
                  required
                />
              </label>
              {error && <p className="login-error">{error}</p>}
              <footer className="modal-footer">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

type RequestCardProps = {
  request: LeaveRequest
  isManagerOrAdmin: boolean
  isAdmin: boolean
  currentUserId: string
  onApprove: (requestId: string) => void
  onReject: (requestId: string, reason: string) => void
  onDelete: (requestId: string) => void
  formatDate: (date: string) => string
  getStatusBadge: (status: LeaveRequest['status']) => React.JSX.Element
}

function RequestCard({
  request,
  isManagerOrAdmin,
  isAdmin,
  currentUserId,
  onApprove,
  onReject,
  onDelete,
  formatDate,
  getStatusBadge,
}: RequestCardProps) {
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const canApprove = isManagerOrAdmin && request.status === 'Pending'
  const canDelete = isAdmin // Only admins can delete
  const isMyRequest = request.userId === currentUserId

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rejectionReason.trim()) return

    setIsProcessing(true)
    try {
      await onReject(request.id, rejectionReason)
      setShowRejectModal(false)
      setRejectionReason('')
    } catch (error) {
      // Error handling is done in parent
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      <div
        className="summary-card"
        style={{
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{request.type}</h3>
              {getStatusBadge(request.status)}
            </div>
            {isManagerOrAdmin && !isMyRequest && (
              <p style={{ margin: '0.25rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {request.userName} • {request.department}
              </p>
            )}
            <p style={{ margin: '0.5rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {request.selectedDays && request.selectedDays.length > 0 ? (
                <>
                  {request.numberOfDays} day{request.numberOfDays !== 1 ? 's' : ''}: {request.selectedDays.map(formatDate).join(', ')}
                </>
              ) : (
                <>
                  {formatDate(request.startDate)} → {formatDate(request.endDate)}
                </>
              )}
            </p>
            <p style={{ margin: '0.75rem 0 0', color: 'var(--text-primary)', lineHeight: 1.6 }}>
              {request.reason}
            </p>
          </div>
        </div>

        {request.status === 'Rejected' && request.rejectionReason && (
          <div
            style={{
              padding: '0.75rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '0.5rem',
              color: '#ef4444',
              fontSize: '0.9rem',
            }}
          >
            <strong>Rejection Reason:</strong> {request.rejectionReason}
          </div>
        )}

        {request.reviewedByName && (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            <strong>
              {request.status === 'Approved' ? 'Approved' : 'Rejected'} by {request.reviewedByName}
            </strong>
            {request.reviewedAt && (
              <span> on {new Date(request.reviewedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}</span>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          {canApprove && (
            <>
              <button
                type="button"
                className="primary-button"
                onClick={() => onApprove(request.id)}
                disabled={isProcessing}
                style={{ flex: 1, minWidth: '120px' }}
              >
                Approve
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setShowRejectModal(true)}
                disabled={isProcessing}
                style={{
                  flex: 1,
                  color: '#ef4444',
                  borderColor: '#ef4444',
                  minWidth: '120px',
                }}
              >
                Reject
              </button>
            </>
          )}
          {canDelete && (
            <button
              type="button"
              className="ghost-button"
              onClick={() => setShowDeleteModal(true)}
              disabled={isProcessing}
              style={{
                color: '#ef4444',
                borderColor: '#ef4444',
                minWidth: '120px',
              }}
            >
              Delete
            </button>
          )}
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          Requested on {formatDate(request.requestedAt)}
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowRejectModal(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <div>
                <h2>Reject Request</h2>
                <p>Please provide a reason for rejecting this request.</p>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setShowRejectModal(false)}
                disabled={isProcessing}
              >
                Close
              </button>
            </header>
            <form className="modal-form" onSubmit={handleRejectSubmit}>
              <label>
                <span>Rejection Reason</span>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  placeholder="Please provide a reason for rejection..."
                  required
                  disabled={isProcessing}
                />
              </label>
              <footer className="modal-footer">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setShowRejectModal(false)
                    setRejectionReason('')
                  }}
                  disabled={isProcessing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ghost-button"
                  disabled={isProcessing || !rejectionReason.trim()}
                  style={{
                    color: '#ef4444',
                    borderColor: '#ef4444',
                  }}
                >
                  {isProcessing ? 'Rejecting...' : 'Reject Request'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowDeleteModal(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <div>
                <h2>Delete Leave Request</h2>
                <p>Are you sure you want to delete this request? This action cannot be undone.</p>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isProcessing}
              >
                Close
              </button>
            </header>
            <div className="modal-form">
              <div
                style={{
                  padding: '1rem',
                  background: 'var(--surface-elevated)',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-soft)',
                }}
              >
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>User:</strong> {request.userName}
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Type:</strong> {request.type}
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Status:</strong> {request.status}
                </div>
                <div>
                  <strong>Dates:</strong>{' '}
                  {request.selectedDays && request.selectedDays.length > 0
                    ? request.selectedDays.map(formatDate).join(', ')
                    : `${formatDate(request.startDate)} → ${formatDate(request.endDate)}`}
                </div>
              </div>
              <footer className="modal-footer">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isProcessing}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={async () => {
                    setIsProcessing(true)
                    try {
                      await onDelete(request.id)
                      setShowDeleteModal(false)
                    } catch (error) {
                      // Error handling is done in parent
                    } finally {
                      setIsProcessing(false)
                    }
                  }}
                  disabled={isProcessing}
                  style={{
                    color: '#ef4444',
                    borderColor: '#ef4444',
                  }}
                >
                  {isProcessing ? 'Deleting...' : 'Delete Request'}
                </button>
              </footer>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default LeaveRequestsPage
