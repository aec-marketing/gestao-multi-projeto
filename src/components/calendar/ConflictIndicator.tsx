'use client'

interface ConflictIndicatorProps {
  taskCount: number
  hasBlockingEvent: boolean
  compact?: boolean
}

export default function ConflictIndicator({ 
  taskCount, 
  hasBlockingEvent,
  compact = false 
}: ConflictIndicatorProps) {
  if (!hasBlockingEvent || taskCount === 0) return null

  return (
    <div
      className={`
        bg-red-100 border-2 border-red-500 text-red-700 
        ${compact ? 'text-[10px] px-1 py-0.5' : 'text-xs px-2 py-1'}
        rounded font-bold flex items-center space-x-1
        animate-pulse
      `}
      title={`CONFLITO: ${taskCount} tarefa(s) + ausência no mesmo dia`}
    >
      <span>⚠️</span>
      {!compact && <span>CONFLITO</span>}
    </div>
  )
}