'use client'
import React from 'react'

import { useState, useEffect } from 'react'
import { Project, Task, Resource } from '@/types/database.types'
import { Allocation } from '@/types/allocation.types'
import { supabase } from '@/lib/supabase'
import { recalculateTasksInCascade, validateTaskStartDate } from '@/utils/predecessorCalculations'
import RecalculateModal from '@/components/modals/RecalculateModal'
import { showErrorAlert, showSuccessAlert, logError, ErrorContext } from '@/utils/errorHandler'
import { dispatchToast } from '@/components/ui/ToastProvider'
import TableViewErrorBoundary from '@/components/error-boundary/TableViewErrorBoundary'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { Toast } from '@/components/ui/Toast'

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

// Estados para loading e confirmação
const [isLoading, setIsLoading] = useState(false)
const [loadingMessage, setLoadingMessage] = useState('')
const [confirmModal, setConfirmModal] = useState<{
  isOpen: boolean
  title: string
  message: string
  onConfirm: () => void | Promise<void>
  variant: 'danger' | 'warning' | 'info'
} | null>(null)

// Estados para controle de edição
const [pendingChanges, setPendingChanges] = useState<Map<string, {
  taskId: string
  field: string
  value: any
  originalValue: any
  taskName: string
}>>(new Map())

// Estado para toast notifications
const [toast, setToast] = useState<{
  message: string
  type: 'success' | 'error' | 'info' | 'saving'
} | null>(null)

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
// Função auxiliar para comparar valores
function valuesAreEqual(value1: any, value2: any): boolean {
  // Normalizar valores vazios
  const normalize = (val: any) => {
    if (val === null || val === undefined || val === '') return null
    if (typeof val === 'string') return val.trim()
    return val
  }

  const v1 = normalize(value1)
  const v2 = normalize(value2)

  return v1 === v2
}

// Função para adicionar mudança pendente
function addPendingChange(taskId: string, field: string, value: any, originalValue: any) {
  // Verificar se o valor realmente mudou
  if (valuesAreEqual(value, originalValue)) {
    // Valor não mudou, remover da lista de pendentes se existir
    const key = `${taskId}-${field}`
    setPendingChanges(prev => {
      const newMap = new Map(prev)
      newMap.delete(key)
      return newMap
    })
    return
  }

  // Adicionar à lista de mudanças pendentes
  const key = `${taskId}-${field}`
  const task = tasks.find(t => t.id === taskId)

  setPendingChanges(prev => new Map(prev).set(key, {
    taskId,
    field,
    value,
    originalValue,
    taskName: task?.name || 'Tarefa'
  }))
}

// Função para salvar todas as mudanças pendentes
async function saveAllChanges() {
  if (pendingChanges.size === 0) return

  setIsLoading(true)
  setLoadingMessage(`Salvando ${pendingChanges.size} alteração(ões)...`)

  try {
    const { syncTaskFields } = await import('@/utils/taskDateSync')
    let successCount = 0
    let errorCount = 0
    const errors: string[] = []

    for (const [key, change] of pendingChanges.entries()) {
      try {
        const { taskId, field, value } = change
        const updates: any = {}

        // Determinar qual campo atualizar
        if (field === 'name') {
          updates.name = value
        } else if (field === 'estimated_cost') {
          updates.estimated_cost = value ? parseFloat(value as string) : 0
        } else if (field === 'actual_cost') {
          updates.actual_cost = value ? parseFloat(value as string) : 0
        } else if (field === 'duration' || field === 'start_date' || field === 'end_date') {
          // Sincronizar datas e duração
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

          // Validação de predecessor
          if (field === 'start_date' || field === 'end_date') {
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
              errors.push(`${change.taskName}: ${validation.message}`)
              errorCount++
              continue // Pular esta atualização
            }
          }

          Object.assign(updates, syncedFields)
        }

        const { error } = await supabase
          .from('tasks')
          .update(updates)
          .eq('id', taskId)

        if (error) throw error

        // Ajuste de duração da tarefa pai
        const updatedTask = tasks.find(t => t.id === taskId)
        if (updatedTask?.parent_id && field === 'duration') {
          const parentTask = tasks.find(t => t.id === updatedTask.parent_id)
          if (parentTask) {
            const siblings = tasks.filter(t => t.parent_id === parentTask.id)
            const maxSubtaskDuration = Math.max(
              ...siblings.map(s => s.id === taskId ? parseFloat(value as string) : s.duration || 0)
            )

            if (maxSubtaskDuration > (parentTask.duration || 0)) {
              if (parentTask.start_date) {
                const newParentEndDate = new Date(parentTask.start_date)
                newParentEndDate.setDate(newParentEndDate.getDate() + maxSubtaskDuration - 1)

                // ONDA 2: duration é computed, só atualizar end_date
                await supabase
                  .from('tasks')
                  .update({
                    end_date: newParentEndDate.toISOString().split('T')[0]
                  })
                  .eq('id', parentTask.id)
              }
              // else: ONDA 2: duration_minutes é calculado automaticamente, não precisa update
            }
          }
        }

        successCount++
      } catch (error) {
        logError(error, 'saveChange')
        errors.push(`${change.taskName}: Erro ao salvar`)
        errorCount++
      }
    }

    // Limpar mudanças pendentes
    setPendingChanges(new Map())

    // Atualizar lista
    onRefresh()

    // Mostrar resultado
    if (errorCount === 0) {
      setToast({ message: `✓ ${successCount} alteração(ões) salva(s)`, type: 'success' })
    } else {
      setToast({
        message: `⚠ ${successCount} salva(s), ${errorCount} com erro`,
        type: 'error'
      })
      if (errors.length > 0) {
        dispatchToast('Alguns erros ao salvar. Verifique os dados e tente novamente.', 'error')
      }
    }
  } catch (error) {
    logError(error, 'saveAllChanges')
    setToast({ message: 'Erro ao salvar alterações', type: 'error' })
    showErrorAlert(error, ErrorContext.TASK_UPDATE)
  } finally {
    setIsLoading(false)
    setLoadingMessage('')
  }
}

// Função para verificar se um campo tem mudança pendente
function hasPendingChange(taskId: string, field: string): boolean {
  return pendingChanges.has(`${taskId}-${field}`)
}
async function createNewTask() {
  if (!newTaskData.name.trim()) {
    dispatchToast('Nome da tarefa é obrigatório', 'info')
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
    dispatchToast('Nome da subtarefa é obrigatório', 'info')
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
      // Atualizar end_date da tarefa pai (duração é calculada automaticamente)
      if (parentTask.start_date) {
        const newParentEndDate = new Date(parentTask.start_date)
        newParentEndDate.setDate(newParentEndDate.getDate() + maxSubtaskDuration - 1)

        await supabase
          .from('tasks')
          .update({
            end_date: newParentEndDate.toISOString().split('T')[0]
          })
          .eq('id', parentTaskId)
      }
      // Se não tem start_date, não precisa atualizar nada (duração é computed)
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
function deleteTask(taskId: string, taskName: string, hasSubtasks: boolean) {
  const message = hasSubtasks
    ? `A tarefa "${taskName}" possui subtarefas.\n\nDeseja excluir a tarefa e todas as suas subtarefas?\n\nEsta ação não pode ser desfeita.`
    : `Tem certeza que deseja excluir a tarefa "${taskName}"?\n\nEsta ação não pode ser desfeita.`

  setConfirmModal({
    isOpen: true,
    title: 'Confirmar Exclusão',
    message,
    variant: 'danger',
    onConfirm: async () => {
      try {
        setIsLoading(true)
        setLoadingMessage('Excluindo tarefa...')

        const { error } = await supabase
          .from('tasks')
          .delete()
          .eq('id', taskId)

        if (error) throw error

        setConfirmModal(null)
        showSuccessAlert('Tarefa excluída com sucesso')
        onRefresh()
      } catch (error) {
        logError(error, 'deleteTask')
        showErrorAlert(error, ErrorContext.TASK_DELETE)
      } finally {
        setIsLoading(false)
        setLoadingMessage('')
      }
    }
  })
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
                className={`flex-1 border-0 bg-transparent text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 ${
                  hasPendingChange(task.id, 'name') ? 'bg-yellow-50 border-2 border-yellow-400' : ''
                }`}
                onDoubleClick={(e) => e.currentTarget.select()}
                onBlur={(e) => addPendingChange(task.id, 'name', e.target.value, task.name)}
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
              className={`w-20 px-2 py-1 border rounded text-center text-sm text-gray-900 ${
                hasPendingChange(task.id, 'duration')
                  ? 'bg-yellow-50 border-yellow-400 border-2'
                  : 'bg-white border-gray-300'
              }`}
              onDoubleClick={(e) => e.currentTarget.select()}
              onBlur={(e) => addPendingChange(task.id, 'duration', e.target.value, task.duration)}
            />
          </td>

          {/* Data Início */}
          <td className="px-4 py-2 text-center">
            <input
              type="date"
              defaultValue={task.start_date || ''}
              className={`border rounded px-2 py-1 text-sm text-gray-900 ${
                hasPendingChange(task.id, 'start_date')
                  ? 'bg-yellow-50 border-yellow-400 border-2'
                  : 'bg-white border-gray-300'
              }`}
              onBlur={(e) => addPendingChange(task.id, 'start_date', e.target.value, task.start_date)}
            />
          </td>

          {/* Data Fim */}
          <td className="px-4 py-2 text-center">
            <input
              type="date"
              defaultValue={task.end_date || ''}
              className={`border rounded px-2 py-1 text-sm text-gray-900 ${
                hasPendingChange(task.id, 'end_date')
                  ? 'bg-yellow-50 border-yellow-400 border-2'
                  : 'bg-white border-gray-300'
              }`}
              onBlur={(e) => addPendingChange(task.id, 'end_date', e.target.value, task.end_date)}
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
                  className={`w-24 px-2 py-1 border rounded text-right text-sm text-gray-900 ${
                    hasPendingChange(task.id, 'estimated_cost')
                      ? 'bg-yellow-50 border-yellow-400 border-2'
                      : 'bg-white border-gray-300'
                  }`}
                  onBlur={(e) => addPendingChange(task.id, 'estimated_cost', e.target.value, task.estimated_cost)}
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
                  className={`w-24 px-2 py-1 border rounded text-right text-sm text-gray-900 ${
                    hasPendingChange(task.id, 'actual_cost')
                      ? 'bg-yellow-50 border-yellow-400 border-2'
                      : 'bg-white border-gray-300'
                  }`}
                  onBlur={(e) => addPendingChange(task.id, 'actual_cost', e.target.value, task.actual_cost)}
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
    <TableViewErrorBoundary onRefresh={onRefresh}>
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

      {/* Confirm Modal */}
      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal(null)}
          onConfirm={confirmModal.onConfirm}
          title={confirmModal.title}
          message={confirmModal.message}
          variant={confirmModal.variant}
          isLoading={isLoading}
          confirmText={confirmModal.variant === 'danger' ? 'Excluir' : 'Confirmar'}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="bg-white rounded-lg border overflow-hidden relative">
        {/* Loading Overlay */}
        <LoadingOverlay isLoading={isLoading} message={loadingMessage} />

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

      {/* Empty State ou Tabela */}
      {mainTasks.length === 0 && !isAddingTask ? (
        <EmptyState
          icon={
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
          title={searchTerm ? "Nenhuma tarefa encontrada" : "Nenhuma tarefa cadastrada"}
          description={
            searchTerm
              ? `Não encontramos tarefas correspondentes a "${searchTerm}". Tente ajustar sua busca.`
              : "Comece criando sua primeira tarefa para gerenciar o projeto."
          }
          action={
            searchTerm
              ? undefined
              : {
                  label: "+ Criar Primeira Tarefa",
                  onClick: () => setIsAddingTask(true)
                }
          }
        />
      ) : (
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
      )}

      {/* Adicionar nova tarefa */}
      {!searchTerm && (
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
      )}
      </div>

      {/* Barra de Salvamento - Sticky Bottom */}
      {pendingChanges.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-yellow-50 to-orange-50 border-t-4 border-yellow-400 shadow-2xl z-50 animate-slide-up">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Info das mudanças pendentes */}
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-yellow-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-yellow-900">
                      {pendingChanges.size} alteração{pendingChanges.size !== 1 ? 'ões' : ''} não salva{pendingChanges.size !== 1 ? 's' : ''}
                    </span>
                    <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 rounded-full text-xs font-semibold">
                      Pendente
                    </span>
                  </div>
                  <p className="text-sm text-yellow-800 mt-0.5">
                    Clique em &quot;Salvar Tudo&quot; para aplicar as mudanças ao banco de dados
                  </p>
                </div>
              </div>

              {/* Botões de ação */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPendingChanges(new Map())}
                  className="px-5 py-2.5 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all font-medium shadow-sm"
                >
                  Descartar Tudo
                </button>
                <button
                  onClick={saveAllChanges}
                  disabled={isLoading}
                  className="px-8 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all font-bold text-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                      Salvar Tudo
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Adicionar animação slide-up */}
      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </TableViewErrorBoundary>
  )
}