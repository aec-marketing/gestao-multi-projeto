'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Project, Task, Resource } from '@/types/database.types'
import { Allocation } from '@/types/allocation.types'
import AllocationModal from '@/components/AllocationModal'
import { parseLocalDate, formatDateBR } from '@/utils/date.utils'
import SubtaskManager from '@/components/SubtaskManager'

interface GanttViewTabProps {
  project: Project
  tasks: Task[]
  resources: Resource[]
  allocations: Allocation[]
  onRefresh: () => void
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
  onRefresh
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

  function calculateTaskDates(): TaskWithDates[] {
    if (!project?.start_date) return []

    const projectStart = parseLocalDate(project.start_date)!
    if (!projectStart) return []
    
    // Separar tarefas principais e subtarefas
    const mainTasks = tasks.filter(t => !t.parent_id)
    const subtasksMap = new Map<string, Task[]>()
    
    tasks.filter(t => t.parent_id).forEach(subtask => {
      if (!subtasksMap.has(subtask.parent_id!)) {
        subtasksMap.set(subtask.parent_id!, [])
      }
      subtasksMap.get(subtask.parent_id!)!.push(subtask)
    })

    const result: TaskWithDates[] = []
    
    // Processar cada tarefa principal
    mainTasks.forEach(task => {
      const subtasks = subtasksMap.get(task.id) || []
      
      // ═══════════════════════════════════════════════════════════════
      // MODO 1: Tarefa com datas definidas (MS Project ou manual)
      // ═══════════════════════════════════════════════════════════════
      if (task.start_date && task.end_date) {
        let taskStartDate = parseLocalDate(task.start_date)
        let taskEndDate = parseLocalDate(task.end_date)
        if (!taskStartDate || !taskEndDate) return

        // Processar subtarefas primeiro para encontrar o intervalo real
        const processedSubtasks: TaskWithDates[] = []
        subtasks.forEach(subtask => {
          if (subtask.start_date && subtask.end_date) {
            // Subtarefa com datas definidas (do MS Project)
            const subStart = parseLocalDate(subtask.start_date)
            const subEnd = parseLocalDate(subtask.end_date)
            if (!subStart || !subEnd) return

            // Calcular duração REAL baseada nas datas (não usar subtask.duration)
            const realDuration = Math.floor((subEnd.getTime() - subStart.getTime()) / (1000 * 60 * 60 * 24)) + 1

            processedSubtasks.push({
              ...subtask,
              start_date: subStart,
              end_date: subEnd,
              duration_days: realDuration
            })
          } else {
            // Subtarefa sem datas - usar início da tarefa pai
            if (!taskStartDate) return
            const subtaskStart = new Date(taskStartDate)
            const subtaskDuration = Math.ceil(subtask.duration)
            const subtaskEnd = new Date(subtaskStart)
            subtaskEnd.setDate(subtaskEnd.getDate() + subtaskDuration - 1)

            processedSubtasks.push({
              ...subtask,
              start_date: subtaskStart,
              end_date: subtaskEnd,
              duration_days: subtaskDuration
            })
          }
        })

        // Se há subtarefas com datas, calcular início/fim baseado nelas + margens
        if (processedSubtasks.length > 0) {
          const earliestSubtaskStart = processedSubtasks.reduce((earliest, sub) => {
            return sub.start_date < earliest ? sub.start_date : earliest
          }, processedSubtasks[0].start_date)

          const latestSubtaskEnd = processedSubtasks.reduce((latest, sub) => {
            return sub.end_date > latest ? sub.end_date : latest
          }, processedSubtasks[0].end_date)

          // Aplicar margens (folga antes e depois das subtarefas)
          const marginStart = task.margin_start || 0
          const marginEnd = task.margin_end || 0

          // Calcular datas da tarefa principal com margens
          taskStartDate = new Date(earliestSubtaskStart)
          taskStartDate.setDate(taskStartDate.getDate() - Math.ceil(marginStart))

          taskEndDate = new Date(latestSubtaskEnd)
          taskEndDate.setDate(taskEndDate.getDate() + Math.ceil(marginEnd))
        }

        // Calcular duração real incluindo gaps e margens
        const taskDuration = Math.floor((taskEndDate.getTime() - taskStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

        // Adicionar tarefa principal
        result.push({
          ...task,
          start_date: taskStartDate,
          end_date: taskEndDate,
          duration_days: taskDuration
        })

        // Adicionar subtarefas processadas
        processedSubtasks.forEach(subtask => result.push(subtask))
        
      } 
      // ═══════════════════════════════════════════════════════════════
      // MODO 2: Tarefa SEM datas - calcular usando data do projeto
      // ═══════════════════════════════════════════════════════════════
      else {
        const startDate = new Date(projectStart)
        let taskDuration: number
        let endDate: Date

        if (subtasks.length > 0) {
          // Processar subtarefas sequencialmente
          const processedSubtasks: TaskWithDates[] = []

          // Aplicar margem de início
          const marginStart = task.margin_start || 0
          const marginEnd = task.margin_end || 0

          let subtaskCurrentDate = new Date(startDate)
          subtaskCurrentDate.setDate(subtaskCurrentDate.getDate() + Math.ceil(marginStart))

          subtasks.forEach(subtask => {
            const subtaskStart = new Date(subtaskCurrentDate)
            const subtaskDuration = Math.ceil(subtask.duration)
            const subtaskEnd = new Date(subtaskStart)
            subtaskEnd.setDate(subtaskEnd.getDate() + subtaskDuration - 1)

            processedSubtasks.push({
              ...subtask,
              start_date: subtaskStart,
              end_date: subtaskEnd,
              duration_days: subtaskDuration
            })

            subtaskCurrentDate = new Date(subtaskEnd)
            subtaskCurrentDate.setDate(subtaskCurrentDate.getDate() + 1)
          })

          // Calcular intervalo real da tarefa pai baseado nas subtarefas + margens
          const firstSubtaskStart = processedSubtasks[0].start_date
          const lastSubtaskEnd = processedSubtasks[processedSubtasks.length - 1].end_date

          // Data de início da tarefa = início da primeira subtarefa - margem
          const taskStartWithMargin = new Date(firstSubtaskStart)
          taskStartWithMargin.setDate(taskStartWithMargin.getDate() - Math.ceil(marginStart))

          // Data de fim da tarefa = fim da última subtarefa + margem
          const taskEndWithMargin = new Date(lastSubtaskEnd)
          taskEndWithMargin.setDate(taskEndWithMargin.getDate() + Math.ceil(marginEnd))

          // Duração = diferença entre primeiro início e último fim (incluindo gaps e margens)
          taskDuration = Math.floor((taskEndWithMargin.getTime() - taskStartWithMargin.getTime()) / (1000 * 60 * 60 * 24)) + 1
          endDate = taskEndWithMargin

          // Adicionar subtarefas processadas
          processedSubtasks.forEach(subtask => result.push(subtask))
        } else {
          // Sem subtarefas
          taskDuration = Math.ceil(task.duration)
          endDate = new Date(startDate)
          endDate.setDate(endDate.getDate() + taskDuration - 1)
        }
        
        // Adicionar tarefa principal
        result.push({
          ...task,
          start_date: startDate,
          end_date: endDate,
          duration_days: taskDuration
        })
      }
    })
    
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

  // Incluir subtarefas das tarefas filtradas
  const filteredTaskIds = new Set(filteredTasksWithDates.map(t => t.id))
  const subtasksOfFiltered = tasksWithDates.filter(t => t.parent_id && filteredTaskIds.has(t.parent_id))
  const finalFilteredTasks = [...filteredTasksWithDates, ...subtasksOfFiltered]

  const organizedTasks = organizeTasksHierarchy(finalFilteredTasks)

  // Criar grid de datas
  const allDates = tasksWithDates.flatMap(t => [t.start_date, t.end_date])
  const minDate = allDates.length > 0 ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date()
  const maxDate = allDates.length > 0 ? new Date(Math.max(...allDates.map(d => d.getTime()))) : new Date()
  
  const dateGrid: Date[] = []
  const current = new Date(minDate)
  while (current <= maxDate) {
    dateGrid.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }

  // Função para calcular estilo da barra
  const getTaskBarStyle = (task: TaskWithDates) => {
    if (dateGrid.length === 0) return {}

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

    // Calcular posição left - aplicar offset temporário se estiver redimensionando pela esquerda
    let leftPx = startIndex * 50 // 50px por dia
    if (tempStartOffsets.has(task.id)) {
      const offsetDays = tempStartOffsets.get(task.id)!
      leftPx += offsetDays * 50
    }

    // Calcular largura: do início do dia de início até o FIM do dia de término
    // Se endIndex foi encontrado, usar ele; senão, calcular baseado na duração
    let widthPx: number
    if (endIndex !== -1) {
      // Usar duração temporária se estiver redimensionando
      if (tempDurations.has(task.id)) {
        widthPx = tempDurations.get(task.id)! * 50
      } else {
        // Do início do startIndex até o FIM do endIndex (endIndex + 1)
        widthPx = (endIndex - startIndex + 1) * 50
      }
    } else {
      // Fallback: usar duration_days
      const displayDuration = tempDurations.has(task.id)
        ? tempDurations.get(task.id)!
        : task.duration_days
      widthPx = displayDuration * 50
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
  const getTaskColor = (type: string, isSubtask: boolean, isDelayed: boolean = false) => {
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
      console.error('Erro ao excluir subtarefa:', error)
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
    console.error('Erro ao reordenar tarefas:', error)
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
          // Fórmula: newStart = endDate - Math.ceil(finalDuration) + 1
          //
          // Mas precisamos garantir consistência:
          // Se duration = 11.875 dias (11 dias + 7 horas)
          // Devemos usar 12 dias completos no cálculo visual
          const daysToSubtract = Math.ceil(finalDuration)

          const newStartDate = new Date(endDate)
          newStartDate.setDate(newStartDate.getDate() - daysToSubtract + 1)
          const formattedStartDate = newStartDate.toISOString().split('T')[0]

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

    onRefresh()
  } catch (error) {
    console.error('Erro ao atualizar duração:', error)
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

// useEffect para lidar com mousemove e mouseup globalmente
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
}, [resizingTask, tasks])
  // Renderizar tarefas recursivamente
  const renderTask = (task: TaskWithAllocations, level = 0, parentTask?: TaskWithAllocations) => {
    const isSubtask = level > 0
    const hasSubtasks = (task.subtasks?.length || 0) > 0
    const isExpanded = task.isExpanded
    const isDelayed = isSubtask ? isSubtaskDelayed(task, parentTask) : false

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
    style={{ paddingLeft: `${level * 24 + 16}px` }}
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
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-900 truncate font-medium">
                {task.name}
              </div>
              <div className="text-xs text-gray-500">
                {task.duration_days}d • {task.progress}%
                      {/* ADICIONE ESTAS LINHAS - Badges de pessoas alocadas */}
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
            {dateGrid.map((_, index) => (
              <div
                key={index}
                className="border-r border-gray-100"
                style={{ width: '50px', minWidth: '50px' }}
              />
            ))}
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
            className={`absolute top-1/2 transform -translate-y-1/2 h-8 rounded shadow-sm ${getTaskColor(task.type, isSubtask, isDelayed)} ${
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

    // Se tem subtarefas e está expandido, renderizar subtarefas
    if (hasSubtasks && isExpanded) {
      return (
        <div key={task.id}>
          {taskElement}
          {task.subtasks?.map(subtask => renderTask(subtask, level + 1, task))}
        </div>
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
            <button
              onClick={onRefresh}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              🔄 Atualizar
            </button>
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
            </div>
          </div>
        </div>

        {/* Área de scroll horizontal */}
        <div
          className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] transition-all duration-300"
          style={{ paddingBottom: selectedTask ? '200px' : '0' }}
        >
          <div className="min-w-max">
            {/* Cabeçalho de datas */}
<div className="flex border-b bg-gray-50 sticky top-0 z-20">
              <div className="w-80 px-4 py-2 border-r font-medium text-gray-700">
                Tarefa
              </div>
              <div className="flex">
                {dateGrid.map((date, index) => (
                  <div
                    key={index}
                    className="border-r px-2 py-2 text-center"
                    style={{ width: '50px', minWidth: '50px' }}
                  >
                    <div className="text-xs font-medium text-gray-700">
                      {date.getDate()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {date.toLocaleDateString('pt-BR', { month: 'short' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Linhas de tarefas */}
            {organizedTasks.map((task) => renderTask(task, 0))}
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
                    console.error('Erro ao salvar custos:', error)
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
    </>
  )
}