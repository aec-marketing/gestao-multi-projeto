import { Task, Project } from '@/types/database.types'

/**
 * Calcula informações sobre buffer do projeto
 */
interface ProjectBufferInfo {
  // Datas calculadas
  realEndDate: Date                // Data real de fim (última tarefa)
  bufferEndDate: Date             // Data com buffer aplicado
  targetEndDate: Date | null      // Data alvo (se definida)

  // Status do buffer
  bufferStatus: 'safe' | 'consumed' | 'exceeded'
  bufferDaysUsed: number          // Quantos dias de buffer foram consumidos
  bufferDaysRemaining: number     // Quantos dias de buffer restam

  // Comparação com target
  targetStatus: 'on_track' | 'tight' | 'delayed' | 'no_target'
  targetDaysRemaining: number     // Dias até a data alvo (pode ser negativo)
}

/**
 * Calcula todas as informações sobre buffer de um projeto
 */
export function calculateProjectBuffer(
  project: Project,
  tasks: Task[]
): ProjectBufferInfo {
  const bufferDays = project.buffer_days || 0

  // 1. Encontrar data real de fim (última tarefa)
  const realEndDate = calculateRealEndDate(tasks, project.start_date)

  // 2. Aplicar buffer
  const bufferEndDate = new Date(realEndDate)
  bufferEndDate.setDate(bufferEndDate.getDate() + bufferDays)

  // 3. Comparar com data alvo (se existir)
  const targetEndDate = project.target_end_date ? new Date(project.target_end_date) : null

  // 4. Calcular status do buffer
  const bufferInfo = calculateBufferStatus(realEndDate, bufferEndDate, targetEndDate, bufferDays)

  return {
    realEndDate,
    bufferEndDate,
    targetEndDate,
    ...bufferInfo
  }
}

/**
 * Encontra a data de fim real baseada na última tarefa
 */
function calculateRealEndDate(tasks: Task[], projectStartDate: string | null): Date {
  if (!projectStartDate || tasks.length === 0) {
    return new Date() // Fallback para hoje
  }

  const projectStart = new Date(projectStartDate)

  // Encontrar a tarefa com end_date mais tardia
  let latestEndDate = projectStart
  let latestTaskName = 'Início do projeto'

  tasks.forEach(task => {
    if (task.end_date) {
      const taskEndDate = new Date(task.end_date)
      if (taskEndDate > latestEndDate) {
        latestEndDate = taskEndDate
        latestTaskName = task.name
      }
    } else if (task.start_date && task.duration) {
      // Calcular end_date se não estiver definida
      const taskStartDate = new Date(task.start_date)
      const taskEndDate = new Date(taskStartDate)
      taskEndDate.setDate(taskEndDate.getDate() + Math.ceil(task.duration) - 1)

      if (taskEndDate > latestEndDate) {
        latestEndDate = taskEndDate
        latestTaskName = `${task.name} (calculado)`
      }
    }
  })

  return latestEndDate
}

/**
 * Calcula status do buffer e comparações
 */
function calculateBufferStatus(
  realEndDate: Date,
  bufferEndDate: Date,
  targetEndDate: Date | null,
  bufferDays: number
) {
  const today = new Date()
  today.setHours(0, 0, 0, 0) // Normalizar para início do dia

  // Status do buffer
  let bufferStatus: 'safe' | 'consumed' | 'exceeded' = 'safe'
  let bufferDaysUsed = 0
  let bufferDaysRemaining = bufferDays

  if (realEndDate > bufferEndDate) {
    // Buffer foi excedido
    bufferStatus = 'exceeded'
    bufferDaysUsed = bufferDays + daysBetween(bufferEndDate, realEndDate)
    bufferDaysRemaining = -daysBetween(bufferEndDate, realEndDate)
  } else if (realEndDate.getTime() === bufferEndDate.getTime()) {
    // Buffer foi totalmente consumido
    bufferStatus = 'consumed'
    bufferDaysUsed = bufferDays
    bufferDaysRemaining = 0
  } else {
    // Buffer ainda está seguro
    bufferStatus = 'safe'
    bufferDaysUsed = Math.max(0, bufferDays - daysBetween(realEndDate, bufferEndDate))
    bufferDaysRemaining = daysBetween(realEndDate, bufferEndDate)
  }

  // Status em relação à data alvo
  let targetStatus: 'on_track' | 'tight' | 'delayed' | 'no_target' = 'no_target'
  let targetDaysRemaining = 0

  if (targetEndDate) {
    targetDaysRemaining = daysBetween(realEndDate, targetEndDate)

    if (targetDaysRemaining < 0) {
      targetStatus = 'delayed'
    } else if (targetDaysRemaining <= 2) {
      targetStatus = 'tight'
    } else {
      targetStatus = 'on_track'
    }
  }

  return {
    bufferStatus,
    bufferDaysUsed,
    bufferDaysRemaining,
    targetStatus,
    targetDaysRemaining
  }
}

/**
 * Calcula diferença em dias entre duas datas
 */
function daysBetween(startDate: Date, endDate: Date): number {
  const oneDay = 24 * 60 * 60 * 1000 // milliseconds in a day
  return Math.round((endDate.getTime() - startDate.getTime()) / oneDay)
}

/**
 * Formata status de buffer para exibição
 */
export function formatBufferStatus(bufferInfo: ProjectBufferInfo): {
  color: string
  icon: string
  message: string
} {
  const { bufferStatus, bufferDaysRemaining, targetStatus, targetDaysRemaining } = bufferInfo

  // Priorizar status da data alvo se existir
  if (targetStatus !== 'no_target') {
    switch (targetStatus) {
      case 'delayed':
        return {
          color: 'red',
          icon: '🔴',
          message: `Atrasado: ${Math.abs(targetDaysRemaining)} dias além da data alvo`
        }
      case 'tight':
        return {
          color: 'yellow',
          icon: '🟡',
          message: `Prazo apertado: ${targetDaysRemaining} dias até data alvo`
        }
      case 'on_track':
        return {
          color: 'green',
          icon: '✅',
          message: `No prazo: ${targetDaysRemaining} dias de folga até data alvo`
        }
    }
  }

  // Fallback para status do buffer
  switch (bufferStatus) {
    case 'exceeded':
      return {
        color: 'red',
        icon: '🔴',
        message: `Buffer excedido: ${Math.abs(bufferDaysRemaining)} dias além do previsto`
      }
    case 'consumed':
      return {
        color: 'yellow',
        icon: '🟡',
        message: 'Buffer totalmente consumido'
      }
    case 'safe':
      return {
        color: 'green',
        icon: '✅',
        message: `Buffer seguro: ${bufferDaysRemaining} dias restantes`
      }
    default:
      return {
        color: 'gray',
        icon: 'ℹ️',
        message: 'Status não definido'
      }
  }
}

/**
 * Gera dados para visualização da barra de buffer no Gantt
 */
export function generateBufferBarData(
  bufferInfo: ProjectBufferInfo,
  projectStart: Date,
  pixelsPerDay: number = 50
): {
  // Posicionamento da barra de buffer
  bufferBarLeft: number    // Pixels from start
  bufferBarWidth: number   // Width in pixels

  // Visual status
  bufferBarColor: string   // CSS color class
  bufferBarPattern: string // CSS pattern class

  // Tooltip info
  tooltipText: string
} {
  const { realEndDate, bufferEndDate, bufferStatus, bufferDaysRemaining } = bufferInfo

  // Calcular posição em pixels
  const daysFromStart = daysBetween(projectStart, realEndDate)
  const bufferBarLeft = daysFromStart * pixelsPerDay
  const bufferBarWidth = Math.abs(bufferDaysRemaining) * pixelsPerDay

  // Determinar cor baseada no status
  let bufferBarColor = 'bg-green-200 border-green-400'
  let bufferBarPattern = ''

  switch (bufferStatus) {
    case 'safe':
      bufferBarColor = 'bg-green-200 border-green-400'
      bufferBarPattern = 'bg-pattern-dots'
      break
    case 'consumed':
      bufferBarColor = 'bg-yellow-200 border-yellow-400'
      bufferBarPattern = 'bg-pattern-diagonal'
      break
    case 'exceeded':
      bufferBarColor = 'bg-red-200 border-red-400'
      bufferBarPattern = 'bg-pattern-cross'
      break
  }

  // Texto do tooltip
  const formatStatus = formatBufferStatus(bufferInfo)
  const tooltipText = `Buffer: ${formatStatus.message}`

  return {
    bufferBarLeft,
    bufferBarWidth,
    bufferBarColor,
    bufferBarPattern,
    tooltipText
  }
}