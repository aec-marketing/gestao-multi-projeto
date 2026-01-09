'use client'
import React from 'react'

import { useState, useEffect } from 'react'
import { Project, Task, Resource } from '@/types/database.types'
import { Allocation } from '@/types/allocation.types'
import { supabase } from '@/lib/supabase'
import { recalculateTasksInCascade, validateTaskStartDate } from '@/utils/predecessorCalculations'
import RecalculateModal from '@/components/modals/RecalculateModal'
import { showErrorAlert, showSuccessAlert, logError, ErrorContext } from '@/utils/errorHandler'

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
        // Error loading predecessors - silent fail
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
        comparison = a.duration - b.duration
        break
      case 'progress':
        comparison = a.progress - b.progress
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
    task.name.toLowerCase().includes(term) ||
    task.type.toLowerCase().includes(term)
  )
}

// Aplicar filtro e ordenação
const mainTasks = sortTasks(
  filterTasks(tasks.filter(t => !t.parent_id))
)

// ========== FUNÇÕES AUXILIARES ==========
// Formatar tipo de tarefa para exibição
function formatTaskType(type: string): string {
  return type
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
// ADICIONE ESTA FUNÇÃO:
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

    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)

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
          }
        }
      }
    }
    // ========== FIM AJUSTE ==========

    // Atualizar lista
    showSuccessAlert('Alterações salvas com sucesso')
    onRefresh()
  } catch (error) {
    logError(error, 'updateCell')
    showErrorAlert(error, ErrorContext.TASK_UPDATE)
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
    showSuccessAlert('Tarefa criada com sucesso')
    onRefresh()
  } catch (error) {
    logError(error, 'createNewTask')
    showErrorAlert(error, ErrorContext.TASK_CREATE)
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
    showSuccessAlert('Subtarefa criada com sucesso')
    onRefresh()
  } catch (error) {
    logError(error, 'createNewSubtask')
    showErrorAlert(error, ErrorContext.TASK_CREATE)
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
  }

  try {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)

    if (error) throw error

    showSuccessAlert('Tarefa excluída com sucesso')
    onRefresh()
  } catch (error) {
    logError(error, 'deleteTask')
    showErrorAlert(error, ErrorContext.TASK_DELETE)
  }
}

  // Create task names map for modal
  const taskNamesMap = new Map(tasks.map(t => [t.id, t.name]))

  // ========== COMPONENTE RECURSIVO PARA RENDERIZAR TAREFAS ==========
  interface TaskRowProps {
    task: Task
    level: number
    allTasks: Task[]
  }

  const TaskRow: React.FC<TaskRowProps> = ({ task, level, allTasks }) => {
    // Buscar subtarefas DIRETAS deste task
    const subtasks = allTasks.filter(t => t.parent_id === task.id)
    const hasSubtasks = subtasks.length > 0

    // Calcular indentação baseado no outline_level (mais preciso) ou level
    const indentLevel = task.outline_level || level
    const indent = indentLevel * 30 // 30px por nível

    // Calcular totais se tiver subtarefas (soma recursiva)
    const calculateTotalCost = (taskId: string, field: 'estimated_cost' | 'actual_cost'): number => {
      const directSubtasks = allTasks.filter(t => t.parent_id === taskId)
      if (directSubtasks.length === 0) return 0

      return directSubtasks.reduce((sum, sub) => {
        const subCost = sub[field] || 0
        const recursiveCost = calculateTotalCost(sub.id, field)
        return sum + subCost + recursiveCost
      }, 0)
    }

    const totalEstimatedCost = hasSubtasks ? calculateTotalCost(task.id, 'estimated_cost') : 0
    const totalActualCost = hasSubtasks ? calculateTotalCost(task.id, 'actual_cost') : 0

    const taskAllocations = allocations.filter(a => a.task_id === task.id)

    return (
      <>
        {/* Linha da Tarefa Atual */}
        <tr className={hasSubtasks ? 'bg-gray-50 font-medium' : 'hover:bg-gray-50'}>
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
              {level > 0 && <span className="text-gray-400">└─</span>}

              <input
                type="text"
                defaultValue={task.name}
                className="flex-1 border-0 bg-transparent text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                onDoubleClick={(e) => e.currentTarget.select()}
                onBlur={(e) => updateTask(task.id, 'name', e.target.value)}
              />
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
            <input
              type="number"
              step="0.125"
              min="0.125"
              defaultValue={task.duration}
              className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm text-gray-900 bg-white"
              onDoubleClick={(e) => e.currentTarget.select()}
              onBlur={(e) => updateTask(task.id, 'duration', e.target.value)}
            />
          </td>

          {/* Data Início */}
          <td className="px-4 py-2 text-center">
            <input
              type="date"
              defaultValue={task.start_date || ''}
              className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white"
              onBlur={(e) => updateTask(task.id, 'start_date', e.target.value)}
            />
          </td>

          {/* Data Fim */}
          <td className="px-4 py-2 text-center">
            <input
              type="date"
              defaultValue={task.end_date || ''}
              className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white"
              onBlur={(e) => updateTask(task.id, 'end_date', e.target.value)}
            />
          </td>

          {/* Pessoas */}
          <td className="px-4 py-2">
            <div className="flex flex-wrap gap-1">
              {taskAllocations.map(alloc => {
                const resource = resources.find(r => r.id === alloc.resource_id)
                return (
                  <span
                    key={alloc.id}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700"
                  >
                    {resource?.name || 'N/A'}
                  </span>
                )
              })}
              {taskAllocations.length === 0 && (
                <span className="text-xs text-gray-400">Nenhuma</span>
              )}
            </div>
          </td>

          {/* Progresso */}
          <td className="px-4 py-2">
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${task.progress}%` }}
                />
              </div>
              <span className="text-xs text-gray-600 w-10 text-right">
                {task.progress}%
              </span>
            </div>
          </td>

          {/* Custo Estimado */}
          <td className="px-4 py-2 text-right">
            {hasSubtasks ? (
              <div className="flex items-center justify-end gap-1">
                <span className="text-xs text-gray-500">R$</span>
                <span className="bg-green-50 text-green-700 px-2 py-1 rounded text-sm font-semibold">
                  {totalEstimatedCost.toFixed(2)}
                </span>
                <span className="text-xs text-gray-400" title="Soma das subtarefas">
                  (Σ)
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-end gap-1">
                <span className="text-xs text-gray-500">R$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={task.estimated_cost || ''}
                  placeholder="0,00"
                  className="w-24 px-2 py-1 border border-gray-300 rounded text-right text-sm text-gray-900 bg-white"
                  onBlur={(e) => updateTask(task.id, 'estimated_cost', e.target.value)}
                />
              </div>
            )}
          </td>

          {/* Custo Real */}
          <td className="px-4 py-2 text-right">
            {hasSubtasks ? (
              <div className="flex items-center justify-end gap-1">
                <span className="text-xs text-gray-500">R$</span>
                <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-sm font-semibold">
                  {totalActualCost.toFixed(2)}
                </span>
                <span className="text-xs text-gray-400" title="Soma das subtarefas">
                  (Σ)
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-end gap-1">
                <span className="text-xs text-gray-500">R$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={task.actual_cost || ''}
                  placeholder="0,00"
                  className="w-24 px-2 py-1 border border-gray-300 rounded text-right text-sm text-gray-900 bg-white"
                  onBlur={(e) => updateTask(task.id, 'actual_cost', e.target.value)}
                />
              </div>
            )}
          </td>

          {/* Ações */}
          <td className="px-4 py-2">
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setAddingSubtaskToTask(task.id)}
                className="text-green-600 hover:text-green-700"
                title="Adicionar subtarefa"
              >
                ➕
              </button>
              <button
                onClick={() => deleteTask(task.id, task.name, hasSubtasks)}
                className="text-red-600 hover:text-red-700"
                title="Excluir tarefa"
              >
                🗑️
              </button>
            </div>
          </td>
        </tr>

        {/* Linha para adicionar nova subtarefa (DENTRO da recursão) */}
        {addingSubtaskToTask === task.id && (
          <tr className="bg-green-50 border-2 border-green-500">
            <td className="px-4 py-2 text-xs text-gray-500">-</td>
            <td className="px-4 py-2">
              <div
                className="flex items-center gap-2"
                style={{ paddingLeft: `${indent + 30}px` }}
              >
                <span className="text-gray-400">└─</span>
                <input
                  type="text"
                  placeholder="Nome da subtarefa..."
                  value={newSubtaskData.name}
                  onChange={(e) => setNewSubtaskData({ ...newSubtaskData, name: e.target.value })}
                  className="flex-1 border border-green-500 rounded px-2 py-1 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') createNewSubtask(task.id, task.type)
                    if (e.key === 'Escape') cancelNewSubtask()
                  }}
                />
              </div>
            </td>
            <td className="px-4 py-2">
              <span className="text-sm text-gray-600">subtarefa</span>
            </td>
            <td className="px-4 py-2 text-center">
              <input
                type="number"
                step="0.125"
                min="0.125"
                value={newSubtaskData.duration}
                onChange={(e) => setNewSubtaskData({ ...newSubtaskData, duration: parseFloat(e.target.value) })}
                className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm text-gray-900 bg-white"
              />
            </td>
            <td className="px-4 py-2 text-center text-xs text-gray-400">Calculado</td>
            <td className="px-4 py-2 text-center text-xs text-gray-400">Calculado</td>
            <td className="px-4 py-2 text-xs text-gray-400">Nenhuma</td>
            <td className="px-4 py-2 text-xs text-gray-400">0%</td>
            <td className="px-4 py-2 text-xs text-gray-400">-</td>
            <td className="px-4 py-2 text-xs text-gray-400">-</td>
            <td className="px-4 py-2">
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => createNewSubtask(task.id, task.type)}
                  className="text-green-600 hover:text-green-700"
                  title="Salvar (Enter)"
                >
                  ✅
                </button>
                <button
                  onClick={cancelNewSubtask}
                  className="text-red-600 hover:text-red-700"
                  title="Cancelar (Esc)"
                >
                  ❌
                </button>
              </div>
            </td>
          </tr>
        )}

        {/* RECURSÃO: Renderizar subtarefas */}
        {subtasks.map(subtask => (
          <TaskRow
            key={subtask.id}
            task={subtask}
            level={level + 1}
            allTasks={allTasks}
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
          placeholder="🔍 Buscar por nome ou tipo..."
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
          className="p-2 border border-gray-300 rounded hover:bg-gray-50 bg-white text-gray-700"
          title={sortOrder === 'asc' ? 'Crescente' : 'Decrescente'}
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </button>
      </div>
      
      {/* Contador de resultados */}
      {searchTerm && (
        <div className="text-sm text-gray-600">
          {mainTasks.length} resultado(s)
        </div>
      )}
    </div>
  </div>

      <div className="overflow-x-auto">
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
                Pessoas
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
            {/* Renderizar apenas tarefas de NÍVEL 1 (sem parent_id) usando recursão */}
            {mainTasks.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                level={0}
                allTasks={tasks}
              />
            ))}

            {/* Linha para adicionar nova tarefa principal */}
            {isAddingTask && (
              <tr className="bg-green-50 border-2 border-green-500">
                <td className="px-4 py-2 text-xs text-gray-500">-</td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    placeholder="Nome da tarefa..."
                    value={newTaskData.name}
                    onChange={(e) => setNewTaskData({ ...newTaskData, name: e.target.value })}
                    className="w-full border border-green-500 rounded px-2 py-1 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') createNewTask()
                      if (e.key === 'Escape') cancelNewTask()
                    }}
                  />
                </td>
                <td className="px-4 py-2">
                  <select
                    value={newTaskData.type}
                    onChange={(e) => setNewTaskData({ ...newTaskData, type: e.target.value })}
                    className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white"
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
                <td className="px-4 py-2 text-center">
                  <input
                    type="number"
                    step="0.125"
                    min="0.125"
                    value={newTaskData.duration}
                    onChange={(e) => setNewTaskData({ ...newTaskData, duration: parseFloat(e.target.value) })}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm text-gray-900 bg-white"
                  />
                </td>
                <td className="px-4 py-2 text-center text-xs text-gray-400">Calculado</td>
                <td className="px-4 py-2 text-center text-xs text-gray-400">Calculado</td>
                <td className="px-4 py-2 text-xs text-gray-400">Nenhuma</td>
                <td className="px-4 py-2 text-xs text-gray-400">0%</td>
                <td className="px-4 py-2 text-xs text-gray-400">-</td>
                <td className="px-4 py-2 text-xs text-gray-400">-</td>
                <td className="px-4 py-2">
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={createNewTask}
                      className="text-green-600 hover:text-green-700"
                      title="Salvar (Enter)"
                    >
                      ✅
                    </button>
                    <button
                      onClick={cancelNewTask}
                      className="text-red-600 hover:text-red-700"
                      title="Cancelar (Esc)"
                    >
                      ❌
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Adicionar nova tarefa */}
      <div className="p-4 border-t bg-gray-50">
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
      </div>
    </>
  )
}