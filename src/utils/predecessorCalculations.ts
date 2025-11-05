import { Task } from '@/types/database.types'

interface Predecessor {
  id: string
  task_id: string
  predecessor_id: string
  type: string // 'fim_inicio', 'inicio_inicio', 'fim_fim'
  lag_time: number
}

interface TaskUpdate {
  id: string
  start_date: string
  end_date: string
  reason: string
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * Calcula a data de uma tarefa baseada em seu predecessor
 */
export function calculateTaskDateFromPredecessor(
  task: Task,
  predecessor: Task,
  predecessorRelation: Predecessor
): { start_date: Date; end_date: Date } {

  if (!predecessor.start_date) {
    throw new Error('Predecessor must have a start_date')
  }

  // Parse seguro de datas para evitar problemas de timezone
  const parseDate = (dateStr: string) => {
    const parts = dateStr.split('T')[0].split('-')
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
  }

  const predStart = parseDate(predecessor.start_date)
  const predEnd = parseDate(predecessor.end_date || predecessor.start_date)
  const lagDays = predecessorRelation.lag_time || 0
  const taskDuration = task.duration || 1

  let newStartDate: Date

  switch (predecessorRelation.type) {
    case 'fim_inicio':
      // Tarefa começa após predecessor terminar
      newStartDate = new Date(predEnd)
      newStartDate.setDate(newStartDate.getDate() + 1 + lagDays)
      break

    case 'inicio_inicio':
      // Tarefa começa junto com predecessor
      newStartDate = new Date(predStart)
      newStartDate.setDate(newStartDate.getDate() + lagDays)
      break

    case 'fim_fim':
      // Tarefa termina junto com predecessor
      const targetEndDate = new Date(predEnd)
      targetEndDate.setDate(targetEndDate.getDate() + lagDays)

      // Calcula data de início baseada na duração
      newStartDate = new Date(targetEndDate)
      newStartDate.setDate(newStartDate.getDate() - taskDuration + 1)
      break

    default:
      if (!task.start_date) {
        throw new Error('Task must have a start_date')
      }
      newStartDate = new Date(task.start_date)
  }

  // Calcula data de término
  const newEndDate = new Date(newStartDate)
  newEndDate.setDate(newEndDate.getDate() + taskDuration - 1)

  return {
    start_date: newStartDate,
    end_date: newEndDate
  }
}

/**
 * Recalcula todas as tarefas dependentes em cascata
 */
export function recalculateTasksInCascade(
  changedTaskId: string,
  allTasks: Task[],
  allPredecessors: Predecessor[]
): TaskUpdate[] {

  const updates: TaskUpdate[] = []
  const processed = new Set<string>()
  const queue: string[] = [changedTaskId]

  while (queue.length > 0) {
    const currentTaskId = queue.shift()!

    if (processed.has(currentTaskId)) continue
    processed.add(currentTaskId)

    // Encontra tarefas que dependem desta
    const dependentPreds = allPredecessors.filter(
      p => p.predecessor_id === currentTaskId
    )

    for (const pred of dependentPreds) {
      const dependentTask = allTasks.find(t => t.id === pred.task_id)
      const predecessorTask = allTasks.find(t => t.id === pred.predecessor_id)

      if (!dependentTask || !predecessorTask) {
        continue
      }

      // Calcula novas datas
      const newDates = calculateTaskDateFromPredecessor(
        dependentTask,
        predecessorTask,
        pred
      )

      // Verifica se houve mudança OU se a tarefa não tem data (primeira vez)
      const hasOldDate = dependentTask.start_date !== null && dependentTask.start_date !== undefined

      const oldStart = hasOldDate ? new Date(dependentTask.start_date!).getTime() : 0
      const newStart = newDates.start_date.getTime()

      const dateChanged = oldStart !== newStart

      // ✅ SEMPRE adicionar update quando predecessor muda, mesmo que a data calculada seja a mesma
      // Isso garante que quando o predecessor move para trás, o dependente também acompanha

      updates.push({
        id: dependentTask.id,
        start_date: newDates.start_date.toISOString().split('T')[0],
        end_date: newDates.end_date.toISOString().split('T')[0],
        reason: hasOldDate
          ? `Predecessor "${predecessorTask.name}" foi alterado`
          : `Data calculada baseada no predecessor "${predecessorTask.name}"`
      })

      // Atualiza a tarefa no array para próximas iterações
      dependentTask.start_date = newDates.start_date.toISOString().split('T')[0]
      dependentTask.end_date = newDates.end_date.toISOString().split('T')[0]

      // Adiciona à fila para propagar mudança
      queue.push(dependentTask.id)
    }
  }

  return updates
}

/**
 * Detecta se há conflito entre a data calculada e a data atual
 */
export function detectDateConflict(
  task: Task,
  calculatedDate: Date
): { hasConflict: boolean; daysDifference: number } {

  if (!task.start_date) {
    return { hasConflict: false, daysDifference: 0 }
  }

  const currentStart = new Date(task.start_date)
  const diffMs = calculatedDate.getTime() - currentStart.getTime()
  const diffDays = Math.round(diffMs / MS_PER_DAY)

  return {
    hasConflict: diffDays !== 0,
    daysDifference: diffDays
  }
}

/**
 * Valida se uma tarefa pode começar na data proposta
 * baseado em seus predecessores
 */
export function validateTaskStartDate(
  task: Task,
  proposedStartDate: Date,
  allTasks: Task[],
  allPredecessors: Predecessor[]
): { isValid: boolean; message?: string } {
  
  // Encontra predecessores desta tarefa
  const taskPredecessors = allPredecessors.filter(p => p.task_id === task.id)

  for (const pred of taskPredecessors) {
    const predecessorTask = allTasks.find(t => t.id === pred.predecessor_id)
    if (!predecessorTask) continue

    const calculatedDates = calculateTaskDateFromPredecessor(
      task,
      predecessorTask,
      pred
    )

    const proposedTime = proposedStartDate.getTime()
    const calculatedTime = calculatedDates.start_date.getTime()

    if (proposedTime < calculatedTime) {
      const daysDiff = Math.ceil((calculatedTime - proposedTime) / MS_PER_DAY)
      
      return {
        isValid: false,
        message: `Conflito com predecessor "${predecessorTask.name}". A tarefa deve começar ${daysDiff} dia(s) mais tarde.`
      }
    }
  }

  return { isValid: true }
}

/**
 * Encontra o caminho crítico do projeto
 */
export function findCriticalPath(
  allTasks: Task[],
  allPredecessors: Predecessor[]
): string[] {
  
  const criticalTasks: string[] = []
  
  // Calcula folga de cada tarefa
  for (const task of allTasks) {
    const successors = allPredecessors.filter(p => p.predecessor_id === task.id)
    
    if (successors.length === 0) {
      // Tarefa final - faz parte do caminho crítico
      criticalTasks.push(task.id)
      continue
    }

    // Verifica se tem folga zero
    let hasSlack = false
    for (const succ of successors) {
      const successorTask = allTasks.find(t => t.id === succ.task_id)
      if (!successorTask || !successorTask.start_date) continue

      const taskEndDate = task.end_date || task.start_date
      if (!taskEndDate) continue

      const taskEnd = new Date(taskEndDate)
      const succStart = new Date(successorTask.start_date)

      const gapDays = Math.floor((succStart.getTime() - taskEnd.getTime()) / MS_PER_DAY)

      if (gapDays > 1) {
        hasSlack = true
        break
      }
    }

    if (!hasSlack) {
      criticalTasks.push(task.id)
    }
  }

  return criticalTasks
}

/**
 * Audita todas as tarefas e detecta conflitos com predecessores
 * Retorna lista de updates necessários para corrigir os conflitos
 */
export function auditPredecessorConflicts(
  allTasks: Task[],
  allPredecessors: Predecessor[]
): TaskUpdate[] {
  const conflicts: TaskUpdate[] = []

  // Para cada tarefa que tem predecessor
  for (const task of allTasks) {
    const taskPredecessors = allPredecessors.filter(p => p.task_id === task.id)

    if (taskPredecessors.length === 0) continue
    if (!task.start_date) continue // Tarefa sem data será tratada por calculateInitialDates

    // Para cada predecessor, calcular a data esperada
    for (const pred of taskPredecessors) {
      const predecessorTask = allTasks.find(t => t.id === pred.predecessor_id)

      if (!predecessorTask) {
        continue
      }

      if (!predecessorTask.start_date || !predecessorTask.end_date) {
        continue
      }

      try {
        const calculatedDates = calculateTaskDateFromPredecessor(
          task,
          predecessorTask,
          pred
        )

        // Parse seguro de datas para evitar problemas de timezone
        const parseDate = (dateStr: string) => {
          const parts = dateStr.split('T')[0].split('-')
          return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
        }

        const currentStartDate = parseDate(task.start_date)
        const calculatedStartDate = calculatedDates.start_date

        // Normalizar para meia-noite para comparação precisa
        currentStartDate.setHours(0, 0, 0, 0)
        calculatedStartDate.setHours(0, 0, 0, 0)

        const currentStartTime = currentStartDate.getTime()
        const calculatedStartTime = calculatedStartDate.getTime()

        // Se a data atual é anterior à data calculada, há conflito
        if (currentStartTime < calculatedStartTime) {
          const daysDiff = Math.ceil((calculatedStartTime - currentStartTime) / MS_PER_DAY)

          // Verificar se já adicionamos um update para esta tarefa
          const existingUpdate = conflicts.find(c => c.id === task.id)

          if (existingUpdate) {
            // Se já existe, usar a data mais restritiva (mais tarde)
            const existingTime = new Date(existingUpdate.start_date).getTime()
            if (calculatedStartTime > existingTime) {
              existingUpdate.start_date = calculatedDates.start_date.toISOString().split('T')[0]
              existingUpdate.end_date = calculatedDates.end_date.toISOString().split('T')[0]
              existingUpdate.reason = `Conflito com predecessor "${predecessorTask.name}" (deve começar ${daysDiff} dia(s) mais tarde)`
            }
          } else {
            conflicts.push({
              id: task.id,
              start_date: calculatedDates.start_date.toISOString().split('T')[0],
              end_date: calculatedDates.end_date.toISOString().split('T')[0],
              reason: `Conflito com predecessor "${predecessorTask.name}" (deve começar ${daysDiff} dia(s) mais tarde)`
            })
          }
        }
      } catch (error) {
        // Erro ao calcular data - ignorar este predecessor
      }
    }
  }

  return conflicts
}