'use client'

import React from 'react'
import { TaskWithDates, TaskWithAllocations } from '../types/gantt.types'

interface Predecessor {
  id: string
  task_id: string
  predecessor_id: string
  type: string
  lag_time: number
  lag_minutes?: number
}

// Verificar se há conflito entre predecessor e tarefa dependente
function hasConflict(fromTask: TaskWithDates, toTask: TaskWithDates, predType: string): boolean {
  // Parse seguro de data
  const parseDate = (date: Date | string): Date => {
    if (date instanceof Date) return date
    if (typeof date === 'string') {
      const parts = date.split('T')[0].split('-')
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10)
        const month = parseInt(parts[1], 10) - 1
        const day = parseInt(parts[2], 10)
        return new Date(year, month, day)
      }
    }
    return new Date(date)
  }

  try {
    const predEnd = parseDate(fromTask.end_date)
    const taskStart = parseDate(toTask.start_date)

    // Para predecessores Fim-Início (FS/fim_inicio): tarefa não pode começar antes do predecessor terminar
    if (predType === 'FS' || predType === 'fim_inicio') {
      return taskStart < predEnd
    }

    // Para outros tipos, verificar também
    const predStart = parseDate(fromTask.start_date)
    const taskEnd = parseDate(toTask.end_date)

    if (predType === 'SS' || predType === 'inicio_inicio') {
      // Tarefa não pode começar antes do predecessor começar
      return taskStart < predStart
    }

    if (predType === 'FF' || predType === 'fim_fim') {
      // Tarefa não pode terminar antes do predecessor terminar
      return taskEnd < predEnd
    }

    if (predType === 'SF' || predType === 'inicio_fim') {
      // Tarefa não pode terminar antes do predecessor começar
      return taskEnd < predStart
    }

    return false
  } catch (error) {
    return false
  }
}

interface PredecessorLinesProps {
  tasks: TaskWithDates[]
  predecessors: Predecessor[]
  expandedTasks: Set<string>
  dateRange: { minDate: Date; maxDate: Date }
  columnWidth: number
  rowHeight: number
  taskColumnWidth: number
  taskPositionMap?: Map<string, number> // Mapa opcional de posições Y (taskId -> yPosition)
  onExpandTask?: (taskId: string) => void
}

export function PredecessorLines({
  tasks,
  predecessors,
  expandedTasks,
  dateRange,
  columnWidth,
  rowHeight,
  taskColumnWidth,
  taskPositionMap: externalPositionMap,
  onExpandTask
}: PredecessorLinesProps) {
  const [hoveredLine, setHoveredLine] = React.useState<string | null>(null)

  // Cores por tipo de predecessor
  function getPredecessorColor(type: string): string {
    const colors: Record<string, string> = {
      'fim_inicio': '#3B82F6',
      'FS': '#3B82F6',
      'inicio_inicio': '#10B981',
      'SS': '#10B981',
      'fim_fim': '#F59E0B',
      'FF': '#F59E0B',
      'inicio_fim': '#EF4444',
      'SF': '#EF4444'
    }
    return colors[type] || '#3B82F6'
  }

  // Label curto por tipo
  function getShortLabel(type: string): string {
    const labels: Record<string, string> = {
      'fim_inicio': 'FI',
      'FS': 'FI',
      'inicio_inicio': 'II',
      'SS': 'II',
      'fim_fim': 'FF',
      'FF': 'FF',
      'inicio_fim': 'IF',
      'SF': 'IF'
    }
    return labels[type] || 'FI'
  }

  // Parse seguro de data
  function parseDate(date: Date | string): Date {
    if (date instanceof Date) return date
    if (typeof date === 'string') {
      const parts = date.split('T')[0].split('-')
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10)
        const month = parseInt(parts[1], 10) - 1
        const day = parseInt(parts[2], 10)
        return new Date(year, month, day)
      }
    }
    return new Date(date)
  }

  // Calcula offset intra-dia para uma tarefa baseado em predecessores FS (recursivo)
  function getIntraDayOffset(task: TaskWithDates, visitedTasks = new Set<string>()): number {
    // Evitar loops infinitos
    if (visitedTasks.has(task.id)) return 0
    visitedTasks.add(task.id)

    let maxOffset = 0
    const taskPreds = predecessors.filter(p => p.task_id === task.id)

    for (const pred of taskPreds) {
      // Apenas predecessores FS (Fim-Início) afetam o offset visual
      if (pred.type === 'FS' || pred.type === 'fim_inicio') {
        const predecessorTask = tasks.find(t => t.id === pred.predecessor_id)
        if (!predecessorTask) continue

        // Verificar se predecessor TERMINA no mesmo dia que a tarefa COMEÇA
        const predEnd = new Date(predecessorTask.end_date)
        predEnd.setHours(0, 0, 0, 0)

        const taskStart = new Date(task.start_date)
        taskStart.setHours(0, 0, 0, 0)

        const sameDayEnd = predEnd.getTime() === taskStart.getTime()

        if (sameDayEnd) {
          // Calcular quanto do último dia o predecessor ocupa
          const predDurationMinutes = predecessorTask.duration_minutes ?? 540
          const predDurationDays = predDurationMinutes / 540
          const lastDayOccupancy = predDurationDays - Math.floor(predDurationDays)

          // RECURSÃO: Calcular offset do predecessor também
          const predecessorOffset = getIntraDayOffset(predecessorTask, visitedTasks)

          // Offset total = offset do predecessor + duração dele no último dia
          const totalOffset = predecessorOffset + lastDayOccupancy

          maxOffset = Math.max(maxOffset, totalOffset)
        }
      }
    }

    return maxOffset
  }

  // ONDA 3: Obter data de fim efetiva (última alocação se fragmentada)
  function getEffectiveEndDate(task: TaskWithDates): Date | string {
    const taskWithAlloc = task as TaskWithAllocations
    const allocations = taskWithAlloc.allocations || []

    // Se tem múltiplas alocações (fragmentada), usar a última
    if (allocations.length > 1) {
      const sorted = [...allocations].sort((a, b) =>
        new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      )
      return sorted[sorted.length - 1].end_date
    }

    // Se só tem uma alocação, usar ela
    if (allocations.length === 1) {
      return allocations[0].end_date
    }

    // Senão, usar end_date da tarefa
    return task.end_date
  }

  // Calcula posição X de uma data (com offset intra-dia para tarefas com predecessores FS)
  function getDateX(date: Date | string | null, task?: TaskWithDates): number {
    if (!date) return 0
    const dateObj = parseDate(date)

    const normalizedDate = new Date(dateObj)
    normalizedDate.setHours(0, 0, 0, 0)

    const normalizedStart = new Date(dateRange.minDate)
    normalizedStart.setHours(0, 0, 0, 0)

    const days = Math.round((normalizedDate.getTime() - normalizedStart.getTime()) / (1000 * 60 * 60 * 24))

    // Aplicar offset intra-dia se a tarefa for fornecida
    const intraDayOffset = task ? getIntraDayOffset(task) : 0

    return (days + intraDayOffset) * columnWidth + taskColumnWidth
  }

  // MAPEAMENTO RECURSIVO DE POSIÇÕES Y (copiado do componente antigo)
  // Se um mapa externo for fornecido, usar ele (para ordenação cronológica)
  const taskPositionMap = React.useMemo(() => {
    // Se foi passado um mapa externo, usar ele
    if (externalPositionMap) {
      return externalPositionMap
    }

    // Senão, calcular internamente (modo estrutural)
    const positionMap = new Map<string, number>()
    let currentRow = 0

    function mapTaskPositions(
      taskList: TaskWithDates[],
      parentId: string | null = null
    ): void {
      const relevantTasks = taskList
        .filter(t => t.parent_id === parentId)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

      relevantTasks.forEach(task => {
        // Mapear posição Y centrada na linha
        const yPosition = currentRow * rowHeight + rowHeight / 2
        positionMap.set(task.id, yPosition)

        currentRow++

        // Se tem subtarefas E está expandida
        const hasSubtasks = taskList.some(t => t.parent_id === task.id)
        if (hasSubtasks && expandedTasks.has(task.id)) {
          mapTaskPositions(taskList, task.id)
        }
      })
    }

    mapTaskPositions(tasks, null)

    return positionMap
  }, [tasks, rowHeight, expandedTasks, externalPositionMap])

  // Calcula posição Y de uma tarefa
  function getTaskY(taskId: string): number {
    return taskPositionMap.get(taskId) || 0
  }

  // Calcular duração em dias baseado em duration_days
  function getTaskDuration(task: TaskWithDates): number {
    return task.duration_days || 1
  }

  // Gerar path SVG com linhas retas (ângulos retos)
  function generatePath(
    fromTask: TaskWithDates,
    toTask: TaskWithDates,
    type: string
  ): string {
    const normalizedType = type === 'fim_inicio' ? 'FS' :
                          type === 'inicio_inicio' ? 'SS' :
                          type === 'fim_fim' ? 'FF' :
                          type === 'inicio_fim' ? 'SF' : type

    // Calcular X inicial e final baseado no tipo
    // ONDA 3: Usar data efetiva de fim (última alocação se fragmentada)
    const fromStartX = getDateX(fromTask.start_date, fromTask)
    const fromEffectiveEndDate = getEffectiveEndDate(fromTask)
    const fromEndX = getDateX(fromEffectiveEndDate, fromTask)

    const toStartX = getDateX(toTask.start_date, toTask)
    const toEffectiveEndDate = getEffectiveEndDate(toTask)
    const toEndX = getDateX(toEffectiveEndDate, toTask)

    const startX = (normalizedType === 'SS' || normalizedType === 'SF') ? fromStartX : fromEndX
    const endX = (normalizedType === 'FF' || normalizedType === 'SF') ? toEndX : toStartX

    const startY = getTaskY(fromTask.id)
    const endY = getTaskY(toTask.id)

    // Linha reta com ângulos retos (formato de escada)
    const midX = (startX + endX) / 2

    return `
      M ${startX} ${startY}
      L ${midX} ${startY}
      L ${midX} ${endY}
      L ${endX} ${endY}
    `
  }

  // Renderizar linhas
  const linesToRender = predecessors
    .map(pred => {
      const fromTask = tasks.find(t => t.id === pred.predecessor_id)
      const toTask = tasks.find(t => t.id === pred.task_id)

      if (!fromTask || !toTask) return null
      if (!taskPositionMap.has(fromTask.id) || !taskPositionMap.has(toTask.id)) return null

      // Verificar se há conflito
      const hasConflictFlag = hasConflict(fromTask, toTask, pred.type)

      return {
        pred,
        fromTask,
        toTask,
        path: generatePath(fromTask, toTask, pred.type),
        color: hasConflictFlag ? '#EF4444' : getPredecessorColor(pred.type), // Vermelho se conflito
        label: getShortLabel(pred.type),
        hasConflict: hasConflictFlag
      }
    })
    .filter(Boolean)

  if (linesToRender.length === 0) {
    return null
  }

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none"
      style={{
        width: '100%',
        height: '100%',
        zIndex: 15
      }}
    >
      <defs>
        {/* Marcadores de seta */}
        <marker
          id="arrow-blue"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="#3B82F6" />
        </marker>
        <marker
          id="arrow-green"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="#10B981" />
        </marker>
        <marker
          id="arrow-orange"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="#F59E0B" />
        </marker>
        <marker
          id="arrow-red"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="#EF4444" />
        </marker>
      </defs>

      {linesToRender.map(line => {
        if (!line) return null

        const isHovered = hoveredLine === line.pred.id

        const markerColor = line.color === '#3B82F6' ? 'blue' :
                           line.color === '#10B981' ? 'green' :
                           line.color === '#F59E0B' ? 'orange' : 'red'

        const fromY = getTaskY(line.fromTask.id)
        const toY = getTaskY(line.toTask.id)
        const fromStartX = getDateX(line.fromTask.start_date, line.fromTask)
        const fromEndX = fromStartX + (getTaskDuration(line.fromTask) * columnWidth)
        const toStartX = getDateX(line.toTask.start_date, line.toTask)
        const toEndX = toStartX + (getTaskDuration(line.toTask) * columnWidth)

        return (
          <g key={line.pred.id}>
            {/* Highlights das tarefas quando hover */}
            {isHovered && (
              <>
                {/* Highlight da tarefa FROM */}
                <rect
                  x={fromStartX}
                  y={fromY - rowHeight / 2}
                  width={fromEndX - fromStartX}
                  height={rowHeight}
                  fill={line.color}
                  opacity="0.15"
                  className="pointer-events-none"
                />
                {/* Highlight da tarefa TO */}
                <rect
                  x={toStartX}
                  y={toY - rowHeight / 2}
                  width={toEndX - toStartX}
                  height={rowHeight}
                  fill={line.color}
                  opacity="0.15"
                  className="pointer-events-none"
                />
              </>
            )}

            {/* Linha principal */}
            <path
              d={line.path}
              stroke={line.color}
              strokeWidth={line.hasConflict ? "3" : (isHovered ? "3" : "2")}
              strokeDasharray={line.hasConflict ? "5,5" : "none"}
              fill="none"
              markerEnd={`url(#arrow-${markerColor})`}
              className="transition-all duration-200"
              style={{ opacity: isHovered ? 1 : (line.hasConflict ? 0.9 : 0.8) }}
            />

            {/* Área interativa invisível */}
            <path
              d={line.path}
              stroke="transparent"
              strokeWidth="12"
              fill="none"
              className="pointer-events-auto cursor-pointer"
              onMouseEnter={() => setHoveredLine(line.pred.id)}
              onMouseLeave={() => setHoveredLine(null)}
            >
              <title>{`${line.fromTask.name} → ${line.toTask.name}`}</title>
            </path>

            {/* Badge no meio da linha */}
            <g
              transform={`translate(${(fromEndX + toStartX) / 2}, ${(fromY + toY) / 2})`}
              className="pointer-events-auto cursor-pointer"
              onMouseEnter={() => setHoveredLine(line.pred.id)}
              onMouseLeave={() => setHoveredLine(null)}
            >
              <rect
                x="-15"
                y="-10"
                width="30"
                height="20"
                rx="4"
                fill="white"
                stroke={line.color}
                strokeWidth={isHovered ? "2" : "1.5"}
                className="transition-all duration-200"
              />
              <text
                x="0"
                y="0"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="10"
                fontWeight="600"
                fill={line.color}
              >
                {line.label}
              </text>
            </g>

            {/* Labels das tarefas quando hover */}
            {isHovered && (
              <>
                {/* Label da tarefa FROM */}
                <text
                  x={fromStartX + 5}
                  y={fromY - rowHeight / 2 - 5}
                  fontSize="11"
                  fontWeight="600"
                  fill={line.color}
                  className="pointer-events-none"
                >
                  {line.fromTask.name}
                </text>
                {/* Label da tarefa TO */}
                <text
                  x={toStartX + 5}
                  y={toY - rowHeight / 2 - 5}
                  fontSize="11"
                  fontWeight="600"
                  fill={line.color}
                  className="pointer-events-none"
                >
                  {line.toTask.name}
                </text>
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}
