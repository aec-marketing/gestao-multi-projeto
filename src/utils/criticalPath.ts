/**
 * Critical Path Method (CPM) Implementation
 *
 * Implementação completa do método do caminho crítico para gestão de projetos.
 * Calcula early/late start/finish, slack/float, e identifica o caminho crítico.
 */

import { Task } from '@/types/database.types'
import { parseLocalDate } from './taskDateSync'

interface Predecessor {
  id: string
  task_id: string
  predecessor_id: string
  type: string // 'fim_inicio', 'inicio_inicio', 'fim_fim'
  lag_time: number
}

/**
 * Resultado do CPM para uma tarefa
 */
export interface CPMTaskResult {
  taskId: string
  earlyStart: Date
  earlyFinish: Date
  lateStart: Date
  lateFinish: Date
  totalSlack: number // Float total (dias)
  freeSlack: number // Float livre (dias)
  isCritical: boolean
}

/**
 * Resultado completo do CPM
 */
export interface CPMResult {
  tasks: Map<string, CPMTaskResult>
  criticalPath: string[] // IDs das tarefas no caminho crítico
  projectDuration: number // Duração total do projeto em dias
  projectEarlyFinish: Date
  projectLateFinish: Date
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * Adiciona dias a uma data (ignora finais de semana por enquanto)
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Calcula diferença em dias entre duas datas
 */
function daysBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY)
}

/**
 * Calcula a data early start baseada nos predecessores
 */
function calculateEarlyStart(
  task: Task,
  predecessor: Task,
  predecessorRelation: Predecessor,
  predecessorEarlyFinish: Date,
  predecessorEarlyStart: Date
): Date {
  const lagDays = predecessorRelation.lag_time || 0

  switch (predecessorRelation.type) {
    case 'fim_inicio':
      // Tarefa começa após predecessor terminar
      return addDays(predecessorEarlyFinish, 1 + lagDays)

    case 'inicio_inicio':
      // Tarefa começa junto com predecessor
      return addDays(predecessorEarlyStart, lagDays)

    case 'fim_fim':
      // Tarefa termina junto com predecessor
      // Early start = predecessor early finish - duração da tarefa + 1 + lag
      const taskDuration = task.duration || 1
      return addDays(predecessorEarlyFinish, -taskDuration + 1 + lagDays)

    default:
      return addDays(predecessorEarlyFinish, 1 + lagDays)
  }
}

/**
 * Calcula a data late finish baseada nos sucessores
 */
function calculateLateFinish(
  task: Task,
  successor: Task,
  predecessorRelation: Predecessor,
  successorLateStart: Date,
  successorLateFinish: Date
): Date {
  const lagDays = predecessorRelation.lag_time || 0

  switch (predecessorRelation.type) {
    case 'fim_inicio':
      // Predecessor deve terminar antes do sucessor começar
      return addDays(successorLateStart, -1 - lagDays)

    case 'inicio_inicio':
      // Predecessor deve começar junto com sucessor
      // Late finish = successor late start - lag + duração - 1
      const taskDuration = task.duration || 1
      return addDays(successorLateStart, -lagDays + taskDuration - 1)

    case 'fim_fim':
      // Predecessor deve terminar junto com sucessor
      return addDays(successorLateFinish, -lagDays)

    default:
      return addDays(successorLateStart, -1 - lagDays)
  }
}

/**
 * Implementação completa do Critical Path Method (CPM)
 *
 * Algoritmo:
 * 1. Forward Pass: Calcula Early Start e Early Finish para todas as tarefas
 * 2. Backward Pass: Calcula Late Start e Late Finish para todas as tarefas
 * 3. Calcula Slack (Float) = Late Start - Early Start
 * 4. Tarefas com Slack = 0 estão no caminho crítico
 *
 * @param tasks Array de todas as tarefas do projeto
 * @param predecessors Array de todos os relacionamentos de predecessores
 * @param projectStartDate Data de início do projeto (opcional, usa a menor data das tarefas)
 * @returns Resultado completo do CPM
 */
export function calculateCriticalPath(
  tasks: Task[],
  predecessors: Predecessor[],
  projectStartDate?: Date
): CPMResult {
  const results = new Map<string, CPMTaskResult>()

  // Filtrar apenas tarefas com datas válidas
  const validTasks = tasks.filter(t => t.start_date && t.end_date)

  if (validTasks.length === 0) {
    return {
      tasks: results,
      criticalPath: [],
      projectDuration: 0,
      projectEarlyFinish: new Date(),
      projectLateFinish: new Date()
    }
  }

  // ===== FORWARD PASS: Calcular Early Start e Early Finish =====

  // 1. Identificar tarefas iniciais (sem predecessores)
  const tasksWithPredecessors = new Set(predecessors.map(p => p.task_id))
  const initialTasks = validTasks.filter(t => !tasksWithPredecessors.has(t.id))

  // 2. Calcular data de início do projeto se não fornecida
  if (!projectStartDate) {
    const startDates = initialTasks
      .map(t => parseLocalDate(t.start_date!))
      .filter((d): d is Date => d !== null)

    projectStartDate = startDates.length > 0
      ? new Date(Math.min(...startDates.map(d => d.getTime())))
      : new Date()
  }

  // 3. Inicializar tarefas iniciais
  for (const task of initialTasks) {
    const startDate = parseLocalDate(task.start_date!) || projectStartDate
    const duration = task.duration || 1
    const finishDate = addDays(startDate, duration - 1)

    results.set(task.id, {
      taskId: task.id,
      earlyStart: startDate,
      earlyFinish: finishDate,
      lateStart: new Date(0), // Será calculado no backward pass
      lateFinish: new Date(0),
      totalSlack: 0,
      freeSlack: 0,
      isCritical: false
    })
  }

  // 4. Forward pass usando ordenação topológica
  const processed = new Set<string>()
  const queue = [...initialTasks.map(t => t.id)]

  while (queue.length > 0) {
    const taskId = queue.shift()!
    if (processed.has(taskId)) continue

    const task = validTasks.find(t => t.id === taskId)
    if (!task) continue

    // Verificar se todos os predecessores foram processados
    const taskPredecessors = predecessors.filter(p => p.task_id === taskId)
    const allPredecessorsProcessed = taskPredecessors.every(p => processed.has(p.predecessor_id))

    if (!allPredecessorsProcessed) {
      // Re-adicionar ao final da fila
      queue.push(taskId)
      continue
    }

    // Calcular early start baseado em todos os predecessores
    let earlyStart: Date

    if (taskPredecessors.length === 0) {
      // Tarefa inicial já foi inicializada
      earlyStart = results.get(taskId)!.earlyStart
    } else {
      // Calcular baseado em predecessores (usar o mais restritivo)
      const possibleStarts: Date[] = []

      for (const pred of taskPredecessors) {
        const predecessorTask = validTasks.find(t => t.id === pred.predecessor_id)
        const predecessorResult = results.get(pred.predecessor_id)

        if (!predecessorTask || !predecessorResult) continue

        const calculatedStart = calculateEarlyStart(
          task,
          predecessorTask,
          pred,
          predecessorResult.earlyFinish,
          predecessorResult.earlyStart
        )

        possibleStarts.push(calculatedStart)
      }

      // Usar o start mais tarde (mais restritivo)
      earlyStart = possibleStarts.length > 0
        ? new Date(Math.max(...possibleStarts.map(d => d.getTime())))
        : parseLocalDate(task.start_date!) || projectStartDate
    }

    const duration = task.duration || 1
    const earlyFinish = addDays(earlyStart, duration - 1)

    results.set(taskId, {
      taskId: task.id,
      earlyStart,
      earlyFinish,
      lateStart: new Date(0),
      lateFinish: new Date(0),
      totalSlack: 0,
      freeSlack: 0,
      isCritical: false
    })

    processed.add(taskId)

    // Adicionar sucessores à fila
    const successors = predecessors.filter(p => p.predecessor_id === taskId)
    for (const succ of successors) {
      if (!queue.includes(succ.task_id)) {
        queue.push(succ.task_id)
      }
    }
  }

  // ===== BACKWARD PASS: Calcular Late Start e Late Finish =====

  // 1. Identificar tarefas finais (sem sucessores)
  const tasksWithSuccessors = new Set(predecessors.map(p => p.predecessor_id))
  const finalTasks = validTasks.filter(t => !tasksWithSuccessors.has(t.id) && results.has(t.id))

  // 2. Calcular data de fim do projeto (maior early finish)
  const projectEarlyFinish = new Date(
    Math.max(...Array.from(results.values()).map(r => r.earlyFinish.getTime()))
  )

  // 3. Inicializar tarefas finais (Late Finish = Early Finish)
  for (const task of finalTasks) {
    const result = results.get(task.id)!
    result.lateFinish = result.earlyFinish
    result.lateStart = addDays(result.lateFinish, -(task.duration || 1) + 1)
  }

  // 4. Backward pass usando ordenação topológica reversa
  processed.clear()
  const backwardQueue = [...finalTasks.map(t => t.id)]

  while (backwardQueue.length > 0) {
    const taskId = backwardQueue.shift()!
    if (processed.has(taskId)) continue

    const task = validTasks.find(t => t.id === taskId)
    if (!task) continue

    // Verificar se todos os sucessores foram processados
    const taskSuccessors = predecessors.filter(p => p.predecessor_id === taskId)
    const allSuccessorsProcessed = taskSuccessors.every(p => processed.has(p.task_id))

    if (!allSuccessorsProcessed) {
      backwardQueue.push(taskId)
      continue
    }

    const result = results.get(taskId)!

    if (taskSuccessors.length > 0) {
      // Calcular late finish baseado em sucessores (usar o mais restritivo)
      const possibleFinishes: Date[] = []

      for (const succ of taskSuccessors) {
        const successorTask = validTasks.find(t => t.id === succ.task_id)
        const successorResult = results.get(succ.task_id)

        if (!successorTask || !successorResult) continue

        const calculatedFinish = calculateLateFinish(
          task,
          successorTask,
          succ,
          successorResult.lateStart,
          successorResult.lateFinish
        )

        possibleFinishes.push(calculatedFinish)
      }

      // Usar o finish mais cedo (mais restritivo)
      if (possibleFinishes.length > 0) {
        result.lateFinish = new Date(Math.min(...possibleFinishes.map(d => d.getTime())))
        result.lateStart = addDays(result.lateFinish, -(task.duration || 1) + 1)
      }
    }

    processed.add(taskId)

    // Adicionar predecessores à fila
    const predTasks = predecessors.filter(p => p.task_id === taskId)
    for (const pred of predTasks) {
      if (!backwardQueue.includes(pred.predecessor_id)) {
        backwardQueue.push(pred.predecessor_id)
      }
    }
  }

  // ===== CALCULAR SLACK E IDENTIFICAR CAMINHO CRÍTICO =====

  const criticalPath: string[] = []

  for (const [taskId, result] of results.entries()) {
    // Total Slack = Late Start - Early Start
    result.totalSlack = daysBetween(result.earlyStart, result.lateStart)

    // Free Slack = menor Early Start dos sucessores - Early Finish desta tarefa - 1
    const taskSuccessors = predecessors.filter(p => p.predecessor_id === taskId)
    if (taskSuccessors.length > 0) {
      const successorEarlyStarts = taskSuccessors
        .map(s => results.get(s.task_id)?.earlyStart)
        .filter((d): d is Date => d !== undefined)

      if (successorEarlyStarts.length > 0) {
        const minSuccessorStart = new Date(Math.min(...successorEarlyStarts.map(d => d.getTime())))
        result.freeSlack = daysBetween(result.earlyFinish, minSuccessorStart) - 1
      } else {
        result.freeSlack = result.totalSlack
      }
    } else {
      // Tarefa final: free slack = total slack
      result.freeSlack = result.totalSlack
    }

    // Tarefa crítica: slack total <= 0
    result.isCritical = result.totalSlack <= 0

    if (result.isCritical) {
      criticalPath.push(taskId)
    }
  }

  // Calcular duração do projeto
  const projectDuration = daysBetween(projectStartDate, projectEarlyFinish) + 1

  return {
    tasks: results,
    criticalPath,
    projectDuration,
    projectEarlyFinish,
    projectLateFinish: projectEarlyFinish // Por enquanto, assumimos sem deadline
  }
}

/**
 * Atualiza o campo is_critical_path de todas as tarefas baseado no CPM
 * Retorna array de IDs de tarefas que precisam ser atualizadas no banco
 */
export function updateCriticalPathFlags(
  tasks: Task[],
  cpmResult: CPMResult
): { taskId: string; isCritical: boolean }[] {
  const updates: { taskId: string; isCritical: boolean }[] = []

  for (const task of tasks) {
    const cpmTask = cpmResult.tasks.get(task.id)
    const newCriticalStatus = cpmTask?.isCritical || false

    // Só atualizar se mudou
    if (task.is_critical_path !== newCriticalStatus) {
      updates.push({
        taskId: task.id,
        isCritical: newCriticalStatus
      })
    }
  }

  return updates
}
