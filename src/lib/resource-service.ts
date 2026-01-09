/**
 * Resource Service
 *
 * Centralized service for resource-related operations including:
 * - Resource management
 * - Allocation creation/deletion with validation
 * - Personal event management
 * - Conflict detection
 * - Availability checking
 */

import { supabase } from '@/lib/supabase'
import { Resource } from '@/types/database.types'
import { Allocation } from '@/types/allocation.types'
import { PersonalEvent } from '@/types/personal-events.types'
import { log } from '@/utils/logger'
import { parseLocalDate } from '@/utils/date.utils'

/**
 * Conflict information
 */
export interface ResourceConflict {
  type: 'allocation_overlap' | 'personal_event_block' | 'overload'
  message: string
  date: string
  details?: unknown
}

/**
 * Availability check result
 */
export interface AvailabilityCheck {
  isAvailable: boolean
  conflicts: ResourceConflict[]
  warnings: string[]
}

/**
 * Get all available leaders (gerente + lider roles)
 */
export async function getAvailableLeaders(): Promise<Resource[]> {
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .in('role', ['gerente', 'lider'])
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    log.error('Failed to fetch leaders', 'resource-service', error)
    throw error
  }

  return data || []
}

/**
 * Get team members (operators) for a specific leader
 */
export async function getTeamMembers(leaderId: string): Promise<Resource[]> {
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('leader_id', leaderId)
    .eq('role', 'operador')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    log.error('Failed to fetch team members', 'resource-service', error)
    throw error
  }

  return data || []
}

/**
 * Check if resource has conflicting allocations in date range
 */
export async function checkAllocationConflicts(
  resourceId: string,
  startDate: string,
  endDate: string,
  excludeAllocationId?: string
): Promise<ResourceConflict[]> {
  const conflicts: ResourceConflict[] = []

  try {
    // Get existing allocations for this resource
    const { data: existingAllocations, error } = await supabase
      .from('allocations')
      .select(`
        *,
        task:tasks(id, name, start_date, end_date)
      `)
      .eq('resource_id', resourceId)

    if (error) throw error

    const start = parseLocalDate(startDate)
    const end = parseLocalDate(endDate)

    // Skip if input dates couldn't be parsed
    if (!start || !end) return conflicts

    for (const allocation of existingAllocations || []) {
      // Skip if this is the same allocation we're editing
      if (excludeAllocationId && allocation.id === excludeAllocationId) {
        continue
      }

      // Check if task has dates
      if (!allocation.task?.start_date || !allocation.task?.end_date) {
        continue
      }

      const allocStart = parseLocalDate(allocation.task.start_date)
      const allocEnd = parseLocalDate(allocation.task.end_date)

      // Skip if dates couldn't be parsed
      if (!allocStart || !allocEnd) continue

      // Check for overlap
      if (allocStart <= end && allocEnd >= start) {
        conflicts.push({
          type: 'allocation_overlap',
          message: `Recurso já alocado na tarefa "${allocation.task.name}" de ${allocation.task.start_date} a ${allocation.task.end_date}`,
          date: allocation.task.start_date,
          details: { allocationId: allocation.id, taskName: allocation.task.name }
        })
      }
    }
  } catch (error) {
    log.error('Failed to check allocation conflicts', 'resource-service', error)
  }

  return conflicts
}

/**
 * Check if resource has blocking personal events in date range
 */
export async function checkPersonalEventConflicts(
  resourceId: string,
  startDate: string,
  endDate: string
): Promise<ResourceConflict[]> {
  const conflicts: ResourceConflict[] = []

  try {
    const { data: events, error } = await supabase
      .from('personal_events')
      .select('*')
      .eq('resource_id', resourceId)
      .eq('blocks_work', true)

    if (error) throw error

    const start = parseLocalDate(startDate)
    const end = parseLocalDate(endDate)

    // Skip if input dates couldn't be parsed
    if (!start || !end) return conflicts

    for (const event of events || []) {
      const eventStart = parseLocalDate(event.start_date)
      const eventEnd = parseLocalDate(event.end_date)

      // Skip if dates couldn't be parsed
      if (!eventStart || !eventEnd) continue

      // Check for overlap
      if (eventStart <= end && eventEnd >= start) {
        conflicts.push({
          type: 'personal_event_block',
          message: `Recurso indisponível: ${event.title} (${event.event_type}) de ${event.start_date} a ${event.end_date}`,
          date: event.start_date,
          details: { eventId: event.id, eventType: event.event_type, title: event.title }
        })
      }
    }
  } catch (error) {
    log.error('Failed to check personal event conflicts', 'resource-service', error)
  }

  return conflicts
}

/**
 * Check resource availability for a date range
 * Returns conflicts and warnings
 */
export async function checkResourceAvailability(
  resourceId: string,
  startDate: string,
  endDate: string,
  excludeAllocationId?: string
): Promise<AvailabilityCheck> {
  const [allocationConflicts, eventConflicts] = await Promise.all([
    checkAllocationConflicts(resourceId, startDate, endDate, excludeAllocationId),
    checkPersonalEventConflicts(resourceId, startDate, endDate)
  ])

  const conflicts = [...allocationConflicts, ...eventConflicts]
  const warnings: string[] = []

  // Add warning if there are multiple allocations (even if they don't overlap)
  if (allocationConflicts.length > 2) {
    warnings.push('Recurso já possui múltiplas alocações neste período')
  }

  return {
    isAvailable: conflicts.length === 0,
    conflicts,
    warnings
  }
}

/**
 * Create allocation with conflict validation
 */
export async function createAllocationWithValidation(
  taskId: string,
  resourceId: string,
  priority: 'alta' | 'media' | 'baixa',
  options: {
    skipConflictCheck?: boolean
    startDate?: string
    endDate?: string
  } = {}
): Promise<{ success: boolean; allocationId?: string; conflicts?: ResourceConflict[] }> {
  try {
    // Get task dates if not provided
    let startDate = options.startDate
    let endDate = options.endDate

    if (!startDate || !endDate) {
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('start_date, end_date')
        .eq('id', taskId)
        .single()

      if (taskError) throw taskError

      startDate = startDate || task.start_date
      endDate = endDate || task.end_date
    }

    // Check for conflicts unless explicitly skipped
    if (!options.skipConflictCheck && startDate && endDate) {
      const availabilityCheck = await checkResourceAvailability(resourceId, startDate, endDate)

      if (!availabilityCheck.isAvailable) {
        log.warn('Allocation has conflicts', 'resource-service', {
          resourceId,
          taskId,
          conflicts: availabilityCheck.conflicts
        })

        return {
          success: false,
          conflicts: availabilityCheck.conflicts
        }
      }
    }

    // Create allocation
    const { data, error } = await supabase
      .from('allocations')
      .insert({
        task_id: taskId,
        resource_id: resourceId,
        priority,
        start_date: startDate,
        end_date: endDate
      })
      .select()
      .single()

    if (error) throw error

    log.info('Allocation created successfully', 'resource-service', {
      allocationId: data.id,
      resourceId,
      taskId
    })

    return {
      success: true,
      allocationId: data.id
    }
  } catch (error) {
    log.error('Failed to create allocation', 'resource-service', error)
    throw error
  }
}

/**
 * Delete allocation
 */
export async function deleteAllocation(allocationId: string): Promise<void> {
  const { error } = await supabase
    .from('allocations')
    .delete()
    .eq('id', allocationId)

  if (error) {
    log.error('Failed to delete allocation', 'resource-service', error)
    throw error
  }

  log.info('Allocation deleted', 'resource-service', { allocationId })
}

/**
 * Create personal event
 */
export async function createPersonalEvent(
  event: Omit<PersonalEvent, 'id' | 'created_at' | 'updated_at'>
): Promise<PersonalEvent> {
  const { data, error } = await supabase
    .from('personal_events')
    .insert(event)
    .select()
    .single()

  if (error) {
    log.error('Failed to create personal event', 'resource-service', error)
    throw error
  }

  log.info('Personal event created', 'resource-service', { eventId: data.id })

  return data
}

/**
 * Update personal event
 */
export async function updatePersonalEvent(
  eventId: string,
  updates: Partial<Omit<PersonalEvent, 'id' | 'created_at' | 'updated_at'>>
): Promise<PersonalEvent> {
  const { data, error } = await supabase
    .from('personal_events')
    .update(updates)
    .eq('id', eventId)
    .select()
    .single()

  if (error) {
    log.error('Failed to update personal event', 'resource-service', error)
    throw error
  }

  log.info('Personal event updated', 'resource-service', { eventId })

  return data
}

/**
 * Delete personal event
 */
export async function deletePersonalEvent(eventId: string): Promise<void> {
  const { error } = await supabase
    .from('personal_events')
    .delete()
    .eq('id', eventId)

  if (error) {
    log.error('Failed to delete personal event', 'resource-service', error)
    throw error
  }

  log.info('Personal event deleted', 'resource-service', { eventId })
}
