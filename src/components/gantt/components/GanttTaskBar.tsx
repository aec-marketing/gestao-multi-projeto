/**
 * Barra visual de tarefa no Gantt (ONDA 2 + ONDA 3)
 * Renderiza barras normais ou diamantes (milestone)
 * Usa duration_minutes e work_type
 */

import React, { useState, useMemo } from 'react'
import { TaskWithDates } from '../types/gantt.types'
import { formatTaskTooltip, formatTaskTooltipData, workTypeLabels } from '../utils/ganttFormatters'
import { formatMinutes } from '@/utils/time.utils'
import { checkTaskPredecessorConflicts } from '@/utils/predecessorCalculations'
import { Task } from '@/types/database.types'
import { AlertCircle, AlertTriangle } from 'lucide-react'

interface Predecessor {
  id: string
  task_id: string
  predecessor_id: string
  type: string
  lag_time: number
  lag_minutes?: number
}

interface GanttTaskBarProps {
  task: TaskWithDates
  style: React.CSSProperties
  color: string

  isSelected: boolean
  isResizing: boolean
  tempDuration?: number

  // Novos props para detecção de conflitos
  allTasks?: Task[]
  predecessors?: Predecessor[]

  // ONDA 3: Props para fragmentação
  isFragment?: boolean
  fragmentIndex?: number
  totalFragments?: number
  fragmentLabel?: string

  onResizeStart: (edge: 'start' | 'end', e: React.MouseEvent) => void
  onClick: () => void
}

export const GanttTaskBar = React.memo(function GanttTaskBar({
  task,
  style,
  color,
  isSelected,
  isResizing,
  tempDuration,
  allTasks = [],
  predecessors = [],
  isFragment = false,
  fragmentIndex = 0,
  totalFragments = 1,
  fragmentLabel,
  onResizeStart,
  onClick
}: GanttTaskBarProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const tooltipData = formatTaskTooltipData(task)

  // Verificar conflitos de predecessores
  const conflictMessages = useMemo(() => {
    if (!allTasks.length || !predecessors.length) return []

    // Converter TaskWithDates para Task (formato esperado)
    const taskAsTask: Task = {
      ...task,
      start_date: task.start_date instanceof Date ? task.start_date.toISOString().split('T')[0] : task.start_date,
      end_date: task.end_date instanceof Date ? task.end_date.toISOString().split('T')[0] : task.end_date
    } as Task

    return checkTaskPredecessorConflicts(taskAsTask, allTasks, predecessors)
  }, [task, allTasks, predecessors])

  const hasConflict = conflictMessages.length > 0

  // Renderizar milestone como diamante (ONDA 3)
  if (task.work_type === 'milestone') {
    return (
      <div
        style={style}
        className="absolute cursor-pointer group flex items-center justify-center"
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        title={formatTaskTooltip(task)}
      >
        <div
          className={`
            w-6 h-6 rotate-45 border-2 shadow-md transition-all
            ${isSelected ? 'border-blue-500 ring-2 ring-blue-300' : 'border-yellow-700'}
            bg-yellow-500
          `}
        />
        {/* Label ao lado do diamante */}
        <div className="absolute left-8 top-0 text-xs font-medium whitespace-nowrap text-gray-700">
          🎯 {task.name}
        </div>

        {/* Tooltip customizado */}
        {showTooltip && (
          <div className="absolute z-[9999] bottom-full mb-2 left-0 bg-gray-900 text-white text-xs rounded-lg px-4 py-3 shadow-2xl whitespace-nowrap pointer-events-none">
            <div className="space-y-2">
              <p className="font-semibold text-base text-yellow-300">{tooltipData.name}</p>
              <div className="text-sm space-y-1 border-t border-gray-700 pt-2">
                <p className="text-gray-400">
                  <span className="text-white">Tipo:</span> 🎯 Checkpoint (duração zero)
                </p>
                <p className="text-gray-400">
                  <span className="text-white">Data:</span> {tooltipData.startDate}
                </p>
              </div>
            </div>
            {/* Seta */}
            <div className="absolute top-full left-4 w-2 h-2 bg-gray-900 transform rotate-45 -mt-1" />
          </div>
        )}
      </div>
    )
  }

  // Duração efetiva (considerar tempDuration durante resize)
  const effectiveDurationMinutes = tempDuration
    ? Math.round(tempDuration * 540) // Converter dias temporários para minutos
    : task.duration_minutes

  // Ícone baseado no work_type (ONDA 3)
  const workTypeIcon = workTypeLabels[task.work_type]?.split(' ')[0] || '⚙️'

  // Barra normal (work ou wait)
  return (
    <div
      style={style}
      className={`
        absolute rounded-md shadow-sm cursor-pointer group
        transition-all duration-150
        ${color}
        ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
        ${isResizing ? 'opacity-80 cursor-ew-resize' : 'hover:shadow-md'}
      `}
      onClick={onClick}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      title={formatTaskTooltip(task)}
    >
      {/* Conteúdo da barra */}
      <div className="h-full flex items-center px-2 text-xs font-medium text-white truncate">
        <span className="mr-1">{workTypeIcon}</span>
        {/* ONDA 3: Usar fragmentLabel se for fragmento, senão usar task.name */}
        <span className="flex-1 truncate">{fragmentLabel || task.name}</span>
        <span className="ml-2 text-[10px] opacity-75 font-mono">
          {formatMinutes(effectiveDurationMinutes, 'short')}
        </span>
        {/* ONDA 3: Indicador de fragmento */}
        {isFragment && (
          <span className="ml-1 text-[9px] opacity-60 font-mono">
            {fragmentIndex + 1}/{totalFragments}
          </span>
        )}
      </div>

      {/* Alça de resize - INÍCIO (esquerda) */}
      <div
        className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize bg-white bg-opacity-0 group-hover:bg-opacity-30 transition-all"
        onMouseDown={(e) => onResizeStart('start', e)}
        title="Arrastar para alterar data de início"
      />

      {/* Alça de resize - FIM (direita) */}
      <div
        className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize bg-white bg-opacity-0 group-hover:bg-opacity-30 transition-all"
        onMouseDown={(e) => onResizeStart('end', e)}
        title="Arrastar para redimensionar"
      />

      {/* Indicador de progresso */}
      {task.progress > 0 && (
        <div
          className="absolute bottom-0 left-0 h-1 bg-white bg-opacity-40 rounded-bl-md"
          style={{ width: `${task.progress}%` }}
        />
      )}

      {/* Badge e ícone de conflito de predecessor */}
      {hasConflict && (
        <>
          {/* Badge no canto superior direito */}
          <div className="absolute -top-2 -right-2 group/conflict z-10">
            <div className="bg-red-500 rounded-full w-5 h-5 flex items-center justify-center cursor-help shadow-md">
              <AlertCircle className="w-3 h-3 text-white" />
            </div>

            {/* Tooltip explicativo do conflito (hover no badge) */}
            <div className="absolute hidden group-hover/conflict:block bg-red-600 text-white text-xs rounded-md px-3 py-2 -top-1 right-6 w-72 z-[9999] shadow-xl">
              <p className="font-semibold mb-2 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                Conflitos detectados:
              </p>
              {conflictMessages.map((msg, i) => (
                <p key={i} className="mb-1 pl-2 text-xs">• {msg}</p>
              ))}
              {/* Seta apontando para o badge */}
              <div className="absolute top-3 -right-1 w-2 h-2 bg-red-600 transform rotate-45" />
            </div>
          </div>

          {/* Ícone dentro da barra */}
          <div className="absolute top-1 left-1">
            <AlertTriangle className="w-4 h-4 text-yellow-300 animate-pulse drop-shadow" />
          </div>
        </>
      )}

      {/* Tooltip customizado detalhado */}
      {showTooltip && (
        <div className="absolute z-[9999] bottom-full mb-2 left-0 bg-gray-900 text-white text-xs rounded-lg px-4 py-3 shadow-2xl whitespace-nowrap pointer-events-none">
          <div className="space-y-2">
            <p className="font-semibold text-base text-blue-300">{tooltipData.name}</p>
            <div className="text-sm space-y-1">
              <div className="border-t border-gray-700 pt-2">
                <p className="text-gray-400 mb-1">
                  <span className="text-white font-medium">Duração:</span> {tooltipData.duration.auto}
                </p>
                <p className="text-xs text-gray-500 pl-2">
                  • {tooltipData.duration.minutes} minutos
                </p>
                <p className="text-xs text-gray-500 pl-2">
                  • {tooltipData.duration.short}
                </p>
                <p className="text-xs text-gray-500 pl-2">
                  • {tooltipData.duration.long}
                </p>
              </div>
              <div className="border-t border-gray-700 pt-2">
                <p className="text-gray-400">
                  <span className="text-white">Categoria:</span> {tooltipData.workType}
                </p>
                <p className="text-gray-400">
                  <span className="text-white">Início:</span> {tooltipData.startDate}
                </p>
                <p className="text-gray-400">
                  <span className="text-white">Fim:</span> {tooltipData.endDate}
                </p>
                <p className="text-gray-400">
                  <span className="text-white">Progresso:</span> {tooltipData.progress}%
                </p>
              </div>
            </div>
          </div>
          {/* Seta */}
          <div className="absolute top-full left-8 w-2 h-2 bg-gray-900 transform rotate-45 -mt-1" />
        </div>
      )}
    </div>
  )
}, (prevProps, nextProps) => {
  // Comparador customizado para evitar renders desnecessários
  return (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.name === nextProps.task.name &&
    prevProps.task.duration_minutes === nextProps.task.duration_minutes &&
    prevProps.task.work_type === nextProps.task.work_type &&
    prevProps.task.progress === nextProps.task.progress &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isResizing === nextProps.isResizing &&
    prevProps.tempDuration === nextProps.tempDuration &&
    prevProps.style.left === nextProps.style.left &&
    prevProps.style.width === nextProps.style.width &&
    prevProps.color === nextProps.color
  )
})
