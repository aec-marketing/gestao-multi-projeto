import { Task, Resource } from '@/types/database.types'
import { Allocation } from '@/types/allocation.types'

export interface TaskWithDates extends Omit<Task, 'start_date' | 'end_date'> {
  start_date: Date
  end_date: Date
  duration_days: number
}

export interface TaskWithAllocations extends TaskWithDates {
  allocations: Array<Allocation & { resource: Resource }>
  subtasks?: TaskWithAllocations[]
  isExpanded?: boolean
}

export interface ResizeState {
  taskId: string
  edge: 'start' | 'end'
  startX: number
  startWidth: number
  startLeft: number
}

export type ZoomLevel = 'day' | 'week' | 'month'

export type FilterType = 'all' | string

/**
 * Estado consolidado do Gantt
 * Centraliza todos os 15+ estados que estavam dispersos no GanttViewTab
 */
export interface GanttState {
  selection: {
    selectedTask: string | null
    selectedDay: string | null
  }

  dragDrop: {
    draggedTask: string | null
    dragOverTask: string | null
  }

  modals: {
    allocationTask: Task | null
    subtaskTask: Task | null
    editingCostsTask: Task | null
    showRecalculate: boolean
    showCycleAudit: boolean
    pendingUpdates: any[]
  }

  view: {
    expandedTasks: Set<string>
    zoomLevel: ZoomLevel
    sortOrder: 'structural' | 'chronological'
  }

  filters: {
    type: string
    person: string
    progress: string
  }

  resize: {
    resizingTask: ResizeState | null
    tempDurations: Map<string, number>
    tempStartOffsets: Map<string, number>
  }

  data: {
    predecessors: any[]
    tasksInCycle: Set<string>
  }
}
