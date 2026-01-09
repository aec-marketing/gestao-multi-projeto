'use client'

import { TaskBar } from '@/utils/calendar/taskbar.utils'
import { getPriorityBorderStyle, getTaskBarTooltip } from '@/utils/calendar/taskbar.utils'

// Project color palette (same as old calendar)
export const PROJECT_COLORS = [
  { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-900' },
  { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-900' },
  { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-900' },
  { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-900' },
  { bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-900' },
  { bg: 'bg-indigo-100', border: 'border-indigo-300', text: 'text-indigo-900' },
  { bg: 'bg-teal-100', border: 'border-teal-300', text: 'text-teal-900' },
  { bg: 'bg-cyan-100', border: 'border-cyan-300', text: 'text-cyan-900' },
  { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-900' },
  { bg: 'bg-lime-100', border: 'border-lime-300', text: 'text-lime-900' },
]

interface TimelineTaskBarProps {
  bar: TaskBar
  style: React.CSSProperties
  projectColorMap: Record<string, typeof PROJECT_COLORS[0]>
  onClick?: () => void
}

/**
 * Horizontal task bar component
 * Displays a colored bar representing one or more merged tasks from the same project
 */
export default function TimelineTaskBar({
  bar,
  style,
  projectColorMap,
  onClick,
}: TimelineTaskBarProps) {
  // Get project color (or default to first color)
  const projectColor = projectColorMap[bar.projectCode] || PROJECT_COLORS[0]

  // Get priority border style
  const priorityBorder = getPriorityBorderStyle(bar.priority)

  // Generate tooltip
  const tooltip = getTaskBarTooltip(bar)

  return (
    <div
      className={`
        ${projectColor.bg} ${projectColor.border} ${projectColor.text}
        border ${priorityBorder}
        px-2 py-1 text-[10px] rounded cursor-pointer
        hover:opacity-90 hover:shadow-md transition-all
        flex items-center justify-between
        pointer-events-auto
      `}
      style={style}
      title={tooltip}
      onClick={onClick}
    >
      {/* Project code */}
      <div className="font-bold truncate flex-1">
        {bar.projectCode}
      </div>

      {/* Task count badge */}
      {bar.tasks.length > 1 && (
        <div className="text-[9px] opacity-90 ml-1 whitespace-nowrap bg-white bg-opacity-50 px-1 rounded">
          {bar.tasks.length}x
        </div>
      )}
    </div>
  )
}

/**
 * Generate project color map from unique project codes
 * Distributes colors evenly across projects
 */
export function generateProjectColorMap(projectCodes: string[]): Record<string, typeof PROJECT_COLORS[0]> {
  const colorMap: Record<string, typeof PROJECT_COLORS[0]> = {}

  projectCodes.forEach((code, index) => {
    colorMap[code] = PROJECT_COLORS[index % PROJECT_COLORS.length]
  })

  return colorMap
}
