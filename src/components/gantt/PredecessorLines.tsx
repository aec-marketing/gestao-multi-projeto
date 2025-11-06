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
  const typeDisplay: Record<string, string> = {
    'fim_inicio': 'FS',
    'inicio_inicio': 'SS',
    'fim_fim': 'FF',
    'inicio_fim': 'SF'
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
  const taskPositionMap = new Map<string, number>()
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
      taskPositionMap.set(task.id, yPosition)

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

  // Calcula a duração visual de uma tarefa (em dias)
  function getTaskDuration(task: Task): number {
    if (!task.start_date || !task.end_date) return task.duration || 1

    const start = parseDate(task.start_date)
    const end = parseDate(task.end_date)

    const taskDuration = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)

    return taskDuration
  }

  // Desenha linha com seta
  function drawLine(pred: Predecessor) {
    const fromTask = tasks.find(t => t.id === pred.predecessor_id)
    const toTask = tasks.find(t => t.id === pred.task_id)

    if (!fromTask || !toTask || !fromTask.start_date || !toTask.start_date) {
      return null
    }

    // ========== MODIFICADO: Usar representantes visuais ==========
    // Encontrar quem vai representar visualmente cada tarefa
    const fromRepId = getVisualRepresentative(pred.predecessor_id)
    const toRepId = getVisualRepresentative(pred.task_id)

    // Se algum representante não está visível, não desenhar
    if (!taskPositionMap.has(fromRepId) || !taskPositionMap.has(toRepId)) {
      return null
    }

    // Buscar as tarefas representantes
    const fromRepTask = tasks.find(t => t.id === fromRepId)
    const toRepTask = tasks.find(t => t.id === toRepId)

    if (!fromRepTask || !toRepTask || !fromRepTask.start_date || !toRepTask.start_date) {
      return null
    }
    // ========== FIM MODIFICADO ==========

    const type = pred.type
    const isHovered = hoveredLine === pred.id
    const conflicted = isConflicted(pred)
    const color = conflicted ? '#EF4444' : getPredecessorColor(type, isHovered)

    // ========== MODIFICADO: Usar tarefas representantes para posição ==========
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

    // Usar posições Y dos representantes
    const y1 = getTaskY(fromRepId)
    const y2 = getTaskY(toRepId)
    // ========== FIM MODIFICADO ==========

    const midX = (x1 + x2) / 2
    const midY = (y1 + y2) / 2
    const path = `M ${x1},${y1} L ${midX},${y1} L ${midX},${y2} L ${x2},${y2}`

    const strokeDasharray = conflicted
      ? '5,5'
      : type === 'inicio_inicio' ? '5,5'
      : type === 'fim_fim' ? '2,2'
      : 'none'

    const arrowDirection = x2 > x1 ? 'right' : 'left'
    const arrowPoints = arrowDirection === 'right'
      ? `${x2},${y2} ${x2-8},${y2-4} ${x2-8},${y2+4}`
      : `${x2},${y2} ${x2+8},${y2-4} ${x2+8},${y2+4}`

    return (
      <g key={pred.id}>
        {/* Linha interativa com área clicável maior */}
        <path
          d={path}
          stroke="transparent"
          strokeWidth="10"
          fill="none"
          className="cursor-pointer"
          onMouseEnter={() => setHoveredLine(pred.id)}
          onMouseLeave={() => setHoveredLine(null)}
          style={{ pointerEvents: 'all' }}
        />

        {/* Linha visual */}
        <path
          d={path}
          stroke={color}
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
          fill={color}
          opacity={isHovered ? '0.9' : '0.7'}
          className="transition-all"
          style={{ pointerEvents: 'none' }}
        />

        {/* Badge do tipo */}
        <text
          x={midX}
          y={y1 - 5}
          fontSize="10"
          fill={color}
          textAnchor="middle"
          fontWeight="bold"
          opacity={isHovered ? '1' : '0.8'}
          className="transition-all"
          style={{ pointerEvents: 'none' }}
        >
          {typeDisplay[type]}
        </text>

        {/* Tooltip ao hover */}
        {isHovered && (
          <foreignObject
            x={midX - 100}
            y={midY - 40}
            width="200"
            height="80"
            style={{ pointerEvents: 'none' }}
          >
            <div
              className="bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg border border-gray-700"
              style={{
                fontFamily: 'system-ui, -apple-system, sans-serif',
                lineHeight: '1.4'
              }}
            >
              <div className="font-semibold mb-1">
                {fromTask.name} → {toTask.name}
              </div>
              <div className="text-gray-300">
                Tipo: {typeDisplay[type]} | Lag: {pred.lag_time || 0} dias
              </div>
              {(fromRepId !== pred.predecessor_id || toRepId !== pred.task_id) && (
                <div className="text-yellow-400 mt-1 text-[10px]">
                  📊 Representado por pais
                </div>
              )}
              {conflicted && (
                <div className="text-red-400 mt-1">
                  ⚠️ Conflito detectado!
                </div>
              )}
            </div>
          </foreignObject>
        )}

        {/* Título nativo para fallback */}
        <title>
          {fromTask.name} → {toTask.name}
          {'\n'}Tipo: {typeDisplay[type]}
          {pred.lag_time !== 0 && `\nLag: ${pred.lag_time > 0 ? '+' : ''}${pred.lag_time} dias`}
          {conflicted && '\n⚠️ CONFLITO: Data de início antes do fim do predecessor'}
        </title>
      </g>
    )
  }

  const totalHeight = currentRow * rowHeight

  // ========== NOVO: Renderizar badges de representação ==========
  function renderRepresentationBadges() {
    const badges: JSX.Element[] = []

    representationMap.forEach((representations, taskId) => {
      if (representations.length === 0) return
      if (!taskPositionMap.has(taskId)) return // Tarefa não visível

      const task = tasks.find(t => t.id === taskId)
      if (!task || !task.start_date) return

      const yPosition = getTaskY(taskId)
      const xPosition = getDateX(task.start_date)

      // Posicionar badge no canto superior direito da barra
      const badgeX = xPosition + 10
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

    return badges
  }
  // ========== FIM NOVO ==========

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none z-10"
      style={{
        width: '100%',
        height: totalHeight,
        left: 0,
        top: 0
      }}
    >
      {/* Linhas de predecessores */}
      {predecessors.map(pred => drawLine(pred))}

      {/* Badges de representação */}
      {renderRepresentationBadges()}
    </svg>
  )
}
