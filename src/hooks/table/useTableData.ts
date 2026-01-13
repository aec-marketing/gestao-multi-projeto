import { useMemo } from 'react'
import { useProjectTasks } from '@/queries/tasks.queries'
import { useActiveResources } from '@/queries/resources.queries'
import { useProjectAllocations } from '@/queries/allocations.queries'

/**
 * Hook para buscar e organizar dados da tabela
 *
 * Centraliza todas as queries e fornece helpers memoizados
 */
export function useTableData(projectId: string) {
  // Queries
  const { data: tasks = [], isLoading: tasksLoading, error: tasksError } = useProjectTasks(projectId)
  const { data: resources = [], isLoading: resourcesLoading } = useActiveResources()

  // Task IDs para buscar allocations
  const taskIds = useMemo(() => tasks.map(t => t.id), [tasks])
  const { data: allocations = [], isLoading: allocationsLoading } = useProjectAllocations(projectId, taskIds)

  // Loading state
  const isLoading = tasksLoading || resourcesLoading || allocationsLoading

  // Main tasks (sem parent_id)
  const mainTasks = useMemo(
    () => tasks.filter(t => !t.parent_id),
    [tasks]
  )

  // Helper: obter subtasks de uma task
  const getSubtasks = useMemo(
    () => (taskId: string) => tasks.filter(t => t.parent_id === taskId),
    [tasks]
  )

  // Helper: obter allocations de uma task
  const getTaskAllocations = useMemo(
    () => (taskId: string) => allocations.filter(a => a.task_id === taskId),
    [allocations]
  )

  // Helper: verificar se task tem subtasks
  const hasSubtasks = useMemo(
    () => (taskId: string) => tasks.some(t => t.parent_id === taskId),
    [tasks]
  )

  return {
    tasks,
    mainTasks,
    resources,
    allocations,
    isLoading,
    error: tasksError,
    getSubtasks,
    getTaskAllocations,
    hasSubtasks
  }
}
