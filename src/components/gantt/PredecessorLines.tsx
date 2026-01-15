'use client'

import React from 'react'
import { Task } from '@/types/database.types'

interface Predecessor {
  id: string
  task_id: string
  predecessor_id: string
  type: string // 'fim_inicio' | 'inicio_inicio' | 'fim_fim'
  lag_time: number
}

interface PredecessorLinesProps {
  tasks: Task[]
  predecessors: Predecessor[]
  dateRange: { start: Date; end: Date }
  dayWidth: number
  rowHeight: number
  expandedTasks: Set<string>
  onExpandTasks?: (taskIds: string[]) => void // ← NOVO: Callback para expandir tarefas
}

export default function PredecessorLines({
  tasks,
  predecessors,
  dateRange,
  dayWidth,
  rowHeight,
  expandedTasks,
  onExpandTasks
}: PredecessorLinesProps) {
  const [hoveredLine, setHoveredLine] = React.useState<string | null>(null)
  const [hoveredBadge, setHoveredBadge] = React.useState<string | null>(null)

  // Converte tipo do banco para display
  // NOTA: 'inicio_fim' (SF - Start-to-Finish) não está implementado no database ENUM
  // mas mantemos aqui para compatibilidade com futuras versões
  const typeDisplay: Record<string, string> = {
    'fim_inicio': 'FS',
    'inicio_inicio': 'SS',
    'fim_fim': 'FF',
    'inicio_fim': 'SF' // Não implementado no banco - placeholder para futuro
  }

  // Gera descrição verbal da relação de predecessor
  function getVerbalDescription(fromTaskName: string, toTaskName: string, type: string, lagTime: number): string {
    const lagText = lagTime !== 0
      ? lagTime > 0
        ? ` com ${lagTime} dia${lagTime > 1 ? 's' : ''} de atraso`
        : ` com ${Math.abs(lagTime)} dia${Math.abs(lagTime) > 1 ? 's' : ''} de antecedência`
      : ''

    switch (type) {
      case 'fim_inicio':
        return `"${toTaskName}" começará depois do término de "${fromTaskName}"${lagText}.`

      case 'inicio_inicio':
        return `"${toTaskName}" começará ao mesmo tempo que "${fromTaskName}"${lagText}.`

      case 'fim_fim':
        return `"${toTaskName}" terminará ao mesmo tempo que "${fromTaskName}"${lagText}.`

      case 'inicio_fim':
        return `"${toTaskName}" terminará quando "${fromTaskName}" começar${lagText}.`

      default:
        return `"${toTaskName}" depende de "${fromTaskName}".`
    }
  }

  // Cores por tipo de predecessor
  function getPredecessorColor(type: string, isHovered: boolean = false): string {
    const colors: Record<string, { normal: string; hover: string }> = {
      'fim_inicio': { normal: '#3B82F6', hover: '#1E40AF' },      // Azul (padrão FS)
      'inicio_inicio': { normal: '#10B981', hover: '#047857' },   // Verde (SS)
      'fim_fim': { normal: '#F59E0B', hover: '#D97706' },         // Laranja (FF)
      'inicio_fim': { normal: '#EF4444', hover: '#B91C1C' }       // Vermelho (SF - raro)
    }
    const colorSet = colors[type] || colors['fim_inicio']
    return isHovered ? colorSet.hover : colorSet.normal
  }

  // Detectar se predecessor cria conflito (tarefa filho antes do pai)
  function isConflicted(pred: Predecessor): boolean {
    const fromTask = tasks.find(t => t.id === pred.predecessor_id)
    const toTask = tasks.find(t => t.id === pred.task_id)

    if (!fromTask?.end_date || !toTask?.start_date) return false

    return new Date(toTask.start_date) < new Date(fromTask.end_date)
  }

  // Parse seguro de data string para evitar problemas de timezone
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

  // Calcula posição X de uma data baseado no dateRange
  function getDateX(date: Date | string | null): number {
    if (!date) return 0
    const dateObj = parseDate(date)

    const normalizedDate = new Date(dateObj)
    normalizedDate.setHours(0, 0, 0, 0)

    const normalizedStart = new Date(dateRange.start)
    normalizedStart.setHours(0, 0, 0, 0)

    const days = Math.round((normalizedDate.getTime() - normalizedStart.getTime()) / (1000 * 60 * 60 * 24))

    // +320 para compensar a coluna de nomes (w-80 = 320px) — mantenha se for o mesmo layout
    return days * dayWidth + 320
  }

  // ========== MAPEAMENTO RECURSIVO DE POSIÇÕES Y ==========
  // Simula a renderização real das tarefas para mapear a posição Y correta
  // IMPORTANTE: Usar useMemo para evitar recalcular durante drag operations
  const { taskPositionMap, totalRows } = React.useMemo(() => {
    const positionMap = new Map<string, number>()
    let currentRow = 0

    /**
     * Mapeia posições Y de TODAS as tarefas considerando:
     * - Hierarquia completa (níveis ilimitados)
     * - Estado de expansão (expandedTasks)
     * - Ordem de renderização real
     */
    function mapTaskPositions(
      taskList: Task[],
      parentId: string | null = null,
      currentLevel: number = 0
    ): void {
      // Filtrar tarefas deste nível
      const relevantTasks = taskList
        .filter(t => t.parent_id === parentId)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

      relevantTasks.forEach(task => {
        // Mapear posição Y da tarefa atual (centrado na linha)
        const yPosition = currentRow * rowHeight + rowHeight / 2
        positionMap.set(task.id, yPosition)

        currentRow++ // Incrementar para próxima linha

        // Verificar se tem subtarefas
        const hasSubtasks = taskList.some(t => t.parent_id === task.id)

        // Se tem subtarefas E está expandida → mapear subtarefas recursivamente
        if (hasSubtasks && expandedTasks.has(task.id)) {
          mapTaskPositions(taskList, task.id, currentLevel + 1) // RECURSÃO
        }
      })
    }

    // Iniciar mapeamento das tarefas raiz (nível 1)
    mapTaskPositions(tasks, null, 0)

    return { taskPositionMap: positionMap, totalRows: currentRow }
  }, [tasks, rowHeight, expandedTasks])

  // Calcula posição Y de uma tarefa usando o mapeamento
  function getTaskY(taskId: string): number {
    return taskPositionMap.get(taskId) || 0
  }
  // ========== FIM MAPEAMENTO ==========

  // ========== NOVO: LÓGICA DE REPRESENTAÇÃO POR PAIS ==========

  /**
   * Encontra o representante visual de uma tarefa
   * Se a tarefa está visível, retorna ela mesma
   * Se está colapsada (dentro de um pai não expandido), retorna o pai
   */
  function getVisualRepresentative(taskId: string): string {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return taskId

    // Se a tarefa está no mapa de posições, ela está visível
    if (taskPositionMap.has(taskId)) {
      return taskId
    }

    // Se não está visível, procurar o pai que está visível
    let currentTask = task
    while (currentTask.parent_id) {
      const parent = tasks.find(t => t.id === currentTask.parent_id)
      if (!parent) break

      // Se o pai está visível, ele é o representante
      if (taskPositionMap.has(parent.id)) {
        return parent.id
      }

      currentTask = parent
    }

    // Fallback: retornar a própria tarefa
    return taskId
  }

  /**
   * Verifica se uma tarefa está representando predecessores de subtarefas
   * Retorna um mapa: taskId -> array de predecessor relations que está representando
   */
  const representationMap = new Map<string, Array<{
    pred: Predecessor
    fromTaskId: string
    toTaskId: string
  }>>()

  // Processar todos os predecessors para identificar quais pais estão representando
  predecessors.forEach(pred => {
    const fromTask = tasks.find(t => t.id === pred.predecessor_id)
    const toTask = tasks.find(t => t.id === pred.task_id)

    if (!fromTask || !toTask) return

    // Encontrar representantes visuais
    const fromRep = getVisualRepresentative(pred.predecessor_id)
    const toRep = getVisualRepresentative(pred.task_id)

    // Se o representante FROM é diferente da tarefa original (está representando)
    if (fromRep !== pred.predecessor_id) {
      if (!representationMap.has(fromRep)) {
        representationMap.set(fromRep, [])
      }
      representationMap.get(fromRep)!.push({
        pred,
        fromTaskId: pred.predecessor_id,
        toTaskId: pred.task_id
      })
    }

    // Se o representante TO é diferente da tarefa original (está representando)
    if (toRep !== pred.task_id) {
      if (!representationMap.has(toRep)) {
        representationMap.set(toRep, [])
      }
      representationMap.get(toRep)!.push({
        pred,
        fromTaskId: pred.predecessor_id,
        toTaskId: pred.task_id
      })
    }
  })

  /**
   * Expande todos os envolvidos em uma representação
   */
  function expandRepresentation(representativeTaskId: string) {
    const representations = representationMap.get(representativeTaskId)
    if (!representations || !onExpandTasks) return

    const tasksToExpand = new Set<string>()

    // Adicionar o próprio representante
    tasksToExpand.add(representativeTaskId)

    // Para cada predecessor que está sendo representado
    representations.forEach(({ fromTaskId, toTaskId }) => {
      // Expandir todos os pais do fromTask
      let currentTask = tasks.find(t => t.id === fromTaskId)
      while (currentTask?.parent_id) {
        tasksToExpand.add(currentTask.parent_id)
        currentTask = tasks.find(t => t.id === currentTask!.parent_id)
      }

      // Expandir todos os pais do toTask
      currentTask = tasks.find(t => t.id === toTaskId)
      while (currentTask?.parent_id) {
        tasksToExpand.add(currentTask.parent_id)
        currentTask = tasks.find(t => t.id === currentTask!.parent_id)
      }
    })

    onExpandTasks(Array.from(tasksToExpand))
  }

  // ========== FIM NOVO ==========

  // ========== NOVO: Calcular offset para múltiplas linhas entre mesmas tarefas ==========
  /**
   * Agrupa predecessores por par de tarefas (from -> to) e calcula offset vertical
   * para evitar sobreposição visual
   * IMPORTANTE: Deve vir DEPOIS do mapeamento de posições (taskPositionMap)
   */
  const predecessorOffsets = React.useMemo(() => {
    const offsetMap = new Map<string, number>()
    const groupedByPair = new Map<string, Predecessor[]>()

    // Agrupar predecessores por par de tarefas
    predecessors.forEach(pred => {
      const fromRep = getVisualRepresentative(pred.predecessor_id)
      const toRep = getVisualRepresentative(pred.task_id)
      const pairKey = `${fromRep}->${toRep}`

      if (!groupedByPair.has(pairKey)) {
        groupedByPair.set(pairKey, [])
      }
      groupedByPair.get(pairKey)!.push(pred)
    })

    // Calcular offset para cada predecessor
    groupedByPair.forEach((preds, pairKey) => {
      if (preds.length === 1) {
        // Apenas 1 linha: sem offset
        offsetMap.set(preds[0].id, 0)
      } else {
        // Múltiplas linhas: distribuir verticalmente
        const totalOffset = (preds.length - 1) * 10 // 10px entre cada linha
        const startOffset = -totalOffset / 2 // Centralizar em torno da linha base

        preds.forEach((pred, index) => {
          offsetMap.set(pred.id, startOffset + (index * 10))
        })
      }
    })

    return offsetMap
  }, [predecessors, tasks, expandedTasks, taskPositionMap])

  function getLineOffset(predId: string): number {
    return predecessorOffsets.get(predId) || 0
  }
  // ========== FIM NOVO ==========

  // Calcula a duração visual de uma tarefa (em dias)
  function getTaskDuration(task: Task): number {
    if (!task.start_date || !task.end_date) return task.duration || 1

    const start = parseDate(task.start_date)
    const end = parseDate(task.end_date)

    const taskDuration = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)

    return taskDuration
  }

  // ========== MEMOIZAÇÃO DE PATHS ==========
  // Calcular paths de forma estável para evitar recalculos desnecessários
  const predecessorPaths = React.useMemo(() => {
    const pathMap = new Map<string, {
      path: string
      x1: number
      y1: number
      x2: number
      y2: number
      midX: number
      midY: number
      arrowPoints: string
      color: string
      strokeDasharray: string
      fromTask: Task | undefined
      toTask: Task | undefined
    }>()

    predecessors.forEach(pred => {
      const fromTask = tasks.find(t => t.id === pred.predecessor_id)
      const toTask = tasks.find(t => t.id === pred.task_id)

      if (!fromTask || !toTask || !fromTask.start_date || !toTask.start_date) {
        return
      }

      // Usar representantes visuais
      const fromRepId = getVisualRepresentative(pred.predecessor_id)
      const toRepId = getVisualRepresentative(pred.task_id)

      // Se algum representante não está visível, não desenhar
      if (!taskPositionMap.has(fromRepId) || !taskPositionMap.has(toRepId)) {
        return
      }

      const fromRepTask = tasks.find(t => t.id === fromRepId)
      const toRepTask = tasks.find(t => t.id === toRepId)

      if (!fromRepTask || !toRepTask || !fromRepTask.start_date || !toRepTask.start_date) {
        return
      }

      const type = pred.type
      const conflicted = isConflicted(pred)
      const color = conflicted ? '#EF4444' : getPredecessorColor(type, false)

      // Pontos de conexão baseados no tipo
      let x1: number, x2: number

      if (type === 'fim_inicio') {
        const fromStart = getDateX(fromRepTask.start_date)
        const fromDuration = getTaskDuration(fromRepTask)
        x1 = fromStart + (fromDuration * dayWidth)
        x2 = getDateX(toRepTask.start_date)

      } else if (type === 'inicio_inicio') {
        x1 = getDateX(fromRepTask.start_date)
        x2 = getDateX(toRepTask.start_date)

      } else if (type === 'fim_fim') {
        const fromStart = getDateX(fromRepTask.start_date)
        const fromDuration = getTaskDuration(fromRepTask)
        x1 = fromStart + (fromDuration * dayWidth)

        const toStart = getDateX(toRepTask.start_date)
        const toDuration = getTaskDuration(toRepTask)
        x2 = toStart + (toDuration * dayWidth)

      } else { // inicio_fim
        x1 = getDateX(fromRepTask.start_date)
        const toStart = getDateX(toRepTask.start_date)
        const toDuration = getTaskDuration(toRepTask)
        x2 = toStart + (toDuration * dayWidth)
      }

      // Usar posições Y dos representantes + offset para múltiplas linhas
      const baseY1 = getTaskY(fromRepId)
      const baseY2 = getTaskY(toRepId)
      const offset = getLineOffset(pred.id)
      const y1 = baseY1 + offset
      const y2 = baseY2 + offset

      const midX = (x1 + x2) / 2
      const midY = (y1 + y2) / 2

      // Cálculo de path
      const horizontalSegmentLength = Math.abs(x2 - x1) * 0.3
      const path = x2 > x1
        ? `M ${x1},${y1} L ${x1 + horizontalSegmentLength},${y1} L ${x1 + horizontalSegmentLength},${y2} L ${x2},${y2}`
        : `M ${x1},${y1} L ${x1 - horizontalSegmentLength},${y1} L ${x1 - horizontalSegmentLength},${y2} L ${x2},${y2}`

      const strokeDasharray = conflicted
        ? '5,5'
        : type === 'inicio_inicio' ? '5,5'
        : type === 'fim_fim' ? '2,2'
        : type === 'inicio_fim' ? '3,3'
        : 'none'

      const arrowDirection = x2 > x1 ? 'right' : 'left'
      const arrowPoints = arrowDirection === 'right'
        ? `${x2},${y2} ${x2-8},${y2-4} ${x2-8},${y2+4}`
        : `${x2},${y2} ${x2+8},${y2-4} ${x2+8},${y2+4}`

      pathMap.set(pred.id, {
        path,
        x1,
        y1,
        x2,
        y2,
        midX,
        midY,
        arrowPoints,
        color,
        strokeDasharray,
        fromTask,
        toTask
      })
    })

    return pathMap
  }, [predecessors, tasks, taskPositionMap, predecessorOffsets, dayWidth])
  // ========== FIM MEMOIZAÇÃO ==========

  // Desenha linha com seta usando dados memoizados
  function drawLine(pred: Predecessor) {
    // Buscar path pré-calculado
    const pathData = predecessorPaths.get(pred.id)
    if (!pathData) return null

    const { path, x1, y1, x2, y2, midX, midY, arrowPoints, color, strokeDasharray } = pathData
    const isHovered = hoveredLine === pred.id
    const displayColor = isHovered ? getPredecessorColor(pred.type, true) : color

    return (
      <g key={pred.id}>
        {/* Linha interativa com área clicável APENAS no path (não retangular) */}
        <path
          d={path}
          stroke="transparent"
          strokeWidth="12"
          fill="none"
          className="cursor-pointer"
          onMouseEnter={() => setHoveredLine(pred.id)}
          onMouseLeave={() => setHoveredLine(null)}
          style={{
            pointerEvents: 'stroke', // CRÍTICO: apenas o stroke é clicável, não toda a área
            vectorEffect: 'non-scaling-stroke'
          }}
        />

        {/* Linha visual */}
        <path
          d={path}
          stroke={displayColor}
          strokeWidth={isHovered ? '3' : '2'}
          strokeDasharray={strokeDasharray}
          fill="none"
          opacity={isHovered ? '0.9' : '0.7'}
          className="transition-all"
          style={{ pointerEvents: 'none' }}
        />

        {/* Seta */}
        <polygon
          points={arrowPoints}
          fill={displayColor}
          opacity={isHovered ? '0.9' : '0.7'}
          className="transition-all"
          style={{ pointerEvents: 'none' }}
        />

        {/* Badge do tipo */}
        <text
          x={midX}
          y={y1 - 5}
          fontSize="10"
          fill={displayColor}
          textAnchor="middle"
          fontWeight="bold"
          opacity={isHovered ? '1' : '0.8'}
          className="transition-all"
          style={{ pointerEvents: 'none' }}
        >
          {typeDisplay[pred.type]}
        </text>
      </g>
    )
  }

  const totalHeight = totalRows * rowHeight

  // ========== NOVO: Renderizar badges de representação ==========
  function renderRepresentationBadges() {
    const badges: JSX.Element[] = []

    // Agrupar badges por coluna (mesma posição X) para evitar sobreposição
    const badgesByColumn = new Map<number, Array<{ taskId: string; representations: any[]; task: any }>>()

    representationMap.forEach((representations, taskId) => {
      if (representations.length === 0) return
      if (!taskPositionMap.has(taskId)) return // Tarefa não visível

      const task = tasks.find(t => t.id === taskId)
      if (!task || !task.start_date) return

      const xPosition = getDateX(task.start_date)
      const columnKey = Math.round(xPosition / dayWidth) // Agrupar por dia

      if (!badgesByColumn.has(columnKey)) {
        badgesByColumn.set(columnKey, [])
      }
      badgesByColumn.get(columnKey)!.push({ taskId, representations, task })
    })

    // Renderizar badges com offset horizontal se múltiplas na mesma coluna
    badgesByColumn.forEach((columnBadges, columnKey) => {
      columnBadges.forEach((badgeInfo, indexInColumn) => {
        const { taskId, representations, task } = badgeInfo

        const yPosition = getTaskY(taskId)
        const xPosition = getDateX(task.start_date)

        // Offset horizontal se múltiplas badges na mesma coluna
        const horizontalOffset = columnBadges.length > 1 ? indexInColumn * 30 : 0
        const badgeX = xPosition + 10 + horizontalOffset
        const badgeY = yPosition - 20

        const count = representations.length
        const isHovered = hoveredBadge === taskId

        badges.push(
          <g key={`badge-${taskId}`}>
          {/* Círculo da badge */}
          <circle
            cx={badgeX}
            cy={badgeY}
            r={isHovered ? 14 : 12}
            fill={isHovered ? '#2563EB' : '#3B82F6'}
            stroke="white"
            strokeWidth="2"
            className="cursor-pointer transition-all"
            style={{ pointerEvents: 'all' }}
            onClick={() => expandRepresentation(taskId)}
            onMouseEnter={() => setHoveredBadge(taskId)}
            onMouseLeave={() => setHoveredBadge(null)}
          />

          {/* Número de predecessores representados */}
          <text
            x={badgeX}
            y={badgeY + 1}
            fontSize={isHovered ? '11' : '10'}
            fill="white"
            textAnchor="middle"
            dominantBaseline="middle"
            fontWeight="bold"
            className="cursor-pointer transition-all"
            style={{ pointerEvents: 'none' }}
          >
            {count}
          </text>

          {/* Tooltip da badge */}
          {isHovered && (
            <foreignObject
              x={badgeX - 100}
              y={badgeY - 60}
              width="200"
              height="50"
              style={{ pointerEvents: 'none' }}
            >
              <div
                className="bg-blue-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg border border-blue-700"
                style={{
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  lineHeight: '1.4'
                }}
              >
                <div className="font-semibold mb-1">
                  📊 {count} dependência{count > 1 ? 's' : ''} representada{count > 1 ? 's' : ''}
                </div>
                <div className="text-blue-200 text-[10px]">
                  Clique para expandir todos
                </div>
              </div>
            </foreignObject>
          )}

            {/* Título nativo para fallback */}
            <title>
              {count} dependência{count > 1 ? 's' : ''} representada{count > 1 ? 's' : ''}. Clique para expandir.
            </title>
          </g>
        )
      })
    })

    return badges
  }
  // ========== FIM NOVO ==========

  // Buscar informações da linha com hover
  const hoveredPredecessor = hoveredLine ? predecessors.find(p => p.id === hoveredLine) : null
  const hoveredFromTask = hoveredPredecessor ? tasks.find(t => t.id === hoveredPredecessor.predecessor_id) : null
  const hoveredToTask = hoveredPredecessor ? tasks.find(t => t.id === hoveredPredecessor.task_id) : null

  return (
    <>
      <svg
        className="absolute top-0 left-0 pointer-events-none z-20"
        style={{
          width: '100%',
          height: totalHeight,
          left: 0,
          top: 0,
          filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))'
        }}
      >
        {/* Linhas de predecessores */}
        {predecessors.map(pred => drawLine(pred))}

        {/* Badges de representação */}
        {renderRepresentationBadges()}
      </svg>

      {/* Painel de informações fixo - canto superior direito */}
      {hoveredLine && hoveredPredecessor && hoveredFromTask && hoveredToTask && (
        <div
          className="fixed top-20 right-6 bg-gray-900 text-white rounded-lg shadow-2xl border border-gray-700 p-4 z-50 pointer-events-none"
          style={{
            width: '280px',
            maxWidth: '90vw',
            animation: 'fadeIn 0.15s ease-in'
          }}
        >
          <style jsx>{`
            @keyframes fadeIn {
              from {
                opacity: 0;
                transform: translateY(-10px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>

          {/* Header */}
          <div className="flex items-start gap-2 mb-3 pb-3 border-b border-gray-700">
            <div className="flex-shrink-0 mt-0.5">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: getPredecessorColor(hoveredPredecessor.type, false)
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-400 mb-1">Dependência {typeDisplay[hoveredPredecessor.type]}</div>
              <div className="font-semibold text-sm leading-tight break-words">
                {hoveredFromTask.name}
              </div>
              <div className="text-gray-400 text-xs my-1">→</div>
              <div className="font-semibold text-sm leading-tight break-words">
                {hoveredToTask.name}
              </div>
            </div>
          </div>

          {/* Descrição verbal */}
          <div className="mb-3 pb-3 border-b border-gray-700">
            <div className="text-xs text-gray-300 leading-relaxed italic">
              {getVerbalDescription(
                hoveredFromTask.name,
                hoveredToTask.name,
                hoveredPredecessor.type,
                hoveredPredecessor.lag_time || 0
              )}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2 text-xs">
            {/* Informações de datas */}
            <div className="bg-gray-800 rounded p-2 space-y-1.5">
              <div className="text-gray-400 text-[10px] uppercase tracking-wide mb-1">Predecessor</div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Início:</span>
                <span className="font-medium">
                  {hoveredFromTask.start_date
                    ? new Date(hoveredFromTask.start_date).toLocaleDateString('pt-BR')
                    : 'Não definido'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Término:</span>
                <span className="font-medium">
                  {hoveredFromTask.end_date
                    ? new Date(hoveredFromTask.end_date).toLocaleDateString('pt-BR')
                    : 'Não definido'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Duração:</span>
                <span className="font-medium">{hoveredFromTask.duration || 0} dias</span>
              </div>
            </div>

            <div className="bg-gray-800 rounded p-2 space-y-1.5">
              <div className="text-gray-400 text-[10px] uppercase tracking-wide mb-1">Sucessor</div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Início:</span>
                <span className="font-medium">
                  {hoveredToTask.start_date
                    ? new Date(hoveredToTask.start_date).toLocaleDateString('pt-BR')
                    : 'Não definido'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Término:</span>
                <span className="font-medium">
                  {hoveredToTask.end_date
                    ? new Date(hoveredToTask.end_date).toLocaleDateString('pt-BR')
                    : 'Não definido'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Duração:</span>
                <span className="font-medium">{hoveredToTask.duration || 0} dias</span>
              </div>
            </div>

            {/* Informações da relação */}
            <div className="pt-2 border-t border-gray-700 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Tipo:</span>
                <span className="font-medium">{typeDisplay[hoveredPredecessor.type]}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400">Lag:</span>
                <span className="font-medium">
                  {hoveredPredecessor.lag_time > 0 && '+'}
                  {hoveredPredecessor.lag_time || 0} dias
                </span>
              </div>

              {/* Calcular diferença entre as tarefas */}
              {(() => {
                if (!hoveredFromTask.end_date || !hoveredToTask.start_date) return null

                const fromEnd = new Date(hoveredFromTask.end_date)
                const toStart = new Date(hoveredToTask.start_date)
                const diffTime = toStart.getTime() - fromEnd.getTime()
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

                return (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Intervalo:</span>
                    <span className={`font-medium ${diffDays < 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {diffDays > 0 && '+'}
                      {diffDays} dias
                    </span>
                  </div>
                )
              })()}
            </div>

            {(() => {
              const fromRep = getVisualRepresentative(hoveredPredecessor.predecessor_id)
              const toRep = getVisualRepresentative(hoveredPredecessor.task_id)
              const isRepresented = fromRep !== hoveredPredecessor.predecessor_id || toRep !== hoveredPredecessor.task_id

              if (isRepresented) {
                return (
                  <div className="mt-2 pt-2 border-t border-gray-700">
                    <div className="flex items-center gap-1.5 text-yellow-400">
                      <span>📊</span>
                      <span className="text-[10px]">Representado por tarefas pai</span>
                    </div>
                  </div>
                )
              }
              return null
            })()}

            {isConflicted(hoveredPredecessor) && (
              <div className="mt-2 pt-2 border-t border-gray-700">
                <div className="flex items-start gap-1.5 text-red-400">
                  <span className="flex-shrink-0">⚠️</span>
                  <span className="text-[10px] leading-tight">
                    Conflito: Tarefa inicia antes do predecessor terminar
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
