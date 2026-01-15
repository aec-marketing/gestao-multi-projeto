import { useMemo } from 'react'

/**
 * Generate an array of dates for the given month
 * Includes all days from the 1st to the last day of the month
 */
export function generateMonthDays(month: Date): Date[] {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()

  // Get the last day of the month (0 = last day of previous month)
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()

  const days: Date[] = []
  for (let day = 1; day <= lastDay; day++) {
    days.push(new Date(year, monthIndex, day, 0, 0, 0, 0))
  }

  return days
}

/**
 * Get the first and last date of a month
 */
export function getMonthBoundaries(month: Date): { start: Date; end: Date } {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()

  const start = new Date(year, monthIndex, 1, 0, 0, 0, 0)
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  const end = new Date(year, monthIndex, lastDay, 23, 59, 59, 999)

  return { start, end }
}

/**
 * Hook for managing calendar dates
 * Memoizes the date range for the current month
 */
export function useCalendarDates(currentMonth: Date) {
  // Memoize the array of days for the current month
  const dateRange = useMemo(
    () => generateMonthDays(currentMonth),
    [currentMonth.getFullYear(), currentMonth.getMonth()]
  )

  // Memoize month boundaries
  const boundaries = useMemo(
    () => getMonthBoundaries(currentMonth),
    [currentMonth.getFullYear(), currentMonth.getMonth()]
  )

  // Get month name in Portuguese
  const monthName = useMemo(
    () => currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    [currentMonth.getFullYear(), currentMonth.getMonth()]
  )

  // Check if a date is in the current month
  const isInCurrentMonth = (date: Date): boolean => {
    return (
      date.getFullYear() === currentMonth.getFullYear() &&
      date.getMonth() === currentMonth.getMonth()
    )
  }

  return {
    dateRange,
    boundaries,
    monthName,
    isInCurrentMonth,
  }
}
