// lib/msproject/importer.ts
// Importa dados parseados para o Supabase

import { supabase } from '@/lib/supabase'
import type { MSProjectTask, UIDMap } from '@/types/database.types'

interface ImportMetadata {
  category: string
  leaderId: string | null
  vendorName: string
}

interface ImportResult {
  projectId: string
  tasksCreated: number
  predecessorsCreated: number
}

/**
 * Calcula parent_id baseado no OutlineNumber
 * Exemplo: "4.1.1" → pai é "4.1"
 */
function calculateParentOutline(outlineNumber: string | number): string | null {
  const outline = String(outlineNumber) // Converter para string
  const parts = outline.split('.')
  if (parts.length === 1) return null // Nível 1, sem pai
  
  parts.pop() // Remove último nível
  return parts.join('.')
}

/**
 * Mapeia tipo de predecessor para o enum do banco
 */
function mapPredecessorType(type: 'FF' | 'FS' | 'SF' | 'SS'): string {
  const map: Record<string, string> = {
    'FF': 'fim_fim',
    'FS': 'fim_inicio',
    'SF': 'inicio_fim',
    'SS': 'inicio_inicio'
  }
  return map[type] || 'fim_inicio'
}

/**
 * Inferir tipo de tarefa baseado no nome
 */
function inferTaskType(taskName: string): string {
  const name = taskName.toLowerCase()
  
  if (name.includes('projeto') && name.includes('mecânico')) return 'projeto_mecanico'
  if (name.includes('projeto') && name.includes('elétrico')) return 'projeto_eletrico'
  if (name.includes('compra') && name.includes('mecânica')) return 'compras_mecanica'
  if (name.includes('compra') && name.includes('elétrica')) return 'compras_eletrica'
  if (name.includes('fabricação') || name.includes('fabricacao')) return 'fabricacao'
  if (name.includes('tratamento')) return 'tratamento_superficial'
  if (name.includes('montagem') && name.includes('mecânica')) return 'montagem_mecanica'
  if (name.includes('montagem') && name.includes('elétrica')) return 'montagem_eletrica'
  if (name.includes('coleta')) return 'coleta'
  
  return 'subtarefa' // Padrão
}

/**
 * Importa projeto completo do MS Project para o Supabase
 */
export async function importMSProject(
  tasks: MSProjectTask[],
  projectInfo: {
    code: string
    name: string
    startDate: Date
    endDate: Date
  },
  metadata: ImportMetadata
): Promise<ImportResult> {
  try {
    // ========== 1. CRIAR PROJETO ==========
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        code: projectInfo.code,
        name: projectInfo.name,
        category: metadata.category,
        vendor_name: metadata.vendorName,
        leader_id: metadata.leaderId,
        start_date: projectInfo.startDate.toISOString(),
        end_date: projectInfo.endDate.toISOString(),
        is_active: true,
        complexity: 'padrao',
        buffer_days: 0
      })
      .select()
      .single()

    if (projectError) {
      throw new Error(`Erro ao criar projeto: ${projectError.message}`)
    }

    // ========== 2. CRIAR MAPA DE OUTLINENUMBER → TASK_ID ==========
    // Precisamos disso para calcular parent_id depois
    const outlineToIdMap = new Map<string, string>()
    const uidToIdMap: UIDMap = new Map()

    // ========== 3. INSERIR TAREFAS EM ORDEM ==========
    // Ordenar por OutlineNumber para garantir que pais sejam criados antes dos filhos
    const sortedTasks = [...tasks].sort((a, b) => {
      const aNum = String(a.outlineNumber).split('.').map(n => parseInt(n))
      const bNum = String(b.outlineNumber).split('.').map(n => parseInt(n))
      
      for (let i = 0; i < Math.max(aNum.length, bNum.length); i++) {
        const aVal = aNum[i] || 0
        const bVal = bNum[i] || 0
        if (aVal !== bVal) return aVal - bVal
      }
      return 0
    })

    let tasksCreated = 0

    for (const task of sortedTasks) {
      // Calcular parent_id
      const parentOutline = calculateParentOutline(task.outlineNumber)
      const parentId = parentOutline ? outlineToIdMap.get(parentOutline) || null : null

      // Inserir tarefa
      const { data: insertedTask, error: taskError } = await supabase
        .from('tasks')
        .insert({
          project_id: project.id,
          name: task.name,
          type: inferTaskType(task.name),
          parent_id: parentId,
          duration: task.duration,
          start_date: task.start.toISOString(),
          end_date: task.finish.toISOString(),
          progress: task.percentComplete,
          is_optional: false,
          is_critical_path: task.isCritical,
          sort_order: task.uid,
          outline_level: task.outlineLevel,
          wbs_code: task.outlineNumber,
          is_summary: task.isSummary,
          estimated_cost: 0,
          actual_cost: 0,
          margin_start: 0,
          margin_end: 0
        })
        .select()
        .single()

      if (taskError) {
        // Rollback: deletar projeto
        await supabase.from('projects').delete().eq('id', project.id)
        throw new Error(`Erro ao criar tarefa "${task.name}": ${taskError.message}`)
      }

      // Guardar mapeamentos
      outlineToIdMap.set(task.outlineNumber, insertedTask.id)
      uidToIdMap.set(task.uid, insertedTask.id)
      tasksCreated++
    }

    // ========== 4. INSERIR PREDECESSORES ==========
    let predecessorsCreated = 0

    for (const task of tasks) {
      if (task.predecessors.length === 0) continue

      const taskId = uidToIdMap.get(task.uid)
      if (!taskId) {
        continue
      }

      for (const pred of task.predecessors) {
        const predecessorId = uidToIdMap.get(pred.uid)
        if (!predecessorId) {
          continue
        }

        const { error: predError } = await supabase
          .from('predecessors')
          .insert({
            task_id: taskId,
            predecessor_id: predecessorId,
            type: mapPredecessorType(pred.type),
            lag_time: pred.lag
          })

        if (predError) {
          // Não fazer rollback aqui, predecessores são opcionais
        } else {
          predecessorsCreated++
        }
      }
    }

    // ========== 5. RETORNAR RESULTADO ==========
    return {
      projectId: project.id,
      tasksCreated,
      predecessorsCreated
    }

  } catch (error) {
    throw error
  }
}