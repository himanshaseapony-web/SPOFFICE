import type { LeaveRequest } from '../context/AppDataContext'

/**
 * Calculate the current quota period (25th of current/previous month to 25th of next/current month)
 */
export function getQuotaPeriod(): { start: Date; end: Date } {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const currentDay = now.getDate()

  let periodStart: Date
  let periodEnd: Date

  if (currentDay >= 25) {
    // If today is 25th or later, period started on 25th of current month
    periodStart = new Date(currentYear, currentMonth, 25)
    periodStart.setHours(0, 0, 0, 0)
    // Period ends on 25th of next month
    periodEnd = new Date(currentYear, currentMonth + 1, 25)
    periodEnd.setHours(0, 0, 0, 0)
  } else {
    // If today is before 25th, period started on 25th of previous month
    periodStart = new Date(currentYear, currentMonth - 1, 25)
    periodStart.setHours(0, 0, 0, 0)
    // Period ends on 25th of current month
    periodEnd = new Date(currentYear, currentMonth, 25)
    periodEnd.setHours(0, 0, 0, 0)
  }

  return { start: periodStart, end: periodEnd }
}

/**
 * Generate date range from start to end date
 */
function generateDateRange(startDate: string, endDate: string): string[] {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const dates: string[] = []

  const current = new Date(start)
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }

  return dates
}

/**
 * Check if a request has any days within the quota period
 */
function hasDaysInPeriod(request: LeaveRequest, periodStart: Date, periodEnd: Date): boolean {
  const days = request.selectedDays && request.selectedDays.length > 0
    ? request.selectedDays
    : request.startDate && request.endDate
      ? generateDateRange(request.startDate, request.endDate)
      : []

  return days.some((day) => {
    const dayDate = new Date(day)
    dayDate.setHours(0, 0, 0, 0)
    return dayDate >= periodStart && dayDate < periodEnd
  })
}

/**
 * Calculate quota usage for a user
 */
export function calculateQuotaUsage(
  leaveRequests: LeaveRequest[],
  userId: string
): { leave: number; wfh: number } {
  const { start, end } = getQuotaPeriod()
  const userRequests = leaveRequests.filter(
    (req) => req.userId === userId && req.status === 'Approved'
  )

  let leaveCount = 0
  let wfhCount = 0

  userRequests.forEach((request) => {
    if (hasDaysInPeriod(request, start, end)) {
      if (request.type === 'Leave') {
        leaveCount++
      } else if (request.type === 'Work From Home') {
        wfhCount++
      }
    }
  })

  return { leave: leaveCount, wfh: wfhCount }
}

/**
 * Check if user can submit a new request of the given type
 */
export function canSubmitRequest(
  leaveRequests: LeaveRequest[],
  userId: string,
  type: 'Leave' | 'Work From Home'
): { allowed: boolean; reason?: string } {
  const usage = calculateQuotaUsage(leaveRequests, userId)
  const maxLeave = 2
  const maxWFH = 2

  if (type === 'Leave' && usage.leave >= maxLeave) {
    return {
      allowed: false,
      reason: `You have reached your leave quota (${maxLeave} leaves per period).`,
    }
  }

  if (type === 'Work From Home' && usage.wfh >= maxWFH) {
    return {
      allowed: false,
      reason: `You have reached your work from home quota (${maxWFH} requests per period).`,
    }
  }

  return { allowed: true }
}
