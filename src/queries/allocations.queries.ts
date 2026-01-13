import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from './queryKeys'
import { Allocation } from '@/types/allocation.types'

/**
 * Query para buscar allocations de um projeto
 * Inclui informações do recurso relacionado
 */
export function useProjectAllocations(projectId: string, taskIds: string[]) {
  return useQuery({
    queryKey: queryKeys.allocations.byProject(projectId),
    queryFn: async () => {
      if (taskIds.length === 0) return []

      const { data, error } = await supabase
        .from('allocations')
        .select(`
          *,
          resource:resources(*)
        `)
        .in('task_id', taskIds)

      if (error) throw error
      return data as Allocation[]
    },
    enabled: !!projectId && taskIds.length > 0
  })
}

/**
 * Query para buscar allocations de uma task específica
 */
export function useTaskAllocations(taskId: string) {
  return useQuery({
    queryKey: queryKeys.allocations.byTask(taskId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('allocations')
        .select(`
          *,
          resource:resources(*)
        `)
        .eq('task_id', taskId)

      if (error) throw error
      return data as Allocation[]
    },
    enabled: !!taskId
  })
}
