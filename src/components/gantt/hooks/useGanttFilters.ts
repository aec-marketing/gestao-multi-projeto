/**
 * Hook de filtros do Gantt
 * Filtra tarefas por tipo, pessoa e progresso
 */

import { useMemo } from 'react'
import { TaskWithAllocations } from '../types/gantt.types'
import { Allocation } from '@/types/allocation.types'
import { getAllDescendants } from '../utils/ganttCalculations'

export function useGanttFilters(
  tasks: TaskWithAllocations[],
  allocations: Allocation[],
  filters: { type: string; person: string; progress: string }
) {
  const filteredTasks = useMemo(() => {
    // Começar com tarefas raiz
    let result = tasks.filter(t => !t.parent_id)

    // Filtrar por tipo
    if (filters.type !== 'all') {
      result = result.filter(t => t.type === filters.type)
    }

    // Filtrar por pessoa (alocada)
    if (filters.person !== 'all') {
      result = result.filter(t =>
        allocations.some(a => a.task_id === t.id && a.resource_id === filters.person)
      )
    }

    // Filtrar por progresso
    if (filters.progress === 'done') {
      result = result.filter(t => t.progress === 100)
    } else if (filters.progress === 'in_progress') {
      result = result.filter(t => t.progress > 0 && t.progress < 100)
    } else if (filters.progress === 'not_started') {
      result = result.filter(t => t.progress === 0)
    }

    return result
  }, [tasks, allocations, filters])

  // Incluir descendentes das tarefas filtradas
  const filteredWithDescendants = useMemo(() => {
    const filteredIds = new Set(filteredTasks.map(t => t.id))
    const descendants = getAllDescendants(filteredIds, tasks)
    return [...filteredTasks, ...descendants]
  }, [filteredTasks, tasks])

  return { filteredTasks: filteredWithDescendants }
}
