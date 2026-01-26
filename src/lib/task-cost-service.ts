/**
 * Serviço para cálculo e atualização de custos de tarefas
 *
 * ONDA 1: Calcula custo baseado em recursos alocados (100% da tarefa)
 * ONDA 3: Suportará alocação parcial e hora extra
 */

import { supabase } from '@/lib/supabase'
import { calculateTotalCost } from '@/utils/cost.utils'
import { Resource } from '@/types/database.types'
import { Allocation } from '@/types/allocation.types'

/**
 * Recalcula e atualiza o custo real de uma tarefa baseado nos recursos alocados
 *
 * @param taskId - ID da tarefa
 * @returns Custo calculado ou null se erro
 *
 * @example
 * await updateTaskActualCost('task-123')
 * // Busca todos os recursos alocados nesta tarefa
 * // Calcula custo total
 * // Atualiza task.actual_cost
 */
export async function updateTaskActualCost(taskId: string): Promise<number | null> {
  try {
    // 1. Buscar a tarefa para obter duration_minutes
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('duration_minutes')
      .eq('id', taskId)
      .single()

    if (taskError || !task) {
      console.error('Erro ao buscar tarefa:', taskError)
      return null
    }

    // 2. Buscar todas as alocações desta tarefa
    const { data: allocations, error: allocError } = await supabase
      .from('allocations')
      .select('resource_id, allocated_minutes, overtime_minutes, overtime_multiplier')
      .eq('task_id', taskId)

    if (allocError) {
      console.error('Erro ao buscar alocações:', allocError)
      return null
    }

    // Se não tem alocações, custo = 0
    if (!allocations || allocations.length === 0) {
      await supabase
        .from('tasks')
        .update({ actual_cost: 0 })
        .eq('id', taskId)

      return 0
    }

    // 3. Buscar informações dos recursos (hourly_rate)
    const resourceIds = allocations.map(a => a.resource_id)
    const { data: resources, error: resourceError } = await supabase
      .from('resources')
      .select('id, hourly_rate')
      .in('id', resourceIds)

    if (resourceError || !resources) {
      console.error('Erro ao buscar recursos:', resourceError)
      return null
    }

    // 4. Calcular custo total
    const totalCost = calculateTotalCost(
      task.duration_minutes,
      resources as Pick<Resource, 'id' | 'hourly_rate'>[],
      allocations as Allocation[]
    )

    // 5. Atualizar task.actual_cost
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ actual_cost: totalCost })
      .eq('id', taskId)

    if (updateError) {
      console.error('Erro ao atualizar custo da tarefa:', updateError)
      return null
    }

    return totalCost
  } catch (error) {
    console.error('Erro em updateTaskActualCost:', error)
    return null
  }
}

/**
 * Recalcula custos de todas as subtarefas de um pai e atualiza o pai
 *
 * @param parentTaskId - ID da tarefa pai
 * @returns Custo total ou null se erro
 *
 * @example
 * await updateParentTaskCost('parent-task-123')
 * // Recalcula custo de todas as subtarefas
 * // Soma os custos
 * // Atualiza custo do pai
 */
export async function updateParentTaskCost(parentTaskId: string): Promise<number | null> {
  try {
    // 1. Buscar todas as subtarefas
    const { data: subtasks, error: subtasksError } = await supabase
      .from('tasks')
      .select('id')
      .eq('parent_id', parentTaskId)

    if (subtasksError) {
      console.error('Erro ao buscar subtarefas:', subtasksError)
      return null
    }

    if (!subtasks || subtasks.length === 0) {
      // Sem subtarefas, calcular custo próprio
      return await updateTaskActualCost(parentTaskId)
    }

    // 2. Recalcular custo de cada subtarefa
    const costs = await Promise.all(
      subtasks.map(st => updateTaskActualCost(st.id))
    )

    // 3. Somar custos
    const totalCost = costs
      .filter((c): c is number => c !== null)
      .reduce((sum, c) => sum + c, 0)

    // 4. Atualizar custo do pai
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ actual_cost: totalCost })
      .eq('id', parentTaskId)

    if (updateError) {
      console.error('Erro ao atualizar custo do pai:', updateError)
      return null
    }

    return totalCost
  } catch (error) {
    console.error('Erro em updateParentTaskCost:', error)
    return null
  }
}

/**
 * Recalcula custos de todo o projeto
 *
 * @param projectId - ID do projeto
 * @returns Custo total ou null se erro
 *
 * @example
 * await updateProjectCost('project-123')
 * // Recalcula custo de todas as tarefas do projeto
 * // Soma os custos
 */
export async function updateProjectCost(projectId: string): Promise<number | null> {
  try {
    // 1. Buscar todas as tarefas do projeto
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id')
      .eq('project_id', projectId)

    if (tasksError || !tasks) {
      console.error('Erro ao buscar tarefas do projeto:', tasksError)
      return null
    }

    // 2. Recalcular custo de cada tarefa
    await Promise.all(
      tasks.map(t => updateTaskActualCost(t.id))
    )

    // 3. Buscar custos atualizados
    const { data: updatedTasks, error: fetchError } = await supabase
      .from('tasks')
      .select('actual_cost')
      .eq('project_id', projectId)

    if (fetchError || !updatedTasks) {
      console.error('Erro ao buscar custos atualizados:', fetchError)
      return null
    }

    // 4. Somar todos os custos
    const totalCost = updatedTasks.reduce((sum, t) => sum + (t.actual_cost || 0), 0)

    return totalCost
  } catch (error) {
    console.error('Erro em updateProjectCost:', error)
    return null
  }
}

/**
 * 🔮 ONDA 3: Calcular custo com hora extra
 *
 * function calculateOvertimeCost(
 *   regularMinutes: number,
 *   overtimeMinutes: number,
 *   hourlyRate: number,
 *   overtimeMultiplier: number = 1.5
 * ): number {
 *   const regularCost = (regularMinutes / 60) * hourlyRate
 *   const overtimeCost = (overtimeMinutes / 60) * hourlyRate * overtimeMultiplier
 *   return regularCost + overtimeCost
 * }
 */
