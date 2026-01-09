import { useState, useCallback } from 'react'

export interface CalendarFilters {
  selectedResource: string | null
  selectedProject: string | null
  selectedRoleGroups: Set<'gerente' | 'lider' | 'operador'>
}

/**
 * Hook for managing calendar filter state
 * Provides clean API for updating filters and resetting them
 */
export function useCalendarFilters() {
  const [selectedResource, setSelectedResource] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [selectedRoleGroups, setSelectedRoleGroups] = useState<
    Set<'gerente' | 'lider' | 'operador'>
  >(new Set(['gerente', 'lider', 'operador'])) // All roles visible by default

  // Toggle a role group (show/hide)
  const toggleRoleGroup = useCallback((role: 'gerente' | 'lider' | 'operador') => {
    setSelectedRoleGroups(prev => {
      const next = new Set(prev)
      if (next.has(role)) {
        next.delete(role)
      } else {
        next.add(role)
      }
      return next
    })
  }, [])

  // Reset all filters to default
  const resetFilters = useCallback(() => {
    setSelectedResource(null)
    setSelectedProject(null)
    setSelectedRoleGroups(new Set(['gerente', 'lider', 'operador']))
  }, [])

  // Check if any filters are active
  const hasActiveFilters = Boolean(selectedResource || selectedProject)

  return {
    selectedResource,
    selectedProject,
    selectedRoleGroups,
    setSelectedResource,
    setSelectedProject,
    toggleRoleGroup,
    resetFilters,
    hasActiveFilters,
  }
}
