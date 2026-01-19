# Calendar Update Status Feature - Implementation Plan

## Overview
Add department-level status tracking to calendar updates with an approval workflow. When specialists complete their department work, managers/admins approve it, and when all departments are complete, the overall task is marked as completed.

## Feature Requirements

### 1. Data Model Changes
- **CalendarUpdate Type Extension:**
  - Add `departmentStatuses?: Record<string, DepartmentStatus>` field
  - Add `overallStatus?: 'In Progress' | 'Completed'` field
  - Add `statusHistory?: StatusChange[]` for audit trail

- **DepartmentStatus Type:**
  ```typescript
  type DepartmentStatus = {
    status: 'Not Started' | 'In Progress' | 'Pending Approval' | 'Completed'
    requestedBy?: string // User ID who requested completion
    requestedByName?: string
    requestedAt?: string // ISO timestamp
    approvedBy?: string // Manager/Admin who approved
    approvedByName?: string
    approvedAt?: string // ISO timestamp
  }
  ```

### 2. UI Components

#### A. Status Column in Department Table
- Add a new column "Status" to the department table
- Display current status with color-coded badges:
  - Not Started: Gray
  - In Progress: Blue
  - Pending Approval: Orange/Yellow
  - Completed: Green

#### B. Status Selector (Editable)
- Dropdown/button group for status selection
- Available options based on user role:
  - **Specialist/DepartmentHead**: Can set to "In Progress" or "Pending Approval"
  - **Manager/Admin**: Can approve "Pending Approval" → "Completed"
  - **Manager/Admin**: Can also set any status directly

#### C. Approval Notification System
- When status changes to "Pending Approval":
  - Create notification document in Firestore `calendarStatusNotifications` collection
  - Send desktop notification to all Managers and Admins
  - Play notification sound
  - Show notification badge/indicator in UI

#### D. Notification Display
- Show pending approvals count in header/navigation
- List of pending approvals with quick approve/reject actions

### 3. Firestore Collections

#### A. calendarStatusNotifications
```typescript
{
  id: string
  updateId: string // Reference to calendarUpdate
  department: string
  requestedBy: string
  requestedByName: string
  requestedAt: Timestamp
  status: 'pending' | 'approved' | 'rejected'
  reviewedBy?: string
  reviewedAt?: Timestamp
  message?: string
}
```

### 4. Business Logic

#### A. Status Update Flow
1. User (Specialist/DepartmentHead) selects "Pending Approval"
2. Update `departmentStatuses[department]` in calendarUpdate
3. Create notification in `calendarStatusNotifications`
4. Notify all Managers and Admins
5. Manager/Admin reviews and approves/rejects
6. Update department status to "Completed" or back to "In Progress"
7. Check if all departments are completed
8. If all completed, update `overallStatus` to "Completed"

#### B. Auto-Complete Logic
```typescript
function checkAllDepartmentsComplete(update: CalendarUpdate): boolean {
  const departments = Object.keys(update.departmentStatuses || {})
  return departments.every(dept => 
    update.departmentStatuses[dept]?.status === 'Completed'
  )
}
```

### 5. Security Rules (Firestore)

- Allow users to update their own department's status (if assigned)
- Allow Managers/Admins to update any department status
- Allow Managers/Admins to approve/reject notifications
- Read access for all authenticated users

### 6. Implementation Steps

1. **Update Type Definitions**
   - Extend CalendarUpdate type
   - Add DepartmentStatus type
   - Add notification types

2. **Update Firestore Rules**
   - Add rules for departmentStatuses updates
   - Add rules for calendarStatusNotifications

3. **Create Status Management Functions**
   - `updateDepartmentStatus()` - Update status with validation
   - `requestApproval()` - Create notification and notify admins
   - `approveStatus()` - Approve pending request
   - `checkAndUpdateOverallStatus()` - Auto-complete logic

4. **Update UI Components**
   - Add status column to department table
   - Create StatusSelector component
   - Add notification display component
   - Update calendar update card to show overall status

5. **Add Notification System**
   - Create notification listener
   - Display notification badge
   - Show pending approvals list
   - Add approve/reject actions

6. **Testing**
   - Test status updates by different roles
   - Test approval workflow
   - Test auto-completion when all departments done
   - Test notifications

## File Changes

### New Files:
- `apps/web/src/components/StatusSelector.tsx` - Status dropdown component
- `apps/web/src/components/CalendarStatusNotification.tsx` - Notification display

### Modified Files:
- `apps/web/src/pages/UpdateCalendarPage.tsx` - Add status column and logic
- `apps/web/src/pages/UpdateCalendarPage.css` - Style status column
- `firestore.rules` - Add security rules for status updates
- `apps/web/src/lib/notifications.ts` - Extend for status notifications

## User Experience Flow

1. **Specialist completes work:**
   - Opens calendar update
   - Sees their department row
   - Changes status from "In Progress" → "Pending Approval"
   - Confirmation message shown

2. **Manager/Admin receives notification:**
   - Desktop notification appears
   - Sound plays
   - Badge shows count of pending approvals
   - Can click to see list

3. **Manager/Admin approves:**
   - Views pending approval
   - Clicks "Approve" button
   - Status updates to "Completed"
   - System checks if all departments done

4. **All departments complete:**
   - Overall status badge shows "Completed"
   - Visual indicator (green checkmark, etc.)
   - Task marked as done
