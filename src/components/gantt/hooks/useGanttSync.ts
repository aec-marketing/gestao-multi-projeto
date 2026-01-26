/**
 * Hook de sincronização de datas e verificação de conflitos
 * Gerencia sincronização de tarefas pai/filho e auditoria de predecessores
 * ONDA 2: Atualizado para usar duration_minutes
 */

import { useCallback } from 'react'
import { Task } from '@/types/database.types'
import { supabase } from '@/lib/supabase'
import { parseLocalDate } from '@/utils/date.utils'
import { auditPredecessorConflicts } from '@/utils/predecessorCalculations'
import { daysToMinutes } from '@/utils/time.utils'

export function useGanttSync(
  projectId: string,
  tasks: Task[],
  predecessors: any[],
  onRefresh: () => void,
  onPendingUpdates: (updates: any[]) => void
) {
  /**
   * Sincronizar TODAS as datas de tarefas pai baseado nos filhos
   */
  const syncAllParentDates = useCallback(async () => {
    try {
      // Buscar tarefas atualizadas do banco
      const { data: currentTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)

      if (!currentTasks) return

      // Encontrar todas as tarefas pai
      const parentTasks = currentTasks.filter(task =>
        currentTasks.some(t => t.parent_id === task.id)
      )

      // Para cada pai, recalcular datas baseado nos filhos
      for (const parent of parentTasks) {
        const subtasks = currentTasks.filter(
          t => t.parent_id === parent.id && t.start_date && t.end_date
        )

        if (subtasks.length === 0) continue

        const startDates = subtasks
          .map(t => parseLocalDate(t.start_date!))
          .filter(Boolean) as Date[]
        const endDates = subtasks
          .map(t => parseLocalDate(t.end_date!))
          .filter(Boolean) as Date[]

        if (startDates.length === 0 || endDates.length === 0) continue

        // Encontrar earliest start e latest end
        let earliestStart = new Date(Math.min(...startDates.map(d => d.getTime())))
        let latestEnd = new Date(Math.max(...endDates.map(d => d.getTime())))

        // Aplicar margens se existirem
        if (parent.margin_start && parent.margin_start > 0) {
          earliestStart.setDate(earliestStart.getDate() - Math.ceil(parent.margin_start))
        }
        if (parent.margin_end && parent.margin_end > 0) {
          latestEnd.setDate(latestEnd.getDate() + Math.ceil(parent.margin_end))
        }

        const formattedStart = earliestStart.toISOString().split('T')[0]
        const formattedEnd = latestEnd.toISOString().split('T')[0]

        const newDuration = Math.max(
          1,
          Math.ceil((latestEnd.getTime() - earliestStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
        )

        // Converter para minutos (ONDA 2)
        const newDurationMinutes = daysToMinutes(newDuration)

        // Atualizar apenas se houver mudança
        if (
          parent.start_date !== formattedStart ||
          parent.end_date !== formattedEnd ||
          parent.duration_minutes !== newDurationMinutes
        ) {
          await supabase
            .from('tasks')
            .update({
              start_date: formattedStart,
              end_date: formattedEnd,
              duration_minutes: newDurationMinutes
            })
            .eq('id', parent.id)
        }
      }

      onRefresh()
      alert(`✅ Sincronização concluída! ${parentTasks.length} tarefas pai atualizadas.`)
    } catch (error) {
      console.error('Error syncing parent dates:', error)
      alert('Erro ao sincronizar datas das tarefas pai')
    }
  }, [projectId, onRefresh])

  /**
   * Recalcular datas de um pai específico baseado nos filhos
   */
  const recalculateParentDatesFromSubtasks = useCallback(async (parentId: string) => {
    try {
      const { data: currentTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)

      if (!currentTasks) return

      const subtasks = currentTasks.filter(
        t => t.parent_id === parentId && t.start_date && t.end_date
      )

      if (subtasks.length === 0) return

      const startDates = subtasks
        .map(t => parseLocalDate(t.start_date!))
        .filter(Boolean) as Date[]
      const endDates = subtasks
        .map(t => parseLocalDate(t.end_date!))
        .filter(Boolean) as Date[]

      if (startDates.length === 0 || endDates.length === 0) return

      let earliestStart = new Date(Math.min(...startDates.map(d => d.getTime())))
      let latestEnd = new Date(Math.max(...endDates.map(d => d.getTime())))

      const parent = currentTasks.find(t => t.id === parentId)
      if (!parent) return

      // Aplicar margens
      if (parent.margin_start && parent.margin_start > 0) {
        earliestStart.setDate(earliestStart.getDate() - Math.ceil(parent.margin_start))
      }
      if (parent.margin_end && parent.margin_end > 0) {
        latestEnd.setDate(latestEnd.getDate() + Math.ceil(parent.margin_end))
      }

      const formattedStart = earliestStart.toISOString().split('T')[0]
      const formattedEnd = latestEnd.toISOString().split('T')[0]

      const newDuration = Math.max(
        1,
        Math.ceil((latestEnd.getTime() - earliestStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
      )

      // Converter para minutos (ONDA 2)
      const newDurationMinutes = daysToMinutes(newDuration)

      await supabase
        .from('tasks')
        .update({
          start_date: formattedStart,
          end_date: formattedEnd,
          duration_minutes: newDurationMinutes
        })
        .eq('id', parentId)
    } catch (error) {
      console.error('Error recalculating parent dates:', error)
    }
  }, [projectId])

  /**
   * Auditar conflitos de predecessores
   */
  const auditConflicts = useCallback(async () => {
    try {
      // Buscar dados atualizados
      const { data: allTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)

      const { data: allPredecessors } = await supabase
        .from('predecessors')
        .select('*')

      if (!allTasks || !allPredecessors) return

      // Verificar se há pais desatualizados
      const parentTasks = allTasks.filter(task =>
        allTasks.some(t => t.parent_id === task.id)
      )

      let parentsNeedSync = 0

      for (const parent of parentTasks) {
        const subtasks = allTasks.filter(
          t => t.parent_id === parent.id && t.start_date && t.end_date
        )

        if (subtasks.length === 0) continue

        const startDates = subtasks
          .map(t => parseLocalDate(t.start_date!))
          .filter(Boolean) as Date[]
        const endDates = subtasks
          .map(t => parseLocalDate(t.end_date!))
          .filter(Boolean) as Date[]

        if (startDates.length === 0 || endDates.length === 0) continue

        const earliestStart = new Date(Math.min(...startDates.map(d => d.getTime())))
        const latestEnd = new Date(Math.max(...endDates.map(d => d.getTime())))

        const currentStart = parent.start_date ? parseLocalDate(parent.start_date) : null
        const currentEnd = parent.end_date ? parseLocalDate(parent.end_date) : null

        if (
          !currentStart ||
          !currentEnd ||
          Math.abs(currentStart.getTime() - earliestStart.getTime()) > 86400000 ||
          Math.abs(currentEnd.getTime() - latestEnd.getTime()) > 86400000
        ) {
          parentsNeedSync++
        }
      }

      if (parentsNeedSync > 0) {
        const userChoice = confirm(
          `⚠️ Encontradas ${parentsNeedSync} tarefas pai com datas desatualizadas.\n\nDeseja sincronizar as datas antes de verificar conflitos?`
        )

        if (userChoice) {
          await syncAllParentDates()
          return
        }
      }

      // Executar auditoria de conflitos
      const conflicts = auditPredecessorConflicts(allTasks, allPredecessors)

      // Filtrar falsos positivos (pais com filhos que já começaram)
      const filteredConflicts = conflicts.filter(conflict => {
        const task = allTasks.find(t => t.id === conflict.id)
        if (!task) return true

        const isParent = allTasks.some(t => t.parent_id === task.id)
        if (!isParent) return true

        const subtasks = allTasks.filter(
          t => t.parent_id === task.id && t.start_date && t.end_date
        )

        if (subtasks.length === 0) return true

        const startDates = subtasks
          .map(t => parseLocalDate(t.start_date!))
          .filter(Boolean) as Date[]

        if (startDates.length === 0) return true

        const earliestChildStart = new Date(Math.min(...startDates.map(d => d.getTime())))
        const proposedParentStart = new Date(conflict.start_date)

        // Conflito real se proposta é DEPOIS dos filhos
        return proposedParentStart > earliestChildStart
      })

      if (filteredConflicts.length === 0) {
        alert('✅ Nenhum conflito de predecessor encontrado!')
      } else {
        onPendingUpdates(filteredConflicts)
      }
    } catch (error) {
      console.error('Error auditing conflicts:', error)
      alert('Erro ao auditar conflitos')
    }
  }, [projectId, onPendingUpdates, syncAllParentDates])

  return {
    syncAllParentDates,
    recalculateParentDatesFromSubtasks,
    auditConflicts
  }
}
