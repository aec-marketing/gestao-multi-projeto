import { useMemo } from 'react'
import { Task } from '@/types/database.types'

/**
 * Hook para cálculos relacionados a tasks
 *
 * Fornece funções memoizadas para calcular totais recursivos
 */
export function useTaskCalculations(tasks: Task[]) {
  /**
   * Calcula o total de custo recursivamente (soma de todas as subtasks)
   * Memoizado para evitar recálculos a cada render
   */
  const calculateTotalCost = useMemo(() => {
    // Criar um mapa de tasks por ID para acesso rápido
    const taskMap = new Map(tasks.map(t => [t.id, t]))

    // Função recursiva interna
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
    calculateMaxSubtaskDuration,
    calculateAverageProgress
  }
}
