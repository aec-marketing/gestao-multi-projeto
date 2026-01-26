import { useState, useCallback } from 'react'
import { Task } from '@/types/database.types'
import { syncTaskFields } from '@/utils/taskDateSync'
import { BatchUpdateItem } from '@/queries/tasks.queries'

export interface PendingChange {
  taskId: string
  field: string
  value: any
  originalValue: any
  taskName: string
}

/**
 * Hook para gerenciar mudanças pendentes no batch editing
 *
 * Mantém um Map de mudanças que ainda não foram salvas,
 * permite adicionar, remover, e preparar para batch update
 */
export function usePendingChanges() {
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChange>>(new Map())

  /**
   * Adiciona ou remove uma mudança pendente
   * Se o valor não mudou, remove da lista
   */
  const addChange = useCallback((
    taskId: string,
    field: string,
    value: any,
    originalValue: any,
    taskName: string
  ) => {
    // Verificar se valor realmente mudou
    if (valuesAreEqual(value, originalValue)) {
      // Remover da lista se existir
      setPendingChanges(prev => {
        const newMap = new Map(prev)
        newMap.delete(`${taskId}-${field}`)
        return newMap
      })
      return
    }

    // Adicionar mudança
    setPendingChanges(prev => {
      const newMap = new Map(prev)
      newMap.set(`${taskId}-${field}`, {
        taskId,
        field,
        value,
        originalValue,
        taskName
      })
      return newMap
    })
  }, [])

  /**
   * Limpa todas as mudanças pendentes
   */
  const clearChanges = useCallback(() => {
    setPendingChanges(new Map())
  }, [])

  /**
   * Verifica se um campo específico tem mudança pendente
   */
  const hasChange = useCallback((taskId: string, field: string) => {
    return pendingChanges.has(`${taskId}-${field}`)
  }, [pendingChanges])

  /**
   * Obtém uma mudança pendente específica
   */
  const getChange = useCallback((taskId: string, field: string) => {
    return pendingChanges.get(`${taskId}-${field}`)
  }, [pendingChanges])

  /**
   * Obtém o valor atual de um campo (original ou pendente)
   */
  const getCurrentValue = useCallback((taskId: string, field: string, originalValue: any) => {
    const change = getChange(taskId, field)
    return change ? change.value : originalValue
  }, [getChange])

  /**
   * Prepara as mudanças pendentes para batch update
   * Agrupa por task e aplica sincronização de datas
   */
  const prepareBatchUpdates = useCallback((tasks: Task[]): BatchUpdateItem[] => {
    // Agrupar mudanças por task
    const groupedByTask = new Map<string, Map<string, any>>()

    for (const [key, change] of pendingChanges.entries()) {
      if (!groupedByTask.has(change.taskId)) {
        groupedByTask.set(change.taskId, new Map())
      }
      groupedByTask.get(change.taskId)!.set(change.field, change.value)
    }

    // Preparar updates com sincronização de datas
    const updates: BatchUpdateItem[] = []

    for (const [taskId, fields] of groupedByTask.entries()) {
      const currentTask = tasks.find(t => t.id === taskId)
      if (!currentTask) continue

      const taskUpdates: any = {}

      // Processar cada campo
      for (const [field, value] of fields.entries()) {
        if (field === 'name' || field === 'progress') {
          taskUpdates[field] = value
        } else if (field === 'estimated_cost' || field === 'actual_cost') {
          taskUpdates[field] = value ? parseFloat(value as string) : 0
        } else if (field === 'lag_days') {
          // lag_days é definido diretamente
          taskUpdates[field] = typeof value === 'number' ? value : parseInt(value as string)
        } else if (field === 'duration') {
          // ONDA 2: Ignorar campo duration (é computed/readonly)
          // Usar duration_minutes ao invés
          continue
        } else if (field === 'duration_minutes') {
          // ONDA 2: Campo duration_minutes substituiu duration
          taskUpdates[field] = typeof value === 'number' ? value : parseInt(value as string)
        } else if (field === 'work_type') {
          // ONDA 3: Work type (produção/dependência/checkpoint)
          taskUpdates[field] = value
        } else if (field === 'start_date' || field === 'end_date') {
          // Mudanças de data aplicadas diretamente
          taskUpdates[field] = value
        }
      }

      updates.push({ id: taskId, updates: taskUpdates })
    }

    return updates
  }, [pendingChanges])

  return {
    pendingChanges,
    addChange,
    clearChanges,
    hasChange,
    getChange,
    getCurrentValue,
    prepareBatchUpdates,
    changeCount: pendingChanges.size
  }
}

/**
 * Compara dois valores para verificar se são iguais
 * Normaliza valores vazios (null, undefined, '') para null
 */
function valuesAreEqual(value1: any, value2: any): boolean {
  const normalize = (val: any) => {
    if (val === null || val === undefined || val === '') return null
    if (typeof val === 'string') return val.trim()
    return val
  }

  const v1 = normalize(value1)
  const v2 = normalize(value2)

  return v1 === v2
}
