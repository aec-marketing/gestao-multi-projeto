'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Project, Task, Resource } from '@/types/database.types'
import { Allocation } from '@/types/allocation.types'
import AllocationModal from '@/components/AllocationModal'
import { parseLocalDate, formatDateBR } from '@/utils/date.utils'
import SubtaskManager from '@/components/SubtaskManager'
import PredecessorLines from '@/components/gantt/PredecessorLines'
import { recalculateTasksInCascade, validateTaskStartDate, auditPredecessorConflicts } from '@/utils/predecessorCalculations'
import RecalculateModal from '@/components/modals/RecalculateModal'
import CycleAuditModal from '@/components/modals/CycleAuditModal'
import { detectCycles } from '@/lib/msproject/validation'
import { calculateProjectBuffer } from '@/lib/buffer-utils'


interface GanttViewTabProps {
  project: Project
  tasks: Task[]
  resources: Resource[]
  allocations: Allocation[]
  onRefresh: () => void
  highlightTaskId?: string
}

interface TaskWithDates extends Omit<Task, 'start_date' | 'end_date'> {
  start_date: Date
  end_date: Date
  duration_days: number
}

interface TaskWithAllocations extends TaskWithDates {
  allocations: Array<Allocation & { resource: Resource }>
  subtasks?: TaskWithAllocations[]
  isExpanded?: boolean
}

// Estilos para animação do painel flutuante
const styles = `
  @keyframes slide-up {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  .animate-slide-up {
    animation: slide-up 0.3s ease-out;
  }

  .drag-handle {
    cursor: grab;
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .dragging-row {
    opacity: 0.5;
    background: #e0f2fe;
  }

  .drag-over-row {
    border-top: 3px solid #3b82f6 !important;
    background: #eff6ff;
  }

  .resizing {
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    cursor: ew-resize !important;
  }

  .task-bar-resizing {
    transition: none !important;
  }

  .task-bar-normal {
    transition: width 0.15s ease-out;
  }

  .glassmorphism-panel {
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    box-shadow: 0 -4px 30px rgba(0, 0, 0, 0.15);
  }
`

export default function GanttViewTab({
  project,
  tasks,
  resources,
  allocations,
  onRefresh,
  highlightTaskId
}: GanttViewTabProps) {
  const [selectedTask, setSelectedTask] = useState<string | null>(null)
  const [draggedTask, setDraggedTask] = useState<string | null>(null)
  const [dragOverTask, setDragOverTask] = useState<string | null>(null)
  const [allocationModalTask, setAllocationModalTask] = useState<Task | null>(null)
  const [subtaskModalTask, setSubtaskModalTask] = useState<Task | null>(null)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())

const [editingCostsTask, setEditingCostsTask] = useState<Task | null>(null)
// ADICIONE ESTES STATES DE FILTRO:
const [filterType, setFilterType] = useState<string>('all')
const [filterPerson, setFilterPerson] = useState<string>('all')
const [filterProgress, setFilterProgress] = useState<string>('all')
// ADICIONE ESTES STATES PARA RESIZE:
const [resizingTask, setResizingTask] = useState<{
  taskId: string
  edge: 'start' | 'end'
  startX: number
  startWidth: number
  startLeft: number
} | null>(null)

// Estado para armazenar durações temporárias durante o resize
const [tempDurations, setTempDurations] = useState<Map<string, number>>(new Map())

// Estado para armazenar offset de posição temporário (para alça esquerda)
const [tempStartOffsets, setTempStartOffsets] = useState<Map<string, number>>(new Map())

  // ========== NOVO: Estado de Zoom ==========
  const [zoomLevel, setZoomLevel] = useState<'day' | 'week' | 'month'>('week')
  // ========== FIM NOVO ==========

  // ========== NOVO: Estado para Dia Selecionado ==========
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  // ========== FIM NOVO ==========
const [predecessors, setPredecessors] = useState<any[]>([])

  // ========== NOVO: Estados para Recalculação em Cascata ==========
  const [showRecalculateModal, setShowRecalculateModal] = useState(false)
  const [pendingUpdates, setPendingUpdates] = useState<any[]>([])
  // ========== FIM NOVO ==========

  // ========== NOVO: Estado para Modal de Auditoria de Ciclos ==========
  const [showCycleAudit, setShowCycleAudit] = useState(false)
  // ========== FIM NOVO ==========

  // ========== NOVO: Estado para Highlight de Ciclos ==========
  const [tasksInCycle, setTasksInCycle] = useState<Set<string>>(new Set())
  // ========== FIM NOVO ==========

  function calculateTaskDates(): TaskWithDates[] {
    if (!project?.start_date) return []

    const projectStart = parseLocalDate(project.start_date)!
    if (!projectStart) return []

    const result: TaskWithDates[] = []

    // ========== NOVA ABORDAGEM: Processar TODAS as tarefas recursivamente ==========
    // Função recursiva para processar uma tarefa e TODAS as suas subtarefas (qualquer nível)
    function processTaskRecursively(task: Task, depth: number = 0): void {
      // Pegar TODOS os filhos diretos desta tarefa
      const directChildren = tasks.filter(t => t.parent_id === task.id)

      // ═══════════════════════════════════════════════════════════════
      // MODO 1: Tarefa com datas definidas (MS Project ou manual)
      // ═══════════════════════════════════════════════════════════════
      if (task.start_date && task.end_date) {
        let taskStartDate = parseLocalDate(task.start_date)
        let taskEndDate = parseLocalDate(task.end_date)
        if (!taskStartDate || !taskEndDate) return

        // RECURSÃO: Processar TODOS os filhos primeiro (em qualquer nível)
        directChildren.forEach(child => processTaskRecursively(child, depth + 1))

        // Calcular duração REAL baseada nas datas
        const taskDuration = Math.max(1, Math.ceil((taskEndDate.getTime() - taskStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)

        // Adicionar esta tarefa ao resultado
        result.push({
          ...task,
          start_date: taskStartDate,
          end_date: taskEndDate,
          duration_days: taskDuration
        })
      }
      // ═══════════════════════════════════════════════════════════════
      // MODO 2: Tarefa SEM datas - calcular usando data do projeto
      // ═══════════════════════════════════════════════════════════════
      else {
        const startDate = new Date(projectStart)
        const taskDuration = Math.ceil(task.duration)
        const endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + taskDuration - 1)

        // RECURSÃO: Processar TODOS os filhos (em qualquer nível)
        directChildren.forEach(child => processTaskRecursively(child, depth + 1))

        // Adicionar esta tarefa ao resultado
        result.push({
          ...task,
          start_date: startDate,
          end_date: endDate,
          duration_days: taskDuration
        })
      }
    }

    // Iniciar processamento pelas tarefas raiz (sem parent_id)
    const rootTasks = tasks.filter(t => !t.parent_id)
    rootTasks.forEach(rootTask => processTaskRecursively(rootTask, 0))

    return result
  }

  // Organizar tarefas em hierarquia (pais e filhos)
  function organizeTasksHierarchy(tasksWithDates: TaskWithDates[]): TaskWithAllocations[] {
    const taskMap = new Map<string, TaskWithAllocations>()
    const rootTasks: TaskWithAllocations[] = []

    // Primeiro, criar todas as tarefas com alocações
    tasksWithDates.forEach(task => {
      const taskAllocations = allocations
        .filter(a => a.task_id === task.id)
        .map(a => ({
          ...a,
          resource: resources.find(r => r.id === a.resource_id)!
        }))
        .filter(a => a.resource)

      const taskWithAllocs: TaskWithAllocations = {
        ...task,
        allocations: taskAllocations,
        subtasks: [],
        isExpanded: expandedTasks.has(task.id)
      }

      taskMap.set(task.id, taskWithAllocs)
    })

    // Depois, organizar hierarquia
    taskMap.forEach(task => {
      if (task.parent_id) {
        const parent = taskMap.get(task.parent_id)
        if (parent) {
          parent.subtasks = parent.subtasks || []
          parent.subtasks.push(task)
        }
      } else {
        rootTasks.push(task)
      }
    })

    return rootTasks
  }

  const tasksWithDates = calculateTaskDates()

  // ═══════════════════════════════════════════════════════════════
  // APLICAR FILTROS
  // ═══════════════════════════════════════════════════════════════
  let filteredTasksWithDates = tasksWithDates.filter(t => !t.parent_id) // Apenas tarefas principais

  // Filtro por tipo
  if (filterType !== 'all') {
    filteredTasksWithDates = filteredTasksWithDates.filter(t => t.type === filterType)
  }

  // Filtro por pessoa
  if (filterPerson !== 'all') {
    filteredTasksWithDates = filteredTasksWithDates.filter(t =>
      allocations.some(a => a.task_id === t.id && a.resource_id === filterPerson)
    )
  }

  // Filtro por progresso
  if (filterProgress !== 'all') {
    if (filterProgress === 'not_started') {
      filteredTasksWithDates = filteredTasksWithDates.filter(t => t.progress === 0)
    } else if (filterProgress === 'in_progress') {
      filteredTasksWithDates = filteredTasksWithDates.filter(t => t.progress > 0 && t.progress < 100)
    } else if (filterProgress === 'completed') {
      filteredTasksWithDates = filteredTasksWithDates.filter(t => t.progress === 100)
    }
  }

  // 🔥 NOVO: Incluir TODAS as subtarefas (recursivamente) das tarefas filtradas
  const filteredTaskIds = new Set(filteredTasksWithDates.map(t => t.id))

  // Função recursiva para pegar TODOS os descendentes (não apenas filhos diretos)
  function getAllDescendants(parentIds: Set<string>): TaskWithDates[] {
    const descendants: TaskWithDates[] = []
    const directChildren = tasksWithDates.filter(t => t.parent_id && parentIds.has(t.parent_id))

    if (directChildren.length === 0) return descendants

    descendants.push(...directChildren)

    // Recursivamente pegar descendentes dos filhos
    const childIds = new Set(directChildren.map(c => c.id))
    const grandchildren = getAllDescendants(childIds)
    descendants.push(...grandchildren)

    return descendants
  }

  const allDescendants = getAllDescendants(filteredTaskIds)
  const finalFilteredTasks = [...filteredTasksWithDates, ...allDescendants]

  const organizedTasks = organizeTasksHierarchy(finalFilteredTasks)

  // Criar grid de datas (apenas para tarefas reais, sem buffer)
  const allDates = tasksWithDates.flatMap(t => [t.start_date, t.end_date])
  const minDate = allDates.length > 0 ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date()
  const maxDate = allDates.length > 0 ? new Date(Math.max(...allDates.map(d => d.getTime()))) : new Date()

  // Criar dateGrid apenas com datas de tarefas
  const dateGrid: Date[] = []
  const current = new Date(minDate)
  while (current <= maxDate) {
    dateGrid.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }

  // Criar dateGrid estendido para renderização (incluindo buffer)
  let maxDateWithBuffer = new Date(maxDate)
  if (project.buffer_days && project.buffer_days > 0) {
    maxDateWithBuffer.setDate(maxDateWithBuffer.getDate() + project.buffer_days)
  }

  const dateGridWithBuffer: Date[] = []
  const currentWithBuffer = new Date(minDate)
  while (currentWithBuffer <= maxDateWithBuffer) {
    dateGridWithBuffer.push(new Date(currentWithBuffer))
    currentWithBuffer.setDate(currentWithBuffer.getDate() + 1)
  }

  // Função para calcular estilo da barra
  // ========== NOVO: Função auxiliar para largura da coluna ==========
  const getColumnWidth = (): number => {
    switch (zoomLevel) {
      case 'day': return 120    // Zoom in: 120px por dia
      case 'week': return 50    // Normal: 50px por dia
      case 'month': return 15   // Zoom out: 15px por dia (reduzido)
      default: return 50
    }
  }
  // ========== FIM NOVO ==========

  const getTaskBarStyle = (task: TaskWithDates) => {
    if (dateGrid.length === 0) return {}

    const columnWidth = getColumnWidth() // ← NOVO

    const taskStart = task.start_date
    const taskEnd = task.end_date

    // Encontrar índices no grid
    const startIndex = dateGrid.findIndex(date =>
      date.toDateString() === taskStart.toDateString()
    )

    const endIndex = dateGrid.findIndex(date =>
      date.toDateString() === taskEnd.toDateString()
    )

    // Se não encontrar no grid, usar fallback
    if (startIndex === -1) return {}

    // ========== MODIFICADO: Usar columnWidth em vez de 50 ==========
    // Calcular posição left - aplicar offset temporário se estiver redimensionando pela esquerda
    let leftPx = startIndex * columnWidth  // MODIFICADO (era: startIndex * 50)
    if (tempStartOffsets.has(task.id)) {
      const offsetDays = tempStartOffsets.get(task.id)!
      leftPx += offsetDays * columnWidth  // MODIFICADO (era: offsetDays * 50)
    }
    // ========== FIM MODIFICADO ==========

    // Calcular largura: usar duration_days da tarefa (mais confiável)
    let widthPx: number
    if (tempDurations.has(task.id)) {
      // Usar duração temporária se estiver redimensionando
      widthPx = tempDurations.get(task.id)! * columnWidth
    } else {
      // Usar duration_days da tarefa (campo correto que já considera a duração real)
      widthPx = task.duration_days * columnWidth
    }

    return {
      left: `${leftPx}px`,
      width: `${widthPx}px`
    }
  }

  // Função para detectar se subtarefa está em atraso (fora da margem da tarefa principal)
  const isSubtaskDelayed = (subtask: TaskWithAllocations, parentTask: TaskWithAllocations | undefined): boolean => {
    if (!parentTask || !parentTask.subtasks || parentTask.subtasks.length === 0) return false

    // Encontrar o intervalo "puro" das subtarefas (sem margem)
    const subtasksOnly = parentTask.subtasks
    if (subtasksOnly.length === 0) return false

    const earliestSubtaskStart = subtasksOnly.reduce((earliest, sub) => {
      return sub.start_date < earliest ? sub.start_date : earliest
    }, subtasksOnly[0].start_date)

    const latestSubtaskEnd = subtasksOnly.reduce((latest, sub) => {
      return sub.end_date > latest ? sub.end_date : latest
    }, subtasksOnly[0].end_date)

    // Calcular o limite da tarefa principal SEM margem
    const parentStartNoMargin = earliestSubtaskStart
    const parentEndNoMargin = latestSubtaskEnd

    // Aplicar as margens para obter os limites com folga
    const marginStart = parentTask.margin_start || 0
    const marginEnd = parentTask.margin_end || 0

    const parentStartWithMargin = new Date(parentStartNoMargin)
    parentStartWithMargin.setDate(parentStartWithMargin.getDate() - Math.ceil(marginStart))

    const parentEndWithMargin = new Date(parentEndNoMargin)
    parentEndWithMargin.setDate(parentEndWithMargin.getDate() + Math.ceil(marginEnd))

    // Subtarefa está atrasada se estiver FORA do limite com margem
    return subtask.start_date < parentStartWithMargin || subtask.end_date > parentEndWithMargin
  }

  // Cores das tarefas
  const getTaskColor = (type: string, isSubtask: boolean, isDelayed: boolean = false, taskId?: string) => {
    // ========== NOVO: Tarefas em ciclo ficam vermelhas com borda ==========
    if (taskId && tasksInCycle.has(taskId)) return 'bg-red-600 border-2 border-red-900'
    // ========== FIM NOVO ==========

    // Subtarefas atrasadas ficam vermelhas
    if (isSubtask && isDelayed) return 'bg-red-600'

    if (isSubtask) return 'bg-gray-400'

    const colors: Record<string, string> = {
      'projeto_mecanico': 'bg-blue-500',
      'compras_mecanica': 'bg-purple-500',
      'projeto_eletrico': 'bg-yellow-500',
      'compras_eletrica': 'bg-orange-500',
      'fabricacao': 'bg-green-500',
      'tratamento_superficial': 'bg-pink-500',
      'montagem_mecanica': 'bg-indigo-500',
      'montagem_eletrica': 'bg-red-500',
      'coleta': 'bg-teal-500'
    }

    return colors[type] || 'bg-gray-500'
  }

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(taskId)) {
        newSet.delete(taskId)
      } else {
        newSet.add(taskId)
      }
      return newSet
    })
  }

  // ========== NOVO: Callback para expandir múltiplas tarefas de uma vez ==========
  const handleExpandMultipleTasks = (taskIds: string[]) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev)
      taskIds.forEach(id => newSet.add(id))
      return newSet
    })
  }
  // ========== FIM NOVO ==========

  async function deleteSubtask(subtaskId: string) {
    if (!confirm('Tem certeza que deseja excluir esta subtarefa?')) return

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', subtaskId)

      if (error) throw error
      onRefresh()
    } catch (error) {
      alert('Erro ao excluir subtarefa')
    }
  }
async function handleReorderTasks(draggedId: string, targetId: string) {
  try {
    // Encontrar as tarefas
    const draggedTask = tasks.find(t => t.id === draggedId)
    const targetTask = tasks.find(t => t.id === targetId)
    
    if (!draggedTask || !targetTask) return

    // Trocar sort_order
    const draggedOrder = draggedTask.sort_order
    const targetOrder = targetTask.sort_order

    // Atualizar no banco
    const { error: error1 } = await supabase
      .from('tasks')
      .update({ sort_order: targetOrder })
      .eq('id', draggedId)

    const { error: error2 } = await supabase
      .from('tasks')
      .update({ sort_order: draggedOrder })
      .eq('id', targetId)

    if (error1 || error2) {
      throw error1 || error2
    }

    // Atualizar localmente
    onRefresh()
  } catch (error) {
    alert('Erro ao reordenar tarefas')
  }
}

// Função para atualizar duração da tarefa ou margem
async function updateTaskDuration(taskId: string, newDuration: number, edge: 'start' | 'end' = 'end') {
  // Arredondar para múltiplos de 0.125 (1 hora)
  const roundedDuration = Math.round(newDuration / 0.125) * 0.125

  // Mínimo de 0.125 (1 hora)
  const finalDuration = Math.max(0.125, roundedDuration)

  try {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    const subtasks = tasks.filter(t => t.parent_id === taskId)
    const hasSubtasks = subtasks.length > 0

    if (hasSubtasks) {
      // Tarefa com subtarefas: ajustar margens ao invés de duração
      // IMPORTANTE: Usar duração calculada (tasksWithDates) ao invés de task.duration do banco
      const taskWithDates = tasksWithDates.find(t => t.id === taskId)
      if (!taskWithDates) return

      const currentDuration = taskWithDates.duration_days
      const deltaDuration = finalDuration - currentDuration

      if (edge === 'end') {
        // Alça direita: ajustar margin_end
        const newMarginEnd = (task.margin_end || 0) + deltaDuration
        const { error } = await supabase
          .from('tasks')
          .update({ margin_end: Math.max(0, newMarginEnd) })
          .eq('id', taskId)

        if (error) throw error
      } else {
        // Alça esquerda: ajustar margin_start
        const newMarginStart = (task.margin_start || 0) + deltaDuration
        const { error } = await supabase
          .from('tasks')
          .update({ margin_start: Math.max(0, newMarginStart) })
          .eq('id', taskId)

        if (error) throw error
      }
    } else {
      // Tarefa sem subtarefas (ou subtarefa): ajustar duração
      // Se a tarefa tem start_date e end_date, também precisamos atualizar as datas
      if (task.start_date && task.end_date) {
        const startDate = parseLocalDate(task.start_date)
        const endDate = parseLocalDate(task.end_date)
        if (!startDate || !endDate) return

        if (edge === 'end') {
          // Alça direita: manter start_date, alterar end_date
          const newEndDate = new Date(startDate)
          newEndDate.setDate(newEndDate.getDate() + Math.ceil(finalDuration) - 1)
          const formattedEndDate = newEndDate.toISOString().split('T')[0]

          const { error } = await supabase
            .from('tasks')
            .update({
              duration: finalDuration,
              end_date: formattedEndDate
            })
            .eq('id', taskId)

          if (error) throw error
        } else {
          // Alça esquerda: manter end_date, alterar start_date
          const daysToSubtract = Math.ceil(finalDuration)
          const newStartDate = new Date(endDate)
          newStartDate.setDate(newStartDate.getDate() - daysToSubtract + 1)
          const formattedStartDate = newStartDate.toISOString().split('T')[0]

          // ========== VALIDAÇÃO DE PREDECESSOR ==========
          const validation = validateTaskStartDate(
            task,
            newStartDate,
            tasks,
            predecessors
          )

          if (!validation.isValid) {
            alert(`❌ Não é possível mover a tarefa para esta data!\n\n${validation.message}\n\nUse a aba "Predecessor" para ajustar as dependências.`)
            onRefresh() // Recarrega para reverter mudança visual
            return
          }
          // ========== FIM VALIDAÇÃO ==========

          const { error } = await supabase
            .from('tasks')
            .update({
              duration: finalDuration,
              start_date: formattedStartDate
            })
            .eq('id', taskId)

          if (error) throw error
        }
      } else {
        // Tarefa sem datas: apenas atualizar duration
        const { error } = await supabase
          .from('tasks')
          .update({ duration: finalDuration })
          .eq('id', taskId)

        if (error) throw error
      }
    }

    // ========== AJUSTE DE TAREFA PAI SE FOR SUBTAREFA ==========
    if (task.parent_id) {
      const parentTask = tasks.find(t => t.id === task.parent_id)
      if (parentTask) {
        const siblings = tasks.filter(t => t.parent_id === parentTask.id)
        const maxSubtaskDuration = Math.max(
          ...siblings.map(s => s.id === taskId ? finalDuration : s.duration || 0)
        )

        if (maxSubtaskDuration > (parentTask.duration || 0)) {
          // Atualizar duração da tarefa pai
          if (parentTask.start_date) {
            const newParentEndDate = new Date(parentTask.start_date)
            newParentEndDate.setDate(newParentEndDate.getDate() + maxSubtaskDuration - 1)

            await supabase
              .from('tasks')
              .update({
                duration: maxSubtaskDuration,
                end_date: newParentEndDate.toISOString().split('T')[0]
              })
              .eq('id', parentTask.id)
          } else {
            await supabase
              .from('tasks')
              .update({ duration: maxSubtaskDuration })
              .eq('id', parentTask.id)
          }
        }
      }
    }
    // ========== FIM AJUSTE ==========

    // ========== NOVO: Recalcular tarefas dependentes em cascata ==========
    // Buscar dados atualizados do banco para garantir que temos as datas corretas
    const { data: updatedTasks, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', project.id)
      .order('sort_order')

    if (fetchError) {
      onRefresh()
      return
    }

    const updates = recalculateTasksInCascade(
      taskId,
      updatedTasks || tasks, // Usar dados atualizados do banco
      predecessors
    )

    if (updates.length > 0) {
      // Há tarefas dependentes que precisam ser recalculadas
      setPendingUpdates(updates)
      setShowRecalculateModal(true)
    } else {
      // Sem dependentes, apenas recarrega
      onRefresh()
    }
    // ========== FIM NOVO ==========

  } catch (error) {
    alert('Erro ao atualizar duração')
  }
}

// Handler para resize - quando começa o arrasto
function handleResizeStart(taskId: string, edge: 'start' | 'end', e: React.MouseEvent) {
  e.stopPropagation()
  e.preventDefault()

  const target = e.currentTarget.parentElement as HTMLElement
  const rect = target.getBoundingClientRect()

  setResizingTask({
    taskId,
    edge,
    startX: e.clientX,
    startWidth: rect.width,
    startLeft: rect.left
  })
}
useEffect(() => {
  loadPredecessors()
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [project.id])

// ========== NOVO: useEffect para detectar ciclos ==========
useEffect(() => {
  if (tasks.length > 0 && predecessors.length > 0) {
    const cycleDetection = detectCycles(tasks, predecessors)
    if (cycleDetection.hasCycle) {
      setTasksInCycle(new Set(cycleDetection.cycleNodes))
    } else {
      setTasksInCycle(new Set())
    }
  } else {
    setTasksInCycle(new Set())
  }
}, [tasks, predecessors])
// ========== FIM NOVO ==========

async function loadPredecessors() {
  const { data, error } = await supabase
    .from('predecessors')
    .select('*')
    .in('task_id', tasks.map(t => t.id))

  if (!error && data) {
    setPredecessors(data)

    // ========== NOVO: Calcular datas iniciais para tarefas sem data ==========
    await calculateInitialDates(data)
    // ========== FIM NOVO ==========
  }
}

// ========== NOVO: Função para calcular datas iniciais ==========
async function calculateInitialDates(predecessorData: any[]) {
  // Encontrar tarefas sem start_date que têm predecessores
  const tasksWithoutDates = tasks.filter(t => !t.start_date && predecessorData.some(p => p.task_id === t.id))

  if (tasksWithoutDates.length === 0) {
    return
  }

  // Para cada tarefa sem data, calcular baseado nos predecessores
  const updates = []

  for (const task of tasksWithoutDates) {
    // Pegar todos os predecessores desta tarefa
    const taskPreds = predecessorData.filter(p => p.task_id === task.id)

    for (const pred of taskPreds) {
      const predecessorTask = tasks.find(t => t.id === pred.predecessor_id)

      if (predecessorTask && predecessorTask.start_date) {
        try {
          const { calculateTaskDateFromPredecessor } = await import('@/utils/predecessorCalculations')

          const newDates = calculateTaskDateFromPredecessor(
            task,
            predecessorTask,
            pred
          )

          updates.push({
            id: task.id,
            start_date: newDates.start_date.toISOString().split('T')[0],
            end_date: newDates.end_date.toISOString().split('T')[0],
            reason: `Data inicial calculada baseada no predecessor "${predecessorTask.name}"`
          })

          break // Usar apenas o primeiro predecessor para cálculo inicial

        } catch (error) {
          // Erro ao calcular data - ignorar
        }
      }
    }
  }

  // Se há updates, aplicar diretamente ou mostrar modal
  if (updates.length > 0) {
    const { calculateDurationFromDates } = await import('@/utils/taskDateSync')

    for (const update of updates) {
      // Calcular duração baseada nas datas
      const calculatedDuration = calculateDurationFromDates(
        update.start_date,
        update.end_date
      )

      await supabase
        .from('tasks')
        .update({
          start_date: update.start_date,
          end_date: update.end_date,
          duration: calculatedDuration  // ✅ Atualizar duration também!
        })
        .eq('id', update.id)
    }

    onRefresh() // Recarregar para mostrar as mudanças
  }
}
// ========== FIM NOVO ==========

// ========== FUNÇÃO DE AUDITORIA DE CONFLITOS ==========
async function handleAuditConflicts() {
  try {
    // Buscar dados atualizados do banco
    const { data: allTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', project.id)
      .order('sort_order')

    const { data: allPredecessors, error: predsError } = await supabase
      .from('predecessors')
      .select('*')
      .in('task_id', tasks.map(t => t.id))

    if (tasksError || predsError) {
      alert('Erro ao buscar dados para auditoria')
      return
    }

    if (!allTasks || !allPredecessors) {
      onRefresh()
      return
    }

    // Executar auditoria
    const conflicts = auditPredecessorConflicts(allTasks, allPredecessors)

    if (conflicts.length === 0) {
      // Sem conflitos encontrados!
      alert('✅ Nenhum conflito encontrado!\n\nTodas as tarefas estão sincronizadas corretamente com seus predecessores.')
      onRefresh()
    } else {
      // Conflitos encontrados - mostrar modal de recálculo
      setPendingUpdates(conflicts)
      setShowRecalculateModal(true)
    }
  } catch (error) {
    alert('Erro ao auditar conflitos: ' + (error as Error).message)
  }
}
// ========== FIM FUNÇÃO DE AUDITORIA ==========

// useEffect para lidar com mousemove e mouseup globalmente
// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {
  if (!resizingTask) {
    document.body.classList.remove('resizing')
    return
  }

  // Adicionar classe para desabilitar seleção de texto
  document.body.classList.add('resizing')

  const handleMouseMove = (e: MouseEvent) => {
    e.preventDefault()
    if (!resizingTask) return

    const deltaX = e.clientX - resizingTask.startX
    const pixelsPerDay = 50 // 50px = 1 dia
    const deltaDays = deltaX / pixelsPerDay

    // Calcular nova duração baseado na borda sendo arrastada
    // IMPORTANTE: Usar tasksWithDates (com duration_days calculada) ao invés de tasks (do banco)
    const task = tasksWithDates.find(t => t.id === resizingTask.taskId)
    if (!task) return

    if (resizingTask.edge === 'end') {
      // Arrastando borda direita - aumenta/diminui duração mantendo início fixo
      const newDuration = Math.max(0.125, task.duration_days + deltaDays)
      const roundedDuration = Math.round(newDuration / 0.125) * 0.125

      // Atualizar visualmente com duração temporária
      setTempDurations(prev => {
        const newMap = new Map(prev)
        newMap.set(resizingTask.taskId, roundedDuration)
        return newMap
      })

      // Limpar offset de início (se houver)
      setTempStartOffsets(prev => {
        const newMap = new Map(prev)
        newMap.delete(resizingTask.taskId)
        return newMap
      })
    } else {
      // Arrastando borda esquerda - move a data de início, mantém data de fim fixa
      // Se arrastar para DIREITA (+deltaDays), a duração DIMINUI
      // Se arrastar para ESQUERDA (-deltaDays), a duração AUMENTA
      const newDuration = Math.max(0.125, task.duration_days - deltaDays)
      const roundedDuration = Math.round(newDuration / 0.125) * 0.125

      // Atualizar duração
      setTempDurations(prev => {
        const newMap = new Map(prev)
        newMap.set(resizingTask.taskId, roundedDuration)
        return newMap
      })

      // Atualizar offset da posição inicial
      // IMPORTANTE: O offset visual é o deltaDays (movimento do mouse)
      // Mas precisamos ajustar pelo arredondamento da duração
      const durationChange = roundedDuration - task.duration_days
      const visualOffset = -durationChange // Inverter porque diminuir duração = mover para direita

      setTempStartOffsets(prev => {
        const newMap = new Map(prev)
        newMap.set(resizingTask.taskId, visualOffset)
        return newMap
      })
    }
  }

  const handleMouseUp = async (e: MouseEvent) => {
    e.preventDefault()
    if (!resizingTask) return

    document.body.classList.remove('resizing')

    const deltaX = e.clientX - resizingTask.startX
    const pixelsPerDay = 50
    const deltaDays = deltaX / pixelsPerDay

    // Buscar tarefa com duração calculada
    const taskWithDates = tasksWithDates.find(t => t.id === resizingTask.taskId)
    const taskFromDB = tasks.find(t => t.id === resizingTask.taskId)

    if (!taskWithDates || !taskFromDB) {
      setResizingTask(null)
      setTempDurations(new Map())
      return
    }

    let newDuration: number

    if (resizingTask.edge === 'end' || resizingTask.edge === 'start') {
      // Usar duration_days (calculada visualmente) ao invés de duration (do banco)
      if (resizingTask.edge === 'end') {
        // Alça direita: adicionar o delta
        newDuration = Math.max(0.125, taskWithDates.duration_days + deltaDays)
      } else {
        // Alça esquerda: subtrair o delta (arrastar direita diminui duração)
        newDuration = Math.max(0.125, taskWithDates.duration_days - deltaDays)
      }

      newDuration = Math.round(newDuration / 0.125) * 0.125

      // Salvar no banco (passa o edge para saber se é margem inicial ou final)
      await updateTaskDuration(taskFromDB.id, newDuration, resizingTask.edge)
    }

    // Limpar estados temporários
    setTempDurations(new Map())
    setTempStartOffsets(new Map())
    setResizingTask(null)
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)

  return () => {
    document.body.classList.remove('resizing')
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [resizingTask, tasks])
  // Função recursiva para renderizar tarefas em QUALQUER nível
  const renderTaskRecursive = (
    task: TaskWithAllocations,
    level: number = 0,
    parentTask?: TaskWithAllocations
  ): JSX.Element => {
    const isSubtask = !!task.parent_id
    const hasSubtasks = task.subtasks && task.subtasks.length > 0
    const isExpanded = task.isExpanded

    // Calcular indentação baseado no outline_level (mais preciso) ou level
    const indentLevel = task.outline_level || level
    const indent = indentLevel * 20 // 20px por nível

    // Detectar atraso (se for subtarefa)
    const isDelayed = isSubtask && parentTask
      ? isSubtaskDelayed(task, parentTask)
      : false

    const taskElement = (
      <div
        key={task.id}
        className={`flex border-b hover:bg-gray-50 transition-colors ${
          draggedTask === task.id ? 'dragging-row' : ''
        } ${dragOverTask === task.id ? 'drag-over-row' : ''}`}
        onDragOver={(e) => {
          if (!isSubtask && draggedTask && draggedTask !== task.id) {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            setDragOverTask(task.id)
          }
        }}
        onDragLeave={() => {
          setDragOverTask(null)
        }}
        onDrop={async (e) => {
          e.preventDefault()
          if (!isSubtask && draggedTask && dragOverTask) {
            await handleReorderTasks(draggedTask, dragOverTask)
          }
          setDraggedTask(null)
          setDragOverTask(null)
        }}
      >
        {/* Coluna de nome da tarefa */}
        <div
          className="w-80 px-4 py-3 border-r flex items-center justify-between"
          style={{ paddingLeft: `${16 + indent}px` }} // Indentação dinâmica
        >
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            {/* Alça de arrasto (drag handle) - apenas para tarefas principais */}
            {!isSubtask && (
              <div
                draggable
                onDragStart={(e) => {
                  setDraggedTask(task.id)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragEnd={() => {
                  setDraggedTask(null)
                  setDragOverTask(null)
                }}
                className="drag-handle flex-shrink-0 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
                title="Arrastar para reordenar"
              >
                ⋮⋮
              </div>
            )}

            {/* Botão Expand/Collapse */}
            {hasSubtasks && (
              <button
                onClick={() => toggleTaskExpansion(task.id)}
                className="flex-shrink-0 w-5 h-5 flex items-center justify-center hover:bg-red-200 rounded"
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}

            {!hasSubtasks && isSubtask && (
              <span className="text-gray-400 flex-shrink-0">└</span>
            )}

            {/* WBS Code (se disponível) */}
            {task.wbs_code && (
              <span className="text-xs text-gray-500 font-mono flex-shrink-0">
                {task.wbs_code}
              </span>
            )}

            {/* Nome da Tarefa */}
            <div className="flex-1 min-w-0">
              <div
                className={`text-sm truncate cursor-pointer ${
                  isSubtask ? 'text-gray-700' : 'font-semibold text-gray-900'
                }`}
                onClick={() => setSelectedTask(task.id)}
                title={task.name}
              >
                {task.name}
              </div>
              <div className="text-xs text-gray-500">
                {task.duration_days}d • {task.progress}%
                {/* Badges de pessoas alocadas */}
                {task.allocations && task.allocations.length > 0 && (
                  <div className="flex gap-1 ml-2">
                    {task.allocations.slice(0, 2).map(alloc => (
                      <span
                        key={alloc.id}
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700 font-medium"
                        title={`${alloc.resource?.name} (${alloc.priority})`}
                      >
                        👤 {alloc.resource?.name?.split(' ')[0]}
                      </span>
                    ))}
                    {task.allocations.length > 2 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600">
                        +{task.allocations.length - 2}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
            {!isSubtask && (
              <button
                onClick={() => setSubtaskModalTask(tasks.find(t => t.id === task.id)!)}
                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                + Subtarefa
              </button>
            )}
            {isSubtask && (
              <button
                onClick={() => deleteSubtask(task.id)}
                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                🗑️
              </button>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="relative h-20 border-r flex-1">
          {/* Grid de fundo */}
          <div className="absolute inset-0 flex">
            {dateGridWithBuffer.map((date, index) => {
              const columnWidth = getColumnWidth()
              const dateKey = date.toISOString().split('T')[0]
              const isSelected = selectedDay === dateKey
              const isToday = date.toDateString() === new Date().toDateString()

              // Verificar se esta coluna está na área de buffer
              const isBufferColumn = date > maxDate

              return (
                <div
                  key={index}
                  className={`border-r ${
                    isBufferColumn
                      ? 'bg-gray-50 border-gray-200'
                      : isSelected
                      ? 'bg-blue-50 border-blue-300 border-r-2'
                      : isToday
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'border-gray-100'
                  }`}
                  style={{ width: `${columnWidth}px`, minWidth: `${columnWidth}px` }}
                />
              )
            })}
          </div>

          {/* Linha de conexão */}
          {(() => {
            const barStyle = getTaskBarStyle(task)
            const leftPx = parseInt(barStyle.left as string) || 0

            if (leftPx > 0) {
              return (
                <div
                  className="absolute top-1/2 transform -translate-y-1/2 h-[2px]"
                  style={{
                    left: '0px',
                    width: `${leftPx}px`,
                    backgroundColor: isSubtask
                      ? 'rgba(156, 163, 175, 0.3)'
                      : 'rgba(239, 68, 68, 0.4)'
                  }}
                />
              )
            }
            return null
          })()}

          {/* Barra da tarefa */}
          <div
            className={`absolute top-1/2 transform -translate-y-1/2 h-8 rounded shadow-sm ${getTaskColor(task.type, isSubtask, isDelayed, task.id)} ${
              isSubtask ? 'opacity-70' : 'opacity-90'
            } ${selectedTask === task.id ? 'ring-2 ring-blue-500' : ''} ${
              isDelayed ? 'ring-2 ring-red-600' : ''
            } hover:opacity-100 cursor-pointer flex items-center group ${
              resizingTask?.taskId === task.id ? 'task-bar-resizing' : 'task-bar-normal'
            }`}
            style={{
              ...getTaskBarStyle(task),
              minWidth: '40px'
            }}
            onClick={() => setSelectedTask(task.id)}
          >
            {/* Alça de resize ESQUERDA (início) */}
            <div
              className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize bg-white bg-opacity-0 group-hover:bg-opacity-30 hover:bg-opacity-50 transition-all z-10"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => handleResizeStart(task.id, 'start', e)}
              title="Arrastar para alterar data de início"
            >
              <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-4 bg-white rounded-r opacity-0 group-hover:opacity-100" />
            </div>

            {/* Conteúdo da barra (duração) */}
            <div className="flex items-center justify-center h-full px-2 gap-1 flex-1 pointer-events-none">
              <span className="text-white text-xs font-semibold truncate">
                {tempDurations.has(task.id)
                  ? `${Math.ceil(tempDurations.get(task.id)!)}d`
                  : `${task.duration_days}d`
                }
              </span>
              {isDelayed && (
                <span className="text-white text-[10px] font-bold bg-red-800 px-1 rounded">
                  ATRASO
                </span>
              )}
              {/* ========== NOVO: Badge de Ciclo ========== */}
              {tasksInCycle.has(task.id) && (
                <span className="text-white text-[10px] font-bold bg-red-900 px-1 rounded animate-pulse">
                  CICLO
                </span>
              )}
              {/* ========== FIM NOVO ========== */}
            </div>

            {/* Indicador de resize em tempo real */}
            {tempDurations.has(task.id) && resizingTask?.taskId === task.id && (
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-2 py-1 rounded shadow-lg text-xs font-semibold whitespace-nowrap z-20">
                {tempDurations.get(task.id)!.toFixed(3)} dias
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-blue-600"></div>
              </div>
            )}

            {/* Alça de resize DIREITA (fim) */}
            <div
              className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize bg-white bg-opacity-0 group-hover:bg-opacity-30 hover:bg-opacity-50 transition-all z-10"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => handleResizeStart(task.id, 'end', e)}
              onDoubleClick={(e) => {
                e.stopPropagation()
                const newDuration = prompt(
                  `Duração atual: ${task.duration} dias\n\n` +
                  `Digite a nova duração em dias:\n` +
                  `- 1 dia = 8 horas\n` +
                  `- 0.5 = 4 horas\n` +
                  `- 0.25 = 2 horas\n` +
                  `- 0.125 = 1 hora`,
                  task.duration.toString()
                )

                if (newDuration) {
                  const parsed = parseFloat(newDuration)
                  if (!isNaN(parsed) && parsed > 0) {
                    updateTaskDuration(task.id, parsed)
                  }
                }
              }}
              title="Arrastar para redimensionar | Duplo clique para editar"
            >
              <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-1 h-4 bg-white rounded-l opacity-0 group-hover:opacity-100" />
            </div>
          </div>
        </div>
      </div>
    )

    // SE tem subtarefas E está expandido → renderizar recursivamente
    if (hasSubtasks && isExpanded) {
      return (
        <React.Fragment key={task.id}>
          {taskElement}
          {task.subtasks!.map(subtask =>
            renderTaskRecursive(subtask, level + 1, task)
          )}
        </React.Fragment>
      )
    }

    return taskElement
  }

  return (
    <>
      <style>{styles}</style>
      <div className="bg-white rounded-lg border overflow-hidden">
        {/* Header do Gantt */}
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Cronograma Gantt</h2>
              <p className="text-sm text-gray-600">
                {tasksWithDates.length} tarefas • {dateGrid.length} dias
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAuditConflicts}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                title="Verificar e corrigir conflitos de predecessores"
              >
                🔄 Verificar Conflitos
              </button>
              <button
                onClick={() => setShowCycleAudit(true)}
                className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600 flex items-center gap-2"
                title="Verificar ciclos em predecessores"
              >
                🔄 Auditar Ciclos
              </button>
            </div>
          </div>
        </div>

        {/* Barra de filtros */}
        <div className="bg-white border-b p-4">
          <div className="flex items-center gap-4">
            {/* Filtro por Tipo */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Tipo:</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900 bg-white"
              >
                <option value="all">Todos</option>
                <option value="projeto_mecanico">Projeto Mecânico</option>
                <option value="compras_mecanica">Compras Mecânica</option>
                <option value="projeto_eletrico">Projeto Elétrico</option>
                <option value="compras_eletrica">Compras Elétrica</option>
                <option value="fabricacao">Fabricação</option>
                <option value="tratamento_superficial">Tratamento Superficial</option>
                <option value="montagem_mecanica">Montagem Mecânica</option>
                <option value="montagem_eletrica">Montagem Elétrica</option>
                <option value="coleta">Coleta</option>
              </select>
            </div>

            {/* Filtro por Pessoa */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Pessoa:</label>
              <select
                value={filterPerson}
                onChange={(e) => setFilterPerson(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900 bg-white"
              >
                <option value="all">Todas</option>
                {resources.map(resource => (
                  <option key={resource.id} value={resource.id}>
                    {resource.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por Progresso */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Status:</label>
              <select
                value={filterProgress}
                onChange={(e) => setFilterProgress(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900 bg-white"
              >
                <option value="all">Todos</option>
                <option value="not_started">Não iniciado (0%)</option>
                <option value="in_progress">Em andamento (1-99%)</option>
                <option value="completed">Concluído (100%)</option>
              </select>
            </div>

            {/* Contador e limpar */}
            <div className="ml-auto flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {organizedTasks.length} tarefa(s)
              </span>

              {(filterType !== 'all' || filterPerson !== 'all' || filterProgress !== 'all') && (
                <button
                  onClick={() => {
                    setFilterType('all')
                    setFilterPerson('all')
                    setFilterProgress('all')
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 underline"
                >
                  Limpar filtros
                </button>
              )}

              {/* ========== NOVO: Controles de Zoom ========== */}
              <div className="flex items-center gap-2 border-l pl-4">
                <span className="text-xs font-medium text-gray-700 mr-2">Zoom:</span>

                <button
                  onClick={() => setZoomLevel('day')}
                  className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                    zoomLevel === 'day'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  📅 Dia
                </button>

                <button
                  onClick={() => setZoomLevel('week')}
                  className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                    zoomLevel === 'week'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  📆 Semana
                </button>

                <button
                  onClick={() => setZoomLevel('month')}
                  className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                    zoomLevel === 'month'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  📊 Mês
                </button>
              </div>
              {/* ========== FIM NOVO ========== */}
            </div>
          </div>
        </div>

        {/* Área de scroll horizontal */}
        <div
          className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] transition-all duration-300"
          style={{ paddingBottom: selectedTask ? '200px' : '0' }}
        >
          <div className="min-w-max relative">
            {/* Cabeçalho de datas */}
<div className="flex border-b bg-gray-50 sticky top-0 z-20">
              <div className="w-80 px-4 py-2 border-r font-medium text-gray-700">
                Tarefa
              </div>
              <div className="flex">
                {dateGridWithBuffer.map((date, index) => {
                  const columnWidth = getColumnWidth()
                  const dateKey = date.toISOString().split('T')[0]
                  const isSelected = selectedDay === dateKey
                  const isToday = date.toDateString() === new Date().toDateString()

                  // Verificar se esta coluna está na área de buffer
                  const isBufferColumn = date > maxDate

                  // Ajustar espaçamento e fonte baseado no zoom
                  const padding = zoomLevel === 'month' ? 'px-0.5 py-1' : zoomLevel === 'day' ? 'px-4 py-2' : 'px-2 py-2'
                  const fontSize = zoomLevel === 'month' ? 'text-[9px]' : 'text-xs'

                  return (
                    <div
                      key={index}
                      className={`border-r text-center cursor-pointer transition-colors ${padding} ${
                        isBufferColumn
                          ? 'bg-green-50 border-green-200 font-semibold'
                          : isSelected
                          ? 'bg-blue-100 border-blue-400 border-2'
                          : isToday
                          ? 'bg-yellow-50'
                          : 'hover:bg-gray-100'
                      }`}
                      style={{ width: `${columnWidth}px`, minWidth: `${columnWidth}px` }}
                      onClick={() => setSelectedDay(isSelected ? null : dateKey)}
                      title={`${date.toLocaleDateString('pt-BR', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}${isToday ? ' (Hoje)' : ''}`}
                    >
                      <div className={`${fontSize} font-medium ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                        {date.getDate()}
                      </div>
                      {zoomLevel !== 'month' && (
                        <div className={`${fontSize} ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
                          {date.toLocaleDateString('pt-BR', { month: 'short' })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ========== NOVO: Container de linhas com overlay SVG ========== */}
            <div className="relative">
              {/* Linhas de tarefas */}
              {organizedTasks.map((task) => renderTaskRecursive(task, 0))}

              {/* ========== Buffer Visual ========== */}
              {(() => {
                // Calcular informações do buffer
                const bufferInfo = calculateProjectBuffer(project, tasks)
                const columnWidth = getColumnWidth()

                // Se não há buffer configurado, não renderizar
                if (!project.buffer_days || project.buffer_days === 0) return null

                // Encontrar a última tarefa para posicionar o buffer
                const lastTaskEndDate = bufferInfo.realEndDate
                const bufferEndDate = bufferInfo.bufferEndDate

                // Buffer deve começar NO DIA SEGUINTE ao fim da última tarefa
                const bufferStartDate = new Date(lastTaskEndDate)
                bufferStartDate.setDate(bufferStartDate.getDate() + 1)

                // Calcular posição: encontrar índice do bufferStartDate no dateGridWithBuffer
                const bufferStartIndex = dateGridWithBuffer.findIndex(d =>
                  d.toISOString().split('T')[0] === bufferStartDate.toISOString().split('T')[0]
                )

                const bufferDays = project.buffer_days
                // Se encontrou o índice, usar ele; senão calcular manualmente
                const bufferStartPx = bufferStartIndex >= 0
                  ? (bufferStartIndex * columnWidth) + 320
                  : (dateGrid.length * columnWidth) + 320 // Posição após todas as tarefas
                const bufferWidthPx = bufferDays * columnWidth


                // Determinar cor baseada no status
                let bufferColor = 'bg-green-200'
                let borderColor = 'border-green-400'
                let pattern = 'bg-pattern-dots'
                let statusText = 'Buffer Seguro'
                let statusIcon = '✅'

                if (bufferInfo.bufferStatus === 'exceeded') {
                  bufferColor = 'bg-red-200'
                  borderColor = 'border-red-400'
                  pattern = 'bg-pattern-cross'
                  statusText = 'Buffer Excedido'
                  statusIcon = '🔴'
                } else if (bufferInfo.bufferStatus === 'consumed') {
                  bufferColor = 'bg-yellow-200'
                  borderColor = 'border-yellow-400'
                  pattern = 'bg-pattern-diagonal'
                  statusText = 'Buffer Consumido'
                  statusIcon = '🟡'
                }

                return (
                  <div
                    className="absolute top-0 h-full pointer-events-none z-10"
                    style={{ left: `${bufferStartPx}px`, width: `${bufferWidthPx}px` }}
                  >
                    {/* Barra visual do buffer */}
                    <div
                      className={`h-full ${bufferColor} ${borderColor} ${pattern} border-l-4 border-r-4 border-dashed opacity-60`}
                      title={`${statusText}: ${project.buffer_days} dias`}
                    >
                      {/* Label do buffer no topo */}
                      <div className="sticky top-0 flex items-center justify-center pt-2">
                        <div className={`px-3 py-1 rounded-full text-xs font-semibold shadow-lg pointer-events-auto
                          ${bufferInfo.bufferStatus === 'safe' ? 'bg-green-600 text-white border-2 border-green-700' : ''}
                          ${bufferInfo.bufferStatus === 'consumed' ? 'bg-yellow-600 text-white border-2 border-yellow-700' : ''}
                          ${bufferInfo.bufferStatus === 'exceeded' ? 'bg-red-600 text-white border-2 border-red-700' : ''}
                        `}>
                          <span className="mr-1">{statusIcon}</span>
                          Buffer: {project.buffer_days}d
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Linhas de Predecessores - overlay absoluto */}
              <PredecessorLines
                tasks={tasks}
                predecessors={predecessors}
                dateRange={{
                  start: dateGrid.length > 0 ? dateGrid[0] : new Date(),
                  end: dateGrid.length > 0 ? dateGrid[dateGrid.length - 1] : new Date()
                }}
                dayWidth={getColumnWidth()}
                rowHeight={80}
                expandedTasks={expandedTasks}
                onExpandTasks={handleExpandMultipleTasks}
              />
            </div>
            {/* ========== FIM NOVO ========== */}
          </div>
        </div>
      </div>

      {/* Modais */}
      {allocationModalTask && (
        <AllocationModal
          task={allocationModalTask}
          projectLeaderId={project.leader_id}
          onClose={() => setAllocationModalTask(null)}
          onSuccess={onRefresh}
        />
      )}

      {subtaskModalTask && (
        <SubtaskManager
          parentTask={subtaskModalTask}
          onClose={() => setSubtaskModalTask(null)}
          onSuccess={onRefresh}
        />
      )}

      {/* Modal de edição de custos */}
      {editingCostsTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                💰 Editar Custos
              </h3>
              <button
                onClick={() => setEditingCostsTask(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="mb-3">
              <p className="text-sm text-gray-700 font-medium mb-2">
                {editingCostsTask.name}
              </p>
            </div>

            <div className="space-y-4">
              {/* Custo Estimado */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custo Estimado
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">R$</span>
                  <input
                    type="number"
                    defaultValue={editingCostsTask.estimated_cost || ''}
                    placeholder="0,00"
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white"
                    step="0.01"
                    min="0"
                    id="estimated-cost-input"
                  />
                </div>
              </div>

              {/* Custo Real */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custo Real
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">R$</span>
                  <input
                    type="number"
                    defaultValue={editingCostsTask.actual_cost || ''}
                    placeholder="0,00"
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white"
                    step="0.01"
                    min="0"
                    id="actual-cost-input"
                  />
                </div>
              </div>
            </div>

            {/* Botões */}
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setEditingCostsTask(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const estimatedInput = document.getElementById('estimated-cost-input') as HTMLInputElement
                  const actualInput = document.getElementById('actual-cost-input') as HTMLInputElement

                  const { error } = await supabase
                    .from('tasks')
                    .update({
                      estimated_cost: estimatedInput.value ? parseFloat(estimatedInput.value) : 0,
                      actual_cost: actualInput.value ? parseFloat(actualInput.value) : 0
                    })
                    .eq('id', editingCostsTask.id)

                  if (error) {
                    alert('Erro ao salvar custos')
                  } else {
                    setEditingCostsTask(null)
                    onRefresh()
                  }
                }}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

     {/* Painel flutuante de detalhes */}
{selectedTask && (() => {
  const task = tasksWithDates.find(t => t.id === selectedTask)
  const taskAllocations = allocations.filter(a => a.task_id === selectedTask)
  
  if (!task) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t z-30 animate-slide-up glassmorphism-panel">
      <div className="max-w-7xl mx-auto p-4">
        {/* Header do painel */}
        <div className="flex items-center justify-between mb-3 pb-2 border-b">
          <h3 className="text-sm font-semibold text-gray-900">
            📋 {task.name}
          </h3>
          <button
            onClick={() => setSelectedTask(null)}
            className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded"
          >
            ✕
          </button>
        </div>

        {/* Conteúdo compacto */}
        <div className="grid grid-cols-8 gap-3 text-xs">
          <div>
            <p className="text-gray-500 mb-0.5">Tipo</p>
            <p className="font-medium text-gray-900">{task.type.replace(/_/g, ' ')}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-0.5">Duração</p>
            <p className="font-medium text-gray-900">{task.duration_days}d</p>
          </div>
          <div>
            <p className="text-gray-500 mb-0.5">Progresso</p>
            <p className="font-medium text-gray-900">{task.progress}%</p>
          </div>
          <div>
            <p className="text-gray-500 mb-0.5">Início</p>
            <p className="font-medium text-gray-900">
              {formatDateBR(task.start_date.toISOString())}
            </p>
          </div>
          <div>
            <p className="text-gray-500 mb-0.5">Fim</p>
            <p className="font-medium text-gray-900">
              {formatDateBR(task.end_date.toISOString())}
            </p>
          </div>

            {/* ADICIONE ESTAS COLUNAS */}
  <div>
    <p className="text-gray-500 mb-0.5">Custo Est.</p>
    <p className="font-medium text-green-700">
      R$ {(task.estimated_cost || 0).toFixed(2).replace('.', ',')}
    </p>
  </div>
  <div>
    <p className="text-gray-500 mb-0.5">Custo Real</p>
    <p className="font-medium text-blue-700">
      R$ {(task.actual_cost || 0).toFixed(2).replace('.', ',')}
    </p>
  </div>
  
  <div className="col-span-1">
    <p className="text-gray-500 mb-0.5">Ações</p>
    <div className="flex gap-1">
      <button
        onClick={() => setAllocationModalTask(tasks.find(t => t.id === selectedTask)!)}
        className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
        title="Alocar Pessoa"
      >
        👥
      </button>
      <button
        onClick={() => setEditingCostsTask(tasks.find(t => t.id === selectedTask)!)}
        className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
        title="Editar Custos"
      >
        💰
      </button>
    </div>
  </div>

        </div>

        {/* Pessoas alocadas */}
        {taskAllocations.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-gray-500 mb-1.5">Pessoas Alocadas:</p>
            <div className="flex flex-wrap gap-1.5">
              {taskAllocations.map(alloc => {
                const resource = resources.find(r => r.id === alloc.resource_id)
                return (
                  <span
                    key={alloc.id}
                    className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs"
                  >
                    {resource?.name || 'N/A'} • {alloc.priority}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
})()}

      {/* ========== NOVO: Modal de Recalculação em Cascata ========== */}
      <RecalculateModal
        isOpen={showRecalculateModal}
        updates={pendingUpdates}
        taskNames={new Map(tasks.map(t => [t.id, t.name]))}
        onClose={() => {
          setShowRecalculateModal(false)
          setPendingUpdates([])
          onRefresh() // Recarrega mesmo se cancelar
        }}
        onApply={() => {
          setShowRecalculateModal(false)
          setPendingUpdates([])
          onRefresh() // Recarrega após aplicar
        }}
      />
      {/* ========== FIM NOVO ========== */}

      {/* ========== NOVO: Modal de Auditoria de Ciclos ========== */}
      {showCycleAudit && (
        <CycleAuditModal
          projectId={project.id}
          tasks={tasks}
          isOpen={showCycleAudit}
          onClose={() => setShowCycleAudit(false)}
          onRefresh={onRefresh}
        />
      )}
      {/* ========== FIM NOVO ========== */}
    </>
  )
}