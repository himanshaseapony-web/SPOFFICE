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
 * Count how many days from a request fall within the quota period
 */
function countDaysInPeriod(request: LeaveRequest, periodStart: Date, periodEnd: Date): number {
  const days = request.selectedDays && request.selectedDays.length > 0
    ? request.selectedDays
    : request.startDate && request.endDate
      ? generateDateRange(request.startDate, request.endDate)
      : []

  // Count days that fall within the quota period
  return days.filter((day) => {
    const dayDate = new Date(day)
    dayDate.setHours(0, 0, 0, 0)
    return dayDate >= periodStart && dayDate < periodEnd
  }).length
}

/**
 * Calculate quota usage for a user (counts days, not requests)
 */
export function calculateQuotaUsage(
  leaveRequests: LeaveRequest[],
  userId: string
): { leave: number; wfh: number } {
  const { start, end } = getQuotaPeriod()
  const userRequests = leaveRequests.filter(
    (req) => req.userId === userId && req.status === 'Approved'
  )

  let leaveDays = 0
  let wfhDays = 0

  userRequests.forEach((request) => {
    const daysInPeriod = countDaysInPeriod(request, start, end)
    if (daysInPeriod > 0) {
      if (request.type === 'Leave') {
        leaveDays += daysInPeriod
      } else if (request.type === 'Work From Home') {
        wfhDays += daysInPeriod
      }
    }
  })

  return { leave: leaveDays, wfh: wfhDays }
}

/**
 * Check if user can submit a new request of the given type with specified number of days
 */
export function canSubmitRequest(
  leaveRequests: LeaveRequest[],
  userId: string,
  type: 'Leave' | 'Work From Home',
  numberOfDays: number
): { allowed: boolean; reason?: string } {
  const usage = calculateQuotaUsage(leaveRequests, userId)
  const maxLeave = 2
  const maxWFH = 2

  if (type === 'Leave') {
    const totalAfterRequest = usage.leave + numberOfDays
    if (totalAfterRequest > maxLeave) {
      const remaining = Math.max(0, maxLeave - usage.leave)
      return {
        allowed: false,
        reason: `You can only request ${remaining} more day${remaining !== 1 ? 's' : ''} of leave. You have ${usage.leave} of ${maxLeave} days used.`,
      }
    }
  }

  if (type === 'Work From Home') {
    const totalAfterRequest = usage.wfh + numberOfDays
    if (totalAfterRequest > maxWFH) {
      const remaining = Math.max(0, maxWFH - usage.wfh)
      return {
        allowed: false,
        reason: `You can only request ${remaining} more day${remaining !== 1 ? 's' : ''} of work from home. You have ${usage.wfh} of ${maxWFH} days used.`,
      }
    }
  }

  return { allowed: true }
}
