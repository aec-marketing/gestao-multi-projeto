import { Task, Resource } from '@/types/database.types'
import { Allocation } from '@/types/allocation.types'
import { TaskWithDates, TaskWithAllocations, ZoomLevel } from '../types/gantt.types'
import { parseLocalDate } from '@/utils/date.utils'
import { MINUTES_PER_WORKING_DAY, minutesToDays } from '@/utils/time.utils'

/**
 * Calculate task dates based on project start date
 * ONDA 2: Atualizado para usar duration_minutes ao invés de duration
 */
export function calculateTaskDates(
  tasks: Task[],
  projectStartDate: string | null
): TaskWithDates[] {
  const processedTaskDates = new Map<string, { start: Date, end: Date }>()

  // Primeiro, identificar relações pai-filho
  const childrenMap = new Map<string, Task[]>()
  tasks.forEach(task => {
    if (task.parent_id) {
      const children = childrenMap.get(task.parent_id) || []
      children.push(task)
      childrenMap.set(task.parent_id, children)
    }
  })

  const calculateDates = (task: Task): { start: Date, end: Date } => {
    // Se já processado, retornar cache
    if (processedTaskDates.has(task.id)) {
      return processedTaskDates.get(task.id)!
    }

    const children = childrenMap.get(task.id) || []
    const hasChildren = children.length > 0

    let taskStartDate: Date
    let taskEndDate: Date

    // Se a tarefa tem filhos, calcular datas baseadas nos filhos
    if (hasChildren) {
      // Calcular datas de todos os filhos primeiro (recursivo)
      const childDates = children.map(child => calculateDates(child))

      // Data de início = menor data de início dos filhos
      taskStartDate = new Date(Math.min(...childDates.map(d => d.start.getTime())))

      // Data de fim = maior data de fim dos filhos
      taskEndDate = new Date(Math.max(...childDates.map(d => d.end.getTime())))
    } else {
      // Tarefa sem filhos - usar lógica original
      // 1. Determinar data de início
      if (task.start_date) {
        const parsed = parseLocalDate(task.start_date)
        taskStartDate = parsed || new Date()
      } else {
        taskStartDate = projectStartDate
          ? parseLocalDate(projectStartDate) || new Date()
          : new Date()
      }

      // 2. Calcular data de fim baseada em duration_minutes
      const durationMinutes = task.duration_minutes ?? MINUTES_PER_WORKING_DAY

      if (task.end_date) {
        const parsed = parseLocalDate(task.end_date)
        taskEndDate = parsed || new Date(taskStartDate)
      } else {
        const durationDays = minutesToDays(durationMinutes)
        taskEndDate = new Date(taskStartDate)
        taskEndDate.setDate(taskEndDate.getDate() + Math.ceil(durationDays) - 1)
      }
    }

    // 3. Cachear resultado
    const result = { start: taskStartDate, end: taskEndDate }
    processedTaskDates.set(task.id, result)

    return result
  }

  return tasks.map(task => {
    const { start, end } = calculateDates(task)

    // Para tarefas sem filhos: usar duration_minutes para cálculo preciso
    // Para tarefas com filhos: calcular baseado na diferença de datas dos filhos
    const children = childrenMap.get(task.id) || []
    const hasChildren = children.length > 0

    let durationDays: number
    if (hasChildren) {
      // Tarefa pai: duração baseada na diferença de datas dos filhos
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
      durationDays = daysDiff
    } else {
      // Tarefa sem filhos: usar duration_minutes para precisão (permite < 1 dia)
      const durationMinutes = task.duration_minutes ?? MINUTES_PER_WORKING_DAY
      durationDays = minutesToDays(durationMinutes)
    }

    return {
      ...task,
      start_date: start,
      end_date: end,
      duration_days: durationDays
    }
  })
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
export function getAllDescendants<T extends { id: string; parent_id: string | null }>(
  parentIds: Set<string>,
  tasksWithDates: T[]
): T[] {
  const descendants: T[] = []
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

  // Normalizar para meia-noite antes de adicionar dias
  minDate.setHours(0, 0, 0, 0)
  maxDate.setHours(0, 0, 0, 0)

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
 * FIX: Valores atualizados para corrigir bug de resize
 */
export function getColumnWidth(zoomLevel: ZoomLevel): number {
  switch (zoomLevel) {
    case 'day': return 120    // Zoom in: 120px por dia
    case 'week': return 50    // Normal: 50px por dia
    case 'month': return 15   // Zoom out: 15px por dia
    default: return 50
  }
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

/**
 * Calculate task bar style (simplified version for GanttTaskBar)
 * Similar to getTaskBarStyle but with simpler signature for component use
 */
export function calculateTaskBarStyle(
  task: TaskWithDates,
  dateRange: { minDate: Date; maxDate: Date },
  columnWidth: number,
  tempDuration?: number,
  tempStartOffset?: number
): React.CSSProperties {
  const startIndex = Math.floor(
    (task.start_date.getTime() - dateRange.minDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  const duration = tempDuration ?? task.duration_days

  let leftPx = startIndex * columnWidth
  if (tempStartOffset) {
    leftPx += tempStartOffset * columnWidth
  }

  let widthPx = duration * columnWidth

  return {
    position: 'absolute',
    left: `${Math.max(0, leftPx)}px`,
    width: `${Math.max(20, widthPx)}px`,
    height: '32px',
    top: '8px'
  }
}

/**
 * ONDA 3: Calculate bar style for a single allocation (for fragmented tasks)
 * Used when task has multiple allocations on different days
 */
export function calculateAllocationBarStyle(
  allocation: Allocation,
  dateRange: { minDate: Date; maxDate: Date },
  columnWidth: number
): React.CSSProperties {
  // Parse allocation start date
  const startDate = parseLocalDate(allocation.start_date)
  if (!startDate) {
    return {
      position: 'absolute',
      left: '0px',
      width: '20px',
      height: '32px',
      top: '8px'
    }
  }

  // Calculate start position
  const startIndex = Math.floor(
    (startDate.getTime() - dateRange.minDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  // Calculate duration in days from allocated_minutes
  const durationMinutes = allocation.allocated_minutes || MINUTES_PER_WORKING_DAY
  const durationDays = minutesToDays(durationMinutes)

  const leftPx = startIndex * columnWidth
  const widthPx = durationDays * columnWidth

  return {
    position: 'absolute',
    left: `${Math.max(0, leftPx)}px`,
    width: `${Math.max(20, widthPx)}px`,
    height: '32px',
    top: '8px'
  }
}
