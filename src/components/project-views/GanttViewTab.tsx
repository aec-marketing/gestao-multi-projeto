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
  [draggable="true"] {
    cursor: move;
  }
  
  [draggable="true"]:active {
    cursor: grabbing;
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
  const organizedTasks = organizeTasksHierarchy(tasksWithDates)

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
    const daysSinceStart = dateGrid.findIndex(date => 
      date.toDateString() === taskStart.toDateString()
    )

    const leftPx = daysSinceStart * 50 // 50px por dia
    const widthPx = task.duration_days * 50

    return {
      left: `${leftPx}px`,
      width: `${widthPx}px`
    }
  }

  // Cores das tarefas
  const getTaskColor = (type: string, isSubtask: boolean) => {
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
  // Renderizar tarefas recursivamente
  const renderTask = (task: TaskWithAllocations, level = 0) => {
    const isSubtask = level > 0
    const hasSubtasks = (task.subtasks?.length || 0) > 0
    const isExpanded = task.isExpanded

    const taskElement = (
      <div 
  key={task.id} 
  className={`flex border-b hover:bg-gray-50 transition-colors ${
    draggedTask === task.id ? 'opacity-50' : ''
  } ${dragOverTask === task.id ? 'border-blue-500 border-2' : ''}`}
  draggable={!isSubtask} // Só tarefas principais podem ser arrastadas
  onDragStart={(e) => {
    if (!isSubtask) {
      setDraggedTask(task.id)
      e.dataTransfer.effectAllowed = 'move'
    }
  }}
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
  onDragEnd={() => {
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
            className={`absolute top-1/2 transform -translate-y-1/2 h-8 rounded shadow-sm ${getTaskColor(task.type, isSubtask)} ${
              isSubtask ? 'opacity-70' : 'opacity-90'
            } ${selectedTask === task.id ? 'ring-2 ring-blue-500' : ''} hover:opacity-100 cursor-pointer flex items-center justify-center transition-all`}
            style={{
              ...getTaskBarStyle(task),
              minWidth: '40px'
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

    // Se tem subtarefas e está expandido, renderizar subtarefas
    if (hasSubtasks && isExpanded) {
      return (
        <div key={task.id}>
          {taskElement}
          {task.subtasks?.map(subtask => renderTask(subtask, level + 1))}
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