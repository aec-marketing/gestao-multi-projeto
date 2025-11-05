'use client'

import { Task } from '@/types/database.types'

interface Predecessor {
  id: string
  task_id: string
  predecessor_id: string
  type: string // 'fim_inicio', 'inicio_inicio', 'fim_fim'
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

  // Converte tipo do banco para display
  const typeDisplay: Record<string, string> = {
    'fim_inicio': 'FS',
    'inicio_inicio': 'SS',
    'fim_fim': 'FF'
  }

  // Cores por tipo
  const typeColors: Record<string, string> = {
    'fim_inicio': '#3b82f6',    // azul
    'inicio_inicio': '#10b981',  // verde
    'fim_fim': '#f59e0b'         // laranja
  }

  // Parse seguro de data string para evitar problemas de timezone
  function parseDate(date: Date | string): Date {
    if (date instanceof Date) return date

    // Se for string no formato YYYY-MM-DD, fazer parse local
    if (typeof date === 'string') {
      const parts = date.split('T')[0].split('-')
      if (parts.length === 3) {
        const year = parseInt(parts[0])
        const month = parseInt(parts[1]) - 1 // mês é 0-indexed
        const day = parseInt(parts[2])
        return new Date(year, month, day)
      }
    }

    return new Date(date)
  }

  // Calcula posição X de uma data baseado no dateRange
  function getDateX(date: Date | string | null): number {
    if (!date) return 0
    const dateObj = parseDate(date)

    // Normalizar para início do dia (00:00:00) para comparação precisa
    const normalizedDate = new Date(dateObj)
    normalizedDate.setHours(0, 0, 0, 0)

    const normalizedStart = new Date(dateRange.start)
    normalizedStart.setHours(0, 0, 0, 0)

    // Calcular diferença em dias completos
    const days = Math.round((normalizedDate.getTime() - normalizedStart.getTime()) / (1000 * 60 * 60 * 24))

    return days * dayWidth + 320 // +320 para compensar a coluna de nomes (w-80 = 320px)
  }

  // ========== NOVO: Criar mapeamento visual de posições ==========
  // Simula a renderização real das tarefas para mapear a posição Y correta
  const taskPositionMap = new Map<string, number>()
  let currentRow = 0

  // Função recursiva para mapear posições considerando expansão
  function mapTaskPositions(taskList: Task[], parentId: string | null = null) {
    const relevantTasks = taskList
      .filter(t => t.parent_id === parentId)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

    relevantTasks.forEach(task => {
      // Mapear posição atual da tarefa
      taskPositionMap.set(task.id, currentRow * rowHeight + rowHeight / 2)
      currentRow++

      // Se tem subtarefas E está expandida, mapear as subtarefas também
      const hasSubtasks = taskList.some(t => t.parent_id === task.id)
      if (hasSubtasks && expandedTasks.has(task.id)) {
        mapTaskPositions(taskList, task.id)
      }
    })
  }

  // Mapear todas as posições começando das tarefas principais
  mapTaskPositions(tasks, null)

  // Calcula posição Y de uma tarefa usando o mapeamento
  function getTaskY(taskId: string): number {
    return taskPositionMap.get(taskId) || 0
  }
  // ========== FIM NOVO ==========

  // Calcula a duração visual de uma tarefa (em dias)
  // IMPORTANTE: Usar a MESMA lógica do calculateTaskDates() no GanttViewTab
  function getTaskDuration(task: Task): number {
    if (!task.start_date || !task.end_date) return task.duration || 1

    const start = parseDate(task.start_date)
    const end = parseDate(task.end_date)

    // Usar exatamente a mesma fórmula do componente principal (linha 234 de GanttViewTab)
    // IMPORTANTE: +1 porque o dia inicial conta
    // Exemplo: 30/10 a 01/11 = 2 dias de diferença + 1 = 3 dias totais
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

    const type = pred.type
    const color = typeColors[type] || '#6b7280'

    // Pontos de conexão baseados no tipo
    let x1: number, x2: number

    if (type === 'fim_inicio') {
      // ========== FIM → INÍCIO ==========
      // x1: fim da barra da tarefa predecessor (usar duração para calcular)
      const fromStart = getDateX(fromTask.start_date)
      const fromDuration = getTaskDuration(fromTask)
      x1 = fromStart + (fromDuration * dayWidth)

      // x2: início da barra da tarefa sucessora
      x2 = getDateX(toTask.start_date)

    } else if (type === 'inicio_inicio') {
      // ========== INÍCIO → INÍCIO ==========
      // x1: início da barra da tarefa predecessor
      x1 = getDateX(fromTask.start_date)

      // x2: início da barra da tarefa sucessora
      x2 = getDateX(toTask.start_date)

    } else {
      // ========== FIM → FIM ==========
      // x1: fim da barra da tarefa predecessor (usar duração para calcular)
      const fromStart = getDateX(fromTask.start_date)
      const fromDuration = getTaskDuration(fromTask)
      x1 = fromStart + (fromDuration * dayWidth)

      // x2: fim da barra da tarefa sucessora (usar duração para calcular)
      const toStart = getDateX(toTask.start_date)
      const toDuration = getTaskDuration(toTask)
      x2 = toStart + (toDuration * dayWidth)
    }

    const y1 = getTaskY(pred.predecessor_id)
    const y2 = getTaskY(pred.task_id)

    // Path com cotovelo suave
    const midX = (x1 + x2) / 2
    const path = `M ${x1},${y1} L ${midX},${y1} L ${midX},${y2} L ${x2},${y2}`

    // Estilo da linha baseado no tipo
    const strokeDasharray =
      type === 'inicio_inicio' ? '5,5' :  // tracejada
      type === 'fim_fim' ? '2,2' :         // pontilhada
      'none'                                // sólida

    // Direção da seta baseada na posição relativa
    const arrowDirection = x2 > x1 ? 'right' : 'left'
    const arrowPoints = arrowDirection === 'right'
      ? `${x2},${y2} ${x2-8},${y2-4} ${x2-8},${y2+4}`  // Seta para direita →
      : `${x2},${y2} ${x2+8},${y2-4} ${x2+8},${y2+4}`  // Seta para esquerda ←

    return (
      <g key={pred.id}>
        {/* Linha */}
        <path
          d={path}
          stroke={color}
          strokeWidth="2"
          strokeDasharray={strokeDasharray}
          fill="none"
          opacity="0.7"
        />

        {/* Seta no final */}
        <polygon
          points={arrowPoints}
          fill={color}
          opacity="0.7"
        />

        {/* Label do tipo de predecessor */}
        <text
          x={midX}
          y={y1 - 5}
          fontSize="10"
          fill={color}
          textAnchor="middle"
          fontWeight="bold"
          opacity="0.8"
        >
          {typeDisplay[type]}
        </text>

        {/* Tooltip invisível para hover */}
        <title>
          {fromTask.name} → {toTask.name}
          {'\n'}Tipo: {typeDisplay[type]}
          {pred.lag_time !== 0 && `\nLag: ${pred.lag_time > 0 ? '+' : ''}${pred.lag_time} dias`}
        </title>
      </g>
    )
  }

  // Calcular altura total do SVG usando o número de linhas mapeadas
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