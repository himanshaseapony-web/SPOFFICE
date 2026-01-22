# KPI Debugging Guide

## Current Scoring Rules

### ✅ CORRECT Scoring:
- **1 task completed ON-TIME** = **1.0 point**
- **1 task completed LATE** = **0.5 points**

### 📊 Example:
```
User completes 5 tasks:
- 4 on-time: 4 × 1.0 = 4.0 points
- 1 late: 1 × 0.5 = 0.5 points
Total: 4.5 effective points
Score: (4.5 / 5) × 100 = 90%
```

---

## 🔍 How to Verify Scoring

### 1. Check Firebase Console

**Go to Firestore → `kpiPointHistory` collection**

For each user, you should see ONE history record PER calendar update:

```
✅ CORRECT (1 point per update):
Document 1:
  userId: "hasitha123"
  updateId: "update_jan_1"
  department: "Programming"
  points: 1.0
  
Document 2:
  userId: "hasitha123"
  updateId: "update_jan_2"
  department: "Programming"
  points: 1.0
  
Total: 2 history records = 2.0 points ✅
```

```
❌ WRONG (duplicates):
Document 1:
  userId: "hasitha123"
  updateId: "update_jan_1"  ← Same update!
  department: "Programming"
  points: 1.0
  
Document 2:
  userId: "hasitha123"
  updateId: "update_jan_1"  ← Same update!
  department: "Programming"
  points: 1.0
  
Total: 2 history records for SAME update = BUG ❌
```

### 2. Check Browser Console

When a task is completed and approved, you should see:

```
✅ Awarding 1 point(s) (On-time) to 2 assignee(s) in Programming
   Creating/updating KPI record: hasitha123_Programming (Programming)
   hasitha: 0.0 → 1.0 points (100% score)
```

**If you see multiple awards for the same update:**
```
❌ BAD - Multiple awards:
✅ Awarding 1 point(s) to 2 assignee(s) in Programming
   hasitha: 0.0 → 1.0 points
✅ Awarding 1 point(s) to 2 assignee(s) in Programming  ← DUPLICATE!
   hasitha: 1.0 → 2.0 points  ← BUG!
```

---

## 🧪 Test Scenario

### Create a Fresh Test:

1. **Reset all KPI data** (KPI Points page → Reset All KPI Points)
2. **Create ONE new calendar update:**
   - Month: Current month
   - Task: "KPI Test Task"
   - Assign: 1 person from Programming
   - Deadline: Tomorrow
3. **Complete the task:**
   - Mark Programming status: "Pending Approval"
   - As Manager/Admin: Approve → "Completed"
4. **Check results:**
   - Programming leaderboard should show: **1 participant, 1.0 points** ✅
   - Firestore `kpiPointHistory` should have: **1 record** ✅

---

## 🐛 Possible Issues

### Issue 1: Old Test Data
**Problem:** Multiple duplicate records from testing
**Solution:** Reset all KPI data and start fresh

### Issue 2: Multiple Department Assignments
**Problem:** User assigned to multiple departments in same update
**Expected:** User gets 1 point PER department (if they complete work in each)
**Example:**
```
User "John" assigned to:
- Programming (completes on-time)
- UI/UX (completes late)

Result:
- Document: john123_Programming → 1.0 points ✅
- Document: john123_UI_UX → 0.5 points ✅
- Total effective points: 1.5 points ✅
```

### Issue 3: Status Changed Multiple Times
**Problem:** Manager approves, then changes status back, then approves again
**Solution:** Duplicate detection should prevent re-awarding
**Check console for:** "⚠️ KPI points already awarded... Skipping duplicate."

---

## 📋 Verification Checklist

For **himansha** (showing 5.0 points):

1. ☐ Go to Firestore → `kpiPointHistory`
2. ☐ Filter by `userId == himansha's_user_id`
3. ☐ Count how many UNIQUE `updateId` values
4. ☐ Should be 5 unique updates = 5.0 points ✅
5. ☐ If fewer than 5 unique updates = DUPLICATE BUG ❌

---

## 🔧 If You Find Duplicates

### Temporary Fix:
1. Go to KPI Points page
2. Click "Reset All KPI Points"
3. Re-complete tasks with new code
4. Should work correctly now

### Report the Issue:
If you still see duplicates after this fix, please provide:
1. Screenshot of browser console logs
2. Screenshot of Firestore `kpiPointHistory` for affected user
3. Steps you took to complete the task

---

## ✅ Expected Behavior Summary

| Scenario | Points Awarded | Example |
|----------|---------------|---------|
| 1 task, on-time | 1.0 | Deadline: Jan 15, Completed: Jan 14 → 1.0 points |
| 1 task, late | 0.5 | Deadline: Jan 15, Completed: Jan 16 → 0.5 points |
| 2 tasks, both on-time | 2.0 | Task 1: 1.0, Task 2: 1.0 → Total: 2.0 |
| 5 tasks, all on-time | 5.0 | Each task: 1.0 → Total: 5.0 |
| 5 tasks (4 on-time, 1 late) | 4.5 | (4 × 1.0) + (1 × 0.5) = 4.5 |

**Current Data Analysis:**
- **hasitha**: 2.0 points, 2 tasks → **1.0 point per task** ✅ CORRECT
- **himansha**: 5.0 points, 5 tasks → **1.0 point per task** ✅ CORRECT

This looks like correct scoring! Each task gives 1 point.
