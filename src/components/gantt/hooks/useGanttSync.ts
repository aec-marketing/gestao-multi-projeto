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
import { dispatchToast } from '@/components/ui/ToastProvider'

export interface ExclusiveConflict {
  resourceId: string
  resourceName: string
  taskAId: string
  taskA: string
  taskAStart: string
  taskAEnd: string
  taskAAllocationId?: string
  taskBId: string
  taskB: string
  taskBStart: string
  taskBEnd: string
  taskBAllocationId?: string
  // Fim da tarefa que está "ocupando" o dia (a não-empurrada) — usado para calcular lag
  conflictingTaskEnd?: string
  // Predecessor da tarefa empurrada (que a trouxe para o dia conflitante)
  predecessor?: {
    id: string
    predecessorTaskId: string   // quem é o predecessor
    successorTaskId: string     // quem é o sucessor
    type: string
    lag_time: number
    lag_minutes?: number
  }
}

export function useGanttSync(
  projectId: string,
  tasks: Task[],
  predecessors: any[],
  onRefresh: () => void,
  onPendingUpdates: (updates: any[]) => void,
  onExclusiveConflicts?: (conflicts: ExclusiveConflict[]) => void
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
      dispatchToast(`Sincronização concluída! ${parentTasks.length} tarefas pai atualizadas.`, 'success')
    } catch (error) {
      console.error('Error syncing parent dates:', error)
      dispatchToast('Erro ao sincronizar datas das tarefas pai', 'error')
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

      // ── Verificar conflitos de recurso exclusivo ──────────────────────────
      const { data: allAllocations } = await supabase
        .from('allocations')
        .select('id, resource_id, task_id, priority')
        .in('task_id', allTasks.map(t => t.id))

      const { data: allResources } = await supabase
        .from('resources')
        .select('id, name')
        .in('id', [...new Set((allAllocations || []).map(a => a.resource_id))])

      const { data: allPredecessorsForConflicts } = await supabase
        .from('predecessors')
        .select('id, task_id, predecessor_id, type, lag_time, lag_minutes')
        .in('task_id', allTasks.map(t => t.id))

      const exclusiveConflicts: ExclusiveConflict[] = []

      if (allAllocations && allResources) {
        // Agrupar alocações exclusivas por recurso
        type AllocEntry = { taskId: string; taskName: string; start: Date; end: Date; allocId: string }
        const byResource: Record<string, AllocEntry[]> = {}
        for (const alloc of allAllocations) {
          if (alloc.priority !== 'alta') continue
          const task = allTasks.find(t => t.id === alloc.task_id)
          if (!task?.start_date || !task?.end_date) continue
          if (!byResource[alloc.resource_id]) byResource[alloc.resource_id] = []
          byResource[alloc.resource_id].push({
            taskId: task.id,
            taskName: task.name,
            start: new Date(task.start_date + 'T00:00:00'),
            end:   new Date(task.end_date   + 'T00:00:00'),
            allocId: alloc.id,
          })
        }

        for (const [resourceId, entries] of Object.entries(byResource)) {
          if (entries.length < 2) continue
          const resourceName = allResources.find(r => r.id === resourceId)?.name ?? resourceId
          for (let i = 0; i < entries.length; i++) {
            for (let j = i + 1; j < entries.length; j++) {
              const a = entries[i], b = entries[j]
              if (!(a.start <= b.end && b.start <= a.end)) continue

              // A tarefa "empurrada" é a que tem predecessor — foi ele que a colocou nesse dia
              const predsOfA = (allPredecessorsForConflicts || []).filter(p => p.task_id === a.taskId)
              const predsOfB = (allPredecessorsForConflicts || []).filter(p => p.task_id === b.taskId)

              const pred        = predsOfA.length > 0 ? predsOfA[0] : predsOfB.length > 0 ? predsOfB[0] : null
              const outraTarefa = predsOfA.length > 0 ? b : a

              exclusiveConflicts.push({
                resourceId,
                resourceName,
                taskAId: a.taskId,
                taskA: a.taskName,
                taskAStart: a.start.toISOString().split('T')[0],
                taskAEnd: a.end.toISOString().split('T')[0],
                taskAAllocationId: a.allocId,
                taskBId: b.taskId,
                taskB: b.taskName,
                taskBStart: b.start.toISOString().split('T')[0],
                taskBEnd: b.end.toISOString().split('T')[0],
                taskBAllocationId: b.allocId,
                // conflictingTaskEnd: fim da tarefa que está "ocupando" o dia (a não-empurrada)
                conflictingTaskEnd: outraTarefa.end.toISOString().split('T')[0],
                predecessor: pred ? {
                  id: pred.id,
                  predecessorTaskId: pred.predecessor_id,
                  successorTaskId: pred.task_id,
                  type: pred.type,
                  lag_time: pred.lag_time ?? 0,
                  lag_minutes: pred.lag_minutes,
                } : undefined,
              })
            }
          }
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      if (filteredConflicts.length === 0 && exclusiveConflicts.length === 0) {
        dispatchToast('Nenhum conflito encontrado ✅', 'success')
      }

      if (filteredConflicts.length > 0) {
        onPendingUpdates(filteredConflicts)
      }

      if (exclusiveConflicts.length > 0) {
        if (onExclusiveConflicts) {
          onExclusiveConflicts(exclusiveConflicts)
        } else {
          dispatchToast(
            `⚠️ ${exclusiveConflicts.length} conflito(s) de recurso exclusivo`,
            'error'
          )
        }
      }
    } catch (error) {
      console.error('Error auditing conflicts:', error)
      dispatchToast('Erro ao auditar conflitos', 'error')
    }
  }, [projectId, onPendingUpdates, syncAllParentDates])

  return {
    syncAllParentDates,
    recalculateParentDatesFromSubtasks,
    auditConflicts
  }
}
