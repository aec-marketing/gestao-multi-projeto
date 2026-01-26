'use client'

import React, { useState, useCallback } from 'react'
import { Project } from '@/types/database.types'
import { useBatchUpdateTasks, useDeleteTask, useCreateTask, useUpdateTask } from '@/queries/tasks.queries'
import { useTableData } from '@/hooks/table/useTableData'
import { useTableFilters } from '@/hooks/table/useTableFilters'
import { usePendingChanges } from '@/hooks/table/usePendingChanges'
import { useTaskCalculations } from '@/hooks/table/useTaskCalculations'
import { TableToolbar } from './TableToolbar'
import { TableHeader } from './TableHeader'
import { TaskRow } from './TaskRow'
import { NewTaskRow } from './NewTaskRow'
import { BatchSaveBar } from './BatchSaveBar'
import { ProjectCostSummary } from './ProjectCostSummary'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { DurationAdjustModal, DurationAdjustmentType } from '@/components/modals/DurationAdjustModal'
import AllocationModal from '@/components/AllocationModal'
import { applyDurationAdjustment, calculateEndDateFromDuration } from '@/utils/taskDateSync'
import { generateNextWbsCode } from '@/utils/wbs'
import TableViewErrorBoundary from '@/components/error-boundary/TableViewErrorBoundary'
import { daysToMinutes } from '@/utils/time.utils'
import { WorkType } from '@/utils/workType.utils'
import { updateTaskActualCost } from '@/lib/task-cost-service'

interface TableViewTabProps {
  project: Project
}

/**
 * TableViewTab - Componente principal da visualização em tabela
 *
 * Refatorado completamente com:
 * - React Query para gerenciamento de estado
 * - Batch save com optimistic updates
 * - Controlled components (resolve bug de campos resetando)
 * - Componentes modulares e memoizados
 */
export default function TableViewTab({ project }: TableViewTabProps) {
  // ==================== DATA LOADING ====================
  const {
    tasks,
    mainTasks,
    resources,
    allocations,
    isLoading
  } = useTableData(project.id)

  // ==================== FILTERS ====================
  const {
    searchTerm,
    setSearchTerm,
    sortBy,
    setSortBy,
    sortOrder,
    toggleSortOrder,
    filterAndSort
  } = useTableFilters()

  // ==================== PENDING CHANGES ====================
  const {
    addChange,
    clearChanges,
    hasChange,
    getCurrentValue,
    prepareBatchUpdates,
    changeCount
  } = usePendingChanges()

  // ==================== MUTATIONS ====================
  const batchUpdateMutation = useBatchUpdateTasks(project.id)
  const deleteTaskMutation = useDeleteTask(project.id)
  const createTaskMutation = useCreateTask(project.id)
  const updateTaskMutation = useUpdateTask(project.id)

  // ==================== CALCULATIONS ====================
  const { calculateTotalCost } = useTaskCalculations(tasks)

  // ==================== UI STATE ====================
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [newTaskData, setNewTaskData] = useState<{
    name: string
    type: 'projeto_mecanico'
    workType: WorkType  // ONDA 3: WorkType union type
    duration: number
  }>({
    name: '',
    type: 'projeto_mecanico',
    workType: 'work', // ONDA 3: Categoria padrão = Produção
    duration: 540 // ONDA 2: 1 dia = 540 minutos
  })

  const [addingSubtaskTo, setAddingSubtaskTo] = useState<string | null>(null)
  const [newSubtaskData, setNewSubtaskData] = useState<{
    name: string
    workType: WorkType  // ONDA 3: WorkType union type
    duration: number
  }>({
    name: '',
    workType: 'work', // ONDA 3: Categoria padrão = Produção
    duration: 540 // ONDA 2: 1 dia = 540 minutos
  })

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void | Promise<void>
    variant: 'danger' | 'warning' | 'info'
  } | null>(null)

  // Duration Adjustment Modal state
  const [durationAdjustModal, setDurationAdjustModal] = useState<{
    isOpen: boolean
    taskId: string
    taskName: string
    currentStartDate: string
    currentEndDate: string
    currentDuration: number
    newDuration: number
  } | null>(null)

  // Allocation Modal state (ONDA 1)
  const [allocationModal, setAllocationModal] = useState<{
    isOpen: boolean
    taskId: string
    allocationId?: string  // ONDA 3: ID da alocação para edição (opcional)
  } | null>(null)

  // ==================== FILTERED TASKS ====================
  const filteredMainTasks = filterAndSort(mainTasks)

  // ==================== COST TOTALS (ONDA 1) ====================
  const totalEstimatedCost = React.useMemo(() => {
    return tasks.reduce((sum, task) => sum + (task.estimated_cost || 0), 0)
  }, [tasks])

  const totalActualCost = React.useMemo(() => {
    return tasks.reduce((sum, task) => sum + (task.actual_cost || 0), 0)
  }, [tasks])

  // ==================== HANDLERS ====================

  /**
   * Handler para mudança de campo
   * Adiciona mudança ao Map de pending changes
   * Para mudanças de duração, abre modal de ajuste
   */
  const handleFieldChange = useCallback((
    taskId: string,
    field: string,
    value: any,
    originalValue: any,
    taskName: string
  ) => {
    // Special handling for duration changes
    if (field === 'duration') {
      const newDuration = parseFloat(value)
      const currentDuration = parseFloat(originalValue)

      // Only show modal if duration actually changed and we have dates
      if (newDuration !== currentDuration && !isNaN(newDuration)) {
        const task = tasks.find(t => t.id === taskId)

        if (task && task.start_date && task.end_date) {
          // Open duration adjustment modal
          setDurationAdjustModal({
            isOpen: true,
            taskId,
            taskName,
            currentStartDate: task.start_date,
            currentEndDate: task.end_date,
            currentDuration: task.duration,
            newDuration
          })
          return // Don't add change yet, wait for modal confirmation
        }
      }
    }

    // For all other fields, add change immediately
    addChange(taskId, field, value, originalValue, taskName)
  }, [addChange, tasks])

  /**
   * Handler para confirmação do ajuste de duração
   */
  const handleDurationAdjustConfirm = useCallback((adjustmentType: DurationAdjustmentType) => {
    if (!durationAdjustModal) return

    const { taskId, taskName, currentStartDate, currentEndDate, currentDuration, newDuration } = durationAdjustModal

    // Apply the adjustment based on user choice
    const updates = applyDurationAdjustment(
      newDuration,
      adjustmentType,
      {
        start_date: currentStartDate,
        end_date: currentEndDate,
        duration: currentDuration,
        lag_days: tasks.find(t => t.id === taskId)?.lag_days || 0
      }
    )

    // Add all updated fields to pending changes (exceto duration que é computed)
    Object.entries(updates).forEach(([field, value]) => {
      // ONDA 2: Ignorar campo duration (é computed/readonly)
      if (field === 'duration') return

      const task = tasks.find(t => t.id === taskId)
      if (task) {
        const originalValue = (task as any)[field]
        addChange(taskId, field, value, originalValue, taskName)
      }
    })

    // Close modal
    setDurationAdjustModal(null)
  }, [durationAdjustModal, tasks, addChange])

  /**
   * Handler para salvar todas as mudanças
   * Usa React Query mutation com optimistic updates
   * ONDA 1: Recalcula custos de tarefas afetadas após salvar
   */
  const handleSaveAll = useCallback(async () => {
    const updates = prepareBatchUpdates(tasks)

    // Identificar tarefas com mudanças que afetam custo
    const tasksToRecalculate = new Set<string>()

    updates.forEach(update => {
      // Estrutura correta: { id, updates }
      const changes = update.updates
      // Se mudou duration_minutes, start_date, end_date -> recalcular custo
      if (changes.duration_minutes !== undefined ||
          changes.start_date !== undefined ||
          changes.end_date !== undefined) {
        tasksToRecalculate.add(update.id)
      }
    })

    try {
      await batchUpdateMutation.mutateAsync(updates)

      // ONDA 1: Recalcular custos das tarefas afetadas
      if (tasksToRecalculate.size > 0) {
        await Promise.all(
          Array.from(tasksToRecalculate).map(taskId =>
            updateTaskActualCost(taskId)
          )
        )
      }

      clearChanges()
    } catch (error) {
      // Erro já tratado pela mutation
      console.error('Error saving changes:', error)
    }
  }, [prepareBatchUpdates, tasks, batchUpdateMutation, clearChanges])

  /**
   * Handler para criar nova tarefa principal
   */
  const handleCreateTask = useCallback(async () => {
    if (!newTaskData.name.trim()) {
      alert('Digite um nome para a tarefa')
      return
    }

    // Calculate next sort_order
    const maxSortOrder = tasks.length > 0
      ? Math.max(...tasks.map(t => t.sort_order || 0))
      : 0

    // Gerar WBS automaticamente
    const wbsCode = generateNextWbsCode(tasks, null)

    // Definir start_date para a nova tarefa
    // Estratégia: Se houver projeto start_date, usar ela; senão, usar hoje
    const taskStartDate = project.start_date || new Date().toISOString().split('T')[0]

    // Calcular end_date baseado em duration_minutes
    const taskEndDate = calculateEndDateFromDuration(taskStartDate, newTaskData.duration / 540)

    try {
      await createTaskMutation.mutateAsync({
        name: newTaskData.name.trim(),
        type: newTaskData.type,
        duration_minutes: newTaskData.duration, // ONDA 2: Já está em minutos
        work_type: newTaskData.workType, // ONDA 3: Categoria selecionada
        progress: 0,
        sort_order: maxSortOrder + 1,
        parent_id: null,
        wbs_code: wbsCode,
        outline_level: 0,
        start_date: taskStartDate,
        end_date: taskEndDate,
        is_optional: false,
        is_critical_path: false
      })

      // Reset form
      setNewTaskData({ name: '', type: 'projeto_mecanico', workType: 'work', duration: 540 })
      setIsAddingTask(false)
    } catch (error) {
      console.error('Error creating task:', error)
    }
  }, [newTaskData, tasks, createTaskMutation])

  /**
   * Handler para cancelar criação de tarefa
   */
  const handleCancelCreateTask = useCallback(() => {
    setNewTaskData({ name: '', type: 'projeto_mecanico', workType: 'work', duration: 540 })
    setIsAddingTask(false)
  }, [])

  /**
   * Handler para adicionar subtarefa
   */
  const handleAddSubtask = useCallback((taskId: string) => {
    setAddingSubtaskTo(taskId)
    setNewSubtaskData({ name: '', workType: 'work', duration: 540 })  // ONDA 3: Added workType
  }, [])

  /**
   * Handler para criar subtarefa
   */
  const handleCreateSubtask = useCallback(async (parentTaskId: string) => {
    if (!newSubtaskData.name.trim()) {
      alert('Digite um nome para a subtarefa')
      return
    }

    const parentTask = tasks.find(t => t.id === parentTaskId)
    if (!parentTask) return

    // Calculate next sort_order
    const maxSortOrder = tasks.length > 0
      ? Math.max(...tasks.map(t => t.sort_order || 0))
      : 0

    // Calculate start_date and end_date for subtask
    // Se o pai tem start_date, usar ela; senão, usar data do projeto ou hoje
    const subtaskStartDate = parentTask.start_date || project.start_date || new Date().toISOString().split('T')[0]

    // Calcular end_date baseado em duration_minutes (converter para dias)
    const subtaskEndDate = calculateEndDateFromDuration(
      subtaskStartDate,
      newSubtaskData.duration / 540 // Converter minutos para dias
    )

    // Gerar WBS automaticamente (ex: se pai é "1", subtarefa será "1.1")
    const wbsCode = generateNextWbsCode(tasks, parentTaskId)

    // Calcular outline_level baseado no pai
    const outlineLevel = (parentTask.outline_level || 0) + 1

    try {
      const newSubtask = await createTaskMutation.mutateAsync({
        name: newSubtaskData.name.trim(),
        type: 'subtarefa',
        duration_minutes: newSubtaskData.duration, // ONDA 2: Já está em minutos
        work_type: newSubtaskData.workType,  // ONDA 3: Use workType from state
        progress: 0,
        sort_order: maxSortOrder + 1,
        parent_id: parentTaskId,
        wbs_code: wbsCode,
        outline_level: outlineLevel,
        start_date: subtaskStartDate,
        end_date: subtaskEndDate,
        is_optional: false,
        is_critical_path: false
      })

      // O trigger do banco irá atualizar automaticamente:
      // - duration da tarefa pai (baseado nas datas dos filhos)
      // - start_date do pai (menor start_date dos filhos)
      // - end_date do pai (maior end_date dos filhos)

      // Reset form
      setNewSubtaskData({ name: '', workType: 'work', duration: 540 })  // ONDA 3: Reset workType
      setAddingSubtaskTo(null)
    } catch (error) {
      console.error('Error creating subtask:', error)
    }
  }, [newSubtaskData, tasks, createTaskMutation, updateTaskMutation])

  /**
   * Handler para cancelar criação de subtarefa
   */
  const handleCancelCreateSubtask = useCallback(() => {
    setNewSubtaskData({ name: '', workType: 'work', duration: 540 })  // ONDA 3: Reset workType
    setAddingSubtaskTo(null)
  }, [])

  /**
   * Handler para deletar tarefa
   */
  const handleDelete = useCallback((taskId: string, taskName: string, hasSubtasks: boolean) => {
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
          await deleteTaskMutation.mutateAsync(taskId)
          setConfirmModal(null)
        } catch (error) {
          // Erro já tratado pela mutation
          console.error('Error deleting task:', error)
        }
      }
    })
  }, [deleteTaskMutation])

  /**
   * Handler para abrir modal de alocação (ONDA 1)
   */
  const handleOpenAllocation = useCallback((taskId: string, allocationId?: string) => {
    setAllocationModal({
      isOpen: true,
      taskId,
      allocationId  // ONDA 3: Passar ID da alocação para modo de edição
    })
  }, [])

  /**
   * Handler para fechar modal de alocação e recarregar dados
   */
  const handleAllocationSuccess = useCallback(() => {
    setAllocationModal(null)
    // Dados serão recarregados automaticamente via React Query
  }, [])

  // ==================== RENDER ====================
  return (
    <TableViewErrorBoundary>
      {/* Confirm Modal */}
      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal(null)}
          onConfirm={confirmModal.onConfirm}
          title={confirmModal.title}
          message={confirmModal.message}
          variant={confirmModal.variant}
          isLoading={deleteTaskMutation.isPending}
          confirmText={confirmModal.variant === 'danger' ? 'Excluir' : 'Confirmar'}
        />
      )}

      {/* Duration Adjustment Modal */}
      {durationAdjustModal && (
        <DurationAdjustModal
          isOpen={durationAdjustModal.isOpen}
          onClose={() => setDurationAdjustModal(null)}
          onConfirm={handleDurationAdjustConfirm}
          taskName={durationAdjustModal.taskName}
          currentStartDate={durationAdjustModal.currentStartDate}
          currentEndDate={durationAdjustModal.currentEndDate}
          currentDuration={durationAdjustModal.currentDuration}
          newDuration={durationAdjustModal.newDuration}
        />
      )}

      <div className="bg-white rounded-lg border overflow-hidden relative">
        {/* Loading Overlay */}
        <LoadingOverlay isLoading={isLoading} message="Carregando dados..." />

        {/* Toolbar */}
        <TableToolbar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          sortOrder={sortOrder}
          onToggleSortOrder={toggleSortOrder}
          resultCount={filteredMainTasks.length}
          onAddTask={() => setIsAddingTask(true)}
          isAddingTask={isAddingTask}
        />

        {/* ONDA 1: Resumo de Custos */}
        <div className="px-4 pt-4">
          <ProjectCostSummary
            totalEstimatedCost={totalEstimatedCost}
            totalActualCost={totalActualCost}
          />
        </div>

        {/* Empty State ou Tabela */}
        {filteredMainTasks.length === 0 && !isAddingTask ? (
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
              searchTerm ? undefined : {
                label: "+ Criar Primeira Tarefa",
                onClick: () => setIsAddingTask(true)
              }
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <TableHeader />
              <tbody className="bg-white divide-y divide-gray-200">
                {/* Linha de nova tarefa */}
                {isAddingTask && (
                  <NewTaskRow
                    name={newTaskData.name}
                    type={newTaskData.type}
                    workType={newTaskData.workType}
                    duration={newTaskData.duration}
                    onNameChange={(value) => setNewTaskData(prev => ({ ...prev, name: value }))}
                    onTypeChange={(value) => setNewTaskData(prev => ({ ...prev, type: value as any }))}
                    onWorkTypeChange={(value) => setNewTaskData(prev => ({ ...prev, workType: value }))}
                    onDurationChange={(value) => setNewTaskData(prev => ({ ...prev, duration: value }))}
                    onSave={handleCreateTask}
                    onCancel={handleCancelCreateTask}
                    isSaving={createTaskMutation.isPending}
                  />
                )}

                {/* Tarefas existentes */}
                {filteredMainTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    level={0}
                    allTasks={tasks}
                    resources={resources}
                    allocations={allocations}
                    hasChange={hasChange}
                    getCurrentValue={getCurrentValue}
                    onFieldChange={handleFieldChange}
                    onAddSubtask={handleAddSubtask}
                    onDelete={handleDelete}
                    onOpenAllocation={handleOpenAllocation}
                    calculateTotalCost={calculateTotalCost}
                    addingSubtaskTo={addingSubtaskTo}
                    newSubtaskData={newSubtaskData}
                    onSubtaskNameChange={(value) => setNewSubtaskData(prev => ({ ...prev, name: value }))}
                    onSubtaskWorkTypeChange={(value) => setNewSubtaskData(prev => ({ ...prev, workType: value }))}
                    onSubtaskDurationChange={(value) => setNewSubtaskData(prev => ({ ...prev, duration: value }))}
                    onSaveSubtask={handleCreateSubtask}
                    onCancelSubtask={handleCancelCreateSubtask}
                    isSavingSubtask={createTaskMutation.isPending && addingSubtaskTo !== null}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Batch Save Bar */}
      <BatchSaveBar
        changeCount={changeCount}
        onSave={handleSaveAll}
        onDiscard={clearChanges}
        isSaving={batchUpdateMutation.isPending}
      />

      {/* Allocation Modal (ONDA 3: Com suporte a edição) */}
      {allocationModal && allocationModal.isOpen && (() => {
        const task = tasks.find(t => t.id === allocationModal.taskId)
        if (!task) return null

        return (
          <AllocationModal
            task={task}
            projectLeaderId={project.leader_id}
            allocationId={allocationModal.allocationId}  // ONDA 3: Passar ID para modo de edição
            onClose={() => setAllocationModal(null)}
            onSuccess={handleAllocationSuccess}
          />
        )
      })()}
    </TableViewErrorBoundary>
  )
}
