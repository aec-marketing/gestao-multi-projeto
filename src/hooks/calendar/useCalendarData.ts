import { useMemo } from 'react'
import { useActiveResources, useAllocations, usePersonalEvents } from '../useResources'
import { CalendarEvent, AllocationWithDetails, Resource } from '@/types/allocation.types'
import { PersonalEvent } from '@/types/personal-events.types'
import { CalendarFilters } from './useCalendarFilters'
import { parseLocalDate } from '@/utils/date.utils'
import { dateInRange } from '@/utils/calendar/calendar.utils'

interface GroupedResources {
  gerente: Resource[]
  lider: Resource[]
  operador: Resource[]
}

/**
 * Main calendar data transformation hook
 * Takes raw data from ResourceContext and transforms it into calendar-ready structures
 * All transformations are memoized for performance
 */
export function useCalendarData(
  dateRange: Date[],
  filters: CalendarFilters
) {
  const { resources, isLoading: resourcesLoading } = useActiveResources()
  const { allocations, isLoading: allocationsLoading } = useAllocations()
  const { personalEvents, isLoading: eventsLoading } = usePersonalEvents()

  // 1. Group resources by role
  const groupedResources = useMemo((): GroupedResources => {
    let filtered = resources

    // Filter by selected resource
    if (filters.selectedResource) {
      filtered = filtered.filter(r => r.id === filters.selectedResource)
    }

    // Filter by visible role groups
    filtered = filtered.filter(r => {
      if (r.role === 'gerente') return filters.selectedRoleGroups.has('gerente')
      if (r.role === 'lider') return filters.selectedRoleGroups.has('lider')
      return filters.selectedRoleGroups.has('operador')
    })

    return {
      gerente: filtered.filter(r => r.role === 'gerente'),
      lider: filtered.filter(r => r.role === 'lider'),
      operador: filtered.filter(r => r.role === 'operador'),
    }
  }, [resources, filters.selectedResource, filters.selectedRoleGroups])

  // 2. Filter allocations by date range and project
  const filteredAllocations = useMemo(() => {
    if (dateRange.length === 0) return []

    const firstDay = dateRange[0]
    const lastDay = dateRange[dateRange.length - 1]

    return allocations.filter(alloc => {
      // Filter by date range
      const startDate = parseLocalDate(alloc.start_date)
      const endDate = parseLocalDate(alloc.end_date)

      if (!startDate || !endDate) return false

      // Check if allocation overlaps with current month
      const overlaps = startDate <= lastDay && endDate >= firstDay

      if (!overlaps) return false

      // Filter by project if selected
      if (filters.selectedProject) {
        const allocWithDetails = alloc as AllocationWithDetails
        return allocWithDetails.task?.project?.code === filters.selectedProject
      }

      return true
    })
  }, [allocations, dateRange, filters.selectedProject])

  // 3. Transform allocations to calendar events
  const calendarEvents = useMemo((): CalendarEvent[] => {
    return filteredAllocations.map(alloc => {
      const allocWithDetails = alloc as AllocationWithDetails

      const startDate = parseLocalDate(alloc.start_date)
      const endDate = parseLocalDate(alloc.end_date)

      return {
        id: alloc.id,
        title: allocWithDetails.task?.name || 'Sem título',
        startDate: startDate || new Date(),
        endDate: endDate || new Date(),
        priority: alloc.priority,
        resourceId: alloc.resource_id,
        resourceName: allocWithDetails.resource?.name || 'Desconhecido',
        projectId: allocWithDetails.task?.project?.id || '',
        projectName: allocWithDetails.task?.project?.name || 'Sem projeto',
        projectCode: allocWithDetails.task?.project?.code || 'N/A',
        taskId: alloc.task_id,
        taskType: allocWithDetails.task?.type,
      }
    })
  }, [filteredAllocations])

  // 4. Group events by resource for O(1) lookup
  const eventsByResource = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()

    calendarEvents.forEach(event => {
      const existing = map.get(event.resourceId) || []
      existing.push(event)
      map.set(event.resourceId, existing)
    })

    return map
  }, [calendarEvents])

  // 5. Filter personal events by date range
  const filteredPersonalEvents = useMemo(() => {
    if (dateRange.length === 0) return []

    const firstDay = dateRange[0]
    const lastDay = dateRange[dateRange.length - 1]

    return personalEvents.filter(event => {
      const startDate = parseLocalDate(event.start_date)
      const endDate = parseLocalDate(event.end_date)

      if (!startDate || !endDate) return false

      return startDate <= lastDay && endDate >= firstDay
    })
  }, [personalEvents, dateRange])

  // 6. Group personal events by resource
  const personalEventsByResource = useMemo(() => {
    const map = new Map<string, PersonalEvent[]>()

    filteredPersonalEvents.forEach(event => {
      const existing = map.get(event.resource_id) || []
      existing.push(event)
      map.set(event.resource_id, existing)
    })

    return map
  }, [filteredPersonalEvents])

  // 7. Get all unique projects from filtered allocations
  const projects = useMemo(() => {
    const projectMap = new Map<string, { id: string; code: string; name: string }>()

    filteredAllocations.forEach(alloc => {
      const allocWithDetails = alloc as AllocationWithDetails
      const project = allocWithDetails.task?.project

      if (project && !projectMap.has(project.id)) {
        projectMap.set(project.id, {
          id: project.id,
          code: project.code || 'N/A',
          name: project.name || 'Sem nome',
        })
      }
    })

    return Array.from(projectMap.values()).sort((a, b) => a.code.localeCompare(b.code))
  }, [filteredAllocations])

  const isLoading = resourcesLoading || allocationsLoading || eventsLoading

  return {
    groupedResources,
    calendarEvents,
    eventsByResource,
    personalEventsByResource,
    projects,
    isLoading,
  }
}
