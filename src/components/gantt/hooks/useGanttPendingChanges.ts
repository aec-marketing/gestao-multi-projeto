/**
 * Hook para gerenciar mudanças pendentes no Gantt (resize, drag)
 * Similar ao usePendingChanges da aba Tabela
 *
 * Mantém um Map de mudanças que ainda não foram salvas,
 * evitando refresh automático após cada resize/drag
 */

import { useState, useCallback } from 'react'
import { Task } from '@/types/database.types'

export interface GanttPendingChange {
  taskId: string
  taskName: string
  changes: {
    start_date?: string
    end_date?: string
    duration_minutes?: number
    margin_start?: number
    margin_end?: number
  }
  originalValues: {
    start_date?: string
    end_date?: string
    duration_minutes?: number
    margin_start?: number
    margin_end?: number
  }
  interactionType: 'resize' | 'drag'
}

export function useGanttPendingChanges() {
  const [pendingChanges, setPendingChanges] = useState<Map<string, GanttPendingChange>>(new Map())

  /**
   * Adiciona ou atualiza uma mudança pendente
   */
  const addChange = useCallback((change: GanttPendingChange) => {
    setPendingChanges(prev => {
      const newMap = new Map(prev)

      // Se já existe uma mudança para esta tarefa, mesclar
      const existing = newMap.get(change.taskId)
      if (existing) {
        newMap.set(change.taskId, {
          ...existing,
          changes: { ...existing.changes, ...change.changes },
          interactionType: change.interactionType
        })
      } else {
        newMap.set(change.taskId, change)
      }

      return newMap
    })
  }, [])

  /**
   * Remove uma mudança pendente específica
   */
  const removeChange = useCallback((taskId: string) => {
    setPendingChanges(prev => {
      const newMap = new Map(prev)
      newMap.delete(taskId)
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
   * Verifica se uma tarefa tem mudança pendente
   */
  const hasChange = useCallback((taskId: string) => {
    return pendingChanges.has(taskId)
  }, [pendingChanges])

  /**
   * Obtém a mudança pendente de uma tarefa
   */
  const getChange = useCallback((taskId: string) => {
    return pendingChanges.get(taskId)
  }, [pendingChanges])

  /**
   * Obtém o valor atual de um campo (considerando pending ou original)
   */
  const getCurrentValue = useCallback(<K extends keyof GanttPendingChange['changes']>(
    taskId: string,
    field: K,
    originalValue: any
  ) => {
    const change = getChange(taskId)
    if (change && change.changes[field] !== undefined) {
      return change.changes[field]
    }
    return originalValue
  }, [getChange])

  /**
   * Converte mudanças pendentes para array (para exibição na UI)
   */
  const getPendingChangesArray = useCallback(() => {
    return Array.from(pendingChanges.values())
  }, [pendingChanges])

  /**
   * Conta total de mudanças pendentes
   */
  const getPendingCount = useCallback(() => {
    return pendingChanges.size
  }, [pendingChanges])

  return {
    pendingChanges,
    addChange,
    removeChange,
    clearChanges,
    hasChange,
    getChange,
    getCurrentValue,
    getPendingChangesArray,
    getPendingCount
  }
}
