/**
 * Hook de resize de tarefas no Gantt
 * FIX CRÍTICO: Corrige bug de zoom (resize agora respeita zoomLevel)
 * ONDA 2: Atualizado para usar duration_minutes
 */

import { useState, useCallback, useEffect } from 'react'
import { Task } from '@/types/database.types'
import { TaskWithDates, ResizeState } from '../types/gantt.types'
import { supabase } from '@/lib/supabase'
import { daysToMinutes, minutesToDays } from '@/utils/time.utils'
import { getColumnWidth } from '../utils/ganttCalculations'
import { validateTaskStartDate, recalculateTasksInCascade } from '@/utils/predecessorCalculations'
import { parseLocalDate } from '@/utils/date.utils'
import { GanttPendingChange } from './useGanttPendingChanges'

export function useGanttResize(
  tasks: Task[],
  tasksWithDates: TaskWithDates[],
  predecessors: any[],
  projectId: string,
  zoomLevel: 'day' | 'week' | 'month',
  onTempDurationChange: (taskId: string, duration: number | undefined) => void,
  onTempStartOffsetChange: (taskId: string, offset: number | undefined) => void,
  onResizeStateChange: (state: ResizeState | null) => void,
  onPendingUpdates: (updates: any[]) => void,
  onAddPendingChange: (change: GanttPendingChange) => void,
  onRefresh: () => void
) {
  const [resizingTask, setResizingTask] = useState<ResizeState | null>(null)

  const handleResizeStart = useCallback((
    taskId: string,
    edge: 'start' | 'end',
    e: React.MouseEvent
  ) => {
    e.stopPropagation()
    e.preventDefault()

    const target = e.currentTarget.parentElement as HTMLElement
    const rect = target.getBoundingClientRect()

    const resizeState = {
      taskId,
      edge,
      startX: e.clientX,
      startWidth: rect.width,
      startLeft: rect.left
    }

    setResizingTask(resizeState)
    onResizeStateChange(resizeState)
  }, [onResizeStateChange])

  // useEffect para mouse events (move e up)
  useEffect(() => {
    if (!resizingTask) {
      document.body.classList.remove('resizing')
      return
    }

    document.body.classList.add('resizing')

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizingTask.startX

      // FIX CRÍTICO: Usar getColumnWidth ao invés de hardcoded 50
      const pixelsPerDay = getColumnWidth(zoomLevel)
      const deltaDays = deltaX / pixelsPerDay

      const task = tasksWithDates.find(t => t.id === resizingTask.taskId)
      if (!task) return

      if (resizingTask.edge === 'end') {
        // Resize borda direita: aumenta/diminui duração
        // Snap de 15 minutos = 0.25 horas = 1/36 de dia ≈ 0.0278
        const snapIncrement = 1 / 36 // 15 minutos
        const newDuration = Math.max(snapIncrement, task.duration_days + deltaDays)
        const roundedDuration = Math.round(newDuration / snapIncrement) * snapIncrement
        onTempDurationChange(resizingTask.taskId, roundedDuration)
        onTempStartOffsetChange(resizingTask.taskId, undefined)
      } else {
        // Resize borda esquerda: move início, mantém fim fixo
        // Snap de 15 minutos
        const snapIncrement = 1 / 36
        const newDuration = Math.max(snapIncrement, task.duration_days - deltaDays)
        const roundedDuration = Math.round(newDuration / snapIncrement) * snapIncrement

        onTempDurationChange(resizingTask.taskId, roundedDuration)

        const durationChange = roundedDuration - task.duration_days
        const visualOffset = -durationChange
        onTempStartOffsetChange(resizingTask.taskId, visualOffset)
      }
    }

    const handleMouseUp = async (e: MouseEvent) => {
      const task = tasksWithDates.find(t => t.id === resizingTask.taskId)
      if (!task) return

      const deltaX = e.clientX - resizingTask.startX
      const pixelsPerDay = getColumnWidth(zoomLevel)
      const deltaDays = deltaX / pixelsPerDay

      // Snap de 15 minutos = 1/36 dia
      const snapIncrement = 1 / 36

      let newDuration: number
      if (resizingTask.edge === 'end') {
        newDuration = Math.max(snapIncrement, task.duration_days + deltaDays)
      } else {
        newDuration = Math.max(snapIncrement, task.duration_days - deltaDays)
      }

      const roundedDuration = Math.round(newDuration / snapIncrement) * snapIncrement

      if (Math.abs(roundedDuration - task.duration_days) > 0.01) {
        await updateTaskDuration(resizingTask.taskId, roundedDuration, resizingTask.edge)
      }

      // Limpar estado de resize
      setResizingTask(null)
      onResizeStateChange(null)
      onTempDurationChange(resizingTask.taskId, undefined)
      onTempStartOffsetChange(resizingTask.taskId, undefined)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.body.classList.remove('resizing')
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizingTask, tasksWithDates, zoomLevel, onTempDurationChange, onTempStartOffsetChange, onResizeStateChange])

  const updateTaskDuration = async (
    taskId: string,
    newDurationDays: number,
    edge: 'start' | 'end'
  ) => {
    const roundedDuration = Math.round(newDurationDays / 0.125) * 0.125
    const finalDuration = Math.max(0.125, roundedDuration)

    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    const subtasks = tasks.filter(t => t.parent_id === taskId)
    const hasSubtasks = subtasks.length > 0

    // Converter dias para minutos (ONDA 2)
    const newDurationMinutes = daysToMinutes(finalDuration)

    try {
      if (hasSubtasks) {
        // TAREFAS COM SUBTAREFAS: Ajusta margens (adicionar ao pending)
        const taskWithDates = tasksWithDates.find(t => t.id === taskId)
        if (!taskWithDates) return

        const currentDuration = taskWithDates.duration_days
        const deltaDuration = finalDuration - currentDuration

        if (edge === 'end') {
          // Alça direita: ajusta margin_end
          const newMarginEnd = (task.margin_end || 0) + deltaDuration

          onAddPendingChange({
            taskId,
            taskName: task.name,
            changes: { margin_end: Math.max(0, newMarginEnd) },
            originalValues: { margin_end: task.margin_end || 0 },
            interactionType: 'resize'
          })
        } else {
          // Alça esquerda: ajusta margin_start
          const newMarginStart = (task.margin_start || 0) + deltaDuration

          onAddPendingChange({
            taskId,
            taskName: task.name,
            changes: { margin_start: Math.max(0, newMarginStart) },
            originalValues: { margin_start: task.margin_start || 0 },
            interactionType: 'resize'
          })
        }
      } else {
        // TAREFAS SEM SUBTAREFAS: Ajusta duração e datas (adicionar ao pending)
        if (task.start_date && task.end_date) {
          const startDate = parseLocalDate(task.start_date)
          const endDate = parseLocalDate(task.end_date)

          if (!startDate || !endDate) return

          if (edge === 'end') {
            // Manter start_date, alterar end_date
            const newEndDate = new Date(startDate)
            newEndDate.setDate(newEndDate.getDate() + Math.ceil(finalDuration) - 1)
            const formattedEndDate = newEndDate.toISOString().split('T')[0]

            onAddPendingChange({
              taskId,
              taskName: task.name,
              changes: {
                duration_minutes: newDurationMinutes,
                end_date: formattedEndDate
              },
              originalValues: {
                duration_minutes: task.duration_minutes || 540,
                end_date: task.end_date
              },
              interactionType: 'resize'
            })
          } else {
            // Manter end_date, alterar start_date
            const daysToSubtract = Math.ceil(finalDuration)
            const newStartDate = new Date(endDate)
            newStartDate.setDate(newStartDate.getDate() - daysToSubtract + 1)
            const formattedStartDate = newStartDate.toISOString().split('T')[0]

            // Validação de predecessor
            const validation = validateTaskStartDate(task, newStartDate, tasks, predecessors)
            if (!validation.isValid) {
              alert(`❌ Não é possível mover a tarefa para esta data!\n\n${validation.message}`)
              return
            }

            onAddPendingChange({
              taskId,
              taskName: task.name,
              changes: {
                duration_minutes: newDurationMinutes,
                start_date: formattedStartDate
              },
              originalValues: {
                duration_minutes: task.duration_minutes || 540,
                start_date: task.start_date
              },
              interactionType: 'resize'
            })
          }
        }
      }

      // NÃO fazer refresh automático
      // Mudanças ficam pendentes até usuário salvar
    } catch (error) {
      console.error('Error updating task duration:', error)
      alert('Erro ao atualizar duração da tarefa')
    }
  }

  const recalculateParentDatesFromSubtasks = async (parentId: string) => {
    const { data: currentTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)

    if (!currentTasks) return

    const subtasks = currentTasks.filter(t => t.parent_id === parentId && t.start_date && t.end_date)
    if (subtasks.length === 0) return

    const startDates = subtasks.map(t => parseLocalDate(t.start_date!)).filter(Boolean) as Date[]
    const endDates = subtasks.map(t => parseLocalDate(t.end_date!)).filter(Boolean) as Date[]

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

    const newDuration = Math.max(1, Math.ceil((latestEnd.getTime() - earliestStart.getTime()) / (1000 * 60 * 60 * 24)) + 1)
    const newDurationMinutes = daysToMinutes(newDuration)

    await supabase
      .from('tasks')
      .update({ start_date: formattedStart, end_date: formattedEnd, duration_minutes: newDurationMinutes })
      .eq('id', parentId)
  }

  return {
    resizingTask,
    handleResizeStart
  }
}
