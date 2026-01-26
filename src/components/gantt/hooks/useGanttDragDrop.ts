/**
 * Hook de drag & drop para reordenar tarefas no Gantt
 * Permite arrastar e soltar tarefas para trocar sort_order
 */

import { useState, useCallback } from 'react'
import { Task } from '@/types/database.types'
import { supabase } from '@/lib/supabase'

export function useGanttDragDrop(
  tasks: Task[],
  onRefresh: () => void
) {
  const [draggedTask, setDraggedTask] = useState<string | null>(null)
  const [dragOverTask, setDragOverTask] = useState<string | null>(null)

  const handleDragStart = useCallback((taskId: string) => {
    setDraggedTask(taskId)
  }, [])

  const handleDragOver = useCallback((taskId: string) => {
    setDragOverTask(taskId)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedTask(null)
    setDragOverTask(null)
  }, [])

  const handleReorderTasks = useCallback(async (draggedId: string, targetId: string) => {
    const draggedTask = tasks.find(t => t.id === draggedId)
    const targetTask = tasks.find(t => t.id === targetId)

    if (!draggedTask || !targetTask) return

    // Trocar sort_order entre as duas tarefas
    const draggedOrder = draggedTask.sort_order
    const targetOrder = targetTask.sort_order

    try {
      // Atualizar ambas as tarefas
      await supabase
        .from('tasks')
        .update({ sort_order: targetOrder })
        .eq('id', draggedId)

      await supabase
        .from('tasks')
        .update({ sort_order: draggedOrder })
        .eq('id', targetId)

      onRefresh()
    } catch (error) {
      console.error('Error reordering tasks:', error)
      alert('Erro ao reordenar tarefas')
    }
  }, [tasks, onRefresh])

  const handleDrop = useCallback(async () => {
    if (draggedTask && dragOverTask && draggedTask !== dragOverTask) {
      await handleReorderTasks(draggedTask, dragOverTask)
    }
    handleDragEnd()
  }, [draggedTask, dragOverTask, handleReorderTasks, handleDragEnd])

  return {
    draggedTask,
    dragOverTask,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDrop,
    handleReorderTasks
  }
}
