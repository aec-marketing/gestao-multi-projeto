'use client'

import { PersonalEventWithResource, EVENT_TYPE_CONFIG } from '@/types/personal-events.types'

interface PersonalEventBadgeProps {
  event: PersonalEventWithResource
  onClick?: (e: React.MouseEvent) => void
  compact?: boolean
}

export default function PersonalEventBadge({
  event,
  onClick,
  compact = false
}: PersonalEventBadgeProps) {
  const config = EVENT_TYPE_CONFIG[event.event_type]

  return (
    <div
      onClick={onClick}
      className={`
        ${config.bgColor} ${config.borderColor} ${config.color}
        border rounded px-2 py-1 text-xs font-medium
        flex items-center space-x-1 cursor-pointer
        hover:opacity-80 transition-opacity
        ${compact ? 'text-[10px]' : ''}
      `}
      title={`${event.title} - ${event.resource.name}${event.notes ? '\n' + event.notes : ''}`}
    >
      <span>{config.icon}</span>
      {compact ? (
        <span className="truncate">
          {event.resource.name}-{config.label}
        </span>
      ) : (
        <>
          <span className="truncate max-w-[120px]">{event.title}</span>
          {event.blocks_work && (
            <span title="Bloqueia trabalho">🚫</span>
          )}
        </>
      )}
    </div>
  )
}