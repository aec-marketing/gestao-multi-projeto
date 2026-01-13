import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Task } from '@/types/database.types'
import { queryKeys } from './queryKeys'
import { logError, showSuccessAlert, showErrorAlert, ErrorContext } from '@/utils/errorHandler'
import { syncTaskFields } from '@/utils/taskDateSync'

// ==================== QUERIES ====================

/**
 * Query para buscar todas as tasks de um projeto
 */
export function useProjectTasks(projectId: string) {
  return useQuery({
    queryKey: queryKeys.tasks.byProject(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true })

      if (error) throw error
      return data as Task[]
    },
    enabled: !!projectId
  })
}

// ==================== MUTATIONS ====================

/**
 * Interface para batch update
 */
export interface BatchUpdateItem {
  id: string
  updates: Partial<Task>
}

/**
 * Mutation para atualizar múltiplas tasks de uma vez (batch update)
 * Inclui optimistic updates e rollback automático em caso de erro
 */
export function useBatchUpdateTasks(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates: BatchUpdateItem[]) => {
      const results: Task[] = []
      const errors: Array<{ id: string; error: any }> = []

      // Executar todas as atualizações
      for (const { id, updates: taskUpdates } of updates) {
        try {
          const { data, error } = await supabase
            .from('tasks')
            .update(taskUpdates)
            .eq('id', id)
            .select()
            .single()

          if (error) throw error
          results.push(data)
        } catch (error) {
          errors.push({ id, error })
        }
      }

      // Se houve erros, lançar com informações
      if (errors.length > 0) {
        throw {
          message: `${errors.length} de ${updates.length} atualizações falharam`,
          errors,
          successCount: results.length,
          results
        }
      }

      return results
    },

    // Optimistic Update: Atualizar UI imediatamente
    onMutate: async (updates) => {
      // Cancelar queries em andamento para evitar conflitos
      await queryClient.cancelQueries({
        queryKey: queryKeys.tasks.byProject(projectId)
      })

      // Snapshot do estado anterior (para rollback)
      const previousTasks = queryClient.getQueryData<Task[]>(
        queryKeys.tasks.byProject(projectId)
      )

      // Aplicar updates otimistas na UI
      if (previousTasks) {
        const optimisticTasks = previousTasks.map(task => {
          const update = updates.find(u => u.id === task.id)
          return update ? { ...task, ...update.updates } : task
        })

        queryClient.setQueryData(
          queryKeys.tasks.byProject(projectId),
          optimisticTasks
        )
      }

      // Retornar contexto para uso em onError
      return { previousTasks }
    },

    // Em caso de erro, reverter para estado anterior
    onError: (error: any, variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(
          queryKeys.tasks.byProject(projectId),
          context.previousTasks
        )
      }

      // Log e alerta de erro
      logError(error, 'batchUpdateTasks')

      // Mensagem de erro personalizada
      const errorMessage = error.errors
        ? `${error.successCount} alteração(ões) salva(s), ${error.errors.length} com erro`
        : 'Erro ao salvar alterações'

      showErrorAlert(error, ErrorContext.TASK_UPDATE)
    },

    // Em caso de sucesso, invalidar cache para refetch
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.tasks.byProject(projectId)
      })

      showSuccessAlert(`${variables.length} alteração(ões) salva(s) com sucesso`)
    }
  })
}

/**
 * Mutation para criar uma nova task
 */
export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (newTask: Partial<Task>) => {
      const { data, error } = await supabase
        .from('tasks')
        .insert({ ...newTask, project_id: projectId })
        .select()
        .single()

      if (error) throw error
      return data as Task
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.tasks.byProject(projectId)
      })
      showSuccessAlert('Tarefa criada com sucesso')
    },

    onError: (error) => {
      logError(error, 'createTask')
      showErrorAlert(error, ErrorContext.TASK_CREATE)
    }
  })
}

/**
 * Mutation para deletar uma task
 */
export function useDeleteTask(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)

      if (error) throw error
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.tasks.byProject(projectId)
      })
      showSuccessAlert('Tarefa excluída com sucesso')
    },

    onError: (error) => {
      logError(error, 'deleteTask')
      showErrorAlert(error, ErrorContext.TASK_DELETE)
    }
  })
}

/**
 * Mutation para atualizar uma única task
 */
export function useUpdateTask(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Task
    },

    // Optimistic update
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.tasks.byProject(projectId)
      })

      const previousTasks = queryClient.getQueryData<Task[]>(
        queryKeys.tasks.byProject(projectId)
      )

      if (previousTasks) {
        const optimisticTasks = previousTasks.map(task =>
          task.id === id ? { ...task, ...updates } : task
        )

        queryClient.setQueryData(
          queryKeys.tasks.byProject(projectId),
          optimisticTasks
        )
      }

      return { previousTasks }
    },

    onError: (error, variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(
          queryKeys.tasks.byProject(projectId),
          context.previousTasks
        )
      }

      logError(error, 'updateTask')
      showErrorAlert(error, ErrorContext.TASK_UPDATE)
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.tasks.byProject(projectId)
      })
    }
  })
}
