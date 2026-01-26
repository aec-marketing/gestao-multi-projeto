'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Project, Task, Resource } from '@/types/database.types'
import { Allocation } from '@/types/allocation.types'
import AllocationModal from './AllocationModal'
import { parseLocalDate, formatDateBR } from '@/utils/date.utils'
import SubtaskManager from './SubtaskManager'

interface GanttViewProps {
  projectId: string
  onClose: () => void
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

export default function GanttView({ projectId, onClose }: GanttViewProps) {
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<string | null>(null)
  const [draggedTask, setDraggedTask] = useState<string | null>(null)
  const [dragOverTask, setDragOverTask] = useState<string | null>(null)
  const [allocationModalTask, setAllocationModalTask] = useState<Task | null>(null)
  const [subtaskModalTask, setSubtaskModalTask] = useState<Task | null>(null)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
const [editingCostsTask, setEditingCostsTask] = useState<Task | null>(null)

  useEffect(() => {
    loadProjectData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  async function loadProjectData() {
    try {
      const { data: projectData } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true })

      const { data: resourcesData } = await supabase
        .from('resources')
        .select('*')
        .eq('is_active', true)

      const { data: allocationsData } = await supabase
        .from('allocations')
        .select(`
          *,
          resource:resources(*)
        `)
        .in('task_id', (tasksData || []).map(t => t.id))

      setProject(projectData)
      setTasks(tasksData || [])
      setResources(resourcesData || [])
      setAllocations(allocationsData || [])
    } catch (error) {
      // Erro ao carregar dados do projeto
    } finally {
      setIsLoading(false)
    }
  }

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

            processedSubtasks.push({
              ...subtask,
              start_date: subStart,
              end_date: subEnd,
              duration_days: Math.ceil(subtask.duration)
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

        // Se há subtarefas com datas, ajustar início/fim da tarefa pai para cobrir todas (incluindo gaps)
        if (processedSubtasks.length > 0) {
          const earliestSubtaskStart = processedSubtasks.reduce((earliest, sub) => {
            return sub.start_date < earliest ? sub.start_date : earliest
          }, processedSubtasks[0].start_date)

          const latestSubtaskEnd = processedSubtasks.reduce((latest, sub) => {
            return sub.end_date > latest ? sub.end_date : latest
          }, processedSubtasks[0].end_date)

          // Usar o intervalo das subtarefas se for maior que o da tarefa pai
          taskStartDate = earliestSubtaskStart < taskStartDate ? earliestSubtaskStart : taskStartDate
          taskEndDate = latestSubtaskEnd > taskEndDate ? latestSubtaskEnd : taskEndDate
        }

        // Calcular duração real incluindo gaps (do primeiro ao último dia)
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
          let subtaskCurrentDate = new Date(startDate)

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

          // Calcular intervalo real da tarefa pai baseado nas subtarefas
          const firstSubtaskStart = processedSubtasks[0].start_date
          const lastSubtaskEnd = processedSubtasks[processedSubtasks.length - 1].end_date

          // Duração = diferença entre primeiro início e último fim (incluindo gaps se houver)
          taskDuration = Math.floor((lastSubtaskEnd.getTime() - firstSubtaskStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
          endDate = lastSubtaskEnd

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

      const taskWithAllocations: TaskWithAllocations = {
        ...task,
        allocations: taskAllocations,
        subtasks: [],
        isExpanded: expandedTasks.has(task.id)
      }

      taskMap.set(task.id, taskWithAllocations)
    })

    // Depois, organizar a hierarquia
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

  // Achatar hierarquia para exibição (respeitando expand/collapse)
  function flattenTasksForDisplay(hierarchicalTasks: TaskWithAllocations[]): TaskWithAllocations[] {
    const result: TaskWithAllocations[] = []

    function addTask(task: TaskWithAllocations, level: number = 0) {
      result.push({ ...task, level } as any)

      if (task.isExpanded && task.subtasks && task.subtasks.length > 0) {
        task.subtasks.forEach(subtask => addTask(subtask, level + 1))
      }
    }

    hierarchicalTasks.forEach(task => addTask(task))
    return result
  }

  // Converter TaskWithAllocations de volta para Task (para modais)
  function convertToTask(taskWithAllocations: TaskWithAllocations): Task {
    return {
      ...tasks.find(t => t.id === taskWithAllocations.id)!
    }
  }

  const tasksWithDates = calculateTaskDates()
  const hierarchicalTasks = organizeTasksHierarchy(tasksWithDates)
  const displayTasks = flattenTasksForDisplay(hierarchicalTasks)

  function generateDateGrid() {
    if (!project?.start_date) return { dates: [], totalProjectDays: 0, totalDaysWithMargin: 0 }

    const projectStart = parseLocalDate(project.start_date)!
    if (!projectStart) return { dates: [], totalProjectDays: 0, totalDaysWithMargin: 0 }
    
    // Usar tasksWithDates já calculado
    if (tasksWithDates.length === 0) return { dates: [], totalProjectDays: 0, totalDaysWithMargin: 0 }
    
    const latestEndDate = tasksWithDates.reduce((latest, task) => {
      const taskEnd = new Date(task.end_date)
      return taskEnd > latest ? taskEnd : latest
    }, projectStart)
    
    // Calcular total de dias do projeto (SEM margem - para cálculos)
    const totalProjectDays = Math.ceil((latestEndDate.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
    
    // Adicionar margem de 10% APENAS para visualização (mais células no grid)
    const totalDaysWithMargin = Math.ceil(totalProjectDays * 1.1)
    
    const dates = []
    for (let i = 0; i < totalDaysWithMargin; i++) {
      const date = new Date(projectStart)
      date.setDate(date.getDate() + i)
      dates.push(date)
    }
    
    // Retornar objeto com ambos os valores
    return {
      dates,
      totalProjectDays,  // Dias reais para cálculo de barras
      totalDaysWithMargin  // Dias com margem para grid visual
    }
  }

  const dateGridData = generateDateGrid()
  const dateGrid = dateGridData.dates || []
  const totalProjectDays = dateGridData.totalProjectDays || dateGrid.length
  
  // Definir largura fixa de cada dia em pixels
  const pixelsPerDay = 50  // Cada dia = 50px

  function getTaskBarStyle(task: TaskWithDates) {
    if (!project?.start_date || dateGrid.length === 0) return { width: '0px', left: '0px' }

    const projectStart = parseLocalDate(project.start_date)!
    if (!projectStart) return { width: '0px', left: '0px' }

    const taskStart = new Date(task.start_date)
    const taskEnd = new Date(task.end_date)
    const daysSinceStart = Math.floor((taskStart.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24))
    const duration = task.duration_days
    
    // Calcular em pixels absolutos
    const leftPixels = daysSinceStart * pixelsPerDay
    const widthPixels = Math.max(duration * pixelsPerDay, 40)  // Mínimo 40px

    return {
      left: `${leftPixels}px`,
      width: `${widthPixels}px`
    }
  }

  function getTaskColor(taskType: string, isSubtask: boolean = false) {
    if (isSubtask) {
      return 'bg-gray-400'
    }
    
    const colors = {
      'projeto_mecanico': 'bg-yellow-500',
      'projeto_eletrico': 'bg-yellow-500',
      'compras_mecanica': 'bg-green-500',
      'compras_eletrica': 'bg-green-600',
      'fabricacao': 'bg-purple-500',
      'montagem_mecanica': 'bg-indigo-500',
      'montagem_eletrica': 'bg-orange-500',
      'coleta': 'bg-red-500',
      'tratamento_superficial': 'bg-pink-500',
      'subtarefa': 'bg-gray-500'
    }
    return colors[taskType as keyof typeof colors] || 'bg-gray-400'
  }

  function toggleTaskExpansion(taskId: string) {
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

  async function updateTaskProgress(taskId: string, progress: number) {
    try {
      await supabase
        .from('tasks')
        .update({ progress })
        .eq('id', taskId)

      loadProjectData()
    } catch (error) {
      // Erro ao atualizar progresso
    }
  }

  async function deleteSubtask(subtaskId: string) {
    if (!confirm('Deseja excluir esta subtarefa?')) return

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', subtaskId)

      if (error) throw error

      loadProjectData()
    } catch (error) {
      alert('Erro ao excluir subtarefa')
    }
  }

  // Calcular progresso automático baseado nas subtarefas
  function getTaskProgressWithSubtasks(task: TaskWithAllocations): number {
    if (!task.subtasks || task.subtasks.length === 0) {
      return task.progress || 0
    }

    const avgProgress = task.subtasks.reduce((sum, sub) => sum + (sub.progress || 0), 0) / task.subtasks.length
    return Math.round(avgProgress)
  }

  function handleDragStart(e: React.DragEvent, taskId: string) {
    setDraggedTask(taskId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent, taskId: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverTask(taskId)
  }

  function handleDragLeave() {
    setDragOverTask(null)
  }

  async function handleDrop(e: React.DragEvent, targetTaskId: string) {
    e.preventDefault()
    
    if (!draggedTask || draggedTask === targetTaskId) {
      setDraggedTask(null)
      setDragOverTask(null)
      return
    }

    try {
      const draggedIndex = tasks.findIndex(t => t.id === draggedTask)
      const targetIndex = tasks.findIndex(t => t.id === targetTaskId)
      
      if (draggedIndex === -1 || targetIndex === -1) return

      const newTasks = [...tasks]
      const [draggedTaskObj] = newTasks.splice(draggedIndex, 1)
      newTasks.splice(targetIndex, 0, draggedTaskObj)

      const updates = newTasks.map((task, index) => ({
        id: task.id,
        sort_order: index + 1
      }))

      for (const update of updates) {
        await supabase
          .from('tasks')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id)
      }

      loadProjectData()
    } catch (error) {
      // Erro ao reordenar tarefas
    } finally {
      setDraggedTask(null)
      setDragOverTask(null)
    }
  }

  function handleDragEnd() {
    setDraggedTask(null)
    setDragOverTask(null)
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <p className="text-gray-600">Carregando projeto...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              📊 Gantt - {project?.name}
            </h2>
            <p className="text-gray-600">
              {project?.code} • {displayTasks.length} tarefas • Arraste para reordenar
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Gantt Chart */}
        <div className="flex-1 overflow-auto">
          <div className="min-w-[1200px]">
            {/* Header com datas */}
            <div className="grid grid-cols-[450px_1fr] border-b bg-gray-50 sticky top-0 z-10">
              <div className="p-3 border-r font-medium text-gray-700">
                <div className="flex items-center space-x-2">
                  <span>Tarefas</span>
                  <span className="text-xs text-gray-500">🔄 Arraste para reordenar</span>
                </div>
              </div>
              <div className="relative">
                <div className="flex">
                  {dateGrid.map((date, index) => (
                    <div
                      key={index}
                      className="p-2 border-r text-xs text-center text-gray-600"
                      style={{ width: '50px', minWidth: '50px', maxWidth: '50px' }}
                    >
                      <div>{date.getDate()}</div>
                      <div className="text-gray-400">
                        {date.toLocaleDateString('pt-BR', { month: 'short' })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Linhas de tarefas */}
            <div className="divide-y">
              {displayTasks.map((task: any) => {
                const level = task.level || 0
                const hasSubtasks = task.subtasks && task.subtasks.length > 0
                const actualProgress = getTaskProgressWithSubtasks(task)
                const isSubtask = !!task.parent_id

                return (
                  <div
                    key={task.id}
                    draggable={!isSubtask}
                    onDragStart={(e) => !isSubtask && handleDragStart(e, task.id)}
                    onDragOver={(e) => handleDragOver(e, task.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, task.id)}
                    onDragEnd={handleDragEnd}
                    className={`grid grid-cols-[450px_1fr] transition-colors ${
                      isSubtask ? 'bg-gray-50' : 'cursor-move'
                    } ${
                      selectedTask === task.id ? 'bg-blue-50' : 
                      dragOverTask === task.id ? 'bg-yellow-50' :
                      draggedTask === task.id ? 'bg-gray-100 opacity-50' : 
                      'hover:bg-gray-50'
                    }`}
                  >
                    {/* Coluna da tarefa */}
                    <div className="p-3 border-r">
                      <div className="flex items-start space-x-2">
                        {/* Indentação baseada no nível */}
                        <div style={{ width: `${level * 20}px` }} />
                        
                        {/* Botão de expandir/colapsar */}
                        {hasSubtasks && (
                          <button
                            onClick={() => toggleTaskExpansion(task.id)}
                            className="text-gray-600 hover:text-gray-900 transition-colors"
                          >
                            {task.isExpanded ? '▼' : '▶'}
                          </button>
                        )}
                        
                        {!hasSubtasks && !isSubtask && <span className="text-gray-400 text-sm">⋮⋮</span>}
                        {isSubtask && <span className="text-gray-400 text-xs">└</span>}

                        <div className="flex-1 min-w-0">
                          <div 
                            className={`font-medium text-gray-900 text-sm cursor-pointer hover:text-blue-600 ${
                              isSubtask ? 'text-gray-700' : ''
                            }`}
                            onClick={() => setSelectedTask(selectedTask === task.id ? null : task.id)}
                          >
                            {task.name}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {task.duration_days}d • {actualProgress}% completo
                            {hasSubtasks && ` • ${task.subtasks.length} subtarefa(s)`}
                          </div>

                          {/* Pessoas Alocadas */}
                          {task.allocations.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {task.allocations.map((allocation: any) => (
                                <div
                                  key={allocation.id}
                                  className="inline-flex items-center space-x-1 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700"
                                >
                                  <span>👤</span>
                                  <span>{allocation.resource.name}</span>
                                  {allocation.priority === 'alta' && <span className="text-red-500">🔥</span>}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Ações */}
                          <div className="mt-2 flex space-x-2">
                            <button
                              onClick={() => setAllocationModalTask(convertToTask(task))}
                              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            >
                              + Pessoa
                            </button>

                            {!isSubtask && (
                              <button
                                onClick={() => setSubtaskModalTask(convertToTask(task))}
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
                                🗑️ Excluir
                              </button>
                            )}
                          </div>

                          {/* Barra de progresso */}
                          <div className="flex items-center mt-3">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full transition-all"
                                style={{ width: `${actualProgress}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 ml-2">
                              {actualProgress}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Coluna do cronograma */}
                    <div className="relative h-36 border-r">
                      {/* Grid de datas de fundo */}
                      <div className="absolute inset-0 flex">
                        {dateGrid.map((_, index) => (
                          <div
                            key={index}
                            className="border-r border-gray-100"
                            style={{ width: '50px', minWidth: '50px', maxWidth: '50px' }}
                          />
                        ))}
                      </div>

                      {/* Linha de conexão (gap visual) */}
                      {(() => {
                        const barStyle = getTaskBarStyle(task)
                        const leftPx = parseInt(barStyle.left) || 0

                        // Só mostrar se a barra não começa no início
                        if (leftPx > 0) {
                          return (
                            <div
                              className="absolute top-1/2 transform -translate-y-1/2 h-[2px]"
                              style={{
                                left: '0px',
                                width: `${leftPx}px`,
                                backgroundColor: isSubtask
                                  ? 'rgba(156, 163, 175, 0.3)'  // Cinza para subtarefas
                                  : 'rgba(239, 68, 68, 0.4)'     // Vermelho para principais
                              }}
                            />
                          )
                        }
                        return null
                      })()}

                      {/* Barra da tarefa */}
                      <div
                        className={`absolute top-1/2 transform -translate-y-1/2 h-8 rounded shadow-sm ${getTaskColor(task.type, isSubtask)} ${
                          isSubtask ? 'opacity-70' : 'opacity-90'
                        } hover:opacity-100 cursor-pointer flex items-center justify-center transition-all`}
                        style={{
                          ...getTaskBarStyle(task),
                          minWidth: '40px' // Garante que barras de 1 dia sejam visíveis
                        }}
                        onClick={() => setSelectedTask(task.id)}
                      >
                        <span className="text-white text-xs font-semibold px-2 truncate">
                          {task.duration_days}d
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Painel de detalhes */}
        {selectedTask && (
          <div className="border-t bg-gray-50 p-4">
            {(() => {
              const task = displayTasks.find((t: any) => t.id === selectedTask) as TaskWithAllocations
              if (!task) return null
              
              return (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
  <div>
    <h4 className="font-medium text-gray-900">{task.name}</h4>
    <p className="text-sm text-gray-600">
      Duração: {task.duration} dias
    </p>
    <p className="text-sm text-gray-600">
      Tipo: {task.type.replace(/_/g, ' ')}
    </p>
    {task.subtasks && task.subtasks.length > 0 && (
      <p className="text-sm text-gray-600">
        Subtarefas: {task.subtasks.length}
      </p>
    )}
  </div>
                  
                  <div>
                    <p className="text-sm text-gray-600">
                      Início: {formatDateBR(task.start_date)}
                    </p>
                    <p className="text-sm text-gray-600">
                      Fim: {formatDateBR(task.end_date)}
                    </p>
                    <p className="text-sm text-gray-600">
                      Pessoas: {task.allocations.length}
                    </p>
                  </div>

                  {/* ADICIONE ESTA COLUNA DE CUSTOS */}
  <div>
    <p className="text-sm font-medium text-gray-700 mb-2">💰 Custos</p>
    <p className="text-sm text-gray-600">
      <span className="font-medium text-green-700">Est.:</span> R$ {(task.estimated_cost || 0).toFixed(2).replace('.', ',')}
    </p>
    <p className="text-sm text-gray-600">
      <span className="font-medium text-blue-700">Real:</span> R$ {(task.actual_cost || 0).toFixed(2).replace('.', ',')}
    </p>
    <button
      onClick={() => setEditingCostsTask(tasks.find(t => t.id === task.id)!)}
      className="mt-2 text-xs text-blue-600 hover:text-blue-700 underline"
    >
      Editar custos
    </button>
  </div>

  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Progresso Manual
    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={task.progress || 0}
                      onChange={(e) => updateTaskProgress(task.id, parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0%</span>
                      <span>{task.progress || 0}%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50">
          <div className="text-right text-xs text-gray-500">
            <p>💡 Arraste tarefas para reordenar</p>
            <p>📊 Clique em ▶ para expandir subtarefas</p>
            <p>➕ Use &quot;+ Subtarefa&quot; para decompor tarefas grandes</p>
          </div>
        </div>
      </div>

      {/* Modais */}
      {allocationModalTask && (
        <AllocationModal
          task={allocationModalTask}
          projectLeaderId={project?.leader_id || null}
          onClose={() => setAllocationModalTask(null)}
          onSuccess={() => loadProjectData()}
        />
      )}

      {subtaskModalTask && (
        <SubtaskManager
          parentTask={subtaskModalTask}
          onClose={() => setSubtaskModalTask(null)}
          onSuccess={() => {
            loadProjectData()
            setExpandedTasks(prev => new Set(prev).add(subtaskModalTask.id))
          }}
        />
      )}
      
      {/* ADICIONE ESTE MODAL DE CUSTOS */}
      {editingCostsTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
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
                    id="modal-estimated-cost-input"
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
                    id="modal-actual-cost-input"
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
                  const estimatedInput = document.getElementById('modal-estimated-cost-input') as HTMLInputElement
                  const actualInput = document.getElementById('modal-actual-cost-input') as HTMLInputElement
                  
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
                    loadProjectData()
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
    </div>
  )
}