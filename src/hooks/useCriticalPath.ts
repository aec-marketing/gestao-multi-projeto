/**
 * Custom hook para calcular e gerenciar o caminho crítico
 */

import { useCallback, useEffect, useState } from 'react'
import { Task } from '@/types/database.types'
import { calculateCriticalPath, CPMResult, updateCriticalPathFlags } from '@/utils/criticalPath'
import { supabase } from '@/lib/supabase'

interface Predecessor {
  id: string
  task_id: string
  predecessor_id: string
  type: string
  lag_time: number
}

export function useCriticalPath(projectId: string, tasks: Task[], predecessors: Predecessor[]) {
  const [cpmResult, setCpmResult] = useState<CPMResult | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [lastCalculated, setLastCalculated] = useState<Date | null>(null)

  /**
   * Calcula o caminho crítico e atualiza o estado
   */
  const calculate = useCallback(async () => {
    if (tasks.length === 0) {
      setCpmResult(null)
      return
    }

    setIsCalculating(true)

    try {
      // Calcular CPM
      const result = calculateCriticalPath(tasks, predecessors)
      setCpmResult(result)
      setLastCalculated(new Date())

      // Atualizar flags no banco de dados
      const updates = updateCriticalPathFlags(tasks, result)

      if (updates.length > 0) {
        // Atualizar em batch
        const promises = updates.map(({ taskId, isCritical }) =>
          supabase
            .from('tasks')
            .update({ is_critical_path: isCritical })
            .eq('id', taskId)
        )

        await Promise.all(promises)
      }
    } catch (error) {
      console.error('Erro ao calcular caminho crítico:', error)
    } finally {
      setIsCalculating(false)
    }
  }, [tasks, predecessors])

  /**
   * Recalcula automaticamente quando tasks ou predecessors mudam
   */
  useEffect(() => {
    // Aguardar um pequeno delay para evitar múltiplos cálculos durante edição
    const timer = setTimeout(() => {
      calculate()
    }, 500)

    return () => clearTimeout(timer)
  }, [calculate])

  /**
   * Verifica se uma tarefa está no caminho crítico
   */
  const isTaskCritical = useCallback((taskId: string): boolean => {
    return cpmResult?.criticalPath.includes(taskId) || false
  }, [cpmResult])

  /**
   * Obtém informações de slack de uma tarefa
   */
  const getTaskSlack = useCallback((taskId: string) => {
    return cpmResult?.tasks.get(taskId)
  }, [cpmResult])

  /**
   * Força um recálculo manual
   */
  const recalculate = useCallback(() => {
    calculate()
  }, [calculate])

  return {
    cpmResult,
    isCalculating,
    lastCalculated,
    isTaskCritical,
    getTaskSlack,
    recalculate
  }
}
