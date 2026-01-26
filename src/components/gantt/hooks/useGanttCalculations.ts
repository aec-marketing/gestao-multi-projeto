/**
 * Hook de cálculos do Gantt com memoização
 * Usa funções de ganttCalculations.ts com cache otimizado
 */

import { useMemo } from 'react'
import { Task, Resource } from '@/types/database.types'
import { Allocation } from '@/types/allocation.types'
import { calculateTaskDates, organizeTasksHierarchy, calculateDateRange } from '../utils/ganttCalculations'

export function useGanttCalculations(
  tasks: Task[],
  projectStartDate: string | null,
  allocations: Allocation[],
  resources: Resource[],
  expandedTasks: Set<string>
) {
  // Calcular datas das tarefas (convertendo duration_minutes para dias)
  const tasksWithDates = useMemo(() => {
    return calculateTaskDates(tasks, projectStartDate)
  }, [tasks, projectStartDate])

  // Organizar hierarquia com alocações
  const organizedTasks = useMemo(() => {
    console.log('[GANTT-CALC-DEBUG] Organizando tarefas:', {
      totalTasks: tasksWithDates.length,
      totalAllocations: allocations.length,
      allocationsPerTask: allocations.reduce((acc, a) => {
        acc[a.task_id] = (acc[a.task_id] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    })

    const result = organizeTasksHierarchy(tasksWithDates, allocations, resources, expandedTasks)

    console.log('[GANTT-CALC-DEBUG] Resultado organizado:', {
      totalOrganized: result.length,
      tasksWithAllocations: result.filter(t => t.allocations.length > 0).map(t => ({
        name: t.name,
        allocations: t.allocations.length
      }))
    })

    return result
  }, [tasksWithDates, allocations, resources, expandedTasks])

  // Calcular range de datas (min/max + buffer)
  const dateRange = useMemo(() => {
    return calculateDateRange(tasksWithDates)
  }, [tasksWithDates])

  return { tasksWithDates, organizedTasks, dateRange }
}
