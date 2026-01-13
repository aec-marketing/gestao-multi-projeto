'use client'

import React, { useState, useCallback } from 'react'
import { Project } from '@/types/database.types'
import { useBatchUpdateTasks, useDeleteTask } from '@/queries/tasks.queries'
import { useTableData } from '@/hooks/table/useTableData'
import { useTableFilters } from '@/hooks/table/useTableFilters'
import { usePendingChanges } from '@/hooks/table/usePendingChanges'
import { useTaskCalculations } from '@/hooks/table/useTaskCalculations'
import { TableToolbar } from './TableToolbar'
import { TableHeader } from './TableHeader'
import { TaskRow } from './TaskRow'
import { BatchSaveBar } from './BatchSaveBar'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { DurationAdjustModal, DurationAdjustmentType } from '@/components/modals/DurationAdjustModal'
import { applyDurationAdjustment } from '@/utils/taskDateSync'
import TableViewErrorBoundary from '@/components/error-boundary/TableViewErrorBoundary'

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

  // ==================== CALCULATIONS ====================
  const { calculateTotalCost } = useTaskCalculations(tasks)

  // ==================== UI STATE ====================
  const [isAddingTask, setIsAddingTask] = useState(false)
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

  // ==================== FILTERED TASKS ====================
  const filteredMainTasks = filterAndSort(mainTasks)

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

    // Add all updated fields to pending changes
    Object.entries(updates).forEach(([field, value]) => {
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
   */
  const handleSaveAll = useCallback(async () => {
    const updates = prepareBatchUpdates(tasks)

    try {
      await batchUpdateMutation.mutateAsync(updates)
      clearChanges()
    } catch (error) {
      // Erro já tratado pela mutation
      console.error('Error saving changes:', error)
    }
  }, [prepareBatchUpdates, tasks, batchUpdateMutation, clearChanges])

  /**
   * Handler para adicionar subtarefa
   */
  const handleAddSubtask = useCallback((taskId: string) => {
    // TODO: Implementar modal de adicionar subtarefa
    console.log('Add subtask to:', taskId)
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
                    calculateTotalCost={calculateTotalCost}
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
    </TableViewErrorBoundary>
  )
}
