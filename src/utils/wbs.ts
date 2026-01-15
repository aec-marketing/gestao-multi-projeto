/**
 * Utilitários para geração automática de códigos WBS (Work Breakdown Structure)
 */

import { Task } from '@/types/database.types'

/**
 * Gera o próximo código WBS para uma nova tarefa
 *
 * @param tasks Todas as tarefas do projeto
 * @param parentId ID da tarefa pai (null para tarefas principais)
 * @returns Código WBS no formato "1", "1.1", "1.1.2", etc.
 */
export function generateNextWbsCode(tasks: Task[], parentId: string | null): string {
  if (!parentId) {
    // Tarefa principal - encontrar o próximo número sequencial
    const mainTasks = tasks.filter(t => !t.parent_id)
    const maxNumber = mainTasks.reduce((max, task) => {
      if (!task.wbs_code) return max
      const num = parseInt(task.wbs_code.split('.')[0], 10)
      return isNaN(num) ? max : Math.max(max, num)
    }, 0)
    return `${maxNumber + 1}`
  }

  // Subtarefa - encontrar o WBS do pai e adicionar número sequencial
  const parentTask = tasks.find(t => t.id === parentId)
  if (!parentTask || !parentTask.wbs_code) {
    // Fallback se pai não tiver WBS
    return '1.1'
  }

  // Encontrar subtarefas irmãs (mesmo pai)
  const siblings = tasks.filter(t => t.parent_id === parentId)
  const maxNumber = siblings.reduce((max, task) => {
    if (!task.wbs_code) return max
    const parts = task.wbs_code.split('.')
    const lastNum = parseInt(parts[parts.length - 1], 10)
    return isNaN(lastNum) ? max : Math.max(max, lastNum)
  }, 0)

  return `${parentTask.wbs_code}.${maxNumber + 1}`
}

/**
 * Recalcula todos os códigos WBS de um projeto mantendo hierarquia
 * Útil após reordenação ou importação
 *
 * @param tasks Todas as tarefas do projeto
 * @returns Array de updates { id, wbs_code }
 */
export function recalculateAllWbsCodes(tasks: Task[]): { id: string; wbs_code: string }[] {
  const updates: { id: string; wbs_code: string }[] = []
  const processed = new Set<string>()

  // Ordenar tarefas por sort_order
  const sortedTasks = [...tasks].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

  // Contador para tarefas principais
  let mainCounter = 1

  function processTask(task: Task, parentWbs?: string) {
    if (processed.has(task.id)) return
    processed.add(task.id)

    let wbsCode: string
    if (!task.parent_id) {
      // Tarefa principal
      wbsCode = `${mainCounter}`
      mainCounter++
    } else {
      // Subtarefa
      if (!parentWbs) {
        // Fallback se não tiver pai
        wbsCode = '1.1'
      } else {
        // Contar irmãos já processados
        const siblings = sortedTasks.filter(t => t.parent_id === task.parent_id && processed.has(t.id))
        wbsCode = `${parentWbs}.${siblings.length + 1}`
      }
    }

    updates.push({ id: task.id, wbs_code: wbsCode })

    // Processar filhos recursivamente
    const children = sortedTasks.filter(t => t.parent_id === task.id)
    children.forEach(child => processTask(child, wbsCode))
  }

  // Processar tarefas principais primeiro
  const mainTasks = sortedTasks.filter(t => !t.parent_id)
  mainTasks.forEach(task => processTask(task))

  // Processar órfãos (subtarefas sem pai válido)
  const orphans = sortedTasks.filter(t => t.parent_id && !processed.has(t.id))
  orphans.forEach(task => {
    const wbsCode = `${mainCounter}.1`
    mainCounter++
    processTask(task, wbsCode)
  })

  return updates
}

/**
 * Valida se um código WBS é válido
 */
export function isValidWbsCode(wbsCode: string): boolean {
  if (!wbsCode) return false

  const parts = wbsCode.split('.')
  if (parts.length === 0) return false

  // Verificar se todas as partes são números válidos
  return parts.every(part => {
    const num = parseInt(part, 10)
    return !isNaN(num) && num > 0
  })
}

/**
 * Obtém o nível de hierarquia a partir do código WBS
 * Ex: "1" = 0, "1.1" = 1, "1.1.2" = 2
 */
export function getWbsLevel(wbsCode: string): number {
  if (!wbsCode) return 0
  return wbsCode.split('.').length - 1
}
