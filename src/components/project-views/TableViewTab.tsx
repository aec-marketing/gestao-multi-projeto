'use client'
import React from 'react'

import { useState, useEffect } from 'react'
import { Project, Task, Resource } from '@/types/database.types'
import { Allocation } from '@/types/allocation.types'
import { supabase } from '@/lib/supabase'
import { recalculateTasksInCascade, validateTaskStartDate } from '@/utils/predecessorCalculations'
import RecalculateModal from '@/components/modals/RecalculateModal'

// Função para obter cores das tarefas (igual ao Gantt)
function getTaskColors(type: string, isSubtask: boolean) {
  const colors: Record<string, { main: string; pastel: string }> = {
    'projeto_mecanico': { 
      main: 'bg-blue-500 text-white', 
      pastel: 'bg-blue-100 text-blue-800' 
    },
    'compras_mecanica': { 
      main: 'bg-purple-500 text-white', 
      pastel: 'bg-purple-100 text-purple-800' 
    },
    'projeto_eletrico': { 
      main: 'bg-yellow-500 text-white', 
      pastel: 'bg-yellow-100 text-yellow-800' 
    },
    'compras_eletrica': { 
      main: 'bg-orange-500 text-white', 
      pastel: 'bg-orange-100 text-orange-800' 
    },
    'fabricacao': { 
      main: 'bg-green-500 text-white', 
      pastel: 'bg-green-100 text-green-800' 
    },
    'tratamento_superficial': { 
      main: 'bg-pink-500 text-white', 
      pastel: 'bg-pink-100 text-pink-800' 
    },
    'montagem_mecanica': { 
      main: 'bg-indigo-500 text-white', 
      pastel: 'bg-indigo-100 text-indigo-800' 
    },
    'montagem_eletrica': { 
      main: 'bg-red-500 text-white', 
      pastel: 'bg-red-100 text-red-800' 
    },
    'coleta': { 
      main: 'bg-teal-500 text-white', 
      pastel: 'bg-teal-100 text-teal-800' 
    }
  }
  
  const taskColors = colors[type] || { 
    main: 'bg-gray-500 text-white', 
    pastel: 'bg-gray-100 text-gray-800' 
  }
  
  return isSubtask ? taskColors.pastel : taskColors.main
}

interface TableViewTabProps {
  project: Project
  tasks: Task[]
  resources: Resource[]
  allocations: Allocation[]
  onRefresh: () => void
}

export default function TableViewTab({
  project,
  tasks,
  resources,
  allocations,
  onRefresh
}: TableViewTabProps) {
  const [editingCell, setEditingCell] = useState<{
    taskId: string
    field: string
  } | null>(null)

  // States for predecessor recalculation
  const [predecessors, setPredecessors] = useState<any[]>([])
  const [showRecalculateModal, setShowRecalculateModal] = useState(false)
  const [pendingUpdates, setPendingUpdates] = useState<any[]>([])

  // ADICIONE ESTES STATES:
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [newTaskData, setNewTaskData] = useState({
    name: '',
    type: 'projeto_mecanico',
    duration: 1
  })
  // ADICIONE ESTES STATES:
  const [addingSubtaskToTask, setAddingSubtaskToTask] = useState<string | null>(null)
  const [newSubtaskData, setNewSubtaskData] = useState({
    name: '',
    duration: 1
  })

  // ADICIONE ESTES STATES:
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'duration' | 'progress'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Load predecessors
  useEffect(() => {
    async function loadPredecessors() {
      // Get all task IDs for this project
      const taskIds = tasks.map(t => t.id)

      if (taskIds.length === 0) {
        setPredecessors([])
        return
      }

      // Fetch predecessors for these tasks
      const { data, error } = await supabase
        .from('predecessors')
        .select('*')
        .in('task_id', taskIds)

      if (error) {
        // Error loading predecessors
      } else {
        setPredecessors(data || [])
      }
    }
    loadPredecessors()
  }, [tasks])

  // Função para ordenar tarefas
  function sortTasks(tasksToSort: Task[]) {
    return [...tasksToSort].sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'type':
          comparison = a.type.localeCompare(b.type)
          break
        case 'duration':
          comparison = (a.duration || 0) - (b.duration || 0)
          break
        case 'progress':
          comparison = (a.progress || 0) - (b.progress || 0)
          break
      }
      
      return sortOrder === 'asc' ? comparison : -comparison
    })
  }

  // Função para filtrar tarefas
  function filterTasks(tasksToFilter: Task[]) {
    if (!searchTerm.trim()) return tasksToFilter
    
    const term = searchTerm.toLowerCase()
    return tasksToFilter.filter(task => 
      (task.name || '').toLowerCase().includes(term) ||
      (task.type || '').toLowerCase().includes(term) ||
      (task.wbs_code || '').toLowerCase().includes(term)
    )
  }

  // Aplicar filtro e ordenação
  const sortedMainTasks = sortTasks(
    filterTasks(tasks.filter(t => !t.parent_id))
  )

  // ========== NOVO: suportar progress e atualizações por campo ==========
  async function updateTask(taskId: string, field: string, value: string | number) {
    try {
      const { syncTaskFields } = await import('@/utils/taskDateSync')

      const updates: any = {}

      // Determinar qual campo atualizar
      if (field === 'name') {
        updates.name = value
      } else if (field === 'estimated_cost') {
        updates.estimated_cost = value ? parseFloat(value as string) : 0
      } else if (field === 'actual_cost') {
        updates.actual_cost = value ? parseFloat(value as string) : 0
      } else if (field === 'progress') {
        updates.progress = typeof value === 'number' ? value : parseInt(value as string || '0')
      } else if (field === 'duration' || field === 'start_date' || field === 'end_date') {
        // ========== NOVO: Sincronizar datas e duração ==========
        const currentTask = tasks.find(t => t.id === taskId)
        if (!currentTask) throw new Error('Tarefa não encontrada')

        // Sincronizar campos relacionados
        const syncedFields = syncTaskFields(
          field as 'start_date' | 'end_date' | 'duration',
          field === 'duration' ? parseFloat(value as string) : value,
          {
            start_date: currentTask.start_date,
            end_date: currentTask.end_date,
            duration: currentTask.duration
          }
        )

        // ========== VALIDAÇÃO DE PREDECESSOR ==========
        if (field === 'start_date' || field === 'end_date') {
          // Validar se a nova data conflita com predecessores
          const newStartDate = field === 'start_date'
            ? new Date(value as string)
            : new Date(syncedFields.start_date || currentTask.start_date!)

          const validation = validateTaskStartDate(
            currentTask,
            newStartDate,
            tasks,
            predecessors
          )

          if (!validation.isValid) {
            alert(`❌ Data inválida!\n\n${validation.message}\n\nA mudança foi cancelada para manter a consistência do projeto.`)
            return // Não salva a mudança
          }
        }
        // ========== FIM VALIDAÇÃO ==========
  
        // Adicionar todos os campos sincronizados ao update
        Object.assign(updates, syncedFields)
        // ========== FIM NOVO ==========
      }

      // Se não houver nada pra atualizar (por exemplo valor inválido), não faz nada
      if (Object.keys(updates).length === 0) return

      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)

      if (error) throw error

      console.log('💾 Atualização salva no banco:', updates)

      // Check if we need to recalculate dependent tasks (for date/duration changes)
      if (field === 'duration' || field === 'start_date' || field === 'end_date') {
        const cascadeUpdates = recalculateTasksInCascade(taskId, tasks, predecessors)

        if (cascadeUpdates.length > 0) {
          console.log('🔄 Dependências detectadas, abrindo modal de recalculo:', cascadeUpdates)
          setPendingUpdates(cascadeUpdates)
          setShowRecalculateModal(true)
          return // Don't refresh yet, wait for modal
        }
      }

      // ========== AJUSTE DE DURAÇÃO DA TAREFA PAI ==========
      // Se editou duração de uma subtarefa, verificar se tarefa pai precisa se ajustar
      const updatedTask = tasks.find(t => t.id === taskId)
      if (updatedTask?.parent_id && (field === 'duration' || field === 'start_date' || field === 'end_date')) {
        const parentTask = tasks.find(t => t.id === updatedTask.parent_id)
        if (parentTask) {
          const siblings = tasks.filter(t => t.parent_id === parentTask.id)
          const maxSubtaskDuration = Math.max(
            ...siblings.map(s => s.id === taskId ? (field === 'duration' ? parseFloat(value as string) : s.duration || 0) : s.duration || 0)
          )

          if (maxSubtaskDuration > (parentTask.duration || 0)) {
            // Atualizar duração da tarefa pai
            if (parentTask.start_date) {
              const newParentEndDate = new Date(parentTask.start_date)
              newParentEndDate.setDate(newParentEndDate.getDate() + maxSubtaskDuration - 1)

<<<<<<< HEAD
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
=======
    if (error) throw error

    // Check if we need to recalculate dependent tasks (for date/duration changes)
    if (field === 'duration' || field === 'start_date' || field === 'end_date') {
      const cascadeUpdates = recalculateTasksInCascade(taskId, tasks, predecessors)

      if (cascadeUpdates.length > 0) {
        setPendingUpdates(cascadeUpdates)
        setShowRecalculateModal(true)
        return // Don't refresh yet, wait for modal
      }
    }

    // ========== AJUSTE DE DURAÇÃO DA TAREFA PAI ==========
    // Se editou duração de uma subtarefa, verificar se tarefa pai precisa se ajustar
    const updatedTask = tasks.find(t => t.id === taskId)
    if (updatedTask?.parent_id && field === 'duration') {
      const parentTask = tasks.find(t => t.id === updatedTask.parent_id)
      if (parentTask) {
        const siblings = tasks.filter(t => t.parent_id === parentTask.id)
        const maxSubtaskDuration = Math.max(
          ...siblings.map(s => s.id === taskId ? parseFloat(value as string) : s.duration || 0)
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
>>>>>>> 5199bc6aab472bbed79021a2a1ad524ab1316416
          }
        }
      }
      // ========== FIM AJUSTE ==========

      // Atualizar lista
      onRefresh()
    } catch (error) {
      console.error('Erro ao salvar tarefa:', error)
      alert('Erro ao salvar alterações')
    }
<<<<<<< HEAD
=======
    // ========== FIM AJUSTE ==========

    // Atualizar lista
    onRefresh()
  } catch (error) {
    alert('Erro ao salvar alterações')
  }
}
async function createNewTask() {
  if (!newTaskData.name.trim()) {
    alert('Nome da tarefa é obrigatório')
    return
>>>>>>> 5199bc6aab472bbed79021a2a1ad524ab1316416
  }

  // Adapter para o novo componente recursivo que espera onUpdate(taskId, Partial<Task>)
  async function handleUpdate(taskId: string, updates: Partial<Task>) {
    // Chamamos updateTask para cada campo. Pode ser otimizado agrupando em uma única chamada.
    for (const key of Object.keys(updates)) {
      const value: any = (updates as any)[key]
      await updateTask(taskId, key, value)
    }
  }

  async function createNewTask() {
    if (!newTaskData.name.trim()) {
      alert('Nome da tarefa é obrigatório')
      return
    }

    try {
      // Pegar o maior sort_order atual
      const maxSortOrder = Math.max(...tasks.map(t => t.sort_order || 0), 0)

      const { error } = await supabase
        .from('tasks')
        .insert({
          project_id: project.id,
          name: newTaskData.name,
          type: newTaskData.type,
          duration: newTaskData.duration,
          progress: 0,
          sort_order: maxSortOrder + 1,
          parent_id: null
        })

      if (error) throw error

      // Resetar form
      setNewTaskData({ name: '', type: 'projeto_mecanico', duration: 1 })
      setIsAddingTask(false)
      onRefresh()
    } catch (error) {
      console.error('Erro ao criar tarefa:', error)
      alert('Erro ao criar tarefa')
    }
  }

  function cancelNewTask() {
    setNewTaskData({ name: '', type: 'projeto_mecanico', duration: 1 })
    setIsAddingTask(false)
<<<<<<< HEAD
=======
    onRefresh()
  } catch (error) {
    alert('Erro ao criar tarefa')
  }
}

function cancelNewTask() {
  setNewTaskData({ name: '', type: 'projeto_mecanico', duration: 1 })
  setIsAddingTask(false)
}
async function createNewSubtask(parentTaskId: string, parentType: string) {
  if (!newSubtaskData.name.trim()) {
    alert('Nome da subtarefa é obrigatório')
    return
>>>>>>> 5199bc6aab472bbed79021a2a1ad524ab1316416
  }

  async function createNewSubtask(parentTaskId: string, parentType: string) {
    if (!newSubtaskData.name.trim()) {
      alert('Nome da subtarefa é obrigatório')
      return
    }

    try {
      // Encontrar tarefa pai para herdar datas
      const parentTask = tasks.find(t => t.id === parentTaskId)
      if (!parentTask) throw new Error('Tarefa pai não encontrada')

      // Pegar o maior sort_order das subtarefas deste pai
      const siblings = tasks.filter(t => t.parent_id === parentTaskId)
      const maxSortOrder = Math.max(...siblings.map(t => t.sort_order || 0), 0)

      // Calcular end_date baseado na duração e start_date do pai
      let subtaskEndDate = null
      if (parentTask.start_date) {
        const startDate = new Date(parentTask.start_date)
        const endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + newSubtaskData.duration - 1)
        subtaskEndDate = endDate.toISOString().split('T')[0]
      }

      const { error: insertError } = await supabase
        .from('tasks')
        .insert({
          project_id: project.id,
          parent_id: parentTaskId,
          name: newSubtaskData.name,
          type: 'subtarefa',
          duration: newSubtaskData.duration,
          start_date: parentTask.start_date, // Herda start_date do pai
          end_date: subtaskEndDate, // Calcula end_date baseado na duração
          progress: 0,
          sort_order: maxSortOrder + 1
        })

      if (insertError) throw insertError

      // Verificar se a duração da subtarefa é maior que a do pai
      const allSubtasks = [...siblings, { duration: newSubtaskData.duration }]
      const maxSubtaskDuration = Math.max(...allSubtasks.map(s => s.duration || 0))

      if (maxSubtaskDuration > (parentTask.duration || 0)) {
        // Atualizar duração e end_date da tarefa pai
        if (parentTask.start_date) {
          const newParentEndDate = new Date(parentTask.start_date)
          newParentEndDate.setDate(newParentEndDate.getDate() + maxSubtaskDuration - 1)

          await supabase
            .from('tasks')
            .update({
              duration: maxSubtaskDuration,
              end_date: newParentEndDate.toISOString().split('T')[0]
            })
            .eq('id', parentTaskId)
        } else {
          // Tarefa pai sem data, só atualiza duração
          await supabase
            .from('tasks')
            .update({ duration: maxSubtaskDuration })
            .eq('id', parentTaskId)
        }
      }

      // Resetar form
      setNewSubtaskData({ name: '', duration: 1 })
      setAddingSubtaskToTask(null)
      onRefresh()
    } catch (error) {
      console.error('Erro ao criar subtarefa:', error)
      alert('Erro ao criar subtarefa')
    }
  }

  function cancelNewSubtask() {
    setNewSubtaskData({ name: '', duration: 1 })
    setAddingSubtaskToTask(null)
<<<<<<< HEAD
=======
    onRefresh()
  } catch (error) {
    alert('Erro ao criar subtarefa')
  }
}

function cancelNewSubtask() {
  setNewSubtaskData({ name: '', duration: 1 })
  setAddingSubtaskToTask(null)
}
async function deleteTask(taskId: string, taskName: string, hasSubtasks: boolean) {
  // Verificar se tem subtarefas
  if (hasSubtasks) {
    const confirmMsg = `A tarefa "${taskName}" possui subtarefas. Deseja excluir a tarefa e todas as suas subtarefas?`
    if (!confirm(confirmMsg)) return
  } else {
    if (!confirm(`Tem certeza que deseja excluir a tarefa "${taskName}"?`)) return
>>>>>>> 5199bc6aab472bbed79021a2a1ad524ab1316416
  }

  async function deleteTask(taskId: string, taskName: string, hasSubtasks: boolean) {
    // Verificar se tem subtarefas
    if (hasSubtasks) {
      const confirmMsg = `A tarefa "${taskName}" possui subtarefas. Deseja excluir a tarefa e todas as suas subtarefas?`
      if (!confirm(confirmMsg)) return
    } else {
      if (!confirm(`Tem certeza que deseja excluir a tarefa "${taskName}"?`)) return
    }

<<<<<<< HEAD
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)

      if (error) throw error
      
      onRefresh()
    } catch (error) {
      console.error('Erro ao excluir tarefa:', error)
      alert('Erro ao excluir tarefa')
    }
=======
    if (error) throw error

    onRefresh()
  } catch (error) {
    alert('Erro ao excluir tarefa')
>>>>>>> 5199bc6aab472bbed79021a2a1ad524ab1316416
  }

  async function deleteSubtask(subtaskId: string, subtaskName: string) {
    if (!confirm(`Tem certeza que deseja excluir a subtarefa "${subtaskName}"?`)) return

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', subtaskId)

<<<<<<< HEAD
      if (error) throw error
      
      onRefresh()
    } catch (error) {
      console.error('Erro ao excluir subtarefa:', error)
      alert('Erro ao excluir subtarefa')
    }
=======
    if (error) throw error

    onRefresh()
  } catch (error) {
    alert('Erro ao excluir subtarefa')
>>>>>>> 5199bc6aab472bbed79021a2a1ad524ab1316416
  }

  // Create task names map for modal
  const taskNamesMap = new Map(tasks.map(t => [t.id, t.name]))

  // ---------------------------
  // HELPERS VISUAIS / FORMATADORES
  // ---------------------------
  // Formatar tipo de tarefa para exibição
  function formatTaskType(type: string): string {
    return (type || '')
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // Classe de cor baseada no tipo
  function getTaskColorClass(type: string): string {
    const colors: Record<string, string> = {
      'projeto_mecanico': 'bg-blue-100 text-blue-800',
      'compras_mecanica': 'bg-purple-100 text-purple-800',
      'projeto_eletrico': 'bg-yellow-100 text-yellow-800',
      'compras_eletrica': 'bg-orange-100 text-orange-800',
      'fabricacao': 'bg-green-100 text-green-800',
      'tratamento_superficial': 'bg-pink-100 text-pink-800',
      'montagem_mecanica': 'bg-indigo-100 text-indigo-800',
      'montagem_eletrica': 'bg-red-100 text-red-800',
      'coleta': 'bg-teal-100 text-teal-800',
      'subtarefa': 'bg-gray-100 text-gray-800'
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
  }

  // ============================
  // ========== COMPONENTE RECURSIVO PARA RENDERIZAR TAREFAS ==========
  // ============================
  interface TaskRowProps {
    task: Task
    level: number
    allTasks: Task[]
    onUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>
    onDelete: (taskId: string, taskName: string, hasSubtasks: boolean) => Promise<void>
    onAddSubtask: (taskId: string) => void
  }

  const TaskRow: React.FC<TaskRowProps> = ({ 
    task, 
    level, 
    allTasks, 
    onUpdate, 
    onDelete, 
    onAddSubtask 
  }) => {
    // Buscar subtarefas DIRETAS deste task
    const subtasks = allTasks.filter(t => t.parent_id === task.id)
    const hasSubtasks = subtasks.length > 0
    
    // Calcular indentação baseado no outline_level (mais preciso) ou level
    const indentLevel = (task as any).outline_level || level
    const indent = indentLevel * 28 // 28px por nível (um pouco menor para caber melhor)
    
    // Calcular totais se tiver subtarefas (soma DIRETA)
    const totalEstimatedCost = hasSubtasks 
      ? subtasks.reduce((sum, sub) => sum + (sub.estimated_cost || 0), 0)
      : 0
    
    const totalActualCost = hasSubtasks
      ? subtasks.reduce((sum, sub) => sum + (sub.actual_cost || 0), 0)
      : 0

    return (
      <>
        {/* Linha da Tarefa Atual */}
        <tr className={`transition-colors ${hasSubtasks ? 'bg-gray-50 font-medium' : 'hover:bg-gray-50'}`}>
          {/* WBS Code */}
          <td className="px-4 py-2 text-xs text-gray-500 font-mono">
            {task.wbs_code || '-'}
          </td>
          
          {/* Nome com Indentação */}
          <td className="px-4 py-2">
            <div 
              className="flex items-center gap-2"
              style={{ paddingLeft: `${indent}px` }}
            >
              {hasSubtasks && <span className="text-gray-400">└─</span>}
              
              {editingCell?.taskId === task.id && editingCell?.field === 'name' ? (
                <input
                  type="text"
                  defaultValue={task.name}
                  className="flex-1 px-2 py-1 border rounded text-gray-900 bg-white text-sm"
                  autoFocus
                  onBlur={(e) => {
                    if (e.target.value.trim()) {
                      onUpdate(task.id, { name: e.target.value })
                    }
                    setEditingCell(null)
                  }}
                />
              ) : (
                <span 
                  className="flex-1 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded text-sm"
                  onClick={() => setEditingCell({ taskId: task.id, field: 'name' })}
                >
                  {task.name}
                </span>
              )}
            </div>
          </td>

          {/* Tipo */}
          <td className="px-4 py-2">
            <span className={`px-2 py-1 rounded text-xs ${getTaskColorClass(task.type)}`}>
              {formatTaskType(task.type)}
            </span>
          </td>

          {/* Duração */}
          <td className="px-4 py-2 text-center">
            {editingCell?.taskId === task.id && editingCell?.field === 'duration' ? (
              <input
                type="number"
                step="0.125"
                min="0.125"
                defaultValue={task.duration}
                className="w-20 px-2 py-1 border rounded text-center text-gray-900 bg-white"
                autoFocus
                onBlur={(e) => {
                  const value = parseFloat(e.target.value)
                  if (value > 0) {
                    onUpdate(task.id, { duration: value })
                  }
                  setEditingCell(null)
                }}
              />
            ) : (
              <span 
                className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded inline-block text-sm"
                onClick={() => setEditingCell({ taskId: task.id, field: 'duration' })}
              >
                {task.duration} {task.duration === 1 ? 'dia' : 'dias'}
              </span>
            )}
          </td>

          {/* Data Início */}
          <td className="px-4 py-2 text-center text-sm">
            {task.start_date ? new Date(task.start_date).toLocaleDateString('pt-BR') : '-'}
          </td>

          {/* Data Fim */}
          <td className="px-4 py-2 text-center text-sm">
            {task.end_date ? new Date(task.end_date).toLocaleDateString('pt-BR') : '-'}
          </td>

          {/* Progresso */}
          <td className="px-4 py-2">
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={task.progress || 0}
                onChange={(e) => onUpdate(task.id, { progress: parseInt(e.target.value || '0', 10) })}
                className="flex-1"
              />
              <span className="text-sm text-gray-600 w-12 text-right">
                {task.progress || 0}%
              </span>
            </div>
          </td>

          {/* Custo Estimado */}
          <td className="px-4 py-2 text-right">
            {hasSubtasks ? (
              <span className="bg-green-50 text-green-700 px-2 py-1 rounded text-sm font-semibold">
                R$ {totalEstimatedCost.toFixed(2).replace('.', ',')} (Σ)
              </span>
            ) : (
              <input
  type="number"
  step="0.01"
  min="0"
  defaultValue={task.estimated_cost}
  className="w-28 px-2 py-1 border rounded text-right text-gray-900 bg-white"
  onBlur={(e) => {
    const value = parseFloat(e.target.value) || 0
    if (value !== task.estimated_cost) {
      onUpdate(task.id, { estimated_cost: value })
    }
  }}
/>

            )}
          </td>

          {/* Custo Real */}
          <td className="px-4 py-2 text-right">
            {hasSubtasks ? (
              <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-sm font-semibold">
                R$ {totalActualCost.toFixed(2).replace('.', ',')} (Σ)
              </span>
            ) : (
              <input
  type="number"
  step="0.01"
  min="0"
  defaultValue={task.actual_cost}
  className="w-28 px-2 py-1 border rounded text-right text-gray-900 bg-white"
  onBlur={(e) => {
    const value = parseFloat(e.target.value) || 0
    if (value !== task.actual_cost) {
      onUpdate(task.id, { actual_cost: value })
    }
  }}
/>
            )}
          </td>

          {/* Ações */}
          <td className="px-4 py-2">
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => onAddSubtask(task.id)}
                className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                title="Adicionar subtarefa"
              >
                ➕
              </button>
              <button
                onClick={() => onDelete(task.id, task.name, hasSubtasks)}
                className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                title="Excluir tarefa"
              >
                🗑️
              </button>
            </div>
          </td>
        </tr>

        {/* RECURSÃO: Renderizar subtarefas */}
        {subtasks.map(subtask => (
          <TaskRow
            key={subtask.id}
            task={subtask}
            level={level + 1}
            allTasks={allTasks}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onAddSubtask={onAddSubtask}
          />
        ))}
      </>
    )
  }

  return (
    <>
      {/* Recalculate Modal */}
      <RecalculateModal
        isOpen={showRecalculateModal}
        updates={pendingUpdates}
        taskNames={taskNamesMap}
        onClose={() => {
          setShowRecalculateModal(false)
          setPendingUpdates([])
          onRefresh() // Still refresh to show the direct change made
        }}
        onApply={() => {
          setShowRecalculateModal(false)
          setPendingUpdates([])
          onRefresh()
        }}
      />

      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="p-6 border-b space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Modo Planilha</h2>
            <p className="text-sm text-gray-600">
              Clique duplo para editar • Enter para salvar • Esc para cancelar
            </p>
          </div>
          
          {/* Barra de busca e filtros */}
          <div className="flex items-center gap-4">
            {/* Campo de busca */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="🔍 Buscar por nome, tipo, WBS..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            {/* Ordenar por */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Ordenar:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 bg-white"
              >
                <option value="name">Nome</option>
                <option value="type">Tipo</option>
                <option value="duration">Duração</option>
                <option value="progress">Progresso</option>
              </select>
              
              {/* Botão de ordem */}
              <button
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="p-2 border border-red-300 rounded hover:bg-red-500 bg-gray-800"
                title={sortOrder === 'asc' ? 'Crescente' : 'Decrescente'}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
            
            {/* Contador de resultados */}
            {searchTerm && (
              <div className="text-sm text-gray-600">
                {sortedMainTasks.length} resultado(s)
              </div>
            )}
          </div>
        </div>

  <div className="p-4 overflow-x-auto text-gray-800">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  WBS
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Tarefa
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Duração
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Início
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Fim
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Progresso
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Custo Est.
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Custo Real
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* Renderizar apenas tarefas de NÍVEL 1 (sem parent_id) */}
              {sortedMainTasks.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  level={0}
                  allTasks={tasks}
                  onUpdate={handleUpdate}
                  onDelete={async (taskId, taskName, hasSubtasks) => {
                    await deleteTask(taskId, taskName, hasSubtasks)
                  }}
                  onAddSubtask={(taskId) => setAddingSubtaskToTask(taskId)}
                />
              ))}
              
              {/* Linha para adicionar nova tarefa principal */}
              {isAddingTask && (
                <tr className="bg-green-50">
                  <td className="px-4 py-2 text-xs text-gray-500">-</td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      placeholder="Nome da nova tarefa"
                      value={newTaskData.name}
                      onChange={(e) => setNewTaskData({ ...newTaskData, name: e.target.value })}
                      className="w-full px-2 py-1 border rounded text-gray-900 bg-white"
                      autoFocus
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={newTaskData.type}
                      onChange={(e) => setNewTaskData({ ...newTaskData, type: e.target.value })}
                      className="px-2 py-1 border rounded text-gray-900 bg-white"
                    >
                      <option value="projeto_mecanico">Projeto Mecânico</option>
                      <option value="compras_mecanica">Compras Mecânica</option>
                      <option value="projeto_eletrico">Projeto Elétrico</option>
                      <option value="compras_eletrica">Compras Elétrica</option>
                      <option value="fabricacao">Fabricação</option>
                      <option value="tratamento_superficial">Tratamento Superficial</option>
                      <option value="montagem_mecanica">Montagem Mecânica</option>
                      <option value="montagem_eletrica">Montagem Elétrica</option>
                      <option value="coleta">Coleta</option>
                      <option value="subtarefa">Subtarefa</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="0.125"
                      min="0.125"
                      value={newTaskData.duration}
                      onChange={(e) => setNewTaskData({ ...newTaskData, duration: parseFloat(e.target.value) })}
                      className="w-20 px-2 py-1 border rounded text-center text-gray-900 bg-white"
                    />
                  </td>
                  <td colSpan={6} className="px-4 py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={createNewTask}
                        className="px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        ✓ Criar
                      </button>
                      <button
                        onClick={cancelNewTask}
                        className="px-4 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                      >
                        ✗ Cancelar
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {/* Linha para adicionar subtarefa (quando acionado) */}
              {addingSubtaskToTask && (
                (() => {
                  const parentTask = tasks.find(t => t.id === addingSubtaskToTask)
                  if (!parentTask) return null
                  return (
                    <tr className="bg-blue-50">
                      <td className="px-4 py-2 text-xs text-gray-500">-</td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          placeholder="Nome da subtarefa"
                          value={newSubtaskData.name}
                          onChange={(e) => setNewSubtaskData({ ...newSubtaskData, name: e.target.value })}
                          className="w-full px-2 py-1 border rounded text-gray-900 bg-white"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') createNewSubtask(parentTask.id, parentTask.type)
                            if (e.key === 'Escape') cancelNewSubtask()
                          }}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">subtarefa</span>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          step="0.125"
                          min="0.125"
                          value={newSubtaskData.duration}
                          onChange={(e) => setNewSubtaskData({ ...newSubtaskData, duration: parseFloat(e.target.value) })}
                          className="w-20 px-2 py-1 border rounded text-center text-gray-900 bg-white"
                        />
                      </td>
                      <td colSpan={5} className="px-4 py-2 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => createNewSubtask(parentTask.id, parentTask.type)}
                            className="px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            ✓ Criar
                          </button>
                          <button
                            onClick={cancelNewSubtask}
                            className="px-4 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                          >
                            ✗ Cancelar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })()
              )}
            </tbody>
          </table>
        </div>

        {/* Adicionar nova tarefa */}
        <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
          <div>
            <button
              onClick={() => setIsAddingTask(true)}
              disabled={isAddingTask}
              className={`text-sm font-medium ${
                isAddingTask
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-blue-600 hover:text-blue-700'
              }`}
            >
              {isAddingTask ? '✏️ Editando...' : '+ Adicionar Nova Tarefa'}
            </button>
            {isAddingTask && (
              <span className="text-xs text-gray-500 ml-3">
                Enter para salvar • Esc para cancelar
              </span>
            )}
          </div>

          <div className="text-xs text-gray-500">
            Dica: clique no nome ou duração para editar inline.
          </div>
        </div>
      </div>
    </>
  )
}
