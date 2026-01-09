'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { Resource } from '@/types/database.types'
import { Allocation } from '@/types/allocation.types'
import { PersonalEvent } from '@/types/personal-events.types'
import { supabase } from '@/lib/supabase'
import { log } from '@/utils/logger'

/**
 * Resource Context Data
 */
interface ResourceContextData {
  // Data
  resources: Resource[]
  allocations: Allocation[]
  personalEvents: PersonalEvent[]

  // Loading states
  isLoading: boolean
  error: Error | null

  // Refresh functions
  refreshResources: () => Promise<void>
  refreshAllocations: () => Promise<void>
  refreshPersonalEvents: () => Promise<void>
  refreshAll: () => Promise<void>

  // Helper functions
  getResourceById: (id: string) => Resource | undefined
  getResourceAllocations: (resourceId: string) => Allocation[]
  getResourcePersonalEvents: (resourceId: string) => PersonalEvent[]
  getActiveResources: () => Resource[]
  getResourcesByRole: (role: 'gerente' | 'lider' | 'operador') => Resource[]
}

const ResourceContext = createContext<ResourceContextData | undefined>(undefined)

/**
 * ResourceProvider Component
 *
 * Provides global state management for resources, allocations, and personal events.
 * Loads data once and shares across all components.
 *
 * @param children - Child components
 */
export function ResourceProvider({ children }: { children: React.ReactNode }) {
  const [resources, setResources] = useState<Resource[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [personalEvents, setPersonalEvents] = useState<PersonalEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  /**
   * Load resources from database
   */
  const refreshResources = useCallback(async () => {
    try {
      log.debug('Loading resources', 'ResourceContext')

      const { data, error: fetchError } = await supabase
        .from('resources')
        .select('*')
        .order('name', { ascending: true })

      if (fetchError) throw fetchError

      setResources(data || [])
      log.info(`Loaded ${data?.length || 0} resources`, 'ResourceContext')
    } catch (err) {
      log.error('Failed to load resources', 'ResourceContext', err)
      setError(err as Error)
      throw err
    }
  }, [])

  /**
   * Load allocations from database with full details
   */
  const refreshAllocations = useCallback(async () => {
    try {
      log.debug('Loading allocations', 'ResourceContext')

      const { data, error: fetchError } = await supabase
        .from('allocations')
        .select(`
          *,
          resource:resources(*),
          task:tasks(
            *,
            project:projects(*)
          )
        `)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      setAllocations(data || [])
      log.info(`Loaded ${data?.length || 0} allocations`, 'ResourceContext')
    } catch (err) {
      log.error('Failed to load allocations', 'ResourceContext', err)
      setError(err as Error)
      throw err
    }
  }, [])

  /**
   * Load personal events from database
   */
  const refreshPersonalEvents = useCallback(async () => {
    try {
      log.debug('Loading personal events', 'ResourceContext')

      const { data, error: fetchError } = await supabase
        .from('personal_events')
        .select(`*, resource:resources(*)`)
        .order('start_date', { ascending: false })

      if (fetchError) throw fetchError

      setPersonalEvents(data || [])
      log.info(`Loaded ${data?.length || 0} personal events`, 'ResourceContext')
    } catch (err) {
      log.error('Failed to load personal events', 'ResourceContext', err)
      setError(err as Error)
      throw err
    }
  }, [])

  /**
   * Refresh all data
   */
  const refreshAll = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      await Promise.all([
        refreshResources(),
        refreshAllocations(),
        refreshPersonalEvents()
      ])
    } catch (err) {
      // Errors already logged by individual refresh functions
    } finally {
      setIsLoading(false)
    }
  }, [refreshResources, refreshAllocations, refreshPersonalEvents])

  /**
   * Get resource by ID
   */
  const getResourceById = useCallback((id: string): Resource | undefined => {
    return resources.find(r => r.id === id)
  }, [resources])

  /**
   * Get all allocations for a specific resource
   */
  const getResourceAllocations = useCallback((resourceId: string): Allocation[] => {
    return allocations.filter(a => a.resource_id === resourceId)
  }, [allocations])

  /**
   * Get all personal events for a specific resource
   */
  const getResourcePersonalEvents = useCallback((resourceId: string): PersonalEvent[] => {
    return personalEvents.filter(e => e.resource_id === resourceId)
  }, [personalEvents])

  /**
   * Get only active resources
   */
  const getActiveResources = useCallback((): Resource[] => {
    return resources.filter(r => r.is_active)
  }, [resources])

  /**
   * Get resources filtered by role
   */
  const getResourcesByRole = useCallback((role: 'gerente' | 'lider' | 'operador'): Resource[] => {
    return resources.filter(r => r.role === role && r.is_active)
  }, [resources])

  // Initial load
  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  const value: ResourceContextData = {
    resources,
    allocations,
    personalEvents,
    isLoading,
    error,
    refreshResources,
    refreshAllocations,
    refreshPersonalEvents,
    refreshAll,
    getResourceById,
    getResourceAllocations,
    getResourcePersonalEvents,
    getActiveResources,
    getResourcesByRole
  }

  return (
    <ResourceContext.Provider value={value}>
      {children}
    </ResourceContext.Provider>
  )
}

/**
 * Hook to use Resource Context
 *
 * @returns ResourceContext data and functions
 * @throws Error if used outside ResourceProvider
 */
export function useResourceContext() {
  const context = useContext(ResourceContext)

  if (context === undefined) {
    throw new Error('useResourceContext must be used within a ResourceProvider')
  }

  return context
}
