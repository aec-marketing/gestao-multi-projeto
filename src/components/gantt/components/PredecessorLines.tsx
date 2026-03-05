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
  onPredecessorClick?: (predecessor: Predecessor, fromTask: TaskWithDates, toTask: TaskWithDates) => void  // ONDA 5.7: Click para abrir menu de edição
  editingMode?: boolean  // ONDA 5.7: Se true, linhas são clicáveis
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
  onExpandTask,
  onPredecessorClick,
  editingMode = false
}: PredecessorLinesProps) {
  const [hoveredLine, setHoveredLine] = React.useState<string | null>(null)
  const [hoveredGroup, setHoveredGroup] = React.useState<string | null>(null)

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

  // Calcula posição X de uma data (borda esquerda do dia)
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

  // Calcula o X exato do fim visual da barra de uma tarefa,
  // levando em conta allocated_minutes / duration_minutes (pode ser fracionário)
  function getTaskBarEndX(task: TaskWithDates): number {
    const taskWithAlloc = task as TaskWithAllocations
    const allocations = (taskWithAlloc.allocations || []).filter(a => a.allocated_minutes && a.allocated_minutes > 0)

    if (allocations.length >= 1) {
      // Usar a última alocação (fragmentada ou não)
      const sorted = [...allocations].sort((a, b) =>
        new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      )
      const last = sorted[sorted.length - 1]
      const startX = getDateX(last.start_date)
      const durationDays = (last.allocated_minutes || 540) / 540
      return startX + durationDays * columnWidth
    }

    // Sem alocações: usar start_date + duration_minutes da tarefa
    const minutesPerDay = task.work_type === 'wait' ? 1440 : 540
    const durationDays = (task.duration_minutes ?? 540) / minutesPerDay
    const intraDayOffset = getIntraDayOffset(task)
    const normalizedStart = new Date(dateRange.minDate)
    normalizedStart.setHours(0, 0, 0, 0)
    const taskStart = new Date(parseDate(task.start_date))
    taskStart.setHours(0, 0, 0, 0)
    const dayIndex = Math.round((taskStart.getTime() - normalizedStart.getTime()) / (1000 * 60 * 60 * 24))
    return (dayIndex + intraDayOffset + durationDays) * columnWidth + taskColumnWidth
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

  // Gerar path SVG estilo MS Project — linha única (não-grupo)
  // trunkX: X do tronco vertical a usar (null = calcular automaticamente)
  function generatePath(
    fromTask: TaskWithDates,
    toTask: TaskWithDates,
    type: string,
    trunkX: number | null = null
  ): string {
    const normalizedType = type === 'fim_inicio' ? 'FS' :
                          type === 'inicio_inicio' ? 'SS' :
                          type === 'fim_fim' ? 'FF' :
                          type === 'inicio_fim' ? 'SF' : type

    const fromStartX = getDateX(fromTask.start_date, fromTask)
    const fromEndX   = getTaskBarEndX(fromTask)
    const toStartX   = getDateX(toTask.start_date, toTask)
    const toEndX     = getTaskBarEndX(toTask)

    const startX = (normalizedType === 'SS' || normalizedType === 'SF') ? fromStartX : fromEndX
    const endX   = (normalizedType === 'FF' || normalizedType === 'SF') ? toEndX     : toStartX

    const startY = getTaskY(fromTask.id)
    const endY   = getTaskY(toTask.id)

    // Gap mínimo de folga entre segmentos horizontais e barras
    const gap = 8
    // Metade da altura real da barra (40px fixo)
    const barHalf = 20

    // Se há um trunkX fornecido (modo fishbone), usar roteamento de haste
    if (trunkX !== null) {
      // Haste: startX → trunkX (horizontal na altura da origem) já foi desenhada no tronco
      // Aqui desenhamos apenas: trunkX → desce/sobe até endY → endX
      if (Math.abs(startY - endY) < 2) {
        // Mesma linha — haste direta
        return `M ${startX} ${startY} L ${endX} ${endY}`
      }
      return `M ${trunkX} ${startY} L ${trunkX} ${endY} L ${endX} ${endY}`
    }

    // CASO NORMAL: há espaço horizontal suficiente entre saída e entrada
    if (endX >= startX + gap) {
      const cornerX = endX - gap
      if (Math.abs(startY - endY) < 2) {
        return `M ${startX} ${startY} L ${endX} ${endY}`
      }
      return `M ${startX} ${startY} L ${cornerX} ${startY} L ${cornerX} ${endY} L ${endX} ${endY}`
    }

    // CASO CROWDED: destino começa antes ou muito próximo do fim do predecessor
    const stubX = startX + gap
    let routeY: number
    if (endY > startY) {
      routeY = startY + barHalf + gap
    } else {
      routeY = startY - barHalf - gap
    }
    const entryX = endX - gap

    return `
      M ${startX} ${startY}
      L ${stubX} ${startY}
      L ${stubX} ${routeY}
      L ${entryX} ${routeY}
      L ${entryX} ${endY}
      L ${endX} ${endY}
    `
  }

  // Renderizar linhas
  // Primeiro, coletar dados básicos de cada linha válida
  const rawLines = predecessors
    .map(pred => {
      const fromTask = tasks.find(t => t.id === pred.predecessor_id)
      const toTask = tasks.find(t => t.id === pred.task_id)

      if (!fromTask || !toTask) return null
      if (!taskPositionMap.has(fromTask.id) || !taskPositionMap.has(toTask.id)) return null

      const normalizedType = pred.type === 'fim_inicio' ? 'FS' :
                             pred.type === 'inicio_inicio' ? 'SS' :
                             pred.type === 'fim_fim' ? 'FF' :
                             pred.type === 'inicio_fim' ? 'SF' : pred.type

      // startX depende do tipo
      const startX = (normalizedType === 'SS' || normalizedType === 'SF')
        ? getDateX(fromTask.start_date, fromTask)
        : getTaskBarEndX(fromTask)

      const hasConflictFlag = hasConflict(fromTask, toTask, pred.type)

      return { pred, fromTask, toTask, normalizedType, startX, hasConflictFlag }
    })
    .filter(Boolean) as Array<{
      pred: Predecessor
      fromTask: TaskWithDates
      toTask: TaskWithDates
      normalizedType: string
      startX: number
      hasConflictFlag: boolean
    }>

  // Agrupar linhas por (fromTask.id + normalizedType) — mesmo ponto de saída
  // Grupos com 2+ membros usam roteamento fishbone (tronco compartilhado + hastes)
  const groups = new Map<string, typeof rawLines>()
  for (const item of rawLines) {
    const key = `${item.fromTask.id}_${item.normalizedType}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }

  // Para cada grupo, calcular o trunkX = mínimo dos endX do grupo - gap
  // (posiciona o tronco logo antes da barra mais à esquerda dos destinos)
  const linesToRender = rawLines.map(item => {
    const key = `${item.fromTask.id}_${item.normalizedType}`
    const group = groups.get(key)!
    const isGroup = group.length > 1

    let path: string
    let trunkPath: string | null = null

    if (isGroup) {
      // Calcular trunkX: fixo à esquerda de todos os destinos do grupo
      const gap = 8
      const endXValues = group.map(g => {
        const normalizedType = g.normalizedType
        return (normalizedType === 'FF' || normalizedType === 'SF')
          ? getTaskBarEndX(g.toTask)
          : getDateX(g.toTask.start_date, g.toTask)
      })
      const minEndX = Math.min(...endXValues)
      const trunkX = Math.min(item.startX + gap, minEndX - gap)

      const startY = getTaskY(item.fromTask.id)
      const endY   = getTaskY(item.toTask.id)
      const endX   = (item.normalizedType === 'FF' || item.normalizedType === 'SF')
        ? getTaskBarEndX(item.toTask)
        : getDateX(item.toTask.start_date, item.toTask)

      // Tronco vertical: apenas a primeira linha do grupo o desenha
      const isFirst = group[0] === item
      if (isFirst) {
        // Tronco vai desde startY até o endY mais extremo do grupo
        const allEndYs = group.map(g => getTaskY(g.toTask.id))
        const trunkStartY = startY
        const trunkEndY = endY > startY
          ? Math.max(...allEndYs)
          : Math.min(...allEndYs)
        // Linha horizontal de saída + tronco vertical
        trunkPath = `M ${item.startX} ${trunkStartY} L ${trunkX} ${trunkStartY} L ${trunkX} ${trunkEndY}`
      }

      // Haste individual: trunkX → endY → endX
      if (Math.abs(startY - endY) < 2) {
        path = `M ${trunkX} ${endY} L ${endX} ${endY}`
      } else {
        path = `M ${trunkX} ${endY} L ${endX} ${endY}`
      }
    } else {
      path = generatePath(item.fromTask, item.toTask, item.pred.type, null)
    }

    const endX = (item.normalizedType === 'FF' || item.normalizedType === 'SF')
      ? getTaskBarEndX(item.toTask)
      : getDateX(item.toTask.start_date, item.toTask)
    const endY = getTaskY(item.toTask.id)

    return {
      pred: item.pred,
      fromTask: item.fromTask,
      toTask: item.toTask,
      path,
      trunkPath,
      groupKey: key,
      endX,
      endY,
      color: item.hasConflictFlag ? '#EF4444' : getPredecessorColor(item.pred.type),
      label: getShortLabel(item.pred.type),
      hasConflict: item.hasConflictFlag
    }
  })

  if (linesToRender.length === 0) {
    return null
  }

  return (
    <svg
      className="absolute top-0 left-0"
      style={{
        width: '100%',
        height: '100%',
        zIndex: 30,  // ONDA 5.7: Aumentado para ficar acima das barras (z-index 20-29)
        pointerEvents: 'none'  // SVG não clicável, mas paths individuais serão
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

        // Uma linha está "hovered" se ela própria ou seu grupo está em hover
        const isHovered = hoveredLine === line.pred.id || hoveredGroup === line.groupKey

        const markerColor = line.color === '#3B82F6' ? 'blue' :
                           line.color === '#10B981' ? 'green' :
                           line.color === '#F59E0B' ? 'orange' : 'red'

        const fromY = getTaskY(line.fromTask.id)
        const toY = getTaskY(line.toTask.id)
        const fromStartX = getDateX(line.fromTask.start_date, line.fromTask)
        const toStartX = getDateX(line.toTask.start_date, line.toTask)

        // Badge fica ao lado da seta: logo após o ponto de chegada no destino
        const badgeX = line.endX + 18
        const badgeY = line.endY

        // Hover na haste/badge: destaca apenas esta linha
        const enterLine = () => setHoveredLine(line.pred.id)
        const leaveLine = () => setHoveredLine(null)

        return (
          <g key={line.pred.id}>

            {/* Tronco compartilhado (fishbone) — apenas a primeira linha do grupo o renderiza */}
            {line.trunkPath && (
              <>
                <path
                  d={line.trunkPath}
                  stroke={line.color}
                  strokeWidth={line.hasConflict ? "3" : (hoveredGroup === line.groupKey ? "3" : "2")}
                  strokeDasharray={line.hasConflict ? "5,5" : "none"}
                  fill="none"
                  className="pointer-events-none"
                  style={{ opacity: hoveredGroup === line.groupKey ? 1 : (line.hasConflict ? 0.9 : 0.8) }}
                />
                {/* Área interativa sobre o tronco */}
                <path
                  d={line.trunkPath}
                  stroke="transparent"
                  strokeWidth="12"
                  fill="none"
                  className={editingMode ? "pointer-events-auto cursor-pointer" : "pointer-events-none"}
                  onMouseEnter={editingMode ? () => setHoveredGroup(line.groupKey) : undefined}
                  onMouseLeave={editingMode ? () => setHoveredGroup(null) : undefined}
                />
              </>
            )}

            {/* Haste/Linha principal */}
            <path
              d={line.path}
              stroke={line.color}
              strokeWidth={line.hasConflict ? "3" : (isHovered ? "3" : "2")}
              strokeDasharray={line.hasConflict ? "5,5" : "none"}
              fill="none"
              markerEnd={`url(#arrow-${markerColor})`}
              className="transition-all duration-200 pointer-events-none"
              style={{ opacity: isHovered ? 1 : (line.hasConflict ? 0.9 : 0.8) }}
            />

            {/* Área interativa invisível sobre a haste */}
            <path
              d={line.path}
              stroke="transparent"
              strokeWidth="12"
              fill="none"
              className={editingMode ? "pointer-events-auto cursor-pointer hover:stroke-gray-200" : "pointer-events-none"}
              onMouseEnter={editingMode ? enterLine : undefined}
              onMouseLeave={editingMode ? leaveLine : undefined}
              onClick={editingMode ? (e) => {
                e.stopPropagation()
                onPredecessorClick?.(line.pred, line.fromTask, line.toTask)
              } : undefined}
            >
              {editingMode && <title>{`Clique para editar: ${line.fromTask.name} → ${line.toTask.name}`}</title>}
            </path>

            {/* Badge ao lado da seta (junto ao destino) */}
            <g
              transform={`translate(${badgeX}, ${badgeY})`}
              className={editingMode ? "pointer-events-auto cursor-pointer" : "pointer-events-none"}
              onMouseEnter={editingMode ? enterLine : undefined}
              onMouseLeave={editingMode ? leaveLine : undefined}
              onClick={editingMode ? (e) => {
                e.stopPropagation()
                onPredecessorClick?.(line.pred, line.fromTask, line.toTask)
              } : undefined}
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
