'use client'

import { useState, useMemo } from 'react'
import { CalendarEvent } from '@/types/allocation.types'
import { PersonalEvent } from '@/types/personal-events.types'
import TimelineHeader from './TimelineHeader'
import TimelineResourceRow from './TimelineResourceRow'
import ResourceGroupHeader from './ResourceGroupHeader'
import { generateProjectColorMap, PROJECT_COLORS } from './TimelineTaskBar'

interface GroupedResources {
  gerente: Array<{ id: string; name: string; role: string }>
  lider: Array<{ id: string; name: string; role: string }>
  operador: Array<{ id: string; name: string; role: string }>
}

interface TimelineViewProps {
  dateRange: Date[]
  groupedResources: GroupedResources
  eventsByResource: Map<string, CalendarEvent[]>
  personalEventsByResource: Map<string, PersonalEvent[]>
  onDayClick: (date: Date, resourceId: string) => void
  onTaskBarClick: (projectCode: string, resourceId: string, resourceName: string) => void
  onPersonalEventClick?: (event: PersonalEvent) => void
}

/**
 * Main timeline view component
 * Shows horizontal timeline with resources grouped by role
 */
export default function TimelineView({
  dateRange,
  groupedResources,
  eventsByResource,
  personalEventsByResource,
  onDayClick,
  onTaskBarClick,
  onPersonalEventClick,
}: TimelineViewProps) {
  // Expanded/collapsed state for each role group
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['gerente', 'lider', 'operador']) // All expanded by default
  )

  // Toggle expand/collapse for a role group
  const toggleGroup = (role: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(role)) {
        next.delete(role)
      } else {
        next.add(role)
      }
      return next
    })
  }

  // Generate project color map from all events
  const projectColorMap = useMemo(() => {
    const allProjectCodes = new Set<string>()
    eventsByResource.forEach(events => {
      events.forEach(event => {
        allProjectCodes.add(event.projectCode)
      })
    })
    return generateProjectColorMap(Array.from(allProjectCodes))
  }, [eventsByResource])

  // Render a group of resources
  const renderGroup = (
    role: 'gerente' | 'lider' | 'operador',
    resources: Array<{ id: string; name: string; role: string }>
  ) => {
    if (resources.length === 0) return null

    const isExpanded = expandedGroups.has(role)

    return (
      <div key={role}>
        <ResourceGroupHeader
          role={role}
          count={resources.length}
          isExpanded={isExpanded}
          onToggle={() => toggleGroup(role)}
        />

        {isExpanded &&
          resources.map(resource => {
            const events = eventsByResource.get(resource.id) || []
            const personalEvents = personalEventsByResource.get(resource.id) || []

            return (
              <TimelineResourceRow
                key={resource.id}
                resource={resource}
                dateRange={dateRange}
                events={events}
                personalEvents={personalEvents}
                projectColorMap={projectColorMap}
                onDayClick={onDayClick}
                onTaskBarClick={onTaskBarClick}
                onPersonalEventClick={onPersonalEventClick}
              />
            )
          })}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Timeline header (sticky) */}
      <TimelineHeader dateRange={dateRange} />

      {/* Scrollable content area */}
      <div className="flex-1 overflow-auto">
        {/* Render groups in order: Gerente → Líder → Operador */}
        {renderGroup('gerente', groupedResources.gerente)}
        {renderGroup('lider', groupedResources.lider)}
        {renderGroup('operador', groupedResources.operador)}

        {/* Empty state */}
        {groupedResources.gerente.length === 0 &&
          groupedResources.lider.length === 0 &&
          groupedResources.operador.length === 0 && (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <div className="text-4xl mb-2">📅</div>
                <div className="font-medium">Nenhum recurso encontrado</div>
                <div className="text-sm mt-1">
                  Ajuste os filtros para visualizar recursos
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  )
}
