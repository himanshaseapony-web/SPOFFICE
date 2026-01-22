# Enhanced KPI System - Department Leaderboards with Deadline Penalties

## Overview
A fair, department-based KPI scoring system that rewards on-time completion and penalizes late submissions. Each department has its own leaderboard, making comparisons fair regardless of task volume.

## Key Features

### ✅ What's New
1. **3 Separate Department Leaderboards** - Programming, 3D Development, UI/UX
2. **Deadline-Based Scoring** - Half points for late completions
3. **Precise Task Tracking** - On-time, late, and incomplete counts
4. **Percentage-Based Scores** - Fair comparison across different task volumes
5. **Multi-Assignee Support** - All assignees get the same score (on-time or late)

---

## Scoring System

### Formula
```
Effective Points = (On-time tasks × 1.0) + (Late tasks × 0.5) + (Incomplete × 0.0)
Score = (Effective Points / Total Assigned Tasks) × 100

Example:
- Assigned: 5 tasks
- Completed on time: 3 tasks = 3.0 points
- Completed late: 2 tasks = 1.0 points (2 × 0.5)
- Total: 4.0 / 5.0 = 80% score
```

### Point Values
- ✅ **On-time completion**: 1.0 point (full credit)
- ⚠️ **Late completion**: 0.5 points (50% penalty)
- ❌ **Incomplete**: 0.0 points (no credit)

### Deadline Detection
```javascript
const deadline = new Date(departmentDeadline)
const completedAt = new Date() // When manager approves
const wasLate = completedAt > deadline

// Award accordingly
const pointsToAward = wasLate ? 0.5 : 1.0
```

---

## Department Leaderboards

### Layout
```
┌──────────────────────────────────────────────────────┐
│ KPI Points - Department Leaderboards    [Reset All] │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Department Stats Overview                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │ Programming │ │ 3D Dev      │ │ UI/UX       │  │
│  │ 5 users     │ │ 3 users     │ │ 4 users     │  │
│  │ Avg: 82%    │ │ Avg: 75%    │ │ Avg: 88%    │  │
│  └─────────────┘ └─────────────┘ └─────────────┘  │
│                                                      │
│  [ 🏆 Programming ]  [ 3D Development ]  [ UI/UX ]  │
│   ━━━━━━━━━━━━━━                                    │
│                                                      │
│  Programming Leaderboard                            │
│  5 participants • Legend: ✅ On-time ⚠️ Late ❌ Inc │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ 🥇  John Doe              100%                 │ │
│  │     Specialist            5✅ 0⚠️ 0❌ / 5     │ │
│  │                           Effective: 5.0 pts   │ │
│  ├────────────────────────────────────────────────┤ │
│  │ 🥈  Sarah Smith           80%                  │ │
│  │     Specialist            3✅ 2⚠️ 0❌ / 5     │ │
│  │                           Effective: 4.0 pts   │ │
│  ├────────────────────────────────────────────────┤ │
│  │ 🥉  Tom Wilson            60%                  │ │
│  │     Specialist            3✅ 0⚠️ 2❌ / 5     │ │
│  │                           Effective: 3.0 pts   │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  Detailed Breakdown Table                           │
│  ┌───────────────────────────────────────────────┐  │
│  │ Rank│Name      │Score│On│Late│Inc│Tot│Eff   │  │
│  ├───────────────────────────────────────────────┤  │
│  │ 🥇  │John Doe  │100% │5 │0   │0  │5  │5.0   │  │
│  │ 🥈  │Sarah S.  │80%  │3 │2   │0  │5  │4.0   │  │
│  │ 🥉  │Tom W.    │60%  │3 │0   │2  │5  │3.0   │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  Scoring System Explanation                         │
│  • On-time: 1.0 point  • Late: 0.5 points          │
│  • Score = (Effective / Total) × 100                │
└──────────────────────────────────────────────────────┘
```

---

## Data Structure

### KPI Points Document
```typescript
{
  // User identification
  userId: "user123",
  userName: "John Doe",
  department: "Programming",
  
  // Task tracking
  tasksAssigned: 5,
  tasksCompletedOnTime: 3,
  tasksCompletedLate: 2,
  tasksIncomplete: 0,
  
  // Scoring
  effectivePoints: 4.0,  // 3 + (2 × 0.5)
  score: 80,             // (4.0 / 5) × 100
  points: 4.0,           // Same as effectivePoints
  
  // Metadata
  lastUpdated: "2026-01-22T10:00:00Z",
  createdAt: "2026-01-15T08:00:00Z"
}
```

### KPI History Record (Enhanced)
```typescript
{
  // User & task info
  userId: "user123",
  userName: "John Doe",
  department: "Programming",
  updateId: "cal_update_abc",
  
  // Points awarded
  points: 0.5,  // Half point for late completion
  reason: "Calendar Update Completed Late",
  
  // Deadline tracking
  deadline: "2026-01-20T17:00:00Z",
  completedAt: "2026-01-22T10:00:00Z",
  wasLate: true,
  
  // Task details
  month: "January",
  year: 2026,
  taskDetails: "Q1 Sprint Review",
  awardedAt: Timestamp
}
```

---

## Award Flow

### Scenario 1: On-time Completion ✅
```
1. Task assigned to John (Programming)
2. Deadline: Jan 20, 5:00 PM
3. Manager approves: Jan 18, 3:00 PM ✅
4. System calculates: completedAt < deadline
5. Award: 1.0 point (full credit)
6. Update John's KPI:
   - tasksAssigned: 4 → 5
   - tasksCompletedOnTime: 3 → 4
   - effectivePoints: 3.5 → 4.5
   - score: 87.5% → 90%
```

### Scenario 2: Late Completion ⚠️
```
1. Task assigned to Sarah (Programming)
2. Deadline: Jan 20, 5:00 PM
3. Manager approves: Jan 22, 10:00 AM ⚠️
4. System calculates: completedAt > deadline
5. Award: 0.5 points (50% penalty)
6. Update Sarah's KPI:
   - tasksAssigned: 4 → 5
   - tasksCompletedLate: 1 → 2
   - effectivePoints: 3.5 → 4.0
   - score: 87.5% → 80%
```

### Scenario 3: Multiple Assignees 👥
```
1. Task assigned to Mike AND Lisa (both 3D Development)
2. Deadline: Jan 25, 5:00 PM
3. Manager approves: Jan 26, 2:00 PM ⚠️
4. Both marked as late
5. Both get: 0.5 points each
6. Both have tasksCompletedLate increased
```

---

## UI Components

### 1. Department Overview Cards
Shows high-level stats for each department:
- Number of participants
- Average score
- Quick department comparison

### 2. Department Tabs
Click to switch between:
- 🏆 Programming
- 🏆 3D Development  
- 🏆 UI/UX

### 3. Leaderboard Cards
Each participant shows:
- Rank (🥇🥈🥉 or #4, #5, etc.)
- Name and role
- Task breakdown: ✅ X / ⚠️ Y / ❌ Z / Total
- Effective points (with decimals)
- Percentage score (large, prominent)

### 4. Detailed Table
Comprehensive view with columns:
- Rank
- Name (with role)
- Score (percentage)
- On-Time (count)
- Late (count)
- Incomplete (count)
- Total (count)
- Effective (points)

### 5. Scoring Legend
Always visible explanation:
- ✅ On-time: 1.0 point
- ⚠️ Late: 0.5 points
- ❌ Incomplete: 0.0 points
- Score formula shown

---

## Example Scenarios

### Fair Comparison Example

**Before (Old System - Unfair):**
```
Company-Wide Leaderboard:
1. Mike (3D)      - 8 points  (8/9 tasks)   ← Always wins due to volume
2. John (Prog)    - 5 points  (5/5 tasks)
3. Alex (UI/UX)   - 5 points  (5/5 tasks)
```

**After (New System - Fair):**
```
Programming Leaderboard:
1. John      - 100%  (5/5 on-time)
2. Sarah     - 80%   (3 on-time, 2 late)

3D Development Leaderboard:
1. Mike      - 89%   (8/9 on-time)
2. Lisa      - 78%   (7/9 on-time)

UI/UX Leaderboard:
1. Alex      - 100%  (5/5 on-time)
2. Emma      - 70%   (2 on-time, 2 late, 1 incomplete)
```

### Late Penalty Example

**User: Sarah (Programming)**
```
Month: January 2026

Tasks:
1. API Integration     ✅ On-time (Jan 10) = 1.0 pt
2. Dashboard Update    ⚠️ Late (Jan 22, due Jan 20) = 0.5 pt
3. Bug Fixes          ⚠️ Late (Jan 18, due Jan 15) = 0.5 pt
4. Code Review        ✅ On-time (Jan 8) = 1.0 pt
5. Database Migration ✅ On-time (Jan 12) = 1.0 pt

Calculation:
- Effective Points: 3.0 + 1.0 = 4.0
- Score: 4.0 / 5.0 = 80%

Leaderboard Display:
🥈 Sarah Smith - 80% (3✅ 2⚠️ 0❌ / 5)
```

---

## Implementation Details

### Files Modified

1. **`apps/web/src/lib/kpi.ts`**
   - Updated `KPIPoint` type with task breakdown fields
   - Updated `KPIPointHistory` type with deadline tracking
   - Enhanced `awardKPIPoints()` to accept deadline parameter
   - Calculate on-time vs late and award accordingly
   - Track all task metrics per user
   - Updated `resetAllKPIPoints()` to reset all new fields

2. **`apps/web/src/pages/KPIPointsPage.tsx`**
   - Complete UI overhaul
   - Added department tabs
   - Created department overview cards
   - Built leaderboard with task breakdown
   - Added detailed statistics table
   - Included scoring system legend

3. **`apps/web/src/pages/UpdateCalendarPage.tsx`**
   - Pass deadline to `awardKPIPoints()` when approving
   - Get department-specific deadline
   - Calculate late status automatically

4. **`apps/web/src/context/AppDataContext.tsx`**
   - Updated `KPIPoint` type definition
   - Enhanced Firestore mapping to include all new fields
   - Sort by score instead of raw points

5. **`apps/web/src/App.css`**
   - Added `.kpi-task-breakdown` styles
   - Responsive layout for task counts

6. **`firestore.rules`**
   - Allow new fields in `kpiPoints` collection
   - Allow decimal points (not just integers)
   - Allow deadline tracking fields in history
   - Validate all new optional fields

---

## How It Works End-to-End

### Step 1: Create Calendar Update
```
Admin/Manager creates update:
- Month: January
- Department: Programming
- Assignees: John, Sarah (both Programming)
- Deadline: Jan 20, 5:00 PM
```

### Step 2: Initial State
```
John's KPI: { tasksAssigned: 0, score: 0% }
Sarah's KPI: { tasksAssigned: 0, score: 0% }
```

### Step 3: Specialist Completes Work
```
Specialist marks department as "Pending Approval"
(Waiting for manager approval)
```

### Step 4: Manager Approves (On-time)
```
Date: Jan 18, 3:00 PM
Deadline: Jan 20, 5:00 PM
Result: ON-TIME ✅

John's KPI updated:
- tasksAssigned: 0 → 1
- tasksCompletedOnTime: 0 → 1
- effectivePoints: 0 → 1.0
- score: 0% → 100%

Sarah's KPI updated:
- tasksAssigned: 0 → 1
- tasksCompletedOnTime: 0 → 1
- effectivePoints: 0 → 1.0
- score: 0% → 100%

History created for each:
- points: 1.0
- wasLate: false
- deadline: "2026-01-20T17:00:00Z"
- completedAt: "2026-01-18T15:00:00Z"
```

### Step 5: Manager Approves (Late)
```
New task for Programming
Date: Jan 22, 10:00 AM
Deadline: Jan 20, 5:00 PM
Result: LATE ⚠️

Sarah's KPI updated:
- tasksAssigned: 1 → 2
- tasksCompletedLate: 0 → 1
- effectivePoints: 1.0 → 1.5
- score: 100% → 75%

John's KPI updated:
- tasksAssigned: 1 → 2
- tasksCompletedOnTime: 1 → 2
- effectivePoints: 1.0 → 2.0
- score: 100% → 100%

Programming Leaderboard:
1. John  - 100% (2✅ 0⚠️ 0❌ / 2)
2. Sarah - 75%  (1✅ 1⚠️ 0❌ / 2)
```

---

## Console Logs

### On-time Award
```
✅ Awarding 1 point(s) (On-time) to 2 assignee(s) in Programming
   Deadline: 1/20/2026, 5:00:00 PM, Completed: 1/18/2026, 3:00:00 PM
   John Doe: 4.0 → 5.0 points (100% score)
   Sarah Smith: 3.5 → 4.5 points (90% score)
```

### Late Award
```
⚠️ Awarding 0.5 point(s) (Late) to 2 assignee(s) in Programming
   Deadline: 1/20/2026, 5:00:00 PM, Completed: 1/22/2026, 10:00:00 AM
   John Doe: 5.0 → 5.5 points (92% score)
   Sarah Smith: 4.5 → 5.0 points (83% score)
```

---

## Fairness Analysis

### Problem: Unequal Task Volumes
```
Programming:    3-5 tasks per month
3D Development: 8-9 tasks per month
UI/UX:          4-5 tasks per month
```

### Solution: Percentage-Based Scoring
```
Old System (Unfair):
- 3D developer: 8/9 tasks = 8 points ← Winner (just more tasks)
- Programmer: 5/5 tasks = 5 points
- UI/UX: 5/5 tasks = 5 points

New System (Fair):
- 3D developer: 8/9 on-time = 89% ← Performance matters
- Programmer: 5/5 on-time = 100% ← Perfect performer wins
- UI/UX: 5/5 on-time = 100% ← Perfect performer wins

Each department has its own leaderboard!
Programming winner: 100% completion
3D Development winner: 89% completion
UI/UX winner: 100% completion
```

---

## Department Comparison

### Programming Leaderboard
```
Expected Volume: 3-5 tasks/month
Focus: Quality over quantity
Typical Scores: 80-100%
```

### 3D Development Leaderboard
```
Expected Volume: 8-9 tasks/month
Focus: High output, maintain quality
Typical Scores: 70-90%
```

### UI/UX Leaderboard
```
Expected Volume: 4-5 tasks/month
Focus: Balanced workload
Typical Scores: 75-100%
```

---

## Reset Functionality

### What Gets Reset
```
All users → 0 across all fields:
- points: 0
- tasksAssigned: 0
- tasksCompletedOnTime: 0
- tasksCompletedLate: 0
- tasksIncomplete: 0
- effectivePoints: 0
- score: 0
```

### When to Reset
- Start of new performance period (month/quarter)
- New year
- After organizational changes
- Clear test data

---

## Benefits

### 1. Fair Competition
✅ Departments with different task volumes compete fairly
✅ Percentage-based scoring levels the playing field
✅ Can't win just by having more tasks

### 2. Deadline Accountability
✅ Late submissions penalized (50% penalty)
✅ Encourages on-time delivery
✅ Visible impact on score

### 3. Transparency
✅ Clear task breakdown (on-time/late/incomplete)
✅ Visible scoring formula
✅ Audit trail in history

### 4. Department Focus
✅ Compare yourself to peers in same department
✅ Relevant competition (similar work)
✅ Department-specific standards

### 5. Motivation
✅ Visual feedback (medals, percentages)
✅ Clear path to improvement
✅ Gamification without unfairness

---

## Testing Checklist

### Test 1: On-time Completion
- [ ] Create calendar update with deadline
- [ ] Assign to user(s)
- [ ] Approve BEFORE deadline
- [ ] Verify: 1.0 point awarded
- [ ] Check: tasksCompletedOnTime increased
- [ ] History: wasLate = false

### Test 2: Late Completion
- [ ] Create calendar update with deadline
- [ ] Wait until after deadline
- [ ] Approve AFTER deadline
- [ ] Verify: 0.5 points awarded
- [ ] Check: tasksCompletedLate increased
- [ ] History: wasLate = true

### Test 3: Multiple Assignees
- [ ] Assign task to 3 people in same department
- [ ] Approve (late or on-time)
- [ ] Verify: All 3 get same points
- [ ] Check: All 3 have same wasLate status

### Test 4: Department Leaderboards
- [ ] Create tasks in all 3 departments
- [ ] Complete some on-time, some late
- [ ] Check Programming tab: sorted by score
- [ ] Check 3D Development tab: sorted by score
- [ ] Check UI/UX tab: sorted by score
- [ ] Verify: Separate rankings per department

### Test 5: Score Calculation
- [ ] User with 5 assigned, 3 on-time, 2 late
- [ ] Expected: (3 + 1.0) / 5 = 80%
- [ ] Verify: Score shows 80%
- [ ] Verify: Effective points = 4.0

### Test 6: Reset
- [ ] Admin clicks reset
- [ ] Confirm action
- [ ] Verify: All departments show 0 participants
- [ ] Verify: All scores reset to 0
- [ ] Award new point
- [ ] Verify: User appears in department leaderboard

---

## Migration Notes

### Existing Data
Old KPI records won't have the new fields. They will default to:
```typescript
{
  department: "Unknown",  // If not set
  tasksAssigned: 0,
  tasksCompletedOnTime: 0,
  tasksCompletedLate: 0,
  tasksIncomplete: 0,
  effectivePoints: 0,
  score: 0
}
```

### Recommendation
After deploying:
1. Use "Reset All KPI Points" to clear old data
2. Start fresh with new scoring system
3. All future awards will use new system

---

## Deployment Status

✅ **Code Implementation** - Complete
✅ **Type Definitions** - Updated
✅ **UI Components** - Built
✅ **Firestore Rules** - Deployed
✅ **Linting** - No errors
✅ **Documentation** - Complete

**Deployed to:** Firebase project `openwork-bef57`
**Date:** January 22, 2026

---

## Future Enhancements (Optional)

1. **Task Complexity Weighting** - Different point values per task type
2. **Quality Bonuses** - Extra points for exceptional work
3. **Monthly Archives** - Historical leaderboards by month
4. **Export Reports** - Download department performance data
5. **Notifications** - Alert when someone overtakes you in ranking
6. **Achievements** - Badges for perfect months, improvement streaks
7. **Analytics Dashboard** - Trends, charts, insights
