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
