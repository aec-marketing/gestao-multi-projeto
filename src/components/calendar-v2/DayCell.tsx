'use client'

import { isToday, isWeekend } from '@/utils/calendar/calendar.utils'
import { PersonalEvent, EVENT_TYPE_CONFIG } from '@/types/personal-events.types'

interface DayCellProps {
  date: Date
  resourceId: string
  personalEvents?: PersonalEvent[]
  hasConflict?: boolean
  hasHighLoad?: boolean
  onClick?: () => void
  children?: React.ReactNode
}

/**
 * Individual day cell in the timeline grid
 * Shows personal events, conflicts, and can contain task bars as children
 */
export default function DayCell({
  date,
  resourceId,
  personalEvents = [],
  hasConflict = false,
  hasHighLoad = false,
  onClick,
  children,
}: DayCellProps) {
  // Determine background color based on status
  const hasBlockingEvent = personalEvents.some(e => e.blocks_work)

  let bgColor = 'bg-white'
  if (hasConflict) {
    bgColor = 'bg-red-50' // Conflict (task + blocking event)
  } else if (hasBlockingEvent) {
    bgColor = 'bg-yellow-50' // Absence/blocking event
  } else if (hasHighLoad) {
    bgColor = 'bg-blue-50' // High workload (3+ tasks)
  }

  // Highlight today
  const isTodayCell = isToday(date)
  const isWeekendCell = isWeekend(date)

  return (
    <div
      className={`
        relative min-h-[100px] border-r border-b p-2
        ${bgColor}
        ${isTodayCell ? 'bg-blue-100 ring-2 ring-blue-400 ring-inset' : ''}
        ${isWeekendCell ? 'bg-gray-50' : ''}
        ${onClick ? 'cursor-pointer hover:bg-opacity-70 transition-all' : ''}
      `}
      onClick={onClick}
    >
      {/* Task bars rendered here (absolute positioned) */}
      {children}

      {/* Personal events at the bottom */}
      {personalEvents.length > 0 && (
        <div className="absolute bottom-1 left-1 right-1 space-y-1 z-20">
          {personalEvents.map(event => {
            const config = EVENT_TYPE_CONFIG[event.event_type]
            return (
              <div
                key={event.id}
                className={`
                  ${config.bgColor} ${config.borderColor} ${config.color}
                  border rounded px-1 py-0.5 text-[9px] font-medium
                  flex items-center space-x-1 truncate
                `}
                title={event.title}
              >
                <span>{config.icon}</span>
                {event.blocks_work && <span title="Bloqueia trabalho">🚫</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* Conflict indicator */}
      {hasConflict && (
        <div className="absolute top-1 right-1 z-20">
          <div className="bg-red-100 border-2 border-red-500 text-red-700 text-[10px] px-1 py-0.5 rounded font-bold flex items-center space-x-1 animate-pulse">
            <span>⚠️</span>
          </div>
        </div>
      )}
    </div>
  )
}
