import { useMemo } from 'react'

export type TimelineZoom = 'day' | 'week' | 'month'

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
 * Generate an array of dates for a single week
 * Week starts on the Monday of the week containing the reference date
 */
export function generateWeekDays(referenceDate: Date): Date[] {
  const date = new Date(referenceDate)

  // Get the day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const dayOfWeek = date.getDay()

  // Calculate offset to Monday (if Sunday, go back 6 days, otherwise go back dayOfWeek - 1)
  const offsetToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1

  // Set to Monday of this week
  date.setDate(date.getDate() - offsetToMonday)
  date.setHours(0, 0, 0, 0)

  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    days.push(new Date(date))
    date.setDate(date.getDate() + 1)
  }

  return days
}

/**
 * Generate a single day array
 */
export function generateSingleDay(date: Date): Date[] {
  const singleDay = new Date(date)
  singleDay.setHours(0, 0, 0, 0)
  return [singleDay]
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
 * Hook for managing calendar dates with zoom support
 * Memoizes the date range based on zoom level
 */
export function useCalendarDates(currentMonth: Date, zoom: TimelineZoom = 'month') {
  // Memoize the array of days based on zoom level
  const dateRange = useMemo(() => {
    switch (zoom) {
      case 'day':
        return generateSingleDay(currentMonth)
      case 'week':
        return generateWeekDays(currentMonth)
      case 'month':
      default:
        return generateMonthDays(currentMonth)
    }
  }, [currentMonth, zoom])

  // Memoize month boundaries
  const boundaries = useMemo(
    () => getMonthBoundaries(currentMonth),
    [currentMonth.getFullYear(), currentMonth.getMonth()]
  )

  // Get display label based on zoom level
  const displayLabel = useMemo(() => {
    switch (zoom) {
      case 'day':
        return currentMonth.toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })
      case 'week': {
        const weekDays = generateWeekDays(currentMonth)
        const start = weekDays[0]
        const end = weekDays[6]
        return `${start.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}`
      }
      case 'month':
      default:
        return currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    }
  }, [currentMonth, zoom])

  // Keep monthName for backward compatibility
  const monthName = displayLabel

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
    displayLabel,
    isInCurrentMonth,
    zoom,
  }
}
