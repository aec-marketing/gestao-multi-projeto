import { useMemo } from 'react'
import { Task, Resource } from '@/types/database.types'
import { Allocation } from '@/types/allocation.types'

/**
 * Hook para cálculos relacionados a tasks
 *
 * Fornece funções memoizadas para calcular totais recursivos
 */
export function useTaskCalculations(
  tasks: Task[],
  allocations: Allocation[] = [],
  resources: Resource[] = []
) {
  /**
   * Mapa de custo por alocação por tarefa (folha).
   * custo = allocated_minutes (ou duration_minutes) × hourly_rate + overtime
   */
  const allocationCostByTask = useMemo(() => {
    const map = new Map<string, number>()
    allocations.forEach(alloc => {
      const resource = resources.find(r => r.id === alloc.resource_id)
      const task = tasks.find(t => t.id === alloc.task_id)
      if (!resource || !task) return
      const minutes = alloc.allocated_minutes ?? task.duration_minutes ?? 0
      const overtime = alloc.overtime_minutes ?? 0
      const multiplier = alloc.overtime_multiplier ?? 1.5
      const cost = (minutes / 60) * resource.hourly_rate
        + (overtime / 60) * resource.hourly_rate * multiplier
      map.set(alloc.task_id, (map.get(alloc.task_id) ?? 0) + cost)
    })
    return map
  }, [allocations, resources, tasks])

  /**
   * Custo total de uma tarefa (folha ou pai):
   * - Folha: estimated_cost + allocationCost
   * - Pai:  soma recursiva das folhas
   */
  const calculateTotalCost = useMemo(() => {
    const calculate = (taskId: string): number => {
      const children = tasks.filter(t => t.parent_id === taskId)
      if (children.length === 0) {
        // folha
        const task = tasks.find(t => t.id === taskId)
        const taskCost = task?.estimated_cost ?? 0
        const allocCost = allocationCostByTask.get(taskId) ?? 0
        return taskCost + allocCost
      }
      // pai: soma das filhas (recursivo)
      return children.reduce((sum, child) => sum + calculate(child.id), 0)
    }
    return calculate
  }, [tasks, allocationCostByTask])

  /**
   * @deprecated use calculateTotalCost (agora inclui alocação)
   * Mantido para retrocompatibilidade com assinatura antiga (taskId, field)
   */
  const calculateTotalCostLegacy = useMemo(() => {
    const taskMap = new Map(tasks.map(t => [t.id, t]))
    const calculate = (taskId: string, field: 'estimated_cost' | 'actual_cost'): number => {
      const directSubtasks = tasks.filter(t => t.parent_id === taskId)
      if (directSubtasks.length === 0) return 0
      return directSubtasks.reduce((sum, sub) => {
        const subCost = sub[field] || 0
        const recursiveCost = calculate(sub.id, field)
        return sum + subCost + recursiveCost
      }, 0)
    }
    return calculate
  }, [tasks])

  /**
   * Calcula a duração máxima entre as subtasks
   */
  const calculateMaxSubtaskDuration = useMemo(() => {
    return (taskId: string): number => {
      const subtasks = tasks.filter(t => t.parent_id === taskId)
      if (subtasks.length === 0) return 0
      return Math.max(...subtasks.map(t => t.duration || 0))
    }
  }, [tasks])

  /**
   * Calcula o progresso médio das subtasks
   */
  const calculateAverageProgress = useMemo(() => {
    return (taskId: string): number => {
      const subtasks = tasks.filter(t => t.parent_id === taskId)
      if (subtasks.length === 0) return 0
      const totalProgress = subtasks.reduce((sum, t) => sum + t.progress, 0)
      return Math.round(totalProgress / subtasks.length)
    }
  }, [tasks])

  return {
    calculateTotalCost,
    calculateTotalCostLegacy,
    allocationCostByTask,
    calculateMaxSubtaskDuration,
    calculateAverageProgress
  }
}
