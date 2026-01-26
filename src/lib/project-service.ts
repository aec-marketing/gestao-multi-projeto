import { supabase } from './supabase'
import { Database } from '@/types/database.types'
import { minutesToDays } from '@/utils/time.utils'

interface EditProjectData {
  code?: string
  name?: string
  category?: string
  vendor_name?: string
  leader_id?: string | null
  complexity?: string
  buffer_days?: number
  start_date?: string | null
  target_end_date?: string | null
  notes?: string | null
  is_active?: boolean
}

interface UpdateResult {
  success: boolean
  error?: string
}

/**
 * Atualiza um projeto no banco de dados
 */
export async function updateProject(
  projectId: string,
  data: EditProjectData
): Promise<UpdateResult> {
  try {
    // Validar dados críticos
    if (data.code) {
      // Verificar se código já existe (exceto para o próprio projeto)
      const { data: existingProject } = await supabase
        .from('projects')
        .select('id')
        .eq('code', data.code)
        .neq('id', projectId)
        .single()

      if (existingProject) {
        return {
          success: false,
          error: `Código "${data.code}" já está em uso por outro projeto`
        }
      }
    }

    // Executar update
    const { error } = await supabase
      .from('projects')
      .update(data)
      .eq('id', projectId)

    if (error) {
      return {
        success: false,
        error: `Erro ao atualizar projeto: ${error.message}`
      }
    }

    return { success: true }

  } catch (err) {
    return {
      success: false,
      error: 'Erro interno do servidor'
    }
  }
}

/**
 * Busca recursos que podem ser líderes (gerente + líderes)
 */
export async function getAvailableLeaders() {
  try {
    const { data: leaders, error } = await supabase
      .from('resources')
      .select('*')
      .in('role', ['gerente', 'lider'])
      .eq('is_active', true)
      .order('name')

    if (error) {
      return []
    }

    return leaders || []
  } catch (err) {
    return []
  }
}

/**
 * Valida se mudança de data de início vai impactar tarefas em andamento
 */
export async function validateStartDateChange(
  projectId: string,
  newStartDate: string
): Promise<{
  hasTasksInProgress: boolean
  tasksCount: number
}> {
  try {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, name, progress')
      .eq('project_id', projectId)
      .gt('progress', 0)
      .lt('progress', 100)

    return {
      hasTasksInProgress: (tasks?.length || 0) > 0,
      tasksCount: tasks?.length || 0
    }
  } catch (err) {
    return { hasTasksInProgress: false, tasksCount: 0 }
  }
}

/**
 * Recalcula e atualiza a end_date do projeto baseada na última tarefa
 */
export async function recalculateProjectEndDate(projectId: string): Promise<UpdateResult> {
  try {
    // Buscar projeto e tarefas
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, start_date')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return { success: false, error: 'Projeto não encontrado' }
    }

    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, name, start_date, end_date, duration_minutes')
      .eq('project_id', projectId)

    if (tasksError) {
      return { success: false, error: 'Erro ao buscar tarefas' }
    }

    // Encontrar a última data de fim entre as tarefas
    let latestEndDate: Date | undefined = undefined

    if (tasks && tasks.length > 0) {
      tasks.forEach(task => {
        let taskEndDate: Date | null = null

        if (task.end_date) {
          taskEndDate = new Date(task.end_date)
        } else if (task.start_date && task.duration_minutes != null) {
          // ONDA 1: Calcular end_date usando duration_minutes
          const taskStartDate = new Date(task.start_date)
          taskEndDate = new Date(taskStartDate)
          const durationInDays = Math.ceil(minutesToDays(task.duration_minutes))
          taskEndDate.setDate(taskEndDate.getDate() + durationInDays - 1)
        }

        if (taskEndDate && (!latestEndDate || taskEndDate > latestEndDate)) {
          latestEndDate = taskEndDate
        }
      })
    }

    // Atualizar project.end_date
    if (latestEndDate) {
      const endDateString = (latestEndDate as Date).toISOString().split('T')[0]

      const { error: updateError } = await supabase
        .from('projects')
        .update({ end_date: endDateString })
        .eq('id', projectId)

      if (updateError) {
        return { success: false, error: 'Erro ao atualizar data de fim' }
      }

      return { success: true }
    } else {
      // Se não há tarefas ou datas, limpar end_date
      const { error: updateError } = await supabase
        .from('projects')
        .update({ end_date: null })
        .eq('id', projectId)

      if (updateError) {
        return { success: false, error: 'Erro ao limpar data de fim' }
      }

      return { success: true }
    }

  } catch (err) {
    return { success: false, error: 'Erro interno ao recalcular data de fim' }
  }
}