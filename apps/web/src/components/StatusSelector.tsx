import { useState } from 'react'
import './StatusSelector.css'

export type DepartmentStatus = 'Not Started' | 'In Progress' | 'Pending Approval' | 'Completed'

type StatusSelectorProps = {
  currentStatus: DepartmentStatus
  department: string
  updateId: string
  canEdit: boolean
  canApprove: boolean
  isTaskCreator?: boolean // User created this task
  onStatusChange: (status: DepartmentStatus) => Promise<void>
  isSubmitting?: boolean
}

const statusConfig: Record<DepartmentStatus, { label: string; color: string; bgColor: string }> = {
  'Not Started': { label: 'Not Started', color: '#6b7280', bgColor: 'rgba(107, 114, 128, 0.1)' },
  'In Progress': { label: 'In Progress', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.1)' },
  'Pending Approval': { label: 'Pending Approval', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)' },
  'Completed': { label: 'Completed', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.1)' },
}

export function StatusSelector({
  currentStatus,
  canEdit,
  canApprove,
  isTaskCreator = false,
  onStatusChange,
  isSubmitting = false,
}: StatusSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const currentConfig = statusConfig[currentStatus]

  // Determine available statuses based on role and current status
  const getAvailableStatuses = (): DepartmentStatus[] => {
    // Only Managers/Admins can set to Completed (by approving Pending Approval)
    if (canApprove) {
      // Managers/Admins can set any status, including approving Pending Approval → Completed
      return ['Not Started', 'In Progress', 'Pending Approval', 'Completed']
    }
    
    // Task creators can set In Progress and request Pending Approval, but NOT Completed
    if (isTaskCreator) {
      switch (currentStatus) {
        case 'Not Started':
          return ['Not Started', 'In Progress']
        case 'In Progress':
          return ['In Progress', 'Pending Approval']
        case 'Pending Approval':
          return ['Pending Approval'] // Can't change once pending - waiting for manager/admin approval
        case 'Completed':
          return ['Completed'] // Can't change once completed
        default:
          return [currentStatus]
      }
    }
    
    if (canEdit) {
      // Specialists/DepartmentHeads can only progress: Not Started → In Progress → Pending Approval
      // They CANNOT set to Completed directly - must request approval
      switch (currentStatus) {
        case 'Not Started':
          return ['Not Started', 'In Progress']
        case 'In Progress':
          return ['In Progress', 'Pending Approval']
        case 'Pending Approval':
          return ['Pending Approval'] // Can't change once pending - waiting for approval
        case 'Completed':
          return ['Completed'] // Can't change once completed
        default:
          return [currentStatus]
      }
    }
    
    return [currentStatus] // Viewers can't change
  }

  const availableStatuses = getAvailableStatuses()

  const handleStatusSelect = async (newStatus: DepartmentStatus) => {
    if (newStatus === currentStatus || isSubmitting) return
    
    setIsOpen(false)
    await onStatusChange(newStatus)
  }

  // Show pending approval with icon (but still allow managers/admins to change it)
  if (currentStatus === 'Pending Approval' && !canApprove && !isTaskCreator) {
    return (
      <div className="status-badge status-pending-approval" style={{ 
        color: currentConfig.color, 
        backgroundColor: currentConfig.bgColor 
      }}>
        <span className="status-pending-icon">⏳</span>
        {currentConfig.label}
      </div>
    )
  }

  // Check if user can actually edit (either through role, approval, or being task creator)
  const canActuallyEdit = canEdit || canApprove || isTaskCreator

  // Debug logging
  if (isTaskCreator) {
    console.log('🔧 StatusSelector - Task creator detected:', {
      canEdit,
      canApprove,
      isTaskCreator,
      canActuallyEdit,
      currentStatus,
      availableStatuses: getAvailableStatuses(),
    })
  }

  if (!canActuallyEdit) {
    // Read-only view
    return (
      <div className="status-badge" style={{ 
        color: currentConfig.color, 
        backgroundColor: currentConfig.bgColor 
      }}>
        {currentConfig.label}
      </div>
    )
  }

  return (
    <div className="status-selector">
      <button
        type="button"
        className="status-button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSubmitting}
        style={{
          color: currentConfig.color,
          backgroundColor: currentConfig.bgColor,
          borderColor: currentConfig.color,
        }}
      >
        {currentConfig.label}
        <span className="status-arrow">▼</span>
      </button>
      
      {isOpen && (
        <>
          <div 
            className="status-dropdown-backdrop"
            onClick={() => setIsOpen(false)}
          />
          <div className="status-dropdown">
            {availableStatuses.map((status) => {
              const config = statusConfig[status]
              const isSelected = status === currentStatus
              
              return (
                <button
                  key={status}
                  type="button"
                  className={`status-option ${isSelected ? 'status-option-selected' : ''}`}
                  onClick={() => handleStatusSelect(status)}
                  disabled={isSelected || isSubmitting}
                  style={{
                    color: config.color,
                    backgroundColor: isSelected ? config.bgColor : 'transparent',
                  }}
                >
                  <span className="status-option-dot" style={{ backgroundColor: config.color }} />
                  {config.label}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
