'use client'

import { useMemo } from 'react'
import { Resource, CalendarEvent } from '@/types/allocation.types'
import { PersonalEvent, EVENT_TYPE_CONFIG } from '@/types/personal-events.types'
import DayCell from './DayCell'
import TimelineTaskBar from './TimelineTaskBar'
import { mergeConsecutiveProjectBars, calculateTaskBarStyle } from '@/utils/calendar/taskbar.utils'
import { findDayIndex } from '@/utils/calendar/calendar.utils'
import { parseLocalDate } from '@/utils/date.utils'
import { PROJECT_COLORS } from './TimelineTaskBar'

interface TimelineResourceRowProps {
  resource: { id: string; name: string; hierarchy: string; role: string | null }
  dateRange: Date[]
  events: CalendarEvent[]
  personalEvents: PersonalEvent[]
  projectColorMap: Record<string, typeof PROJECT_COLORS[0]>
  onDayClick: (date: Date, resourceId: string) => void
  onTaskBarClick: (projectCode: string, resourceId: string, resourceName: string) => void
  onPersonalEventClick?: (event: PersonalEvent) => void
}

interface PersonalEventBar {
  event: PersonalEvent
  startDay: number
  endDay: number
}

/**
 * Single resource row in the timeline
 * Shows resource info on the left and a timeline grid on the right
 */
export default function TimelineResourceRow({
  resource,
  dateRange,
  events,
  personalEvents,
  projectColorMap,
  onDayClick,
  onTaskBarClick,
  onPersonalEventClick,
}: TimelineResourceRowProps) {
  // Merge consecutive tasks from same project
  const mergedBars = useMemo(
    () => mergeConsecutiveProjectBars(events, dateRange),
    [events, dateRange]
  )

  // Transform personal events into bars
  const personalEventBars = useMemo((): PersonalEventBar[] => {
    return personalEvents.map(event => {
      const startDate = parseLocalDate(event.start_date)
      const endDate = parseLocalDate(event.end_date)

      if (!startDate || !endDate) {
        return null
      }

      const startDay = findDayIndex(dateRange, startDate)
      const endDay = findDayIndex(dateRange, endDate)

      // Handle events that span outside the month
      const actualStartDay = startDay === -1 ? 0 : startDay
      const actualEndDay = endDay === -1 ? dateRange.length - 1 : endDay

      return {
        event,
        startDay: actualStartDay,
        endDay: actualEndDay,
      }
    })
      .filter((bar): bar is PersonalEventBar => bar !== null && bar.startDay <= bar.endDay)
  }, [personalEvents, dateRange])

  // Get personal events for each day
  const getPersonalEventsForDay = (date: Date): PersonalEvent[] => {
    return personalEvents.filter(event => {
      const eventStart = parseLocalDate(event.start_date)
      const eventEnd = parseLocalDate(event.end_date)

      if (!eventStart || !eventEnd) return false

      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)

      return eventStart <= dayEnd && eventEnd >= dayStart
    })
  }

  // Check if day has conflict (task + blocking event)
  const hasConflict = (date: Date): boolean => {
    const eventsOnDay = events.filter(e => {
      const eventStart = new Date(e.startDate)
      const eventEnd = new Date(e.endDate)
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)
      return eventStart <= dayEnd && eventEnd >= dayStart
    })

    const personalEventsOnDay = getPersonalEventsForDay(date)
    const hasBlockingEvent = personalEventsOnDay.some(e => e.blocks_work)

    return eventsOnDay.length > 0 && hasBlockingEvent
  }

  // Check if day has high load (3+ tasks)
  const hasHighLoad = (date: Date): boolean => {
    const eventsOnDay = events.filter(e => {
      const eventStart = new Date(e.startDate)
      const eventEnd = new Date(e.endDate)
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)
      return eventStart <= dayEnd && eventEnd >= dayStart
    })

    return eventsOnDay.length >= 3
  }

  // Badge color based on hierarchy (not role)
  const getHierarchyBadgeColor = (hierarchy: string) => {
    switch (hierarchy) {
      case 'gerente':
        return 'bg-purple-100 text-purple-800'
      case 'lider':
        return 'bg-blue-100 text-blue-800'
      case 'operador':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Display label: hierarchy icon + custom role (if exists)
  const getDisplayLabel = (hierarchy: string, role: string | null) => {
    // Get hierarchy icon
    let icon = '👤'
    if (hierarchy === 'gerente') icon = '👔'
    else if (hierarchy === 'lider') icon = '👨‍💼'
    else if (hierarchy === 'operador') icon = '👷'

    // If has custom role/function, show it
    if (role) {
      return `${icon} ${role}`
    }

    // Otherwise show hierarchy name
    if (hierarchy === 'gerente') return `${icon} Gerente`
    if (hierarchy === 'lider') return `${icon} Líder`
    if (hierarchy === 'operador') return `${icon} Operador`
    return `${icon} Sem função`
  }

  return (
    <div className="flex border-b hover:bg-gray-50 transition-colors">
      {/* Fixed left column - Resource info */}
      <div className="sticky left-0 z-30 bg-white border-r w-[240px] p-3 flex-shrink-0">
        <div className="font-semibold text-sm text-gray-900 truncate">
          {resource.name}
        </div>
        <div className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${getHierarchyBadgeColor(resource.hierarchy)}`}>
          {getDisplayLabel(resource.hierarchy, resource.role)}
        </div>
      </div>

      {/* Timeline grid - Day cells */}
      <div className="flex-1 flex relative" style={{ position: 'relative' }}>
        {/* Render day cells */}
        {dateRange.map((day, dayIndex) => {
          const personalEventsForDay = getPersonalEventsForDay(day)
          const hasConflictToday = hasConflict(day)
          const hasHighLoadToday = hasHighLoad(day)

          return (
            <div
              key={dayIndex}
              className="flex-1 relative"
              style={{ minWidth: '50px' }}
            >
              <DayCell
                date={day}
                resourceId={resource.id}
                personalEvents={[]} // No longer render as badges
                hasConflict={hasConflictToday}
                hasHighLoad={hasHighLoadToday}
                onClick={() => onDayClick(day, resource.id)}
              />
            </div>
          )
        })}

        {/* Render personal event bars (absolute positioned over entire row) */}
        {personalEventBars.map((eventBar, eventIndex) => {
          const config = EVENT_TYPE_CONFIG[eventBar.event.event_type]
          const cellWidth = 100 / dateRange.length // Percentage width of each cell
          const leftPosition = eventBar.startDay * cellWidth
          const barWidth = (eventBar.endDay - eventBar.startDay + 1) * cellWidth

          return (
            <div
              key={`event-${eventBar.event.id}`}
              className={`
                ${config.bgColor} ${config.borderColor} ${config.color}
                border-2 px-2 py-1 text-[10px] rounded cursor-pointer
                hover:opacity-90 hover:shadow-md transition-all
                flex items-center gap-1 font-medium
                ${eventBar.event.blocks_work ? 'border-red-500 border-2' : ''}
              `}
              style={{
                position: 'absolute',
                left: `${leftPosition}%`,
                width: `${barWidth}%`,
                bottom: '8px',
                height: '24px',
                zIndex: 5,
              }}
              title={`${eventBar.event.title} (${eventBar.event.event_type})`}
              onClick={(e) => {
                e.stopPropagation()
                onPersonalEventClick?.(eventBar.event)
              }}
            >
              <span>{config.icon}</span>
              <span className="truncate">{eventBar.event.title}</span>
              {eventBar.event.blocks_work && <span>🚫</span>}
            </div>
          )
        })}

        {/* Render task bars (absolute positioned over entire row) */}
        {mergedBars.map((bar, barIndex) => {
          const style = calculateTaskBarStyle(bar, dateRange, barIndex)
          return (
            <TimelineTaskBar
              key={bar.id}
              bar={bar}
              style={style}
              projectColorMap={projectColorMap}
              onClick={() => onTaskBarClick(bar.projectCode, resource.id, resource.name)}
            />
          )
        })}
      </div>
    </div>
  )
}
