import { parseLocalDate, formatDateISO, addDays, daysBetween } from '../date.utils'

/**
 * Check if two dates are the same day (ignoring time)
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date())
}

/**
 * Check if a date is a weekend (Saturday or Sunday)
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6 // 0 = Sunday, 6 = Saturday
}

/**
 * Get an array of all dates between two dates (inclusive)
 */
export function getDateRange(startDate: Date | string, endDate: Date | string): Date[] {
  const start = typeof startDate === 'string' ? parseLocalDate(startDate) : startDate
  const end = typeof endDate === 'string' ? parseLocalDate(endDate) : endDate

  if (!start || !end) return []

  const dates: Date[] = []
  let current = new Date(start)

  while (current <= end) {
    dates.push(new Date(current))
    current = addDays(current, 1)
  }

  return dates
}

/**
 * Format a date as a unique key for Maps/Sets (YYYY-MM-DD)
 */
export function formatDateKey(date: Date): string {
  return formatDateISO(date)
}

/**
 * Check if two date ranges overlap
 */
export function dateRangesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 <= end2 && end1 >= start2
}

/**
 * Check if a date falls within a date range (inclusive)
 */
export function dateInRange(date: Date, startDate: Date, endDate: Date): boolean {
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())

  return dateOnly >= start && dateOnly <= end
}

/**
 * Find the index of a date in an array of dates
 * Returns -1 if not found
 */
export function findDayIndex(dateRange: Date[], targetDate: Date): number {
  return dateRange.findIndex(date => isSameDay(date, targetDate))
}

/**
 * Get the start and end of day as Date objects
 */
export function getDayBoundaries(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)

  return { start, end }
}

/**
 * Format month name in Portuguese
 */
export function formatMonthName(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric'
  })
}

/**
 * Get short day name in Portuguese (Dom, Seg, Ter, etc.)
 */
export function getShortDayName(date: Date): string {
  return date.toLocaleDateString('pt-BR', { weekday: 'short' })
}

/**
 * Move to the next month
 */
export function nextMonth(date: Date): Date {
  const next = new Date(date)
  next.setMonth(next.getMonth() + 1)
  return next
}

/**
 * Move to the previous month
 */
export function previousMonth(date: Date): Date {
  const prev = new Date(date)
  prev.setMonth(prev.getMonth() - 1)
  return prev
}

/**
 * Get the current month (1st day at midnight)
 */
export function getCurrentMonth(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
}

// Re-export commonly used date utilities for convenience
export { parseLocalDate, formatDateISO, addDays, daysBetween }
