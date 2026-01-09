import { Task, Resource } from '@/types/database.types'
import { Allocation } from '@/types/allocation.types'
import { TaskWithDates, TaskWithAllocations, ZoomLevel } from '../types/gantt.types'
import { parseLocalDate } from '@/utils/date.utils'

/**
 * Calculate task dates based on project start date
 */
export function calculateTaskDates(
  tasks: Task[],
  projectStartDate: string | null,
  expandedTasks: Set<string>,
  allocations: Allocation[],
  resources: Resource[]
): TaskWithDates[] {
  if (!projectStartDate) return []

  const projectStart = parseLocalDate(projectStartDate)
  if (!projectStart) return []

  const result: TaskWithDates[] = []

  function processTaskRecursively(task: Task, depth: number = 0): void {
    const directChildren = tasks.filter(t => t.parent_id === task.id)

    if (task.start_date && task.end_date) {
      const taskStartDate = parseLocalDate(task.start_date)
      const taskEndDate = parseLocalDate(task.end_date)
      if (!taskStartDate || !taskEndDate) return

      directChildren.forEach(child => processTaskRecursively(child, depth + 1))

      const taskDuration = Math.max(
        1,
        Math.ceil((taskEndDate.getTime() - taskStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
      )

      result.push({
        ...task,
        start_date: taskStartDate,
        end_date: taskEndDate,
        duration_days: taskDuration
      })
    } else {
      const startDate = projectStart ? new Date(projectStart) : new Date()
      const taskDuration = Math.ceil(task.duration)
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + taskDuration - 1)

      directChildren.forEach(child => processTaskRecursively(child, depth + 1))

      result.push({
        ...task,
        start_date: startDate,
        end_date: endDate,
        duration_days: taskDuration
      })
    }
  }

  const rootTasks = tasks.filter(t => !t.parent_id)
  rootTasks.forEach(rootTask => processTaskRecursively(rootTask, 0))

  return result
}

/**
 * Organize tasks into hierarchy with allocations
 */
export function organizeTasksHierarchy(
  tasksWithDates: TaskWithDates[],
  allocations: Allocation[],
  resources: Resource[],
  expandedTasks: Set<string>
): TaskWithAllocations[] {
  const taskMap = new Map<string, TaskWithAllocations>()
  const rootTasks: TaskWithAllocations[] = []

  tasksWithDates.forEach(task => {
    const taskAllocations = allocations
      .filter(a => a.task_id === task.id)
      .map(a => ({
        ...a,
        resource: resources.find(r => r.id === a.resource_id)!
      }))
      .filter(a => a.resource)

    const taskWithAllocs: TaskWithAllocations = {
      ...task,
      allocations: taskAllocations,
      subtasks: [],
      isExpanded: expandedTasks.has(task.id)
    }

    taskMap.set(task.id, taskWithAllocs)
  })

  taskMap.forEach(task => {
    if (task.parent_id) {
      const parent = taskMap.get(task.parent_id)
      if (parent) {
        parent.subtasks = parent.subtasks || []
        parent.subtasks.push(task)
      }
    } else {
      rootTasks.push(task)
    }
  })

  return rootTasks
}

/**
 * Get all descendants of given parent task IDs
 */
export function getAllDescendants(
  parentIds: Set<string>,
  tasksWithDates: TaskWithDates[]
): TaskWithDates[] {
  const descendants: TaskWithDates[] = []
  const directChildren = tasksWithDates.filter(t => t.parent_id && parentIds.has(t.parent_id))

  if (directChildren.length === 0) return descendants

  descendants.push(...directChildren)

  const childIds = new Set(directChildren.map(c => c.id))
  descendants.push(...getAllDescendants(childIds, tasksWithDates))

  return descendants
}

/**
 * Calculate timeline date range
 */
export function calculateDateRange(tasksWithDates: TaskWithDates[]): {
  minDate: Date
  maxDate: Date
} {
  const allDates = tasksWithDates.flatMap(t => [t.start_date, t.end_date])
  const minDate = allDates.length > 0
    ? new Date(Math.min(...allDates.map(d => d.getTime())))
    : new Date()
  const maxDate = allDates.length > 0
    ? new Date(Math.max(...allDates.map(d => d.getTime())))
    : new Date()

  minDate.setDate(minDate.getDate() - 2)
  maxDate.setDate(maxDate.getDate() + 7)

  return { minDate, maxDate }
}

/**
 * Generate timeline columns based on zoom level
 */
export function generateTimelineColumns(
  minDate: Date,
  maxDate: Date,
  zoomLevel: ZoomLevel
): Date[] {
  const columns: Date[] = []
  const current = new Date(minDate)

  while (current <= maxDate) {
    columns.push(new Date(current))

    if (zoomLevel === 'day') {
      current.setDate(current.getDate() + 1)
    } else if (zoomLevel === 'week') {
      current.setDate(current.getDate() + 7)
    } else {
      current.setMonth(current.getMonth() + 1)
    }
  }

  return columns
}

/**
 * Get column width based on zoom level
 */
export function getColumnWidth(zoomLevel: ZoomLevel): number {
  if (zoomLevel === 'day') return 60
  if (zoomLevel === 'week') return 120
  return 180
}

/**
 * Check if a subtask is delayed relative to parent
 */
export function isSubtaskDelayed(
  subtask: TaskWithAllocations,
  parentTask: TaskWithAllocations | undefined
): boolean {
  if (!parentTask) return false
  if (subtask.progress === 100) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const subtaskEnd = new Date(subtask.end_date)
  subtaskEnd.setHours(0, 0, 0, 0)

  const parentEnd = new Date(parentTask.end_date)
  parentEnd.setHours(0, 0, 0, 0)

  if (subtaskEnd > parentEnd) {
    const daysLate = Math.ceil((subtaskEnd.getTime() - parentEnd.getTime()) / (1000 * 60 * 60 * 24))
    return daysLate > 0
  }

  return false
}

/**
 * Get task bar positioning style
 */
export function getTaskBarStyle(
  task: TaskWithDates,
  minDate: Date,
  columnWidth: number,
  zoomLevel: ZoomLevel,
  tempDurations: Map<string, number>,
  tempStartOffsets: Map<string, number>
): React.CSSProperties {
  const tempDuration = tempDurations.get(task.id)
  const tempOffset = tempStartOffsets.get(task.id) || 0

  const daysFromStart = Math.floor(
    (task.start_date.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  const durationToUse = tempDuration !== undefined ? tempDuration : task.duration_days

  let leftPosition: number
  let width: number

  if (zoomLevel === 'day') {
    leftPosition = daysFromStart * columnWidth + tempOffset
    width = durationToUse * columnWidth
  } else if (zoomLevel === 'week') {
    const weeksFromStart = daysFromStart / 7
    leftPosition = weeksFromStart * columnWidth + tempOffset
    width = (durationToUse / 7) * columnWidth
  } else {
    const monthsFromStart = (task.start_date.getFullYear() - minDate.getFullYear()) * 12 +
                           (task.start_date.getMonth() - minDate.getMonth())
    leftPosition = monthsFromStart * columnWidth + tempOffset
    width = columnWidth
  }

  return {
    left: `${leftPosition}px`,
    width: `${Math.max(20, width)}px`
  }
}
