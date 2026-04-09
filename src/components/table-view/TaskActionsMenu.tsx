import React from 'react'

interface TaskActionsMenuProps {
  taskId: string
  taskName: string
  hasSubtasks: boolean
  isPurchaseList?: boolean
  onAddSubtask: (taskId: string) => void
  onDelete: (taskId: string, taskName: string, hasSubtasks: boolean) => void
  onEditList?: (taskId: string) => void
}

/**
 * Menu de ações para cada tarefa (adicionar subtarefa, deletar, editar lista de compras)
 */
export const TaskActionsMenu = React.memo(function TaskActionsMenu({
  taskId,
  taskName,
  hasSubtasks,
  isPurchaseList = false,
  onAddSubtask,
  onDelete,
  onEditList,
}: TaskActionsMenuProps) {
  return (
    <div className="flex gap-2 justify-center">
      {isPurchaseList && onEditList && (
        <button
          onClick={() => onEditList(taskId)}
          className="text-orange-500 hover:text-orange-700 transition-colors p-1"
          title="Editar lista de compras"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      )}
      <button
        onClick={() => onAddSubtask(taskId)}
        className="text-green-600 hover:text-green-700 transition-colors p-1"
        title="Adicionar subtarefa"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
      <button
        onClick={() => onDelete(taskId, taskName, hasSubtasks)}
        className="text-red-600 hover:text-red-700 transition-colors p-1"
        title="Excluir tarefa"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  )
})
