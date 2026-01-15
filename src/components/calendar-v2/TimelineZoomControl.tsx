'use client'

export type TimelineZoom = 'day' | 'week' | 'month'

interface TimelineZoomControlProps {
  zoom: TimelineZoom
  onZoomChange: (zoom: TimelineZoom) => void
}

/**
 * Timeline zoom control component
 * Allows switching between day, week, and month views
 */
export default function TimelineZoomControl({ zoom, onZoomChange }: TimelineZoomControlProps) {
  const zoomOptions: Array<{ value: TimelineZoom; label: string; icon: string }> = [
    { value: 'day', label: 'Dia', icon: '📅' },
    { value: 'week', label: 'Semana', icon: '📆' },
    { value: 'month', label: 'Mês', icon: '🗓️' },
  ]

  return (
    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
      {zoomOptions.map(option => (
        <button
          key={option.value}
          onClick={() => onZoomChange(option.value)}
          className={`
            px-3 py-1.5 text-sm font-medium rounded-md transition-all
            flex items-center gap-1.5
            ${
              zoom === option.value
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }
          `}
          title={`Visualizar por ${option.label.toLowerCase()}`}
        >
          <span>{option.icon}</span>
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  )
}
