'use client'

/**
 * GanttViewTab - Versão Refatorada (Fase 4)
 * Migrado de 2.157 linhas para ~500 linhas usando hooks modulares
 *
 * ONDA 2: Usa duration_minutes
 * ONDA 3: Usa work_type (milestone como diamante)
 *
 * Correções:
 * - Resize agora respeita zoomLevel (bug crítico corrigido)
 * - Drag & drop melhorado
 * - Sincronização de datas automática
 * - Auditoria de conflitos e ciclos
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Project, Task, Resource } from '@/types/database.types'
import { Allocation } from '@/types/allocation.types'

// Componentes
import { GanttHeader } from '@/components/gantt/components/GanttHeader'
import { GanttFilters } from '@/components/gantt/components/GanttFilters'
import { GanttTaskRow } from '@/components/gantt/components/GanttTaskRow'
import { GanttDetailsPanel } from '@/components/gantt/components/GanttDetailsPanel'
import { GanttBatchSaveBar } from '@/components/gantt/components/GanttBatchSaveBar'
import { PredecessorLines } from '@/components/gantt/components/PredecessorLines'
import { PredecessorQuickMenu } from '@/components/gantt/components/PredecessorQuickMenu'
import { GanttTaskBarWrapper } from '@/components/gantt/components/GanttTaskBarWrapper'
import AllocationModal from '@/components/AllocationModal'
import SubtaskManager from '@/components/SubtaskManager'
import RecalculateModal from '@/components/modals/RecalculateModal'
import CycleAuditModal from '@/components/modals/CycleAuditModal'
import { getTaskColor } from '@/components/gantt/utils/ganttColors'
import { PredecessorDragProvider } from '@/components/gantt/contexts/PredecessorDragContext'

// Hooks customizados
import { useGanttState } from '@/components/gantt/hooks/useGanttState'
import { useGanttCalculations } from '@/components/gantt/hooks/useGanttCalculations'
import { useGanttFilters } from '@/components/gantt/hooks/useGanttFilters'
import { useGanttResize } from '@/components/gantt/hooks/useGanttResize'
import { useGanttDragDrop } from '@/components/gantt/hooks/useGanttDragDrop'
import { useGanttSync, ExclusiveConflict } from '@/components/gantt/hooks/useGanttSync'
import { useGanttPendingChanges } from '@/components/gantt/hooks/useGanttPendingChanges'
import { usePredecessorEditing } from '@/components/gantt/hooks/usePredecessorEditing'

// Utils
import { getColumnWidth, calculateDateRange, calculateAllocationBarStyle } from '@/components/gantt/utils/ganttCalculations'
import { ganttStyles } from '@/components/gantt/utils/ganttColors'
import { detectCycles } from '@/lib/msproject/validation'
import { TaskWithAllocations } from '@/components/gantt/types/gantt.types'
import { formatMinutes, daysToMinutes } from '@/utils/time.utils'
import { recalculateTasksInCascade } from '@/utils/predecessorCalculations'
import { dispatchToast } from '@/components/ui/ToastProvider'

interface GanttViewTabProps {
  project: Project
  tasks: Task[]
  resources: Resource[]
  allocations: Allocation[]
  onRefresh: () => void
  highlightTaskId?: string
}

export default function GanttViewTab({
  project,
  tasks,
  resources,
  allocations,
  onRefresh,
  highlightTaskId
}: GanttViewTabProps) {
  // ========== ESTADO CONSOLIDADO ==========
  const { state, actions } = useGanttState()

  // ========== PENDING CHANGES (BATCH SAVE) ==========
  const pendingChanges = useGanttPendingChanges()

  // ========== PREDECESSOR EDITING MODE (ONDA 5.7) ==========
  const predecessorEditing = usePredecessorEditing()

  // ========== MODAL DE CONFLITOS EXCLUSIVOS ==========
  const [exclusiveConflictsModal, setExclusiveConflictsModal] = useState<ExclusiveConflict[]>([])
  // Índice do conflito expandido com ações
  const [expandedConflictIdx, setExpandedConflictIdx] = useState<number | null>(null)
  // Estado de aplicação de lag (por índice de conflito)
  const [applyingLag, setApplyingLag] = useState<number | null>(null)
  // AllocationModal aberto a partir do modal de conflitos
  const [conflictAllocationTaskId, setConflictAllocationTaskId] = useState<string | null>(null)
  const [conflictAllocationId, setConflictAllocationId] = useState<string | undefined>(undefined)

  // ========== TOOLTIP HOVER ==========
  const [hoveredTask, setHoveredTask] = useState<TaskWithAllocations | null>(null)

  // ========== SNAP VISUAL ==========
  const [snapPulse, setSnapPulse] = useState<string | null>(null) // taskId que teve snap

  // Resetar snap pulse após animação
  useEffect(() => {
    if (snapPulse) {
      const timer = setTimeout(() => setSnapPulse(null), 300)
      return () => clearTimeout(timer)
    }
  }, [snapPulse])

  // ========== PREDECESSOR QUICK MENU (ONDA 5.7) ==========
  const [selectedPredecessor, setSelectedPredecessor] = useState<{
    pred: any
    fromTask: any
    toTask: any
  } | null>(null)

  // ========== CÁLCULOS COM MEMOIZAÇÃO ==========
  const { tasksWithDates, organizedTasks, dateRange } = useGanttCalculations(
    tasks,
    project.start_date,
    allocations,
    resources,
    state.view.expandedTasks
  )

  // ========== FILTROS ==========
  const { filteredTasks } = useGanttFilters(
    organizedTasks,
    allocations,
    state.filters
  )

  // ========== ORDENAÇÃO (ESTRUTURAL vs CRONOLÓGICA) ==========
  const sortedTasks = useMemo(() => {
    if (state.view.sortOrder === 'structural') {
      return filteredTasks
    }

    // Ordenação cronológica: considerar predecessores para determinar ordem de execução
    // Calcular "earliest start time" para cada tarefa considerando predecessores
    const calculateEarliestStart = (taskId: string, visited = new Set<string>()): Date => {
      if (visited.has(taskId)) {
        // Ciclo detectado, retornar data da tarefa
        const task = tasksWithDates.find(t => t.id === taskId)
        return task ? new Date(task.start_date) : new Date()
      }
      visited.add(taskId)

      const task = tasksWithDates.find(t => t.id === taskId)
      if (!task) return new Date()

      // Encontrar todos os predecessores desta tarefa
      const taskPredecessors = state.data.predecessors.filter(p => p.task_id === taskId)

      if (taskPredecessors.length === 0) {
        // Sem predecessores, usar start_date da tarefa
        return new Date(task.start_date)
      }

      // Para cada predecessor, calcular quando ele termina
      let latestPredecessorEnd = new Date(task.start_date)

      for (const pred of taskPredecessors) {
        const predecessorTask = tasksWithDates.find(t => t.id === pred.predecessor_id)
        if (!predecessorTask) continue

        // Calcular quando o predecessor pode começar (recursivo)
        const predStart = calculateEarliestStart(pred.predecessor_id, new Set(visited))

        // Calcular quando o predecessor termina
        const predEnd = new Date(predStart)
        const predDurationDays = predecessorTask.duration_minutes
          ? predecessorTask.duration_minutes / 540
          : 1
        predEnd.setDate(predEnd.getDate() + Math.ceil(predDurationDays))

        // Tipo de predecessor afeta quando a tarefa pode começar
        let effectiveStart: Date
        if (pred.type === 'FS' || pred.type === 'fim_inicio') {
          // Fim-Início: tarefa começa após predecessor terminar
          effectiveStart = predEnd
        } else if (pred.type === 'SS' || pred.type === 'inicio_inicio') {
          // Início-Início: tarefa começa quando predecessor começa
          effectiveStart = predStart
        } else if (pred.type === 'FF' || pred.type === 'fim_fim') {
          // Fim-Fim: tarefa termina quando predecessor termina
          const taskDurationDays = task.duration_minutes ? task.duration_minutes / 540 : 1
          effectiveStart = new Date(predEnd)
          effectiveStart.setDate(effectiveStart.getDate() - Math.ceil(taskDurationDays))
        } else if (pred.type === 'SF' || pred.type === 'inicio_fim') {
          // Início-Fim: tarefa termina quando predecessor começa
          const taskDurationDays = task.duration_minutes ? task.duration_minutes / 540 : 1
          effectiveStart = new Date(predStart)
          effectiveStart.setDate(effectiveStart.getDate() - Math.ceil(taskDurationDays))
        } else {
          effectiveStart = predEnd
        }

        // Considerar lag time se houver
        if (pred.lag_minutes) {
          effectiveStart.setMinutes(effectiveStart.getMinutes() + pred.lag_minutes)
        } else if (pred.lag_time) {
          effectiveStart.setDate(effectiveStart.getDate() + pred.lag_time)
        }

        // Pegar a data mais tardia entre todos os predecessores
        if (effectiveStart > latestPredecessorEnd) {
          latestPredecessorEnd = effectiveStart
        }
      }

      return latestPredecessorEnd
    }

    // Função recursiva para ordenar tarefas e suas subtarefas
    const sortTasksChronologically = (tasks: TaskWithAllocations[]): TaskWithAllocations[] => {
      // Separar tarefas por nível (pais vs filhos)
      const tasksByParent = new Map<string | null, TaskWithAllocations[]>()

      tasks.forEach(task => {
        const parentId = task.parent_id
        if (!tasksByParent.has(parentId)) {
          tasksByParent.set(parentId, [])
        }
        tasksByParent.get(parentId)!.push(task)
      })

      // Ordenar cada grupo de tarefas por earliest start
      const result: TaskWithAllocations[] = []

      const processLevel = (parentId: string | null) => {
        const levelTasks = tasksByParent.get(parentId) || []

        // Calcular earliest start para cada tarefa
        const tasksWithStart = levelTasks.map(task => ({
          task,
          earliestStart: calculateEarliestStart(task.id)
        }))

        // Ordenar por earliest start
        tasksWithStart.sort((a, b) => a.earliestStart.getTime() - b.earliestStart.getTime())

        // Adicionar ao resultado
        tasksWithStart.forEach(({ task }) => {
          result.push(task)

          // Se tem subtarefas, processar recursivamente
          if (task.subtasks && task.subtasks.length > 0) {
            processLevel(task.id)
          }
        })
      }

      // Começar pelas tarefas de nível raiz
      processLevel(null)

      return result
    }

    return sortTasksChronologically(filteredTasks)
  }, [filteredTasks, state.view.sortOrder, state.data.predecessors, tasksWithDates])

  // ========== MAPEAMENTO DE POSIÇÕES Y PARA PREDECESSOR LINES ==========
  // Mapear as posições Y das tarefas baseado na ordem de renderização atual
  const taskPositionMap = useMemo(() => {
    const positionMap = new Map<string, number>()
    const rowHeight = 48

    function mapTaskRecursive(task: TaskWithAllocations, currentRow: number): number {
      // Mapear posição Y centrada na linha
      const yPosition = currentRow * rowHeight + rowHeight / 2
      positionMap.set(task.id, yPosition)

      let nextRow = currentRow + 1

      // Se tem subtarefas E está expandida, mapear recursivamente
      if (task.subtasks && task.subtasks.length > 0 && state.view.expandedTasks.has(task.id)) {
        for (const subtask of task.subtasks) {
          nextRow = mapTaskRecursive(subtask, nextRow)
        }
      }

      return nextRow
    }

    let currentRow = 0
    for (const task of sortedTasks) {
      currentRow = mapTaskRecursive(task, currentRow)
    }

    return positionMap
  }, [sortedTasks, state.view.expandedTasks])

  // ========== GRID DE DATAS ==========
  const dateGrid = useMemo(() => {
    const dates: Date[] = []
    const current = new Date(dateRange.minDate)

    while (current <= dateRange.maxDate) {
      dates.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }

    return dates
  }, [dateRange])

  // ========== COLUMN WIDTH BASEADO NO ZOOM ==========
  const columnWidth = getColumnWidth(state.view.zoomLevel)

  // ========== LARGURA DA COLUNA DE TAREFAS (sempre visível) ==========
  const taskColumnWidth = 360 // Ajustado para 360px - balanço entre espaço e compactação

  // ========== RESIZE HOOK ==========
  const resize = useGanttResize(
    tasks,
    tasksWithDates,
    state.data.predecessors,
    project.id,
    state.view.zoomLevel,
    actions.setTempDuration,
    actions.setTempStartOffset,
    actions.setResizingTask,
    actions.setPendingUpdates,
    pendingChanges.addChange,
    onRefresh
  )

  // ========== DRAG & DROP HOOK ==========
  const dragDrop = useGanttDragDrop(tasks, onRefresh)

  // ========== SYNC & AUDIT HOOK ==========
  const sync = useGanttSync(
    project.id,
    tasks,
    state.data.predecessors,
    onRefresh,
    actions.setPendingUpdates,
    (conflicts) => setExclusiveConflictsModal(conflicts)
  )

  // ========== CARREGAR PREDECESSORES ==========
  useEffect(() => {
    async function loadPredecessors() {
      const { data } = await supabase
        .from('predecessors')
        .select('*')
        .in('task_id', tasks.map(t => t.id))

      if (data) {
        actions.setPredecessors(data)
      }
    }

    if (tasks.length > 0) {
      loadPredecessors()
    }
  }, [tasks, project.id])

  // ========== DETECTAR CICLOS ==========
  useEffect(() => {
    if (tasks.length > 0 && state.data.predecessors.length > 0) {
      const cycleDetection = detectCycles(tasks, state.data.predecessors)
      if (cycleDetection.hasCycle) {
        actions.setTasksInCycle(new Set(cycleDetection.cycleNodes))
      } else {
        actions.setTasksInCycle(new Set())
      }
    }
  }, [tasks, state.data.predecessors])

  // ========== AUTO-EXPAND HIGHLIGHTED TASK ==========
  useEffect(() => {
    if (highlightTaskId) {
      const task = tasks.find(t => t.id === highlightTaskId)
      if (task?.parent_id) {
        const parentIds: string[] = []
        let currentParentId: string | null = task.parent_id

        while (currentParentId) {
          parentIds.push(currentParentId)
          const parent = tasks.find(t => t.id === currentParentId)
          currentParentId = parent?.parent_id || null
        }

        if (parentIds.length > 0) {
          actions.expandMultiple(parentIds)
        }
      }
      actions.selectTask(highlightTaskId)
    }
  }, [highlightTaskId, tasks])

  // ========== AUTO-ABRIR MODAL DE RECÁLCULO QUANDO HÁ PENDING UPDATES ==========
  useEffect(() => {
    if (state.modals.pendingUpdates.length > 0 && !state.modals.showRecalculate) {
      actions.openModal('showRecalculate')
    }
  }, [state.modals.pendingUpdates.length])

  // ========== HANDLERS ==========
  const handleAuditConflicts = async () => {
    await sync.auditConflicts()
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Tem certeza que deseja deletar esta tarefa?')) return

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)

    if (error) {
      dispatchToast('Erro ao deletar tarefa', 'error')
    } else {
      onRefresh()
    }
  }

  // ONDA 5.7: Handler para criar predecessor via drag & drop de âncoras
  const handleCreatePredecessorFromAnchors = async (
    sourceTaskId: string,
    sourceAnchor: 'start' | 'end',
    targetTaskId: string,
    targetAnchor: 'start' | 'end'
  ) => {
    // Validar: não pode conectar tarefa a si mesma
    if (sourceTaskId === targetTaskId) {
      dispatchToast('Uma tarefa não pode depender de si mesma', 'info')
      return
    }

    // Determinar o tipo de predecessor baseado nas âncoras
    const relationType = predecessorEditing.getRelationType(sourceAnchor, targetAnchor)

    // Validar se já existe essa dependência
    const existingPred = state.data.predecessors.find(
      p => p.task_id === targetTaskId && p.predecessor_id === sourceTaskId
    )
    if (existingPred) {
      dispatchToast('Esta dependência já existe', 'info')
      return
    }

    // Validar ciclos (usar biblioteca de validação)
    const { wouldCreateCycle } = await import('@/lib/msproject/validation')
    const existingPredecessors = state.data.predecessors.map(p => ({
      task_id: p.task_id,
      predecessor_id: p.predecessor_id
    }))

    if (wouldCreateCycle(targetTaskId, sourceTaskId, existingPredecessors, tasks)) {
      dispatchToast('Este predecessor criaria uma dependência circular', 'info')
      return
    }

    // Criar o predecessor
    const { error } = await supabase
      .from('predecessors')
      .insert({
        task_id: targetTaskId,
        predecessor_id: sourceTaskId,
        type: relationType,
        lag_minutes: 0
      })

    if (error) {
      console.error('Erro ao criar predecessor:', error)
      dispatchToast('Erro ao criar predecessor', 'error')
      return
    }

    // Predecessor criado com sucesso - agora recalcular datas em cascata
    const newPredecessor = {
      id: 'temp',
      task_id: targetTaskId,
      predecessor_id: sourceTaskId,
      type: relationType,
      lag_minutes: 0
    }

    const updatedPredecessors = [...state.data.predecessors, newPredecessor]

    // Recalcular a partir da tarefa predecessora
    const updates = recalculateTasksInCascade(
      sourceTaskId, // A tarefa predecessora que foi vinculada
      tasks,
      updatedPredecessors
    )

    // Se houver atualizações de datas, aplicar no banco
    if (updates.length > 0) {
      console.log(`🔄 Recalculando ${updates.length} tarefas após criar predecessor...`)

      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('tasks')
          .update({
            start_date: update.start_date,
            end_date: update.end_date
          })
          .eq('id', update.id)

        if (updateError) {
          console.error('Erro ao atualizar tarefa:', updateError)
        }
      }
    }

    dispatchToast('Predecessor criado com sucesso! Datas recalculadas.', 'success')
    onRefresh()
  }

  // Helper para obter informações de uma tarefa por ID (usado no menu flutuante)
  const getTaskInfo = useCallback((taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    return task ? { name: task.name } : null
  }, [tasks])

  // Handler para clique em linha de predecessor (ONDA 5.7)
  const handlePredecessorClick = useCallback((pred: any, fromTask: any, toTask: any) => {
    setSelectedPredecessor({ pred, fromTask, toTask })
  }, [])

  /**
   * Verifica conflitos de recurso exclusivo após mudanças de data.
   * Dado um mapa taskId → {start_date, end_date} de tarefas com novas datas,
   * detecta se recursos 'alta' (exclusivos) ficaram alocados em dois lugares ao mesmo tempo.
   * Retorna array de mensagens de aviso.
   */
  function detectExclusiveConflictsAfterReschedule(
    updatedTaskDates: Record<string, { start_date: string; end_date: string }>
  ): string[] {
    // Montar mapa taskId → datas efetivas (novas ou originais)
    const effectiveDates: Record<string, { start: Date; end: Date }> = {}
    for (const t of tasks) {
      if (!t.start_date || !t.end_date) continue
      const override = updatedTaskDates[t.id]
      effectiveDates[t.id] = {
        start: new Date((override?.start_date ?? t.start_date) + 'T00:00:00'),
        end:   new Date((override?.end_date   ?? t.end_date)   + 'T00:00:00'),
      }
    }

    // Alocações exclusivas (alta) agrupadas por recurso
    const exclusiveByResource: Record<string, { taskId: string; taskName: string; start: Date; end: Date }[]> = {}
    for (const alloc of allocations) {
      if (alloc.priority !== 'alta') continue
      const dates = effectiveDates[alloc.task_id]
      if (!dates) continue
      const taskName = tasks.find(t => t.id === alloc.task_id)?.name ?? alloc.task_id
      if (!exclusiveByResource[alloc.resource_id]) exclusiveByResource[alloc.resource_id] = []
      exclusiveByResource[alloc.resource_id].push({ taskId: alloc.task_id, taskName, start: dates.start, end: dates.end })
    }

    const warnings: string[] = []

    for (const [resourceId, entries] of Object.entries(exclusiveByResource)) {
      if (entries.length < 2) continue
      const resourceName = resources.find(r => r.id === resourceId)?.name ?? resourceId

      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          const a = entries[i]
          const b = entries[j]
          // Sobreposição: a começa antes de b terminar E b começa antes de a terminar
          if (a.start <= b.end && b.start <= a.end) {
            warnings.push(`⚠️ ${resourceName}: conflito exclusivo entre "${a.taskName}" e "${b.taskName}"`)
          }
        }
      }
    }

    return [...new Set(warnings)] // deduplicar
  }

  const handleApplyRecalculations = async () => {
    // PRIMEIRO: Aplicar mudanças pendentes do resize/drag
    const changesToSave = pendingChanges.getPendingChangesArray()
    for (const change of changesToSave) {
      await supabase
        .from('tasks')
        .update(change.changes)
        .eq('id', change.taskId)
    }

    // SEGUNDO: Aplicar recálculo dos dependentes
    const updatedTaskDates: Record<string, { start_date: string; end_date: string }> = {}
    for (const update of state.modals.pendingUpdates) {
      await supabase
        .from('tasks')
        .update({
          start_date: update.start_date,
          end_date: update.end_date
        })
        .eq('id', update.id)
      updatedTaskDates[update.id] = { start_date: update.start_date, end_date: update.end_date }
    }
    // Incluir mudanças de drag/resize no mapa de datas
    for (const change of changesToSave) {
      if (change.changes.start_date || change.changes.end_date) {
        updatedTaskDates[change.taskId] = {
          start_date: change.changes.start_date ?? tasks.find(t => t.id === change.taskId)?.start_date ?? '',
          end_date:   change.changes.end_date   ?? tasks.find(t => t.id === change.taskId)?.end_date   ?? '',
        }
      }
    }

    // TERCEIRO: Verificar conflitos de recurso exclusivo
    const conflicts = detectExclusiveConflictsAfterReschedule(updatedTaskDates)
    if (conflicts.length > 0) {
      dispatchToast(
        `Conflito de recurso exclusivo detectado após recálculo:\n${conflicts.join('\n')}`,
        'error'
      )
    }

    // Limpar ambos
    pendingChanges.clearChanges()
    actions.setPendingUpdates([])
    actions.closeModal('showRecalculate')
    onRefresh()
  }

  // ========== BATCH SAVE HANDLERS ==========
  const [isSaving, setIsSaving] = useState(false)

  const handleSaveAllChanges = async () => {
    const changesToSave = pendingChanges.getPendingChangesArray()
    if (changesToSave.length === 0) return

    setIsSaving(true)
    try {
      // Salvar todas as mudanças pendentes
      for (const change of changesToSave) {
        await supabase
          .from('tasks')
          .update(change.changes)
          .eq('id', change.taskId)
      }

      // Verificar conflitos de recurso exclusivo após salvar
      const updatedTaskDates: Record<string, { start_date: string; end_date: string }> = {}
      for (const change of changesToSave) {
        if (change.changes.start_date || change.changes.end_date) {
          updatedTaskDates[change.taskId] = {
            start_date: change.changes.start_date ?? tasks.find(t => t.id === change.taskId)?.start_date ?? '',
            end_date:   change.changes.end_date   ?? tasks.find(t => t.id === change.taskId)?.end_date   ?? '',
          }
        }
      }
      const conflicts = detectExclusiveConflictsAfterReschedule(updatedTaskDates)
      if (conflicts.length > 0) {
        dispatchToast(
          `Conflito de recurso exclusivo detectado:\n${conflicts.join('\n')}`,
          'error'
        )
      }

      // Limpar pending changes
      pendingChanges.clearChanges()

      // Refresh para ver as mudanças
      onRefresh()
    } catch (error) {
      console.error('Erro ao salvar mudanças:', error)
      dispatchToast('Erro ao salvar mudanças', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelChanges = () => {
    if (!confirm('Tem certeza que deseja cancelar todas as mudanças pendentes?')) return
    pendingChanges.clearChanges()
    onRefresh() // Refresh para restaurar valores originais
  }

  const handleRecalculatePredecessors = async () => {
    const changesToSave = pendingChanges.getPendingChangesArray()
    if (changesToSave.length === 0) return

    // Para cada mudança pendente, calcular impacto em dependentes
    const allUpdates: any[] = []
    const affectedTaskIds = new Set<string>()

    // Coletar IDs das tarefas diretamente modificadas
    for (const change of changesToSave) {
      affectedTaskIds.add(change.taskId)
    }

    // NOVO: Detectar tarefas PAI que serão afetadas pelas mudanças nos filhos
    const parentsToCheck = new Set<string>()
    for (const change of changesToSave) {
      const task = tasks.find(t => t.id === change.taskId)
      if (task?.parent_id) {
        parentsToCheck.add(task.parent_id)
      }
    }

    // Simular as mudanças e calcular novas datas dos pais
    const tasksCopyWithChanges = tasks.map(t => {
      // Aplicar mudanças diretas
      const change = changesToSave.find(c => c.taskId === t.id)
      if (change) {
        return { ...t, ...change.changes }
      }
      return t
    })

    // Para cada pai potencialmente afetado, verificar se suas datas mudarão
    for (const parentId of parentsToCheck) {
      const parent = tasks.find(t => t.id === parentId)
      if (!parent) continue

      // Encontrar todos os filhos (com mudanças aplicadas)
      const children = tasksCopyWithChanges.filter(t => t.parent_id === parentId)
      if (children.length === 0) continue

      // Calcular novas datas do pai baseado nos filhos atualizados
      const childrenWithDates = children.filter(c => c.start_date && c.end_date)
      if (childrenWithDates.length === 0) continue

      const childStartDates = childrenWithDates.map(c => new Date(c.start_date!).getTime())
      const childEndDates = childrenWithDates.map(c => new Date(c.end_date!).getTime())

      const newParentStartDate = new Date(Math.min(...childStartDates))
      const newParentEndDate = new Date(Math.max(...childEndDates))

      // Verificar se as datas do pai mudaram
      const currentParentStart = parent.start_date ? new Date(parent.start_date).getTime() : 0
      const currentParentEnd = parent.end_date ? new Date(parent.end_date).getTime() : 0

      const parentDatesChanged =
        newParentStartDate.getTime() !== currentParentStart ||
        newParentEndDate.getTime() !== currentParentEnd

      if (parentDatesChanged) {
        // Adicionar o pai à lista de tarefas afetadas
        affectedTaskIds.add(parentId)

        // Atualizar a cópia com as novas datas do pai
        const parentIndex = tasksCopyWithChanges.findIndex(t => t.id === parentId)
        if (parentIndex !== -1) {
          tasksCopyWithChanges[parentIndex] = {
            ...tasksCopyWithChanges[parentIndex],
            start_date: newParentStartDate.toISOString().split('T')[0],
            end_date: newParentEndDate.toISOString().split('T')[0]
          }
        }
      }
    }

    // Agora calcular cascata para TODAS as tarefas afetadas (filhos + pais)
    for (const taskId of affectedTaskIds) {
      // Calcular dependentes
      const updates = await import('@/utils/predecessorCalculations').then(mod =>
        mod.recalculateTasksInCascade(taskId, tasksCopyWithChanges, state.data.predecessors)
      )

      allUpdates.push(...updates)
    }

    // Remover duplicatas
    const uniqueUpdates = allUpdates.filter((update, index, self) =>
      index === self.findIndex(u => u.id === update.id)
    )

    if (uniqueUpdates.length > 0) {
      actions.setPendingUpdates(uniqueUpdates)
      actions.openModal('showRecalculate')
    } else {
      dispatchToast('Nenhuma tarefa dependente precisa ser recalculada', 'info')
    }
  }

  // ========== TAREFA SELECIONADA COM ALOCAÇÕES ==========
  const selectedTaskWithAllocations = useMemo(() => {
    if (!state.selection.selectedTask) return null

    const task = tasks.find(t => t.id === state.selection.selectedTask)
    if (!task) return null

    const taskAllocations = allocations
      .filter(a => a.task_id === task.id)
      .map(alloc => {
        const resource = resources.find(r => r.id === alloc.resource_id)
        return resource ? { ...alloc, resource } : null
      })
      .filter(Boolean) as Array<Allocation & { resource: Resource }>

    return { task, allocations: taskAllocations }
  }, [state.selection.selectedTask, tasks, allocations, resources])

  // ========== VERIFICAR SE TAREFA ESTÁ ATRASADA ==========
  const isTaskLate = (taskId: string): boolean => {
    const task = tasksWithDates.find(t => t.id === taskId)
    if (!task || task.progress === 100) return false

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return task.end_date < today
  }

  // ========== RENDERIZAR TAREFA RECURSIVAMENTE ==========
  const renderTaskRecursive = (task: TaskWithAllocations, level: number): React.ReactNode => {
    const hasSubtasks = task.subtasks && task.subtasks.length > 0
    const isExpanded = state.view.expandedTasks.has(task.id)
    const isMilestone = task.work_type === 'milestone'

    // ONDA 3: Detectar fragmentação (múltiplas alocações em tarefa leaf)
    const allocations = task.allocations || []
    const isFragmented = !hasSubtasks && allocations.length > 1

    // Ordenar alocações por data se fragmentada
    const sortedAllocations = isFragmented
      ? [...allocations].sort((a, b) =>
          new Date(a.start_date ?? 0).getTime() - new Date(b.start_date ?? 0).getTime()
        )
      : allocations

    // Obter pending changes para esta tarefa
    const taskPendingChanges = pendingChanges.getChange(task.id)

    // Usar duração temporária se estiver resizing (visual em tempo real)
    const tempDuration = state.resize.tempDurations.get(task.id)
    const tempStartOffset = state.resize.tempStartOffsets.get(task.id)
    const isResizing = state.resize.resizingTask?.taskId === task.id

    const effectiveDuration = tempDuration !== undefined ? tempDuration : task.duration_days

    // Detectar snap: duração é múltiplo exato de 15 minutos (1/36 dia)
    const snapIncrement = 1 / 36
    const isSnapped = isResizing && Math.abs((effectiveDuration % snapIncrement)) < 0.001

    // Calcular posição e largura da barra no timeline (PARA TODAS AS TAREFAS E SUBTAREFAS)
    const taskStart = new Date(task.start_date)
    taskStart.setHours(0, 0, 0, 0) // Normalizar para meia-noite

    const timelineStart = new Date(dateRange.minDate)
    timelineStart.setHours(0, 0, 0, 0) // Normalizar para meia-noite

    // Calcular quantos dias desde o início do timeline
    // Usar Math.floor para garantir alinhamento exato com as colunas de datas
    let daysSinceStart = Math.floor(
      (taskStart.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Calcular offset intra-dia baseado em predecessores FS no mesmo dia (recursivo)
    const calculateRecursiveOffset = (targetTaskId: string, visitedTasks = new Set<string>()): number => {
      // Evitar loops infinitos
      if (visitedTasks.has(targetTaskId)) return 0
      visitedTasks.add(targetTaskId)

      const targetTask = tasksWithDates.find(t => t.id === targetTaskId)
      if (!targetTask) return 0

      let maxOffset = 0
      const taskPreds = state.data.predecessors.filter(p => p.task_id === targetTaskId)

      for (const pred of taskPreds) {
        if (pred.type === 'FS' || pred.type === 'fim_inicio') {
          const predecessorTask = tasksWithDates.find(t => t.id === pred.predecessor_id)
          if (!predecessorTask) continue

          // Calcular data de TÉRMINO do predecessor
          const predEnd = new Date(predecessorTask.end_date)
          predEnd.setHours(0, 0, 0, 0)

          const taskStartNorm = new Date(targetTask.start_date)
          taskStartNorm.setHours(0, 0, 0, 0)

          // Verificar se o predecessor TERMINA no mesmo dia que a tarefa COMEÇA
          const sameDayEnd = predEnd.getTime() === taskStartNorm.getTime()

          if (sameDayEnd) {
            // Calcular quanto do último dia o predecessor ocupa
            const predDurationMinutes = predecessorTask.duration_minutes ?? 540
            const predDurationDays = predDurationMinutes / 540
            const lastDayOccupancy = predDurationDays - Math.floor(predDurationDays)

            // RECURSÃO: Calcular offset do predecessor também
            const predecessorOffset = calculateRecursiveOffset(predecessorTask.id, visitedTasks)

            // Offset total = offset do predecessor + duração dele no último dia
            const totalOffset = predecessorOffset + lastDayOccupancy

            maxOffset = Math.max(maxOffset, totalOffset)
          }
        }
      }

      return maxOffset
    }

    const intraDayOffset = calculateRecursiveOffset(task.id)

    // Aplicar offset intra-dia
    daysSinceStart += intraDayOffset

    // Aplicar offset temporário se estiver resizing pela esquerda
    if (tempStartOffset !== undefined) {
      daysSinceStart += tempStartOffset
    }

    // Posição left em pixels
    const leftPosition = daysSinceStart * columnWidth

    // Largura da barra (usar duração efetiva - real ou temporária)
    const barWidth = effectiveDuration * columnWidth

    const barPosition = {
      left: leftPosition,
      width: barWidth
    }

    // Cor da linha guia: Vermelha para pai (level 0), azul claro para subtarefas
    const guideLineColor = level === 0 ? 'bg-red-400' : 'bg-blue-200'

    const taskRow = (
      <div key={task.id} className="flex flex-nowrap border-b hover:bg-gray-50" style={{ height: '48px' }}>
        {/* Nome da tarefa */}
        <div
          className="border-r px-4 sticky left-0 bg-white z-10 flex items-center"
          style={{
            width: `${taskColumnWidth}px`,
            minWidth: `${taskColumnWidth}px`,
            maxWidth: `${taskColumnWidth}px`,
            flexShrink: 0
          }}
        >
          <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 24}px` }}>
            {/* Botão expandir/colapsar */}
            {hasSubtasks && (
              <button
                onClick={() => actions.toggleExpand(task.id)}
                className="text-gray-500 hover:text-gray-700"
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
            {!hasSubtasks && <span className="w-4"></span>}

            {/* Nome */}
            <div className="text-sm text-gray-900">{task.name}</div>
          </div>
        </div>

        {/* Área do timeline */}
        <div
          className="relative"
          style={{
            width: `${dateGrid.length * columnWidth}px`,
            minWidth: `${dateGrid.length * columnWidth}px`,
            flexShrink: 0,
            backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${columnWidth - 1}px, #e5e7eb ${columnWidth - 1}px, #e5e7eb ${columnWidth}px)`,
            backgroundSize: `${columnWidth}px 100%`,
            backgroundPosition: '0 0'
          }}
        >
          {/* Linha guia do nome até a barra */}
          <div
            className={`absolute top-1/2 left-0 h-px ${guideLineColor} pointer-events-none`}
            style={{
              width: `${barPosition.left}px`,
              transform: 'translateY(-50%)'
            }}
          />

          {/* PREVIEW FANTASMA de mudanças pendentes (somente quando NÃO está em resize) */}
          {taskPendingChanges && !isResizing && !isMilestone && (() => {
            // Calcular posição fantasma
            const originalDuration = task.duration_minutes || 540
            const newDuration = taskPendingChanges.changes.duration_minutes || originalDuration
            const newDurationDays = newDuration / 540

            const ghostWidth = newDurationDays * columnWidth
            const isExpanding = newDuration > originalDuration
            const isShrinking = newDuration < originalDuration

            return (
              <>
                {/* Barra fantasma ORIGINAL (quando está expandindo) - mostra onde estava */}
                {isExpanding && (
                  <div
                    className="absolute h-10 border-2 border-dashed border-gray-400 bg-gray-200 rounded opacity-40 pointer-events-none"
                    style={{
                      left: `${barPosition.left}px`,
                      width: `${barPosition.width}px`,
                      top: '4px',
                      zIndex: 5
                    }}
                    title="Posição original"
                  />
                )}

                {/* Barra fantasma NOVA - mostra onde vai ficar */}
                <div
                  className={`absolute h-10 border-2 border-dashed rounded opacity-50 pointer-events-none flex items-center justify-center ${
                    isExpanding ? 'border-green-500 bg-green-200' :
                    isShrinking ? 'border-orange-500 bg-orange-200' :
                    'border-blue-500 bg-blue-200'
                  }`}
                  style={{
                    left: `${barPosition.left}px`,
                    width: `${ghostWidth}px`,
                    top: '4px',
                    zIndex: 6
                  }}
                  title={`Nova duração: ${(newDuration / 540).toFixed(2)} dias`}
                >
                  <span className="text-xs font-bold text-gray-700">
                    {isExpanding && '→'}
                    {isShrinking && '←'}
                  </span>
                </div>
              </>
            )
          })()}

          {/* Milestone como diamante OU Barra da tarefa */}
          {isMilestone ? (
            <div
              className="absolute cursor-pointer"
              style={{
                left: `${barPosition.left}px`,
                top: '6px'
              }}
              onClick={() => actions.selectTask(task.id)}
              onMouseEnter={() => setHoveredTask(task)}
              onMouseLeave={() => setHoveredTask(null)}
              title={task.name}
            >
              <div className="w-4 h-4 bg-yellow-500 transform rotate-45 border-2 border-yellow-600"></div>
            </div>
          ) : isFragmented ? (
            /* ONDA 3: Renderizar múltiplos fragmentos com linhas conectoras */
            sortedAllocations.map((allocation, index) => {
              const fragmentStyle = calculateAllocationBarStyle(allocation, dateRange, columnWidth)
              const isFirst = index === 0
              const isLast = index === sortedAllocations.length - 1
              const fragmentLabel = isFirst ? task.name : `↳ ${task.name}`
              const fragmentWidth = parseFloat(fragmentStyle.width as string)

              // ONDA 3: Detectar hora extra
              const hasOvertime = (allocation.overtime_minutes || 0) > 0
              const overtimeBorderClass = hasOvertime ? 'border-2 border-orange-500 ring-1 ring-orange-300' : ''

              // ONDA 5.5: Obter cor baseada no work_type e type
              const taskColor = getTaskColor(
                task.type,
                !!task.parent_id,
                isTaskLate(task.id),
                task.id,
                undefined,
                task.work_type
              )

              return (
                <React.Fragment key={allocation.id}>
                  {/* Barra do fragmento com wrapper para predecessores */}
                  <GanttTaskBarWrapper
                    taskId={task.id}
                    taskName={task.name}
                    editingMode={predecessorEditing.editingMode}
                    barStyle={{
                      left: fragmentStyle.left as string,
                      width: fragmentStyle.width as string,
                      top: '4px',
                      height: '40px'
                    }}
                    getTaskInfo={getTaskInfo}
                    onConnectionComplete={handleCreatePredecessorFromAnchors}
                  >
                    <div
                      className={`h-10 ${taskColor} rounded cursor-pointer group ${overtimeBorderClass}`}
                      style={{
                        transition: 'all 0.15s ease-out'
                      }}
                      onClick={() => actions.selectTask(task.id)}
                      onMouseEnter={() => setHoveredTask(task)}
                      onMouseLeave={() => setHoveredTask(null)}
                      title={`${fragmentLabel} (${index + 1}/${sortedAllocations.length})${hasOvertime ? ' - HORA EXTRA' : ''}`}
                    >
                    {/* Barra de progresso (apenas no primeiro fragmento) */}
                    {isFirst && (task.progress ?? 0) > 0 && (
                      <div
                        className="absolute left-0 top-0 bottom-0 bg-black/20 rounded-l pointer-events-none"
                        style={{ width: `${Math.min(task.progress ?? 0, 100)}%` }}
                      />
                    )}

                    {/* Conteúdo adaptativo */}
                    <div className="flex items-center justify-between h-full px-2 pointer-events-none">
                      {fragmentWidth < 40 && (
                        <div className="w-full h-full"></div>
                      )}
                      {fragmentWidth >= 40 && fragmentWidth < 80 && (
                        <span className="text-[10px] text-white font-medium">
                          {task.work_type === 'wait' ? '⏳' : '⚙️'}
                        </span>
                      )}
                      {fragmentWidth >= 80 && fragmentWidth < 150 && (
                        <span className="text-[11px] text-white truncate flex-1">
                          {task.work_type === 'wait' ? '⏳' : '⚙️'} {fragmentLabel}
                        </span>
                      )}
                      {fragmentWidth >= 150 && (
                        <>
                          <span className="text-[11px] text-white truncate flex-1 mr-2">
                            {task.work_type === 'wait' ? '⏳' : '⚙️'} {fragmentLabel}
                          </span>
                          <span className="text-[9px] text-white bg-white bg-opacity-20 px-1.5 py-0.5 rounded font-medium whitespace-nowrap">
                            {index + 1}/{sortedAllocations.length}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  </GanttTaskBarWrapper>

                  {/* Linha conectora entre fragmentos */}
                  {!isLast && (() => {
                    const currentEnd = parseFloat(fragmentStyle.left as string) + parseFloat(fragmentStyle.width as string)
                    const nextAlloc = sortedAllocations[index + 1]
                    const nextStyle = calculateAllocationBarStyle(nextAlloc, dateRange, columnWidth)
                    const nextStart = parseFloat(nextStyle.left as string)
                    const gapWidth = nextStart - currentEnd

                    return (
                      <div
                        className="absolute pointer-events-none"
                        style={{
                          left: `${currentEnd}px`,
                          width: `${gapWidth}px`,
                          top: '18px',
                          height: '2px',
                          borderTop: '2px dashed rgb(59, 130, 246)',
                          zIndex: 1
                        }}
                      >
                        <div
                          className="absolute right-[-6px] top-[-4px] text-xs font-bold"
                          style={{ color: 'rgb(59, 130, 246)' }}
                        >
                          →
                        </div>
                      </div>
                    )
                  })()}
                </React.Fragment>
              )
            })
          ) : (() => {
            /* Barra única (não fragmentada) */
            // ONDA 3: Detectar hora extra em barra única
            const singleAllocation = allocations.length === 1 ? allocations[0] : null
            const hasOvertimeSingle = singleAllocation && (singleAllocation.overtime_minutes || 0) > 0
            const overtimeClass = hasOvertimeSingle ? 'border-2 border-orange-500 ring-1 ring-orange-300' : ''
            const durationClass = (task.duration_minutes ?? 540) < 540 ? 'border-2 border-blue-700 border-dashed' : ''

            // ONDA 5.5: Obter cor baseada no work_type e type
            const taskColorSingle = getTaskColor(
              task.type,
              !!task.parent_id,
              isTaskLate(task.id),
              task.id,
              undefined,
              task.work_type
            )

            return (
              <GanttTaskBarWrapper
                taskId={task.id}
                taskName={task.name}
                editingMode={predecessorEditing.editingMode}
                barStyle={{
                  left: `${barPosition.left}px`,
                  width: `${barPosition.width}px`,
                  top: '4px',
                  height: '40px'
                }}
                getTaskInfo={getTaskInfo}
                onConnectionComplete={handleCreatePredecessorFromAnchors}
              >
                <div
                  className={`h-10 ${taskColorSingle} rounded cursor-pointer group ${
                    isResizing ? 'ring-2 ring-blue-400 shadow-lg' : ''
                  } ${
                    hasOvertimeSingle ? overtimeClass : durationClass
                  } ${
                    isSnapped ? 'animate-pulse' : ''
                  }`}
                style={{
                  transition: isResizing ? 'none' : 'all 0.15s ease-out'
                }}
                onClick={() => actions.selectTask(task.id)}
                onMouseEnter={() => setHoveredTask(task)}
                onMouseLeave={() => setHoveredTask(null)}
              >
              {/* Barra de progresso */}
              {(task.progress ?? 0) > 0 && (
                <div
                  className="absolute left-0 top-0 bottom-0 bg-black/20 rounded-l pointer-events-none"
                  style={{ width: `${Math.min(task.progress ?? 0, 100)}%` }}
                />
              )}

              {/* Alças de resize (apenas quando NÃO estiver editando predecessores) */}
              {!predecessorEditing.editingMode && (
                <div
                  className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-blue-700 opacity-0 group-hover:opacity-100 transition-opacity rounded-l"
                  onMouseDown={(e) => resize.handleResizeStart(task.id, 'start', e)}
                  onClick={(e) => e.stopPropagation()}
                />
              )}

              {/* Conteúdo adaptativo baseado no tamanho da barra */}
              <div className="flex items-center justify-between h-full px-2 pointer-events-none">
                {/* Nível 1: Barra muito pequena (< 40px) - apenas cor */}
                {barPosition.width < 40 && (
                  <div className="w-full h-full" title={task.name}></div>
                )}

                {/* Nível 2: Barra pequena (40-80px) - apenas ícone */}
                {barPosition.width >= 40 && barPosition.width < 80 && (
                  <span className="text-[10px] text-white font-medium">
                    {task.work_type === 'milestone' ? '🎯' :
                     task.work_type === 'wait' ? '⏳' : '⚙️'}
                  </span>
                )}

                {/* Nível 3: Barra média (80-150px) - ícone + nome truncado */}
                {barPosition.width >= 80 && barPosition.width < 150 && (
                  <>
                    <span className="text-[11px] text-white truncate flex-1">
                      {task.work_type === 'milestone' ? '🎯' :
                       task.work_type === 'wait' ? '⏳' : '⚙️'} {task.name}
                    </span>
                  </>
                )}

                {/* Nível 4: Barra grande (>= 150px) - ícone + nome + badge */}
                {barPosition.width >= 150 && (
                  <>
                    <span className="text-[11px] text-white truncate flex-1 mr-2">
                      {task.work_type === 'milestone' ? '🎯' :
                       task.work_type === 'wait' ? '⏳' : '⚙️'} {task.name}
                    </span>
                    <span className="text-[9px] text-white bg-white bg-opacity-20 px-1.5 py-0.5 rounded font-medium whitespace-nowrap">
                      {formatMinutes(task.duration_days * (task.work_type === 'wait' ? 1440 : 540), 'short', task.work_type)}
                    </span>
                  </>
                )}
              </div>

              {/* Alça direita (resize end) - apenas quando NÃO estiver editando predecessores */}
              {!predecessorEditing.editingMode && (
                <div
                  className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-blue-700 opacity-0 group-hover:opacity-100 transition-opacity rounded-r"
                  onMouseDown={(e) => resize.handleResizeStart(task.id, 'end', e)}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>
              </GanttTaskBarWrapper>
            )
          })()}
        </div>
      </div>
    )

    // Se não tem subtarefas ou não está expandido, retornar só a linha
    if (!hasSubtasks || !isExpanded) {
      return taskRow
    }

    // Se tem subtarefas E está expandido, renderizar recursivamente
    return (
      <React.Fragment key={task.id}>
        {taskRow}
        {task.subtasks!.map(subtask => renderTaskRecursive(subtask, level + 1))}
      </React.Fragment>
    )
  }

  // ========== RENDER ==========
  return (
    <PredecessorDragProvider>
      <style>{ganttStyles}</style>

      <div className="bg-white rounded-lg border overflow-hidden">
        {/* Header */}
        <GanttHeader
          projectId={project.id}
          taskCount={tasksWithDates.length}
          dayCount={dateGrid.length}
          onSyncDates={sync.syncAllParentDates}
          onAuditConflicts={handleAuditConflicts}
          onAuditCycles={() => actions.openModal('showCycleAudit')}
          predecessorEditingMode={predecessorEditing.editingMode}
          onTogglePredecessorMode={predecessorEditing.toggleEditingMode}
        />

        {/* Filtros */}
        <GanttFilters
          filterType={state.filters.type}
          filterPerson={state.filters.person}
          filterProgress={state.filters.progress}
          zoomLevel={state.view.zoomLevel}
          sortOrder={state.view.sortOrder}
          resources={resources}
          filteredCount={sortedTasks.length}
          onFilterTypeChange={(value) => actions.setFilter('type', value)}
          onFilterPersonChange={(value) => actions.setFilter('person', value)}
          onFilterProgressChange={(value) => actions.setFilter('progress', value)}
          onZoomLevelChange={actions.setZoomLevel}
          onSortOrderChange={actions.setSortOrder}
          onClearFilters={() => {
            actions.setFilter('type', 'all')
            actions.setFilter('person', 'all')
            actions.setFilter('progress', 'all')
          }}
        />

        {/* Legenda visual */}
        <div className="bg-gradient-to-r from-gray-50 to-white border-b px-4 py-2">
          <div className="flex items-center gap-6 text-xs">
            <span className="font-semibold text-gray-700">Legenda:</span>

            {/* Tarefa normal (>= 1 dia) */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-4 bg-blue-500 rounded"></div>
              <span className="text-gray-600">≥ 1 dia</span>
            </div>

            {/* Tarefa curta (< 1 dia) */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-4 bg-blue-500 rounded border-2 border-blue-700 border-dashed"></div>
              <span className="text-gray-600">&lt; 1 dia</span>
            </div>

            {/* Milestone */}
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 transform rotate-45 border-2 border-yellow-600"></div>
              <span className="text-gray-600">Marco (0 duração)</span>
            </div>

            {/* Categorias de trabalho */}
            <div className="flex items-center gap-3 ml-4 pl-4 border-l">
              <span className="text-gray-500">Categorias:</span>
              <span>⚙️ Trabalho</span>
              <span>⏳ Espera</span>
              <span>🎯 Marco</span>
            </div>
          </div>
        </div>

        {/* Área de scroll */}
        <div className="h-[calc(100vh-320px)] bg-white overflow-auto">
          {/* Header: TAREFAS + Colunas de data */}
          <div className="flex flex-nowrap border-b bg-gray-50 sticky top-0 z-20">
            {/* Coluna fixa: TAREFAS */}
            <div
              className="border-r bg-gray-100 flex items-center justify-center px-2 py-2 sticky left-0 z-30"
              style={{
                width: `${taskColumnWidth}px`,
                minWidth: `${taskColumnWidth}px`,
                maxWidth: `${taskColumnWidth}px`,
                flexShrink: 0
              }}
            >
              <span className="text-xs font-semibold text-gray-600">TAREFAS</span>
            </div>

            {/* Colunas de data */}
            <div
              className="flex"
              style={{
                minWidth: `${dateGrid.length * columnWidth}px`,
                flexShrink: 0
              }}
            >
              {dateGrid.map((date, index) => {
                const day = date.getDate().toString().padStart(2, '0')
                const month = (date.getMonth() + 1).toString().padStart(2, '0')
                const dateStr = date.toISOString().split('T')[0]

                // Verificar se é hoje
                const today = new Date()
                const isToday =
                  date.getDate() === today.getDate() &&
                  date.getMonth() === today.getMonth() &&
                  date.getFullYear() === today.getFullYear()

                // Verificar se é final de semana (0 = Domingo, 6 = Sábado)
                const dayOfWeek = date.getDay()
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

                // Verificar se está selecionado
                const isSelected = state.selection.selectedDay === dateStr

                return (
                  <div
                    key={index}
                    style={{
                      width: `${columnWidth}px`,
                      minWidth: `${columnWidth}px`,
                      maxWidth: `${columnWidth}px`,
                      flexShrink: 0
                    }}
                    className={`
                      border-r border-gray-200 px-1 py-2 text-center cursor-pointer transition-colors
                      ${isToday ? 'bg-green-100 border-green-400 border-2' : ''}
                      ${isWeekend && !isToday ? 'bg-gray-100' : ''}
                      ${!isToday && !isWeekend ? 'bg-white' : ''}
                      ${isSelected ? 'bg-blue-100 font-bold' : ''}
                      hover:bg-blue-50
                    `}
                    onClick={() => actions.selectDay(dateStr)}
                    title={date.toLocaleDateString('pt-BR', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  >
                    <div className={`text-[10px] font-medium ${isToday ? 'text-green-700' : 'text-gray-700'}`}>
                      {day}/{month}
                    </div>
                    {isToday && (
                      <div className="text-[8px] text-green-700 font-bold mt-0.5">HOJE</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Container de conteúdo */}
          <div className="relative" style={{ width: `${taskColumnWidth + dateGrid.length * columnWidth}px` }}>
            {/* Lista de tarefas */}
            <div className="relative z-10">
              {sortedTasks.map((task) => renderTaskRecursive(task, 0))}
            </div>

            {/* Linhas de predecessor */}
            <PredecessorLines
              tasks={tasksWithDates}
              predecessors={state.data.predecessors}
              expandedTasks={state.view.expandedTasks}
              dateRange={dateRange}
              columnWidth={columnWidth}
              rowHeight={48}
              taskColumnWidth={taskColumnWidth}
              taskPositionMap={taskPositionMap}
              onExpandTask={(taskId) => actions.toggleExpand(taskId)}
              onPredecessorClick={handlePredecessorClick}
              editingMode={predecessorEditing.editingMode}
            />
          </div>
        </div>
      </div>

      {/* Painel de detalhes flutuante */}
      {selectedTaskWithAllocations && (
        <GanttDetailsPanel
          task={selectedTaskWithAllocations.task}
          allocations={selectedTaskWithAllocations.allocations}
          onClose={() => actions.selectTask(null)}
          onUpdate={onRefresh}
        />
      )}

      {/* Tooltip rico (hover) - Muda posição quando painel está aberto */}
      {hoveredTask && (
        <div className={`fixed bg-white border border-gray-300 rounded-lg shadow-xl p-4 z-[60] max-w-xs transition-all duration-200 ${
          state.selection.selectedTask
            ? 'bottom-4 left-4'  // Esquerda quando painel está aberto
            : 'bottom-4 right-4' // Direita quando painel está fechado
        }`}>
          <div className="space-y-2">
            <div className="font-semibold text-gray-900 text-sm border-b pb-2">
              {hoveredTask.name}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-gray-500">Duração</div>
                <div className="font-medium text-gray-900">
                  {formatMinutes(hoveredTask.duration_days * (hoveredTask.work_type === 'wait' ? 1440 : 540), 'long', hoveredTask.work_type)}
                </div>
              </div>

              <div>
                <div className="text-gray-500">Progresso</div>
                <div className="font-medium text-gray-900">{hoveredTask.progress}%</div>
              </div>

              <div>
                <div className="text-gray-500">Tipo</div>
                <div className="font-medium text-gray-900 capitalize">
                  {hoveredTask.type?.replace(/_/g, ' ')}
                </div>
              </div>

              <div>
                <div className="text-gray-500">Categoria</div>
                <div className="font-medium text-gray-900">
                  {hoveredTask.work_type === 'milestone' ? '🎯 Marco' :
                   hoveredTask.work_type === 'wait' ? '⏳ Espera' : '⚙️ Trabalho'}
                </div>
              </div>
            </div>

            {hoveredTask.allocations && hoveredTask.allocations.length > 0 && (
              <div className="pt-2 border-t">
                <div className="text-gray-500 text-xs mb-1">Recursos</div>
                <div className="flex flex-wrap gap-1">
                  {hoveredTask.allocations.map((alloc) => (
                    <span
                      key={alloc.id}
                      className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-[10px] font-medium"
                    >
                      {alloc.resource.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contador flutuante de resize */}
      {state.resize.resizingTask && (() => {
        const resizingTaskData = tasksWithDates.find(t => t.id === state.resize.resizingTask?.taskId)
        if (!resizingTaskData) return null

        const tempDuration = state.resize.tempDurations.get(state.resize.resizingTask.taskId)
        if (tempDuration === undefined) return null

        const originalDurationMinutes = resizingTaskData.duration_minutes ?? 540

        // Usar daysToMinutes para conversão precisa com arredondamento
        const tempDurationMinutes = daysToMinutes(tempDuration)
        const diffMinutes = tempDurationMinutes - originalDurationMinutes

        // Formatar diferença com sinal correto
        const diffFormatted = diffMinutes >= 0
          ? `+${formatMinutes(diffMinutes, 'short')}`
          : formatMinutes(diffMinutes, 'short') // já vem com o sinal negativo

        return (
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-6 py-4 rounded-lg shadow-2xl z-50 border-2 border-blue-400">
            <div className="text-center">
              <div className="text-3xl font-bold mb-1">
                {diffFormatted}
              </div>
              <div className="text-xs opacity-90">
                Nova duração: {formatMinutes(tempDurationMinutes, 'long')}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Barra de Save em Batch */}
      <GanttBatchSaveBar
        pendingChanges={pendingChanges.getPendingChangesArray()}
        onSave={handleSaveAllChanges}
        onCancel={handleCancelChanges}
        onRecalculatePredecessors={handleRecalculatePredecessors}
        isSaving={isSaving}
      />

      {/* Modais */}
      {state.modals.allocationTask && (
        <AllocationModal
          task={state.modals.allocationTask}
          projectLeaderId={null}
          allocationId={conflictAllocationId}
          onClose={() => { actions.closeModal('allocationTask'); setConflictAllocationId(undefined); setConflictAllocationTaskId(null) }}
          onSuccess={() => { onRefresh(); setConflictAllocationId(undefined); setConflictAllocationTaskId(null) }}
        />
      )}

      {state.modals.subtaskTask && (
        <SubtaskManager
          parentTask={state.modals.subtaskTask}
          onClose={() => actions.closeModal('subtaskTask')}
          onSuccess={onRefresh}
        />
      )}

      <RecalculateModal
        isOpen={state.modals.showRecalculate}
        updates={state.modals.pendingUpdates}
        taskNames={new Map(tasks.map(t => [t.id, t.name]))}
        onClose={() => {
          actions.closeModal('showRecalculate')
          actions.setPendingUpdates([]) // Limpar pending updates ao fechar sem aplicar
        }}
        onApply={handleApplyRecalculations}
      />

      <CycleAuditModal
        projectId={project.id}
        tasks={tasks.map(t => ({ id: t.id, name: t.name }))}
        isOpen={state.modals.showCycleAudit}
        onClose={() => actions.closeModal('showCycleAudit')}
        onRefresh={onRefresh}
      />

      {/* Modal de conflitos de recurso exclusivo */}
      {exclusiveConflictsModal.length > 0 && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900">⚠️ Conflitos de Recurso Exclusivo</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {exclusiveConflictsModal.length} conflito(s) — mesmo recurso alocado exclusivamente em duas tarefas simultâneas
                </p>
              </div>
              <button onClick={() => { setExclusiveConflictsModal([]); setExpandedConflictIdx(null) }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            {/* Lista de conflitos */}
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {exclusiveConflictsModal.map((c, i) => {
                const isExpanded = expandedConflictIdx === i

                // Calcular lag necessário para resolver o conflito:
                // A tarefa empurrada precisa começar APÓS o fim da tarefa que está ocupando o dia.
                // O predecessor relevante é o da tarefa empurrada (ex: Tarefa 1 → Tarefa 3).
                // lag_adicional = conflictingEnd - fim_predecessora - lag_atual (em dias)
                const hasPred = !!c.predecessor
                let lagNeeded = 1
                let newSuccessorStart = ''
                if (hasPred) {
                  const pred = c.predecessor!
                  const predTask = tasks.find(t => t.id === pred.predecessorTaskId)
                  const conflictingEnd = c.conflictingTaskEnd
                    ? new Date(c.conflictingTaskEnd + 'T00:00:00')
                    : null

                  if (predTask?.end_date && conflictingEnd) {
                    const predEnd = new Date(predTask.end_date + 'T00:00:00')
                    // Sucessor atual começa em: predEnd + 1 + lag_atual
                    // Precisa começar em: conflictingEnd + 1
                    // lag_adicional = conflictingEnd - predEnd - lag_atual
                    const lagTotalNeeded = Math.ceil((conflictingEnd.getTime() - predEnd.getTime()) / 86400000)
                    lagNeeded = Math.max(1, lagTotalNeeded - (pred.lag_time ?? 0))

                    // Nova data de início do sucessor = conflictingEnd + 1 dia
                    const newStart = new Date(conflictingEnd)
                    newStart.setDate(newStart.getDate() + 1)
                    newSuccessorStart = newStart.toLocaleDateString('pt-BR')
                  }
                }

                return (
                  <div key={i} className="border border-red-200 rounded-lg overflow-hidden">
                    {/* Cabeçalho do conflito */}
                    <div
                      className="flex items-center justify-between p-3 bg-red-50 cursor-pointer hover:bg-red-100 transition-colors"
                      onClick={() => setExpandedConflictIdx(isExpanded ? null : i)}
                    >
                      <div className="flex items-center gap-2 text-sm min-w-0">
                        <span className="text-red-500 flex-shrink-0">🔒</span>
                        <span className="font-semibold text-red-800 flex-shrink-0">{c.resourceName}</span>
                        <span className="text-red-400 flex-shrink-0">—</span>
                        <span className="text-red-700 truncate">
                          <span className="font-medium">{c.taskA}</span>
                          <span className="mx-1 text-red-400">↔</span>
                          <span className="font-medium">{c.taskB}</span>
                        </span>
                      </div>
                      <span className="text-gray-400 flex-shrink-0 ml-2">{isExpanded ? '▲' : '▼'}</span>
                    </div>

                    {/* Painel de ações expandido */}
                    {isExpanded && (
                      <div className="p-4 bg-white border-t border-red-100 space-y-4">
                        {/* Datas das tarefas */}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="p-2 bg-gray-50 rounded border">
                            <p className="font-semibold text-gray-700 mb-1">{c.taskA}</p>
                            <p className="text-gray-500">{new Date(c.taskAStart + 'T00:00:00').toLocaleDateString('pt-BR')} → {new Date(c.taskAEnd + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                          </div>
                          <div className="p-2 bg-gray-50 rounded border">
                            <p className="font-semibold text-gray-700 mb-1">{c.taskB}</p>
                            <p className="text-gray-500">{new Date(c.taskBStart + 'T00:00:00').toLocaleDateString('pt-BR')} → {new Date(c.taskBEnd + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                          </div>
                        </div>

                        {/* Ação 1: Lag day (só se existe predecessor) */}
                        {hasPred ? (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm font-semibold text-blue-800 mb-1">📅 Adicionar lag day ao predecessor</p>
                            <p className="text-xs text-blue-700 mb-3">
                              Adicionar <strong>{lagNeeded} dia(s)</strong> de lag ao predecessor entre essas tarefas.
                              {newSuccessorStart && <> A tarefa <strong>{c.predecessor!.successorTaskId === c.taskBId ? c.taskB : c.taskA}</strong> passará a iniciar em <strong>{newSuccessorStart}</strong>.</>}
                            </p>
                            <button
                              disabled={applyingLag === i}
                              onClick={async () => {
                                setApplyingLag(i)
                                try {
                                  const pred = c.predecessor!
                                  const newLagTime = (pred.lag_time ?? 0) + lagNeeded
                                  const newLagMinutes = pred.lag_minutes != null
                                    ? pred.lag_minutes + lagNeeded * 540
                                    : undefined

                                  // Atualizar predecessor no banco
                                  await supabase
                                    .from('predecessors')
                                    .update({
                                      lag_time: newLagTime,
                                      ...(newLagMinutes != null ? { lag_minutes: newLagMinutes } : {})
                                    })
                                    .eq('id', pred.id)

                                  // Recalcular em cascata a partir da tarefa predecessora
                                  const tasksCopy = tasks.map(t => ({ ...t }))
                                  const predsCopy = state.data.predecessors.map(p =>
                                    p.id === pred.id
                                      ? { ...p, lag_time: newLagTime, ...(newLagMinutes != null ? { lag_minutes: newLagMinutes } : {}) }
                                      : p
                                  )
                                  const updates = recalculateTasksInCascade(pred.predecessorTaskId, tasksCopy, predsCopy)

                                  if (updates.length > 0) {
                                    actions.setPendingUpdates(updates)
                                    actions.openModal('showRecalculate')
                                  }
                                  setExclusiveConflictsModal([])
                                  setExpandedConflictIdx(null)
                                } catch {
                                  dispatchToast('Erro ao aplicar lag', 'error')
                                } finally {
                                  setApplyingLag(null)
                                }
                              }}
                              className="w-full px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                              {applyingLag === i ? 'Aplicando...' : `✓ Aplicar +${lagNeeded} dia(s) de lag`}
                            </button>
                          </div>
                        ) : (
                          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500">
                            💡 Não há relação de predecessor entre essas tarefas. Para usar lag day, primeiro adicione um predecessor entre elas.
                          </div>
                        )}

                        {/* Ação 2: Substituir recurso */}
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-sm font-semibold text-amber-800 mb-2">👤 Substituir recurso em uma das tarefas</p>
                          <p className="text-xs text-amber-700 mb-3">Escolha em qual tarefa o recurso <strong>{c.resourceName}</strong> deve ser substituído:</p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => {
                                const task = tasks.find(t => t.id === c.taskAId)
                                if (!task) return
                                setConflictAllocationTaskId(c.taskAId)
                                setConflictAllocationId(c.taskAAllocationId)
                                setExclusiveConflictsModal([])
                                setExpandedConflictIdx(null)
                                actions.openModal('allocationTask', task)
                              }}
                              className="px-3 py-2 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 transition-colors"
                            >
                              ✏️ {c.taskA}
                            </button>
                            <button
                              onClick={() => {
                                const task = tasks.find(t => t.id === c.taskBId)
                                if (!task) return
                                setConflictAllocationTaskId(c.taskBId)
                                setConflictAllocationId(c.taskBAllocationId)
                                setExclusiveConflictsModal([])
                                setExpandedConflictIdx(null)
                                actions.openModal('allocationTask', task)
                              }}
                              className="px-3 py-2 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 transition-colors"
                            >
                              ✏️ {c.taskB}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-gray-50 rounded-b-xl flex-shrink-0">
              <button
                onClick={() => { setExclusiveConflictsModal([]); setExpandedConflictIdx(null) }}
                className="w-full px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menu rápido de predecessor - ONDA 5.7 */}
      {selectedPredecessor && (
        <PredecessorQuickMenu
          predecessor={selectedPredecessor.pred}
          fromTask={selectedPredecessor.fromTask}
          toTask={selectedPredecessor.toTask}
          onClose={() => setSelectedPredecessor(null)}
          onUpdate={onRefresh}
          allTasks={tasks}
          allPredecessors={state.data.predecessors}
        />
      )}
    </PredecessorDragProvider>
  )
}
