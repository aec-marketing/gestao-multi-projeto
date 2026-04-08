// lib/msproject/importer.ts
// Importa dados parseados para o Supabase

import { supabase } from '@/lib/supabase'
import type { MSProjectTask, UIDMap } from '@/types/database.types'
import { daysToMinutes } from '@/utils/time.utils'

interface ImportMetadata {
  category: string
  leaderId: string | null
  vendorName: string
  clientName?: string | null
  clientLogoUrl?: string | null
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
 * Verifica se uma tarefa é uma "Lista de Compras" pelo nome (pai)
 */
function isPurchaseList(taskName: string): boolean {
  return taskName.toLowerCase().includes('compra')
}

/**
 * Inferir tipo de tarefa baseado no nome
 * isChildOfPurchase: true quando o pai direto é uma lista de compras
 */
function inferTaskType(taskName: string, isChildOfPurchase = false): string {
  const name = taskName.toLowerCase()

  // Filhos de lista de compras → subtarefa (são os fornecedores/itens)
  if (isChildOfPurchase) return 'subtarefa'

  if (name.includes('projeto') && name.includes('mecânico')) return 'projeto_mecanico'
  if (name.includes('projeto') && name.includes('elétrico')) return 'projeto_eletrico'
  // Qualquer pai com "compra" → lista_compras (mecânica, elétrica, etc.)
  if (name.includes('compra')) return 'lista_compras'
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
        client_name: metadata.clientName || null,
        client_logo_url: metadata.clientLogoUrl || null,
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

    // Pré-calcular quais outlineNumbers são pais de lista de compras
    // para que os filhos herdem work_type=wait
    const purchaseParentOutlines = new Set<string>(
      sortedTasks
        .filter(t => t.isSummary && isPurchaseList(t.name))
        .map(t => t.outlineNumber)
    )

    let tasksCreated = 0

    for (const task of sortedTasks) {
      // Calcular parent_id
      const parentOutline = calculateParentOutline(task.outlineNumber)
      const parentId = parentOutline ? outlineToIdMap.get(parentOutline) || null : null

      // Verificar se este task é filho direto de uma lista de compras
      const isChildOfPurchase = parentOutline ? purchaseParentOutlines.has(parentOutline) : false
      // Verificar se este task É uma lista de compras (pai)
      const isSelfPurchase = task.isSummary && isPurchaseList(task.name)

      // Detectar tipo de tarefa e calcular duração
      let workType: 'work' | 'wait' | 'milestone'
      let durationMinutes: number

      if ((task.durationMinutes === 0 || task.durationMinutes == null) && !task.isSummary) {
        // Tarefa com duração zero E não é summary = MILESTONE real
        workType = 'milestone'
        durationMinutes = 0
      } else if (isSelfPurchase || isChildOfPurchase) {
        // Lista de compras (pai ou filho) → dias corridos (24h/dia = 1440 min/dia)
        workType = 'wait'
        const calendarDays = task.durationHours > 0 ? Math.ceil(task.durationHours / 24) : 1
        durationMinutes = calendarDays * 1440
      } else if (task.isSummary) {
        // Tarefa summary normal = WORK
        workType = 'work'
        durationMinutes = task.durationMinutes > 0 ? task.durationMinutes : 1
      } else {
        // Tarefa normal = WORK — usar minutos diretamente do XML (preserva sub-hora)
        workType = 'work'
        durationMinutes = task.durationMinutes > 0 ? task.durationMinutes : 1
      }

      // Inserir tarefa
      const { data: insertedTask, error: taskError } = await supabase
        .from('tasks')
        .insert({
          project_id: project.id,
          name: task.name,
          type: inferTaskType(task.name, isChildOfPurchase),
          parent_id: parentId,
          duration_minutes: durationMinutes,
          work_type: workType,
          start_date: task.start.toISOString(),
          end_date: task.finish.toISOString(),
          progress: task.percentComplete,
          is_optional: false,
          is_critical_path: task.isCritical,
          sort_order: task.uid,
          outline_level: Math.max(0, task.outlineLevel - 1), // MS Project usa 1-indexed, nós usamos 0-indexed
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
            lag_minutes: daysToMinutes(pred.lag) // ONDA 1: Converter lag em dias → minutos
          })

        if (predError) {
          // Não fazer rollback aqui, predecessores são opcionais
        } else {
          predecessorsCreated++
        }
      }
    }

    // ========== 5. RECALCULAR TAREFAS PAI ==========
    // Após importação, forçar recálculo das tarefas pai (bottom-up)
    // Buscar todas as tarefas pai ordenadas por outline_level DESC
    const { data: parentTasks } = await supabase
      .from('tasks')
      .select('id, outline_level, type, work_type')
      .eq('project_id', project.id)
      .eq('is_summary', true)
      .order('outline_level', { ascending: false })

    if (parentTasks && parentTasks.length > 0) {
      for (const parent of parentTasks) {
        // Buscar min/max datas e soma de duration_minutes dos filhos
        const { data: children } = await supabase
          .from('tasks')
          .select('start_date, end_date, duration_minutes')
          .eq('parent_id', parent.id)

        if (children && children.length > 0) {
          const validChildren = children.filter(c => c.start_date && c.end_date)

          if (validChildren.length > 0) {
            const minStart = validChildren.reduce((min, c) =>
              c.start_date < min ? c.start_date : min, validChildren[0].start_date)
            const maxEnd = validChildren.reduce((max, c) =>
              c.end_date > max ? c.end_date : max, validChildren[0].end_date)
            // Calcular span (diferença de datas), nunca somar durações dos filhos
            const startDate = new Date(minStart)
            const endDate = new Date(maxEnd)
            const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
            // Lista de compras usa dias corridos (1440 min/dia), demais usam dias úteis (540 min/dia)
            const minutesPerDay = parent.work_type === 'wait' ? 1440 : 540
            const spanMinutes = durationDays * minutesPerDay

            // Atualizar tarefa pai
            await supabase
              .from('tasks')
              .update({
                start_date: minStart,
                end_date: maxEnd,
                duration: durationDays,
                duration_minutes: spanMinutes
              })
              .eq('id', parent.id)
          }
        }
      }
    }

    // ========== 6. RETORNAR RESULTADO ==========
    return {
      projectId: project.id,
      tasksCreated,
      predecessorsCreated
    }

  } catch (error) {
    throw error
  }
}