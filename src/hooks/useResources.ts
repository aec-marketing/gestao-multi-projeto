/**
 * Resource Hooks
 *
 * Specialized hooks for working with resources, allocations, and personal events.
 * These hooks use the ResourceContext for centralized data management.
 */

import { useMemo } from 'react'
import { useResourceContext } from '@/contexts/ResourceContext'
import { Resource } from '@/types/database.types'
import { Allocation } from '@/types/allocation.types'
import { PersonalEvent } from '@/types/personal-events.types'

/**
 * Hook to get all resources
 *
 * @returns Array of all resources
 */
export function useResources() {
  const { resources, isLoading, error, refreshResources } = useResourceContext()

  return {
    resources,
    isLoading,
    error,
    refresh: refreshResources
  }
}

/**
 * Hook to get active resources only
 *
 * @returns Array of active resources
 */
export function useActiveResources() {
  const { getActiveResources, isLoading, error, refreshResources } = useResourceContext()

  const activeResources = useMemo(() => getActiveResources(), [getActiveResources])

  return {
    resources: activeResources,
    isLoading,
    error,
    refresh: refreshResources
  }
}

/**
 * Hook to get a specific resource by ID
 *
 * @param resourceId - ID of the resource
 * @returns Resource or undefined
 */
export function useResource(resourceId: string | null | undefined) {
  const { getResourceById, isLoading, error, refreshResources } = useResourceContext()

  const resource = useMemo(
    () => resourceId ? getResourceById(resourceId) : undefined,
    [resourceId, getResourceById]
  )

  return {
    resource,
    isLoading,
    error,
    refresh: refreshResources
  }
}

/**
 * Hook to get resources filtered by role
 *
 * @param role - Resource role to filter by
 * @returns Array of resources with specified role
 */
export function useResourcesByRole(role: 'gerente' | 'lider' | 'operador') {
  const { getResourcesByRole, isLoading, error, refreshResources } = useResourceContext()

  const filteredResources = useMemo(
    () => getResourcesByRole(role),
    [role, getResourcesByRole]
  )

  return {
    resources: filteredResources,
    isLoading,
    error,
    refresh: refreshResources
  }
}

/**
 * Hook to get leaders (gerente + lider roles)
 *
 * @returns Array of leader resources
 */
export function useLeaders() {
  const { getResourcesByRole, isLoading, error, refreshResources } = useResourceContext()

  const leaders = useMemo(() => {
    const gerentes = getResourcesByRole('gerente')
    const lideres = getResourcesByRole('lider')
    return [...gerentes, ...lideres].sort((a, b) => a.name.localeCompare(b.name))
  }, [getResourcesByRole])

  return {
    leaders,
    isLoading,
    error,
    refresh: refreshResources
  }
}

/**
 * Hook to get all allocations
 *
 * @returns Array of all allocations with full details
 */
export function useAllocations() {
  const { allocations, isLoading, error, refreshAllocations } = useResourceContext()

  return {
    allocations,
    isLoading,
    error,
    refresh: refreshAllocations
  }
}

/**
 * Hook to get allocations for a specific resource
 *
 * @param resourceId - ID of the resource
 * @returns Array of allocations for the resource
 */
export function useResourceAllocations(resourceId: string | null | undefined) {
  const { getResourceAllocations, isLoading, error, refreshAllocations } = useResourceContext()

  const allocations = useMemo(
    () => resourceId ? getResourceAllocations(resourceId) : [],
    [resourceId, getResourceAllocations]
  )

  return {
    allocations,
    isLoading,
    error,
    refresh: refreshAllocations
  }
}

/**
 * Hook to get all personal events
 *
 * @returns Array of all personal events
 */
export function usePersonalEvents() {
  const { personalEvents, isLoading, error, refreshPersonalEvents } = useResourceContext()

  return {
    personalEvents,
    isLoading,
    error,
    refresh: refreshPersonalEvents
  }
}

/**
 * Hook to get personal events for a specific resource
 *
 * @param resourceId - ID of the resource
 * @returns Array of personal events for the resource
 */
export function useResourcePersonalEvents(resourceId: string | null | undefined) {
  const { getResourcePersonalEvents, isLoading, error, refreshPersonalEvents } = useResourceContext()

  const events = useMemo(
    () => resourceId ? getResourcePersonalEvents(resourceId) : [],
    [resourceId, getResourcePersonalEvents]
  )

  return {
    events,
    isLoading,
    error,
    refresh: refreshPersonalEvents
  }
}

/**
 * Hook to get complete resource data (resource + allocations + events)
 *
 * @param resourceId - ID of the resource
 * @returns Complete resource information
 */
export function useResourceData(resourceId: string | null | undefined) {
  const { resource } = useResource(resourceId)
  const { allocations } = useResourceAllocations(resourceId)
  const { events } = useResourcePersonalEvents(resourceId)
  const { isLoading, error, refreshAll } = useResourceContext()

  return {
    resource,
    allocations,
    personalEvents: events,
    isLoading,
    error,
    refresh: refreshAll
  }
}
