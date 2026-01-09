import { CalendarEvent } from '@/types/allocation.types'
import { isSameDay, findDayIndex, dateInRange } from './calendar.utils'

/**
 * Merged task bar representing one or more consecutive tasks from the same project
 */
export interface TaskBar {
  id: string // Unique ID for the bar
  projectCode: string
  projectName: string
  projectId: string
  startDay: number // Index in dateRange array
  endDay: number // Index in dateRange array (inclusive)
  priority: 'alta' | 'media' | 'baixa'
  tasks: CalendarEvent[] // All tasks merged into this bar
  resourceId: string
}

/**
 * Merge consecutive tasks from the same project into single bars
 * This reduces visual clutter and makes the timeline cleaner
 *
 * Logic:
 * 1. Sort events by start date
 * 2. For each event, try to extend an existing bar if:
 *    - Same project code
 *    - Adjacent or overlapping dates (endDay + 1 === startDay)
 * 3. If no bar can be extended, create a new one
 */
export function mergeConsecutiveProjectBars(
  events: CalendarEvent[],
  dateRange: Date[]
): TaskBar[] {
  if (events.length === 0 || dateRange.length === 0) return []

  // Sort events by start date for consistent merging
  const sortedEvents = [...events].sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime()
  )

  const bars: TaskBar[] = []

  sortedEvents.forEach(event => {
    // Find which days this event spans in the current date range
    const startDay = findDayIndex(dateRange, event.startDate)
    const endDay = findDayIndex(dateRange, event.endDate)

    // Skip if event is outside current date range
    if (startDay === -1 || endDay === -1) {
      // Event might span outside the month - check for partial overlap
      const firstDayInRange = dateRange.findIndex(day =>
        dateInRange(day, event.startDate, event.endDate)
      )

      if (firstDayInRange === -1) return // No overlap with current month

      // Find last day in range
      const lastDayInRange = dateRange.findLastIndex(day =>
        dateInRange(day, event.startDate, event.endDate)
      )

      // Create bar with partial span
      const partialStartDay = firstDayInRange
      const partialEndDay = lastDayInRange

      // Try to merge with existing bar
      const existingBar = bars.find(
        b =>
          b.projectCode === event.projectCode &&
          b.resourceId === event.resourceId &&
          (b.endDay === partialStartDay - 1 || b.endDay === partialStartDay)
      )

      if (existingBar) {
        existingBar.endDay = Math.max(existingBar.endDay, partialEndDay)
        existingBar.tasks.push(event)
        // Priority escalation: highest priority wins
        if (event.priority === 'alta') existingBar.priority = 'alta'
        else if (event.priority === 'media' && existingBar.priority === 'baixa') {
          existingBar.priority = 'media'
        }
      } else {
        bars.push({
          id: `bar-${event.projectCode}-${event.resourceId}-${bars.length}`,
          projectCode: event.projectCode,
          projectName: event.projectName,
          projectId: event.projectId,
          startDay: partialStartDay,
          endDay: partialEndDay,
          priority: event.priority,
          tasks: [event],
          resourceId: event.resourceId,
        })
      }
      return
    }

    // Try to merge with existing bar from the same project
    const existingBar = bars.find(
      b =>
        b.projectCode === event.projectCode &&
        b.resourceId === event.resourceId &&
        (b.endDay === startDay - 1 || // Adjacent
          b.endDay === startDay || // Overlapping
          b.startDay === endDay + 1) // Event comes before existing bar
    )

    if (existingBar) {
      // Extend the bar to include this event
      existingBar.startDay = Math.min(existingBar.startDay, startDay)
      existingBar.endDay = Math.max(existingBar.endDay, endDay)
      existingBar.tasks.push(event)

      // Priority escalation: higher priority takes precedence
      if (event.priority === 'alta') {
        existingBar.priority = 'alta'
      } else if (event.priority === 'media' && existingBar.priority === 'baixa') {
        existingBar.priority = 'media'
      }
    } else {
      // Create new bar
      bars.push({
        id: `bar-${event.projectCode}-${event.resourceId}-${bars.length}`,
        projectCode: event.projectCode,
        projectName: event.projectName,
        projectId: event.projectId,
        startDay,
        endDay,
        priority: event.priority,
        tasks: [event],
        resourceId: event.resourceId,
      })
    }
  })

  return bars
}

/**
 * Calculate CSS positioning for a task bar
 * Returns style object for absolute positioning
 */
export function calculateTaskBarStyle(
  bar: TaskBar,
  dateRange: Date[],
  rowIndex: number = 0
): React.CSSProperties {
  const totalDays = dateRange.length
  const startPercent = (bar.startDay / totalDays) * 100
  const widthPercent = ((bar.endDay - bar.startDay + 1) / totalDays) * 100

  return {
    position: 'absolute',
    left: `${startPercent}%`,
    width: `${widthPercent}%`,
    top: `${rowIndex * 28}px`, // Stack multiple bars vertically (28px per bar)
    zIndex: 10,
  }
}

/**
 * Check if a task bar intersects with a specific day
 */
export function barIntersectsDay(bar: TaskBar, dayIndex: number): boolean {
  return dayIndex >= bar.startDay && dayIndex <= bar.endDay
}

/**
 * Get priority border style for task bars
 */
export function getPriorityBorderStyle(priority: 'alta' | 'media' | 'baixa'): string {
  const borders = {
    alta: 'border-l-4 border-l-red-500',
    media: 'border-l-4 border-l-yellow-500',
    baixa: 'border-l-4 border-l-green-500',
  }
  return borders[priority]
}

/**
 * Get tooltip text for a task bar showing all merged tasks
 */
export function getTaskBarTooltip(bar: TaskBar): string {
  const taskList = bar.tasks
    .map(t => `• ${t.title}`)
    .join('\n')

  return `${bar.projectName}\n${bar.tasks.length} tarefa(s):\n${taskList}`
}
