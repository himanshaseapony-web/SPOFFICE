# KPI Point Removal on Task Deletion

## Overview
When a calendar update (task) is deleted, all KPI points awarded for that update are automatically removed from users. This ensures data consistency and prevents users from keeping points for work that no longer exists in the system.

## Implementation Details

### 1. Core Function: `removeKPIPoints()` 
**Location:** `apps/web/src/lib/kpi.ts`

**What it does:**
- Finds all KPI point awards associated with a deleted update
- Subtracts points from each user's total (won't go negative)
- Creates reversal history records for audit trail
- Logs all operations for debugging

**Key Features:**
- ✅ **Batch Processing** - Groups all awards by user for efficient updates
- ✅ **Safe Subtraction** - Uses `Math.max(0, ...)` to prevent negative points
- ✅ **Audit Trail** - Creates reversal records with negative points
- ✅ **Error Handling** - Continues even if individual reversals fail
- ✅ **Comprehensive Logging** - Shows exactly what was removed and from whom

### 2. Integration Point: Delete Handler
**Location:** `apps/web/src/pages/UpdateCalendarPage.tsx` (line 336)

**Flow:**
1. User clicks delete button on a calendar update
2. Confirmation dialog warns: "Any KPI points awarded will be removed"
3. System calls `removeKPIPoints(firestore, updateId)` first
4. Then deletes the calendar update document
5. Success message logged to console

### 3. Security Rules: Reversal Records
**Location:** `firestore.rules` (lines 306-337)

**Changes:**
- Allow creating history records with **negative points** (reversals)
- Validate optional `originalAwardId` and `reversedAt` fields
- Maintain immutability (no updates allowed)

## How It Works

### Award Flow (Original)
```
Manager approves work
→ awardKPIPoints() called
→ User gets +1 point
→ History record created: { points: 1, reason: "Calendar Update Completed" }
```

### Removal Flow (New)
```
Admin deletes calendar update
→ removeKPIPoints() called
→ Finds all history records for that update
→ For each user:
   - Subtracts points from total (e.g., 10 → 9)
   - Creates reversal record: { points: -1, reason: "Calendar Update Deleted" }
→ Calendar update deleted
```

## Data Structure

### Reversal History Record
```typescript
{
  userId: "user123",
  userName: "John Doe",
  points: -1,                          // Negative for reversal
  reason: "Calendar Update Deleted",   
  updateId: "cal_update_abc",          // Links to original update
  department: "Programming",
  month: "January",
  year: 2026,
  taskDetails: "Q1 Sprint Review",
  awardedAt: Timestamp,                // When reversal was created
  originalAwardId: "history_xyz",      // Links to original award
  reversedAt: "2026-01-22T10:30:00Z"  // ISO timestamp of reversal
}
```

## Benefits

### 1. Data Consistency
- Points reflect only current, existing work
- No orphaned points from deleted updates

### 2. Audit Trail
- Full history preserved (awards + reversals)
- Can reconstruct point changes over time
- Transparent for compliance/reporting

### 3. Fairness
- Users can't keep points for deleted work
- Leaderboard stays accurate
- Prevents point inflation

### 4. User Feedback
- Confirmation dialog warns about point removal
- Console logs show exactly what was removed
- Clear messaging about consequences

## Testing

### Test Scenario 1: Delete Update with Points
1. Create calendar update with assignees
2. Have specialist mark as "Pending Approval"
3. Manager approves → users get points
4. Check KPI Points page → points visible
5. Delete the calendar update
6. Check console → should see removal logs
7. Check KPI Points page → points should be gone
8. Check Firestore → reversal records should exist

### Test Scenario 2: Delete Update Without Points
1. Create calendar update
2. Delete before any work is approved
3. Should see: "No KPI points found for update"
4. No errors, clean deletion

### Test Scenario 3: Multiple Departments
1. Create update with 3 departments
2. Approve work for 2 departments (some users get points)
3. Delete update
4. Points removed only from users who received them
5. Reversal records created for each user

## Console Logs

### Successful Removal
```
🔄 Removing KPI points for deleted update: cal_update_123
📋 Found 3 point award(s) to reverse
✅ Removed 1 point(s) from John Doe (10 → 9)
✅ Removed 1 point(s) from Jane Smith (15 → 14)
✅ Removed 1 point(s) from Bob Wilson (8 → 7)
📝 Created 1 reversal record(s) for John Doe
📝 Created 1 reversal record(s) for Jane Smith
📝 Created 1 reversal record(s) for Bob Wilson
✅ Successfully removed all KPI points for update cal_update_123
✅ Successfully deleted update cal_update_123 and removed associated KPI points
```

### No Points to Remove
```
🔄 Removing KPI points for deleted update: cal_update_456
ℹ️ No KPI points found for update cal_update_456
✅ Successfully deleted update cal_update_456 and removed associated KPI points
```

## Error Handling

### Scenarios Covered
1. **Firestore unavailable** - Function returns early, logs error
2. **User doesn't exist** - Skips that user, continues with others
3. **Points record missing** - Logs warning, creates reversal record anyway
4. **Permission denied** - Logs error, continues with other users
5. **Network failure** - Logs error, doesn't crash app

### Recovery
- All operations are idempotent (safe to retry)
- Partial failures don't block other users
- Reversal records preserve audit trail even if point subtraction fails

## Security

### Who Can Delete Updates (and Remove Points)?
- **Admins** - Can delete any update
- **Managers** - Can delete any update
- **Task Creators** - Can delete their own updates

### Firestore Rules Enforcement
- Only Managers/Admins can create history records (including reversals)
- Points can't go negative (enforced in code: `Math.max(0, ...)`)
- History records are immutable (can't be edited)
- Users can only read their own history records

## Future Enhancements

### Potential Additions
1. **UI notification** - Toast message showing points removed
2. **Undo feature** - Restore deleted update and points (within time window)
3. **Batch deletion** - Delete multiple updates and remove points efficiently
4. **Admin report** - Show all reversals in a given time period
5. **Point adjustment** - Manual point add/remove by admins

## Files Modified

1. **`apps/web/src/lib/kpi.ts`**
   - Added `removeKPIPoints()` function

2. **`apps/web/src/pages/UpdateCalendarPage.tsx`**
   - Imported `removeKPIPoints`
   - Updated `handleDelete()` to call removal function
   - Updated confirmation dialog message

3. **`firestore.rules`**
   - Updated KPI Point History rules to allow negative points
   - Added validation for reversal-specific fields

## Deployment Status

✅ **Code Changes** - Implemented and linted
✅ **Firestore Rules** - Deployed to production
✅ **Testing** - Ready for QA
✅ **Documentation** - Complete

**Deployed to:** Firebase project `openwork-bef57`
**Date:** January 22, 2026
