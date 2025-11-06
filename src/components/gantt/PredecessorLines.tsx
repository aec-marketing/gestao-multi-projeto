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
}

export default function PredecessorLines({
  tasks,
  predecessors,
  dateRange,
  dayWidth,
  rowHeight,
  expandedTasks
}: PredecessorLinesProps) {
  const [hoveredLine, setHoveredLine] = React.useState<string | null>(null)

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

    // ========== NOVO: Verificar se ambas as tarefas estão visíveis ==========
    // Se qualquer uma das tarefas não estiver no mapa de posições (está colapsada),
    // não desenhar a linha para evitar linhas apontando para lugares incorretos
    const fromTaskVisible = taskPositionMap.has(pred.predecessor_id)
    const toTaskVisible = taskPositionMap.has(pred.task_id)

    if (!fromTaskVisible || !toTaskVisible) {
      // Uma ou ambas as tarefas estão ocultas (dentro de grupo colapsado)
      return null
    }
    // ========== FIM NOVO ==========

    const type = pred.type
    const isHovered = hoveredLine === pred.id
    const conflicted = isConflicted(pred)
    const color = conflicted ? '#EF4444' : getPredecessorColor(type, isHovered)

    // Pontos de conexão baseados no tipo
    let x1: number, x2: number

    if (type === 'fim_inicio') {
      const fromStart = getDateX(fromTask.start_date)
      const fromDuration = getTaskDuration(fromTask)
      x1 = fromStart + (fromDuration * dayWidth)
      x2 = getDateX(toTask.start_date)

    } else if (type === 'inicio_inicio') {
      x1 = getDateX(fromTask.start_date)
      x2 = getDateX(toTask.start_date)

    } else if (type === 'fim_fim') {
      const fromStart = getDateX(fromTask.start_date)
      const fromDuration = getTaskDuration(fromTask)
      x1 = fromStart + (fromDuration * dayWidth)

      const toStart = getDateX(toTask.start_date)
      const toDuration = getTaskDuration(toTask)
      x2 = toStart + (toDuration * dayWidth)

    } else { // inicio_fim
      x1 = getDateX(fromTask.start_date)
      const toStart = getDateX(toTask.start_date)
      const toDuration = getTaskDuration(toTask)
      x2 = toStart + (toDuration * dayWidth)
    }

    const y1 = getTaskY(pred.predecessor_id)
    const y2 = getTaskY(pred.task_id)

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
            height="60"
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
      {predecessors.map(pred => drawLine(pred))}
    </svg>
  )
}
